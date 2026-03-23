import asyncio
from bot_dialogues import BOT_DIALOGUES
from bot_speak import speak
from send_to_frontend import send_to_frontend
async def speak_bot_dialogues(topic="meeting"):
    for bot, line in BOT_DIALOGUES[topic]:
        audio_file = speak(line)
        await send_to_frontend("69a947b41f611481bfe76e76",bot, line, audio_file)
        await asyncio.sleep(1)