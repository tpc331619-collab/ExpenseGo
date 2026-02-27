import React, { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import type { Purchase } from '../types';
import { DollarSign, Hash } from 'lucide-react';
import { getPurchases } from '../lib/firestore';
import DashboardSkeleton from '../components/DashboardSkeleton';
import VendorDetailCard from '../components/VendorDetailCard';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    const { purchases, ledgerAccounts, loadingData, selectedYear: currentYear, compareYear } = useApp();

    const [drillDown, setDrillDown] = React.useState<{ month: number; year: number; type?: 'vendor' | 'account'; target?: string } | null>(null);
    const [hiddenCategories, setHiddenCategories] = React.useState<Set<string>>(new Set());
    const [comparePurchases, setComparePurchases] = React.useState<Purchase[]>([]);
    const [vendorDetail, setVendorDetail] = React.useState<string | null>(null);
    const [monthRange, setMonthRange] = React.useState<'1-6' | '7-12' | '1-12'>('1-12');
    const [openPanels, setOpenPanels] = React.useState<Set<string>>(new Set());
    const togglePanel = (key: string) =>
        setOpenPanels(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

    // Fetch comparison data
    React.useEffect(() => {
        if (compareYear) {
            getPurchases(compareYear).then(data => {
                setComparePurchases(data);
            }).catch(() => { });
        } else {
            setComparePurchases([]);
        }
    }, [compareYear]);

    const stats = useMemo(() => {
        const yearPurchases = purchases;

        const total = yearPurchases.reduce((s, p) => s + p.amount, 0);
        const count = yearPurchases.length;

        // By account
        const byAccount: Record<string, { name: string; total: number; count: number }> = {};
        yearPurchases.forEach((p) => {
            if (!byAccount[p.ledgerAccountId]) {
                byAccount[p.ledgerAccountId] = { name: p.ledgerAccountName, total: 0, count: 0 };
            }
            byAccount[p.ledgerAccountId].total += p.amount;
            byAccount[p.ledgerAccountId].count += 1;
        });

        const topAccounts = Object.entries(byAccount)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5);

        // By vendor
        const byVendor: Record<string, { total: number; count: number }> = {};
        yearPurchases.forEach((p) => {
            if (!byVendor[p.vendor]) {
                byVendor[p.vendor] = { total: 0, count: 0 };
            }
            byVendor[p.vendor].total += p.amount;
            byVendor[p.vendor].count += 1;
        });

        const topVendors = Object.entries(byVendor)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5);

        // Budget Status (Mapping all accounts that have budget or spending)
        const budgetStatus = ledgerAccounts.map(acc => {
            const spent = byAccount[acc.id]?.total || 0;
            const budget = acc.budget || 0;
            const remaining = budget - spent;
            const percent = budget > 0 ? (spent / budget) * 100 : 0;
            return {
                id: acc.id,
                code: acc.code,
                name: acc.name,
                budget,
                spent,
                remaining,
                percent
            };
        }).filter(b => b.spent > 0).sort((a, b) => b.percent - a.percent);

        // Monthly stacked data
        const accountColors: Record<string, number> = {};
        let colorCounter = 0;

        const monthlyStacked = Array(12).fill(null).map(() => ({
            total: 0,
            categories: {} as Record<string, { name: string; amount: number; colorIdx: number }>
        }));
        const monthlyItems: Record<number, Purchase[]> = {};
        for (let i = 0; i < 12; i++) monthlyItems[i] = [];

        yearPurchases.forEach((p) => {
            const m = p.purchaseDate.toDate().getMonth();
            const accId = p.ledgerAccountId;

            if (accountColors[accId] === undefined) {
                accountColors[accId] = colorCounter % 10;
                colorCounter++;
            }

            if (!monthlyStacked[m].categories[accId]) {
                monthlyStacked[m].categories[accId] = {
                    name: p.ledgerAccountName,
                    amount: 0,
                    colorIdx: accountColors[accId]
                };
            }

            monthlyStacked[m].total += p.amount;
            monthlyStacked[m].categories[accId].amount += p.amount;
            monthlyItems[m].push(p);
        });

        // Sort items in each month by newest first
        Object.keys(monthlyItems).forEach((key) => {
            const m = parseInt(key);
            monthlyItems[m].sort((a: Purchase, b: Purchase) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
        });

        const monthly = monthlyStacked.map(m => m.total);

        // All active categories for legend
        const allCategories: { name: string; colorIdx: number }[] = [];
        const seenCats = new Set();
        yearPurchases.forEach(p => {
            if (!seenCats.has(p.ledgerAccountName)) {
                seenCats.add(p.ledgerAccountName);
                allCategories.push({
                    name: p.ledgerAccountName,
                    colorIdx: accountColors[p.ledgerAccountId]
                });
            }
        });

        // Monthly comparison totals and items
        const compareMonthly = Array(12).fill(0);
        const compareMonthlyItems: Record<number, Purchase[]> = {};
        for (let i = 0; i < 12; i++) compareMonthlyItems[i] = [];

        comparePurchases.forEach(p => {
            const m = p.purchaseDate.toDate().getMonth();
            compareMonthly[m] += p.amount;
            compareMonthlyItems[m].push(p);
        });

        // Sort comparison items
        Object.keys(compareMonthlyItems).forEach((key) => {
            const m = parseInt(key);
            compareMonthlyItems[m].sort((a: Purchase, b: Purchase) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
        });

        return { total, count, topAccounts, topVendors, budgetStatus, monthly, monthlyItems, monthlyStacked, allCategories, compareMonthly, compareMonthlyItems };
    }, [purchases, ledgerAccounts, currentYear, comparePurchases]);

    const filteredMonthlyStacked = useMemo(() => {
        return stats.monthlyStacked.map(m => {
            const filteredCats = Object.values(m.categories).filter(c => !hiddenCategories.has(c.name));
            const newTotal = filteredCats.reduce((sum, c) => sum + c.amount, 0);
            return { ...m, total: newTotal, categories: filteredCats };
        });
    }, [stats.monthlyStacked, hiddenCategories]);

    const visibleMonths = useMemo(() => {
        if (monthRange === '1-6') return [0, 1, 2, 3, 4, 5];
        if (monthRange === '7-12') return [6, 7, 8, 9, 10, 11];
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }, [monthRange]);

    const maxVal = Math.max(
        ...visibleMonths.map(mIdx => filteredMonthlyStacked[mIdx].total),
        ...visibleMonths.map(mIdx => stats.compareMonthly[mIdx]),
        1
    );

    const fmt = (n: number) =>
        n.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

    const [selectedBudget, setSelectedBudget] = React.useState<typeof stats.budgetStatus[0] | null>(null);

    const fmtDateShort = (p: Purchase) => {
        const d = p.purchaseDate.toDate();
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const drillDownItems = useMemo(() => {
        if (!drillDown) return [];
        let items: Purchase[] = [];
        if (drillDown.type === 'vendor') {
            const pool = drillDown.year === currentYear ? purchases : comparePurchases;
            items = pool.filter(p => p.vendor === drillDown.target);
        } else {
            const list = drillDown.year === currentYear ? stats.monthlyItems : stats.compareMonthlyItems;
            items = list[drillDown.month] || [];
        }
        return [...items].sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
    }, [drillDown, purchases, comparePurchases, stats.monthlyItems, stats.compareMonthlyItems, currentYear]);

    const drillDownTitle = useMemo(() => {
        if (!drillDown) return '';
        if (drillDown.type === 'vendor') return `${drillDown.target} - ${drillDown.year}年度採購明細`;
        return `${drillDown.year}年 ${drillDown.month + 1}月份採購紀錄`;
    }, [drillDown]);

    if (loadingData) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{currentYear} 年度採購總覽</h1>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card accent-emerald">
                    <div className="kpi-icon-box">
                        <DollarSign size={20} />
                    </div>
                    <div className="kpi-content">
                        <div className="kpi-label">累積採購金額 (未稅)</div>
                        <div className="kpi-value">{fmt(stats.total)}</div>
                    </div>
                </div>
                <div className="kpi-card accent-indigo">
                    <div className="kpi-icon-box">
                        <Hash size={20} />
                    </div>
                    <div className="kpi-content">
                        <div className="kpi-label">累積採購筆數</div>
                        <div className="kpi-value">{stats.count} 筆</div>
                    </div>
                </div>
            </div>

            {/* Monthly bar chart */}
            <div className="card">
                <div className="card-header-flex">
                    <div className="chart-title-area">
                        <h2 className="card-title">月度採購金額對比 (未稅)</h2>
                        <div className="month-range-selector">
                            <button className={monthRange === '1-6' ? 'active' : ''} onClick={() => setMonthRange('1-6')}>1-6月</button>
                            <button className={monthRange === '7-12' ? 'active' : ''} onClick={() => setMonthRange('7-12')}>7-12月</button>
                            <button className={monthRange === '1-12' ? 'active' : ''} onClick={() => setMonthRange('1-12')}>1-12月</button>
                        </div>
                    </div>
                    <div className="chart-legend">
                        {compareYear && (
                            <div className="legend-item compare">
                                <span className="legend-dot bar-compare-color" />
                                <span className="legend-text">{compareYear} 年度 (總額)</span>
                            </div>
                        )}
                        {stats.allCategories.map(cat => (
                            <div
                                key={cat.name}
                                className={`legend-item ${hiddenCategories.has(cat.name) ? 'hidden' : ''}`}
                                onClick={() => {
                                    setHiddenCategories(prev => {
                                        const next = new Set(prev);
                                        if (next.has(cat.name)) next.delete(cat.name);
                                        else next.add(cat.name);
                                        return next;
                                    });
                                }}
                            >
                                <span className={`legend-dot cat-color-${cat.colorIdx}`} />
                                <span className="legend-text">{cat.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bar-chart">
                    {visibleMonths.map(i => {
                        const m = filteredMonthlyStacked[i];
                        const compareTotal = stats.compareMonthly[i];
                        const isActive = drillDown?.month === i;
                        return (
                            <div
                                className={`bar-col clickable ${isActive ? 'active' : ''}`}
                                key={i}
                            >
                                <div className="bar-group">
                                    {/* Comparison Year Bar (Left) - Only show if has data */}
                                    {compareYear && compareTotal > 0 && (
                                        <div
                                            className="bar-container compare"
                                            onClick={() => setDrillDown({ month: i, year: compareYear })}
                                        >
                                            <div className="bar-value">{fmt(compareTotal)}</div>
                                            <div
                                                className="bar compare-bar"
                                                style={{ height: `${(compareTotal / maxVal) * 100}%` }}
                                                title={`${i + 1}月總計 (${compareYear}): ${fmt(compareTotal)}`}
                                            />
                                        </div>
                                    )}

                                    {/* Main Year Stacked Bar (Right) */}
                                    <div
                                        className="bar-container current"
                                        onClick={() => m.total > 0 && setDrillDown({ month: i, year: currentYear })}
                                    >
                                        {m.total > 0 && <div className="bar-value">{fmt(m.total)}</div>}
                                        <div
                                            className="bar stacked"
                                            style={{ height: `${(m.total / maxVal) * 100}%` }}
                                            title={`${i + 1}月總計 (${currentYear}): ${fmt(m.total)}`}
                                        >
                                            {m.categories.map((cat, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`bar-segment cat-color-${cat.colorIdx}`}
                                                    style={{ height: `${(cat.amount / m.total) * 100}%` }}
                                                    title={`${cat.name}: ${fmt(cat.amount)}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="bar-label">{i + 1}月</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="three-col">
                {/* Top accounts */}
                {stats.topAccounts.length > 0 && (
                    <div className="card collapsible-card">
                        <div className="collapsible-header" onClick={() => togglePanel('accounts')}>
                            <h2 className="card-title">科目排行 Top 5</h2>
                            <span className={`collapse-icon ${openPanels.has('accounts') ? 'open' : ''}`}>▾</span>
                        </div>
                        {openPanels.has('accounts') && (
                            <div className="rank-list">
                                {stats.topAccounts.map(([id, v], idx) => (
                                    <div className="rank-item" key={id}>
                                        <span className={`rank-no rank-${idx + 1}`}>{idx + 1}</span>
                                        <span className="rank-name">{v.name}</span>
                                        <span className="rank-count">{v.count} 筆</span>
                                        <span className="rank-amount">{fmt(v.total)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Top Vendors */}
                {stats.topVendors.length > 0 && (
                    <div className="card collapsible-card">
                        <div className="collapsible-header" onClick={() => togglePanel('vendors')}>
                            <h2 className="card-title">廠商排行 Top 5</h2>
                            <span className={`collapse-icon ${openPanels.has('vendors') ? 'open' : ''}`}>▾</span>
                        </div>
                        {openPanels.has('vendors') && (
                            <div className="rank-list">
                                {stats.topVendors.map(([name, v], idx) => (
                                    <div
                                        className="rank-item clickable"
                                        key={name}
                                        onClick={() => setDrillDown({ month: 0, year: currentYear, type: 'vendor', target: name })}
                                    >
                                        <span className={`rank-no rank-${idx + 1}`}>{idx + 1}</span>
                                        <span
                                            className="rank-name truncated v-profile-link"
                                            title="查看廠商資料卡"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setVendorDetail(name);
                                            }}
                                        >
                                            {name}
                                        </span>
                                        <span className="rank-count">{v.count} 筆</span>
                                        <span className="rank-amount">{fmt(v.total)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Budget Status */}
                {stats.budgetStatus.length > 0 && (
                    <div className="card collapsible-card">
                        <div className="collapsible-header" onClick={() => togglePanel('budget')}>
                            <h2 className="card-title">預算執行率</h2>
                            <span className={`collapse-icon ${openPanels.has('budget') ? 'open' : ''}`}>▾</span>
                        </div>
                        {openPanels.has('budget') && (
                            <div className="budget-list-simple">
                                {stats.budgetStatus.map((b, idx) => (
                                    <div className="budget-row-simple" key={b.id} onClick={() => setSelectedBudget(b)}>
                                        <span className={`rank-no rank-${Math.min(idx + 1, 5)}`}>{idx + 1}</span>
                                        <span className="b-name-simple">{b.code}</span>
                                        <div className="b-progress-box">
                                            <div className="b-bar-mini">
                                                <div
                                                    className={`b-fill-mini ${b.percent > 100 ? 'over' : b.percent > 90 ? 'danger' : ''}`}
                                                    style={{ width: `${Math.min(b.percent, 100)}%` }}
                                                />
                                            </div>
                                            <span className={`b-pct ${b.percent > 90 ? 'text-red' : b.percent > 70 ? 'text-orange' : 'text-green'}`}>
                                                {b.percent.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Budget Detail Modal */}
            {selectedBudget && (
                <div className="modal-overlay" onClick={() => setSelectedBudget(null)}>
                    <div className="modal-box budget-detail-pop" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>預算支用詳情</h2>
                            <button className="modal-close" onClick={() => setSelectedBudget(null)}>×</button>
                        </div>
                        <div className="pop-body">
                            <div className="pop-acc-info">
                                <span className="p-code">{selectedBudget.code}</span>
                                <h3 className="p-name">{selectedBudget.name}</h3>
                            </div>
                            <div className="pop-stats-grid">
                                <div className="p-stat">
                                    <label>年度預算 (未稅)</label>
                                    <div className="p-val">{fmt(selectedBudget.budget)}</div>
                                </div>
                                <div className="p-stat">
                                    <label>累計支出 (未稅)</label>
                                    <div className="p-val">{fmt(selectedBudget.spent)}</div>
                                </div>
                                <div className="p-stat">
                                    <label>{selectedBudget.remaining < 0 ? '超支金額' : '剩餘額度'} (未稅)</label>
                                    <div className={`p-val ${selectedBudget.remaining < 0 ? 'text-red' : 'text-green'}`}>
                                        {fmt(Math.abs(selectedBudget.remaining))}
                                    </div>
                                </div>
                                <div className="p-stat">
                                    <label>執行比率</label>
                                    <div className={`p-val-lg ${selectedBudget.percent > 90 ? 'text-red' : 'text-green'}`}>
                                        {selectedBudget.percent.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Monthly / Vendor Detail Modal */}
            {drillDown && (
                <div className="modal-overlay" onClick={() => setDrillDown(null)}>
                    <div className="modal-box drill-down-pop" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{drillDownTitle}</h2>
                            <button className="modal-close" onClick={() => setDrillDown(null)}>×</button>
                        </div>
                        <div className="pop-body">
                            <div className="drill-down-list">
                                <table className="drill-table">
                                    <thead>
                                        <tr>
                                            <th>序號</th>
                                            <th>日期</th>
                                            <th>廠商</th>
                                            <th>品名</th>
                                            <th className="text-right">金額 (未稅)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drillDownItems.map((p, idx) => (
                                            <tr key={p.id}>
                                                <td>{idx + 1}</td>
                                                <td>{fmtDateShort(p)}</td>
                                                <td><div className="truncated" title={p.vendor}>{p.vendor}</div></td>
                                                <td><div className="truncated" title={p.title}>{p.title}</div></td>
                                                <td className="text-right amount-purple">{fmt(p.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {vendorDetail && (
                <VendorDetailCard
                    vendorName={vendorDetail}
                    onClose={() => setVendorDetail(null)}
                />
            )}
        </div>
    );
};

export default Dashboard;
