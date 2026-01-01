import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    orderId: String,
    name: String,
    phone: String,
    address: String,
    pin: String,

    items: [
      {
        name: String,
        price: Number,
        qty: Number,
      },
    ],

    total: Number,
    discount: Number,
    status: { type: String, default: "Pending" },

    payment: {
      method: String,
      txn: String,
      amount: String,
      fileUrl: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);
