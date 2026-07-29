import { Room } from "../Models/Room.Model.js";

const formatCitation = (entry, index) => {
  const createdAt = entry?.createdAt ? new Date(entry.createdAt) : null;
  const stamp = createdAt
    ? createdAt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : `line-${index + 1}`;

  return `[${stamp}] ${entry?.speakerName || "Participant"}`;
};

const normalizeText = (value = "") =>
  String(value)
    .replace(/\s+/g, " ")
    .trim();

const pickSummaryLines = (entries = []) =>
  entries
    .filter((entry) => entry?.text && !entry?.botOnly)
    .slice(-5)
    .map((entry, index, list) => ({
      text: normalizeText(entry.text),
      citation: formatCitation(entry, entries.length - list.length + index),
    }));

const extractUnresolvedQuestions = (entries = []) => {
  const questionEntries = entries.filter((entry) =>
    normalizeText(entry.text).endsWith("?"),
  );

  return questionEntries.slice(-4).map((entry, index) => ({
    question: normalizeText(entry.text),
    askedBy: entry.speakerName || "Participant",
    citation: formatCitation(entry, index),
  }));
};

const extractActionItems = (entries = []) => {
  const triggers = ["follow up", "next step", "action item", "todo", "will ", "should "];

  return entries
    .filter((entry) => {
      const text = normalizeText(entry.text).toLowerCase();
      return triggers.some((trigger) => text.includes(trigger));
    })
    .slice(-5)
    .map((entry, index) => ({
      title: normalizeText(entry.text).slice(0, 120),
      ownerLabel: entry.speakerName || "Unassigned",
      status: "open",
      citation: formatCitation(entry, index),
      createdAt: entry.createdAt || new Date(),
    }));
};

const buildMeetingBrief = ({ room, entries, summaryLines, actionItems, unresolvedQuestions }) => {
  const discussionTopic = room?.discussion?.keywords?.filter(Boolean)?.join(", ");
  const keyMoments = summaryLines
    .map((item) => `- ${item.text} ${item.citation}`)
    .join("\n");
  const taskLines = actionItems
    .map((item) => `- ${item.title} (${item.ownerLabel}) ${item.citation}`)
    .join("\n");
  const questionLines = unresolvedQuestions
    .map((item) => `- ${item.question} (${item.askedBy}) ${item.citation}`)
    .join("\n");

  return [
    `Topic: ${discussionTopic || room?.name || "Discussion room"}`,
    "",
    "Highlights:",
    keyMoments || "- No substantial highlights captured yet.",
    "",
    "Open questions:",
    questionLines || "- No unresolved questions right now.",
    "",
    "Follow-up tasks:",
    taskLines || "- No follow-up tasks captured yet.",
    "",
    `Transcript lines captured: ${entries.length}`,
  ].join("\n");
};

export const appendRoomTranscriptEntry = async ({ roomId, entry }) => {
  if (!roomId || !entry?.text) return null;

  const room = await Room.findById(roomId).populate("discussion", "keywords owner");
  if (!room) return null;

  room.transcriptEntries.push({
    speakerName: entry.speakerName || "Participant",
    sender: entry.sender || null,
    text: normalizeText(entry.text),
    source: entry.source || "chat",
    createdAt: entry.createdAt || new Date(),
    citations: entry.citations || [],
    botOnly: !!entry.botOnly,
  });

  const transcriptEntries = room.transcriptEntries.slice(-250);
  room.transcriptEntries = transcriptEntries;

  const summaryLines = pickSummaryLines(transcriptEntries);
  const unresolvedQuestions = extractUnresolvedQuestions(transcriptEntries);
  const actionItems = extractActionItems(transcriptEntries);

  room.copilot = {
    ...room.copilot,
    liveSummary: summaryLines.map((item) => `${item.text} ${item.citation}`).join("\n"),
    meetingBrief: buildMeetingBrief({
      room,
      entries: transcriptEntries,
      summaryLines,
      actionItems,
      unresolvedQuestions,
    }),
    unresolvedQuestions,
    actionItems,
    citations: summaryLines.map((item) => item.citation),
    updatedAt: new Date(),
  };

  await room.save();
  return room;
};
