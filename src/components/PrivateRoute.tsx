import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
    requireAdmin?: boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ requireAdmin = false }) => {
    const { appUser, loading } = useAuth();

    if (loading) {
        return (
            <div className="full-loading">
                <div className="spinner" />
            </div>
        );
    }

    if (!appUser) return <Navigate to="/login" replace />;
    if (appUser.role === 'pending') return <Navigate to="/pending" replace />;
    if (appUser.role === 'rejected') return <Navigate to="/login" replace />;
    if (requireAdmin && appUser.role !== 'admin') return <Navigate to="/" replace />;

    return <Outlet />;
};

export default PrivateRoute;
