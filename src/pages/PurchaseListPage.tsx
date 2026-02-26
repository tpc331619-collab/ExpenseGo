import React, { useState, useMemo, useEffect } from 'react';
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
        }).sort((a, b) => {
            const dateDiff = b.purchaseDate.toMillis() - a.purchaseDate.toMillis();
            if (dateDiff !== 0) return dateDiff;
            return b.createdAt.toMillis() - a.createdAt.toMillis();
        });
    }, [purchases, filterAccount, filterVendor, search]);

    const grouped = useMemo(() => {
        const groups: Record<string, Purchase[]> = {};
        filtered.forEach(p => {
            const d = p.purchaseDate.toDate();
            const monthKey = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(p);
        });
        return groups;
    }, [filtered]);

    const sortedMonthKeys = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);
    const [expandedMonths, setExpandedMonths] = useState<string[]>([]);

    useEffect(() => {
        if (sortedMonthKeys.length > 0 && expandedMonths.length === 0) {
            setExpandedMonths([sortedMonthKeys[0]]);
        }
    }, [sortedMonthKeys]);

    const toggleMonth = (key: string) => {
        setExpandedMonths(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]);
    };

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
                    {ledgerAccounts.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}
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
                                <th>序號</th>
                                <th>日期</th>
                                <th>廠商/品名</th>
                                <th>總帳科目</th>
                                <th>金額 (未稅 / 含稅)</th>
                                <th>類型</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedMonthKeys.map((monthKey) => {
                                const isExpanded = expandedMonths.includes(monthKey);
                                const items = grouped[monthKey];
                                return (
                                    <React.Fragment key={monthKey}>
                                        <tr className="month-group-header" onClick={() => toggleMonth(monthKey)}>
                                            <td colSpan={7}>
                                                <div className="month-header-content">
                                                    <span className={`arrow ${isExpanded ? 'open' : ''}`}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                                    </span>
                                                    <strong>{monthKey} 月份</strong>
                                                    <span className="month-count">({items.length} 筆)</span>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && items.map((p) => {
                                            const globalIdx = filtered.findIndex(f => f.id === p.id);
                                            return (
                                                <tr key={p.id}>
                                                    <td data-label="序號" className="td-index">{globalIdx + 1}</td>
                                                    <td data-label="日期" className="td-date">
                                                        <div className="text-bold">{fmtDate(p)}</div>
                                                    </td>
                                                    <td data-label="廠商/品名" className="td-vendor-title">
                                                        <div className="vertical-stack">
                                                            <div className="vendor-name">{p.vendor}</div>
                                                            <div className="title-name">{p.title}</div>
                                                        </div>
                                                    </td>
                                                    <td data-label="總帳科目">
                                                        <div className="ledger-code-simple">
                                                            {ledgerAccounts.find(a => a.id === p.ledgerAccountId)?.code || p.ledgerAccountName}
                                                        </div>
                                                    </td>
                                                    <td data-label="金額" className="td-amounts">
                                                        <div className="vertical-stack amount-stack">
                                                            <div className="amount-line">
                                                                <span className="val-excl">{fmt(p.amount)}</span>
                                                            </div>
                                                            <div className="amount-line subgroup">
                                                                <span className="val-incl">{fmt(Math.round(p.amount * 1.05))}</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td data-label="類型" className="td-types">
                                                        <div className="vertical-stack type-stack">
                                                            <div className="type-text requisition">{p.requisitionType}</div>
                                                            <div className="type-text purchase">{p.purchaseType}</div>
                                                        </div>
                                                    </td>
                                                    <td className="td-actions">
                                                        <div className="action-group">
                                                            <button className="action-btn-new copy" onClick={() => handleCopy(p)} title="複製">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                            </button>
                                                            <button className="action-btn-new edit" onClick={() => handleEdit(p)} title="編輯">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                            </button>
                                                            <button
                                                                className="action-btn-new delete"
                                                                onClick={() => handleDelete(p)}
                                                                disabled={deleting === p.id}
                                                                title="刪除"
                                                            >
                                                                {deleting === p.id ? '…' : (
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && <PurchaseModal onClose={closeModal} editPurchase={editTarget} isCopy={isCopy} />}
        </div >
    );
};

export default PurchaseListPage;
