import { User } from "../Models/User.Models.js";
import { ensureBots } from "../bot/ensureBots.js"
import { DiscussionForm } from "../Models/Discussion.Models.js";
import { ExpressError } from "../Middlewares/ExpressError.js";
import { createRoomForDiscussion, startPodcastForRoom } from "./room.service.js";
export const createDiscussionService = async ({
    email = "Kanha22.Gupta22@Coder.ep",
    title = "",
    keywords,
    remarks,
    scheduledFor = null,
    includeBots = true
}) => {
    const user = await User.findOne({ email });
    if (!user) throw new ExpressError(401, "User not found");
    let users = [user._id];

    if (includeBots) {
        const { botModerator, botAssistant } = await ensureBots();
        users.push(botModerator._id, botAssistant._id);
    }

    const discussion = await DiscussionForm.create({
        email: user.email,
        title: String(title || "").trim(),
        owner: user._id,
        users: [...new Set(users.map((member) => String(member)))],
        keywords: Array.isArray(keywords) ? keywords : [],
        remarks,
        scheduledFor: scheduledFor || null,
    });

    const room = await createRoomForDiscussion({
        discussionId: discussion._id,
        hostId: user._id,
        members: discussion.users,
        name: String(title || "").trim() || `Room-${discussion._id}`,
        scheduledFor: discussion.scheduledFor,
    });

    discussion.roomId = room._id;
    await discussion.save();

    await startPodcastForRoom({
        roomId: room._id,
        keywords: discussion.keywords,
    });

    return {discussion, room};
};
