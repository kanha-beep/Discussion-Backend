import dotenv from "dotenv";
dotenv.config();
import express from "express"
import { emitBotVoiceToRoom, emitRoomMessageToRoom } from "./server.js"
import cors from "cors"
import cookieParser from "cookie-parser"
import { Room } from "./Models/Room.Model.js";
import { RoomMessage } from "./Models/RoomMessage.Model.js";
import { ensureBots } from "./bot/ensureBots.js";
import { verifyWebhookSignature } from "./utils/uploadSecurity.js";
import { appendRoomTranscriptEntry } from "./services/meetingCopilot.service.js";
const app = express();
app.set("trust proxy", 1)
// console.log("urls: ", process.env.FRONT_END)
const allowedOrigins = process.env.FRONT_END.split(",").map(u => u.trim())
// console.log("urls: ", allowedOrigins)
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(cookieParser());
app.use("/api/discussion/audio", express.raw({
    type: [
        "application/octet-stream",
        "audio/webm",
        "audio/ogg",
        "audio/wav",
        "audio/mpeg",
    ],
    limit: "12mb"
}));
app.use(express.json({
    limit: "2mb",
    verify: (req, _res, buffer) => {
        req.rawBody = Buffer.from(buffer);
    }
}));
app.use(express.urlencoded({ extended: true }));

import AuthRoutes from "./Routes/Auth.Routes.js";
app.use("/api/auth", AuthRoutes)
import DiscussionRoutes from "./Routes/Discussion.Routes.js";
app.use("/api/discussion", DiscussionRoutes);
import MailRoutes from "./Routes/Mail.Routes.js";
app.use("/api/mail", MailRoutes);
import TestRoutes from "./Routes/Test.Routes.js";
app.use("/api/tests", TestRoutes);
app.post("/bot-voice", async (req, res) => {
    const { roomId, bot, text, audio_url } = req.body
    try {
        const webhookSecret =
            process.env.BOT_WEBHOOK_SECRET || process.env.JWT_SECRET || "study_key";
        const signature = req.headers["x-bot-signature"];

        const isVerified = verifyWebhookSignature({
            rawBody: req.rawBody,
            providedSignature: signature,
            secret: webhookSecret,
        });

        if (!isVerified) {
            return res.status(401).json({ msg: "Invalid bot webhook signature" });
        }

        if (bot === "bot.summary") {
            console.log("1. Summary update received for room:", roomId);
            return res.sendStatus(200);
        }

        const room = roomId ? await Room.findById(roomId).select("_id") : null;
        const { botModerator, botAssistant } = await ensureBots();
        const botUser = bot === "bot.moderator" ? botModerator : botAssistant;
        const senderName =
            [botUser?.firstName, botUser?.lastName].filter(Boolean).join(" ").trim() ||
            botUser?.email?.split("@")[0] ||
            "AI Host";
        const createdAt = new Date();

        console.log("1. Bot voice APP:", bot, audio_url)
        console.log("2. EMIT → room:", roomId);

        if (room?._id && botUser?._id && text) {
            await RoomMessage.create({
                room: room._id,
                sender: botUser._id,
                text,
            });

            await appendRoomTranscriptEntry({
                roomId: room._id,
                entry: {
                    sender: botUser._id,
                    speakerName: senderName,
                    text,
                    source: "bot",
                    createdAt,
                    botOnly: false,
                    citations: [`bot:${bot}`],
                },
            });
        }

        emitRoomMessageToRoom(roomId, {
            roomId,
            bot,
            text,
            createdAt,
            sender: {
                id: botUser?._id,
                name: senderName,
                firstName: botUser?.firstName || "",
                lastName: botUser?.lastName || "",
                email: botUser?.email || "",
            },
        });

        emitBotVoiceToRoom(roomId, { bot, text, audio_url })
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
