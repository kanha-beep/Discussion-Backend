import express from "express"
import { WrapAsync } from "../Middlewares/WrapAsync.js"
import { createDiscussion, allDiscussion, singleDiscussion, openChat, allUsers, editDiscussion, allChats, deleteDiscussion, chatMessage, getMessages, ChatBot, createRoom, allRooms, singleRoom, joinRoom, leaveRoom, getRoomMessages, sendRoomMessage } from "../Controllers/Discussion.Controller.js"
import { VerifyAuth } from "../Middlewares/VerifyAuth.js";
import { isRole } from "../Middlewares/IsRole.js"
// /api/discussion
const router = express.Router()
router.post("/new", WrapAsync(createDiscussion))
//all users of the platform
router.get("/all-users", VerifyAuth, isRole, WrapAsync(allUsers))
router.get("/", WrapAsync(allDiscussion))
router.get("/:id", VerifyAuth, isRole, WrapAsync(singleDiscussion))
router.patch("/:id/edit", VerifyAuth, isRole, WrapAsync(editDiscussion))
router.delete("/:id", VerifyAuth, isRole, WrapAsync(deleteDiscussion))
//chats
//all chats of all users
router.get("/chats", VerifyAuth, isRole, allChats)
//open a single chat
router.post("/chat/:userId", VerifyAuth, isRole, openChat);
//get messages
router.get("/chat/:chatId/messages", VerifyAuth, isRole, getMessages);
//done send message
router.post("/chat/:chatId/message", VerifyAuth, isRole, chatMessage);
router.post("/chatbot", isRole, ChatBot)
// rooms
router.post("/room/new", VerifyAuth, isRole, WrapAsync(createRoom))
// router.post("/:roomId/room", VerifyAuth, WrapAsync(createRoom))
router.get("/rooms", VerifyAuth, isRole, WrapAsync(allRooms))
router.get("/room/:roomId", VerifyAuth, isRole, WrapAsync(singleRoom))
router.post("/room/:roomId/join", VerifyAuth, isRole, WrapAsync(joinRoom))
router.post("/room/:roomId/leave", VerifyAuth, isRole, WrapAsync(leaveRoom))
// room messages
router.get("/room/:roomId/messages", VerifyAuth, isRole, WrapAsync(getRoomMessages))
router.post("/room/:roomId/message", VerifyAuth, isRole, WrapAsync(sendRoomMessage))
export default router