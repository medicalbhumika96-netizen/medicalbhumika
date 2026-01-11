import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import jwt from "jsonwebtoken";
import Reminder from "./models/Reminder.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import path from "path";

dotenv.config();

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/review/:orderId", (req, res) => {
  res.sendFile(
    path.join(process.cwd(), "public", "review.html")
  );
});

/* ================= ROUTES ================= */
app.use("/api/reviews", reviewRoutes);
/* ================= STATIC ================= */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("uploads/products")) {
  fs.mkdirSync("uploads/products", { recursive: true });
}

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


app.post("/api/orders/track-secure", async (req, res) => {
  try {
    const { orderId, phone } = req.body;

    if (!orderId || !phone) {
      return res.json({ success: false });
    }

    const order = await Order.findOne({
      orderId: orderId.trim(),
      phone: phone.trim()
    });

    if (!order) {
      return res.json({ success: false });
    }

    res.json({
      success: true,
      order
    });

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
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ success: false });
  }

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
   ADMIN — DUE PRESCRIPTION REMINDERS
================================================== */
app.get("/api/admin/reminders/due", adminAuth, async (req, res) => {
  try {
    const today = new Date();

    const reminders = await Reminder.find({
      reminderDate: { $lte: today },
      sent: false,
      type: "prescription"
    }).sort({ reminderDate: 1 });

    res.json({ success: true, reminders });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
app.post("/api/admin/reminders/:id/sent", adminAuth, async (req, res) => {
  try {
    await Reminder.findByIdAndUpdate(req.params.id, {
      sent: true
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
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
   ADMIN — FETCH PRODUCTS
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
   PUBLIC — FETCH PRODUCTS (CUSTOMER)
================================================== */
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   ADMIN — ADD PRODUCT ➕
================================================== */
app.post("/api/admin/products", adminAuth, async (req, res) => {
  try {
    const { name, company, mrp } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name required" });
    }

    const exists = await Product.findOne({ name });
    if (exists) {
      return res.status(409).json({ success: false, message: "Already exists" });
    }

    const product = await Product.create({
      name,
      company: company || "",
      mrp: Number(mrp) || 0,
      image: "/img/placeholders/medicine.png",
      imageType: "placeholder"
    });

    res.json({ success: true, product });

  } catch (err) {
    console.error("❌ Add product error:", err);
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   ADMIN — UPDATE PRODUCT ✏️
================================================== */
app.put("/api/admin/products/:id", adminAuth, async (req, res) => {
  try {
    const { name, company, mrp } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false });

    if (name !== undefined) product.name = name;
    if (company !== undefined) product.company = company;
    if (mrp !== undefined) product.mrp = Number(mrp);

    await product.save();
    res.json({ success: true, product });

  } catch (err) {
    console.error("❌ Update product error:", err);
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   ADMIN — DELETE PRODUCT 🗑️
================================================== */
app.delete("/api/admin/products/:id", adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false });

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Delete product error:", err);
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   ADMIN — IMPORT PRODUCTS FROM JSON (ONE TIME)
================================================== */
app.post("/api/admin/products/import-json", adminAuth, async (req, res) => {
  try {
    const raw = fs.readFileSync("./public/products_with_images.json", "utf-8");
    const parsed = JSON.parse(raw);

    const list =
      Array.isArray(parsed) ? parsed :
      Array.isArray(parsed.data) ? parsed.data :
      Array.isArray(parsed.products) ? parsed.products :
      [];

    let inserted = 0;

    for (const item of list) {
      const name = item.Product || item.name;
      if (!name) continue;

      const exists = await Product.findOne({ name });
      if (exists) continue;

      await Product.create({
        name,
        company: item.Company || "",
        mrp: Number(item.MRP) || 0,
        image: item.Image || "/img/placeholders/medicine.png",
        imageType: item.Image ? "real" : "placeholder"
      });

      inserted++;
    }

    res.json({ success: true, inserted });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ==================================================
   ADMIN — UPDATE ORDER STATUS
================================================== */
app.post("/api/admin/orders/:orderId/status", adminAuth, async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!["Pending","Approved","Rejected","Packed","Out for Delivery","Delivered"].includes(status)) {
    return res.status(400).json({ success: false });
  }

  const order = await Order.findOneAndUpdate(
    { orderId },
    { status },
    { new: true }
  );

  if (!order) return res.status(404).json({ success: false });

  /* =========================
     PRESCRIPTION REMINDER
  ========================= */
  if (status === "Delivered") {
  const alreadyExists = await Reminder.findOne({
    orderId: order.orderId,
    type: "prescription"
  });

  if (!alreadyExists) {
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 30);

    await Reminder.create({
      orderId: order.orderId,
      phone: order.phone,
      name: order.name,
      reminderDate,
      type: "prescription"
    });
  }
}


  res.json({ success: true });
});

/* ==================================================
   ADMIN — UPLOAD / REPLACE PRODUCT IMAGE
================================================== */
app.post(
  "/api/admin/products/:id/image",
  adminAuth,
  productUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false });

      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ success: false });

      product.image = `/uploads/products/${req.file.filename}`;
      product.imageType = "real";
      await product.save();

      res.json({ success: true, image: product.image });

    } catch (err) {
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
