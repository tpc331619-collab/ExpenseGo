import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getAllUsers } from '../lib/firestore';
import { LayoutDashboard, FileText, BarChart3, Database } from 'lucide-react';
import './Navbar.css';

const Navbar: React.FC = () => {
    const { appUser, logout } = useAuth();
    const { selectedYear, setSelectedYear, compareYear, setCompareYear } = useApp();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (appUser?.role !== 'admin') return;
        getAllUsers().then((users) => {
            setPendingCount(users.filter((u) => u.role === 'pending').length);
        });
    }, [appUser]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { to: '/', label: '總覽', icon: <LayoutDashboard size={18} />, exact: true, badge: 0 },
        { to: '/purchases', label: '採購紀錄', icon: <FileText size={18} />, exact: false, badge: 0 },
        { to: '/report', label: '年度報表', icon: <BarChart3 size={18} />, exact: false, badge: 0 },
        { to: '/admin', label: '管理', icon: <Database size={18} />, exact: false, badge: appUser?.role === 'admin' ? pendingCount : 0 },
    ];

    return (
        <>
            <nav className="navbar">
                <div className="nav-brand">
                    <div className="nav-logo-text">
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

                    {/* Comparison Year Selector */}
                    <div className="nav-selector-item compare">
                        <span className="nav-selector-label">對比</span>
                        <select
                            className="year-select-premium compare"
                            value={compareYear || ''}
                            onChange={(e) => setCompareYear(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">(無)</option>
                            {Array.from({ length: 5 }, (_, i) => 2024 + i)
                                .filter(y => y !== selectedYear)
                                .map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))
                            }
                        </select>
                    </div>
                </div>

                <div className="nav-right-actions desktop-only">
                    <div className="nav-user">
                        <img src={appUser?.photoURL || ''} className="nav-avatar" alt={appUser?.displayName} />
                        <span className="nav-name">{appUser?.displayName}</span>
                        {appUser?.role === 'admin' && <span className="role-badge admin">Admin</span>}
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
                            <div>
                                <div className="nav-name">{appUser?.displayName}</div>
                                <div className="nav-email">{appUser?.email}</div>
                            </div>
                            {appUser?.role === 'admin' && <span className="role-badge admin">Admin</span>}
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
