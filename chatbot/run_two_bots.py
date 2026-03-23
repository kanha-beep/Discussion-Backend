import asyncio
from bot_podcast import bot_podcast
from bot_speak import speak
from send_to_frontend import send_to_frontend
from conversation import (
    append_message,
    clear_pending_interrupt,
    get_conversation,
    get_next_bot,
    get_topic,
    set_last_speaker,
    set_next_bot,
)

bot_speaking = False
audio_lock = asyncio.Lock()

VOICE_BY_BOT = {
    "bot.moderator": "onyx",
    "bot.assistant": "shimmer",
}


async def run_two_bots(room_id):
    global bot_speaking

    try:
        while True:
            try:
                if bot_speaking:
                    await asyncio.sleep(0.4)
                    continue

                conversation = get_conversation(room_id)
                topic = get_topic(room_id)

                if not conversation and topic:
                    append_message(
                        room_id,
                        {
                            "role": "system",
                            "content": f"Podcast topic: {topic}. Start discussing this topic together.",
                        },
                    )

                bot = get_next_bot(room_id)

                bot_speaking = True

                try:
                    reply = await asyncio.to_thread(bot_podcast, bot, room_id)
                except Exception as e:
                    print("Error:", e)
                    await asyncio.sleep(1)
                    continue

                append_message(
                    room_id,
                    {"role": "assistant", "content": reply, "bot": bot},
                )
                clear_pending_interrupt(room_id)
                set_last_speaker(room_id, bot)
                set_next_bot(
                    room_id,
                    "bot.assistant" if bot == "bot.moderator" else "bot.moderator",
                )

                async with audio_lock:
                    audio_file = await asyncio.to_thread(
                        speak,
                        reply,
                        VOICE_BY_BOT[bot],
                        bot,
                    )
                    await send_to_frontend(room_id, bot, reply, audio_file)

                await asyncio.sleep(0.8)
            finally:
                bot_speaking = False
    except asyncio.CancelledError:
        print("Bot loop stopped")
        return
