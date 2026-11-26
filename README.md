# Daybook 🐼

Deborah's app for looking after Brian. It replaces the post-it notes and Google Docs.

**Open it:** https://michaelmullen1999.github.io/daybook/

Everything runs on Portland, Oregon time. Deborah, Nicole and Levi all see the same information, kept in sync.

## What it does
- **Today:** what's due now, what was missed, pinned notes, coming appointments, today's diary and to-dos.
- **Pills and insulin:** tap **Log** to record a dose or reading. It warns you if it was already logged recently, so he can't get a double dose by mistake.
- **Appointments:** one-off or repeating (every week, every 2 weeks or every month).
- **Notes:** quick post-it notes. Pin the important ones to Today. Tick them off when done.
- **Diary:** how Brian was each day: mood, sleep, eating, anything unusual, and notes. **Copy last 30 days** to send to his doctor.
- **Care info:** allergies, conditions, medicines, doctors and contacts (tap a number to call), insurance and other important things. **Print or share** it for a doctor, nurse or helper.
- **To-do:** one-off or repeating.
- **Log:** blood sugar chart with his doctor's target range, and the full history.
- **Setup:** pill and check times, who can use the app, and light or dark mode.

## Put it on Deborah's iPad or iPhone (2 minutes)
1. Open **https://michaelmullen1999.github.io/daybook/** in **Safari**.
2. Tap **Share** (the square with the arrow), then **Add to Home Screen**, then **Add**.
3. Open **Daybook** from the home screen. It has the panda icon.
4. Tap **Sign in with Google** and use her Gmail.

The home-screen app has its own sign-in, so she must sign in from the home-screen icon once, even if she's already signed in to Safari.

**Before she signs in:** Mick (mickmullen1999@gmail.com) must add her Gmail under **Setup → Family who can use this app**.

## On a PC (Nicole, Levi)
Open the same link in Chrome or Edge and sign in with Google. Bookmark it. Chrome and Edge can also install it as an app, from the install icon in the address bar.

## Reminders
It shows what's due and what was missed whenever it's open. It can't alert her when it's closed. Keep phone alarms for the key times, or ask for push reminders to be added. That needs Firebase's pay-as-you-go plan, about pennies a month.

## Updates
Changes made on GitHub rebuild the app automatically in about 5 minutes. Everyone gets them next time they open it.

## Technical notes
- Firebase project `brian-daybook-8f784` (owner mickmullen1999@gmail.com), free plan.
- Database rules are in `firestore.rules`. If you change them, paste them into Firebase → Firestore → Rules → Publish.
- Brian's own Android app (`/me/`, APK) is retired. The code still builds but isn't needed.
