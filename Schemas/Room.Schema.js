// models/Room.js
import mongoose from "mongoose";

export const roomSchema = new mongoose.Schema({
    name: String,
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPrivate: { type: Boolean, default: true },
}, { timestamps: true });