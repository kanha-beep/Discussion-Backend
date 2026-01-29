// server.js → HTTP + Socket.IO
import dotenv from "dotenv";
dotenv.config();
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONT_END.split(","),
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
  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

export { server, io };
