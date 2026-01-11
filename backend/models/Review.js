import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String },
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Review", reviewSchema);
