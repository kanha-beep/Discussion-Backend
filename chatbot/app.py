from openai import OpenAI
from dotenv import load_dotenv
from audio_to_text import convert_audio_to_text
from fastapi import FastAPI, Request, HTTPException, Body
from fastapi.responses import JSONResponse
import tempfile
import os

# from pydub import AudioSegment
load_dotenv()
from chat import ask_bot
from faster_whisper import WhisperModel
import tempfile

app = FastAPI()
model = WhisperModel("base")
import speech_recognition as sr


@app.get("/")
def read_root():
    return {"hello": "Discussion"}


@app.post("/chatbot")
def chat(message: str = Body(...)):
    reply = ask_bot(message)
    return {"response": reply}


@app.post("/audio")
async def receive_audio(request: Request):
    print("1. APP Receiving audio...")
    audio_bytes = await request.body()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio received")
    print("Received audio bytes:", len(audio_bytes))
    # Save as temporary file (browser usually sends webm)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(audio_bytes)
        temp_path = tmp.name
    print("Saved audio to temp file:", temp_path)
    try:
        text = convert_audio_to_text(temp_path)

        return JSONResponse({"text": text})

    finally:
        os.remove(temp_path)


@app.post("/audio/start")
def start_audio():
    open("received_audio.wav", "wb").close()
    return {"status": "cleared"}
