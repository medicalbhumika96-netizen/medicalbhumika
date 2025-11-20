import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import cors from "cors";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// ===== CORS (NO COOKIES NEEDED) =====
app.use(cors({
  origin: "*"
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ===== Ensure folders =====
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("data")) fs.mkdirSync("data");

// ===== Multer upload =====
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ===== SendGrid =====
try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} catch (err) {
  console.log("SendGrid init failed");
}

// ===== OPTION-A: SIMPLE ADMIN LOGIN =====
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

// ===== Middleware for token auth =====
function adminCheck(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token === "ADMIN_OK") return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// ===== Admin Get Orders =====
app.get("/api/admin/orders", adminCheck, (req, res) => {
  const file = path.join("data", "orders.json");
  const orders = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : [];
  res.json({ orders });
});

// ===== Update Order Status =====
app.post("/api/admin/orders/:id/status", adminCheck, (req, res) => {
  const file = path.join("data", "orders.json");
  let orders = JSON.parse(fs.readFileSync(file, "utf8"));

  const id = req.params.id;
  const idx = orders.findIndex((o) => o.orderId === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  orders[idx].status = req.body.status;
  fs.writeFileSync(file, JSON.stringify(orders, null, 2));

  res.json({ success: true });
});

// ===== Delete Order =====
app.delete("/api/admin/orders/:id", adminCheck, (req, res) => {
  const file = path.join("data", "orders.json");
  let orders = JSON.parse(fs.readFileSync(file, "utf8"));

  orders = orders.filter((o) => o.orderId !== req.params.id);
  fs.writeFileSync(file, JSON.stringify(orders, null, 2));

  res.json({ success: true });
});

// ===== Export CSV =====
app.get("/api/admin/export", adminCheck, (req, res) => {
  const file = path.join("data", "orders.json");
  const orders = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : [];

  const csv = [
    "orderId,name,phone,address,total,status,createdAt",
    ...orders.map((o) =>
      `${o.orderId},"${o.name}","${o.phone}","${o.address}",${o.total},${o.status},${o.createdAt}`
    )
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  res.send(csv);
});

// ===== Customer Place Order =====
app.post("/api/orders", (req, res) => {
  try {
    const order = req.body;

    const orderId = "ORD-" + Date.now();
    order.orderId = orderId;
    order.status = "Pending";
    order.createdAt = new Date().toISOString();

    // Auto-calc total
    order.total = (order.items || []).reduce(
      (sum, i) => sum + i.price * i.qty,
      0
    );

    const file = path.join("data", "orders.json");
    const orders = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : [];

    orders.push(order);
    fs.writeFileSync(file, JSON.stringify(orders, null, 2));

    res.json({ success: true, orderId });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== Payment Proof Upload =====
app.post(
  "/api/payment-proof",
  upload.single("screenshot"),
  (req, res) => {
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
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ===== Root route for Render health check =====
app.get("/", (req, res) => {
  res.send("Bhumika Medical Backend Running Successfully");
});

// ===== Start Server on Render PORT =====
const port = process.env.PORT || 7000;
app.listen(port, () =>
  console.log(`🚀 Server running on port ${port}`)
);
