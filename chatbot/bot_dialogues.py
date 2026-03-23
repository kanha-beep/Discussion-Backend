BOT_DIALOGUES = {
    "meeting": [
        ("bot.moderator", "Welcome everyone. Meeting is starting."),
        ("bot.assistant", "Agenda is project updates."),
        ("bot.moderator", "Please share your progress.")
    ],
    "hello": [
        ("bot.moderator", "Hello everyone."),
        ("bot.assistant", "Hi moderator, good to see you."),
        ("bot.moderator", "Let’s begin.")
    ]
}

# def speak_bot_dialogues(topic="meeting"):
#     for bot, line in BOT_DIALOGUES[topic]:
#         audio_file = speak(line)
#         send_to_frontend(bot, line, audio_file)
#         time.sleep(1)