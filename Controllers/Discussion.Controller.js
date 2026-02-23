import { User } from "../Models/User.Models.js"
import { ExpressError } from "../Middlewares/ExpressError.js"
import { DiscussionForm } from "../Models/Discussion.Models.js"
import { io } from "../server.js";
import { Chat } from "../Models/Chat.Model.js"
import { Message } from "../Models/Message.Schema.js"
import { Room } from "../Models/Room.Model.js";
import { RoomMessage } from "../Models/RoomMessage.Model.js";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
export const getNews = async (req, res) => {
    try {
        console.log("STARTED")
        const resp = await axios.get(
            "https://feeds.feedburner.com/ndtvnews-top-stories",
            {
                responseType: "text",
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            }
        );
        if (resp.status !== 200) {
            console.log("Error fetching news: ", resp.status, resp.statusText)
            return res.status(500).json({ msg: "Error fetching news" })
        }
        // console.log("news response: ", resp)
        const parser = new XMLParser();
        const jsonData = parser.parse(resp.data);
        const items = jsonData?.rss?.channel?.item || [];
        // console.log("news items: ", items)
        res.json(items);
    } catch (err) {
        console.log("Error in getNews: ", err.message)
        res.status(500).json({ msg: "Error fetching news" })
    }

}
export const createDiscussion = async (req, res, next) => {
    console.log("form starts")
    console.log("req discussion: ", req.body)
    const { email, keywords, remarks } = req.body;
    console.log("keywords: ", email, remarks)
    const user = await User.findOne({ email });
    console.log("user found: ", user)
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
    const discussions = await DiscussionForm.find({ keywords: { $regex: new RegExp(search, "i") } }).sort({ createdAt: sort }).populate("roomId");
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
    console.log("got all users of the software in homepage")
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
export const chatAudio = async (req, res) => {
    // console.log("chat audio controller: ")
    if (!req.body || req.body.length === 0) {
        console.log("No audio received");
        return res.status(400).json({ msg: "No audio received" });
    }
    // console.log("Received audio of length: ", req.body.length)
    // console.log("Incoming Content-Type:", req.headers["content-type"]);
    // console.log("Is Buffer:", Buffer.isBuffer(req.body), "len:", req.body.length);
    // console.log("First 16 bytes:", req.body.slice(0, 16));
    try {
        const py = await fetch("http://localhost:8000/audio", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: req.body,
        });
        const data = await py.json();
        console.log("data received from python", data)
        res.status(200).json({ reply: data.text });
    } catch (err) {
        console.log("Error in chatAudio fetch: ", err.message)
        return res.status(500).json({ msg: "Error processing audio" })
    }

    // const data = await py.json();
    // console.log("got audio in node: " + data?.reply)
    // console.log("data sending js")

}
/* create room */
export const createRoom = async (req, res) => {
    const discussionId = req.body.discussionId;
    console.log("getting name of room: ", req.body)
    let room = await Room.findById(discussionId);
    if (room) {
        console.log("room already exists:", room._id, "room: ", room);
        return res.status(200).json(room);
    }
    room = await Room.create({
        name: req.body.name,
        host: req.user._id,
        members: [req.user._id],
        discussion: discussionId,
        isPrivate: true,
    });
    await DiscussionForm.findByIdAndUpdate(
        discussionId,
        { roomId: room._id },
        { new: true }
    );
    console.log("room created: ", room)
    res.status(201).json(room);
};

/* all rooms user is part of */
export const allRooms = async (req, res) => {
    console.log("all rooms: ", req.user._id)
    const rooms = await Room.find({
        members: { $in: [req.user._id] }
    });
    res.json(rooms);
};

/* single room */
export const singleRoom = async (req, res) => {
    console.log("finding single room:", req.params)
    const room = await Room.findById(req.params.roomId)
        .populate("members", "name email");
    if (!room) throw new Error("Room not found");
    if (!room.members.some(id => id.toString() === req.user._id.toString())) throw new Error("Not authorized");

    res.json(room);
};

/* join room */
export const joinRoom = async (req, res) => {
    console.log("joining single room: ", req.params)
    const room = await Room.findById(req.params.roomId);
    if (!room) throw new Error("Room not found");

    if (!room.members.some(id => id.toString() === req.user._id.toString())) {
        room.members.push(req.user._id);
        await room.save();
    }


    res.json({ joined: true });
};

/* leave room */
export const leaveRoom = async (req, res) => {
    console.log("leaving room: ", req.params)
    const room = await Room.findById(req.params.roomId);

    if (room.host.toString() === req.user._id.toString()) {
        throw new Error("Host cannot leave room");
    }

    await Room.findByIdAndUpdate(
        req.params.roomId,
        { $pull: { members: req.user._id } }
    );

    res.json({ left: true });
};
/* get room messages */
export const getRoomMessages = async (req, res) => {
    console.log("get room mesg: ", req.params.roomId)
    const messages = await RoomMessage.find({
        room: req.params.roomId,
    }).populate("sender", "name");

    res.json(messages);
};

/* send room message */
export const sendRoomMessage = async (req, res) => {
    const message = await RoomMessage.create({
        room: req.params.roomId,
        sender: req.user._id,
        text: req.body.text,
    });

    res.status(201).json(message);
};
