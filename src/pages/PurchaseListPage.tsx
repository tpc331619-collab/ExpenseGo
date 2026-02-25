import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { deletePurchaseGroup } from '../lib/firestore';
import type { Purchase } from '../types';
import PurchaseModal from '../components/PurchaseModal';
import './PurchaseListPage.css';

const PurchaseListPage: React.FC = () => {
    const { purchases, ledgerAccounts, refreshPurchases, selectedYear } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState<Purchase | null>(null);
    const [isCopy, setIsCopy] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [filterAccount, setFilterAccount] = useState('');
    const [filterVendor, setFilterVendor] = useState('');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        return purchases.filter((p) => {
            const a = filterAccount ? p.ledgerAccountId === filterAccount : true;
            const v = filterVendor ? p.vendor.includes(filterVendor) : true;
            const s = search
                ? p.title.includes(search) || p.vendor.includes(search) || p.purchaseType.includes(search)
                : true;
            return a && v && s;
        });
    }, [purchases, filterAccount, filterVendor, search]);

    const totalAmount = useMemo(() => filtered.reduce((s, p) => s + p.amount, 0), [filtered]);

    const handleDelete = async (p: Purchase) => {
        if (!confirm('確定要刪除此筆採購紀錄？')) return;
        setDeleting(p.id);
        try {
            await deletePurchaseGroup(p.groupId, selectedYear);
            await refreshPurchases();
        } catch (err: any) {
            console.error('Delete failed:', err);
            alert('刪除失敗：' + (err.message || '請管理員確認權限'));
        } finally {
            setDeleting(null);
        }
    };

    const handleEdit = (p: Purchase) => {
        setEditTarget(p);
        setIsCopy(false);
        setShowModal(true);
    };

    const handleCopy = (p: Purchase) => {
        setEditTarget(p);
        setIsCopy(true);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditTarget(null);
        setIsCopy(false);
    };

    const fmt = (n: number) => `NT$ ${n.toLocaleString()}`;
    const fmtDate = (p: Purchase) => {
        const d = p.purchaseDate.toDate();
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{selectedYear} 年採購紀錄</h1>
                <button className="btn-primary" onClick={() => setShowModal(true)}>＋ 新增採購</button>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
                    <option value="">全部科目</option>
                    {ledgerAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>

                <input
                    placeholder="廠商篩選..."
                    value={filterVendor}
                    onChange={(e) => setFilterVendor(e.target.value)}
                />

                <input
                    placeholder="搜尋品名/廠商/類型..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Summary */}
            <div className="list-summary">
                {selectedYear} 年共 <strong>{filtered.length}</strong> 筆，合計 <strong>{fmt(totalAmount)}</strong>
            </div>

            {/* Table */}
            <div className="table-wrapper">
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <svg className="empty-svg" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 12C16 9.79086 17.7909 8 20 8H36L48 20V52C48 54.2091 46.2091 56 44 56H20C17.7909 56 16 54.2091 16 52V12Z" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                            <path d="M36 8V20H48" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                            <circle cx="32" cy="36" r="8" stroke="var(--primary)" strokeWidth="2" opacity="0.5" />
                            <path d="M38 42L42 46" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                        </svg>
                        <p>{selectedYear} 年尚無採購紀錄</p>
                    </div>
                ) : (
                    <table className="purchase-table">
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>項次</th>
                                <th>廠商</th>
                                <th>品名</th>
                                <th>總帳科目</th>
                                <th>金額 (未稅)</th>
                                <th>發票/文件號碼</th>
                                <th>請購類型</th>
                                <th>採購類型</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => (
                                <tr key={p.id}>
                                    <td className="td-date">{fmtDate(p)}</td>
                                    <td className="td-center" style={{ color: 'var(--text3)', fontSize: '12px' }}>{p.itemNo}</td>
                                    <td>{p.vendor}</td>
                                    <td className="td-title">{p.title}</td>
                                    <td><span className="tag-account">{p.ledgerAccountName}</span></td>
                                    <td className="td-amount">{fmt(p.amount)}</td>
                                    <td className="td-center">
                                        <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{p.invoice || '-'}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{p.docNumber || '-'}</div>
                                    </td>
                                    <td className="td-center">
                                        <span className={`tag-req ${p.requisitionType === '經MM' ? 'mm' : 'non-mm'}`}>
                                            {p.requisitionType}
                                        </span>
                                    </td>
                                    <td className="td-center">
                                        <span className={`tag-type ${p.purchaseType === '工程' ? 'eng' : p.purchaseType === '財務' ? 'fin' : 'srv'}`}>
                                            {p.purchaseType}
                                        </span>
                                    </td>
                                    <td className="td-actions">
                                        <button className="action-btn edit" onClick={() => handleCopy(p)} title="複製">📋</button>
                                        <button className="action-btn edit" onClick={() => handleEdit(p)} title="編輯">✏️</button>
                                        <button
                                            className="action-btn delete"
                                            onClick={() => handleDelete(p)}
                                            disabled={deleting === p.id}
                                            title="刪除"
                                        >
                                            {deleting === p.id ? '…' : '🗑️'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && <PurchaseModal onClose={closeModal} editPurchase={editTarget} isCopy={isCopy} />}
        </div>
    );
};

export default PurchaseListPage;
