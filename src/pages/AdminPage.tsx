import React, { useState, useEffect } from 'react';
import {
    getAllUsers, updateUserRole, deleteUser,
    addLedgerAccount, deleteLedgerAccount, updateLedgerAccount,
    addVendor, deleteVendor, updateVendor,
    cleanupDuplicatePurchases,
    updateSystemOptions,
} from '../lib/firestore';
import * as XLSX from 'xlsx';
import { Upload, Plus, Database, Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AppUser, LedgerAccount, Vendor } from '../types';
import { useApp } from '../contexts/AppContext';
import './AdminPage.css';
import '../components/PurchaseModal.css'; // Reuse modal styles

interface LedgerAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (code: string, name: string, budget: string) => Promise<void>;
    editingAccount: LedgerAccount | null;
    selectedYear: number;
    saving: boolean;
}

const LedgerAccountModal: React.FC<LedgerAccountModalProps> = ({
    isOpen, onClose, onSave, editingAccount, selectedYear, saving
}) => {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [budget, setBudget] = useState('');

    useEffect(() => {
        if (editingAccount) {
            setCode(editingAccount.code);
            setName(editingAccount.name);
            setBudget(String(editingAccount.budget || ''));
        } else {
            setCode('');
            setName('');
            setBudget('');
        }
    }, [editingAccount, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box admin-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{editingAccount ? `編輯科目 (${selectedYear})` : `新增科目 (${selectedYear})`}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form className="modal-form" onSubmit={(e) => {
                    e.preventDefault();
                    onSave(code, name, budget);
                }}>
                    <div className="form-group">
                        <label>科目代碼 <span className="required">*</span></label>
                        <input value={code} onChange={e => setCode(e.target.value)} placeholder="如 M54000" required />
                    </div>
                    <div className="form-group">
                        <label>科目名稱 <span className="required">*</span></label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="如 差旅費" required />
                    </div>
                    <div className="form-group">
                        <label>計畫成本 (新台幣)</label>
                        <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" />
                    </div>
                    <div className="modal-footer-combined">
                        <div className="footer-actions" style={{ marginLeft: 'auto' }}>
                            <button type="button" className="btn-outline" onClick={onClose}>取消</button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? '儲存中...' : '確認儲存'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface VendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Vendor>) => Promise<void>;
    editingVendor: Vendor | null;
    saving: boolean;
}

const VendorModal: React.FC<VendorModalProps> = ({
    isOpen, onClose, onSave, editingVendor, saving
}) => {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [taxId, setTaxId] = useState('');
    const [contact, setContact] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        if (editingVendor) {
            setCode(editingVendor.code || '');
            setName(editingVendor.name);
            setTaxId(editingVendor.taxId || '');
            setContact(editingVendor.contact || '');
            setPhone(editingVendor.phone || '');
        } else {
            setCode('');
            setName('');
            setTaxId('');
            setContact('');
            setPhone('');
        }
    }, [editingVendor, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box admin-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{editingVendor ? '編輯廠商' : '新增廠商'}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form className="modal-form" onSubmit={(e) => {
                    e.preventDefault();
                    onSave({ code, name, taxId, contact, phone });
                }}>
                    <div className="form-grid">
                        <div className="form-group col-12">
                            <label>廠商名稱 <span className="required">*</span></label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="如 國泰化工" required />
                        </div>
                        <div className="form-group col-6">
                            <label>統一編號</label>
                            <input value={taxId} onChange={e => setTaxId(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="8位數字" />
                        </div>
                        <div className="form-group col-6">
                            <label>廠商代碼</label>
                            <input value={code} onChange={e => setCode(e.target.value)} placeholder="選填" />
                        </div>
                        <div className="form-group col-6">
                            <label>聯絡人</label>
                            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="聯絡姓名" />
                        </div>
                        <div className="form-group col-6">
                            <label>聯絡電話</label>
                            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="電話或分機" />
                        </div>
                    </div>
                    <div className="modal-footer-combined">
                        <div className="footer-actions" style={{ marginLeft: 'auto' }}>
                            <button type="button" className="btn-outline" onClick={onClose}>取消</button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? '儲存中...' : '確認儲存'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen, title, message, onConfirm, onCancel, confirmText = '確定', type = 'info'
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        if (type === 'danger') return '⚠️';
        if (type === 'warning') return '💡';
        return 'ℹ️';
    };

    const getBtnClass = () => {
        if (type === 'danger') return 'btn-danger-confirm';
        return 'btn-primary';
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="confirm-content">
                    <div className={`confirm-icon icon-${type}`}>{getIcon()}</div>
                    <h3>{title}</h3>
                    <p dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br/>') }}></p>
                </div>
                <div className="confirm-footer">
                    <button className="btn-outline" onClick={onCancel}>取消</button>
                    <button className={getBtnClass()} onClick={onConfirm}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

type AdminTab = 'users' | 'accounts' | 'vendors' | 'maintenance' | 'options';

const ROLE_LABEL: Record<string, string> = {
    admin: '管理員', user: '使用者', pending: '待審核', rejected: '已拒絕', guest: '訪客'
};

const AdminPage: React.FC = () => {
    const { appUser } = useAuth();
    const { ledgerAccounts, refreshLedgerAccounts, vendors, refreshVendors, selectedYear, purchaseTypes, requisitionTypes, contractTypes, refreshSystemOptions } = useApp();
    const isAdmin = appUser?.role === 'admin';
    const isGuest = appUser?.role === 'guest';
    const [tab, setTab] = useState<AdminTab>(isAdmin ? 'users' : 'accounts');
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Ledger account form
    const [accSaving, setAccSaving] = useState(false);
    const [editingAcc, setEditingAcc] = useState<LedgerAccount | null>(null);

    // Vendor form
    const [vendorSaving, setVendorSaving] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [cleaningData, setCleaningData] = useState(false);

    // Modals visibility
    const [showAccModal, setShowAccModal] = useState(false);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => { }
    });

    const [showAccImport, setShowAccImport] = useState(false);
    const [showVendorImport, setShowVendorImport] = useState(false);

    // Options form
    const [newPurType, setNewPurType] = useState('');
    const [newReqType, setNewReqType] = useState('');
    const [newContractType, setNewContractType] = useState('');
    const [optionsSaving, setOptionsSaving] = useState(false);

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

        setConfirmState({
            isOpen: true,
            title: '刪除使用者',
            message: `確定要刪除使用者「${name}」？\n此操作僅會移除系統權限設定，不會影響 Firebase Auth 帳號。`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    await deleteUser(uid);
                    await fetchUsers();
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                } catch (err: any) {
                    alert('刪除失敗：' + err.message);
                }
            }
        });
    };

    const handleSaveAccount = async (code: string, name: string, budget: string) => {
        const budgetNum = parseFloat(budget) || 0;
        const trimmedCode = code.trim();
        const trimmedName = name.trim();
        if (!trimmedCode || !trimmedName) return;

        // Duplicate Check
        const isDuplicate = ledgerAccounts.some(acc =>
            acc.code.toLowerCase() === trimmedCode.toLowerCase() &&
            acc.id !== editingAcc?.id
        );

        if (isDuplicate) {
            alert(`代碼 ${trimmedCode} 已存在，請使用其他代碼。`);
            return;
        }

        setAccSaving(true);
        try {
            if (editingAcc) {
                await updateLedgerAccount(editingAcc.id, selectedYear, trimmedCode, trimmedName, budgetNum);
                setEditingAcc(null);
            } else {
                await addLedgerAccount(selectedYear, trimmedCode, trimmedName, budgetNum);
            }
            await refreshLedgerAccounts();
            setShowAccModal(false);
        } catch (err: any) {
            alert(`科目儲存失敗: ${err.message}`);
        } finally {
            setAccSaving(false);
        }
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        setConfirmState({
            isOpen: true,
            title: '刪除科目',
            message: `確定要刪除科目「${name}」？\n這將會移除該科目在 ${selectedYear} 年度的預算設定。`,
            type: 'danger',
            onConfirm: async () => {
                await deleteLedgerAccount(id, selectedYear);
                await refreshLedgerAccounts();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const startEdit = (acc: LedgerAccount) => {
        setEditingAcc(acc);
        setShowAccModal(true);
    };

    const startAddAccount = () => {
        setEditingAcc(null);
        setShowAccModal(true);
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

                const seenCodes = new Set();
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

                    // Internal Excel Duplicate Check
                    if (seenCodes.has(code.toLowerCase())) {
                        errors.push(`第 ${rowNum} 列：Excel 內重複代碼 ${code}`);
                        return;
                    }
                    seenCodes.add(code.toLowerCase());

                    // Duplicate Check against existing accounts
                    const isDuplicate = ledgerAccounts.some(acc => acc.code.toLowerCase() === code.toLowerCase());
                    if (isDuplicate) {
                        errors.push(`第 ${rowNum} 列：代碼 ${code} 已與現有科目重複`);
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

    const handleSaveVendor = async (data: Partial<Vendor>) => {
        if (!data.name?.trim()) return;
        setVendorSaving(true);

        try {
            if (editingVendor) {
                await updateVendor(editingVendor.id, data);
                setEditingVendor(null);
            } else {
                // Duplicate Check
                const normName = normalizeName(data.name);
                const nameDup = vendors.find(v => normalizeName(v.name) === normName);
                const taxDup = data.taxId?.trim() ? vendors.find(v => v.taxId === data.taxId?.trim()) : null;

                if (taxDup) {
                    throw new Error(`統編 ${data.taxId} 已由「${taxDup.name}」使用，請勿重複建立。`);
                }
                if (nameDup) {
                    throw new Error(`偵測到相似廠商：「${nameDup.name}」。\n系統已自動比對並排除「股份有限公司/有限公司」等字眼，請確認是否為同一家廠商。`);
                }

                await addVendor(data);
            }

            await refreshVendors();
            setShowVendorModal(false);
        } catch (err: any) {
            alert(`廠商儲存失敗: ${err.message}`);
        } finally {
            setVendorSaving(false);
        }
    };

    const handleDeleteVendor = async (id: string, name: string) => {
        setConfirmState({
            isOpen: true,
            title: '刪除廠商',
            message: `確定要刪除廠商「${name}」？\n此動作將使該廠商從列表中移除。`,
            type: 'danger',
            onConfirm: async () => {
                await deleteVendor(id);
                await refreshVendors();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const startEditVendor = (v: Vendor) => {
        setEditingVendor(v);
        setShowVendorModal(true);
    };

    const startAddVendor = () => {
        setEditingVendor(null);
        setShowVendorModal(true);
    };

    const handleCleanupDuplicates = async () => {
        setConfirmState({
            isOpen: true,
            title: '採購紀錄清理',
            message: `確定要永久刪除 ${selectedYear} 年度中重複的採購紀錄？\n系統會自動保留資訊較完整的紀錄，此操作不可撤銷。`,
            type: 'warning',
            onConfirm: async () => {
                setCleaningData(true);
                try {
                    const count = await cleanupDuplicatePurchases(selectedYear, ledgerAccounts.map(a => a.id));
                    alert(`清理完成！共刪除了 ${count} 筆重複資料。`);
                    window.location.reload();
                } catch (err: any) {
                    alert('清理失敗：' + err.message);
                } finally {
                    setCleaningData(false);
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
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

    const handleAddOption = async (type: 'purchase' | 'requisition' | 'contract') => {
        setOptionsSaving(true);
        try {
            if (type === 'purchase') {
                const val = newPurType.trim();
                if (!val) return;
                if (purchaseTypes.includes(val)) {
                    alert('此採購類型已存在！');
                    return;
                }
                await updateSystemOptions({ purchaseTypes: [...purchaseTypes, val] });
                setNewPurType('');
            } else if (type === 'requisition') {
                const val = newReqType.trim();
                if (!val) return;
                if (requisitionTypes.includes(val)) {
                    alert('此請購類型已存在！');
                    return;
                }
                await updateSystemOptions({ requisitionTypes: [...requisitionTypes, val] });
                setNewReqType('');
            } else if (type === 'contract') {
                const val = newContractType.trim();
                if (!val) return;
                if (contractTypes.includes(val)) {
                    alert('此契約形式已存在！');
                    return;
                }
                await updateSystemOptions({ contractTypes: [...contractTypes, val] });
                setNewContractType('');
            }
            await refreshSystemOptions();
        } catch (e: any) {
            alert('儲存選項失敗: ' + e.message);
        } finally {
            setOptionsSaving(false);
        }
    };

    const handleDeleteOption = async (type: 'purchase' | 'requisition' | 'contract', targetVal: string) => {
        setConfirmState({
            isOpen: true,
            title: `刪除選項`,
            message: `確定要刪除「${targetVal}」嗎？\n注意：這不會影響過去已經使用此選項的紀錄，但未來新增時將無法再選此項目。`,
            type: 'danger',
            onConfirm: async () => {
                setOptionsSaving(true);
                try {
                    if (type === 'purchase') {
                        await updateSystemOptions({ purchaseTypes: purchaseTypes.filter(t => t !== targetVal) });
                    } else if (type === 'requisition') {
                        await updateSystemOptions({ requisitionTypes: requisitionTypes.filter(t => t !== targetVal) });
                    } else if (type === 'contract') {
                        await updateSystemOptions({ contractTypes: contractTypes.filter(t => t !== targetVal) });
                    }
                    await refreshSystemOptions();
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                } catch (e: any) {
                    alert('刪除選項失敗: ' + e.message);
                } finally {
                    setOptionsSaving(false);
                }
            }
        });
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">系統管理</h1>
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
                <button className={`tab-btn ${tab === 'options' ? 'active' : ''}`} onClick={() => setTab('options')}>
                    選項設定
                </button>
                <button className={`tab-btn ${tab === 'maintenance' ? 'active' : ''}`} onClick={() => setTab('maintenance')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Database size={16} /> 資料維護
                </button>
            </div>

            {/* Options tab content */}
            {tab === 'options' && (
                <div className="options-panel" style={{ animation: 'fadeIn 0.4s ease', display: 'flex', gap: 24, flexDirection: 'row', flexWrap: 'wrap' }}>
                    <div className="admin-maintenance-card" style={{ flex: '1 1 400px', padding: 24, background: '#fff', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow-sm)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--text1)' }}>採購性質設定</h3>
                        <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text2)' }}>若刪除現有選項，將不影響過去已建檔之採購紀錄。</p>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <input
                                placeholder="新增採購性質..."
                                value={newPurType}
                                onChange={e => setNewPurType(e.target.value)}
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddOption('purchase'); }}
                            />
                            <button className="btn-primary" onClick={() => handleAddOption('purchase')} disabled={optionsSaving || !newPurType.trim()}>
                                新增
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {purchaseTypes.map(pt => (
                                <div key={pt} className="option-tag" style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    padding: '6px 14px',
                                    borderRadius: 20,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: 'var(--text1)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {pt}
                                    <button
                                        onClick={() => handleDeleteOption('purchase', pt)}
                                        className="option-delete-btn"
                                        title="刪除"
                                        style={{
                                            background: '#e2e8f0',
                                            border: 'none',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            padding: 0,
                                            fontSize: 10,
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                    >✕</button>
                                </div>
                            ))}
                            {purchaseTypes.length === 0 && <span style={{ color: 'var(--text3)', fontSize: 14 }}>目前無選項</span>}
                        </div>
                    </div>

                    <div className="admin-maintenance-card" style={{ flex: '1 1 400px', padding: 24, background: '#fff', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow-sm)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--text1)' }}>請購類型設定</h3>
                        <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text2)' }}>若刪除現有選項，將不影響過去已建檔之採購紀錄。</p>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <input
                                placeholder="新增請購類型..."
                                value={newReqType}
                                onChange={e => setNewReqType(e.target.value)}
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddOption('requisition'); }}
                            />
                            <button className="btn-primary" onClick={() => handleAddOption('requisition')} disabled={optionsSaving || !newReqType.trim()}>
                                新增
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {requisitionTypes.map(rt => (
                                <div key={rt} className="option-tag" style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    padding: '6px 14px',
                                    borderRadius: 20,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: 'var(--text1)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {rt}
                                    <button
                                        onClick={() => handleDeleteOption('requisition', rt)}
                                        className="option-delete-btn"
                                        title="刪除"
                                        style={{
                                            background: '#e2e8f0',
                                            border: 'none',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            padding: 0,
                                            fontSize: 10,
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                    >✕</button>
                                </div>
                            ))}
                            {requisitionTypes.length === 0 && <span style={{ color: 'var(--text3)', fontSize: 14 }}>目前無選項</span>}
                        </div>
                    </div>

                    <div className="admin-maintenance-card" style={{ flex: '1 1 400px', padding: 24, background: '#fff', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow-sm)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--text1)' }}>契約形式設定</h3>
                        <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text2)' }}>若刪除現有選項，將不影響過去已建檔之紀錄。</p>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <input
                                placeholder="新增契約形式..."
                                value={newContractType}
                                onChange={e => setNewContractType(e.target.value)}
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddOption('contract'); }}
                            />
                            <button className="btn-primary" onClick={() => handleAddOption('contract')} disabled={optionsSaving || !newContractType.trim()}>
                                新增
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {contractTypes.map(ct => (
                                <div key={ct} className="option-tag" style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    padding: '6px 14px',
                                    borderRadius: 20,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: 'var(--text1)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {ct}
                                    <button
                                        onClick={() => handleDeleteOption('contract', ct)}
                                        className="option-delete-btn"
                                        title="刪除"
                                        style={{
                                            background: '#e2e8f0',
                                            border: 'none',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            padding: 0,
                                            fontSize: 10,
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                    >✕</button>
                                </div>
                            ))}
                            {contractTypes.length === 0 && <span style={{ color: 'var(--text3)', fontSize: 14 }}>目前無選項</span>}
                        </div>
                    </div>
                </div>
            )
            }

            {/* Maintenance tab content */}
            {
                tab === 'maintenance' && (
                    <div className="maintenance-panel" style={{ animation: 'fadeIn 0.4s ease' }}>
                        <div className="admin-maintenance-card" style={{ padding: 24, background: '#fff', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                                <div className="maintenance-icon-wrapper" style={{
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: 'var(--primary)',
                                    padding: 16,
                                    borderRadius: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Wrench size={32} />
                                </div>
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
                )
            }

            {/* Users tab */}
            {
                tab === 'users' && (
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
                )
            }

            {/* Ledger accounts tab */}
            {
                tab === 'accounts' && (
                    <div className="accounts-panel">
                        {!isGuest && (
                            <div className="admin-action-bar">
                                <button className="btn-primary" onClick={startAddAccount}>
                                    <Plus size={18} /> 新增 ({selectedYear})
                                </button>

                                <button
                                    type="button"
                                    className={`btn-outline ${showAccImport ? 'active' : ''}`}
                                    onClick={() => setShowAccImport(!showAccImport)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                    <Upload size={18} /> 批次導入
                                </button>

                                {showAccImport && (
                                    <div className="batch-import-box" style={{ width: '100%' }}>
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
                            </div>
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
                )
            }

            {/* Vendors tab */}
            {
                tab === 'vendors' && (
                    <div className="accounts-panel">
                        {!isGuest && (
                            <div className="admin-action-bar">
                                <button className="btn-primary" onClick={startAddVendor}>
                                    <Plus size={18} /> 新增廠商
                                </button>

                                <button
                                    type="button"
                                    className={`btn-outline ${showVendorImport ? 'active' : ''}`}
                                    onClick={() => setShowVendorImport(!showVendorImport)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                    <Upload size={18} /> 批次導入
                                </button>

                                {showVendorImport && (
                                    <div className="batch-import-box v-batch" style={{ width: '100%' }}>
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
                            </div>
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
                )
            }
            <LedgerAccountModal
                isOpen={showAccModal}
                onClose={() => setShowAccModal(false)}
                onSave={handleSaveAccount}
                editingAccount={editingAcc}
                selectedYear={selectedYear}
                saving={accSaving}
            />

            <VendorModal
                isOpen={showVendorModal}
                onClose={() => setShowVendorModal(false)}
                onSave={handleSaveVendor}
                editingVendor={editingVendor}
                saving={vendorSaving}
            />

            <ConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type}
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            />
        </div >
    );
};

export default AdminPage;
