import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createOrGetUser, getUser } from '../lib/firestore';
import type { AppUser } from '../types';

interface AuthContextValue {
    firebaseUser: User | null;
    appUser: AppUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
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
        await signInWithPopup(auth, provider);
    };

    const logout = async () => {
        await signOut(auth);
        setAppUser(null);
    };

    return (
        <AuthContext.Provider value={{ firebaseUser, appUser, loading, signInWithGoogle, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
