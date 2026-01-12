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

  type: {
    type: String,
    default: "prescription"
  },

  sent: {
    type: Boolean,
    default: false
  },

  sentAt: {
    type: Date
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Optional performance index
ReminderSchema.index({ sent: 1, reminderDate: 1 });

export default mongoose.model("Reminder", ReminderSchema);
