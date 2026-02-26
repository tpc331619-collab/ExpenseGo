import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Clock } from 'lucide-react';
import './PendingPage.css';

const PendingPage: React.FC = () => {
    const { appUser, logout, refreshUser, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !appUser) navigate('/login', { replace: true });
    }, [appUser, loading, navigate]);

    return (
        <div className="pending-page">
            <div className="pending-card">
                <div className="pending-icon"><Clock size={48} strokeWidth={1.5} color="var(--purple)" /></div>
                <h2>等待帳號審核</h2>
                <p>
                    您的帳號 <strong>{appUser?.email}</strong> 已送出申請，
                    請等待管理員審核後才能使用系統。
                </p>
                <div className="pending-actions">
                    <button className="btn-outline" onClick={refreshUser}>
                        重新整理狀態
                    </button>
                    <button className="btn-ghost" onClick={logout}>
                        登出
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingPage;
