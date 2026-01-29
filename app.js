import dotenv from "dotenv";
dotenv.config();
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { connectDB } from "./init/db.js"
const app = express();
app.use(express.json());
console.log("urls: ", process.env.CORS_ORIGIN)
const allowedOrigins = process.env.FRONT_END.split(",")
console.log("urls: ", allowedOrigins)
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.set("trust proxy", 1)
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