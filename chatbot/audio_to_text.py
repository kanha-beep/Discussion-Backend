import speech_recognition as sr
from faster_whisper import WhisperModel
# def convert_audio_to_text(file_path):
#     print("1. Converting audio to text...")
#     recognizer = sr.Recognizer()
#     print("2. Loading audio file...")
#     with sr.AudioFile(file_path) as source:
#         audio = recognizer.record(source)
#         print("3. Recognizing speech...")
#     try:
#         print("4. Recognized text:")
#         return recognizer.recognize_google(audio)
#     except:
#         return ""
    

# Load model once globally (IMPORTANT)
model = WhisperModel(
    "small",          # tiny, base, small, medium
    device="cpu",     # change to "cuda" if GPU
    compute_type="int8"
)

def convert_audio_to_text(file_path):
    print("1. Converting audio to text using Whisper...")

    try:
        segments, info = model.transcribe(file_path)

        text = ""
        for segment in segments:
            text += segment.text

        print("2. Detected language:", info.language)
        print("3. Recognized text:", text.strip())

        return text.strip()

    except Exception as e:
        print("Whisper error:", e)
        return ""