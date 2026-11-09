
/* Initialize the Firebase app IMMEDIATELY with your config,
   before any other code runs. Idempotent — safe to call even
   if the base app tries to initialize again later. */
(function initFirebaseEarly(){
  'use strict';
  const cfg = {
    apiKey: "AIzaSyA5q8qi2CuvXID-Yl8up16i9OLh0xp8Gv4",
    authDomain: "safwat-recruitment-toolkit.firebaseapp.com",
    databaseURL: "https://safwat-recruitment-toolkit-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "safwat-recruitment-toolkit",
    storageBucket: "safwat-recruitment-toolkit.firebasestorage.app",
    messagingSenderId: "147799261926",
    appId: "1:147799261926:web:be92952754c35e180af127",
    measurementId: "G-RPPEKC31DT"
  };
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    // Verify all three subsystems are accessible
    firebase.auth();
    firebase.database();
    console.log('%c✓ Firebase pre-initialized (auth + db ready)', 'color:#3F6C4D;font-weight:bold');
  } catch (e) {
    console.error('Firebase early-init failed:', e);
  }
})();
