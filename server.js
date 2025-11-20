import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import cors from "cors";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// ===== CORS (no cookies required) =====
app.use(cors({
  origin: "*"
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ===== Ensure folders exist =====
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("data")) fs.mkdirSync("data");

// ===== Multer Storage =====
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ===== SendGrid Optional =====
try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} catch (e) {
  console.log("SendGrid init skipped.");
}

// =======================================================================
//  ADMIN LOGIN — Option A (Simple Token)
// =======================================================================
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ success: true, token: "ADMIN_OK" });
  }

  return res.status(401).json({ success: false, error: "Invalid credentials" });
});

// ===== Admin Authentication Middleware =====
function adminCheck(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token === "ADMIN_OK") return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// =======================================================================
// GET ALL ORDERS (Admin)
// =======================================================================
app.get("/api/admin/orders", adminCheck, (req, res) => {
  const file = path.join("data", "orders.json");
  const orders = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : [];

  res.json({ orders });
});

// =======================================================================
// UPDATE ORDER STATUS
// =======================================================================
app.post("/api/admin/orders/:id/status", adminCheck, (req, res) => {
  const file = path.join("data", "orders.json");
  const orders = JSON.parse(fs.readFileSync(file, "utf8"));

  const id = req.params.id;
  const idx = orders.findIndex((o) => o.orderId === id);

  if (idx === -1) return res.status(404).json({ error: "Order not found" });

  orders[idx].status = req.body.status;
  fs.writeFileSync(file, JSON.stringify(orders, null, 2));

  res.json({ success: true });
});

// =======================================================================
// DELETE ORDER
// =======================================================================
app.delete("/api/admin/orders/:id", adminCheck, (req, res) => {
  const file = path.join("data", "orders.json");
  let orders = JSON.parse(fs.readFileSync(file, "utf8"));

  orders = orders.filter((o) => o.orderId !== req.params.id);

  fs.writeFileSync(file, JSON.stringify(orders, null, 2));

  res.json({ success: true });
});

// =======================================================================
// EXPORT CSV
// =======================================================================
app.get("/api/admin/export", adminCheck, (req, res) => {
  const file = path.join("data", "orders.json");
  const orders = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : [];

  const csv = [
    "orderId,name,phone,address,total,status,createdAt",
    ...orders.map(
      (o) =>
        `${o.orderId},"${o.name}","${o.phone}","${o.address}",${o.total},${o.status},${o.createdAt}`
    )
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  res.send(csv);
});

// =======================================================================
// CUSTOMER — PLACE ORDER
// =======================================================================
app.post("/api/orders", (req, res) => {
  try {
    const order = req.body;

    // Use EID sent from script.js OR generate fallback
    const orderId = order.EID || ("ORD-" + Date.now());
    order.orderId = orderId;

    // Map fields for admin panel compatibility
    order.name = order.name || order.custName || "";
    order.phone = order.phone;
    order.address = order.address;
    order.pin = order.pin;

    order.createdAt = order.date || new Date().toISOString();
    order.status = "Pending";

    // Ensure total is correct
    order.total = Number(order.total) || 
      (order.items || []).reduce(
        (sum, i) => sum + Number(i.price || 0) * Number(i.qty || 0),
        0
      );

    const file = path.join("data", "orders.json");
    const orders = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : [];

    orders.push(order);
    fs.writeFileSync(file, JSON.stringify(orders, null, 2));

    res.json({ success: true, orderId });
  } catch (err) {
    console.error("Order save failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =======================================================================
// PAYMENT PROOF UPLOAD
// =======================================================================
app.post("/api/payment-proof", upload.single("screenshot"), (req, res) => {
  try {
    const { orderId, txnId } = req.body;

    const fileUrl = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : "";

    const file = path.join("data", "payment-proofs.json");
    const proofs = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : [];

    proofs.push({
      time: new Date().toISOString(),
      orderId,
      txnId,
      fileUrl
    });

    fs.writeFileSync(file, JSON.stringify(proofs, null, 2));

    res.json({ success: true, fileUrl });
  } catch (err) {
    console.error("Proof upload error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =======================================================================
// ROOT ROUTE — Required for Render health check
// =======================================================================
app.get("/", (req, res) => {
  res.send("Bhumika Medical Backend Running Successfully");
});

// =======================================================================
// START SERVER
// =======================================================================
const port = process.env.PORT || 7000;
app.listen(port, () =>
  console.log(`🚀 Server running on port ${port}`)
);
