// models/Room.js
import mongoose from "mongoose";

export const roomSchema = new mongoose.Schema({
    name: String,
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPrivate: { type: Boolean, default: true },
    discussion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DiscussionForm",
        unique: true,
        required: true,
        index: true
    },
}, { timestamps: true });