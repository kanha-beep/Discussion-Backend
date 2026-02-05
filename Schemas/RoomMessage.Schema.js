// models/RoomMessage.js
import mongoose from "mongoose";

export const roomMessageSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
}, { timestamps: true });