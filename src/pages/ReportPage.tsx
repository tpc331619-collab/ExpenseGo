import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { exporttoExcel } from '../lib/excelExport';
import type { AnnualSummaryByAccount, AnnualSummaryByVendor, AnnualSummaryByRequisition, AnnualSummaryByPurchaseType } from '../types';
import './ReportPage.css';

type Tab = 'account' | 'vendor' | 'requisition' | 'purchaseType';

const ReportPage: React.FC = () => {
    const { purchases, ledgerAccounts, selectedYear: year } = useApp();
    const [tab, setTab] = useState<Tab>('account');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    const yearPurchases = purchases; // purchases are already filtered by year in context

    const byAccount: AnnualSummaryByAccount[] = useMemo(() => {
        const map: Record<string, AnnualSummaryByAccount> = {};
        yearPurchases.forEach((p) => {
            if (!map[p.ledgerAccountId]) {
                const acc = ledgerAccounts.find(a => a.id === p.ledgerAccountId);
                map[p.ledgerAccountId] = {
                    ledgerAccountId: p.ledgerAccountId,
                    ledgerAccountCode: acc?.code || '未知',
                    ledgerAccountName: p.ledgerAccountName,
                    total: 0,
                    count: 0,
                    items: []
                };
            }
            map[p.ledgerAccountId].total += p.amount;
            map[p.ledgerAccountId].count += 1;
            map[p.ledgerAccountId].items.push(p);
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [yearPurchases, ledgerAccounts]);

    const byVendor: AnnualSummaryByVendor[] = useMemo(() => {
        const map: Record<string, AnnualSummaryByVendor> = {};
        yearPurchases.forEach((p) => {
            if (!map[p.vendor]) map[p.vendor] = { vendor: p.vendor, total: 0, count: 0, items: [] };
            map[p.vendor].total += p.amount;
            map[p.vendor].count += 1;
            map[p.vendor].items.push(p);
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [yearPurchases]);

    const byRequisition: AnnualSummaryByRequisition[] = useMemo(() => {
        const map: Record<string, AnnualSummaryByRequisition> = {};
        yearPurchases.forEach((p) => {
            const type = p.requisitionType || '未分類';
            if (!map[type]) map[type] = { type, total: 0, count: 0, items: [] };
            map[type].total += p.amount;
            map[type].count += 1;
            map[type].items.push(p);
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [yearPurchases]);

    const byPurchaseType: AnnualSummaryByPurchaseType[] = useMemo(() => {
        const map: Record<string, AnnualSummaryByPurchaseType> = {};
        yearPurchases.forEach((p) => {
            const type = p.purchaseType || '未分類';
            if (!map[type]) map[type] = { type, total: 0, count: 0, items: [] };
            map[type].total += p.amount;
            map[type].count += 1;
            map[type].items.push(p);
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [yearPurchases]);

    const grandTotal = yearPurchases.reduce((s, p) => s + p.amount, 0);

    const fmt = (n: number) => `NT$ ${n.toLocaleString()}`;
    const fmtDate = (ts: import('firebase/firestore').Timestamp) => {
        const d = ts.toDate();
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            await exporttoExcel(year, yearPurchases, byAccount, byVendor, byRequisition, byPurchaseType, ledgerAccounts);
        } finally {
            setExporting(false);
        }
    };

    const pct = (v: number) => grandTotal ? ((v / grandTotal) * 100).toFixed(1) : '0.0';

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">年度採購報表</h1>
                <div className="report-actions">
                    <button className="btn-export" onClick={handleExport} disabled={exporting}>
                        {exporting ? '匯出中⋯' : '📥 匯出 Excel'}
                    </button>
                </div>
            </div>

            {/* Grand total */}
            <div className="report-kpi">
                <div className="kpi-card accent-purple">
                    <div className="kpi-label">{year} 年度合計</div>
                    <div className="kpi-value">{fmt(grandTotal)}</div>
                </div>
                <div className="kpi-card accent-blue">
                    <div className="kpi-label">採購筆數</div>
                    <div className="kpi-value">{yearPurchases.length} 筆</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="report-tabs">
                <button className={`tab-btn ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>
                    依總帳科目
                </button>
                <button className={`tab-btn ${tab === 'vendor' ? 'active' : ''}`} onClick={() => setTab('vendor')}>
                    依廠商
                </button>
                <button className={`tab-btn ${tab === 'requisition' ? 'active' : ''}`} onClick={() => setTab('requisition')}>
                    依請購類型
                </button>
                <button className={`tab-btn ${tab === 'purchaseType' ? 'active' : ''}`} onClick={() => setTab('purchaseType')}>
                    依採購類型
                </button>
            </div>

            {/* Account summary */}
            {tab === 'account' && (
                <div className="report-sections">
                    {byAccount.length === 0 ? (
                        <div className="empty-state">
                            <svg className="empty-svg" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 12C16 9.79086 17.7909 8 20 8H36L48 20V52C48 54.2091 46.2091 56 44 56H20C17.7909 56 16 54.2091 16 52V12Z" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                                <path d="M36 8V20H48" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                                <circle cx="32" cy="36" r="8" stroke="var(--primary)" strokeWidth="2" opacity="0.5" />
                                <path d="M38 42L42 46" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                            </svg>
                            <p>此年度無採購紀錄</p>
                        </div>
                    ) : byAccount.map((acc) => (
                        <div className="report-section" key={acc.ledgerAccountId}>
                            <div className="report-section-header" onClick={() => setExpandedId(expandedId === acc.ledgerAccountId ? null : acc.ledgerAccountId)}>
                                <div className="rs-left">
                                    <span className="rs-expand">{expandedId === acc.ledgerAccountId ? '▾' : '▸'}</span>
                                    <span className="rs-name">{acc.ledgerAccountCode}</span>
                                    <span className="rs-count">{acc.count} 筆</span>
                                </div>
                                <div className="rs-right">
                                    <div className="rs-bar-wrap">
                                        <div className="rs-bar" style={{ width: `${pct(acc.total)}%` }} />
                                    </div>
                                    <span className="rs-pct">{pct(acc.total)}%</span>
                                    <span className="rs-amount">{fmt(acc.total)}</span>
                                </div>
                            </div>
                            {expandedId === acc.ledgerAccountId && (
                                <div className="detail-table-wrap">
                                    <table className="detail-table">
                                        <thead>
                                            <tr><th>序號</th><th>日期</th><th>品名</th><th>廠商</th><th>金額 (未稅)</th><th>文件號碼</th><th>請購類型</th><th>採購類型</th></tr>
                                        </thead>
                                        <tbody>
                                            {acc.items.map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td className="td-center" style={{ color: 'var(--text3)', fontSize: '11px' }}>{idx + 1}</td>
                                                    <td>{fmtDate(item.purchaseDate)}</td>

                                                    <td>{item.title}</td>
                                                    <td>{item.vendor}</td>
                                                    <td>{fmt(item.amount)}</td>
                                                    <td className="td-center">
                                                        <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{item.docNumber || '-'}</div>
                                                    </td>
                                                    <td>{item.requisitionType}</td>
                                                    <td>{item.purchaseType}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Vendor summary */}
            {tab === 'vendor' && (
                <div className="report-sections">
                    {byVendor.length === 0 ? (
                        <div className="empty-state">
                            <svg className="empty-svg" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 12C16 9.79086 17.7909 8 20 8H36L48 20V52C48 54.2091 46.2091 56 44 56H20C17.7909 56 16 54.2091 16 52V12Z" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                                <path d="M36 8V20H48" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                                <circle cx="32" cy="36" r="8" stroke="var(--primary)" strokeWidth="2" opacity="0.5" />
                                <path d="M38 42L42 46" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                            </svg>
                            <p>此年度無採購紀錄</p>
                        </div>
                    ) : byVendor.map((v) => (
                        <div className="report-section" key={v.vendor}>
                            <div className="report-section-header" onClick={() => setExpandedId(expandedId === v.vendor ? null : v.vendor)}>
                                <div className="rs-left">
                                    <span className="rs-expand">{expandedId === v.vendor ? '▾' : '▸'}</span>
                                    <span className="rs-name">{v.vendor}</span>
                                    <span className="rs-count">{v.count} 筆</span>
                                </div>
                                <div className="rs-right">
                                    <div className="rs-bar-wrap">
                                        <div className="rs-bar" style={{ width: `${pct(v.total)}%` }} />
                                    </div>
                                    <span className="rs-pct">{pct(v.total)}%</span>
                                    <span className="rs-amount">{fmt(v.total)}</span>
                                </div>
                            </div>
                            {expandedId === v.vendor && (
                                <div className="detail-table-wrap">
                                    <table className="detail-table">
                                        <thead>
                                            <tr><th>日期</th><th>項次</th><th>品名</th><th>科目</th><th>金額 (未稅)</th><th>文件號碼</th><th>請購類型</th><th>採購類型</th></tr>
                                        </thead>
                                        <tbody>
                                            {v.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{fmtDate(item.purchaseDate)}</td>
                                                    <td className="td-center" style={{ color: 'var(--text3)', fontSize: '12px' }}>{item.itemNo}</td>
                                                    <td>{item.title}</td>
                                                    <td>{item.ledgerAccountName}</td>
                                                    <td className="td-amount">{fmt(item.amount)}</td>
                                                    <td className="td-center">
                                                        <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{item.docNumber || '-'}</div>
                                                    </td>
                                                    <td>{item.requisitionType}</td>
                                                    <td>{item.purchaseType}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Requisition summary */}
            {tab === 'requisition' && (
                <div className="report-sections">
                    {byRequisition.length === 0 ? (
                        <div className="empty-state">
                            <svg className="empty-svg" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 12C16 9.79086 17.7909 8 20 8H36L48 20V52C48 54.2091 46.2091 56 44 56H20C17.7909 56 16 54.2091 16 52V12Z" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                                <path d="M36 8V20H48" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                                <circle cx="32" cy="36" r="8" stroke="var(--primary)" strokeWidth="2" opacity="0.5" />
                                <path d="M38 42L42 46" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                            </svg>
                            <p>此年度無採購紀錄</p>
                        </div>
                    ) : byRequisition.map((r) => (
                        <div className="report-section" key={r.type}>
                            <div className="report-section-header" onClick={() => setExpandedId(expandedId === r.type ? null : r.type)}>
                                <div className="rs-left">
                                    <span className="rs-expand">{expandedId === r.type ? '▾' : '▸'}</span>
                                    <span className="rs-name">{r.type}</span>
                                    <span className="rs-count">{r.count} 筆</span>
                                </div>
                                <div className="rs-right">
                                    <div className="rs-bar-wrap">
                                        <div className="rs-bar" style={{ width: `${pct(r.total)}%` }} />
                                    </div>
                                    <span className="rs-pct">{pct(r.total)}%</span>
                                    <span className="rs-amount">{fmt(r.total)}</span>
                                </div>
                            </div>
                            {expandedId === r.type && (
                                <div className="detail-table-wrap">
                                    <table className="detail-table">
                                        <thead>
                                            <tr><th>日期</th><th>品名</th><th>廠商</th><th>科目</th><th>金額 (未稅)</th><th>請購類型</th><th>採購類型</th></tr>
                                        </thead>
                                        <tbody>
                                            {r.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{fmtDate(item.purchaseDate)}</td>
                                                    <td>{item.title}</td>
                                                    <td>{item.vendor}</td>
                                                    <td>{item.ledgerAccountName}</td>
                                                    <td className="td-amount">{fmt(item.amount)}</td>
                                                    <td>{item.requisitionType}</td>
                                                    <td>{item.purchaseType}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Purchase Type summary */}
            {tab === 'purchaseType' && (
                <div className="report-sections">
                    {byPurchaseType.length === 0 ? (
                        <div className="empty-state">
                            <svg className="empty-svg" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 12C16 9.79086 17.7909 8 20 8H36L48 20V52C48 54.2091 46.2091 56 44 56H20C17.7909 56 16 54.2091 16 52V12Z" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                                <path d="M36 8V20H48" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                                <circle cx="32" cy="36" r="8" stroke="var(--primary)" strokeWidth="2" opacity="0.5" />
                                <path d="M38 42L42 46" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                            </svg>
                            <p>此年度無採購紀錄</p>
                        </div>
                    ) : byPurchaseType.map((rt) => (
                        <div className="report-section" key={rt.type}>
                            <div className="report-section-header" onClick={() => setExpandedId(expandedId === rt.type ? null : rt.type)}>
                                <div className="rs-left">
                                    <span className="rs-expand">{expandedId === rt.type ? '▾' : '▸'}</span>
                                    <span className="rs-name">{rt.type}</span>
                                    <span className="rs-count">{rt.count} 筆</span>
                                </div>
                                <div className="rs-right">
                                    <div className="rs-bar-wrap">
                                        <div className="rs-bar" style={{ width: `${pct(rt.total)}%` }} />
                                    </div>
                                    <span className="rs-pct">{pct(rt.total)}%</span>
                                    <span className="rs-amount">{fmt(rt.total)}</span>
                                </div>
                            </div>
                            {expandedId === rt.type && (
                                <div className="detail-table-wrap">
                                    <table className="detail-table">
                                        <thead>
                                            <tr><th>日期</th><th>品名</th><th>廠商</th><th>科目</th><th>金額 (未稅)</th><th>採購類型</th></tr>
                                        </thead>
                                        <tbody>
                                            {rt.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{fmtDate(item.purchaseDate)}</td>
                                                    <td>{item.title}</td>
                                                    <td>{item.vendor}</td>
                                                    <td>{item.ledgerAccountName}</td>
                                                    <td className="td-amount">{fmt(item.amount)}</td>
                                                    <td>{item.purchaseType}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReportPage;
