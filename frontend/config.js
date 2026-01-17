// ============================================
// FIREBASE CONFIGURATION - GET FROM FIREBASE CONSOLE
// ============================================

// ⚠️ REPLACE THESE VALUES WITH YOUR ACTUAL FIREBASE CONFIG ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyAmuv0JOAZ2c7AXnPHqGhvCdg_n075tOp8",
  authDomain: "dh-commerce.firebaseapp.com",
  projectId: "dh-commerce",
  storageBucket: "dh-commerce.firebasestorage.app",
  messagingSenderId: "884322617632",
  appId: "1:884322617632:web:a5b48631ef3fcee332ef45"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
