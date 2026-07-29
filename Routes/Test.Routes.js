import express from "express";
import { WrapAsync } from "../Middlewares/WrapAsync.js";
import { VerifyAuth } from "../Middlewares/VerifyAuth.js";
import { isRole } from "../Middlewares/IsRole.js";
import {
  createGeneratedTest,
  getSubmissionById,
  getTestById,
  listSubmissions,
  listTests,
  submitTest,
} from "../Controllers/Test.Controller.js";

const router = express.Router();

router.use(VerifyAuth, isRole("user", "admin"));
router.get("/", WrapAsync(listTests));
router.post("/generate", WrapAsync(createGeneratedTest));
router.get("/submissions", WrapAsync(listSubmissions));
router.get("/submissions/:id", WrapAsync(getSubmissionById));
router.get("/:id", WrapAsync(getTestById));
router.post("/:id/submissions", WrapAsync(submitTest));

export default router;
