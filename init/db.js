import mongoose from "mongoose"
import { User } from "../Models/User.Models.js"
import { Room } from "../Models/Room.Model.js"
export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        // const users = await User.find({});
        // for (let u of users) {
        //     u.email = u.email.toLowerCase();
        //     await u.save();
        // }
        // console.log("upfate: ", users)
    } catch (err) {
        console.error("Database error:", err.message)
        process.exit(1)
    }
}