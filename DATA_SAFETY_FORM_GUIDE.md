# 📋 Data Safety Form Guide - C2C App

## 🎯 Quick Reference for Google Play Console

**Use this guide while filling out the Data Safety form in Play Console**

---

## SECTION 1: Does your app collect or share data?

**Answer:** ✅ **YES**

---

## SECTION 2: What data types are collected?

### ✅ CHECK THESE DATA TYPES:

#### 📍 Location
- ✅ **Approximate location** - YES
- ✅ **Precise location** - YES

#### 👤 Personal Info
- ✅ **Name** - YES
- ✅ **Email address** - YES
- ✅ **User IDs** - YES
- ✅ **Phone number** - YES
- ❌ Address - NO
- ❌ Race and ethnicity - NO
- ❌ Political or religious beliefs - NO
- ❌ Sexual orientation - NO
- ❌ Other info - NO

#### 💰 Financial Info
- ✅ **User payment info** - YES
- ❌ Purchase history - NO
- ❌ Credit score - NO
- ❌ Other financial info - NO

#### 📊 App Activity
- ✅ **App interactions** - YES
- ❌ In-app search history - NO
- ❌ Installed apps - NO
- ❌ Other user-generated content - NO
- ❌ Other actions - NO

#### 📱 Device or Other IDs
- ✅ **Device or other IDs** - YES (for push notifications)

#### ❌ NOT COLLECTED:
- Files and docs - NO
- Calendar events - NO
- Contacts - NO
- Photos - NO
- Videos - NO
- Audio files - NO

---

## SECTION 3: For Each Data Type Selected

### For ALL data types EXCEPT "Device IDs":

**Q1: Is this data collected, shared, or both?**
- ✅ Collected
- ❌ Shared

**Q2: Is this data processed ephemerally?**
- ❌ NO

**Q3: Is this data required or optional?**
- ✅ Required (for most)
- ✅ Optional (only for: Phone number if not mandatory, Location if only for fleet tracking)

**Q4: Why is this data collected?** (select reasons)
- ✅ App functionality
- ✅ Account management (for Name, Email, User IDs, Phone)
- ❌ Analytics (unless you track analytics)
- ❌ Advertising or marketing
- ❌ Fraud prevention

---

### For "Device or Other IDs" (FCM tokens):

**Q1: Is this data collected, shared, or both?**
- ✅ Collected
- ✅ Shared (with Firebase Cloud Messaging)

**Q2: Is this data processed ephemerally?**
- ❌ NO

**Q3: Is this data required or optional?**
- ✅ Required

**Q4: Why is this data collected?**
- ✅ App functionality (push notifications)
- ❌ Analytics
- ❌ Advertising or marketing

---

## SECTION 4: Data Security

**Q: Is all user data encrypted in transit?**
- ✅ **YES**

Explanation: "All data is transmitted over HTTPS/SSL encrypted connections between the mobile app and AWS backend servers."

**Q: Do you provide a way for users to request data deletion?**
- ✅ **YES** (recommended)

Explanation: "Users can request data deletion by contacting their school administrator or by emailing support@connect2campus.com. Data will be deleted within 30 days of the request, subject to legal retention requirements for academic records."

---

## SECTION 5: Privacy Policy

**Q: Privacy Policy URL**

**For now (if domain not purchased yet):**
- Leave blank and come back later
- OR enter temporary URL

**Before Feb 17:**
- Enter: `https://connect2campus.com/privacy-policy`
- (Replace with your actual domain once purchased)

---

## 📊 QUICK SUMMARY

### Data Collected:
1. **Location** (for fleet tracking)
2. **Name** (students, staff, parents)
3. **Email** (for login)
4. **User IDs** (student ID, staff ID)
5. **Phone Number** (contact info)
6. **Payment Info** (fees, hostel dues)
7. **App Interactions** (attendance, marks viewing)
8. **Device IDs** (for push notifications via Firebase)

### How Data is Used:
- **Primary Purpose:** App functionality (school management)
- **Security:** Encrypted in transit (HTTPS)
- **Sharing:** Only Device IDs shared with Firebase for notifications
- **Deletion:** Users can request deletion

### Third-Party Services:
- **Firebase Cloud Messaging** (for push notifications)
- **AWS** (for backend hosting - not considered "sharing" as it's your infrastructure)

---

## ✅ CHECKLIST BEFORE SUBMITTING:

- [ ] All 8 data types selected correctly
- [ ] For each data type, answered all 4 questions
- [ ] Marked data as "Collected" (and "Shared" only for Device IDs)
- [ ] Selected "App functionality" as primary purpose
- [ ] Confirmed encryption in transit = YES
- [ ] Added data deletion option = YES
- [ ] Privacy Policy URL added (or plan to add before Feb 17)
- [ ] Reviewed all answers for accuracy
- [ ] Saved the form

---

## 🎯 TIPS:

1. **Save as draft frequently** - Don't lose your progress
2. **You can edit later** - Don't stress about perfection
3. **Must be complete before Feb 17** - But you can update anytime
4. **Be honest** - Accurately represent what data you collect
5. **Privacy Policy URL** - Can be added later (before production submission)

---

## ❓ COMMON QUESTIONS:

**Q: What if I'm not sure about a data type?**
A: When in doubt, include it. Better to over-disclose than under-disclose.

**Q: Can I change this later?**
A: YES! You can edit the Data Safety form anytime, even after production.

**Q: What if I don't have Privacy Policy URL yet?**
A: You can leave it blank now and add it before Feb 17 production submission.

**Q: Should I mark data as "Optional" or "Required"?**
A: Mark as "Required" if users can't use the app without providing it.

**Q: Do I need to disclose AWS hosting?**
A: NO - AWS is your infrastructure/service provider, not a third-party data recipient.

**Q: Should I list Firebase?**
A: YES - For Device IDs (FCM tokens), mark as "Collected and Shared" with Firebase.

---

## 📞 STUCK? NEED HELP?

If you get stuck on any question:
1. Take a screenshot
2. Show me the question
3. I'll tell you exactly what to select!

---

**Good luck! You've got this!** 🚀

**Estimated time:** 20-30 minutes

---

**Created:** February 4, 2026  
**For:** C2C (Connect to Campus) App  
**Purpose:** Google Play Console Data Safety Form Preparation
