import React, { useState, useEffect } from 'react';
import {
    getAllUsers, updateUserRole, deleteUser,
    addLedgerAccount, deleteLedgerAccount, updateLedgerAccount,
    addVendor, deleteVendor, updateVendor,
    cleanupDuplicatePurchases,
} from '../lib/firestore';
import * as XLSX from 'xlsx';
import { Upload, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AppUser, LedgerAccount, Vendor } from '../types';
import { useApp } from '../contexts/AppContext';
import './AdminPage.css';

type AdminTab = 'users' | 'accounts' | 'vendors' | 'maintenance';

const ROLE_LABEL: Record<string, string> = {
    admin: '管理員', user: '使用者', pending: '待審核', rejected: '已拒絕', guest: '訪客'
};

const AdminPage: React.FC = () => {
    const { appUser } = useAuth();
    const { ledgerAccounts, refreshLedgerAccounts, vendors, refreshVendors, selectedYear } = useApp();
    const isAdmin = appUser?.role === 'admin';
    const isGuest = appUser?.role === 'guest';
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
    const [vendorTaxId, setVendorTaxId] = useState('');
    const [vendorContact, setVendorContact] = useState('');
    const [vendorPhone, setVendorPhone] = useState('');
    const [vendorSaving, setVendorSaving] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [adminError, setAdminError] = useState('');
    const [cleaningData, setCleaningData] = useState(false);

    const [showAccImport, setShowAccImport] = useState(false);
    const [showVendorImport, setShowVendorImport] = useState(false);

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

    const handleDeleteUser = async (uid: string, name: string) => {
        if (uid === appUser?.uid) {
            alert('不可刪除自己的帳號！');
            return;
        }
        if (!confirm(`確定要刪除使用者「${name}」？此操作僅會移除系統權限設定，不會影響 Firebase Auth 帳號。`)) return;
        try {
            await deleteUser(uid);
            await fetchUsers();
        } catch (err: any) {
            alert('刪除失敗：' + err.message);
        }
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
                await updateLedgerAccount(editingAcc.id, selectedYear, accCode.trim(), accName.trim(), budgetNum);
                setEditingAcc(null);
            } else {
                await addLedgerAccount(selectedYear, accCode.trim(), accName.trim(), budgetNum);
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
        await deleteLedgerAccount(id, selectedYear);
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

    const handleAccountImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(sheet);

                if (json.length === 0) {
                    alert('Excel 檔案內沒有資料。');
                    return;
                }

                setAccSaving(true);
                let successCount = 0;
                let errors: string[] = [];

                json.forEach((row, index) => {
                    const rowNum = index + 2; // Data starts on line 2
                    const code = String(row['科目代碼'] || row['代碼'] || '').trim();
                    const name = String(row['科目名稱'] || row['名稱'] || '').trim();
                    const budget = parseFloat(row['計畫成本'] || row['預算'] || '0');

                    if (name.startsWith('範例-')) return;

                    if (!code || !name) {
                        errors.push(`第 ${rowNum} 列：代碼或名稱缺失`);
                        return;
                    }

                    row._valid = true;
                    row._processed = { code, name, budget, rowNum };
                });

                for (const row of json) {
                    if (!row._valid) continue;
                    const { code, name, budget, rowNum } = row._processed;
                    try {
                        await addLedgerAccount(selectedYear, code, name, budget);
                        successCount++;
                    } catch (err: any) {
                        errors.push(`第 ${rowNum} 列：儲存失敗 (${err.message || '權限問題'})`);
                    }
                }

                await refreshLedgerAccounts();
                let msg = `導入完成！成功：${successCount} 筆。`;
                if (errors.length > 0) {
                    msg += `\n\n失敗原因：\n` + errors.slice(0, 10).join('\n');
                    if (errors.length > 10) msg += `\n...以及其他 ${errors.length - 10} 筆錯誤`;
                }
                alert(msg);
            } catch (err) {
                console.error('Import error:', err);
                alert('Excel 導入失敗，請檢查檔案格式。');
            } finally {
                setAccSaving(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const normalizeName = (name: string) => {
        return name.trim()
            .replace(/(股份有限公司|有限公司|實業有限公司|實業股份有限公司|股份公司|有限公司|公司)$/, '')
            .replace(/[\(\)（）\s]/g, ''); // 移除空格與括弧
    };

    const handleAddVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorName.trim()) return;
        setVendorSaving(true);

        const vendorData: Partial<Vendor> = {
            code: vendorCode.trim(),
            name: vendorName.trim(),
            taxId: vendorTaxId.trim(),
            contact: vendorContact.trim(),
            phone: vendorPhone.trim()
        };

        try {
            if (editingVendor) {
                await updateVendor(editingVendor.id, vendorData);
                setEditingVendor(null);
            } else {
                // Duplicate Check
                const normName = normalizeName(vendorName);
                const nameDup = vendors.find(v => normalizeName(v.name) === normName);
                const taxDup = vendorTaxId.trim() ? vendors.find(v => v.taxId === vendorTaxId.trim()) : null;

                if (taxDup) {
                    throw new Error(`統編 ${vendorTaxId} 已由「${taxDup.name}」使用，請勿重複建立。`);
                }
                if (nameDup) {
                    throw new Error(`偵測到相似廠商：「${nameDup.name}」。\n系統已自動比對並排除「股份有限公司/有限公司」等字眼，請確認是否為同一家廠商。`);
                }

                await addVendor(vendorData);
            }

            // Clean up
            setVendorCode('');
            setVendorName('');
            setVendorTaxId('');
            setVendorContact('');
            setVendorPhone('');

            await refreshVendors();
            setAdminError('');
        } catch (err: any) {
            console.error('Vendor save error:', err);
            const msg = `廠商儲存失敗: ${err.message}`;
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
        setVendorTaxId(v.taxId || '');
        setVendorContact(v.contact || '');
        setVendorPhone(v.phone || '');
    };

    const cancelEditVendor = () => {
        setEditingVendor(null);
        setVendorCode('');
        setVendorName('');
        setVendorTaxId('');
        setVendorContact('');
        setVendorPhone('');
    };

    const handleCleanupDuplicates = async () => {
        if (!confirm(`確定要永久刪除 ${selectedYear} 年度中重複的採購紀錄？\n系統會自動保留資訊較完整的紀錄，此操作不可撤銷。`)) return;
        setCleaningData(true);
        try {
            const count = await cleanupDuplicatePurchases(selectedYear, ledgerAccounts.map(a => a.id));
            alert(`清理完成！共刪除了 ${count} 筆重複資料。`);
            window.location.reload(); // Refresh to ensure AppContext and other parts see the change
        } catch (err: any) {
            alert('清理失敗：' + err.message);
        } finally {
            setCleaningData(false);
        }
    };

    const handleVendorImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(sheet);

                if (json.length === 0) {
                    alert('Excel 檔案內沒有資料。');
                    return;
                }

                setVendorSaving(true);
                let successCount = 0;
                let skipCount = 0;
                let errors: string[] = [];

                json.forEach((row, index) => {
                    const rowNum = index + 2;
                    const name = String(row['廠商名稱'] || row['名稱'] || '').trim();
                    const taxId = String(row['統一編號'] || row['統編'] || '').trim().replace(/\D/g, '').slice(0, 8);
                    const contact = String(row['聯絡人'] || '').trim();
                    const phone = String(row['電話'] || '').trim();

                    if (!name || name.startsWith('範例-')) {
                        if (name && !name.startsWith('範例-')) errors.push(`第 ${rowNum} 列：名稱缺失`);
                        return;
                    }

                    // Duplicate Check
                    const normName = normalizeName(name);
                    const isNameDup = vendors.some(v => normalizeName(v.name) === normName);
                    const isTaxDup = taxId ? vendors.some(v => v.taxId === taxId) : false;

                    if (isNameDup || isTaxDup) {
                        row._skip = true;
                        return;
                    }

                    row._valid = true;
                    row._processed = { name, taxId, contact, phone, rowNum };
                });

                for (const row of json) {
                    if (row._skip) { skipCount++; continue; }
                    if (!row._valid) continue;

                    const { name, taxId, contact, phone, rowNum } = row._processed;
                    try {
                        await addVendor({ name, taxId, contact, phone });
                        successCount++;
                    } catch (err: any) {
                        errors.push(`第 ${rowNum} 列：儲存失敗 (${err.message})`);
                    }
                }

                await refreshVendors();
                let msg = `導入完成！\n成功：${successCount} 筆\n跳過重複：${skipCount} 筆`;
                if (errors.length > 0) {
                    msg += `\n\n失敗原因：\n` + errors.slice(0, 10).join('\n');
                    if (errors.length > 10) msg += `\n...以及其他 ${errors.length - 10} 筆錯誤`;
                }
                alert(msg);
            } catch (err) {
                console.error('Import error:', err);
                alert('Excel 導入失敗，請檢查檔案格式。');
            } finally {
                setVendorSaving(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };
    const downloadAccountTemplate = () => {
        const data = [
            { '科目代碼': 'M54000', '科目名稱': '範例-差旅費', '計畫成本': 50000 }
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '科目範本');
        XLSX.writeFile(wb, '總帳科目導入範本.xlsx');
    };

    const downloadVendorTemplate = () => {
        const data = [
            { '廠商名稱': '範例-國泰化工', '統一編號': '12345678', '聯絡人': '張小明', '電話': '02-12345678' }
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '廠商範本');
        XLSX.writeFile(wb, '廠商資料導入範本.xlsx');
    };

    const pendingCount = users.filter((u) => u.role === 'pending').length;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{isAdmin ? '系統管理' : '管理'}</h1>
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
                <button className={`tab-btn ${tab === 'maintenance' ? 'active' : ''}`} onClick={() => setTab('maintenance')}>
                    🍂 資料維護
                </button>
            </div>

            {adminError && <div className="form-error" style={{ marginBottom: 20 }}>{adminError}</div>}

            {/* Maintenance tab content */}
            {tab === 'maintenance' && (
                <div className="maintenance-panel" style={{ animation: 'fadeIn 0.4s ease' }}>
                    <div className="admin-maintenance-card" style={{ padding: 24, background: '#fff', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                            <div style={{ fontSize: 32 }}>🍂</div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: 20, color: 'var(--text1)', fontWeight: 800 }}>採購紀錄去重清理 ({selectedYear} 年度)</h3>

                                <div className="maintenance-info" style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 24 }}>
                                    <h4 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--primary)' }}>使用時機：</h4>
                                    <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
                                        <li><strong>Excel 導入後</strong>：批次導入資料後，若擔心有重複上傳，可執行清理。</li>
                                        <li><strong>數據不一致時</strong>：當發現採購清單出現兩筆金額日期相同，但一筆有科目代碼一筆沒有時。</li>
                                        <li><strong>系統維護</strong>：定期執行可縮小資料庫體積，提升系統讀取效能。</li>
                                    </ul>

                                    <h4 style={{ margin: '16px 0 8px', fontSize: 15, color: 'var(--primary)' }}>執行說明：</h4>
                                    <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
                                        系統會比對該年度所有紀錄的 <strong>「日期、廠商、單號、品名、金額」</strong>。<br />
                                        若判定為重複，會自動保留「資訊最完整（已連結正式總帳科目編號）」的那一筆，永久移除其他冗餘紀錄。
                                    </p>
                                </div>

                                <button
                                    className="btn-primary"
                                    style={{
                                        padding: '12px 32px',
                                        fontSize: 16,
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                                        borderRadius: 12
                                    }}
                                    onClick={handleCleanupDuplicates}
                                    disabled={cleaningData}
                                >
                                    {cleaningData ? '深度掃描並清理中...' : `立即清理 ${selectedYear} 年度重複項`}
                                </button>

                                <p style={{ marginTop: 16, fontSize: 12, color: '#ef4444', fontWeight: 500 }}>
                                    ※ 注意：此操作將永久從資料庫移除冗餘數據，執行前請確認已選擇正確年度。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                                    <button className="role-btn reject" onClick={() => handleDeleteUser(u.uid, u.displayName)}>刪除</button>
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
                    {!isGuest && (
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
                                placeholder="計畫成本 (新台幣)"
                                type="number"
                                value={accBudget}
                                onChange={(e) => setAccBudget(e.target.value)}
                            />
                            <button type="submit" className="btn-primary" disabled={accSaving}>
                                {accSaving ? '儲存中⋯' : editingAcc ? `更新 (${selectedYear})` : `新增 (${selectedYear})`}
                            </button>
                            {editingAcc && (
                                <button type="button" className="btn-outline" onClick={cancelEdit}>取消</button>
                            )}
                            <button
                                type="button"
                                className={`btn-import-toggle ${showAccImport ? 'active' : ''}`}
                                onClick={() => setShowAccImport(!showAccImport)}
                                title="批次導入選項"
                            >
                                <Plus size={20} />
                            </button>

                            {showAccImport && (
                                <div className="batch-import-box">
                                    <label className="btn-batch-import">
                                        <Upload size={16} />
                                        批次導入 Excel
                                        <input type="file" accept=".xlsx, .xls" onChange={handleAccountImport} hidden />
                                    </label>
                                    <button type="button" className="btn-text-link" onClick={downloadAccountTemplate}>
                                        📥 下載科目範本
                                    </button>
                                    <span className="import-hint">欄位：科目代碼, 科目名稱, 計畫成本</span>
                                </div>
                            )}
                        </form>
                    )}

                    <div className="table-wrapper">
                        {ledgerAccounts.length === 0 ? (
                            <div className="empty-state"><div className="empty-icon">📂</div><p>尚未建立任何科目</p></div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr><th style={{ width: '40px', color: 'var(--text3)' }}>#</th><th>科目代碼</th><th>科目名稱</th><th>計畫成本</th>{!isGuest && <th>操作</th>}</tr>
                                </thead>
                                <tbody>
                                    {ledgerAccounts.map((acc, idx) => (
                                        <tr key={acc.id}>
                                            <td style={{ color: 'var(--text3)', fontSize: '12px', textAlign: 'center' }}>{idx + 1}</td>
                                            <td><code>{acc.code}</code></td>
                                            <td>{acc.name}</td>
                                            <td>{acc.budget ? `NT$ ${acc.budget.toLocaleString()}` : '-'}</td>
                                            {!isGuest && (
                                                <td>
                                                    <div className="role-actions">
                                                        <button className="role-btn user" onClick={() => startEdit(acc)}>編輯</button>
                                                        <button className="role-btn reject" onClick={() => handleDeleteAccount(acc.id, acc.name)}>刪除</button>
                                                    </div>
                                                </td>
                                            )}
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
                    {!isGuest && (
                        <form className="vendor-form-premium" onSubmit={handleAddVendor}>
                            <div className="v-form-grid">
                                <div className="f-group">
                                    <label>廠商名稱 <span className="required">*</span></label>
                                    <input
                                        placeholder="如：國泰化工"
                                        value={vendorName}
                                        onChange={(e) => setVendorName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="f-group">
                                    <label>統一編號</label>
                                    <input
                                        placeholder="8位數字"
                                        value={vendorTaxId}
                                        onChange={(e) => setVendorTaxId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                    />
                                </div>
                                <div className="f-group">
                                    <label>聯絡人</label>
                                    <input
                                        placeholder="聯絡姓名"
                                        value={vendorContact}
                                        onChange={(e) => setVendorContact(e.target.value)}
                                    />
                                </div>
                                <div className="f-group">
                                    <label>聯絡電話</label>
                                    <input
                                        placeholder="電話或分機"
                                        value={vendorPhone}
                                        onChange={(e) => setVendorPhone(e.target.value)}
                                    />
                                </div>
                                <div className="v-inline-actions">
                                    <button type="submit" className="btn-primary" disabled={vendorSaving}>
                                        {vendorSaving ? '儲存中⋯' : editingVendor ? '更新' : '新增廠商'}
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn-import-toggle ${showVendorImport ? 'active' : ''}`}
                                        onClick={() => setShowVendorImport(!showVendorImport)}
                                        title="批次導入選項"
                                    >
                                        <Plus size={20} />
                                    </button>
                                    {editingVendor && (
                                        <button type="button" className="btn-outline" onClick={cancelEditVendor}>取消</button>
                                    )}
                                </div>
                            </div>
                            {showVendorImport && (
                                <div className="batch-import-box v-batch">
                                    <label className="btn-batch-import">
                                        <Upload size={16} />
                                        批次導入 Excel
                                        <input type="file" accept=".xlsx, .xls" onChange={handleVendorImport} hidden />
                                    </label>
                                    <button type="button" className="btn-text-link" onClick={downloadVendorTemplate}>
                                        📥 下載廠商範本
                                    </button>
                                    <span className="import-hint">欄位：廠商名稱, 統一編號, 聯絡人, 電話</span>
                                </div>
                            )}
                        </form>
                    )}

                    <div className="table-wrapper">
                        {vendors.length === 0 ? (
                            <div className="empty-state"><div className="empty-icon">🏢</div><p>尚未建立任何廠商</p></div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr><th style={{ width: '40px', color: 'var(--text3)' }}>#</th><th>統編</th><th>廠商名稱</th><th>聯絡人</th><th>電話</th>{!isGuest && <th>操作</th>}</tr>
                                </thead>
                                <tbody>
                                    {vendors.map((v, idx) => (
                                        <tr key={v.id}>
                                            <td style={{ color: 'var(--text3)', fontSize: '12px', textAlign: 'center' }}>{idx + 1}</td>
                                            <td><code>{v.taxId || v.code || '-'}</code></td>
                                            <td>{v.name}</td>
                                            <td>{v.contact || '-'}</td>
                                            <td>{v.phone || '-'}</td>
                                            {!isGuest && (
                                                <td>
                                                    <div className="role-actions">
                                                        <button className="role-btn user" onClick={() => startEditVendor(v)}>編輯</button>
                                                        <button className="role-btn reject" onClick={() => handleDeleteVendor(v.id, v.name)}>刪除</button>
                                                    </div>
                                                </td>
                                            )}
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
