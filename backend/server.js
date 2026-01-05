import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import jwt from "jsonwebtoken";
import Order from "./models/Order.js";

dotenv.config();

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= STATIC ================= */
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* ================= FILE SYSTEM ================= */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

/* ==================================================
   CUSTOMER — PLACE ORDER
================================================== */
app.post("/api/orders", async (req, res) => {
  console.log("🔥 /api/orders HIT");
  console.log("📦 BODY:", req.body);

  try {
    const data = req.body;

    if (!data || !data.phone) {
      console.log("❌ Invalid order data");
      return res.status(400).json({ success: false, error: "Invalid order data" });
    }

    const orderId = "ORD-" + Date.now();

    const order = new Order({
      ...data,
      orderId,
      status: "Pending",
    });

    await order.save();

    console.log("✅ Order saved:", orderId);

    res.json({ success: true, orderId });
  } catch (err) {
    console.error("❌ Order save error:", err);
    res.status(500).json({ success: false, error: "Order save failed" });
  }
});

/* ==================================================
   CUSTOMER — PAYMENT PROOF
================================================== */
app.post(
  "/api/payment-proof",
  upload.single("screenshot"),
  async (req, res) => {
    console.log("🔥 /api/payment-proof HIT");
    console.log("📦 BODY:", req.body);
    console.log("🖼 FILE:", req.file);

    try {
      const { orderId, txnId = "" } = req.body;

      if (!orderId) {
        console.log("❌ orderId missing");
        return res
          .status(400)
          .json({ success: false, error: "orderId missing" });
      }

      const order = await Order.findOne({ orderId });
      if (!order) {
        console.log("❌ Order not found:", orderId);
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }

      order.payment = {
        txn: txnId,
        fileUrl: req.file
          ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
          : "",
        method: "UPI",
      };

      await order.save();

      console.log("✅ Payment proof saved for:", orderId);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Payment update error:", err);
      res
        .status(500)
        .json({ success: false, error: "Payment update failed" });
    }
  }
);

/* ==================================================
   ADMIN AUTH (JWT)
================================================== */
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized admin" });
  }

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid admin token" });
  }
}

/* ==================================================
   ADMIN — LOGIN
================================================== */
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { role: "admin" },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: "1d" }
    );
    return res.json({ success: true, token });
  }

  res.status(401).json({ success: false });
});

/* ==================================================
   ADMIN — FETCH ORDERS
================================================== */
app.get("/api/admin/orders", adminAuth, async (req, res) => {
  try {
    const q = (req.query.q || "").toLowerCase();

    let orders = await Order.find().sort({ createdAt: -1 });

    if (q) {
      orders = orders.filter(
        (o) =>
          o.orderId?.toLowerCase().includes(q) ||
          o.phone?.includes(q) ||
          o.name?.toLowerCase().includes(q)
      );
    }

    res.json({ success: true, orders });
  } catch (err) {
    console.error("❌ Fetch orders error:", err);
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   ROOT
================================================== */
app.get("/", (_, res) => {
  res.send("✅ Bhumika Medical Backend Running");
});

/* ==================================================
   START SERVER
================================================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
