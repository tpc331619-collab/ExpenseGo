import React, { useState, useEffect } from 'react';
import {
    getAllUsers, updateUserRole,
    addLedgerAccount, deleteLedgerAccount, updateLedgerAccount,
    addVendor, deleteVendor, updateVendor,
} from '../lib/firestore';
import { useAuth } from '../contexts/AuthContext';
import type { AppUser, LedgerAccount, Vendor } from '../types';
import { useApp } from '../contexts/AppContext';
import './AdminPage.css';

type AdminTab = 'users' | 'accounts' | 'vendors';

const ROLE_LABEL: Record<string, string> = {
    admin: '管理員', user: '一般使用者', pending: '待審核', rejected: '已拒絕',
};

const AdminPage: React.FC = () => {
    const { appUser } = useAuth();
    const { ledgerAccounts, refreshLedgerAccounts, vendors, refreshVendors } = useApp();
    const isAdmin = appUser?.role === 'admin';
    const [tab, setTab] = useState<AdminTab>(isAdmin ? 'users' : 'accounts');
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Ledger account form
    const [accCode, setAccCode] = useState('');
    const [accName, setAccName] = useState('');
    const [accBudget, setAccBudget] = useState('');
    const [accSaving, setAccSaving] = useState(false);
    const [editingAcc, setEditingAcc] = useState<LedgerAccount | null>(null);

    // Vendor form
    const [vendorCode, setVendorCode] = useState('');
    const [vendorName, setVendorName] = useState('');
    const [vendorSaving, setVendorSaving] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [adminError, setAdminError] = useState('');

    const fetchUsers = async () => {
        setLoadingUsers(true);
        const data = await getAllUsers();
        setUsers(data);
        setLoadingUsers(false);
    };

    useEffect(() => {
        if (isAdmin) fetchUsers();
    }, [isAdmin]);

    const handleRoleChange = async (uid: string, role: AppUser['role']) => {
        await updateUserRole(uid, role);
        await fetchUsers();
    };

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        const budgetNum = parseFloat(accBudget) || 0;
        console.log('Adding/Updating account:', { code: accCode, name: accName, budget: budgetNum, editingAcc });
        if (!accCode.trim() || !accName.trim()) {
            console.warn('Validation failed: Code and Name are required');
            return;
        }
        setAccSaving(true);
        try {
            if (editingAcc) {
                await updateLedgerAccount(editingAcc.id, accCode.trim(), accName.trim(), budgetNum);
                setEditingAcc(null);
            } else {
                await addLedgerAccount(accCode.trim(), accName.trim(), budgetNum);
            }
            console.log('Account saved successfully');
            setAccCode('');
            setAccName('');
            setAccBudget('');
            await refreshLedgerAccounts();
            setAdminError('');
        } catch (err: any) {
            console.error('Account save error:', err);
            const msg = `科目儲存失敗: ${err.message || '請檢查 Firebase 權限（Rules）'}`;
            setAdminError(msg);
            alert(msg);
        } finally {
            setAccSaving(false);
        }
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (!confirm(`確定刪除科目「${name}」？`)) return;
        await deleteLedgerAccount(id);
        await refreshLedgerAccounts();
    };

    const startEdit = (acc: LedgerAccount) => {
        setEditingAcc(acc);
        setAccCode(acc.code);
        setAccName(acc.name);
        setAccBudget(String(acc.budget || ''));
    };

    const cancelEdit = () => {
        setEditingAcc(null);
        setAccCode('');
        setAccName('');
        setAccBudget('');
    };

    const handleAddVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorName.trim()) return;
        setVendorSaving(true);
        console.log('Adding/Updating vendor:', { code: vendorCode, name: vendorName, editingVendor });
        try {
            if (editingVendor) {
                await updateVendor(editingVendor.id, vendorCode.trim(), vendorName.trim());
                setEditingVendor(null);
            } else {
                await addVendor(vendorCode.trim(), vendorName.trim());
            }
            console.log('Vendor saved successfully');
            setVendorCode('');
            setVendorName('');
            await refreshVendors();
            setAdminError('');
        } catch (err: any) {
            console.error('Vendor save error:', err);
            const msg = `廠商儲存失敗: ${err.message || '請檢查 Firebase 權限（Rules）'}`;
            setAdminError(msg);
            alert(msg);
        } finally {
            setVendorSaving(false);
        }
    };

    const handleDeleteVendor = async (id: string, name: string) => {
        if (!confirm(`確定刪除廠商「${name}」？`)) return;
        await deleteVendor(id);
        await refreshVendors();
    };

    const startEditVendor = (v: Vendor) => {
        setEditingVendor(v);
        setVendorCode(v.code || '');
        setVendorName(v.name);
    };

    const cancelEditVendor = () => { setEditingVendor(null); setVendorCode(''); setVendorName(''); };

    const pendingCount = users.filter((u) => u.role === 'pending').length;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{isAdmin ? '系統管理' : '資料維護'}</h1>
            </div>

            <div className="admin-tabs">
                {isAdmin && (
                    <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
                        帳號管理 {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
                    </button>
                )}
                <button className={`tab-btn ${tab === 'accounts' ? 'active' : ''}`} onClick={() => setTab('accounts')}>
                    總帳科目管理
                </button>
                <button className={`tab-btn ${tab === 'vendors' ? 'active' : ''}`} onClick={() => setTab('vendors')}>
                    廠商管理
                </button>
            </div>

            {adminError && <div className="form-error" style={{ marginBottom: 20 }}>{adminError}</div>}

            {/* Users tab */}
            {tab === 'users' && (
                <div>
                    {loadingUsers ? (
                        <div className="full-loading"><div className="spinner" /></div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>使用者</th><th>Email</th><th>申請時間</th><th>目前角色</th><th>變更角色</th></tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.uid} className={u.role === 'pending' ? 'row-pending' : ''}>
                                            <td>
                                                <div className="user-cell">
                                                    <img src={u.photoURL} className="user-avatar" alt="" />
                                                    <span>{u.displayName}</span>
                                                </div>
                                            </td>
                                            <td>{u.email}</td>
                                            <td>{u.createdAt?.toDate().toLocaleDateString('zh-TW')}</td>
                                            <td>
                                                <span className={`role-tag role-${u.role}`}>{ROLE_LABEL[u.role]}</span>
                                            </td>
                                            <td>
                                                <div className="role-actions">
                                                    {u.role !== 'admin' && (
                                                        <button className="role-btn approve" onClick={() => handleRoleChange(u.uid, 'admin')}>管理員</button>
                                                    )}
                                                    {u.role !== 'user' && (
                                                        <button className="role-btn user" onClick={() => handleRoleChange(u.uid, 'user')}>使用者</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Ledger accounts tab */}
            {tab === 'accounts' && (
                <div className="accounts-panel">
                    <form className="acc-form" onSubmit={handleAddAccount}>
                        <input
                            placeholder="科目代碼，如 M54000"
                            value={accCode}
                            onChange={(e) => setAccCode(e.target.value)}
                            required
                        />
                        <input
                            placeholder="科目名稱，如 差旅費"
                            value={accName}
                            onChange={(e) => setAccName(e.target.value)}
                            required
                        />
                        <input
                            placeholder="預算金額 (新台幣)"
                            type="number"
                            value={accBudget}
                            onChange={(e) => setAccBudget(e.target.value)}
                        />
                        <button type="submit" className="btn-primary" disabled={accSaving}>
                            {accSaving ? '儲存中⋯' : editingAcc ? '更新' : '新增'}
                        </button>
                        {editingAcc && (
                            <button type="button" className="btn-outline" onClick={cancelEdit}>取消</button>
                        )}
                    </form>

                    <div className="table-wrapper">
                        {ledgerAccounts.length === 0 ? (
                            <div className="empty-state"><div className="empty-icon">📂</div><p>尚未建立任何科目</p></div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr><th>科目代碼</th><th>科目名稱</th><th>預算金額</th><th>操作</th></tr>
                                </thead>
                                <tbody>
                                    {ledgerAccounts.map((acc) => (
                                        <tr key={acc.id}>
                                            <td><code>{acc.code}</code></td>
                                            <td>{acc.name}</td>
                                            <td>{acc.budget ? `NT$ ${acc.budget.toLocaleString()}` : '-'}</td>
                                            <td>
                                                <div className="role-actions">
                                                    <button className="role-btn user" onClick={() => startEdit(acc)}>編輯</button>
                                                    <button className="role-btn reject" onClick={() => handleDeleteAccount(acc.id, acc.name)}>刪除</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Vendors tab */}
            {tab === 'vendors' && (
                <div className="accounts-panel">
                    <form className="acc-form" onSubmit={handleAddVendor}>
                        <input
                            placeholder="統編 (8位數字)"
                            value={vendorCode}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, ''); // 僅保留數字
                                if (val.length <= 8) setVendorCode(val);
                            }}
                        />
                        <input
                            placeholder="廠商名稱，如 國泰化工"
                            value={vendorName}
                            onChange={(e) => setVendorName(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn-primary" disabled={vendorSaving}>
                            {vendorSaving ? '儲存中⋯' : editingVendor ? '更新' : '新增'}
                        </button>
                        {editingVendor && (
                            <button type="button" className="btn-outline" onClick={cancelEditVendor}>取消</button>
                        )}
                    </form>

                    <div className="table-wrapper">
                        {vendors.length === 0 ? (
                            <div className="empty-state"><div className="empty-icon">🏢</div><p>尚未建立任何廠商</p></div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr><th>統編</th><th>廠商名稱</th><th>操作</th></tr>
                                </thead>
                                <tbody>
                                    {vendors.map((v) => (
                                        <tr key={v.id}>
                                            <td><code>{v.code || '-'}</code></td>
                                            <td>{v.name}</td>
                                            <td>
                                                <div className="role-actions">
                                                    <button className="role-btn user" onClick={() => startEditVendor(v)}>編輯</button>
                                                    <button className="role-btn reject" onClick={() => handleDeleteVendor(v.id, v.name)}>刪除</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
