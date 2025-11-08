import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure upload folder exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ========== Multer Storage ==========
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });


// ================= EXISTING ROUTE (Prescriptions) =================
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


// ================= NEW ROUTE: PLACE ORDER =================
app.post("/api/orders", (req, res) => {
  try {
    const order = req.body;
    if (!order || !order.phone)
      return res.status(400).json({ error: "Invalid order data" });

    const orderId = "ORD-" + Date.now();
    order.orderId = orderId;
    order.status = "Pending";
    order.createdAt = new Date().toISOString();

    // Save in /data/orders.json
    if (!fs.existsSync("data")) fs.mkdirSync("data");
    const ordersFile = path.join("data", "orders.json");
    const orders = fs.existsSync(ordersFile)
      ? JSON.parse(fs.readFileSync(ordersFile, "utf8") || "[]")
      : [];
    orders.push(order);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));

    console.log("✅ Order saved:", orderId);
    res.json({ success: true, orderId });
  } catch (err) {
    console.error("Order save error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ================= NEW ROUTE: PAYMENT PROOF UPLOAD =================
app.post("/api/payment-proof", upload.single("screenshot"), (req, res) => {
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
    res.json({ success: true, fileUrl });
  } catch (err) {
    console.error("Proof upload error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ================= SERVER START =================
app.listen(process.env.PORT || 5000, () => console.log("🚀 Server running"));
