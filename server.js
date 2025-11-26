import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import cors from "cors";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure uploads & data folders exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("data")) fs.mkdirSync("data");

// ========== MULTER ==========
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ========== SENDGRID ==========
try {
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log("✅ SendGrid API Ready");
  }
} catch (e) {
  console.log("⚠️ SendGrid failed:", e.message);
}

async function sendEmail({ to, subject, html }) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log("⚠️ No SendGrid key — skipping email");
      return;
    }
    await sgMail.send({
      to,
      from: process.env.SMTP_FROM,
      subject,
      html
    });
    console.log("📧 Email sent:", to);
  } catch (err) {
    console.log("❌ Email Error:", err.message);
  }
}

// =====================================================
// 📌 UPLOAD PRESCRIPTION
// =====================================================
app.post("/upload-prescription", upload.single("prescription"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file" });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    fs.appendFileSync("uploads/prescriptions.log",
      `${new Date().toISOString()} | ${fileUrl}\n`
    );

    res.json({ success: true, fileUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// =====================================================
// 📌 CUSTOMER ORDER (SAVE + EMAIL)
// =====================================================
app.post("/api/orders", async (req, res) => {
  try {
    const order = req.body;
    if (!order || !order.phone) {
      return res.status(400).json({ error: "Invalid order" });
    }

    const orderId = "ORD-" + Date.now();

    order.orderId = orderId;
    order.status = "Pending";
    order.createdAt = new Date().toISOString();

    const file = "data/orders.json";
    const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];

    old.push(order);
    fs.writeFileSync(file, JSON.stringify(old, null, 2));

    console.log("🟢 Order Saved:", orderId);

    // Email notification
    await sendEmail({
      to: process.env.MERCHANT_EMAIL,
      subject: `🛒 New Order — ${orderId}`,
      html: `
        <h2>New Order</h2>
        <p><b>Name:</b> ${order.name}</p>
        <p><b>Phone:</b> ${order.phone}</p>
        <p><b>Address:</b> ${order.address}</p>
        <p><b>Total:</b> ₹${order.total}</p>
      `
    });

    res.json({ success: true, orderId });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// =====================================================
// 📌 PAYMENT PROOF
// =====================================================
app.post("/api/payment-proof", upload.single("screenshot"), async (req, res) => {
  try {
    const { txnId = "", orderId = "" } = req.body;
    const fileUrl = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : "";

    const proof = {
      time: new Date().toISOString(),
      orderId,
      txnId,
      fileUrl
    };

    const file = "data/payment-proofs.json";
    const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
    old.push(proof);
    fs.writeFileSync(file, JSON.stringify(old, null, 2));

    console.log("🟢 Payment Proof for:", orderId);

    res.json({ success: true, fileUrl });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// =====================================================
// 📌 ADMIN LOGIN
// =====================================================
const ADMIN_TOKEN = "ADMIN_OK";

app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD) {
    return res.json({ token: ADMIN_TOKEN });
  }

  return res.status(401).json({ error: "Invalid email or password" });
});

// Middleware
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token === ADMIN_TOKEN) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// =====================================================
// 📌 ADMIN — LIST ORDERS
// =====================================================
app.get("/api/admin/orders", requireAdmin, (req, res) => {
  try {
    const file = "data/orders.json";
    const orders = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
    res.json({ orders });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// =====================================================
// 📌 ADMIN — UPDATE STATUS
// =====================================================
app.post("/api/admin/orders/:id/status", requireAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    const file = "data/orders.json";
    const orders = JSON.parse(fs.readFileSync(file));
    const idx = orders.findIndex(o => o.orderId === id);

    if (idx === -1) return res.status(404).json({ error: "Not found" });

    orders[idx].status = status;
    fs.writeFileSync(file, JSON.stringify(orders, null, 2));

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// =====================================================
// 📌 ADMIN — DELETE ORDER
// =====================================================
app.delete("/api/admin/orders/:id", requireAdmin, (req, res) => {
  try {
    const id = req.params.id;

    const file = "data/orders.json";
    const orders = JSON.parse(fs.readFileSync(file));
    const filtered = orders.filter(o => o.orderId !== id);

    fs.writeFileSync(file, JSON.stringify(filtered, null, 2));

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// =====================================================
// 📌 ADMIN — EXPORT CSV
// =====================================================
app.get("/api/admin/export", requireAdmin, (req, res) => {
  try {
    const file = "data/orders.json";
    const orders = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];

    const rows = [];
    rows.push("orderId,name,phone,address,total,status,createdAt");

    orders.forEach(o => {
      rows.push(
        `${o.orderId},"${o.name}","${o.phone}","${o.address}",${o.total},${o.status},${o.createdAt}`
      );
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
    res.send(rows.join("\n"));

  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// =====================================================
// START SERVER
// =====================================================
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
