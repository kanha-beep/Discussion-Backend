from openai import OpenAI
import uuid
import os
import time

client = OpenAI()

SPEAKER_PREFIX = {
    "bot.moderator": "Krishna",
    "bot.assistant": "Ram",
}


def strip_spoken_label(text: str, speaker: str | None):
    spoken = (text or "").strip()
    if not spoken:
        return spoken

    if speaker and spoken.startswith(f"{speaker}:"):
        spoken = spoken.split(":", 1)[1].strip()

    spoken = spoken.replace("Krishna:", "").replace("Ram:", "").strip()
    spoken = spoken.replace("I am Ram", "").replace("I am Krishna", "").strip()
    return spoken


def speak(text: str, voice="alloy", bot_name="bot.assistant"):
    print("9. Bot start speak")
    speaker = SPEAKER_PREFIX.get(bot_name)
    spoken_text = strip_spoken_label(text, speaker)

    if speaker:
        spoken_text = spoken_text or f"Let's continue the discussion."

    # Smooth the spoken delivery a bit by cleaning abrupt punctuation bursts.
    spoken_text = " ".join(spoken_text.split())
    spoken_text = spoken_text.replace("..", ".").replace("!!", "!").replace("??", "?")

    filename = f"{uuid.uuid4()}.mp3"
    outfile = os.path.join("audio", filename)

    with client.audio.speech.with_streaming_response.create(
        model="gpt-4o-mini-tts",
        voice=voice,
        input=spoken_text,
        instructions=(
            "Speak in a smooth, warm, conversational podcast style. "
            "Use natural pauses, calm pacing, and avoid sounding rushed or overly dramatic. "
            f"You are {speaker or 'a podcast host'}. "
            "Do not announce your own name unless the text explicitly requires it."
        ),
    ) as response:
        response.stream_to_file(outfile)

    time.sleep(2)
    print("10. Bots spoke:", filename, "voice:", voice, "bot:", bot_name)
    return filename
