// models/Room.js
import mongoose from "mongoose";

export const roomSchema = new mongoose.Schema({
    name: String,
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPrivate: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ["scheduled", "live", "closed"],
        default: "scheduled",
    },
    scheduledFor: {
        type: Date,
        default: null,
    },
    startedAt: {
        type: Date,
        default: null,
    },
    endedAt: {
        type: Date,
        default: null,
    },
    minParticipants: { type: Number, default: 3, min: 3, max: 6 },
    maxParticipants: { type: Number, default: 4, min: 3, max: 6 },
    joinTokenVersion: {
        type: Number,
        default: 1,
    },
    botAudioMuted: {
        moderator: { type: Boolean, default: false },
        assistant: { type: Boolean, default: false },
        all: { type: Boolean, default: false },
    },
    moderation: {
        waitingRoomEnabled: {
            type: Boolean,
            default: true,
        },
        events: [{
            action: { type: String, trim: true },
            actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            targetSocketId: { type: String, trim: true, default: "" },
            note: { type: String, trim: true, default: "" },
            createdAt: { type: Date, default: Date.now },
        }],
        participantState: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            muted: { type: Boolean, default: false },
            admittedAt: { type: Date, default: Date.now },
            lastSeenAt: { type: Date, default: Date.now },
        }],
    },
    recordings: [{
        label: { type: String, trim: true, default: "" },
        provider: { type: String, trim: true, default: "browser" },
        url: { type: String, trim: true, default: "" },
        durationSeconds: { type: Number, default: 0 },
        sizeBytes: { type: Number, default: 0 },
        checksum: { type: String, trim: true, default: "" },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        createdAt: { type: Date, default: Date.now },
    }],
    uploads: [{
        fileName: { type: String, trim: true, default: "" },
        mimeType: { type: String, trim: true, default: "" },
        sizeBytes: { type: Number, default: 0 },
        checksum: { type: String, trim: true, default: "" },
        status: {
            type: String,
            enum: ["accepted", "rejected"],
            default: "accepted",
        },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        createdAt: { type: Date, default: Date.now },
    }],
    transcriptEntries: [{
        speakerName: { type: String, trim: true, default: "Participant" },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        text: { type: String, trim: true, default: "" },
        source: { type: String, trim: true, default: "chat" },
        citations: [{ type: String, trim: true }],
        botOnly: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
    }],
    collaborativeDocuments: [{
        title: { type: String, trim: true, required: true },
        content: { type: String, default: "" },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    }],
    knowledgeThreads: [{
        title: { type: String, trim: true, required: true },
        prompt: { type: String, trim: true, default: "" },
        summary: { type: String, trim: true, default: "" },
        references: [{ type: String, trim: true }],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    }],
    copilot: {
        liveSummary: { type: String, default: "" },
        meetingBrief: { type: String, default: "" },
        citations: [{ type: String, trim: true }],
        unresolvedQuestions: [{
            question: { type: String, trim: true, default: "" },
            askedBy: { type: String, trim: true, default: "" },
            citation: { type: String, trim: true, default: "" },
        }],
        actionItems: [{
            title: { type: String, trim: true, required: true },
            owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            ownerLabel: { type: String, trim: true, default: "" },
            status: {
                type: String,
                enum: ["open", "in_progress", "done"],
                default: "open",
            },
            citation: { type: String, trim: true, default: "" },
            createdAt: { type: Date, default: Date.now },
        }],
        updatedAt: { type: Date, default: null },
    },
    discussion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DiscussionForm",
        unique: true,
        required: true,
        index: true
    },
}, { timestamps: true });
