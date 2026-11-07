// Satu pintu import Firebase SDK (CDN). Modul lain import dari sini.
export { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
export { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
export { getDatabase, ref, set, get, onValue, remove, update } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
