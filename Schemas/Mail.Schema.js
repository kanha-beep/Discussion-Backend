import mongoose from "mongoose";

export const mailSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderEmail: {
      type: String,
      required: true,
      trim: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    readByRecipient: {
      type: Boolean,
      default: false,
    },
    autoDeleteAt: {
      type: Date,
      default: null,
      index: { expires: 0 },
    },
    metadata: {
      room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        default: null,
      },
      discussion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DiscussionForm",
        default: null,
      },
      kind: {
        type: String,
        default: "general",
      },
      noteSummary: {
        type: String,
        default: "",
      },
      imageUrls: [{
        type: String,
        trim: true,
      }],
      requestedPdf: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true },
);
