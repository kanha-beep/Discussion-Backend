import { User } from "../Models/User.Models.js";
import { ensureBots } from "../bot/ensureBots.js"
import { DiscussionForm } from "../Models/Discussion.Models.js";
import { ExpressError } from "../Middlewares/ExpressError.js";

export const createDiscussionService = async ({
    email = "Kanha22.Gupta22@Coder.ep",
    keywords,
    remarks,
    includeBots = true
}) => {
    console.log("Creating discussion with email:", email);
    const user = await User.findOne({ email });
    if (!user) throw new ExpressError(401, "User not found");
    const { botModerator, botAssistant } = await ensureBots();
    let users = [user._id];
    console.log("User ID added to discussion:", user._id);
    if (includeBots) {
        const { botModerator, botAssistant } = await ensureBots();
        users.push(botModerator._id, botAssistant._id);
    }
    const discussion = await DiscussionForm.create({
        email: user.email,
        owner: user._id,
        users: [user._id, botModerator._id, botAssistant._id],
        keywords,
        remarks,
    });
    console.log("Discussion created:", discussion);
    return discussion;
};