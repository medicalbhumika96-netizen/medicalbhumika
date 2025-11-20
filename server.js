import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import cors from "cors";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ---------------------------------------------------------
// BASIC CORS (NO COOKIES NEEDED FOR OPTION A)
// ---------------------------------------------------------
app.use(cors({
  origin: "*"
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure folders exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("data")) fs.mkdirSync("data");

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// SendGrid setup
try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} catch (err) {
  console.error("SendGrid init error:", err.message);
}

// ------------------------------------------------------
// ADMIN LOGIN (OPTION A — SIMPLE TOKEN RETURNED)
// ------------------------------------------------------
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true, token: "ADMIN_OK" });
  }

  return res.status(401).json({ success: false, error: "Invalid credentials" });
});

// ------------------------------------------------------
// ADMIN ORDERS (REQUIRES SIMPLE TOKEN)
// ------------------------------------------------------
app.get("/api/admin/orders", (req, res) => {
  const token = req.headers["x-admin-token"];

  if (token !== "ADMIN_OK") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const file = path.join("data", "orders.json");
  const orders = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : [];

  res.json({ orders });
});

// ------------------------------------------------------
// CUSTOMER — PLACE ORDER
// ------------------------------------------------------
app.post("/api/orders", async (req, res) => {
  try {
    const order = req.body;
    if (!order.phone) return res.status(400).json({ error: "Invalid order" });

    const orderId = "ORD-" + Date.now();
    order.orderId = orderId;
    order.status = "Pending";
    order.createdAt = new Date().toISOString();

    const file = path.join("data", "orders.json");
    const orders = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : [];

    orders.push(order);
    fs.writeFileSync(file, JSON.stringify(orders, null, 2));

    res.json({ success: true, orderId });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
// CUSTOMER — PAYMENT PROOF UPLOAD
// ------------------------------------------------------
app.post("/api/payment-proof", upload.single("screenshot"), async (req, res) => {
  try {
    const { txnId = "", orderId = "" } = req.body;
    const file = req.file;

    const fileUrl = file
      ? `${req.protocol}://${req.get("host")}/uploads/${file.filename}`
      : "";

    const proofsFile = path.join("data", "payment-proofs.json");
    const proofs = fs.existsSync(proofsFile)
      ? JSON.parse(fs.readFileSync(proofsFile, "utf8"))
      : [];

    proofs.push({
      time: new Date().toISOString(),
      orderId,
      txnId,
      fileUrl
    });

    fs.writeFileSync(proofsFile, JSON.stringify(proofs, null, 2));

    res.json({ success: true, fileUrl });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
// START SERVER
// ------------------------------------------------------
const port = process.env.PORT || 7000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

