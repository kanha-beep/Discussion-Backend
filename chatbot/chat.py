from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(
    
    api_key="AIzaSyD3bwJn_YOVGIKqCpyDSPrx9q8l-MMEbss",
    base_url="https://generativelanguage.googleapis.com/v1beta/",
)

SYSTEM_PROMPT = """You are an expert in discussion and should give answers related to discussions only. If someone says maths, only answers maths with the spiritual aspect of it. The answer must be in 3 lines only. Brief answer"""


def ask_bot(message: str):
    res = client.chat.completions.create(
        model="gemini-2.5-flash",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
    )
    return res.choices[0].message.content
