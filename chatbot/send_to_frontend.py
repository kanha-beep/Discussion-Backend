import requests
async def send_to_frontend(room_id,bot, text, audio_file):
    
    audio_url = f"http://127.0.0.1:8000/audio/{audio_file}"
    print(f"30. Send to frontend bot: {bot}, audio: {audio_file}")
    try:
        response = requests.post(
            "http://127.0.0.1:3000/bot-voice",
            json={
                "roomId": room_id,
                "bot": bot,
                "text": text,
                "audio_url": audio_url
            },
            timeout=10,
        )
        print("31. Frontend bridge status:", response.status_code)
    except Exception as error:
        print("31. Failed to send bot audio to frontend:", error)
