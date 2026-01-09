import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import jwt from "jsonwebtoken";

import Order from "./models/Order.js";
import Product from "./models/Product.js"; // ✅ REQUIRED

dotenv.config();

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= STATIC ================= */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("uploads/products")) fs.mkdirSync("uploads/products", { recursive: true });

app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

/* ================= MULTER (ORDERS / PAYMENT) ================= */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"))
});
const upload = multer({ storage });

/* ================= MULTER (PRODUCT IMAGES) ================= */
const productStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/products"),
  filename: (_, file, cb) => {
    const safe = file.originalname.toLowerCase().replace(/\s+/g, "-");
    cb(null, Date.now() + "-" + safe);
  }
});
const productUpload = multer({ storage: productStorage });

/* ==================================================
   CUSTOMER — PLACE ORDER
================================================== */
app.post("/api/orders", async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.phone) {
      return res.status(400).json({ success: false });
    }

    const orderId = "ORD-" + Date.now();

    const order = new Order({
      orderId,
      clientRef: data.clientRef || null,
      phone: data.phone,
      name: data.name,
      address: data.address,
      pin: data.pin,
      items: data.items,
      total: data.total,
      discount: data.discount || 0,
      payment: data.payment || {},
      status: "Pending",
      createdAt: new Date()
    });

    await order.save();
    res.json({ success: true, orderId });

  } catch (err) {
    console.error("❌ Order save error:", err);
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   CUSTOMER — PAYMENT PROOF
================================================== */
app.post("/api/payment-proof", upload.single("screenshot"), async (req, res) => {
  try {
    const { orderId, txnId = "" } = req.body;
    if (!orderId) return res.status(400).json({ success: false });

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false });

    order.payment = {
      txn: txnId,
      screenshot: req.file ? `/uploads/${req.file.filename}` : "",
      method: "UPI"
    };

    await order.save();
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
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ success: false });

  try {
    jwt.verify(auth.split(" ")[1], process.env.ADMIN_JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false });
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
app.get("/api/admin/products", adminAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json({ success: true, products });
  } catch (err) {
    console.error("❌ Fetch products error:", err);
    res.status(500).json({ success: false });
  }
});
/* ==================================================
   ADMIN — UPDATE ORDER STATUS
================================================== */
app.post("/api/admin/orders/:orderId/status", adminAuth, async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!["Pending", "Approved", "Rejected", "Packed", "Out for Delivery", "Delivered"].includes(status))
    return res.status(400).json({ success: false });

  const order = await Order.findOneAndUpdate(
    { orderId },
    { status },
    { new: true }
  );

  if (!order) return res.status(404).json({ success: false });
  res.json({ success: true });
});

/* ==================================================
   ADMIN — UPLOAD / REPLACE PRODUCT IMAGE ✅
================================================== */
app.post(
  "/api/admin/products/:id/image",
  adminAuth,
  productUpload.single("image"),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ success: false });

      product.image = `/uploads/products/${req.file.filename}`;
      product.imageType = "real";
      await product.save();

      res.json({ success: true, image: product.image });

    } catch (err) {
      console.error("❌ Image upload error:", err);
      res.status(500).json({ success: false });
    }
  }
);

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
