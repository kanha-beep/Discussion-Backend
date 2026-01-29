import dotenv from "dotenv";
dotenv.config();
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { connectDB } from "./init/db.js"
const app = express();
app.use(express.json());
console.log("urls: ", process.env.CORS_ORIGIN)
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
}));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

import AuthRoutes from "./Routes/Auth.Routes.js";
app.use("/api/auth", AuthRoutes)
import DiscussionRoutes from "./Routes/Discussion.Routes.js";
app.use("/api/discussion", DiscussionRoutes);
connectDB()
app.use((error, req, res, next) => {
    const { status = 500, msg = "Something went wrong" } = error
    res.status(status).json({ msg })
})


export default app;