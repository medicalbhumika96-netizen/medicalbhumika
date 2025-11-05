import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Log every submission
app.post("/upload-prescription", upload.single("prescription"), (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const logLine = `${new Date().toISOString()} | ${name} | ${phone} | ${address} | ${fileUrl}\n`;
    fs.appendFileSync("uploads/prescriptions.log", logLine);   // 🔹 You can read this file anytime.

    res.json({ success: true, fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.listen(process.env.PORT || 5000, () => console.log("🚀 Server running"));
