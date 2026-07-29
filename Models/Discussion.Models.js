import mongoose from "mongoose";
import { discussionFormSchema } from "../Schemas/Discussion.Schema.js";

export const DiscussionForm = mongoose.model("DiscussionForm", discussionFormSchema)