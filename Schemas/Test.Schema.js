import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    prompt: { type: String, required: true },
    subject: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    options: {
      type: [optionSchema],
      validate: [(value) => value.length === 4, "Exactly four options are required"],
    },
    correctOption: { type: String, required: true },
    explanation: { type: String, required: true },
  },
  { _id: true },
);

export const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    totalMarks: { type: Number, required: true, min: 0 },
    instructions: { type: [String], default: [] },
    promptSource: { type: String, default: "", trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true },
);
