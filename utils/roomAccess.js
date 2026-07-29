import jwt from "jsonwebtoken";

const ROOM_JOIN_SECRET =
  process.env.ROOM_JOIN_SECRET || process.env.JWT_SECRET || "study_key";

const ROOM_JOIN_TTL = Number(process.env.ROOM_JOIN_TTL_SECONDS || 60 * 60 * 2);

const permissionSets = {
  host: [
    "room:join",
    "room:chat",
    "room:signal",
    "room:moderate",
    "room:admit",
    "room:kick",
    "room:mute",
    "room:share",
    "room:recording:write",
    "room:document:write",
    "room:thread:write",
    "room:copilot:write",
  ],
  moderator: [
    "room:join",
    "room:chat",
    "room:signal",
    "room:moderate",
    "room:admit",
    "room:kick",
    "room:mute",
    "room:share",
    "room:recording:write",
    "room:document:write",
    "room:thread:write",
    "room:copilot:write",
  ],
  member: [
    "room:join",
    "room:chat",
    "room:signal",
    "room:share",
    "room:recording:write",
    "room:document:write",
    "room:thread:write",
  ],
  guest: ["room:request_join"],
};

export const getRoomRole = ({ room, user }) => {
  const userId = String(user?._id || "");
  const hostId = String(room?.host?._id || room?.host || "");
  const discussionOwnerId = String(
    room?.discussion?.owner?._id || room?.discussion?.owner || "",
  );
  const memberIds = (room?.members || []).map((member) =>
    String(member?._id || member),
  );

  if (user?.roles === "admin") return "host";
  if (userId && (userId === hostId || userId === discussionOwnerId)) return "host";
  if (memberIds.includes(userId)) return "member";
  return "guest";
};

export const getRoomPermissions = ({ room, user }) => {
  const role = getRoomRole({ room, user });
  const permissions = new Set(permissionSets[role] || []);

  if (!room?.isPrivate) {
    permissions.add("room:join");
  }

  return {
    role,
    permissions: [...permissions],
  };
};

export const createRoomJoinToken = ({ room, user, permissions, role }) =>
  jwt.sign(
    {
      sub: String(user._id),
      roomId: String(room._id),
      role,
      permissions,
      membershipVersion: Number(room.joinTokenVersion || 1),
    },
    ROOM_JOIN_SECRET,
    {
      audience: "discussion-room",
      expiresIn: ROOM_JOIN_TTL,
      issuer: "discussion-platform",
    },
  );

export const verifyRoomJoinToken = (token) =>
  jwt.verify(token, ROOM_JOIN_SECRET, {
    audience: "discussion-room",
    issuer: "discussion-platform",
  });

export const hasRoomPermission = (session, permission) =>
  !!session?.permissions?.includes(permission);
