import { Room } from "../Models/Room.Model.js";
import { DiscussionForm } from "../Models/Discussion.Models.js";

const PYTHON_CHATBOT_URL = process.env.PYTHON_CHATBOT_URL || "http://127.0.0.1:8000";

export const createRoomForDiscussion = async ({
  discussionId,
  hostId,
  members = [],
  name = "Private Room",
  isPrivate = false,
  minParticipants = 2,
  maxParticipants = 4,
}) => {
  let room = await Room.findOne({ discussion: discussionId });
  if (room) return room;

  const normalizedMin = Math.min(Math.max(Number(minParticipants) || 2, 2), 4);
  const normalizedMax = Math.min(Math.max(Number(maxParticipants) || 4, normalizedMin), 4);

  room = await Room.create({
    name,
    host: hostId,
    members,
    isPrivate,
    minParticipants: normalizedMin,
    maxParticipants: normalizedMax,
    discussion: discussionId,
  });

  await DiscussionForm.findByIdAndUpdate(
    discussionId,
    { roomId: room._id },
    { new: true },
  );

  return room;
};

export const startPodcastForRoom = async ({ roomId, keywords = [] }) => {
  const topic = Array.isArray(keywords) ? keywords.join(", ") : String(keywords || "");

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
