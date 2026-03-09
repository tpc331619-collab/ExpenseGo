/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    getNotebookEntries,
    addNotebookEntry,
    updateNotebookEntry,
    deleteNotebookEntry,
    getPaginatedPurchases,
} from '../lib/firestore';
import type { NotebookEntry, Purchase } from '../types';
import { Plus, Edit2, Trash2, X, CheckCircle, ChevronLeft, ChevronRight, FileText, AlertTriangle, AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import './ContractHistoryPage.css';
import '../components/PurchaseModal.css'; // Reuse modal styles

// ── Helper: Calculate Contract Status ─────────────────────────────────────────
const getRenewalInfo = (endDateStr: string, status: NotebookEntry['status']) => {
    if (status === '已結案' || !endDateStr) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { type: 'expired', days: Math.abs(diffDays), label: `已逾期 (${Math.abs(diffDays)}天)` };
    if (diffDays <= 120) return { type: 'warning', days: diffDays, label: `即將到期 (${diffDays}天)` };
    return { type: 'safe', days: diffDays, label: `剩餘 ${diffDays}天` };
};

// ── Edit / Add Modal ──────────────────────────────────────────────────────────
interface EntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { caseName: string; vendor: string; contractType: string; totalAmount: number; procNumber: string; startDate: string; endDate: string; status: NotebookEntry['status'] }) => Promise<void>;
    editingEntry: NotebookEntry | null;
    saving: boolean;
    contractTypes: string[];
}

const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, onSave, editingEntry, saving, contractTypes }) => {
    const [caseName, setCaseName] = useState('');
    const [vendor, setVendor] = useState('');
    const [contractType, setContractType] = useState(contractTypes[0] || '勞務契約');
    const [totalAmount, setTotalAmount] = useState<string>('');
    const [procNumber, setProcNumber] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState<NotebookEntry['status']>('執行中');

    useEffect(() => {
        if (editingEntry) {
            setCaseName(editingEntry.caseName);
            setVendor(editingEntry.vendor || '');
            setContractType(editingEntry.contractType || '勞務契約');
            setTotalAmount(editingEntry.totalAmount?.toString() || '');
            setProcNumber(editingEntry.procNumber);
            setStartDate(editingEntry.startDate);
            setEndDate(editingEntry.endDate);
            setStatus(editingEntry.status || '執行中');
        } else {
            setCaseName('');
            setVendor('');
            setContractType(contractTypes[0] || '勞務契約');
            setTotalAmount('');
            setProcNumber('');
            setStartDate('');
            setEndDate('');
            setStatus('執行中');
        }
    }, [editingEntry, isOpen, contractTypes]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box admin-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{editingEntry ? '編輯契約履歷' : '新增契約履歷'}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ caseName, vendor, contractType, totalAmount: parseFloat(totalAmount) || 0, procNumber, startDate, endDate, status }); }}>
                    <div className="form-group">
                        <label>廠商 <span className="required">*</span></label>
                        <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="請輸入廠商名稱" required />
                    </div>
                    <div className="form-group-row" style={{ display: 'flex', gap: '15px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>契約形式 <span className="required">*</span></label>
                            <select value={contractType} onChange={e => setContractType(e.target.value)}>
                                {contractTypes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>總額 (未稅) <span className="required">*</span></label>
                            <input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0" required />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>採購案號 <span className="required">*</span></label>
                        <input value={caseName} onChange={e => setCaseName(e.target.value)} placeholder="請輸入採購案號" required />
                    </div>
                    <div className="form-group">
                        <label>採購編號 <span className="required">*</span></label>
                        <input value={procNumber} onChange={e => setProcNumber(e.target.value)} placeholder="請輸入採購編號" required />
                    </div>
                    <div className="form-group">
                        <label>狀態 <span className="required">*</span></label>
                        <select value={status} onChange={e => setStatus(e.target.value as NotebookEntry['status'])}>
                            <option value="執行中">執行中</option>
                            <option value="已結案">已結案</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>契約起訖 <span className="required">*</span></label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ flex: 1 }} />
                            <span style={{ color: 'var(--text3)', fontWeight: 600 }}>~</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={{ flex: 1 }} />
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

// ── Confirm Delete Modal ──────────────────────────────────────────────────────
interface ConfirmDeleteProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteProps> = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="confirm-content">
                    <div className="confirm-icon icon-danger">⚠️</div>
                    <h3>刪除契約履歷</h3>
                    <p>確定要刪除此筆紀錄？<br />此操作無法復原。</p>
                </div>
                <div className="confirm-footer">
                    <button className="btn-outline" onClick={onCancel}>取消</button>
                    <button className="btn-danger-confirm" onClick={onConfirm}>確定刪除</button>
                </div>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const ContractHistoryPage: React.FC = () => {
    const { appUser } = useAuth();
    const { contractTypes } = useApp();

    const [entries, setEntries] = useState<NotebookEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<NotebookEntry | null>(null);
    const [saving, setSaving] = useState(false);

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Related Purchases State
    const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
    const [relatedPurchases, setRelatedPurchases] = useState<Purchase[]>([]);
    const [purchasesLoading, setPurchasesLoading] = useState(false);

    const fetchEntries = async () => {
        if (!appUser) return;
        setLoading(true);
        try {
            const data = await getNotebookEntries(appUser.uid);

            // 排序邏輯：1. 執行中優先 2. 建立時間從舊到新 (or 可改為從新到舊)
            const sorted = data.sort((a, b) => {
                // 已結案排在最後
                if (a.status === '已結案' && b.status !== '已結案') return 1;
                if (a.status !== '已結案' && b.status === '已結案') return -1;

                //同狀態則依時間排序 (由新排到舊)
                return b.createdAt.toMillis() - a.createdAt.toMillis();
            });

            setEntries(sorted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appUser]);

    const handleSave = async (data: { caseName: string; vendor: string; contractType: string; totalAmount: number; procNumber: string; startDate: string; endDate: string; status: NotebookEntry['status'] }) => {
        if (!appUser) return;
        setSaving(true);
        try {
            if (editingEntry) {
                await updateNotebookEntry(editingEntry.id, data);
            } else {
                await addNotebookEntry(data, appUser.uid);
            }
            setShowModal(false);
            setEditingEntry(null);
            await fetchEntries();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            alert('儲存失敗：' + msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTargetId) return;
        try {
            await deleteNotebookEntry(deleteTargetId);
            setDeleteTargetId(null);
            await fetchEntries();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            alert('刪除失敗：' + msg);
        }
    };

    const handleCloseCase = async (entry: NotebookEntry) => {
        try {
            await updateNotebookEntry(entry.id, { status: '已結案' });
            await fetchEntries();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            alert('結案失敗：' + msg);
        }
    };

    const startAdd = () => { setEditingEntry(null); setShowModal(true); };
    const startEdit = (entry: NotebookEntry) => { setEditingEntry(entry); setShowModal(true); };

    const copyProcNumber = (entry: NotebookEntry) => {
        navigator.clipboard.writeText(entry.procNumber);
        setCopiedId(entry.id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const handleVendorClick = async (vendorName: string, entryStartDate: string, entryEndDate: string) => {
        if (!vendorName) return;
        const trimmedVendor = vendorName.trim();
        setSelectedVendor(trimmedVendor);
        setPurchasesLoading(true);
        setRelatedPurchases([]);

        try {
            const startYear = parseInt(entryStartDate.split('-')[0]);
            const endYear = parseInt(entryEndDate.split('-')[0]);
            const contractStart = new Date(entryStartDate).getTime();
            const contractEnd = new Date(entryEndDate).getTime();

            if (isNaN(startYear) || isNaN(endYear)) throw new Error('日期格式錯誤');

            let allMatchedPurchases: Purchase[] = [];

            // 跨年份搜尋 (從起始年到結束年逐年查詢)
            for (let y = startYear; y <= endYear; y++) {
                const result = await getPaginatedPurchases(y, 100, null, { vendor: trimmedVendor });

                // 在前端過濾確切的日期區間
                const yearFiltered = result.data.filter(p => {
                    const pDate = p.purchaseDate.toMillis();
                    return pDate >= contractStart && pDate <= contractEnd;
                });

                allMatchedPurchases = [...allMatchedPurchases, ...yearFiltered];
            }

            // 最後依日期降序排序
            allMatchedPurchases.sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());

            setRelatedPurchases(allMatchedPurchases);

            // Auto scroll
            setTimeout(() => {
                const section = document.querySelector('.ch-related-section');
                section?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (err: unknown) {
            console.error('Fetch related purchases failed:', err);
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('index')) {
                alert('系統正在建立搜尋索引，請稍候再試。');
            }
        } finally {
            setPurchasesLoading(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">契約履歷</h1>
            </div>

            {/* Smart Insight Bar */}
            {!loading && (
                <div className="ch-insight-bar">
                    {entries.length > 0 && (
                        <>
                            <div className="insight-item">
                                <div className="insight-icon info"><FileText size={16} /></div>
                                <div className="insight-content">
                                    <span className="insight-label">執行中合約</span>
                                    <span className="insight-value">{entries.filter(e => e.status === '執行中').length}</span>
                                </div>
                            </div>
                            {(() => {
                                const expiringCount = entries.filter(e => {
                                    const info = getRenewalInfo(e.endDate, e.status);
                                    return info?.type === 'warning';
                                }).length;
                                if (expiringCount > 0) {
                                    return (
                                        <div className="insight-item warning pulse-border">
                                            <div className="insight-icon warn"><AlertTriangle size={16} /></div>
                                            <div className="insight-content">
                                                <span className="insight-label">120天內到期</span>
                                                <span className="insight-value">{expiringCount}</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            {(() => {
                                const expiredCount = entries.filter(e => {
                                    const info = getRenewalInfo(e.endDate, e.status);
                                    return info?.type === 'expired';
                                }).length;
                                if (expiredCount > 0) {
                                    return (
                                        <div className="insight-item danger">
                                            <div className="insight-icon danger"><AlertCircle size={16} /></div>
                                            <div className="insight-content">
                                                <span className="insight-label">已逾期(未結)</span>
                                                <span className="insight-value">{expiredCount}</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </>
                    )}

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                        <button className="btn-primary" onClick={startAdd} style={{ height: '44px', borderRadius: '10px', padding: '0 24px' }}>
                            <Plus size={18} /> 新增契約
                        </button>
                    </div>
                </div>
            )}

            <div className="ch-table-wrapper table-wrapper">
                {loading ? (
                    <div className="full-loading"><div className="spinner" /></div>
                ) : entries.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <p>尚未加入任何契約履歷</p>
                        <button className="btn-primary mt-3" onClick={startAdd} style={{ marginTop: '15px' }}>
                            <Plus size={16} className="mr-2" style={{ marginRight: '8px' }} /> 新增第一筆契約
                        </button>
                    </div>
                ) : (
                    <>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, color: 'var(--text3)' }}>#</th>
                                    <th style={{ minWidth: 120 }}>廠商</th>
                                    <th style={{ width: 130, whiteSpace: 'nowrap' }}>契約形式</th>
                                    <th style={{ width: 110 }}>總額(未稅)</th>
                                    <th style={{ minWidth: 150 }}>採購案號</th>
                                    <th style={{ width: 140, whiteSpace: 'nowrap' }}>採購編號</th>
                                    <th style={{ width: 150 }}>契約期間</th>
                                    <th style={{ width: 90 }}>狀態</th>
                                    <th style={{ width: 100, textAlign: 'center' }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((entry, idx) => (
                                    <tr key={entry.id} className={entry.status === '已結案' ? 'row-closed' : ''}>
                                        <td style={{ color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>
                                            {(currentPage - 1) * pageSize + idx + 1}
                                        </td>
                                        <td
                                            style={{ fontWeight: 600, color: 'var(--blue)', cursor: 'pointer', textDecoration: 'underline' }}
                                            onClick={() => handleVendorClick(entry.vendor, entry.startDate, entry.endDate)}
                                            title={`查看 ${entry.vendor} 的採購紀錄`}
                                        >
                                            {entry.vendor}
                                        </td>
                                        <td>
                                            <span style={{
                                                background: '#f1f5f9',
                                                border: '1px solid #e2e8f0',
                                                color: '#334155',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {entry.contractType}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                            ${entry.totalAmount?.toLocaleString()}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{entry.caseName}</td>
                                        <td>
                                            <div
                                                className={`clickable-code ${copiedId === entry.id ? 'copied' : ''}`}
                                                onClick={() => copyProcNumber(entry)}
                                                title="點擊複製採購編號"
                                            >
                                                <code>{entry.procNumber}</code>
                                                {copiedId === entry.id && <span className="copy-feedback">已複製!</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="date-period">
                                                <span className="date-start">{entry.startDate}</span>
                                                <span className="date-end">
                                                    {entry.endDate}
                                                    {(() => {
                                                        const info = getRenewalInfo(entry.endDate, entry.status);
                                                        if (info) {
                                                            return (
                                                                <span className={`renewal-badge ${info.type}`}>
                                                                    {info.label}
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`status-pill ${entry.status === '執行中' ? 'active' :
                                                entry.status === '已結案' ? 'closed' : 'terminated'
                                                }`}>
                                                <span className="status-dot"></span>
                                                <span className="status-text">{entry.status}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-group">
                                                {entry.status !== '已結案' && (
                                                    <button className="icon-btn-fancy close" onClick={() => handleCloseCase(entry)} title="結案">
                                                        <CheckCircle size={14} />
                                                    </button>
                                                )}
                                                <button className="icon-btn-fancy edit" onClick={() => startEdit(entry)} title="編輯">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button className="icon-btn-fancy delete" onClick={() => setDeleteTargetId(entry.id)} title="刪除">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination UI */}
                        {entries.length > pageSize && (
                            <div className="pagination-wrapper">
                                <div className="pagination-info">
                                    頁次 {currentPage} / {Math.ceil(entries.length / pageSize)} (共 {entries.length} 筆)
                                </div>
                                <div className="pagination-bar">
                                    <button
                                        className="pag-btn icon"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        title="上一頁"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="pag-numbers">
                                        {Array.from({ length: Math.ceil(entries.length / pageSize) }).map((_, i) => (
                                            <button
                                                key={i}
                                                className={`pag-num ${currentPage === i + 1 ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(i + 1)}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        className="pag-btn icon"
                                        disabled={currentPage === Math.ceil(entries.length / pageSize)}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        title="下一頁"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Related Purchases Section */}
            {selectedVendor && (
                <div className="ch-related-section" style={{ marginTop: 40, borderTop: '2px solid #e2e8f0', paddingTop: 20 }}>
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-dark)' }}>
                            相關採購紀錄: <span style={{ color: 'var(--blue)' }}>{selectedVendor}</span>
                        </h2>
                        <button className="btn-outline small" onClick={() => setSelectedVendor(null)}>關閉</button>
                    </div>

                    {purchasesLoading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center' }}><div className="spinner" /></div>
                    ) : relatedPurchases.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 0' }}>
                            <p>本年度查無相關採購紀錄</p>
                        </div>
                    ) : (
                        <div className="ch-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 100 }}>日期</th>
                                        <th>品名/項目</th>
                                        <th style={{ width: 120 }}>金額(未稅)</th>
                                        <th style={{ width: 150 }}>文件案號</th>
                                        <th>科目名稱</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {relatedPurchases.map((p) => (
                                        <tr key={p.id}>
                                            <td style={{ fontSize: 13, color: '#64748b' }}>
                                                {p.purchaseDate.toDate().toLocaleDateString('zh-TW')}
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{p.title}</td>
                                            <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                                ${p.amount.toLocaleString()}
                                            </td>
                                            <td style={{ fontSize: 13, color: '#64748b' }}>{p.docNumber || '-'}</td>
                                            <td style={{ fontSize: 13, color: '#64748b' }}>{p.ledgerAccountName}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <EntryModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingEntry(null); }}
                onSave={handleSave}
                editingEntry={editingEntry}
                saving={saving}
                contractTypes={contractTypes}
            />

            <ConfirmDeleteModal
                isOpen={!!deleteTargetId}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTargetId(null)}
            />
        </div>
    );
};

export default ContractHistoryPage;
