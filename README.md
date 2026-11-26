# Brian's Daybook

- **Brian's app:** an Android app for his tablet and phone. He logs blood sugar, insulin and pills, keeps a to-do list and his hobbies, and sees his appointments. It reminds him when things are due.
- **Family page:** https://michaelmullen1999.github.io/daybook/
  Deborah (iPad), Nicole and Levi (Windows) add appointments, set check times, add to-dos and see his log.

Everything runs on Portland, Oregon time.

---

## Installing on Brian's tablet (Nicole)

1. **On his tablet, open this link** in Chrome. You can text or email it to him:
   **https://github.com/michaelmullen1999/daybook/releases/latest/download/Daybook.apk**
2. **Open the download.** Chrome might warn about the file type. Tap **Download anyway**, then open it.
3. **Install.** Android asks to allow installs from Chrome. Allow it, then tap **Install**.
4. **Open Daybook.** It shows a code like `K7Q-4MX`.
5. **Connect it.** On your PC, open the family page, sign in with Google, go to **People**, type the code and click **Connect device**. The tablet opens the app by itself.
6. **Turn on reminders.**
   - When asked, allow notifications.
   - In the app, go to **Settings → Allow on-time reminders**, and switch on **Alarms & reminders**.
   - Tap **Send a test reminder**.
7. **Stop the tablet putting it to sleep.** Go to **tablet Settings → Apps → Daybook → Battery → Unrestricted**. Samsung tablets need this most.

**His phone:** do the same steps. Then, on one of the two devices, go to **Settings** (called **More** on a phone) and turn off "Send reminders on this device" so he doesn't get everything twice.

## Family page

- Open https://michaelmullen1999.github.io/daybook/ and tap **Sign in with Google**.
- **Mick** (mickmullen1999@gmail.com) can always get in.
- To add someone else, go to **People → Family who can use this page** and type their Gmail address.
- **Deborah's iPad:** open the page in Safari, then tap **Share → Add to Home Screen** so it works like an app.

## Updates

Change anything on GitHub and it rebuilds by itself, in about 5 minutes.

- **Appointments, checks and to-dos** reach his devices straight away. Nothing to install.
- **The family page** updates on its own.
- **App updates:** when his app opens, it checks for a newer version. If there is one, it shows **"An update to Daybook is ready"**. Tap **Install update**, wait for the download, tap it, then tap **Install**. His data is kept. You can also go to **Settings → Check for updates**.

## Features added
- **Reminder buttons:** pill reminders have a **Taken** button. Reading reminders have **Log it**, where he types the number. If he's already logged it recently, the app opens the normal form with the warning instead.
- **Repeats:** appointments can repeat every week, every 2 weeks or every month. To-dos can repeat every day, week, 2 weeks or month. A repeating to-do moves to its next date when it's ticked.
- **Blood sugar chart:** on the family page Overview and in his Log, for 7 or 14 days. Set his doctor's target range under **Checks → Edit**. Readings outside it show in red.

## Good to know

- Brian's app tells him who can see his log, under **Settings → Who can see this**.
- If his internet drops he can still log. It syncs when he's back online.
- "Notes to self" stay on that one device.
- The check times and warnings are only what you enter. Set them to match his doctor's advice.
- Firebase project: `brian-daybook-8f784`, owned by mickmullen1999@gmail.com. Its free plan covers this easily.
- Database rules are in `firestore.rules`. If you change them, paste them into Firebase → Firestore → Rules → Publish.
