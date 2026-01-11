import express from "express";
import Review from "../models/Review.js";
import jwt from "jsonwebtoken";

const router = express.Router();

/* CUSTOMER SUBMIT REVIEW */
router.post("/submit", async (req, res) => {
  const { orderId, rating, comment } = req.body;

  if (!orderId || !rating)
    return res.status(400).json({ success: false });

  const exists = await Review.findOne({ orderId });
  if (exists)
    return res.json({ success: false, message: "Already reviewed" });

  await Review.create({ orderId, rating, comment });
  res.json({ success: true });
});

/* PUBLIC APPROVED REVIEWS */
router.get("/public", async (_, res) => {
  const reviews = await Review.find({ approved: true })
    .sort({ createdAt: -1 })
    .limit(10);
  res.json({ success: true, reviews });
});

router.get("/public", async (req, res) => {
  const isAdmin = req.headers.authorization;

  const filter = isAdmin ? {} : { approved: true };

  const reviews = await Review.find(filter)
    .sort({ createdAt: -1 });

  res.json({ success: true, reviews });
});


/* ADMIN APPROVE */
router.post("/admin/:id/approve", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ success: false });

  jwt.verify(auth.split(" ")[1], process.env.ADMIN_JWT_SECRET);

  await Review.findByIdAndUpdate(req.params.id, { approved: true });
  res.json({ success: true });
});

// ADMIN — GET ALL REVIEWS (Pending + Approved)
router.get("/admin/all", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ success: false });

  try {
    jwt.verify(auth.split(" ")[1], process.env.ADMIN_JWT_SECRET);

    const reviews = await Review.find()
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch {
    res.status(401).json({ success: false });
  }
});

export default router;
