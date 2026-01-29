import { User } from "../Models/User.Models.js"
import { ExpressError } from "../Middlewares/ExpressError.js"
import { DiscussionForm } from "../Models/Discussion.Models.js"
import { io } from "../server.js";
import { Chat } from "../Models/Chat.Model.js"
import { Message } from "../Models/Message.Schema.js"
export const createDiscussion = async (req, res, next) => {
    console.log("form starts")
    console.log("req discussion: ", req.body)
    const { email, keywords, remarks } = req.body;
    const user = await User.findOne({ email });
    if (!user) return next(new ExpressError(401, "User not found"))
    console.log("user: ", user)
    const discussion = await DiscussionForm.create({
        email: user.email,
        owner: user._id,
        users: [user._id],
        keywords,
        remarks,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    console.log("discussion: ", discussion)
    return res.status(201).json({ discussion });
}
export const allDiscussion = async (req, res, next) => {
    const { search } = req.query;
    const sort = parseInt(req.query.sort) || 1;
    console.log("order: ", req.query)
    const discussions = await DiscussionForm.find({ keywords: { $regex: new RegExp(search, "i") } }).sort({ createdAt: sort });
    // console.log("discussions: ", discussions)
    if (!discussions) return next(new ExpressError(401, "No discussions found"))
    return res.status(200).json({ discussions });
}
export const singleDiscussion = async (req, res, next) => {
    const { id } = req.params;
    console.log("single discussion starts")
    const userId = req?.user?._id;
    console.log("edit user: ", userId)
    const discussion = await DiscussionForm.findById(id);
    console.log("single discussions: ", discussion)
    if (!discussion) return next(new ExpressError(401, "No discussions found"))
    return res.status(200).json({ discussion });
}
export const editDiscussion = async (req, res, next) => {
    console.log("edit discussion starts: ", req.body)
    const { id } = req.params;
    const userId = req?.user?._id;
    const { keywords, remarks } = req.body
    console.log("update user: ", userId)
    const discussion = await DiscussionForm.findOneAndUpdate({ _id: id, owner: userId }, { keywords, remarks, updatedAt: new Date() }, { new: true });
    console.log("updated: ", discussion)
    if (!discussion) return next(new ExpressError(401, "No discussions found"))
    return res.status(200).json({ discussion });
}
export const deleteDiscussion = async (req, res, next) => {
    console.log("delete starts")
    const { id } = req.params;
    const discussion = await DiscussionForm.findByIdAndDelete(id);
    console.log("deleted: ", discussion)
    if (!discussion) return next(new ExpressError(401, "Discussion not found"))
    return res.status(200).json({ discussion });
}
export const allUsers = async (req, res, next) => {
    console.log("all users starts")
    const users = await User.find(
        { _id: { $ne: req.user._id } },
        "_id name email"
    );
    // console.log("users found: ", users)
    return res.status(200).json(users);
}

export const allChats = async (req, res, next) => {
    console.log("all chats controller")
    const userId = req?.user?._id;
    console.log("all chats for user: ", userId);
    const chats = await Chat.find({ participants: userId }).populate("participants", "name email");
    console.log("chats found: ", chats);
    res.json(chats);
}
//chat opened
export const openChat = async (req, res) => {
    console.log("open chat: ", req.params);
    const from = req.user._id;
    const to = req.params.userId;
    let chat = await Chat.findOne({
        participants: { $all: [from, to] },
    });
    if (!chat) chat = await Chat.create({ participants: [from, to] });
    res.json({ chatId: chat._id });
};

export const getMessages = async (req, res) => {
    console.log("GET ALL MESSAGES___")
    const chatId = req.params.chatId;
    const messages = await Message.find({ chatId }).populate("senderId", "name email").populate("receiverId", "name email").sort({ createdAt: 1 });
    // console.log("get messages: ", messages)
    res.json({ chatId, messages });
};

//done send message
export const chatMessage = async (req, res) => {
    const chatId = req.params.chatId;
    const from = req.user._id;
    const { message } = req.body;
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    const msgDoc = await Message.create({
        chatId,
        senderId: from,
        receiverId: chat.participants.find(
            id => String(id) !== String(from)
        ),
        text: message,
    });
    chat.lastMessage = message;
    await chat.save();
    const populatedMsg = await Message.findById(msgDoc._id)
        .populate("senderId", "email")
        .populate("receiverId", "email");
    io.to(chatId).emit("new-message", populatedMsg);
    console.log("message sent:", populatedMsg);
    res.json({ sent: true, message: populatedMsg });
    // io.to(chatId).emit("new-message", msgDoc);
    // console.log("message send: ", msgDoc)
    // res.json({ sent: true, message: msgDoc });
};


export const ChatBot = async (req, res) => {
    const py = await fetch("http://localhost:8000/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body.message),
    });
    const data = await py.json();
    console.log("got data in node: " + data?.response)
    res.json({ reply: data.response });
}