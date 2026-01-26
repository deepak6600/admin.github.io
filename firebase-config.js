// Firebase config and initialization (ES modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getDatabase, ref, onValue, remove, update, push, set, serverTimestamp, off, get, query, orderByKey, limitToLast, endAt, onChildAdded, onChildChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";
import { getStorage, ref as storageRef, deleteObject } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// --- CONFIGURATION ---
// export const firebaseConfig = {
//   apiKey: "AIzaSyCcpgSbizPnAIfza97vwVnjZAQtoug5FuU",
//   authDomain: "famtoolapp-23028.firebaseapp.com",
//   databaseURL: "https://famtoolapp-23028-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "famtoolapp-23028",
//   storageBucket: "famtoolapp-23028.firebasestorage.app",
//   messagingSenderId: "823040432046",
//   appId: "1:823040432046:web:35389ce96ba2bdf73f1a3f"
// };

        const firebaseConfig = {
          apiKey: "AIzaSyBZ-E4_1bI4YN-1pt6xyMNXq1tOAvx0GY0",
          authDomain: "home-demo12-d5814.firebaseapp.com",
          databaseURL: "https://home-demo12-d5814-default-rtdb.firebaseio.com",
          projectId: "home-demo12-d5814",
          storageBucket: "home-demo12-d5814.appspot.com",
          messagingSenderId: "433464727867",
          appId: "1:433464727867:web:731cc791eb8d48c5d9bf1e",
          measurementId: "G-NHHB06Z9HT"
        };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

// Re-export Firebase helpers used by app logic
export { signInWithEmailAndPassword, onAuthStateChanged, signOut };
export { ref, onValue, remove, update, push, set, serverTimestamp, off, get, query, orderByKey, limitToLast, endAt, onChildAdded, onChildChanged };
export { storageRef, deleteObject };