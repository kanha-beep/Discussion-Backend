from conversation import get_conversation


def build_context(room_id):
    conversation = get_conversation(room_id)
    history = []

    for msg in conversation:
        if msg["role"] == "user":
            history.append(msg)

    if conversation and conversation[-1]["role"] == "assistant":
        history.append(conversation[-1])

    return history
