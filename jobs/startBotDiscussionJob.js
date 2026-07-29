import cron from "node-cron";
import { createDiscussionService } from "../services/discussion.service.js";
import { getDiscussionKeywordsFromNews } from "../services/newsTag.service.js";

export const startBotDiscussionJob = () => {
  cron.schedule("*/50 * * * * *", async () => {
    try {
      const keywords = await getDiscussionKeywordsFromNews(4);
      const { discussion, room } = await createDiscussionService({
        email: "Kanha22.Gupta22@Coder.ep",
        keywords,
        remarks: `Auto created by system bot from news tags: ${keywords.join(", ")}`,
        includeBots: true,
      });

      console.log(
        "bot cron created discussion",
        discussion._id,
        "with room",
        room._id,
        "using tags",
        keywords,
      );
    } catch (err) {
      console.error("bot cron failed:", err?.message || err?.msg);
    }
  });
};
