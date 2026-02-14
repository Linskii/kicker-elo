import { create } from "zustand";
import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { User } from "../types";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  loading: true,
  error: null,

  initialize: () => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (firebaseUser) {
        set({ firebaseUser, loading: true });

        // Subscribe to user document
        const userRef = doc(db, "users", firebaseUser.uid);
        unsubscribeUser = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              set({
                user: { uid: snapshot.id, ...snapshot.data() } as User,
                loading: false,
              });
            } else {
              set({ user: null, loading: false });
            }
          },
          (error) => {
            console.error("Error fetching user:", error);
            set({ error: error.message, loading: false });
          }
        );
      } else {
        set({ firebaseUser: null, user: null, loading: false });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  signUp: async (email, password, username) => {
    set({ loading: true, error: null });
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Create user document
      await setDoc(doc(db, "users", firebaseUser.uid), {
        username,
        elo: 1000,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const provider = new GoogleAuthProvider();
      const { user: firebaseUser } = await signInWithPopup(auth, provider);

      // Check if user document exists
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Create user document with display name or email prefix as username
        const username =
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0] ||
          "Player";
        await setDoc(userRef, {
          username,
          elo: 1000,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      set({ firebaseUser: null, user: null });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
