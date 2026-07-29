import express from "express"
import { WrapAsync } from "../Middlewares/WrapAsync.js"
import { getNews, createDiscussion, allDiscussion, singleDiscussion, openChat, allUsers, editDiscussion, allChats, deleteDiscussion, chatMessage, getMessages, createRoom, allRooms, singleRoom, joinRoom, leaveRoom, getRoomMessages, sendRoomMessage, chatAudio, friendshipOverview, searchUsers, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, toggleRoomPrivacy, sendFriendRequestByEmail, acceptFriendRequestByEmail, closeRoom, submitRoomFeedback, searchDiscussionTranscript, getRoomSession, scheduleDiscussionRoom, createCollaborativeDocument, updateCollaborativeDocument, createKnowledgeThread, addRoomRecording, addCopilotActionItem, uploadRoomAsset, roomUpload } from "../Controllers/Discussion.Controller.js"
import { VerifyAuth } from "../Middlewares/VerifyAuth.js";
import { isRole } from "../Middlewares/IsRole.js"
// /api/discussion
const router = express.Router()
router.post("/audio", VerifyAuth, isRole("user", "admin"), WrapAsync(chatAudio))
router.get("/news", WrapAsync(getNews))
router.post("/new", WrapAsync(createDiscussion))
router.patch("/:discussionId/schedule", VerifyAuth, isRole("user", "admin"), WrapAsync(scheduleDiscussionRoom))
//all users of the platform
router.get("/all-users", VerifyAuth, WrapAsync(allUsers))
router.get("/", WrapAsync(allDiscussion))
router.patch("/:id/edit", VerifyAuth, isRole("user", "admin"), WrapAsync(editDiscussion))
router.delete("/:id", VerifyAuth, isRole("user", "admin"), WrapAsync(deleteDiscussion))
//chats

//all chats of all users
router.get("/chats", VerifyAuth, isRole("user", "admin"), WrapAsync(allChats))
router.get("/friendships", VerifyAuth, isRole("user", "admin"), WrapAsync(friendshipOverview))
router.get("/users/search", VerifyAuth, isRole("user", "admin"), WrapAsync(searchUsers))
router.post("/friend-request-by-email", VerifyAuth, isRole("user", "admin"), WrapAsync(sendFriendRequestByEmail))
router.post("/friend-request/:userId", VerifyAuth, isRole("user", "admin"), WrapAsync(sendFriendRequest))
router.post("/friend-request-by-email/accept", VerifyAuth, isRole("user", "admin"), WrapAsync(acceptFriendRequestByEmail))
router.post("/friend-request/:userId/accept", VerifyAuth, isRole("user", "admin"), WrapAsync(acceptFriendRequest))
router.post("/friend-request/:userId/reject", VerifyAuth, isRole("user", "admin"), WrapAsync(rejectFriendRequest))
//open a single chat
router.post("/chat/:userId", VerifyAuth, isRole("user", "admin"), WrapAsync(openChat));
//get messages
router.get("/chat/:chatId/messages", VerifyAuth, isRole("user", "admin"), WrapAsync(getMessages));
//done send message
router.post("/chat/:chatId/message", VerifyAuth, isRole("user", "admin"), WrapAsync(chatMessage));
// router.post("/chatbot", VerifyAuth, isRole("user", "admin"), WrapAsync(ChatBot))
// rooms
router.post("/room/new", VerifyAuth, isRole("user", "admin"), WrapAsync(createRoom))
// router.post("/:roomId/room", VerifyAuth, WrapAsync(createRoom))
router.get("/rooms", VerifyAuth, isRole("user", "admin"), WrapAsync(allRooms))
router.post("/:discussionId/feedback", VerifyAuth, isRole("user", "admin"), WrapAsync(submitRoomFeedback))
router.get("/room/:roomId/session", VerifyAuth, isRole("user", "admin"), WrapAsync(getRoomSession))
router.get("/room/:roomId", VerifyAuth, isRole("user", "admin"), WrapAsync(singleRoom))
router.patch("/room/:roomId/privacy", VerifyAuth, isRole("user", "admin"), WrapAsync(toggleRoomPrivacy))
router.post("/room/:roomId/close", VerifyAuth, isRole("user", "admin"), WrapAsync(closeRoom))
router.post("/room/:roomId/join", VerifyAuth, isRole("user", "admin"), WrapAsync(joinRoom))
router.post("/room/:roomId/leave", VerifyAuth, isRole("user", "admin"), WrapAsync(leaveRoom))
router.post("/room/:roomId/documents", VerifyAuth, isRole("user", "admin"), WrapAsync(createCollaborativeDocument))
router.patch("/room/:roomId/documents/:documentId", VerifyAuth, isRole("user", "admin"), WrapAsync(updateCollaborativeDocument))
router.post("/room/:roomId/knowledge-threads", VerifyAuth, isRole("user", "admin"), WrapAsync(createKnowledgeThread))
router.post("/room/:roomId/recordings", VerifyAuth, isRole("user", "admin"), WrapAsync(addRoomRecording))
router.post("/room/:roomId/action-items", VerifyAuth, isRole("user", "admin"), WrapAsync(addCopilotActionItem))
router.post("/room/:roomId/uploads", VerifyAuth, isRole("user", "admin"), roomUpload.single("file"), WrapAsync(uploadRoomAsset))
router.post("/:discussionId/search-transcript", VerifyAuth, isRole("user", "admin"), WrapAsync(searchDiscussionTranscript))
// room messages
router.get("/room/:roomId/messages", VerifyAuth, isRole("user", "admin"), WrapAsync(getRoomMessages))
router.post("/room/:roomId/message", VerifyAuth, isRole("user", "admin"), WrapAsync(sendRoomMessage))
router.get("/:id", VerifyAuth, WrapAsync(singleDiscussion))
export default router
