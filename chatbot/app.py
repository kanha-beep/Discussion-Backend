from audio_to_text import convert_audio_to_text
from fastapi import FastAPI, Request, Body
from fastapi.staticfiles import StaticFiles
import tempfile
import os
import socketio
from run_two_bots import run_two_bots
import asyncio
from summary import summary
from send_to_frontend import send_to_frontend
from brief import brief
from chat import ask_bot
from conversation import (
    append_message,
    clear_pending_interrupt,
    get_conversation,
    get_topic,
    reset_room_state,
    set_pending_interrupt,
    set_last_speaker,
    set_topic,
)

socket = socketio.AsyncServer(cors_allowed_origins="*", async_mode="asgi")
app = FastAPI()
app.mount("/ws", socketio.ASGIApp(socket))

os.makedirs("audio", exist_ok=True)
app.mount("/audio", StaticFiles(directory="audio"), name="audio")


@app.get("/")
def read_root():
    return {"hello": "Discussion"}


bot_tasks = {}


def normalize_topic(raw_topic):
    if not raw_topic:
        return ""

    cleaned = str(raw_topic).strip()
    cleaned = cleaned.strip("[]")
    cleaned = cleaned.replace("'", "").replace('"', "")
    parts = [part.strip() for part in cleaned.split(",") if part.strip()]
    return ", ".join(parts)


@app.post("/audio")
async def receive_audio(request: Request):
    room_id = request.headers.get("x-room-id") or "default"
    raw_topic = request.headers.get("x-topic")
    topic = normalize_topic(raw_topic)

    if topic and topic != get_topic(room_id):
        reset_room_state(room_id)
        set_topic(room_id, topic)
        append_message(
            room_id,
            {
                "role": "system",
                "content": f"Podcast topic from frontend keywords: {topic}. Discuss this topic together like co-hosts.",
            },
        )

    current_task = bot_tasks.get(room_id)
    if topic and (not current_task or current_task.done()):
        print("3. Starting two-bot discussion for room:", room_id, "topic:", topic)
        bot_tasks[room_id] = asyncio.create_task(run_two_bots(room_id))
        await asyncio.sleep(0.6)

    audio_bytes = await request.body()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
      tmp.write(audio_bytes)
      temp_path = tmp.name

    text = convert_audio_to_text(temp_path)
    print("12. User audio to text:", text)

    try:
        os.unlink(temp_path)
    except OSError:
        pass

    if not text or not text.strip():
        conversation = get_conversation(room_id)
        summary_done = summary(conversation)
        brief_points = await brief(summary_done)
        return {"text": summary_done, "brief": brief_points}

    if "assist you today" in text.lower():
        return {"text": ""}

    conversation = get_conversation(room_id)
    if not conversation or conversation[-1].get("content") != text:
        append_message(room_id, {"role": "user", "content": text})

    set_last_speaker(room_id, "user")

    current_task = bot_tasks.get(room_id)
    if current_task and not current_task.done():
        current_task.cancel()
        try:
            await current_task
        except asyncio.CancelledError:
            pass

    await asyncio.sleep(0.2)
    bot_tasks[room_id] = asyncio.create_task(run_two_bots(room_id))

    conversation = get_conversation(room_id)
    summary_done = summary(conversation)
    brief_points = await brief(summary_done)
    print("26. Ready brief:", brief_points)

    await send_to_frontend(room_id, "bot.summary", summary_done, "")
    return {"text": summary_done, "brief": brief_points}


@app.post("/podcast/interrupt")
async def interrupt_podcast(payload: dict = Body(...)):
    room_id = payload.get("room_id") or "default"
    text = (payload.get("text") or "").strip()
    topic = normalize_topic(payload.get("topic"))
    user_name = (payload.get("user_name") or "User").strip() or "User"

    if topic and topic != get_topic(room_id):
        reset_room_state(room_id)
        set_topic(room_id, topic)
        append_message(
            room_id,
            {
                "role": "system",
                "content": f"Podcast topic from frontend keywords: {topic}. Discuss this topic together like co-hosts.",
            },
        )

    if not text:
        conversation = get_conversation(room_id)
        summary_done = summary(conversation)
        brief_points = await brief(summary_done)
        return {"text": summary_done, "brief": brief_points}

    conversation = get_conversation(room_id)
    if not conversation or conversation[-1].get("content") != text:
        append_message(room_id, {"role": "user", "content": text})
    set_pending_interrupt(
        room_id,
        {
            "text": text,
            "user_name": user_name,
        },
    )

    set_last_speaker(room_id, "user")

    current_task = bot_tasks.get(room_id)
    if current_task and not current_task.done():
        current_task.cancel()
        try:
            await current_task
        except asyncio.CancelledError:
            pass

    await asyncio.sleep(0.2)
    bot_tasks[room_id] = asyncio.create_task(run_two_bots(room_id))

    summary_done = summary(get_conversation(room_id))
    brief_points = await brief(summary_done)
    await send_to_frontend(room_id, "bot.summary", summary_done, "")
    return {"text": summary_done, "brief": brief_points}


@app.post("/podcast/start")
async def start_podcast(payload: dict = Body(...)):
    room_id = payload.get("room_id") or "default"
    topic = normalize_topic(payload.get("topic"))

    if topic and topic != get_topic(room_id):
        reset_room_state(room_id)
        set_topic(room_id, topic)
        append_message(
            room_id,
            {
                "role": "system",
                "content": f"Podcast topic from frontend keywords: {topic}. Discuss this topic together like co-hosts.",
            },
        )

    current_task = bot_tasks.get(room_id)
    if not current_task or current_task.done():
        bot_tasks[room_id] = asyncio.create_task(run_two_bots(room_id))

    summary_done = summary(get_conversation(room_id))
    brief_points = await brief(summary_done)
    await send_to_frontend(room_id, "bot.summary", summary_done, "")
    return {
        "started": True,
        "room_id": room_id,
        "text": summary_done,
        "brief": brief_points,
    }


@app.post("/podcast/stop")
async def stop_podcast(payload: dict = Body(...)):
    room_id = payload.get("room_id") or "default"
    current_task = bot_tasks.get(room_id)

    if current_task and not current_task.done():
        current_task.cancel()
        try:
            await current_task
        except asyncio.CancelledError:
            pass

    bot_tasks.pop(room_id, None)
    clear_pending_interrupt(room_id)
    return {"stopped": True, "room_id": room_id}


@app.post("/audio/start")
def start_audio():
    open("received_audio.wav", "wb").close()
    return {"status": "cleared"}


@app.post("/chatbot")
def chat(message: str = Body(...)):
    reply = ask_bot(message)
    return {"response": reply}
