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
  try {
    const data = req.body;
    if (!data || !data.phone) {
      return res.status(400).json({ success: false, message: "Invalid order data" });
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
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   CUSTOMER — TRACK ORDERS (PHONE BASED) ✅
================================================== */
app.get("/api/orders/track/:phone", async (req, res) => {
  try {
    const phone = req.params.phone;

    const orders = await Order.find({ phone })
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    console.error("❌ Track order error:", err);
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   CUSTOMER — PAYMENT PROOF
================================================== */
app.post("/api/payment-proof", upload.single("screenshot"), async (req, res) => {
  try {
    const { orderId, txnId = "" } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId missing" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.payment = {
      txn: txnId,
      screenshot: req.file ? `/uploads/${req.file.filename}` : "",
      method: "UPI",
    };

    await order.save();
    console.log("✅ Payment proof saved:", orderId);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Payment proof error:", err);
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   ADMIN AUTH (JWT)
================================================== */
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ success: false });
  }

  const token = auth.split(" ")[1];

  try {
    jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false });
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
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    console.error("❌ Fetch orders error:", err);
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   ADMIN — UPDATE STATUS
================================================== */
app.post("/api/admin/orders/:orderId/status", adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false });
    }

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false });
    }

    console.log(`✅ Order ${orderId} → ${status}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Status update error:", err);
    res.status(500).json({ success: false });
  }
});

// ==================================================
// CUSTOMER — TRACK ORDER (ORDER ID + PHONE) 🔐
// ==================================================
app.post("/api/orders/track-secure", async (req, res) => {
  try {
    const { orderId, phone } = req.body;

    if (!orderId || !phone) {
      return res.status(400).json({
        success: false,
        message: "Order ID and phone required"
      });
    }

    const order = await Order.findOne({ orderId, phone });

    if (!order) {
      return res.json({
        success: false,
        message: "No matching order found"
      });
    }

    res.json({ success: true, order });

  } catch (err) {
    console.error("❌ Secure track error:", err);
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
  console.log(`🚀 Server running on ${PORT}`);
});
