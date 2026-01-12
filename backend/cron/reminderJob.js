import cron from "node-cron";
import Reminder from "../models/Reminder.js";

/*
  Runs every day at 10:00 AM (India time)
*/
export function startReminderCron() {
  cron.schedule(
    "0 10 * * *",
    async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueReminders = await Reminder.find({
          sent: false,
          reminderDate: { $lte: today },
          type: "prescription"
        });

        if (!dueReminders.length) {
          console.log("🔔 No reminders due today");
          return;
        }

        for (const r of dueReminders) {
          // ⚠️ Browser WhatsApp auto-send not possible
          // Here we only MARK AS SENT
          // Actual WhatsApp sending can be integrated later (Twilio / WhatsApp Cloud API)

          await Reminder.findByIdAndUpdate(r._id, {
            sent: true,
            sentAt: new Date()
          });

          console.log(
            `✅ Reminder marked sent | ${r.phone} | Order ${r.orderId}`
          );
        }

      } catch (err) {
        console.error("❌ Reminder Cron Error:", err);
      }
    },
    {
      timezone: "Asia/Kolkata"
    }
  );

  console.log("⏰ Prescription Reminder Cron Started (10 AM daily)");
}
