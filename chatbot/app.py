from fastapi import FastAPI, Body
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
from chat import ask_bot
app = FastAPI()

@app.get("/")
def read_root():
    return {"hello": "Discussion"}


@app.post("/chatbot")
def chat(message: str = Body(...)):
    reply = ask_bot(message)
    return {"response": reply}


# @app.post("/chatbot")
# def chat(message: str = Body(...)):
#     res = client.chat.completions.create(
#         model="gpt-4o-mini",
#         messages=[{"role": "user", "content": message}]
#     )
#     return {"response": res.choices[0].message.content}
