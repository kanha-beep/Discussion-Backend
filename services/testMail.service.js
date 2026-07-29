import { ensureBots } from "../bot/ensureBots.js";
import { Mail } from "../Models/Mail.Model.js";

export async function sendTestSummaryMail({ user, test, submission }) {
  if (!user?._id || !user?.email || !test?._id || !submission?._id) {
    return null;
  }

  const { botAssistant } = await ensureBots();
  const percentage = test.totalMarks
    ? Math.round((submission.score / test.totalMarks) * 100)
    : 0;

  return Mail.create({
    sender: botAssistant._id,
    recipient: user._id,
    senderEmail: botAssistant.email,
    recipientEmail: user.email,
    subject: `Test Result: ${test.title}`,
    body: [
      `Hello ${user.firstName || user.email?.split("@")[0] || "User"},`,
      "",
      `Your test "${test.title}" has been evaluated.`,
      `Score: ${submission.score}/${test.totalMarks}`,
      `Percentage: ${percentage}%`,
      `Correct: ${submission.summary.correct}`,
      `Incorrect: ${submission.summary.incorrect}`,
      `Skipped: ${submission.summary.skipped}`,
      `Review: ${submission.summary.review}`,
      "",
      "Open your profile Tests section to see the full attempt history and detailed review.",
    ].join("\n"),
    metadata: {
      kind: "test-result",
      noteSummary: `Score ${submission.score}/${test.totalMarks}`,
    },
  });
}
