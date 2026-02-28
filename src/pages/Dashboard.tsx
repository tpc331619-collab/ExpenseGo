import React, { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import type { Purchase } from '../types';
import { DollarSign, Hash, ChevronDown, Copy, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { copyChart } from '../lib/chartUtils';
import { getPurchases } from '../lib/firestore';
import DashboardSkeleton from '../components/DashboardSkeleton';
import VendorDetailCard from '../components/VendorDetailCard';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    const { purchases, ledgerAccounts, loadingData, selectedYear: currentYear, compareYear, setCompareYear } = useApp();

    const [drillDown, setDrillDown] = React.useState<{ month: number; year: number; type?: 'vendor' | 'account'; target?: string } | null>(null);
    const [hiddenCategories, setHiddenCategories] = React.useState<Set<string>>(new Set());
    const [comparePurchases, setComparePurchases] = React.useState<Purchase[]>([]);
    const [vendorDetail, setVendorDetail] = React.useState<string | null>(null);
    const [monthRange, setMonthRange] = React.useState<'1-6' | '7-12' | '1-12'>('1-12');
    const [openPanels, setOpenPanels] = React.useState<Set<string>>(new Set());
    const chartContainerRef = React.useRef<HTMLDivElement>(null);
    const [showYoYDetail, setShowYoYDetail] = React.useState<{ title: string; current: number; compare: number; percent: number; isAmount: boolean } | null>(null);
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

        const compareTotal = comparePurchases.reduce((s, p) => s + p.amount, 0);
        const compareCount = comparePurchases.length;

        return { total, count, topAccounts, topVendors, budgetStatus, monthly, monthlyItems, monthlyStacked, allCategories, compareMonthly, compareMonthlyItems, compareTotal, compareCount };
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
                        <div className="kpi-value-row">
                            <div className="kpi-value">{fmt(stats.total)}</div>
                            {compareYear && (
                                <div
                                    className={`yoy-badge ${stats.total >= stats.compareTotal ? 'up' : 'down'}`}
                                    title="點擊查看計算詳情"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowYoYDetail({
                                            title: 'YoY 年度成長率 (金額)',
                                            current: stats.total,
                                            compare: stats.compareTotal,
                                            percent: ((stats.total - stats.compareTotal) / (stats.compareTotal || 1) * 100),
                                            isAmount: true
                                        });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {stats.total >= stats.compareTotal ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {Math.abs(((stats.total - stats.compareTotal) / (stats.compareTotal || 1) * 100)).toFixed(1)}%
                                    <Info size={12} style={{ marginLeft: '4px', opacity: 0.6 }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="kpi-card accent-indigo">
                    <div className="kpi-icon-box">
                        <Hash size={20} />
                    </div>
                    <div className="kpi-content">
                        <div className="kpi-label">累積採購筆數</div>
                        <div className="kpi-value-row">
                            <div className="kpi-value">{stats.count} 筆</div>
                            {compareYear && (
                                <div
                                    className={`yoy-badge ${stats.count >= stats.compareCount ? 'up' : 'down'}`}
                                    title="點擊查看計算詳情"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowYoYDetail({
                                            title: 'YoY 年度成長率 (筆數)',
                                            current: stats.count,
                                            compare: stats.compareCount,
                                            percent: ((stats.count - stats.compareCount) / (stats.compareCount || 1) * 100),
                                            isAmount: false
                                        });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {stats.count >= stats.compareCount ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {Math.abs(((stats.count - stats.compareCount) / (stats.compareCount || 1) * 100)).toFixed(1)}%
                                    <Info size={12} style={{ marginLeft: '4px', opacity: 0.6 }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly bar chart */}
            <div ref={chartContainerRef} className="card bar-chart-card">
                <div className="card-header-flex chart-header-row">
                    <div className="chart-title-area">
                        <h2 className="card-title">月度採購金額趨勢</h2>
                        <div className="month-range-selector">
                            <button className={monthRange === '1-6' ? 'active' : ''} onClick={() => setMonthRange('1-6')}>上半年</button>
                            <button className={monthRange === '7-12' ? 'active' : ''} onClick={() => setMonthRange('7-12')}>下半年</button>
                            <button className={monthRange === '1-12' ? 'active' : ''} onClick={() => setMonthRange('1-12')}>全年度</button>
                        </div>
                        <div className="compare-selector" style={{ marginLeft: '16px' }}>
                            <span className="compare-label">選擇對比年分</span>
                            <div className="select-wrapper">
                                <select
                                    className="year-dropdown"
                                    style={{ color: '#2563eb' }}
                                    value={compareYear || ''}
                                    onChange={(e) => setCompareYear(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">(無)</option>
                                    {Array.from({ length: 5 }, (_, i) => 2024 + i)
                                        .filter(y => y !== currentYear)
                                        .map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))
                                    }
                                </select>
                                <ChevronDown className="select-icon" size={14} />
                            </div>
                        </div>
                    </div>
                    <button className="btn-icon-sub" onClick={() => copyChart(chartContainerRef.current, '月度採購金額趨勢')} title="複製圖片">
                        <Copy size={14} />
                    </button>
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
                                                className="bar compare-bar ghost-bar"
                                                style={{ height: `${(compareTotal / maxVal) * 100}%` }}
                                                title={`${i + 1}月總計 (${compareYear}): ${fmt(compareTotal)}`}
                                            >
                                                <div className="ghost-fill" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Main Year Stacked Bar (Right) */}
                                    <div
                                        className="bar-container current"
                                        onClick={() => m.total > 0 && setDrillDown({ month: i, year: currentYear })}
                                    >
                                        {/* MoM % badge — above the dollar amount */}
                                        {(() => {
                                            if (i === 0 || !visibleMonths.includes(i - 1)) return null;
                                            const prevTotal = filteredMonthlyStacked[i - 1]?.total || 0;
                                            const currTotal = m.total;
                                            if (prevTotal === 0 || currTotal === 0) return null;
                                            const pct = ((currTotal - prevTotal) / prevTotal * 100);
                                            const isUp = pct >= 0;
                                            return (
                                                <div className="mom-trend">
                                                    <span className={isUp ? 'mom-up' : 'mom-down'}>
                                                        {isUp ? '↑' : '↓'}{Math.abs(pct).toFixed(0)}%
                                                    </span>
                                                </div>
                                            );
                                        })()}
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

            {showYoYDetail && (
                <div className="modal-overlay" onClick={() => setShowYoYDetail(null)}>
                    <div className="modal-box yoy-detail-pop" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{showYoYDetail.title}</h2>
                            <button className="modal-close" onClick={() => setShowYoYDetail(null)}>×</button>
                        </div>
                        <div className="pop-body">
                            <div className="yoy-calc-wrap">
                                <div className="yoy-calc-formula">
                                    計算公式：<span>(今年 - 去年) / 去年 * 100%</span>
                                </div>
                                <div className="yoy-calc-grid">
                                    <div className="yoy-calc-item">
                                        <label>{currentYear} 年度</label>
                                        <div className="val">{showYoYDetail.isAmount ? fmt(showYoYDetail.current) : `${showYoYDetail.current} 筆`}</div>
                                    </div>
                                    <div className="yoy-calc-op">-</div>
                                    <div className="yoy-calc-item">
                                        <label>{compareYear} 年度</label>
                                        <div className="val">{showYoYDetail.isAmount ? fmt(showYoYDetail.compare) : `${showYoYDetail.compare} 筆`}</div>
                                    </div>
                                    <div className="yoy-calc-op">/</div>
                                    <div className="yoy-calc-item">
                                        <label>對比基準</label>
                                        <div className="val">{showYoYDetail.isAmount ? fmt(showYoYDetail.compare) : `${showYoYDetail.compare} 筆`}</div>
                                    </div>
                                </div>
                                <div className="yoy-calc-result">
                                    <div className="res-label">最終成長率 (YoY)</div>
                                    <div className={`res-val ${showYoYDetail.percent >= 0 ? 'text-green' : 'text-red'}`}>
                                        {showYoYDetail.percent >= 0 ? '↑' : '↓'} {Math.abs(showYoYDetail.percent).toFixed(2)}%
                                    </div>
                                </div>
                                <div className="yoy-explanation">
                                    <p><strong>YoY (Year-over-Year)</strong>：用來比較今年當期與去年同期數據變動的指標。</p>
                                    <ul>
                                        <li><strong>排除季節差異</strong>：採購行為常有週期性，與去年同期比能排除月份間的波動。</li>
                                        <li><strong>觀察預算趨勢</strong>：快速判斷目前的開支規模相比去年是在擴張、持平或緊縮。</li>
                                        <li><strong>評估採購效率</strong>：若金額增幅遠大於筆數增幅，可能意味著通貨膨脹或採購單價顯著上漲。</li>
                                    </ul>
                                </div>
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
