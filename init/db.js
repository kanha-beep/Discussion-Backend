import mongoose from "mongoose"
export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        // console.log("MongoDB connected successfully: ", process.env.MONGO_URL)
    } catch (err) {
        console.error("Database error:", err.message)
        process.exit(1)
    }
}