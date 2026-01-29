import express from "express"
import { WrapAsync } from "../Middlewares/WrapAsync.js"
import { createDiscussion, allDiscussion, singleDiscussion,openChat, allUsers,editDiscussion,allChats,deleteDiscussion, chatMessage, getMessages, ChatBot } from "../Controllers/Discussion.Controller.js"
import { VerifyAuth } from "../Middlewares/VerifyAuth.js";
// /api/discussion
const router = express.Router()
router.post("/new", WrapAsync(createDiscussion))
//all users of the platform
router.get("/all-users", VerifyAuth, WrapAsync(allUsers))
router.get("/", WrapAsync(allDiscussion))
router.get("/:id", VerifyAuth, WrapAsync(singleDiscussion))
router.patch("/:id/edit", VerifyAuth, WrapAsync(editDiscussion))
router.delete("/:id", VerifyAuth, WrapAsync(deleteDiscussion))
//chats
//all chats of all users
router.get("/chats", VerifyAuth, allChats)
//open a single chat
router.post("/chat/:userId", VerifyAuth, openChat);
//get messages
router.get("/chat/:chatId/messages", VerifyAuth, getMessages);
//done send message
router.post("/chat/:chatId/message", VerifyAuth, chatMessage);
router.post("/chatbot", ChatBot)
export default router