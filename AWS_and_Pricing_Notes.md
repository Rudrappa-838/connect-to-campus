# School Software - Business & AWS Strategy

## 1. AWS Server Setup (Current & Future)
* **Current Setup (Next 8 Days):** `t3.micro` (1GB RAM) with a 2GB Swap File. It is 100% capable of handling the 700 students for this month safely.
* **Cost this month:** $0.00 (Covered entirely by your $120 Free AWS Credits).
* **Next Month's Upgrade:** Upgrade the instance to `t3.medium` (4GB RAM) for the 3,500 total students.
* **Future AWS Cost:** ~$35/month (Still covered by your $120 credits for the next 3 months).

## 2. Pricing Strategy (What to charge schools)
Because you have a modern mobile app with **unlimited Push Notifications** (no SMS fees!), your variable costs are almost zero. You can charge a premium while keeping your AWS costs incredibly low.

### The Recommended Model: "Per Student"
* **Price:** **₹200 to ₹300 per student / per year.**
* **What's Included:** Admin Panel, Teacher App, Parent App, Live Bus Tracking, Unlimited Notifications.
* **Setup Fee:** Charge a one-time onboarding fee of **₹15,000** for importing their data and training their staff.

### Example Profit (1,000 Students):
* **Your Revenue:** ₹2,00,000 per year (₹16,600 / month)
* **Your AWS Cost:** ~₹2,900 / month (Next month)
* **Your Profit:** Massive!

## 3. Important Reminders
* When you are ready to code locally again, remember your local `.env` file needs to be updated to point to your new AWS EC2 PostgreSQL database instead of the old paused Supabase one.
