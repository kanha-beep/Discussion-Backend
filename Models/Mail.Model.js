import mongoose from "mongoose";
import { mailSchema } from "../Schemas/Mail.Schema.js";

export const Mail = mongoose.model("Mail", mailSchema);
