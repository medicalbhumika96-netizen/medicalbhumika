import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import cors from "cors";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.static('.'));
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure uploads and data folders exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("data")) fs.mkdirSync("data");

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
// STEP 2 — Setup SendGrid API
// ======================================================
try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("✅ SendGrid API key set successfully.");
} catch (err) {
  console.error("❌ Failed to initialize SendGrid:", err.message);
}

// Reusable email sender
async function sendEmail({ to, subject, html }) {
  try {
    await sgMail.send({
      to,
      from: process.env.SMTP_FROM,
      subject,
      html,
    });
    console.log("📧 Email sent successfully to:", to);
  } catch (error) {
    console.error("❌ Email send failed:", error.response?.body || error.message);
  }
}

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

    const ordersFile = path.join("data", "orders.json");
    const orders = fs.existsSync(ordersFile)
      ? JSON.parse(fs.readFileSync(ordersFile, "utf8") || "[]")
      : [];
    orders.push(order);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));

    console.log("✅ Order saved:", orderId);

    // Send email with order details
    await sendEmail({
      to: process.env.MERCHANT_EMAIL,
      subject: `🛒 New Order Received — ${orderId}`,
      html: `
        <h2 style="color:#2b7a78">🛒 New Order from Bhumika Medical</h2>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Customer:</strong> ${order.name}</p>
        <p><strong>Phone:</strong> ${order.phone}</p>
        <p><strong>Address:</strong> ${order.address}</p>
        <h3>Items Ordered:</h3>
        <ul>
          ${(order.items || [])
            .map(i => `<li>${i.qty} × ${i.name} — ₹${i.price}</li>`)
            .join("")}
        </ul>
        <p><strong>Total:</strong> ₹${order.total}</p>
        <p><strong>Status:</strong> ${order.status}</p>
      `,
    });

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

    const proofsFile = path.join("data", "payment-proofs.json");
    const proofs = fs.existsSync(proofsFile)
      ? JSON.parse(fs.readFileSync(proofsFile, "utf8") || "[]")
      : [];
    proofs.push(proof);
    fs.writeFileSync(proofsFile, JSON.stringify(proofs, null, 2));

    console.log(`💰 Payment proof received for ${orderId}`);

    // Send email notification with proof
    await sendEmail({
      to: process.env.MERCHANT_EMAIL,
      subject: `🧾 Payment Proof Received for Order ${orderId}`,
      html: `
        <h2>Payment Proof Received</h2>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Transaction ID:</strong> ${txnId || "N/A"}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        ${fileUrl ? `<p><img src="${fileUrl}" width="250"/></p>` : ""}
      `,
    });

    res.json({ success: true, fileUrl });
  } catch (err) {
    console.error("Proof upload error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================
// TEST ROUTE: SendGrid test email
// ======================================================
app.get("/send-test-email", async (req, res) => {
  try {
    await sendEmail({
      to: process.env.MERCHANT_EMAIL,
      subject: "✅ Test Email — SendGrid API Working",
      html: "<h2>Your Render backend can now send emails successfully!</h2>",
    });
    res.json({ success: true, message: "Test email sent successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================================================
// SERVER START
// ======================================================
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

// === Added Admin & Orders API ===
const ADMIN_PASS = process.env.ADMIN_PASS || "12345";

app.post("/api/orders", (req,res)=>{
  const order=req.body;
  try{
    const orders=JSON.parse(fs.readFileSync("orders.json","utf8"));
    orders.push(order);
    fs.writeFileSync("orders.json",JSON.stringify(orders,null,2));
    res.json({success:true});
  }catch(err){
    res.status(500).json({success:false,error:err.message});
  }
});

app.post("/api/admin/login",(req,res)=>{
  if(req.body.password===ADMIN_PASS) return res.json({token:"ok"});
  res.status(401).json({error:"wrong"});
});

app.get("/api/admin/orders",(req,res)=>{
  const t=req.headers.authorization;
  if(t!=="Bearer ok") return res.status(401).json({error:"unauth"});
  const orders=JSON.parse(fs.readFileSync("orders.json","utf8"));
  res.json({orders});
});
