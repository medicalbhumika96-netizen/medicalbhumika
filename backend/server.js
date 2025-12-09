import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Order from "./models/Order.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Static folders
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Ensure uploads folder exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Multer setup
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* ============================================================
   CUSTOMER — PLACE ORDER
============================================================ */
app.post("/api/orders", async (req, res) => {
  const orderData = req.body;
  if (!orderData || !orderData.phone) {
    return res.status(400).json({ error: "Invalid order data" });
  }

  const orderId = "ORD-" + Date.now();
  const newOrder = new Order({
    ...orderData,
    orderId,
    status: "Pending",
  });

  try {
    await newOrder.save();
    res.json({ success: true, orderId });
  } catch (err) {
    res.status(500).json({ error: "Failed to save order", details: err });
  }
});

/* ============================================================
   CUSTOMER — PAYMENT PROOF UPLOAD
============================================================ */
app.post("/api/payment-proof", upload.single("screenshot"), async (req, res) => {
  const { orderId, txnId = "" } = req.body;
  const fileUrl = req.file
    ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
    : "";

  try {
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.payment = {
      txn: txnId,
      fileUrl,
      method: order.paymentMethod || "UPI",
    };
    await order.save();
    res.json({ success: true, fileUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to update payment", details: err });
  }
});

/* ============================================================
   ADMIN LOGIN AUTH
============================================================ */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@bhumika.com";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "123456";

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token !== "MASTER_ADMIN_TOKEN_999") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/* ============================================================
   ADMIN — FETCH ORDERS
============================================================ */
app.get("/api/admin/orders", adminAuth, async (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  try {
    let orders = await Order.find().sort({ createdAt: -1 });

    if (q) {
      orders = orders.filter(
        (o) =>
          (o.orderId || "").toLowerCase().includes(q) ||
          (o.phone || "").toLowerCase().includes(q) ||
          (o.name || "").toLowerCase().includes(q)
      );
    }

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* ============================================================
   ADMIN — UPDATE STATUS
============================================================ */
app.post("/api/admin/orders/:id/status", adminAuth, async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  try {
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = status;
    await order.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update order" });
  }
});

/* ============================================================
   ADMIN — DELETE ORDER
============================================================ */
app.delete("/api/admin/orders/:id", adminAuth, async (req, res) => {
  const orderId = req.params.id;

  try {
    await Order.deleteOne({ orderId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete order" });
  }
});

/* ============================================================
   ADMIN — EXPORT ORDERS TO CSV
============================================================ */
app.get("/api/admin/export", adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    let csv = "Order ID,Name,Phone,Address,Total,Status,Created At\n";

    orders.forEach((o) => {
      csv += `"${o.orderId}","${o.name}","${o.phone}","${o.address}","${o.total}","${o.status}","${o.createdAt}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: "Failed to export orders" });
  }
});

/* ============================================================
   PRESCRIPTION UPLOAD
============================================================ */
app.post("/upload-prescription", upload.single("prescription"), (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!req.file)
      return res.status(400).json({ success: false, error: "No file uploaded" });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const logLine = `${new Date().toISOString()} | ${name} | ${phone} | ${address} | ${fileUrl}\n`;

    fs.appendFileSync("uploads/prescriptions.log", logLine);
    res.json({ success: true, fileUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* ============================================================
   ROOT TEST ROUTE
============================================================ */
app.get("/", (req, res) => {
  res.send("Bhumika Medical Backend Running ✔");
});

/* ============================================================
   START SERVER
============================================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Bhumika Medical Backend running on port ${PORT}`);
});
