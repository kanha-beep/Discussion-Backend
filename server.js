// server.js → HTTP + Socket.IO
import dotenv from "dotenv";
dotenv.config();
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
const server = http.createServer(app);
const allowedOrigins = process.env.FRONT_END.split(",")

console.log("urls socket: ", allowedOrigins)
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});
const roomHosts = new Map();     // roomId -> hostSocketId
const waitingUsers = new Map();
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);
  socket.on("join-call", ({ roomId }) => {
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
    console.log("joining chat:", chatId);
    socket.join(chatId);
  });
  socket.on("send-message", (data) => {
    socket.to(data.chatId).emit("receive-message", data);
  });
  // join meeting room
  socket.on("join-room", ({ roomId, user }) => {
    socket.join(roomId)
    if (!roomId) {
      console.log("ERROR: roomId is null");
      return;
    }
    const room = io.sockets.adapter.rooms.get(roomId);
    const count = room ? room.size : 0;
    io.to(roomId).emit("room-users-count", count, roomId);
    console.log("count: ", count)
    io.to("watch-" + roomId).emit("room-users-count", count, roomId);
    socket.to(roomId).emit("user-joined", { socketId: socket.id });
  })
  // watch room (for homepage count only)
  socket.on("watch-room", ({ roomId }) => {
    socket.join("watch-" + roomId);

    const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;

    socket.emit("room-users-count", count, roomId);
  });
  // WebRTC signaling (multi-user)
  socket.on("room-offer", ({ roomId, offer, to }) => {
    socket.to(to).emit("room-offer", { offer, from: socket.id })
  })
  socket.on("join-room-request", ({ roomId }) => {
    if (!roomHosts.has(roomId)) {
      roomHosts.set(roomId, socket.id); // first user = host
      socket.join(roomId);
      io.to(socket.id).emit("admitted");
    } else {
      if (!waitingUsers.has(roomId)) waitingUsers.set(roomId, new Set());
      waitingUsers.get(roomId).add(socket.id);

      const hostId = roomHosts.get(roomId);
      io.to(hostId).emit("join-request", {
        socketId: socket.id
      });
    }
  });
  socket.on("admit-user", ({ roomId, socketId }) => {
    socket.to(socketId).emit("admitted");
    io.sockets.sockets.get(socketId)?.join(roomId);
    waitingUsers.get(roomId)?.delete(socketId);
  });

  socket.on("reject-user", ({ socketId }) => {
    socket.to(socketId).emit("rejected");
  });
  socket.on("kick-user", ({ roomId, socketId }) => {
    io.sockets.sockets.get(socketId)?.leave(roomId);
    socket.to(socketId).emit("kicked");
  });

  socket.on("room-answer", ({ answer, to }) => {
    socket.to(to).emit("room-answer", { answer, from: socket.id })
  })

  socket.on("room-ice", ({ candidate, to }) => {
    socket.to(to).emit("room-ice", { candidate, from: socket.id })
  })
  socket.on("board-draw", ({ roomId, x, y, type, sender }) => {
    console.log("forwarding draw:", roomId);
    socket.to(roomId).emit("board-draw", { x, y, type, sender });
  });

  // room chat
  socket.on("room-message", (data) => {

    io.to(data.roomId).emit("room-message", data)
  })

  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId)
    const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;

    io.to(roomId).emit("room-users-count", count, roomId);
    io.to("watch-" + roomId).emit("room-users-count", count, roomId);
    socket.to(roomId).emit("user-left", socket.id)
  })

  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomId) => {
      if (roomId === socket.id) return;

      const room = io.sockets.adapter.rooms.get(roomId);
      const count = room ? room.size - 1 : 0;

      console.log("leave count:", count);

      io.in(roomId).emit("room-users-count", count, roomId);

      socket.to(roomId).emit("user-left", socket.id);
    });
  });

});

export { server, io };
