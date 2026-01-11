import mongoose from "mongoose";

const ReminderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    required: true
  },

  name: {
    type: String,
    default: ""
  },

  reminderDate: {
    type: Date,
    required: true
  },

  sent: {
    type: Boolean,
    default: false
  },

  type: {
    type: String,
    default: "prescription" // future use: birthday, followup, etc.
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Reminder", ReminderSchema);
