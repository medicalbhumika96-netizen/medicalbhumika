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

// ================= STATIC =================
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

// ================= DB =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ================= FILE SYSTEM =================
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

// ==================================================
// CUSTOMER — PLACE ORDER
// ==================================================
app.post("/api/orders", async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.phone) {
      return res.status(400).json({ error: "Invalid order data" });
    }

    const orderId = "ORD-" + Date.now();

    const order = new Order({
      ...data,
      orderId,
      status: "Pending",
    });

    await order.save();
    res.json({ success: true, orderId });
  } catch (err) {
    res.status(500).json({ error: "Order save failed" });
  }
});

// ==================================================
// CUSTOMER — PAYMENT PROOF
// ==================================================
app.post("/api/payment-proof", upload.single("screenshot"), async (req, res) => {
  try {
    const { orderId, txnId = "" } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.payment = {
      txn: txnId,
      fileUrl: req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : "",
      method: order.payment?.method || "UPI",
    };

    await order.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Payment update failed" });
  }
});

// ==================================================
// ADMIN AUTH (SECURE)
// ==================================================
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized admin" });
  }
  next();
}

// ==================================================
// ADMIN — FETCH ORDERS
// ==================================================
app.get("/api/admin/orders", adminAuth, async (req, res) => {
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
});

// ==================================================
// ADMIN — UPDATE STATUS
// ==================================================
app.post("/api/admin/orders/:id/status", adminAuth, async (req, res) => {
  const { status } = req.body;
  const order = await Order.findOne({ orderId: req.params.id });
  if (!order) return res.status(404).json({ error: "Order not found" });

  order.status = status;
  await order.save();
  res.json({ success: true });
});

// ==================================================
// ADMIN — DELETE ORDER
// ==================================================
app.delete("/api/admin/orders/:id", adminAuth, async (req, res) => {
  await Order.deleteOne({ orderId: req.params.id });
  res.json({ success: true });
});

// ==================================================
// ADMIN — EXPORT CSV
// ==================================================
app.get("/api/admin/export", adminAuth, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  let csv = "OrderID,Name,Phone,Address,Total,Status,Date\n";

  orders.forEach((o) => {
    csv += `"${o.orderId}","${o.name}","${o.phone}","${o.address}","${o.total}","${o.status}","${o.createdAt}"\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  res.send(csv);
});

// ==================================================
// PRESCRIPTION UPLOAD
// ==================================================
app.post("/upload-prescription", upload.single("prescription"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

// ==================================================
// ROOT
// ==================================================
app.get("/", (_, res) => {
  res.send("✅ Bhumika Medical Backend Running");
});

// ==================================================
// START
// ==================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
