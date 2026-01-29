import jwt from 'jsonwebtoken';
import { ExpressError } from './ExpressError.js';

export const VerifyAuth = (req, res, next) => {
    try {
        const token = req.cookies.cookieToken;

        if (!token) return next(new ExpressError(401, "No token generated after login in verifyAuth"));
        // console.log("Token: ", token);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "study_key");
        console.log("Decoded: ", decoded.email);
        req.user = decoded; // decoded contains {email, _id}
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new ExpressError(401, "Invalid token"));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new ExpressError(401, "Token expired"));
        }
        return next(new ExpressError(500, "Token verification failed"));
    }
}