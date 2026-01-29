import mongoose from "mongoose";
import { ChatSchema } from "../Schemas/Chat.Schema.js";

export const Chat = mongoose.model("Chat", ChatSchema);