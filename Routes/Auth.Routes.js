import express from "express"
const router = express.Router()
import { Login, Register, Logout, currentUser, checkEmail } from "../Controllers/Auth.Controller.js"
import { WrapAsync } from "../Middlewares/WrapAsync.js";
import { VerifyAuth } from "../Middlewares/VerifyAuth.js";
// /api/auth
router.post("/check-email", WrapAsync(checkEmail))
router.post("/register", WrapAsync(Register))
router.post("/login", WrapAsync(Login))
router.get("/me", VerifyAuth, WrapAsync(currentUser))
router.post("/logout", VerifyAuth, WrapAsync(Logout))
export default router