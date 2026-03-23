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
import { createDiscussionService } from "../services/discussion.service.js";
import { createRoomForDiscussion, startPodcastForRoom } from "../services/room.service.js";

const userPreview = (userDoc) => ({
    _id: userDoc._id,
    email: userDoc.email,
    firstName: userDoc.firstName || "",
    lastName: userDoc.lastName || "",
    profession: userDoc.profession || "",
    name: [userDoc.firstName, userDoc.lastName].filter(Boolean).join(" ").trim() || userDoc.email?.split("@")[0] || "User",
});

const buildRelationshipStatus = (currentUser, targetId) => {
    const target = String(targetId);
    if (String(currentUser._id) === target) return "self";
    if (currentUser.friends?.some((id) => String(id) === target)) return "friend";
    if (currentUser.friendRequestsSent?.some((id) => String(id) === target)) return "sent";
    if (currentUser.friendRequestsReceived?.some((id) => String(id) === target)) return "received";
    return "none";
};
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
    const { email, keywords, remarks, includeBots = true } = req.body;
    console.log("keywords: ", email, remarks)
    const user = await User.findOne({ email });
    console.log("user found: ", user)
    if (!user) return next(new ExpressError(401, "User not found"))
    console.log("user: ", user)
    const discussion = await createDiscussionService({
        email,
        keywords,
        remarks,
        includeBots: !!includeBots
    });
    // const discussion = await DiscussionForm.create({
    //     email: user.email,
    //     owner: user._id,
    //     users: [user._id],
    //     keywords,
    //     remarks,
    // });
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
    // console.log("single discussion starts")
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

export const friendshipOverview = async (req, res) => {
    const currentUser = await User.findById(req.user._id)
        .populate("friends", "firstName lastName profession email")
        .populate("friendRequestsSent", "firstName lastName profession email")
        .populate("friendRequestsReceived", "firstName lastName profession email");

    res.json({
        friends: currentUser.friends.map(userPreview),
        sentRequests: currentUser.friendRequestsSent.map(userPreview),
        receivedRequests: currentUser.friendRequestsReceived.map(userPreview),
    });
};

export const searchUsers = async (req, res) => {
    const query = (req.query.q || "").trim();
    const currentUser = await User.findById(req.user._id).select("friends friendRequestsSent friendRequestsReceived");

    if (!query) {
        return res.json({ users: [] });
    }

    const regex = new RegExp(query, "i");
    const users = await User.find({
        _id: { $ne: req.user._id },
        $or: [
            { firstName: regex },
            { lastName: regex },
            { profession: regex },
            { email: regex },
        ],
    })
        .select("firstName lastName profession email")
        .limit(20);

    res.json({
        users: users.map((user) => ({
            ...userPreview(user),
            relationshipStatus: buildRelationshipStatus(currentUser, user._id),
        })),
    });
};

export const sendFriendRequest = async (req, res, next) => {
    const fromId = String(req.user._id);
    const toId = String(req.params.userId);

    if (fromId === toId) {
        return next(new ExpressError(400, "You cannot send a request to yourself"));
    }

    const [fromUser, toUser] = await Promise.all([
        User.findById(fromId),
        User.findById(toId),
    ]);

    if (!toUser) {
        return next(new ExpressError(404, "User not found"));
    }

    if (fromUser.friends?.some((id) => String(id) === toId)) {
        return res.status(200).json({ message: "Already friends" });
    }

    if (fromUser.friendRequestsSent?.some((id) => String(id) === toId)) {
        return res.status(200).json({ message: "Request already sent" });
    }

    if (fromUser.friendRequestsReceived?.some((id) => String(id) === toId)) {
        fromUser.friendRequestsReceived = fromUser.friendRequestsReceived.filter((id) => String(id) !== toId);
        toUser.friendRequestsSent = toUser.friendRequestsSent.filter((id) => String(id) !== fromId);

        if (!fromUser.friends.some((id) => String(id) === toId)) {
            fromUser.friends.push(toUser._id);
        }
        if (!toUser.friends.some((id) => String(id) === fromId)) {
            toUser.friends.push(fromUser._id);
        }

        await Promise.all([fromUser.save(), toUser.save()]);

        io.to(`user:${toId}`).emit("friend-request:accepted", {
            user: userPreview(fromUser),
        });

        return res.status(200).json({
            message: "Friend request accepted",
            user: userPreview(toUser),
        });
    }

    fromUser.friendRequestsSent.push(toUser._id);
    toUser.friendRequestsReceived.push(fromUser._id);

    await Promise.all([fromUser.save(), toUser.save()]);

    io.to(`user:${toId}`).emit("friend-request:received", {
        user: userPreview(fromUser),
    });

    res.status(201).json({
        message: "Friend request sent",
        user: userPreview(toUser),
    });
};

export const sendFriendRequestByEmail = async (req, res, next) => {
    const targetEmail = String(req.body?.email || "").trim().toLowerCase();
    if (!targetEmail) {
        return next(new ExpressError(400, "Email is required"));
    }

    const targetUser = await User.findOne({ email: targetEmail });
    if (!targetUser) {
        return next(new ExpressError(404, "Recipient email not found"));
    }

    req.params.userId = String(targetUser._id);
    return sendFriendRequest(req, res, next);
};

export const acceptFriendRequest = async (req, res, next) => {
    const currentUserId = String(req.user._id);
    const requesterId = String(req.params.userId);

    const [currentUser, requester] = await Promise.all([
        User.findById(currentUserId),
        User.findById(requesterId),
    ]);

    if (!requester) {
        return next(new ExpressError(404, "User not found"));
    }

    if (!currentUser.friendRequestsReceived?.some((id) => String(id) === requesterId)) {
        return next(new ExpressError(400, "No pending request found"));
    }

    currentUser.friendRequestsReceived = currentUser.friendRequestsReceived.filter((id) => String(id) !== requesterId);
    requester.friendRequestsSent = requester.friendRequestsSent.filter((id) => String(id) !== currentUserId);

    if (!currentUser.friends.some((id) => String(id) === requesterId)) {
        currentUser.friends.push(requester._id);
    }
    if (!requester.friends.some((id) => String(id) === currentUserId)) {
        requester.friends.push(currentUser._id);
    }

    await Promise.all([currentUser.save(), requester.save()]);

    io.to(`user:${requesterId}`).emit("friend-request:accepted", {
        user: userPreview(currentUser),
    });

    res.status(200).json({
        message: "Friend request accepted",
        user: userPreview(requester),
    });
};

export const acceptFriendRequestByEmail = async (req, res, next) => {
    const targetEmail = String(req.body?.email || "").trim().toLowerCase();
    if (!targetEmail) {
        return next(new ExpressError(400, "Email is required"));
    }

    const targetUser = await User.findOne({ email: targetEmail });
    if (!targetUser) {
        return next(new ExpressError(404, "Requester email not found"));
    }

    req.params.userId = String(targetUser._id);
    return acceptFriendRequest(req, res, next);
};

export const rejectFriendRequest = async (req, res, next) => {
    const currentUserId = String(req.user._id);
    const requesterId = String(req.params.userId);

    const [currentUser, requester] = await Promise.all([
        User.findById(currentUserId),
        User.findById(requesterId),
    ]);

    if (!requester) {
        return next(new ExpressError(404, "User not found"));
    }

    currentUser.friendRequestsReceived = currentUser.friendRequestsReceived.filter((id) => String(id) !== requesterId);
    requester.friendRequestsSent = requester.friendRequestsSent.filter((id) => String(id) !== currentUserId);

    await Promise.all([currentUser.save(), requester.save()]);

    res.status(200).json({ message: "Friend request rejected" });
};
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
    const message = (req.body?.message || "").trim();
    if (!message) {
        return res.status(400).json({ msg: "Message is required" });
    }

    const py = await fetch("http://localhost:8000/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
    });

    if (!py.ok) {
        const errorText = await py.text();
        console.log("chatbot python error:", py.status, errorText);
        return res.status(502).json({ msg: "Chatbot service is unavailable" });
    }

    const data = await py.json();
    console.log("got data in node: " + data?.response)
    res.json({ reply: data?.response || "No response from chatbot" });
}
export const chatAudio = async (req, res) => {
    // console.log("chat audio controller: ")
    if (!req.body || req.body.length === 0) {
        // console.log("No audio received");
        return res.status(400).json({ msg: "No audio received" });
    }
    const roomId = req.headers["x-room-id"]
    const room = await Room.findById(roomId).populate("discussion")
    // console.log("room: ", room)
    const keywords = room?.discussion?.keywords || []
    console.log(keywords)
    try {
        // console.log("Forwarding audio to Python service...", req.headers["x-room-id"])
        const py = await fetch("http://localhost:8000/audio", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream", "x-room-id": roomId, "x-topic": keywords },
            body: req.body,
        });
        const data = await py.json();
        if (data?.brief && room?.discussion) {
            const discussionId = room.discussion?._id || room.discussion;
            await DiscussionForm.findByIdAndUpdate(
                discussionId,
                { summary: data.brief },
                { new: true }
            );
        }
        // ye sirf summary and brief vaaala data h
        // console.log("data received from python", data)
        res.status(200).json({
            reply: data.text,
            bot_reply: data.bot_reply,
            audio_url: data.audio_url,
            brief: data?.brief,
            discussionId: room?.discussion?._id || room?.discussion,
        })
    } catch (err) {
        console.log("Error in chatAudio fetch: ", err.message)
        return res.status(500).json({ msg: "Error processing audio" })
    }

}
/* create room */
export const createRoom = async (req, res) => {
    const discussionId = req.body.discussionId;
    console.log("getting name of room: ", req.body)
    const discussion = await DiscussionForm.findById(discussionId);
    if (!discussion) {
        return res.status(404).json({ msg: "Discussion not found" });
    }

    let room = await Room.findOne({ discussion: discussionId });
    if (room) {
        console.log("room already exists:", room._id, "room: ", room);
        return res.status(200).json(room);
    }
    room = await createRoomForDiscussion({
        discussionId,
        hostId: req.user._id,
        members: [req.user._id],
        name: req.body.name || "Room",
        isPrivate: false,
    });
    await startPodcastForRoom({
        roomId: room._id,
        keywords: discussion.keywords,
    });
    console.log("room created: ", room)
    res.status(201).json(room);
};

export const toggleRoomPrivacy = async (req, res) => {
    const room = await Room.findById(req.params.roomId).populate("discussion", "owner");
    if (!room) {
        return res.status(404).json({ msg: "Room not found" });
    }

    const isRoomHost = String(room.host) === String(req.user._id);
    const isDiscussionOwner = String(room.discussion?.owner || "") === String(req.user._id);

    if (!isRoomHost && !isDiscussionOwner && req.user?.roles !== "admin") {
        return res.status(403).json({ msg: "Only the room owner can change room privacy" });
    }

    room.isPrivate = !room.isPrivate;
    if (room.isPrivate) {
        room.minParticipants = 2;
        room.maxParticipants = 4;
    }

    await room.save();
    const updatedRoom = await Room.findById(room._id)
        .populate("host", "email")
        .populate("discussion", "owner")
        .populate("members", "name email");
    res.json({
        room: updatedRoom,
        msg: room.isPrivate ? "Room is now private" : "Room is now public",
    });
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
        .populate("host", "email")
        .populate("discussion", "owner")
        .populate("members", "name email");
    if (!room) throw new Error("Room not found");
    if (
        !room.members.some((member) => String(member?._id || member) === String(req.user._id))
    ) throw new Error("Not authorized");

    res.json(room);
};

/* join room */
export const joinRoom = async (req, res) => {
    console.log("joining single room: ", req.params)
    const room = await Room.findById(req.params.roomId);
    if (!room) throw new Error("Room not found");

    if (
        room.isPrivate &&
        !room.members.some(id => id.toString() === req.user._id.toString()) &&
        room.members.length >= (room.maxParticipants || 4)
    ) {
        return res.status(400).json({ msg: "Private room is full. Maximum 4 participants allowed." });
    }

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
