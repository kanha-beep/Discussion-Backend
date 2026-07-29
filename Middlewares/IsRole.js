export const isRole = (...roles) => {
    return (req, res, next) => {
        console.log("req.user.roles: ", req.user?.roles)
        if (!req.user || !req.user.roles) {
            return res.status(401).json({ message: "You are not authenticated" })
        }
        if (!roles.includes(req.user.roles)) {

            return res.status(403).json({ message: "You are not authorized to access this route" })
        }
        next()
    }
}