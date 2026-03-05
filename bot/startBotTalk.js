// export const startBotTalk = async ({ io, roomId, topic }) => {
//   io.to(roomId.toString()).emit("room-message", {
//     sender: "botModerator",
//     text: `Welcome! Topic: ${topic}`,
//     createdAt: new Date(),
//   });
//   setTimeout(() => {
//     io.to(roomId.toString()).emit("room-message", {
//       sender: "botAssistant",
//       text: `Great. I’ll cover key points, then we’ll debate pros/cons.`,
//       createdAt: new Date(),
//     });
//   }, 2000);
// };

// bot/startBotTalk.js
import { ensureBots } from "./ensureBots.js";

export const startBotTalk = async ({ io, roomId, discussionId }) => {

  const { botModerator, botAssistant } = await ensureBots();

  const topic = "Auto discussion topic"; // you can fetch from discussion

  const conversation = [
    {
      sender: botModerator._id,
      text: `Welcome everyone! Today's topic is ${topic}.`
    },
    {
      sender: botAssistant._id,
      text: `Yes! Let's explore this topic step by step.`
    },
    {
      sender: botModerator._id,
      text: `First question: why is this topic important today?`
    },
    {
      sender: botAssistant._id,
      text: `Because it impacts technology, society, and the future.`
    }
  ];

  let delay = 0;

  for (const msg of conversation) {
    delay += 3000;

    setTimeout(() => {
      io.to(roomId).emit("room-message", {
        roomId,
        sender: msg.sender,
        text: msg.text,
        createdAt: new Date()
      });

      console.log("🤖 Bot message sent:", msg.text);

    }, delay);
  }

};