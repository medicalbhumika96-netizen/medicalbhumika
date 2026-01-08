import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },

  // ✅ OPTIONAL client-side reference (NOT real order id)
  clientRef: {
    type: String,
    default: null
  },

  phone: {
    type: String,
    required: true
  },

  name: {
    type: String,
    required: true
  },

  address: {
    type: String,
    required: true
  },

  pin: {
    type: String,
    required: true
  },

  items: {
    type: Array,
    required: true
  },

  total: {
    type: Number,
    required: true
  },

  discount: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    default: "Pending"
  },

  payment: {
    txn: String,
    screenshot: String,
    method: String,
    amount: String
  },

  prescription: {
    file: String,
    uploadedAt: Date
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// auto-update updatedAt
OrderSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Order", OrderSchema);
