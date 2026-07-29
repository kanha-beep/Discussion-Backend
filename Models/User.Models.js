import { UserSchema } from "../Schemas/User.Schema.js"
import mongoose from 'mongoose'
export const User = new mongoose.model("User", UserSchema)