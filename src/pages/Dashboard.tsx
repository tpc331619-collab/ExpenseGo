import React, { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    const { purchases, ledgerAccounts, loadingData, selectedYear: currentYear } = useApp();

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

        // Monthly
        const monthly = Array(12).fill(0);
        yearPurchases.forEach((p) => {
            const m = p.purchaseDate.toDate().getMonth();
            monthly[m] += p.amount;
        });

        return { total, count, topAccounts, budgetStatus, monthly };
    }, [purchases, ledgerAccounts, currentYear]);

    const fmt = (n: number) =>
        n.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

    const maxMonthly = Math.max(...stats.monthly, 1);

    const [selectedBudget, setSelectedBudget] = React.useState<typeof stats.budgetStatus[0] | null>(null);

    if (loadingData) {
        return (
            <div className="page-container">
                <div className="full-loading"><div className="spinner" /></div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{currentYear} 年度採購總覽</h1>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card accent-purple">
                    <div className="kpi-label">年度總採購金額 (未稅)</div>
                    <div className="kpi-value">{fmt(stats.total)}</div>
                </div>
                <div className="kpi-card accent-blue">
                    <div className="kpi-label">採購筆數</div>
                    <div className="kpi-value">{stats.count} 筆</div>
                </div>
            </div>

            {/* Monthly bar chart */}
            <div className="card">
                <h2 className="card-title">月度採購金額 (未稅)</h2>
                <div className="bar-chart">
                    {stats.monthly.map((val, i) => (
                        <div className="bar-col" key={i}>
                            {val > 0 && <div className="bar-value">{fmt(val)}</div>}
                            <div
                                className="bar"
                                style={{ height: `${(val / maxMonthly) * 100}%` }}
                                title={fmt(val)}
                            />
                            <div className="bar-label">{i + 1}月</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="two-col">
                {/* Top accounts */}
                {stats.topAccounts.length > 0 && (
                    <div className="card">
                        <h2 className="card-title">科目排行 Top 5</h2>
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
                    </div>
                )}

                {/* Budget Status */}
                {stats.budgetStatus.length > 0 && (
                    <div className="card">
                        <h2 className="card-title">預算支用進度</h2>
                        <div className="budget-list-simple">
                            {stats.budgetStatus.map((b, idx) => (
                                <div className="budget-row-simple" key={b.id} onClick={() => setSelectedBudget(b)}>
                                    <span className="b-no">{idx + 1}.</span>
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
        </div>
    );
};

export default Dashboard;
