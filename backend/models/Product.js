import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String },
  mrp: { type: Number },
  image: { type: String, default: "/img/placeholders/medicine.png" },
  imageType: { type: String, enum: ["real", "placeholder"], default: "placeholder" }
}, { timestamps: true });

export default mongoose.model("Product", ProductSchema);
