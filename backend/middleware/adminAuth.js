// backend/middleware/adminAuth.js

export default function adminAuth(req, res, next) {
  const auth = req.headers.authorization || "";

  if (auth === "Bearer admin-token") {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: "Unauthorized admin access"
  });
}
