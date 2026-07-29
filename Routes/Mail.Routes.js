import express from "express";
import { WrapAsync } from "../Middlewares/WrapAsync.js";
import { VerifyAuth } from "../Middlewares/VerifyAuth.js";
import { isRole } from "../Middlewares/IsRole.js";
import {
  getMailbox,
  sendMail,
  markMailAsRead,
} from "../Controllers/Mail.Controller.js";

const router = express.Router();

router.get("/", VerifyAuth, isRole("user", "admin"), WrapAsync(getMailbox));
router.post("/send", VerifyAuth, isRole("user", "admin"), WrapAsync(sendMail));
router.patch(
  "/:mailId/read",
  VerifyAuth,
  isRole("user", "admin"),
  WrapAsync(markMailAsRead),
);

export default router;
