import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

const LoginPage: React.FC = () => {
    const { signInWithGoogle, appUser, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!appUser) return;
        if (appUser.role === 'pending') navigate('/pending', { replace: true });
        else navigate('/', { replace: true });
    }, [appUser, authLoading, navigate]);

    const handleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (e: unknown) {
            setError('登入失敗，請再試一次');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-bg" />
            <div className="login-card">
                <div className="login-logo">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <rect width="48" height="48" rx="14" fill="url(#grad)" />
                        <path d="M14 34V18l10-6 10 6v16" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
                        <path d="M20 34v-8h8v8" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
                        <circle cx="34" cy="14" r="6" fill="#FFD700" />
                        <path d="M32 14l1.5 1.5L36 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <defs>
                            <linearGradient id="grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#6366f1" />
                                <stop offset="1" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <h1 className="login-title">PurchaseGo</h1>
                <p className="login-subtitle">採購紀錄管理系統</p>

                {error && <div className="login-error">{error}</div>}

                <button className="google-btn" onClick={handleLogin} disabled={loading}>
                    {loading ? (
                        <span className="btn-spinner" />
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 48 48">
                            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                        </svg>
                    )}
                    {loading ? '登入中⋯' : '使用 Google 帳號登入'}
                </button>

                <p className="login-note">登入後需等待管理員審核才能使用系統</p>
            </div>
        </div>
    );
};

export default LoginPage;
