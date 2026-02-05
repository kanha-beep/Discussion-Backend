import mongoose from "mongoose";
import { roomMessageSchema } from "../Schemas/RoomMessage.Schema.js";

export const RoomMessage = mongoose.model("RoomMessage", roomMessageSchema);