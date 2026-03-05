import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getAllUsers } from '../lib/firestore';
import { LayoutDashboard, FileText, BarChart3, Database, RefreshCw, NotebookPen } from 'lucide-react';
import Logo from './Logo';
import './Navbar.css';

const Navbar: React.FC = () => {
    const { appUser, logout } = useAuth();
    const { selectedYear, setSelectedYear, refreshPurchases, refreshLedgerAccounts, refreshVendors } = useApp();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (appUser?.role !== 'admin') return;
        getAllUsers().then((users) => {
            setPendingCount(users.filter((u) => u.role === 'pending').length);
        });
    }, [appUser]);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                refreshPurchases(),
                refreshLedgerAccounts(),
                refreshVendors()
            ]);
        } finally {
            setTimeout(() => setIsRefreshing(false), 500); // give visual feedback
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { to: '/', label: '總覽', icon: <LayoutDashboard size={18} />, exact: true, badge: 0 },
        { to: '/purchases', label: '紀錄', icon: <FileText size={18} />, exact: false, badge: 0 },
        { to: '/report', label: '報表', icon: <BarChart3 size={18} />, exact: false, badge: 0 },
        { to: '/admin', label: '管理', icon: <Database size={18} />, exact: false, badge: appUser?.role === 'admin' ? pendingCount : 0 },
        { to: '/contracts', label: '契約', icon: <NotebookPen size={18} />, exact: false, badge: 0 },
    ];

    return (
        <>
            <nav className="navbar">
                <div className="nav-brand">
                    <Logo className="brand-svg" width={32} height={32} />
                    <div className="nav-logo-text" style={{ marginLeft: '8px' }}>
                        <span className="logo-main">Purchase</span>
                        <span className="logo-sub">Go</span>
                    </div>
                </div>

                {/* Global Year Selector */}
                <div className="nav-year-container">
                    <div className="nav-selector-item">
                        <span className="nav-selector-label">年度</span>
                        <select
                            className="year-select-premium"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                        >
                            {Array.from({ length: 5 }, (_, i) => 2024 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="nav-links desktop-only">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.exact}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                            {'badge' in item && item.badge > 0 && (
                                <span className="nav-badge">{item.badge}</span>
                            )}
                        </NavLink>
                    ))}

                    <button
                        className={`nav-refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
                        onClick={handleRefresh}
                        title="重新載入資料"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>

                <div className="nav-right-actions desktop-only">
                    <div className="nav-user">
                        <img src={appUser?.photoURL || ''} className="nav-avatar" alt={appUser?.displayName} />
                        <button className="nav-logout" onClick={handleLogout}>登出</button>
                    </div>
                </div>

                <button className="hamburger" onClick={() => setMenuOpen((v) => !v)}>
                    <span /><span /><span />
                </button>
            </nav>

            {/* Mobile menu */}
            {menuOpen && (
                <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
                    <div className="mobile-menu-inner" onClick={(e) => e.stopPropagation()}>
                        <div className="mobile-user-info">
                            <img src={appUser?.photoURL || ''} className="nav-avatar" alt="" />
                        </div>
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.exact}
                                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => setMenuOpen(false)}
                            >
                                <span>{item.icon}</span>
                                {item.label}
                            </NavLink>
                        ))}
                        <button className="btn-outline mobile-logout" onClick={handleLogout}>登出</button>
                    </div>
                </div>
            )}

            {/* Bottom nav for mobile */}
            <div className="bottom-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.exact}
                        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span className="bottom-icon">{item.icon}</span>
                        <span className="bottom-label">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </>
    );
};

export default Navbar;
