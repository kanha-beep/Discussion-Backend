import { User } from "../Models/User.Models.js"
import { ExpressError } from "../Middlewares/ExpressError.js"
import { DiscussionForm } from "../Models/Discussion.Models.js"
export const searchKey = async (req, res, next) => {
    console.log("search starts")
    console.log("body: ", req.body, "query: ", req.query)
    return res.status(200).json({ discussions });
}