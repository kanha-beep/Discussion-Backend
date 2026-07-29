import { User } from "../Models/User.Models.js"
import { ExpressError } from "../Middlewares/ExpressError.js"
import { DiscussionForm } from "../Models/Discussion.Models.js"
import { io } from "../server.js";
import { Chat } from "../Models/Chat.Model.js"
import { Message } from "../Models/Message.Schema.js"
import { Room } from "../Models/Room.Model.js";
import { RoomMessage } from "../Models/RoomMessage.Model.js";
import { Mail } from "../Models/Mail.Model.js";
import { createDiscussionService } from "../services/discussion.service.js";
import { createRoomForDiscussion, startPodcastForRoom } from "../services/room.service.js";
import { refreshNewsTagPool } from "../services/newsTag.service.js";
import { ensureBots } from "../bot/ensureBots.js";
import { appendRoomTranscriptEntry } from "../services/meetingCopilot.service.js";
import { createRoomJoinToken, getRoomPermissions } from "../utils/roomAccess.js";
import { validateBinaryUpload } from "../utils/uploadSecurity.js";
import multer from "multer";

export const roomUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 8 * 1024 * 1024,
    },
});

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

const buildRoomCloseMailBody = ({
    memberName,
    closerName,
    notes,
    requestedPdf = false,
}) => {
    const summaryText = notes?.trim() || "Discussion notes are being prepared by the system.";

    return [
        `Hi ${memberName || "there"},`,
        "",
        `${closerName || "The host"} has closed the discussion room.`,
        "",
        "Notes summary:",
        summaryText,
        "",
        requestedPdf ?
            "You asked to receive the notes PDF by email. That request has been recorded." :
            "You can still request the notes PDF from the feedback page if needed.",
        "",
        "This system-generated message will be deleted automatically after 7 days.",
    ].join("\n");
};

const ensureRoomAccess = (room, userId) => {
    const memberIds = room.members?.map((member) => String(member?._id || member)) || [];
    return memberIds.includes(String(userId));
};

const buildConversationNotes = (messages = [], fallbackSummary = "") => {
    const transcript = messages
        .map((message) => {
            const senderName =
                message.sender?.name || [message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(" ").trim() ||
                    message.sender?.email?.split("@")[0] ||
                        message.sender?.id ||
                    "Participant";
            return `${senderName}: ${message.text}`;
        })
        .join("\n");

    if (transcript.trim()) {
        return transcript;
    }

    return String(fallbackSummary || "").trim() || "No conversation transcript was captured.";
};

const normalizeSearchText = (value = "") =>
    String(value)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

const buildTranscriptSearchResponse = (query, entries = []) => {
    const normalizedQuery = normalizeSearchText(query);
    const matches = entries.filter((entry) =>
        normalizeSearchText(entry.text).includes(normalizedQuery),
    );
    const exactMatch = matches.some(
        (entry) => normalizeSearchText(entry.text) === normalizedQuery,
    );

    return {
        query,
        verified: matches.length > 0,
        exactMatch,
        matchCount: matches.length,
        matches,
        message: matches.length ?
            exactMatch ?
                "Yes, that exact line appears in the discussion." :
                "Yes, that idea appears in the discussion." : "No, I could not find that line in the saved discussion transcript.",
    };
};

const getAuthorizedRoom = async (roomId, user) => {
    const room = await Room.findById(roomId)
        .populate("discussion", "owner keywords summary")
        .populate("host", "email firstName lastName")
        .populate("members", "firstName lastName email");

    if (!room) {
        throw new ExpressError(404, "Room not found");
    }

    const permissions = getRoomPermissions({ room, user });
    return {
        room,
        access: permissions,
    };
};
export const getNews = async (req, res) => {
    try {
        const { items, tags } = await refreshNewsTagPool({ force: true });
        res.json({ items, tags });
    } catch (err) {
        console.log("Error in getNews: ", err.message)
        res.status(500).json({ msg: "Error fetching news" })
    }

}
export const createDiscussion = async (req, res, next) => {
    const { email, title, keywords, remarks, scheduledFor, includeBots = true } = req.body;
    console.log("user mail: ", email)
    const user = await User.findOne({ email });
    console.log("user got: ", user)
    if (!user) return next(new ExpressError(401, "User not found"))
    const { discussion, room } = await createDiscussionService({
        email,
        title,
        keywords,
        remarks,
        scheduledFor,
        includeBots: !!includeBots
    });
    return res.status(201).json({ discussion, room });
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
    const discussion = await DiscussionForm.findById(id)
        .populate("owner", "email firstName lastName")
        .populate("users", "email firstName lastName")
        .populate("closurePackage.closedBy", "email firstName lastName")
        .populate("closurePackage.noteRecipients", "email firstName lastName")
        .populate("closurePackage.notesPdfRequestedBy", "email firstName lastName")
        .populate("closurePackage.feedbackEntries.user", "email firstName lastName")
        .populate("closurePackage.feedbackEntries.aboutUser", "email firstName lastName");
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
    const users = await User.find({ _id: { $ne: req.user._id } },
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

// call to
// export const ChatBot = async (req, res) => {
//     const message = (req.body.message || "").trim();
//     if (!message) return res.status(400).json({ msg: "Message is required" });

//     const py = await fetch("http://localhost:8000/chatbot", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(message),
//     });

//     if (!py.ok) {
//         const errorText = await py.text();
//         console.log("chatbot python error:", py.status, errorText);
//         return res.status(502).json({ msg: "Chatbot service is unavailable" });
//     }

//     const data = await py.json();
//     console.log("got data in node: " + data.response)
//     res.json({ reply: data.response || "No response from chatbot" });
// }
export const chatAudio = async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ msg: "No audio received" });
    }
    const roomId = req?.headers["x-room-id"]
    const room = await Room.findById(roomId).populate("discussion")
    if (!room) {
        return res.status(200).json({
            reply: "",
            bot_reply: "",
            audio_url: "",
            brief: "",
            discussionId: null,
            roomClosed: true,
            msg: "Room closed",
        });
    }

    const isAllowed = room?.members.some((memberId) => String(memberId) === String(req.user._id)) ||
        String(room.host) === String(req.user._id) ||
        String(room.discussion?.owner || "") === String(req.user._id) ||
        req.user?.roles === "admin";

    if (!isAllowed) {
        return res.status(403).json({ msg: "Join the room before sending audio." });
    }

    const contentType = req.headers["content-type"] || "application/octet-stream";
    const uploadCheck = validateBinaryUpload({
        buffer: req.body,
        maxBytes: 12 * 1024 * 1024,
        allowedMimeTypes: [
            "application/octet-stream",
            "audio/webm",
            "audio/ogg",
            "audio/wav",
            "audio/mpeg",
        ],
        mimeType: contentType,
        fileName: "room-audio",
    });
    //
    if (!uploadCheck.ok) {
        return res.status(400).json({ msg: uploadCheck.reason });
    }

    const keywords = room.discussion.keywords || []
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
                discussionId, { summary: data.brief }, { new: true }
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
    const discussion = await DiscussionForm.findById(discussionId);
    if (!discussion) {
        return res.status(404).json({ msg: "Discussion not found" });
    }

    let room = await Room.findOne({ discussion: discussionId });
    if (room) {
        await startPodcastForRoom({
            roomId: room._id,
            keywords: discussion.keywords,
        });
        return res.status(200).json(room);
    }

    const { botModerator, botAssistant } = await ensureBots();
    const members = [
        String(req.user._id),
        String(botModerator._id),
        String(botAssistant._id),
    ];

    discussion.users = [...new Set([
        ...(discussion.users || []).map((member) => String(member)),
        ...members,
    ])];
    await discussion.save();

    room = await createRoomForDiscussion({
        discussionId,
        hostId: req.user._id,
        members,
        name: req.body.name || discussion.title || "Room",
        scheduledFor: discussion.scheduledFor,
        isPrivate: false,
        minParticipants: 3,
        maxParticipants: 4,
    });
    await DiscussionForm.findByIdAndUpdate(discussionId, {
        $set: {
            closurePackage: {
                closedAt: null,
                closedBy: null,
                deleteAt: null,
                notes: "",
                transcript: "",
                imageUrls: [],
                noteRecipients: [],
                notesPdfRequestedBy: [],
                feedbackEntries: [],
                copilotBrief: "",
                actionItems: [],
                unresolvedQuestions: [],
                recordings: [],
            },
        },
    });
    await startPodcastForRoom({
        roomId: room._id,
        keywords: discussion.keywords,
    });
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
        room.minParticipants = 3;
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

export const closeRoom = async (req, res) => {
    const room = await Room.findById(req.params.roomId)
        .populate("host", "email firstName lastName")
        .populate("discussion", "owner summary keywords");

    if (!room) {
        return res.status(404).json({ msg: "Room not found" });
    }

    const isRoomHost = String(room.host?._id || room.host) === String(req.user._id);
    const isDiscussionOwner = String(room.discussion?.owner || "") === String(req.user._id);

    if (!isRoomHost && !isDiscussionOwner && req.user?.roles !== "admin") {
        return res.status(403).json({ msg: "Only the room host can close this room" });
    }

    const populatedRoom = await Room.findById(room._id)
        .populate("members", "email firstName lastName")
        .populate("discussion", "owner summary keywords");
    const roomMessages = await RoomMessage.find({ room: populatedRoom._id })
        .populate("sender", "firstName lastName email")
        .sort({ createdAt: 1 });

    const summaryText = buildConversationNotes(
        roomMessages,
        String(req.body?.notes || "").trim() || populatedRoom?.discussion?.summary || "",
    );
    const transcriptText = buildConversationNotes(roomMessages);
    const imageUrls = Array.isArray(req.body?.imageUrls) ?
        req.body.imageUrls.filter(Boolean) : [];
    const deleteAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const closerName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ").trim() ||
        req.user?.email?.split("@")[0] ||
            "Host";

    const discussionId = populatedRoom.discussion?._id || populatedRoom.discussion;

    await DiscussionForm.findByIdAndUpdate(discussionId, {
        status: "pending",
        roomId: null,
        closurePackage: {
            closedAt: new Date(),
            closedBy: req.user._id,
            deleteAt,
            notes: summaryText,
            transcript: transcriptText,
            imageUrls,
            noteRecipients: populatedRoom.members.map((member) => member._id),
            notesPdfRequestedBy: [],
            feedbackEntries: [],
            copilotBrief: populatedRoom.copilot?.meetingBrief || "",
            actionItems: populatedRoom.copilot?.actionItems || [],
            unresolvedQuestions: populatedRoom.copilot?.unresolvedQuestions || [],
            recordings: populatedRoom.recordings || [],
        },
    });

    const mails = populatedRoom.members.map((member) => {
        const memberName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
            member.email?.split("@")[0] ||
        "Member";

        return {
            sender: req.user._id,
            recipient: member._id,
            senderEmail: req.user.email,
            recipientEmail: member.email,
            subject: `Room closed: ${populatedRoom.name || "Discussion Room"}`,
            body: buildRoomCloseMailBody({
                memberName,
                closerName,
                notes: summaryText,
            }),
            autoDeleteAt: deleteAt,
            metadata: {
                room: populatedRoom._id,
                discussion: discussionId,
                kind: "room-close-summary",
                noteSummary: summaryText,
                imageUrls,
                requestedPdf: false,
            },
        };
    });

    if (mails.length) {
        await Mail.insertMany(mails);
    }

    io.to(String(populatedRoom._id)).emit("room-closed", {
        roomId: String(populatedRoom._id),
        discussionId: String(discussionId || ""),
        closedBy: String(req.user._id),
        feedbackPath: `/discussion/${discussionId}/feedback`,
    });
    io.to(`watch-${String(populatedRoom._id)}`).emit("room-users-count", 0, String(populatedRoom._id));

    populatedRoom.status = "closed";
    populatedRoom.endedAt = new Date();
    await populatedRoom.save();

    await RoomMessage.deleteMany({ room: populatedRoom._id });
    await Room.findByIdAndDelete(populatedRoom._id);

    res.json({
        msg: "Room closed successfully",
        roomId: String(populatedRoom._id),
        discussionId: String(discussionId || ""),
        feedbackPath: `/discussion/${discussionId}/feedback`,
        deleteAt,
    });
};

export const searchDiscussionTranscript = async (req, res) => {
    const discussionId = req.params.discussionId;
    const query = String(req.body?.query || "").trim();

    if (!query) {
        return res.status(400).json({ msg: "Search query is required" });
    }

    const discussion = await DiscussionForm.findById(discussionId)
        .populate("users", "_id")
        .populate("owner", "_id");

    if (!discussion) {
        return res.status(404).json({ msg: "Discussion not found" });
    }

    const allowedUserIds = new Set([
        String(discussion.owner?._id || discussion.owner || ""),
        ...(discussion.users || []).map((member) => String(member?._id || member)),
        ...(discussion.closurePackage?.noteRecipients || []).map((member) => String(member)),
    ]);

    if (!allowedUserIds.has(String(req.user._id))) {
        return res.status(403).json({ msg: "Not authorized for this discussion transcript" });
    }

    const room = discussion.roomId ?
        await Room.findById(discussion.roomId).select("_id") :
        null;

    if (room?._id) {
        const liveMessages = await RoomMessage.find({ room: room._id })
            .populate("sender", "firstName lastName email")
            .sort({ createdAt: 1 });

        const liveEntries = liveMessages.map((message) => ({
            text: message.text,
            senderName: [message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(" ").trim() ||
                message.sender?.email?.split("@")[0] ||
                    "Participant",
            createdAt: message.createdAt,
            source: "live-room",
        }));

        return res.json(buildTranscriptSearchResponse(query, liveEntries));
    }

    const transcript = String(discussion.closurePackage?.transcript || "").trim();
    const savedEntries = transcript
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            const [senderName, ...rest] = line.split(":");
            return {
                text: rest.length ? rest.join(":").trim() : line,
                senderName: rest.length ? senderName.trim() : "Participant",
                createdAt: null,
                source: "saved-transcript",
                order: index,
            };
        });

    return res.json(buildTranscriptSearchResponse(query, savedEntries));
};

export const submitRoomFeedback = async (req, res) => {
    const discussion = await DiscussionForm.findById(req.params.discussionId)
        .populate("users", "email firstName lastName")
        .populate("owner", "email firstName lastName");

    if (!discussion) {
        return res.status(404).json({ msg: "Discussion not found" });
    }

    const allowedUserIds = [
        String(discussion.owner?._id || discussion.owner || ""),
        ...(discussion.users || []).map((member) => String(member?._id || member)),
        ...(discussion.closurePackage?.noteRecipients || []).map((member) => String(member)),
    ];

    if (!allowedUserIds.includes(String(req.user._id))) {
        return res.status(403).json({ msg: "Not authorized for this discussion" });
    }

    if (!discussion.closurePackage?.closedAt) {
        return res.status(400).json({ msg: "Feedback is only available after the room is closed" });
    }

    const engagementRating = Number(req.body?.engagementRating);
    const partnerRating = Number(req.body?.partnerRating);
    const comments = String(req.body?.comments || "").trim();
    const wantsNotesPdfEmail = !!req.body?.wantsNotesPdfEmail;
    const aboutUser = req.body?.aboutUser || null;

    if (![engagementRating, partnerRating].every((value) => value >= 1 && value <= 5)) {
        return res.status(400).json({ msg: "Ratings must be between 1 and 5" });
    }

    const existingFeedbackIndex = (discussion.closurePackage?.feedbackEntries || []).findIndex(
        (entry) => String(entry.user) === String(req.user._id),
    );

    const feedbackPayload = {
        user: req.user._id,
        aboutUser,
        engagementRating,
        partnerRating,
        comments,
        wantsNotesPdfEmail,
        submittedAt: new Date(),
    };

    if (existingFeedbackIndex >= 0) {
        discussion.closurePackage.feedbackEntries[existingFeedbackIndex] = feedbackPayload;
    } else {
        discussion.closurePackage.feedbackEntries.push(feedbackPayload);
    }

    const alreadyRequested = discussion.closurePackage?.notesPdfRequestedBy?.some(
        (userId) => String(userId) === String(req.user._id),
    );

    if (wantsNotesPdfEmail && !alreadyRequested) {
        discussion.closurePackage.notesPdfRequestedBy.push(req.user._id);

        await Mail.create({
            sender: discussion.closurePackage.closedBy || discussion.owner,
            recipient: req.user._id,
            senderEmail: req.user.email,
            recipientEmail: req.user.email,
            subject: `Notes PDF request recorded for discussion`,
            body: buildRoomCloseMailBody({
                memberName: [req.user.firstName, req.user.lastName].filter(Boolean).join(" ").trim() ||
                    req.user.email?.split("@")[0],
                closerName: "System",
                notes: discussion.closurePackage?.notes || discussion.summary || "",
                requestedPdf: true,
            }),
            autoDeleteAt: discussion.closurePackage.deleteAt,
            metadata: {
                room: null,
                discussion: discussion._id,
                kind: "room-notes-pdf-request",
                noteSummary: discussion.closurePackage?.notes || discussion.summary || "",
                imageUrls: discussion.closurePackage?.imageUrls || [],
                requestedPdf: true,
            },
        });
    }

    await discussion.save();

    res.json({
        msg: "Feedback submitted successfully",
        requestedPdf: wantsNotesPdfEmail,
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

export const getRoomSession = async (req, res) => {
    const { room, access } = await getAuthorizedRoom(req.params.roomId, req.user);
    const joinToken = createRoomJoinToken({
        room,
        user: req.user,
        permissions: access.permissions,
        role: access.role,
    });

    res.json({
        roomId: String(room._id),
        role: access.role,
        permissions: access.permissions,
        joinToken,
        expiresInSeconds: Number(process.env.ROOM_JOIN_TTL_SECONDS || 60 * 60 * 2),
        scheduledFor: room.scheduledFor,
        status: room.status,
    });
};

export const scheduleDiscussionRoom = async (req, res) => {
    const discussion = await DiscussionForm.findById(req.params.discussionId);
    if (!discussion) {
        return res.status(404).json({ msg: "Discussion not found" });
    }

    if (String(discussion.owner) !== String(req.user._id) && req.user?.roles !== "admin") {
        return res.status(403).json({ msg: "Only the discussion owner can reschedule this room" });
    }

    discussion.scheduledFor = req.body?.scheduledFor || null;
    if (req.body?.title !== undefined) {
        discussion.title = String(req.body.title || "").trim();
    }
    await discussion.save();

    if (discussion.roomId) {
        await Room.findByIdAndUpdate(discussion.roomId, {
            scheduledFor: discussion.scheduledFor,
            status: discussion.scheduledFor && new Date(discussion.scheduledFor) > new Date() ?
                "scheduled" : "live",
            ...(discussion.title ? { name: discussion.title } : {}),
        });
    }

    res.json({ discussion });
};

/* single room */
export const singleRoom = async (req, res) => {
    console.log("finding single room:", req.params)
    const { room, access } = await getAuthorizedRoom(req.params.roomId, req.user);

    const isMember = room.members.some(
        (member) => String(member?._id || member) === String(req.user._id),
    );
    const isHost = String(room.host?._id || room.host) === String(req.user._id);
    const isDiscussionOwner =
        String(room.discussion?.owner?._id || room.discussion?.owner || "") ===
        String(req.user._id);
    const isPrivileged = isMember || isHost || isDiscussionOwner || req.user?.roles === "admin";

    if (!isPrivileged && room.isPrivate) {
        return res.json({
            _id: room._id,
            name: room.name,
            host: room.host,
            discussion: room.discussion,
            isPrivate: room.isPrivate,
            minParticipants: room.minParticipants,
            maxParticipants: room.maxParticipants,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
            members: [],
            access: {
                isMember: false,
                isHost: false,
                canReadMessages: false,
                requiresHostApproval: true,
                role: access.role,
                permissions: access.permissions,
            },
        });
    }

    res.json({
        ...room.toObject(),
        access: {
            isMember,
            isHost,
            canReadMessages: true,
            requiresHostApproval: room.isPrivate && !isMember && !isHost,
            role: access.role,
            permissions: access.permissions,
        },
    });
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
        room.moderation = room.moderation || { waitingRoomEnabled: true, events: [], participantState: [] };
        room.moderation.participantState = room.moderation.participantState || [];
        room.moderation.participantState.push({
            user: req.user._id,
            muted: false,
            admittedAt: new Date(),
            lastSeenAt: new Date(),
        });
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
        req.params.roomId, {
        $pull: {
            members: req.user._id,
            "moderation.participantState": { user: req.user._id },
        },
    }
    );

    res.json({ left: true });
};
/* get room messages */
export const getRoomMessages = async (req, res) => {
    console.log("get room mesg: ", req.params.roomId)
    const room = await Room.findById(req.params.roomId)
        .populate("discussion", "owner");
    if (!room) {
        return res.status(404).json({ msg: "Room not found" });
    }

    const isMember = room.members?.some(
        (member) => String(member?._id || member) === String(req.user._id),
    );
    const isHost = String(room.host || "") === String(req.user._id);
    const isDiscussionOwner =
        String(room.discussion?.owner?._id || room.discussion?.owner || "") ===
        String(req.user._id);

    if (!isMember && !isHost && !isDiscussionOwner && room.isPrivate && req.user?.roles !== "admin") {
        return res.status(403).json({ msg: "Join the room first to view room messages" });
    }

    const messages = await RoomMessage.find({
        room: req.params.roomId,
    })
        .populate("sender", "firstName lastName email")
        .sort({ createdAt: 1 });

    res.json(messages);
};

/* send room message */
export const sendRoomMessage = async (req, res) => {
    const room = await Room.findById(req.params.roomId)
        .populate("discussion", "owner");

    if (!room) {
        return res.status(404).json({ msg: "Room not found" });
    }

    const isAllowed = room.members?.some((member) => String(member) === String(req.user._id)) ||
        String(room.host || "") === String(req.user._id) ||
        String(room.discussion?.owner || "") === String(req.user._id) ||
        req.user?.roles === "admin";

    if (!isAllowed) {
        return res.status(403).json({ msg: "Join the room before posting messages." });
    }

    const message = await RoomMessage.create({
        room: req.params.roomId,
        sender: req.user._id,
        text: req.body.text,
    });

    await appendRoomTranscriptEntry({
        roomId: req.params.roomId,
        entry: {
            sender: req.user._id,
            speakerName: [req.user.firstName, req.user.lastName].filter(Boolean).join(" ").trim() ||
                req.user.email?.split("@")[0] ||
            "Participant",
            text: req.body.text,
            source: "chat",
            createdAt: message.createdAt,
        },
    });

    res.status(201).json(message);
};

export const createCollaborativeDocument = async (req, res) => {
    const { room } = await getAuthorizedRoom(req.params.roomId, req.user);
    const title = String(req.body?.title || "Untitled doc").trim();
    const content = String(req.body?.content || "");

    room.collaborativeDocuments.push({
        title,
        content,
        updatedBy: req.user._id,
        updatedAt: new Date(),
    });
    await room.save();

    res.status(201).json({
        document: room.collaborativeDocuments[room.collaborativeDocuments.length - 1],
    });
};

export const updateCollaborativeDocument = async (req, res) => {
    const { room } = await getAuthorizedRoom(req.params.roomId, req.user);
    const document = room.collaborativeDocuments.id(req.params.documentId);

    if (!document) {
        return res.status(404).json({ msg: "Document not found" });
    }

    if (req.body?.title !== undefined) {
        document.title = String(req.body.title || "").trim() || document.title;
    }
    if (req.body?.content !== undefined) {
        document.content = String(req.body.content || "");
    }
    document.updatedBy = req.user._id;
    document.updatedAt = new Date();
    await room.save();

    res.json({ document });
};

export const createKnowledgeThread = async (req, res) => {
    const { room } = await getAuthorizedRoom(req.params.roomId, req.user);
    const title = String(req.body?.title || "Knowledge thread").trim();
    const prompt = String(req.body?.prompt || "").trim();
    const summary = String(req.body?.summary || "").trim();
    const references = Array.isArray(req.body?.references) ?
        req.body.references.map((item) => String(item).trim()).filter(Boolean) : [];

    room.knowledgeThreads.push({
        title,
        prompt,
        summary,
        references,
        createdBy: req.user._id,
        updatedAt: new Date(),
    });
    await room.save();

    res.status(201).json({
        knowledgeThread: room.knowledgeThreads[room.knowledgeThreads.length - 1],
    });
};

export const addRoomRecording = async (req, res) => {
    const { room } = await getAuthorizedRoom(req.params.roomId, req.user);

    room.recordings.push({
        label: String(req.body?.label || "Room recording").trim(),
        provider: String(req.body?.provider || "browser").trim(),
        url: String(req.body?.url || "").trim(),
        durationSeconds: Number(req.body?.durationSeconds || 0),
        sizeBytes: Number(req.body?.sizeBytes || 0),
        checksum: String(req.body?.checksum || "").trim(),
        addedBy: req.user._id,
    });
    await room.save();

    res.status(201).json({
        recording: room.recordings[room.recordings.length - 1],
    });
};

export const addCopilotActionItem = async (req, res) => {
    const { room } = await getAuthorizedRoom(req.params.roomId, req.user);
    const title = String(req.body?.title || "").trim();
    if (!title) {
        return res.status(400).json({ msg: "Action item title is required" });
    }

    room.copilot.actionItems.push({
        title,
        owner: req.body?.owner || null,
        ownerLabel: String(req.body?.ownerLabel || req.user.email?.split("@")[0] || "Unassigned"),
        status: req.body?.status || "open",
        citation: String(req.body?.citation || ""),
        createdAt: new Date(),
    });
    room.copilot.updatedAt = new Date();
    await room.save();

    res.status(201).json({
        actionItem: room.copilot.actionItems[room.copilot.actionItems.length - 1],
    });
};

export const uploadRoomAsset = async (req, res) => {
    const { room } = await getAuthorizedRoom(req.params.roomId, req.user);
    const file = req.file;

    if (!file) {
        return res.status(400).json({ msg: "No file uploaded" });
    }

    const uploadCheck = validateBinaryUpload({
        buffer: file.buffer,
        maxBytes: 8 * 1024 * 1024,
        allowedMimeTypes: [
            "application/pdf",
            "text/plain",
            "image/png",
            "image/jpeg",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        mimeType: file.mimetype,
        fileName: file.originalname,
    });

    room.uploads.push({
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksum: uploadCheck.sha256 || "",
        status: uploadCheck.ok ? "accepted" : "rejected",
        uploadedBy: req.user._id,
    });
    await room.save();

    if (!uploadCheck.ok) {
        return res.status(400).json({ msg: uploadCheck.reason });
    }

    res.status(201).json({
        upload: room.uploads[room.uploads.length - 1],
        msg: "Upload scanned and accepted",
    });
};