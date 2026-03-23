from openai import OpenAI
from conversation import get_conversation, get_pending_interrupt, get_topic

client = OpenAI()

BOT_DISPLAY = {
    "bot.moderator": "Krishna",
    "bot.assistant": "Ram",
}

BOT_ROLES = {
    "bot.moderator": """
You are Krishna, one of two hosts in a live podcast-style room discussion.

Rules:
- Speak only as Krishna.
- Never write Ram's dialogue for him.
- Stay anchored to the frontend topic unless the user adds a relevant angle.
- If the user interrupts, say their point is interesting, connect it to the topic, and continue the discussion with Ram.
- Keep the discussion flowing naturally like an engaging podcast.
- Challenge, expand, or sharpen the previous point.
- End with a hook, follow-up, or question for Ram.
- Speak in at most 2 short lines total.
- Keep replies concise, conversational, and lively.
- You are in a strict alternating turn system with Ram, so respond as Krishna and hand it back.
- Start every reply with "Krishna:".
""",
    "bot.assistant": """
You are Ram, one of two hosts in a live podcast-style room discussion.

Rules:
- Speak only as Ram.
- Never write Krishna's dialogue for him.
- Stay anchored to the frontend topic unless the user adds a relevant angle.
- If the user interrupts, say their point is interesting, connect it to the topic, and continue the discussion with Krishna.
- Keep the discussion flowing naturally like an engaging podcast.
- Challenge, expand, or sharpen the previous point.
- End with a hook, follow-up, or question for Krishna.
- Speak in at most 2 short lines total.
- Keep replies concise, conversational, and lively.
- You are in a strict alternating turn system with Krishna, so respond as Ram and hand it back.
- Start every reply with "Ram:".
""",
}


def clamp_two_lines(text: str):
    normalized = text.replace("\r\n", "\n").strip()
    raw_lines = [line.strip() for line in normalized.split("\n") if line.strip()]

    if not raw_lines:
        return text.strip()

    limited_lines = raw_lines[:2]
    return "\n".join(limited_lines).strip()


def bot_podcast(bot_type, room_id):
    conversation = get_conversation(room_id)
    topic = get_topic(room_id)
    pending_interrupt = get_pending_interrupt(room_id)
    role_prompt = BOT_ROLES[bot_type]
    speaker = BOT_DISPLAY[bot_type]
    other_speaker = BOT_DISPLAY[
        "bot.assistant" if bot_type == "bot.moderator" else "bot.moderator"
    ]

    last_other_bot = None
    for msg in reversed(conversation):
        if msg.get("bot") and msg["bot"] != bot_type:
            last_other_bot = msg["content"]
            break

    last_user = None
    for msg in reversed(conversation):
        if msg["role"] == "user":
            last_user = msg["content"]
            break

    messages = [
        {
            "role": "system",
            "content": role_prompt,
        },
        {
            "role": "system",
            "content": f"Primary topic from frontend keywords: {topic}. Keep returning to this topic.",
        },
        {
            "role": "system",
            "content": (
                f"This turn belongs only to {speaker}. "
                f"Do not write dialogue as {other_speaker}. "
                f"Reply in exactly 1 or 2 short lines and hand off to {other_speaker}."
            ),
        },
        {
            "role": "system",
            "content": "You are in an ongoing live discussion. Do not restart from scratch. Continue from the latest context.",
        },
        *conversation[-8:],
    ]

    if last_other_bot:
        messages.append(
            {
                "role": "system",
                "content": f"The other bot just said: {last_other_bot}. Respond to that and move the discussion forward.",
            }
        )

    if pending_interrupt and pending_interrupt.get("text"):
        messages.append(
            {
                "role": "system",
                "content": (
                    f"{pending_interrupt.get('user_name') or 'User'} just interrupted with this point: "
                    f"{pending_interrupt.get('text')}. "
                    "Open by acknowledging that it is an interesting point, briefly include that user context, "
                    "then continue the podcast on-topic with the other bot."
                ),
            }
        )
        messages.append(
            {
                "role": "system",
                "content": (
                    f"Your first line must clearly acknowledge {pending_interrupt.get('user_name') or 'the user'} "
                    "before you continue the discussion."
                ),
            }
        )
    elif last_user and conversation and conversation[-1]["role"] == "user":
        messages.append(
            {
                "role": "system",
                "content": (
                    f"The user just interrupted with this point: {last_user}. "
                    "Acknowledge that it is an interesting point, add that user context into the topic discussion, "
                    "then continue the podcast with the other bot."
                ),
            }
        )
    else:
        messages.append(
            {
                "role": "system",
                "content": "No new user interruption right now. Continue the bot-to-bot discussion naturally.",
            }
        )

    messages.append(
        {
            "role": "system",
            "content": "Never end the discussion abruptly. Always leave a clear handoff to the other bot.",
        }
    )

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    raw_reply = res.choices[0].message.content.strip()
    cleaned = raw_reply.replace(f"{other_speaker}:", "").strip()
    if cleaned.lower().startswith("i am ram") or cleaned.lower().startswith("i am krishna"):
        cleaned = cleaned.split(":", 1)[-1].strip() if ":" in cleaned else cleaned
        cleaned = cleaned.replace("I am Ram", "").replace("I am Krishna", "").strip(" ,.-")
    if cleaned.startswith(f"{speaker}:"):
        return clamp_two_lines(cleaned)
    return clamp_two_lines(f"{speaker}: {cleaned}")
