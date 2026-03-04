import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase.ts';
import type { User } from '../types/index.ts';

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
}

function createUserDoc(uid: string, username: string): Omit<User, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } {
  return {
    uid,
    username,
    attackElo: 1000,
    defenseElo: 1000,
    soloElo: 1000,
    wins: 0,
    losses: 0,
    careerWins: 0,
    careerLosses: 0,
    teamRanked: false,
    soloRanked: false,
    eloHistory: [],
    createdAt: serverTimestamp(),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  loading: true,

  initialize: () => {
    let unsubUser: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      if (firebaseUser) {
        set({ firebaseUser });
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            set({ user: { ...snap.data(), uid: snap.id } as User, loading: false });
          } else {
            set({ user: null, loading: false });
          }
        });
      } else {
        set({ user: null, firebaseUser: null, loading: false });
      }
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
    };
  },

  signIn: async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  },

  signUp: async (email, password, username) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), createUserDoc(cred.user.uid, username));
  },

  signInWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const userRef = doc(db, 'users', cred.user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const username = cred.user.displayName ?? cred.user.email?.split('@')[0] ?? 'Player';
      await setDoc(userRef, createUserDoc(cred.user.uid, username));
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null, firebaseUser: null });
  },

  updateUsername: async (newUsername) => {
    const user = get().user;
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { username: newUsername });
  },
}));
