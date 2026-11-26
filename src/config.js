// Firebase project: brian-daybook-8f784 (owned by mickmullen1999@gmail.com)
// These keys are meant to be public; the database is protected by firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyCRm5ttuMrxrQBuGDdNaO1NJeJ5VO3GLk0",
  authDomain: "brian-daybook-8f784.firebaseapp.com",
  projectId: "brian-daybook-8f784",
  storageBucket: "brian-daybook-8f784.firebasestorage.app",
  messagingSenderId: "878319701719",
  appId: "1:878319701719:web:1f32df40fb171c084c2a92"
};

// Brian's time zone: Portland, Oregon (Pacific time). Both apps always use this,
// whatever the device clock is set to.
export const BRIAN_TIMEZONE = "America/Los_Angeles";

// Names that appear as quick picks for "Going with" on appointments.
export const FAMILY = ["Deborah", "Nicole", "Dan", "Andrew", "Levi"];

// Google accounts that can always open the family page. Add others on the family page (People tab).
// (Also listed in firestore.rules: keep them the same.)
export const OWNERS = ["mickmullen1999@gmail.com"];

// Shown in Brian's Settings so he knows who can see his log.
export const SHARED_WITH = "Deborah, Nicole and Levi can see your log. They add your appointments and set your check times.";

// Public key for reminders (Firebase console > Project settings > Cloud Messaging > Web Push certificates).
export const VAPID_KEY = "BDpeTaQmC97TplnO4tSlG84knhLnzMQueHzIvsV9xOYafndJiVq5IiuAMOlQNQxGE-SnaN8pjWLPD539ij2CsoQ";
