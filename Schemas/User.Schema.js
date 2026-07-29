import mongoose from "mongoose";

export const UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    profession: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
    },
    confirmPassword: {
        type: String,
    },
    roles: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    friends: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ],
    friendRequestsSent: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ],
    friendRequestsReceived: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ]
})
