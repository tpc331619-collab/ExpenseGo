import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getAllUsers, updateNotebookEntry, deleteNotebookEntry } from '../lib/firestore';
import { LayoutDashboard, FileText, BarChart3, Database, RefreshCw, NotebookPen, X, Trash2 } from 'lucide-react';
import type { NotebookEntry } from '../types';
import NotebookModal from './NotebookModal';
import Logo from './Logo';
import './Navbar.css';

const Navbar: React.FC = () => {
    const { appUser, logout } = useAuth();
    const { selectedYear, setSelectedYear, refreshPurchases, refreshLedgerAccounts, refreshVendors } = useApp();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [notebookOpen, setNotebookOpen] = useState(false);
    const [editEntry, setEditEntry] = useState<NotebookEntry | null>(null);
    const [editForm, setEditForm] = useState({ caseName: '', procNumber: '', startDate: '', endDate: '' });
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [notebookRefreshKey, setNotebookRefreshKey] = useState(0);

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
        { to: '/purchases', label: '採購紀錄', icon: <FileText size={18} />, exact: false, badge: 0 },
        { to: '/report', label: '年度報表', icon: <BarChart3 size={18} />, exact: false, badge: 0 },
        { to: '/admin', label: '系統管理', icon: <Database size={18} />, exact: false, badge: appUser?.role === 'admin' ? pendingCount : 0 },
    ];

    const handleEditEntry = (entry: NotebookEntry) => {
        setEditEntry(entry);
        setEditForm({ caseName: entry.caseName, procNumber: entry.procNumber, startDate: entry.startDate, endDate: entry.endDate });
    };

    const handleUpdateEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editEntry) return;
        try {
            await updateNotebookEntry(editEntry.id, editForm);
            setEditEntry(null);
            setNotebookRefreshKey(k => k + 1);
        } catch (err) { alert('修改失敗'); }
    };

    const handleDeleteEntry = async () => {
        if (!confirmDeleteId) return;
        try {
            await deleteNotebookEntry(confirmDeleteId);
            setConfirmDeleteId(null);
            setNotebookRefreshKey(k => k + 1);
        } catch (err) { alert('刪除失敗'); }
    };

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

                    <button className="nav-link" onClick={() => setNotebookOpen(true)}>
                        <span className="nav-icon"><NotebookPen size={18} /></span>
                        契約履歷
                    </button>


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
                        <button className="mobile-nav-link" onClick={() => { setNotebookOpen(true); setMenuOpen(false); }}>
                            <span><NotebookPen size={18} /></span>
                            契約履歷
                        </button>
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
                <button className="bottom-nav-item" onClick={() => setNotebookOpen(true)}>
                    <span className="bottom-icon"><NotebookPen size={18} /></span>
                    <span className="bottom-label">契約履歷</span>
                </button>
            </div>

            {notebookOpen && <NotebookModal
                onClose={() => setNotebookOpen(false)}
                onEdit={handleEditEntry}
                onDelete={(id) => setConfirmDeleteId(id)}
                refreshKey={notebookRefreshKey}
            />}

            {/* Edit notebook entry modal */}
            {editEntry && (
                <div className="modal-overlay" onClick={() => setEditEntry(null)}>
                    <div className="modal-box admin-modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>編輯紀錄</h2>
                            <button className="modal-close" onClick={() => setEditEntry(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateEntry}>
                            <div className="modal-form">
                                <div className="form-group">
                                    <label>案名</label>
                                    <input value={editForm.caseName} onChange={e => setEditForm({ ...editForm, caseName: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>採購編號</label>
                                    <input value={editForm.procNumber} onChange={e => setEditForm({ ...editForm, procNumber: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>契約起訖</label>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} required style={{ flex: 1 }} />
                                        <span style={{ color: 'var(--text3)' }}>~</span>
                                        <input type="date" value={editForm.endDate} onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} required style={{ flex: 1 }} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-combined">
                                <div className="footer-actions" style={{ marginLeft: 'auto' }}>
                                    <button type="button" className="btn-outline" onClick={() => setEditEntry(null)}>取消</button>
                                    <button type="submit" className="btn-primary">確認儲存</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {confirmDeleteId && (
                <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
                    <div className="modal-box admin-modal" style={{ maxWidth: '400px', textAlign: 'center', padding: 0 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #991b1b, #ef4444)' }}>
                            <h2>確定要刪除嗎？</h2>
                            <button className="modal-close" style={{ color: 'white' }} onClick={() => setConfirmDeleteId(null)}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '32px 24px' }}>
                            <Trash2 size={48} color="#ef4444" style={{ opacity: 0.8 }} />
                            <p style={{ marginTop: '16px', color: 'var(--text2)' }}>此動作無法復原，您確定要刪除此筆紀錄嗎？</p>
                        </div>
                        <div className="modal-footer-combined">
                            <div className="footer-actions" style={{ marginLeft: 'auto' }}>
                                <button className="btn-outline" onClick={() => setConfirmDeleteId(null)}>取消</button>
                                <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #991b1b, #ef4444)', boxShadow: 'none' }} onClick={handleDeleteEntry}>確定刪除</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
