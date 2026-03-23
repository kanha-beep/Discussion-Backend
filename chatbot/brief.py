from openai import OpenAI
client = OpenAI()
async def brief(summary_text):
    prompt = """
Convert the given summary into ONLY 4 crisp bullet points.

Rules:
- Max 4 points
- One line each
- No headings
- No numbering
- Keep it very short
"""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": summary_text}
        ],
        temperature=0.2
    )
    # print("25. Brief: ", response.choices[0].message.content)
    return response.choices[0].message.content