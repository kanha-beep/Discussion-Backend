import { ExpressError } from "../Middlewares/ExpressError.js";
import { GenToken } from "../Middlewares/GenToken.js";
import { User } from "../Models/User.Models.js";
import bcrypt from "bcrypt";

export const Register = async (req, res, next) => {
    console.log(req.body);
    const { email, password, firstName, lastName, profession } = req.body;
    if (!email || !password) return next(new ExpressError(400, "Email and password are required"));
    // console.log("email: ", email);
    // if (email === "kanhashree2223@gmail.com") return res.status(404).json({ msg: "Hello Owner", name: "kanha", roles: "admin" });
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = await User.findOne({ email });
    console.log(user);
    // if (user) return next(new ExpressError(400, "User already exists"));
    user.firstName = firstName,
        user.lastName = lastName,
        user.profession = profession,
        user.password = hashedPassword,
        user.roles = "user"
    await user.save()
    // console.log("new user registered: ", user)
    // console.log("User roles before token generation: ", user.roles);
    const token = GenToken(user);
    console.log("Generated token: ", token);
    return res.cookie("cookieToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    }).status(201).json({
        msg: "User registered successfully",
        user: {
            id: user._id,
            email: user.email,
            roles: user.roles
        }
    });
};

export const Login = async (req, res, next) => {
    console.log("login starts")
    const { email, password } = req.body;
    console.log(req.body);
    if (!email || !password) return next(new ExpressError(400, "Email and password are required"));
    console.log("find admin")
    console.log("admin not here so create user")
    const user = await User.findOne({ email });
    console.log("user: ", user)
    if (!user) return next(new ExpressError(401, "User does not exist"));
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return next(new ExpressError(402, "Invalid credentials"));
    console.log("User roles before token generation: ", user.roles);
    const token = GenToken(user);
    console.log("Generated token: ", token)
    return res.cookie("cookieToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }).status(200).json({
        msg: "User logged in successfully",
        user: {
            id: user._id,
            email: user.email,
            roles: user.roles
        }
    });
};
export const currentUser = async (req, res, next) => {
    const userId = req?.user?._id;
    console.log("user id: ", userId)
    const user = await User.findById(userId).select("-password");
    // console.log("current user: ", user)
    if (!user) return next(new ExpressError(400, "User does not exist"));
    return res.status(200).json({
        msg: "User fetched successfully", user
    });
};
export const checkEmail = async (req, res, next) => {
    console.log("email: ", req.body)
    if (verifyEmail === null) {
        const newEmail = await User.create({ email });
        return res.status(200).json({ msg: "Email is valid" });
    }
    const { email } = req.body;
    if (!email) return next(new ExpressError(400, "Email is required"));
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return next(new ExpressError(401, "Invalid email"));
    const verifyEmail = await User.findOne({ email });
    console.log("got email: ", verifyEmail)
    if (verifyEmail === null) {
        const newEmail = await User.create({ email });
        console.log("user craeted : ", newEmail)
        return res.status(200).json({
            msg: "Email is valid"
        });
    }
    if (verifyEmail) return next(new ExpressError(402, "Email already exists"));
    console.log("verify email: ", verifyEmail);
    return res.status(200).json({
        msg: "Email is valid"
    });

}
export const Logout = async (req, res, next) => {
    res.clearCookie("cookieToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    })
    res.status(200).json({
        msg: "User logged out successfully"
    });
};