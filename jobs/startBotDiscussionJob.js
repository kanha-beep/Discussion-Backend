import cron from "node-cron";
import { createDiscussionService } from "../services/discussion.service.js";

export const startBotDiscussionJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    console.log("🤖 Bot discussion job started at", new Date().toISOString());
    try {
      await createDiscussionService({
        email: "Kanha22.Gupta22@Coder.ep",
        keywords: ["auto"],
        remarks: "Auto created by system bot",
        includeBots: true,
      });

      console.log("✅ Bot created discussion (cron)");
    } catch (err) {
      console.error("❌ Bot cron failed:", err?.msg);
    }
  });
};