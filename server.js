import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ========== Multer Storage ==========
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ======================================================
// STEP 1 — Confirm environment variables are loaded
// ======================================================
console.log("🔍 Checking environment variables...");
console.log({
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? "✅ Loaded" : "❌ Missing",
  SMTP_FROM: process.env.SMTP_FROM,
  MERCHANT_EMAIL: process.env.MERCHANT_EMAIL,
  PORT: process.env.PORT,
});
console.log("----------------------------------------------------");

// ======================================================
// STEP 2 — Setup SendGrid transporter
// ======================================================
const transporter = nodemailer.createTransport({
  service: "SendGrid",
  auth: {
    user: "apikey", // literally the word "apikey"
    pass: process.env.SENDGRID_API_KEY,
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ SendGrid connection failed:", error.message);
  } else {
    console.log("✅ SendGrid connection ready to send emails.");
  }
});

// ======================================================
// STEP 3 — Debug route to confirm ENV on Render
// ======================================================
app.get("/debug-env", (req, res) => {
  res.json({
    from: process.env.SMTP_FROM,
    email: process.env.MERCHANT_EMAIL,
    sendgrid: !!process.env.SENDGRID_API_KEY,
  });
});

// ======================================================
// ROUTE: Upload Prescription
// ======================================================
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
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ======================================================
// ROUTE: Place Order (with email)
// ======================================================
app.post("/api/orders", async (req, res) => {
  try {
    const order = req.body;
    if (!order || !order.phone)
      return res.status(400).json({ error: "Invalid order data" });

    const orderId = "ORD-" + Date.now();
    order.orderId = orderId;
    order.status = "Pending";
    order.createdAt = new Date().toISOString();

    if (!fs.existsSync("data")) fs.mkdirSync("data");
    const ordersFile = path.join("data", "orders.json");
    const orders = fs.existsSync(ordersFile)
      ? JSON.parse(fs.readFileSync(ordersFile, "utf8") || "[]")
      : [];
    orders.push(order);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));

    console.log("✅ Order saved:", orderId);

    // Try to send order email
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: process.env.MERCHANT_EMAIL,
        subject: `🛒 New Order Received — ${orderId}`,
        html: `
          <h2>New Order Received</h2>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Customer:</strong> ${order.name}</p>
          <p><strong>Phone:</strong> ${order.phone}</p>
          <p><strong>Address:</strong> ${order.address}</p>
          <pre>${JSON.stringify(order.items || [], null, 2)}</pre>
        `,
      });
      console.log("📧 Order email sent successfully to:", process.env.MERCHANT_EMAIL);
    } catch (emailErr) {
      console.error("❌ Order email send failed:", emailErr.message);
    }

    res.json({ success: true, orderId });
  } catch (err) {
    console.error("Order save error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================
// ROUTE: Payment Proof Upload (with email)
// ======================================================
app.post("/api/payment-proof", upload.single("screenshot"), async (req, res) => {
  try {
    const { txnId = "", orderId = "" } = req.body;
    const file = req.file;
    const fileUrl = file
      ? `${req.protocol}://${req.get("host")}/uploads/${file.filename}`
      : "";

    const proof = {
      time: new Date().toISOString(),
      orderId,
      txnId,
      fileUrl,
    };

    if (!fs.existsSync("data")) fs.mkdirSync("data");
    const proofsFile = path.join("data", "payment-proofs.json");
    const proofs = fs.existsSync(proofsFile)
      ? JSON.parse(fs.readFileSync(proofsFile, "utf8") || "[]")
      : [];
    proofs.push(proof);
    fs.writeFileSync(proofsFile, JSON.stringify(proofs, null, 2));

    console.log(`💰 Payment proof received for ${orderId}`);

    // Try to send proof email
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: process.env.MERCHANT_EMAIL,
        subject: `🧾 Payment Proof Received for Order ${orderId}`,
        html: `
          <h2>Payment Proof Received</h2>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Transaction ID:</strong> ${txnId || "N/A"}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          ${fileUrl ? `<p><img src="${fileUrl}" width="200"/></p>` : ""}
        `,
      });
      console.log("📧 Payment proof email sent successfully to:", process.env.MERCHANT_EMAIL);
    } catch (emailErr) {
      console.error("❌ Payment proof email send failed:", emailErr.message);
    }

    res.json({ success: true, fileUrl });
  } catch (err) {
    console.error("Proof upload error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================
// SERVER START
// ======================================================
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
