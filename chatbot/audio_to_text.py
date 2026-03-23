from dotenv import load_dotenv
load_dotenv()

import os
from openai import OpenAI

client = OpenAI()

BOT_SELF_SPEECH_MARKERS = [
    "ram:",
    "krishna:",
    "krishna moderator",
    "ram assistant",
    "i am ram",
    "i am krishna",
]

def convert_audio_to_text(file_path):
    try:
        with open(file_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="gpt-4o-transcribe",
                file=audio_file,
                prompt="The speaker uses Hindi and English only. Output in Devanagari or English letters.",
                temperature=0
            )
        text = transcript.text.strip()
        # clean common speech fillers
        text = (
            text.replace(" uh ", " ")
                .replace(" um ", " ")
                .replace(" hmm ", " ")
                .strip()
        )
        if "speaker uses hindi and english" in text.lower():
            return ""
        lowered = text.lower()
        if any(marker in lowered for marker in BOT_SELF_SPEECH_MARKERS):
            print("Ignoring transcript because it sounds like bot playback:", text)
            return ""
        return text

    except Exception as e:
        print("OpenAI STT error:", e)
        return ""
