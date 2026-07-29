import { Room } from "../Models/Room.Model.js";
import { DiscussionForm } from "../Models/Discussion.Models.js";

const PYTHON_CHATBOT_URL = process.env.PYTHON_CHATBOT_URL || "http://127.0.0.1:8000";

export const createRoomForDiscussion = async ({
  discussionId,
  hostId,
  members = [],
  name = "Private Room",
  scheduledFor = null,
  isPrivate = false,
  minParticipants = 3,
  maxParticipants = 4,
}) => {
  let room = await Room.findOne({ discussion: discussionId });
  if (room) return room;

  const uniqueMembers = [...new Set(members.map((member) => String(member)))];
  const normalizedMin = Math.min(Math.max(Number(minParticipants) || 3, 3), 6);
  const normalizedMax = Math.min(
    Math.max(Number(maxParticipants) || Math.max(4, uniqueMembers.length), normalizedMin, uniqueMembers.length),
    6,
  );

  room = await Room.create({
    name,
    host: hostId,
    members: uniqueMembers,
    isPrivate,
    status: scheduledFor && new Date(scheduledFor) > new Date() ? "scheduled" : "live",
    scheduledFor: scheduledFor || null,
    startedAt: scheduledFor && new Date(scheduledFor) > new Date() ? null : new Date(),
    minParticipants: normalizedMin,
    maxParticipants: normalizedMax,
    discussion: discussionId,
    collaborativeDocuments: [
      {
        title: "Meeting Notes",
        content: "",
        updatedBy: hostId,
      },
    ],
  });

  await DiscussionForm.findByIdAndUpdate(
    discussionId,
    { roomId: room._id },
    { new: true },
  );

  return room;
};

export const startPodcastForRoom = async ({ roomId, keywords = [] }) => {
  const topic = Array.isArray(keywords) ? keywords : String(keywords || "");

  try {
    const room = await Room.findById(roomId).select("discussion");
    if (!room?.discussion) return;

    const response = await fetch(`${PYTHON_CHATBOT_URL}/podcast/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room_id: String(roomId),
        topic,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Podcast start failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    if (data?.brief) {
      await DiscussionForm.findByIdAndUpdate(
        room.discussion,
        { summary: data.brief },
        { new: true },
      );
    }
  } catch (error) {
    console.log("error starting podcast for room:", error?.message);
  }
};
