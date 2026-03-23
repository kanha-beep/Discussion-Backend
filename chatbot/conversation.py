room_states = {}


def get_room_state(room_id: str):
    room_key = room_id or "default"
    if room_key not in room_states:
        room_states[room_key] = {
            "conversation": [],
            "topic": "",
            "last_speaker": None,
            "next_bot": "bot.moderator",
            "pending_interrupt": None,
        }
    return room_states[room_key]


def get_conversation(room_id: str):
    return get_room_state(room_id)["conversation"]


def get_topic(room_id: str):
    return get_room_state(room_id)["topic"]


def set_topic(room_id: str, topic: str):
    get_room_state(room_id)["topic"] = topic or ""


def get_last_speaker(room_id: str):
    return get_room_state(room_id)["last_speaker"]


def set_last_speaker(room_id: str, speaker: str | None):
    get_room_state(room_id)["last_speaker"] = speaker


def get_next_bot(room_id: str):
    return get_room_state(room_id)["next_bot"]


def set_next_bot(room_id: str, bot: str):
    get_room_state(room_id)["next_bot"] = bot


def get_pending_interrupt(room_id: str):
    return get_room_state(room_id)["pending_interrupt"]


def set_pending_interrupt(room_id: str, interrupt: dict | None):
    get_room_state(room_id)["pending_interrupt"] = interrupt


def clear_pending_interrupt(room_id: str):
    get_room_state(room_id)["pending_interrupt"] = None


def append_message(room_id: str, message: dict):
    get_conversation(room_id).append(message)


def reset_room_state(room_id: str):
    room_states[room_id or "default"] = {
        "conversation": [],
        "topic": "",
        "last_speaker": None,
        "next_bot": "bot.moderator",
        "pending_interrupt": None,
    }
