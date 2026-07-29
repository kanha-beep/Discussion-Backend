import mongoose from "mongoose";
import { testSchema } from "../Schemas/Test.Schema.js";

export const Test = mongoose.model("Test", testSchema);
