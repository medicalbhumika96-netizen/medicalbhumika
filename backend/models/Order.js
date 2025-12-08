import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  name: String,
  phone: String,
  address: String,
  products: Array,
  total: Number,
  status: { type: String, default: "Pending" },
  payment: {
    txn: String,
    fileUrl: String,
    method: String
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Order", orderSchema);
