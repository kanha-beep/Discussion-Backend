import { User } from "../Models/User.Models.js";

export const ensureBots = async () => {
    console.log("1. Ensuring bots exist in the system...");
    const botSpecs = [
        {
            email: "bot.moderator@system.ai",
            firstName: "Krishna",
            lastName: "AI Host",
            profession: "Podcast Moderator",
        },
        {
            email: "bot.assistant@system.ai",
            firstName: "Ram",
            lastName: "AI Host",
            profession: "Podcast Co-host",
        },
    ];
    console.log("2. Bot specifications:", botSpecs);
    const bots = [];

    for (const spec of botSpecs) {
        let bot = await User.findOne({ email: spec.email });
        console.log("3. Start bot")
        if (!bot) {
            bot = await User.create({
                email: spec.email,
                firstName: spec.firstName,
                lastName: spec.lastName,
                profession: spec.profession,
            });
        } else {
            let shouldSave = false;

            if (bot.firstName !== spec.firstName) {
                bot.firstName = spec.firstName;
                shouldSave = true;
            }
            if (bot.lastName !== spec.lastName) {
                bot.lastName = spec.lastName;
                shouldSave = true;
            }
            if (bot.profession !== spec.profession) {
                bot.profession = spec.profession;
                shouldSave = true;
            }

            if (shouldSave) {
                await bot.save();
            }
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
