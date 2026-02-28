import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { deletePurchaseGroup, getPaginatedPurchases, getAllUsers } from '../lib/firestore';
import type { Purchase, AppUser } from '../types';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Upload, Download, Copy, Pencil, Trash2 } from 'lucide-react';
import PurchaseModal from '../components/PurchaseModal';
import VendorDetailCard from '../components/VendorDetailCard';
import './PurchaseListPage.css';

const PurchaseListPage: React.FC = () => {
    const { ledgerAccounts, selectedYear } = useApp();
    const { appUser } = useAuth();
    const isGuest = appUser?.role === 'guest';

    const [localPurchases, setLocalPurchases] = useState<Purchase[]>([]);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Users fetched for admin view
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState<Purchase | null>(null);
    const [isCopy, setIsCopy] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [filterAccount, setFilterAccount] = useState('');
    const [filterCreator, setFilterCreator] = useState('');
    const [filterReqType, setFilterReqType] = useState('');
    const [filterPurType, setFilterPurType] = useState('');
    const [vendorDetail, setVendorDetail] = useState<string | null>(null);

    const fetchPurchases = async (isLoadMore = false) => {
        if (!isLoadMore) setLoading(true);
        else setLoadingMore(true);

        try {
            const res = await getPaginatedPurchases(
                selectedYear,
                20,
                isLoadMore ? lastDoc : null,
                {
                    uid: appUser?.role === 'admin' ? (filterCreator || undefined) : appUser?.role === 'guest' ? undefined : appUser?.uid,
                    ledgerAccountId: filterAccount || undefined,
                    requisitionType: filterReqType || undefined,
                    purchaseType: filterPurType || undefined,
                }
            );

            if (isLoadMore) {
                setLocalPurchases(prev => [...prev, ...res.data]);
            } else {
                setLocalPurchases(res.data);
            }
            setLastDoc(res.lastDoc);
            setHasMore(res.hasMore);
        } catch (err) {
            console.error('Fetch failed:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchPurchases();
    }, [selectedYear, filterAccount, filterCreator, filterReqType, filterPurType, appUser]);

    useEffect(() => {
        if (appUser?.role === 'admin') {
            getAllUsers().then(users => {
                const map: Record<string, string> = {};
                users.forEach(u => map[u.uid] = u.displayName);
                setUsersMap(map);
            });
        }
    }, [appUser]);

    const filtered = useMemo(() => {
        return localPurchases;
    }, [localPurchases]);

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
            fetchPurchases();
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

    const closeModal = (refresh = false) => {
        setShowModal(false);
        setEditTarget(null);
        setIsCopy(false);
        if (refresh) fetchPurchases();
    };

    const downloadTemplate = () => {
        const data = [
            {
                '日期': '2026-01-01',
                '廠商名稱': '範例-國泰化工',
                '品名': '範例-辦公用品費',
                '科目代碼': 'M54000',
                '金額(未稅)': 1000,
                '請購類型': '經MM',
                '採購性質': '勞務',
                '文件號碼': 'DOC12345',
                '備註': '範例描述'
            }
        ];
        // Create worksheet with specific column formatting if possible, 
        // but for CSV/XLSX simple JSON is usually enough.
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '採購導入範本');
        XLSX.writeFile(wb, `採購紀錄導入範本_${selectedYear}.xlsx`);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target?.result;
                // Use array type for better compatibility
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json: any[] = XLSX.utils.sheet_to_json(sheet, {
                    raw: false,
                    dateNF: 'yyyy-mm-dd'
                });

                if (json.length === 0) {
                    alert('Excel 內無資料');
                    return;
                }

                setLoading(true);
                let success = 0;
                let errors: string[] = [];

                const { addPurchase } = await import('../lib/firestore');

                json.forEach((row, index) => {
                    const rowNum = index + 2;
                    const dateStr = String(row['日期'] || '').trim();
                    const vendor = String(row['廠商名稱'] || '').trim();
                    const title = String(row['品名'] || '').trim();
                    const accCode = String(row['科目代碼'] || '').trim();
                    const amountRaw = row['金額(未稅)'];
                    const amount = parseFloat(amountRaw || '0');
                    const reqType = String(row['請購類型'] || '經MM').trim();
                    const purType = String(row['採購性質'] || '勞務').trim();
                    const docNum = String(row['文件號碼'] || '').trim();
                    const note = String(row['備註'] || '').trim();

                    if (vendor.startsWith('範例-') || title.startsWith('範例-')) return;

                    const rowPrefix = `第 ${rowNum} 列：`;

                    // 1. Basic empty check
                    if (!dateStr) { errors.push(`${rowPrefix}「日期」不可為空`); return; }

                    // 2. Strict Date Validation & Year Fix
                    let finalDate = dateStr;
                    let testDate = new Date(dateStr);

                    // If simple parse fails, try to add current year (e.g., for "2/27" or "2月27日")
                    if (isNaN(testDate.getTime())) {
                        const cleanedDate = dateStr.replace(/[月日]/g, '-').replace(/-+$/, '');
                        const tryDateStr = `${selectedYear}-${cleanedDate}`;
                        const retryDate = new Date(tryDateStr);

                        if (!isNaN(retryDate.getTime())) {
                            testDate = retryDate;
                            // Format to YYYY-MM-DD string
                            finalDate = retryDate.toISOString().split('T')[0];
                        }
                    }

                    if (isNaN(testDate.getTime())) {
                        errors.push(`${rowPrefix}「日期」格式錯誤 [${dateStr}] (請提供包含年份的完整日期，例如：${selectedYear}-02-27)`);
                        return;
                    }

                    // Ensure finalDate is formatted correctly for our system
                    if (!finalDate.includes('-')) {
                        finalDate = testDate.toISOString().split('T')[0];
                    }

                    if (!vendor) { errors.push(`${rowPrefix}「廠商名稱」不可為空`); return; }
                    if (!title) { errors.push(`${rowPrefix}「品名」不可為空`); return; }
                    if (!accCode) { errors.push(`${rowPrefix}「科目代碼」不可為空`); return; }
                    if (isNaN(amount) || amount <= 0) {
                        errors.push(`${rowPrefix}「金額」輸入無效 [${amountRaw}] (必須為大於 0 的數字)`);
                        return;
                    }

                    const validReqTypes = ['經MM', '非經MM'];
                    const validPurTypes = ['勞務', '財務', '工程'];
                    if (!validReqTypes.includes(reqType)) {
                        errors.push(`${rowPrefix}「請購類型」錯誤 [${reqType}] (應為：經MM 或 非經MM)`);
                        return;
                    }
                    if (!validPurTypes.includes(purType)) {
                        errors.push(`${rowPrefix}「採購性質」錯誤 [${purType}] (應為：勞務、財務 或 工程)`);
                        return;
                    }

                    const acc = ledgerAccounts.find(a => a.code === accCode);
                    if (!acc) {
                        errors.push(`${rowPrefix}代碼 [${accCode}] 找不到對應科目`);
                        return;
                    }

                    row._valid = true;
                    row._processed = {
                        data: {
                            purchaseDate: finalDate, // 使用修正後的日期資料
                            vendor,
                            purchaseType: purType,
                            requisitionType: reqType,
                            docNumber: docNum,
                            note: note,
                            items: [{
                                title,
                                amount: amount.toString(),
                                ledgerAccountId: acc.id,
                                ledgerAccountName: acc.name
                            }]
                        },
                        rowNum
                    };
                });

                for (const row of json) {
                    if (!row._valid) continue;
                    const { data, rowNum } = row._processed;
                    try {
                        await addPurchase(data, appUser!.uid);
                        success++;
                    } catch (err: any) {
                        errors.push(`第 ${rowNum} 列：資料庫存入失敗 (${err.message})`);
                    }
                }

                let msg = `導入完成！成功：${success} 筆。`;
                if (errors.length > 0) {
                    msg += `\n\n發現以下錯誤：\n` + errors.slice(0, 10).join('\n');
                    if (errors.length > 10) msg += `\n...以及其他 ${errors.length - 10} 筆錯誤`;
                }
                alert(msg);
                fetchPurchases();
            } catch (err) {
                alert('處理失敗，請檢查 Excel 格式');
            } finally {
                setLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
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
                <div className="header-actions">
                    {!isGuest && (
                        <>
                            <label className="btn-outline btn-import-records">
                                <Upload size={16} /> 批次導入
                                <input type="file" accept=".xlsx, .xls" onChange={handleImport} hidden />
                            </label>
                            <button className="btn-outline-text" onClick={downloadTemplate}>
                                <Download size={14} /> 範本
                            </button>
                            <button className="btn-primary" onClick={() => setShowModal(true)}>＋ 新增採購</button>
                        </>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="list-controls" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div className="filter-group">
                    <span className="filter-label">科目</span>
                    <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
                        <option value="">全部科目</option>
                        {ledgerAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <span className="filter-label">請購</span>
                    <select value={filterReqType} onChange={(e) => setFilterReqType(e.target.value)}>
                        <option value="">全部</option>
                        <option value="經MM">經MM</option>
                        <option value="非經MM">非經MM</option>
                    </select>
                </div>
                <div className="filter-group">
                    <span className="filter-label">採購</span>
                    <select value={filterPurType} onChange={(e) => setFilterPurType(e.target.value)}>
                        <option value="">全部</option>
                        <option value="勞務">勞務</option>
                        <option value="財務">財務</option>
                        <option value="工程">工程</option>
                    </select>
                </div>
                {appUser?.role === 'admin' && (
                    <div className="filter-group">
                        <span className="filter-label">建立人</span>
                        <select value={filterCreator} onChange={(e) => setFilterCreator(e.target.value)}>
                            <option value="">所有人</option>
                            {Object.entries(usersMap).map(([uid, name]) => (
                                <option key={uid} value={uid}>{name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            {/* Summary */}
            <div className="list-summary">
                {selectedYear} 年共 <strong>{filtered.length}</strong> 筆，合計 <strong>{fmt(totalAmount)}</strong>
            </div>

            {/* Table */}
            <div className="table-wrapper">
                {loading ? (
                    <div className="full-loading"><div className="spinner" /></div>
                ) : filtered.length === 0 ? (
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
                                {appUser?.role === 'admin' && <th>建立人</th>}
                                {!isGuest && <th>操作</th>}
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
                                                            <div
                                                                className="vendor-name-clickable"
                                                                onClick={() => setVendorDetail(p.vendor)}
                                                                title="查看廠商資料卡"
                                                            >
                                                                {p.vendor}
                                                            </div>
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
                                                    {appUser?.role === 'admin' && (
                                                        <td data-label="建立人">
                                                            <div style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 500 }}>
                                                                {usersMap[p.createdBy] || '未知'}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {!isGuest && (
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
                                                    )}
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

            {/* Load More */}
            {hasMore && (
                <div className="load-more-box">
                    <button
                        className="btn-outline"
                        onClick={() => fetchPurchases(true)}
                        disabled={loadingMore}
                    >
                        {loadingMore ? '載入中...' : '載入更多'}
                    </button>
                </div>
            )}

            {showModal && (
                <PurchaseModal
                    onClose={(refresh) => closeModal(refresh === true)}
                    editPurchase={editTarget}
                    isCopy={isCopy}
                />
            )}

            {vendorDetail && (
                <VendorDetailCard
                    vendorName={vendorDetail}
                    onClose={() => setVendorDetail(null)}
                />
            )}
        </div >
    );
};

export default PurchaseListPage;
