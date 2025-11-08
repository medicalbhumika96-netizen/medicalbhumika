// server.js
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
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g,'_')),
});
const upload = multer({ storage });

// ====== Nodemailer transporter (Gmail + App Password) ======
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ALERT_EMAIL,
    pass: process.env.ALERT_PASS,
  },
});

// basic health
app.get("/", (_, res) => res.send("OK"));

// existing prescription upload
app.post("/upload-prescription", upload.single("prescription"), (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const logLine = `${new Date().toISOString()} | PRESCRIPTION | ${name} | ${phone} | ${address} | ${fileUrl}\n`;
    fs.appendFileSync("uploads/prescriptions.log", logLine);

    res.json({ success: true, fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ====== PAYMENT PROOF upload + email alert ======
app.post("/upload-payment-proof", upload.single("paymentProof"), async (req, res) => {
  try {
    const { name = "N/A", phone = "N/A", amount = "0", method = "N/A", txnId = "N/A" } = req.body;

    // Screenshot optional
    const fileUrl = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : "No screenshot uploaded";

    const logLine = `${new Date().toISOString()} | PAYMENT | ${name} | ${phone} | ${method} | ${txnId} | ₹${amount} | ${fileUrl}\n`;
    fs.appendFileSync("uploads/payments.log", logLine);

    const mailOptions = {
      from: `"Bhumika Medical Payments" <${process.env.ALERT_EMAIL}>`,
      to: process.env.ALERT_EMAIL,
      subject: `💳 New Payment: ${name} • ₹${amount} • ${method}`,
      html: `
        <h2>New Payment Proof Received</h2>
        <ul>
          <li><b>Name:</b> ${name}</li>
          <li><b>Phone:</b> ${phone}</li>
          <li><b>Amount:</b> ₹${amount}</li>
          <li><b>Method:</b> ${method}</li>
          <li><b>Transaction ID:</b> ${txnId || "N/A"}</li>
          <li><b>Uploaded at:</b> ${new Date().toLocaleString()}</li>
        </ul>
        <p>Screenshot: <a href="${fileUrl}" target="_blank">${fileUrl}</a></p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("📧 Payment alert email sent for", name);
    res.json({ success: true, fileUrl });
  } catch (err) {
    console.error("Upload/Email error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
export default app;
