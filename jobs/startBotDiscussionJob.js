import cron from "node-cron";
import { createDiscussionService } from "../services/discussion.service.js";
export const startBotDiscussionJob = () => {
  cron.schedule("*/50 * * * * *", async () => {
    console.log("🤖 Bot discussion job started at", new Date().toISOString());
    try {
      const { discussion, room } = await createDiscussionService({
        email: "Kanha22.Gupta22@Coder.ep",
        keywords: ["auto"],
        remarks: "Auto created by system bot",
        includeBots: true,
      });
      console.log("✅ Bot created discussion (cron)", discussion._id, "with room", room._id);
    } catch (err) {
      console.error("❌ Bot cron failed:", err?.msg);
    }
  });
};
