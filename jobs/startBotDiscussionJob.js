import cron from "node-cron";
import { io } from "../server.js";
import { createDiscussionService } from "../services/discussion.service.js";
import {startBotTalk} from "../bot/startBotTalk.js"
export const startBotDiscussionJob = () => {
  cron.schedule("*/30 * * * *", async () => {
    console.log("🤖 Bot discussion job started at", new Date().toISOString());
    try {
      const { discussion, room } = await createDiscussionService({
        email: "Kanha22.Gupta22@Coder.ep",
        keywords: ["auto"],
        remarks: "Auto created by system bot",
        includeBots: true,
      });
      startBotTalk({io, roomId: room._id.toString(), topic: discussion.keywords.join(", ")});
      console.log("✅ Bot created discussion (cron)", discussion._id, "with room", room._id);
    } catch (err) {
      console.error("❌ Bot cron failed:", err?.msg);
    }
  });
};