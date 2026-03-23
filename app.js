import dotenv from "dotenv";
dotenv.config();
import express from "express"
import { io } from "./server.js"
import cors from "cors"
import cookieParser from "cookie-parser"
const app = express();
app.set("trust proxy", 1)
// console.log("urls: ", process.env.FRONT_END)
const allowedOrigins = process.env.FRONT_END.split(",").map(u => u.trim())
// console.log("urls: ", allowedOrigins)
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.raw({
    type: "application/octet-stream",
    limit: "50mb"
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import AuthRoutes from "./Routes/Auth.Routes.js";
app.use("/api/auth", AuthRoutes)
import DiscussionRoutes from "./Routes/Discussion.Routes.js";
app.use("/api/discussion", DiscussionRoutes);
import MailRoutes from "./Routes/Mail.Routes.js";
app.use("/api/mail", MailRoutes);
app.post("/bot-voice", (req, res) => {
    const { roomId, bot, text, audio_url } = req.body
    //   console.log("got audio: ", req.body)
    try {
        console.log("1. Bot voice APP:", bot, audio_url)
        console.log("2. EMIT → room:", roomId);
        io.to(roomId).emit("bot-voice", { bot, text, audio_url })
        console.log("3. Socket emitted")
        res.sendStatus(200)
    } catch (e) {
        console.error("BOT VOICE ERROR:", e);
        res.sendStatus(500);
    }

})
app.use((error, req, res, next) => {
    const { status = 500, msg = "Something went wrong" } = error
    res.status(status).json({ msg })
})


export default app;
