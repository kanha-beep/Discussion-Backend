// index.js / main.js

import { server } from "./server.js";
import { startBotDiscussionJob } from "./jobs/startBotDiscussionJob.js";
import { connectDB } from "./init/db.js";

const PORT = process.env.PORT || 3000;

// 1️⃣ Connect to DB first
connectDB()
  .then(() => {
    console.log("MongoDB connected");

    // 2️⃣ Start bot cron job AFTER DB is ready
    startBotDiscussionJob();

    // 3️⃣ Start server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });