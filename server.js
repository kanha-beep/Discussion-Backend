import dotenv from "dotenv";
dotenv.config();
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { Room } from "./Models/Room.Model.js";
import { DiscussionForm } from "./Models/Discussion.Models.js";
import { RoomMessage } from "./Models/RoomMessage.Model.js";
import { appendRoomTranscriptEntry } from "./services/meetingCopilot.service.js";
import {
  getRoomPermissions,
  hasRoomPermission,
  verifyRoomJoinToken,
} from "./utils/roomAccess.js";

const server = http.createServer(app);
const allowedOrigins = process.env.FRONT_END.split(",");

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

const roomHosts = new Map();
const waitingUsers = new Map();
const socketBotMutePreferences = new Map();
const socketActiveRooms = new Map();
const userActiveRooms = new Map();
const socketRoomSessions = new Map();

const createSocketRoomKey = (socketId, roomId) => `${socketId}:${roomId}`;

const getSocketRoomSession = (socket, roomId) =>
  socketRoomSessions.get(createSocketRoomKey(socket.id, roomId));

const setSocketRoomSession = (socket, roomId, session) => {
  socketRoomSessions.set(createSocketRoomKey(socket.id, roomId), session);
};

const clearSocketRoomSessions = (socket) => {
  [...socketRoomSessions.keys()].forEach((key) => {
    if (key.startsWith(`${socket.id}:`)) {
      socketRoomSessions.delete(key);
    }
  });
};

const isBotMutedForSocket = (socketId, botId) => {
  const preferences = socketBotMutePreferences.get(socketId);
  return !!preferences?.all || !!preferences?.[botId];
};

const emitBotVoiceToRoom = (roomId, payload) => {
  if (!roomId) return;
  const memberSocketIds = io.sockets.adapter.rooms.get(roomId);
  if (!memberSocketIds) return;

  memberSocketIds.forEach((socketId) => {
    if (isBotMutedForSocket(socketId, payload?.bot)) return;
    io.to(socketId).emit("bot-voice", payload);
  });
};

const emitRoomMessageToRoom = (roomId, payload) => {
  if (!roomId) return;
  io.to(roomId).emit("room-message", payload);
};

const syncDiscussionStatusForRoom = async (roomId, count) => {
  if (!roomId || String(roomId).startsWith("watch-")) return;

  try {
    const room = await Room.findById(roomId).select("discussion status startedAt");
    if (!room?.discussion) return;

    await DiscussionForm.findByIdAndUpdate(room.discussion, {
      status: count > 0 ? "ongoing" : "pending",
    });

    await Room.findByIdAndUpdate(roomId, {
      status: count > 0 ? "live" : room.status === "closed" ? "closed" : "scheduled",
      startedAt: count > 0 ? room.startedAt || new Date() : room.startedAt,
    });
  } catch (error) {
    console.log("error syncing discussion status:", error?.message);
  }
};

const getPersistedRoom = async (roomId) => {
  try {
    if (!roomId || String(roomId).startsWith("watch-")) return null;
    return await Room.findById(roomId)
      .populate("discussion", "owner keywords summary")
      .select(
        "isPrivate maxParticipants host members discussion joinTokenVersion moderation status scheduledFor collaborativeDocuments knowledgeThreads recordings copilot transcriptEntries",
      );
  } catch (error) {
    console.log("error fetching room for privacy rules:", error?.message);
    return null;
  }
};

const authorizeRoomEvent = async (socket, roomId, permission) => {
  const session = getSocketRoomSession(socket, roomId);
  if (!session) {
    socket.emit("room-auth-error", { roomId, message: "Authenticate for this room first." });
    return null;
  }

  const room = await getPersistedRoom(roomId);
  if (!room) {
    socket.emit("room-auth-error", { roomId, message: "Room not found." });
    return null;
  }

  if (Number(session.membershipVersion) !== Number(room.joinTokenVersion || 1)) {
    socket.emit("room-auth-error", {
      roomId,
      message: "Room permissions changed. Refresh your room session.",
    });
    return null;
  }

  if (!hasRoomPermission(session, permission)) {
    socket.emit("room-auth-error", {
      roomId,
      message: `Missing permission ${permission}.`,
    });
    return null;
  }

  return { room, session };
};

const emitRoomCountForTargets = (roomId) => {
  if (!roomId || String(roomId).startsWith("watch-")) return;
  const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
  io.to(roomId).emit("room-users-count", count, roomId);
  io.to(`watch-${roomId}`).emit("room-users-count", count, roomId);
  syncDiscussionStatusForRoom(roomId, count);
  return count;
};

const removeSocketFromRoomTracking = (socket, roomId) => {
  if (!roomId) return;

  socket.leave(roomId);

  if (roomHosts.get(roomId) === socket.id) {
    roomHosts.delete(roomId);
  }

  waitingUsers.get(roomId)?.delete(socket.id);
  if ((waitingUsers.get(roomId)?.size || 0) === 0) {
    waitingUsers.delete(roomId);
  }

  const activeRoomId = socketActiveRooms.get(socket.id);
  if (activeRoomId === roomId) {
    socketActiveRooms.delete(socket.id);
  }

  if (socket.data?.userId) {
    const activeUserRoomId = userActiveRooms.get(String(socket.data.userId));
    if (activeUserRoomId === roomId) {
      userActiveRooms.delete(String(socket.data.userId));
    }
  }

  socket.to(roomId).emit("user-left", socket.id);
  emitRoomCountForTargets(roomId);
};

const ensureExclusiveActiveRoom = (socket, nextRoomId) => {
  const currentRoomId = socketActiveRooms.get(socket.id);
  if (currentRoomId && currentRoomId !== nextRoomId) {
    removeSocketFromRoomTracking(socket, currentRoomId);
  }

  if (socket.data?.userId) {
    const userId = String(socket.data.userId);
    const userRoomId = userActiveRooms.get(userId);
    if (userRoomId && userRoomId !== nextRoomId) {
      const previousSocketId = [...io.sockets.sockets.values()].find(
        (connectedSocket) =>
          String(connectedSocket.data?.userId || "") === userId &&
          socketActiveRooms.get(connectedSocket.id) === userRoomId,
      )?.id;

      if (previousSocketId) {
        const previousSocket = io.sockets.sockets.get(previousSocketId);
        if (previousSocket && previousSocket.id !== socket.id) {
          removeSocketFromRoomTracking(previousSocket, userRoomId);
        }
      }
    }
  }
};

io.on("connection", (socket) => {
  socketBotMutePreferences.set(socket.id, {
    "bot.moderator": false,
    "bot.assistant": false,
    all: false,
  });

  socket.on("register-user", ({ userId }) => {
    if (!userId) return;
    socket.data.userId = String(userId);
    socket.join(`user:${userId}`);
  });

  socket.on("auth-room", async ({ roomId, joinToken }, ack) => {
    try {
      const decoded = verifyRoomJoinToken(joinToken);
      if (String(decoded.roomId) !== String(roomId)) {
        throw new Error("Token room mismatch");
      }

      const room = await getPersistedRoom(roomId);
      if (!room) throw new Error("Room not found");

      const user = {
        _id: decoded.sub,
        roles: decoded.role === "host" ? "admin" : "user",
      };
      const currentAccess = getRoomPermissions({ room, user });

      const session = {
        roomId: String(roomId),
        userId: String(decoded.sub),
        role: currentAccess.role,
        permissions: currentAccess.permissions,
        membershipVersion: Number(room.joinTokenVersion || 1),
      };

      setSocketRoomSession(socket, roomId, session);
      socket.data.userId = String(decoded.sub);

      ack?.({ ok: true, role: session.role, permissions: session.permissions });
    } catch (error) {
      ack?.({ ok: false, message: error?.message || "Room auth failed" });
    }
  });

  socket.on("bot-voice", async ({ roomId, bot, text, audio_url }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:join");
    if (!auth) return;

    emitBotVoiceToRoom(roomId, {
      bot,
      text,
      audio_url,
    });
  });

  socket.on("set-bot-mute", ({ botId, muted }) => {
    if (!botId) return;

    const currentPreferences = socketBotMutePreferences.get(socket.id) || {
      "bot.moderator": false,
      "bot.assistant": false,
      all: false,
    };

    if (botId === "all") {
      socketBotMutePreferences.set(socket.id, {
        ...currentPreferences,
        all: !!muted,
      });
      return;
    }

    socketBotMutePreferences.set(socket.id, {
      ...currentPreferences,
      [botId]: !!muted,
    });
  });

  socket.on("join-call", async ({ roomId }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:signal");
    if (!auth) return;
    socket.join(roomId);
    socket.to(roomId).emit("user-joined-call", socket.id);
  });

  socket.on("call-user", ({ roomId, offer }) => {
    socket.to(roomId).emit("incoming-call", { offer });
  });

  socket.on("answer-call", ({ roomId, answer }) => {
    socket.to(roomId).emit("call-answered", { answer });
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", { candidate });
  });

  socket.on("join-chat", (chatId) => {
    socket.join(chatId);
  });

  socket.on("send-message", (data) => {
    socket.to(data.chatId).emit("receive-message", data);
  });

  socket.on("join-room", async ({ roomId }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:join");
    if (!auth) return;

    ensureExclusiveActiveRoom(socket, roomId);

    if (socket.rooms.has(roomId)) {
      socketActiveRooms.set(socket.id, roomId);
      if (socket.data?.userId) {
        userActiveRooms.set(String(socket.data.userId), roomId);
      }
      return;
    }

    socket.join(roomId);
    socketActiveRooms.set(socket.id, roomId);
    if (socket.data?.userId) {
      userActiveRooms.set(String(socket.data.userId), roomId);
    }

    if (auth.session.role === "host") {
      roomHosts.set(roomId, socket.id);
    }

    await Room.findByIdAndUpdate(roomId, {
      $set: {
        status: "live",
        startedAt: new Date(),
      },
      $addToSet: {
        members: auth.session.userId,
      },
    });

    socket.to(roomId).emit("user-joined", { socketId: socket.id });
    emitRoomCountForTargets(roomId);
  });

  socket.on("watch-room", ({ roomId }) => {
    socket.join(`watch-${roomId}`);
    const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    socket.emit("room-users-count", count, roomId);
  });

  socket.on("room-offer", async ({ roomId, offer, to }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:signal");
    if (!auth) return;
    socket.to(to).emit("room-offer", { offer, from: socket.id });
  });

  socket.on("join-room-request", async ({ roomId }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:request_join");
    if (!auth) return;

    const { room, session } = auth;
    const actualHostUserId = String(room.host || "");
    const isActualHost = String(session.userId || "") === actualHostUserId;

    if (isActualHost || session.role === "host") {
      roomHosts.set(roomId, socket.id);
      socket.emit("host");
      socket.emit("admitted");
      return;
    }

    if (session.permissions?.includes("room:join")) {
      socket.emit("admitted");
      return;
    }

    if (!room.isPrivate) {
      socket.emit("admitted");
      return;
    }

    const activeCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    if (activeCount >= (room?.maxParticipants || 4)) {
      socket.emit("room-full", {
        roomId,
        message: "Private room is full. Maximum 4 participants allowed.",
      });
      return;
    }

    if (!waitingUsers.has(roomId)) waitingUsers.set(roomId, new Set());
    waitingUsers.get(roomId).add(socket.id);

    const hostSocketId = roomHosts.get(roomId);
    if (!hostSocketId) {
      waitingUsers.get(roomId)?.delete(socket.id);
      socket.emit("rejected");
      return;
    }

    io.to(hostSocketId).emit("join-request", {
      socketId: socket.id,
      userId: session.userId,
      name: socket.data.userId || socket.id,
    });
    io.to(hostSocketId).emit(
      "waiting-users",
      [...(waitingUsers.get(roomId) || [])].map((id) => {
        const candidateSession = getSocketRoomSession(io.sockets.sockets.get(id), roomId);
        return {
          socketId: id,
          userId: candidateSession?.userId || "",
          name: candidateSession?.userId || id,
        };
      }),
    );
  });

  socket.on("admit-user", async ({ roomId, socketId }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:admit");
    if (!auth) return;

    const target = io.sockets.sockets.get(socketId);
    if (!target) return;

    const targetSession = getSocketRoomSession(target, roomId);
    if (!targetSession) return;

    const activeCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    if (auth.room?.isPrivate && activeCount >= (auth.room?.maxParticipants || 4)) {
      target.emit("room-full", {
        roomId,
        message: "Private room is full. Maximum 4 participants allowed.",
      });
      return;
    }

    await Room.findByIdAndUpdate(roomId, {
      $addToSet: {
        members: targetSession.userId,
        "moderation.participantState": {
          user: targetSession.userId,
          muted: false,
          admittedAt: new Date(),
          lastSeenAt: new Date(),
        },
      },
      $push: {
        "moderation.events": {
          action: "admit",
          actor: auth.session.userId,
          targetUser: targetSession.userId,
          targetSocketId: socketId,
          note: "Host admitted participant",
          createdAt: new Date(),
        },
      },
      $inc: { joinTokenVersion: 1 },
    });

    const updatedRoom = await getPersistedRoom(roomId);
    const updatedAccess = getRoomPermissions({
      room: updatedRoom,
      user: { _id: targetSession.userId, roles: "user" },
    });

    setSocketRoomSession(target, roomId, {
      ...targetSession,
      role: updatedAccess.role,
      permissions: updatedAccess.permissions,
      membershipVersion: Number(updatedRoom.joinTokenVersion || 1),
    });

    target.emit("admitted");
    waitingUsers.get(roomId)?.delete(socketId);
  });

  socket.on("reject-user", async ({ roomId, socketId }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:admit");
    if (!auth) return;

    io.to(socketId).emit("rejected");
    waitingUsers.get(roomId)?.delete(socketId);

    await Room.findByIdAndUpdate(roomId, {
      $push: {
        "moderation.events": {
          action: "reject",
          actor: auth.session.userId,
          targetSocketId: socketId,
          note: "Host rejected participant",
          createdAt: new Date(),
        },
      },
    });
  });

  socket.on("kick-user", async ({ roomId, socketId }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:kick");
    if (!auth) return;

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) return;

    const targetSession = getSocketRoomSession(targetSocket, roomId);

    removeSocketFromRoomTracking(targetSocket, roomId);
    io.to(socketId).emit("kicked");

    await Room.findByIdAndUpdate(roomId, {
      $pull: {
        members: targetSession?.userId,
        "moderation.participantState": { user: targetSession?.userId },
      },
      $push: {
        "moderation.events": {
          action: "kick",
          actor: auth.session.userId,
          targetUser: targetSession?.userId || null,
          targetSocketId: socketId,
          note: "Host removed participant",
          createdAt: new Date(),
        },
      },
      $inc: { joinTokenVersion: 1 },
    });
  });

  socket.on("mute-user", async ({ roomId, socketId, muted }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:mute");
    if (!auth) return;

    const targetSocket = io.sockets.sockets.get(socketId);
    const targetSession = targetSocket ? getSocketRoomSession(targetSocket, roomId) : null;

    await Room.findOneAndUpdate(
      {
        _id: roomId,
        "moderation.participantState.user": targetSession?.userId,
      },
      {
        $set: {
          "moderation.participantState.$.muted": !!muted,
          "moderation.participantState.$.lastSeenAt": new Date(),
        },
        $push: {
          "moderation.events": {
            action: muted ? "mute" : "unmute",
            actor: auth.session.userId,
            targetUser: targetSession?.userId || null,
            targetSocketId: socketId,
            note: muted ? "Participant muted" : "Participant unmuted",
            createdAt: new Date(),
          },
        },
      },
    );

    io.to(socketId).emit("moderation:update", {
      roomId,
      muted: !!muted,
    });
  });

  socket.on("room-answer", ({ answer, to }) => {
    socket.to(to).emit("room-answer", { answer, from: socket.id });
  });

  socket.on("room-ice", ({ candidate, to }) => {
    socket.to(to).emit("room-ice", { candidate, from: socket.id });
  });

  socket.on("board-draw", async (payload) => {
    const { roomId } = payload || {};
    const auth = await authorizeRoomEvent(socket, roomId, "room:chat");
    if (!auth) return;
    socket.to(roomId).emit("board-draw", payload);
  });

  socket.on("board-clear", async ({ roomId }) => {
    const auth = await authorizeRoomEvent(socket, roomId, "room:chat");
    if (!auth) return;
    socket.to(roomId).emit("board-clear");
  });

  socket.on("room-message", async (data) => {
    const auth = await authorizeRoomEvent(socket, data?.roomId, "room:chat");
    if (!auth) return;

    const payload = {
      ...data,
      createdAt: data?.createdAt || new Date(),
    };

    if (data?.roomId && data?.text && auth.session.userId) {
      try {
        await RoomMessage.create({
          room: data.roomId,
          sender: auth.session.userId,
          text: data.text,
        });

        await appendRoomTranscriptEntry({
          roomId: data.roomId,
          entry: {
            sender: auth.session.userId,
            speakerName:
              data?.sender?.name || data?.sender?.email || data?.sender?.id || "Participant",
            text: data.text,
            source: "chat",
            createdAt: payload.createdAt,
          },
        });
      } catch (error) {
        console.log("error saving room message:", error?.message);
      }
    }

    io.to(data.roomId).emit("room-message", payload);
  });

  socket.on("leave-room", ({ roomId }) => {
    removeSocketFromRoomTracking(socket, roomId);
  });

  socket.on("disconnecting", () => {
    socketBotMutePreferences.delete(socket.id);
    const activeRoomId = socketActiveRooms.get(socket.id);
    if (activeRoomId) {
      removeSocketFromRoomTracking(socket, activeRoomId);
    }

    roomHosts.forEach((hostId, roomId) => {
      if (hostId === socket.id) {
        roomHosts.delete(roomId);
        waitingUsers.delete(roomId);
      }
    });

    socket.rooms.forEach((roomId) => {
      if (roomId === socket.id) return;
      if (String(roomId).startsWith("user:")) return;
      if (String(roomId).startsWith("watch-")) return;
      if (roomId === activeRoomId) return;

      const room = io.sockets.adapter.rooms.get(roomId);
      const count = room ? room.size - 1 : 0;
      io.in(roomId).emit("room-users-count", count, roomId);
      syncDiscussionStatusForRoom(roomId, count);
      socket.to(roomId).emit("user-left", socket.id);
    });

    socketActiveRooms.delete(socket.id);
    if (socket.data?.userId) {
      const userId = String(socket.data.userId);
      if (userActiveRooms.get(userId) === activeRoomId) {
        userActiveRooms.delete(userId);
      }
    }

    clearSocketRoomSessions(socket);
  });
});

export { server, io, emitBotVoiceToRoom, emitRoomMessageToRoom };
