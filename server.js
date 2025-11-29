// ===============================
// Bhumika Medical Backend (FULL)
// ===============================

import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ensure folders
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("data")) fs.mkdirSync("data");

const ordersFile = path.join("data", "orders.json");

// =============== Multer =================
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// =============== Helper ================
function readOrders() {
  return fs.existsSync(ordersFile)
    ? JSON.parse(fs.readFileSync(ordersFile, "utf8") || "[]")
    : [];
}
function writeOrders(list) {
  fs.writeFileSync(ordersFile, JSON.stringify(list, null, 2));
}

// ==================================================
//    CUSTOMER — PLACE ORDER (SAVE TO orders.json)
// ==================================================
app.post("/api/orders", (req, res) => {
  const order = req.body;
  if (!order || !order.phone)
    return res.status(400).json({ error: "Invalid order data" });

  const orderId = "ORD-" + Date.now();
  order.orderId = orderId;
  order.status = "Pending";
  order.createdAt = new Date().toISOString();

  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);

  res.json({ success: true, orderId });
});

// ==================================================
//       CUSTOMER — PAYMENT PROOF UPLOAD
// ==================================================
app.post("/api/payment-proof", upload.single("screenshot"), (req, res) => {
  const { orderId, txnId = "" } = req.body;
  const fileUrl = req.file
    ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
    : "";

  const orders = readOrders();
  const idx = orders.findIndex((o) => o.orderId === orderId);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });

  orders[idx].payment = {
    method: orders[idx].paymentMethod || "UPI",
    txn: txnId,
    fileUrl,
  };

  writeOrders(orders);
  res.json({ success: true, fileUrl });
});

// ==================================================
//                ADMIN LOGIN
// ==================================================
// SIMPLE STATIC LOGIN
const ADMIN_EMAIL = "admin@bhumika.com";
const ADMIN_PASS = "123456";

app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    return res.json({ success: true, token: "MASTER_ADMIN_TOKEN_999" });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

// Middleware: verify admin token
function adminAuth(req, res, next) {
  if (req.headers["x-admin-token"] !== "MASTER_ADMIN_TOKEN_999")
    return res.status(401).json({ error: "Unauthorized" });
  next();
}
// ==================================================
//        ADMIN — FETCH ALL ORDERS (with search)
// ==================================================
app.get("/api/admin/orders", adminAuth, (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  const orders = readOrders();

  let filtered = orders;

  if (q) {
    filtered = orders.filter((o) =>
      (o.orderId || "").toLowerCase().includes(q) ||
      (o.phone || "").toLowerCase().includes(q) ||
      (o.name || "").toLowerCase().includes(q) ||
      (o.address || "").toLowerCase().includes(q)
    );
  }

  res.json({ success: true, orders: filtered.reverse() });
});

// ==================================================
//        ADMIN — UPDATE ORDER STATUS
// ==================================================
app.post("/api/admin/orders/:id/status", adminAuth, (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  const orders = readOrders();
  const idx = orders.findIndex((o) => o.orderId === orderId);
  if (idx === -1)
    return res.status(404).json({ error: "Order not found" });

  orders[idx].status = status;
  writeOrders(orders);

  res.json({ success: true });
});

// ==================================================
//        ADMIN — DELETE ORDER
// ==================================================
app.delete("/api/admin/orders/:id", adminAuth, (req, res) => {
  const orderId = req.params.id;
  const orders = readOrders();
  const newList = orders.filter((o) => o.orderId !== orderId);
  writeOrders(newList);
  res.json({ success: true });
});
// ==================================================
//          ADMIN — EXPORT ORDERS AS CSV
// ==================================================
app.get("/api/admin/export", adminAuth, (req, res) => {
  const orders = readOrders();
  
  let csv = "Order ID,Name,Phone,Address,Items,Total,Status,Created At\n";

  orders.forEach((o) => {
    const items = (o.items || [])
      .map((i) => `${i.qty}x ${i.name} (₹${i.price})`)
      .join(" | ");

    csv += `"${o.orderId}","${o.name}","${o.phone}","${o.address}","${items}","${o.total}","${o.status}","${o.createdAt}"\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  res.send(csv);
});

// ==================================================
//      CUSTOMER — UPLOAD PRESCRIPTION (EXISTING)
// ==================================================
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
    console.error("Prescription Error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ==================================================
//                ROOT TEST ROUTE
// ==================================================
app.get("/", (req, res) => {
  res.send("Bhumika Medical Backend Running ✔");
});

// ==================================================
//                START SERVER
// ==================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Bhumika Medical Backend running on port ${PORT}`)
);
