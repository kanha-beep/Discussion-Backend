from openai import OpenAI
client = OpenAI()
system_prompt = """
You are an expert conversation summarizer.

Output structure:
1. Topic in one line max.
2. Participants (who said what briefly)
3. Key Points (bullet points)
4. Flow of discussion (how it progressed)

Rules:
- Keep it concise
- No extra commentary
- Preserve meaning, remove noise
- Everything should be related to the topic and what user said only.
"""
def summary(conversation):
    # print("21. Summary start: ", conversation)
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(conversation)}
        ],
        temperature=0.3
    )
    # print("22. Summary done: ", response.choices[0].message.content)
    return response.choices[0].message.content