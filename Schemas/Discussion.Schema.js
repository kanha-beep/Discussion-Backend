import mongoose from "mongoose";

export const discussionFormSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    keywords: [{
        type: String,
    }],
    remarks: {
        type: String,
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", default: []
    }],
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
