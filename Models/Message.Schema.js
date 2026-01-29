import mongoose from "mongoose";
import { MessageSchema } from "../Schemas/Message.Schema.js";

export const Message = mongoose.model("Message", MessageSchema);