import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createOrGetUser, getUser, deleteUser } from '../lib/firestore';
import type { AppUser } from '../types';

interface AuthContextValue {
    firebaseUser: User | null;
    appUser: AppUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInAsGuest: () => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        if (firebaseUser) {
            const u = await getUser(firebaseUser.uid);
            setAppUser(u);
        }
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user);
            if (user) {
                try {
                    const appU = await createOrGetUser(
                        user.uid,
                        user.email ?? '',
                        user.displayName ?? '',
                        user.photoURL ?? '',
                    );
                    setAppUser(appU as AppUser);
                } catch (err) {
                    console.error('Firestore createOrGetUser failed:', err);
                    setAppUser(null);
                }
            } else {
                setAppUser(null);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
    };

    const signInAsGuest = async () => {
        await signInAnonymously(auth);
    };

    const logout = async () => {
        if (appUser?.role === 'guest' && firebaseUser) {
            try {
                // Delete user info from Firestore first
                await deleteUser(firebaseUser.uid);
                // Try to delete anonymous user from Firebase Auth
                await firebaseUser.delete();
            } catch (err) {
                console.error("Failed to delete guest account upon logout:", err);
            }
        }
        await signOut(auth);
        setAppUser(null);
    };

    return (
        <AuthContext.Provider value={{ firebaseUser, appUser, loading, signInWithGoogle, signInAsGuest, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
