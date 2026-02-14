import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCS568F0-Yk-awbg6TifFLw-6PBeTWl8RU",
  authDomain: "kicker-elo-17ec0.firebaseapp.com",
  projectId: "kicker-elo-17ec0",
  storageBucket: "kicker-elo-17ec0.firebasestorage.app",
  messagingSenderId: "659456958810",
  appId: "1:659456958810:web:d6a7343c013c53b2941363",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
