import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDhM6JQF5AOdKQNjrWZLOroLTyK5DU-sc8",
  authDomain: "inspireed-299c0.firebaseapp.com",
  projectId: "inspireed-299c0",
  storageBucket: "inspireed-299c0.firebasestorage.app",
  messagingSenderId: "1075008165154",
  appId: "1:1075008165154:web:a6ddf28869707146d9017b"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);