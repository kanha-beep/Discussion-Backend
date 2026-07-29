import mongoose from "mongoose";

export const discussionFormSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    title: {
        type: String,
        trim: true,
        default: "",
    },
    keywords: [{
        type: String,
    }],
    scheduledFor: {
        type: Date,
        default: null,
    },
    remarks: {
        type: String,
    },
    summary: {
        type: String,
        default: "",
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "ongoing"],
        default: "pending"
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        index: true
    },
    closurePackage: {
        closedAt: {
            type: Date,
            default: null,
        },
        closedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        deleteAt: {
            type: Date,
            default: null,
        },
        notes: {
            type: String,
            default: "",
        },
        transcript: {
            type: String,
            default: "",
        },
        imageUrls: [{
            type: String,
            trim: true,
        }],
        noteRecipients: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        notesPdfRequestedBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        feedbackEntries: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            aboutUser: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            engagementRating: {
                type: Number,
                min: 1,
                max: 5,
                required: true,
            },
            partnerRating: {
                type: Number,
                min: 1,
                max: 5,
                required: true,
            },
            comments: {
                type: String,
                trim: true,
                maxlength: 1000,
                default: "",
            },
            wantsNotesPdfEmail: {
                type: Boolean,
                default: false,
            },
            submittedAt: {
                type: Date,
                default: Date.now,
            },
        }],
        copilotBrief: {
            type: String,
            default: "",
        },
        actionItems: [{
            title: { type: String, trim: true, default: "" },
            ownerLabel: { type: String, trim: true, default: "" },
            citation: { type: String, trim: true, default: "" },
            status: { type: String, trim: true, default: "open" },
        }],
        unresolvedQuestions: [{
            question: { type: String, trim: true, default: "" },
            askedBy: { type: String, trim: true, default: "" },
            citation: { type: String, trim: true, default: "" },
        }],
        recordings: [{
            label: { type: String, trim: true, default: "" },
            provider: { type: String, trim: true, default: "" },
            url: { type: String, trim: true, default: "" },
            durationSeconds: { type: Number, default: 0 },
        }],
    },
    // createdAt: {
    //     type: Date,
    //     default: Date.now
    // }
}, { timestamps: true })
