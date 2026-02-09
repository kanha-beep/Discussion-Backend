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
    // const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    const room = io.sockets.adapter.rooms.get(roomId);
    const count = room ? room.size : 0;
    io.to(roomId).emit("room-users-count", count, roomId);
    console.log("count: ", count)
    // send count to everyone in room (including sender)
    // io.in(roomId).emit("room-users-count", count, roomId);
    // socket.to(roomId).emit("user-joined", { user, socketId: socket.id })
    socket.to(roomId).emit("user-joined", { socketId: socket.id });
    // setTimeout(() => {
    //   const room = io.sockets.adapter.rooms.get(roomId);
    //   const count = room ? room.size : 0;

    //   console.log("room:", roomId, "count:", count);

    //   io.to(roomId).emit("room-users-count", count, roomId);
    // }, 50);
  })
  // WebRTC signaling (multi-user)
  socket.on("room-offer", ({ roomId, offer, to }) => {
    socket.to(to).emit("room-offer", { offer, from: socket.id })
  })
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
    // socket.to(data.roomId).emit("room-message", data)

    io.to(data.roomId).emit("room-message", data)
  })

  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId)
    const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;

    io.to(roomId).emit("room-users-count", count, roomId);
    socket.to(roomId).emit("user-left", socket.id)
  })
  // socket.on("disconnecting", () => {
  //   for (const room of socket.rooms) {
  //     socket.to(room).emit("user-left", socket.id);
  //   }
  // });
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

  // socket.on("disconnect", () => {
  //   socket.rooms.forEach((roomId) => {
  //     if (roomId === socket.id) return;

  //     const room = io.sockets.adapter.rooms.get(roomId);
  //     const count = room ? room.size : 0;

  //     io.to(roomId).emit("room-users-count", count, roomId);
  //   });
  // });

});

export { server, io };
