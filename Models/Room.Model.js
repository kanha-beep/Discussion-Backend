import mongoose from "mongoose";
import { roomSchema } from "../Schemas/Room.Schema.js";

export const Room = mongoose.model("Room", roomSchema);