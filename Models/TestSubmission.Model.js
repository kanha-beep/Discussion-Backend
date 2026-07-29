import mongoose from "mongoose";
import { testSubmissionSchema } from "../Schemas/TestSubmission.Schema.js";

export const TestSubmission = mongoose.model("TestSubmission", testSubmissionSchema);
