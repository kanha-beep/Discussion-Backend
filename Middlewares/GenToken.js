import jwt from "jsonwebtoken";

export const GenToken = (user) => jwt.sign({ "email": user.email, "_id": user._id, "roles": user.roles }, process.env.JWT_SECRET || "study_key", { expiresIn: "1d" })