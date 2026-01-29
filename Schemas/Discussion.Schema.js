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
        ref: "User"
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});
