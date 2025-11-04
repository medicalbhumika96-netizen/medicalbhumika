// ====== server.js (Simple working version) ======
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure uploads folder exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// ===== Multer setup =====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ===== Upload route =====
app.post("/upload-prescription", upload.single("prescription"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { name, phone } = req.body;
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const time = new Date().toLocaleString();

    // Log info in uploads/prescriptions.log
    const logLine = `${time} | ${name} | ${phone} | ${fileUrl}\n`;
    fs.appendFileSync("uploads/prescriptions.log", logLine);

    console.log("📄 New Prescription:", logLine);

    res.json({
      message: "Prescription uploaded successfully!",
      name,
      phone,
      fileUrl,
      time,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});
