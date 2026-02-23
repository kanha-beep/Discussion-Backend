import pyaudio
import wave
import speech_recognition as sr
import requests

FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
CHUNK = 4096   # bigger chunk for better recognition

recognizer = sr.Recognizer()

p = pyaudio.PyAudio()

stream = p.open(
    format=FORMAT,
    channels=CHANNELS,
    rate=RATE,
    input=True,
    frames_per_buffer=CHUNK
)

print("Listening live... Press Ctrl+C to stop")

try:
    while True:

        # read mic chunk
        data = stream.read(CHUNK)

        # save temp file
        with wave.open("temp.wav", "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(p.get_sample_size(FORMAT))
            wf.setframerate(RATE)
            wf.writeframes(data)

        # convert to text
        with sr.AudioFile("temp.wav") as source:
            audio = recognizer.record(source)

        try:
            text = recognizer.recognize_google(audio)

            if text.strip() != "":
                # print("You said:", type(text))

                # send to FastAPI
                res = requests.post(
                    "http://localhost:8000/audio",
                    json={"message": text}
                )

                # print("Server reply:", res.json())

        except sr.UnknownValueError:
            pass

except KeyboardInterrupt:
    print("Stopped")

stream.stop_stream()
stream.close()
p.terminate()
