import { User } from "../Models/User.Models.js";

export const ensureBots = async () => {
    console.log("1. Ensuring bots exist in the system...");
    const botSpecs = [
        { email: "bot.moderator@system.ai", name: "Moderator Bot" },
        { email: "bot.assistant@system.ai", name: "Assistant Bot" },
    ];
    console.log("2. Bot specifications:", botSpecs);
    const bots = [];

    for (const spec of botSpecs) {
        let bot = await User.findOne({ email: spec.email });
        console.log("3. Start bot")
        if (!bot) {
            bot = await User.create({
                email: spec.email,
                name: spec.name,
            });
        }
        console.log(`4. Bot found or created: ${bot.email} (ID: ${bot._id})`);
        bots.push(bot);
    }
    console.log("5. All bots ensured:", bots.map(b => b.email));
    return {
        botModerator: bots[0],
        botAssistant: bots[1],
    };
};