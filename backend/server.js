import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import path from "path";
import dotenv from "dotenv";

import Order from "./models/Order.js";
import adminAuth from "./middleware/adminAuth.js";

import Product from "./models/Product.js";


dotenv.config();
const app = express();

/* =======================
   BASIC SETUP
======================= */
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* =======================
   DB CONNECT
======================= */
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("MongoDB connected");
}).catch(err => {
  console.error("Mongo error:", err);
});

/* =======================
   MULTER (IMAGES)
======================= */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

/* =======================
   ADMIN AUTH (SAMPLE)
======================= */
// NOTE: replace with real login later
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    return res.json({ success: true, token: "admin-token" });
  }
  res.status(401).json({ success: false });
});

/* =======================
   ADMIN: GET ORDERS
======================= */
app.get("/api/admin/orders", adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch {
    res.status(500).json({ success: false });
  }
});

/* =======================
   ADMIN: UPDATE ORDER STATUS (PHASE 3)
======================= */
app.post(
  "/api/admin/orders/:orderId/status",
  adminAuth,
  async (req, res) => {
    try {
      const { status } = req.body;
      const order = await Order.findOne({ orderId: req.params.orderId });
      if (!order) return res.json({ success: false });

      order.statusLogs = order.statusLogs || [];
      order.statusLogs.push({
        from: order.status,
        to: status,
        by: "admin",
        at: new Date()
      });

      order.status = status;
      await order.save();

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  }
);

/* =======================
   ADMIN: GET PRODUCTS
======================= */
app.get("/api/admin/products", adminAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json({ success: true, products });
  } catch {
    res.status(500).json({ success: false });
  }
});

/* =======================
   ADMIN: UPLOAD PRODUCT IMAGE
======================= */
app.post(
  "/api/admin/products/:id/image",
  adminAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.json({ success: false });

      product.image = `/uploads/${req.file.filename}`;
      await product.save();

      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false });
    }
  }
);

/* ================================
   ADMIN: UPDATE PRODUCT STOCK
   (PHASE 4)
================================ */
app.post(
  "/api/admin/products/:id/stock",
  adminAuth,
  async (req, res) => {
    try {
      const { stock } = req.body;

      if (stock === undefined) {
        return res.status(400).json({ success: false });
      }

      const qty = Number(stock);
      if (Number.isNaN(qty) || qty < 0) {
        return res.status(400).json({ success: false });
      }

      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false });
      }

      product.stock = qty;
      product.isActive = qty > 0;
      await product.save();

      res.json({
        success: true,
        stock: product.stock,
        isActive: product.isActive
      });
    } catch (err) {
      console.error("Stock update error:", err);
      res.status(500).json({ success: false });
    }
  }
);

/* =======================
   CUSTOMER: GET PRODUCTS
======================= */
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      stock: { $gt: 0 }
    }).sort({ name: 1 });

    res.json({ success: true, products });
  } catch {
    res.status(500).json({ success: false });
  }
});

/* =======================
   CUSTOMER: PLACE ORDER
======================= */
app.post(
  "/place-order",
  upload.single("paymentScreenshot"),
  async (req, res) => {
    try {
      const order = new Order({
        orderId: "ORD-" + Date.now(),
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address,
        pin: req.body.pin,
        items: JSON.parse(req.body.items),
        total: req.body.total,
        payment: {
          screenshot: req.file
            ? `/uploads/${req.file.filename}`
            : null
        }
      });

      await order.save();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  }
);

/* =======================
   SERVER START
======================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
