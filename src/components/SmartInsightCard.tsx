import React, { useMemo } from 'react';
import { Lightbulb, AlertTriangle, TrendingUp, ShieldCheck, Zap, RefreshCw } from 'lucide-react';
import type { Purchase, LedgerAccount } from '../types';
import './SmartInsightCard.css';

interface Insight {
    type: 'warning' | 'info' | 'success' | 'tip';
    title: string;
    text: string;
    icon: React.ReactNode;
}

interface SmartInsightCardProps {
    purchases: Purchase[];
    ledgerAccounts: LedgerAccount[];
    comparePurchases: Purchase[];
}

const SmartInsightCard: React.FC<SmartInsightCardProps> = ({ purchases, ledgerAccounts, comparePurchases }) => {
    const fmt = (n: number) => n.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

    const insights = useMemo(() => {
        const list: Insight[] = [];
        const currentTotal = purchases.reduce((s, p) => s + p.amount, 0);
        const compareTotal = comparePurchases.reduce((s, p) => s + p.amount, 0);

        // 1. 預算執行預警
        const budgetStatus = ledgerAccounts.map(acc => {
            const spent = purchases.filter(p => p.ledgerAccountId === acc.id).reduce((s, p) => s + p.amount, 0);
            return { name: acc.name, spent, budget: acc.budget || 0, percent: acc.budget ? (spent / acc.budget) * 100 : 0 };
        }).filter(b => b.budget > 0);

        const overBudget = budgetStatus.find(b => b.percent > 90);
        if (overBudget) {
            list.push({
                type: 'warning',
                title: '預算緊縮預警',
                text: `「${overBudget.name.replace(/^[A-Z]\d{5}\s+/, '')}」預算執行率已達 ${overBudget.percent.toFixed(1)}%，建議評估後續支出。`,
                icon: <AlertTriangle size={18} className="text-orange" />
            });
        }

        // 2. 支出趨勢洞察 (YoY)
        if (compareTotal > 0) {
            const diffPct = ((currentTotal - compareTotal) / compareTotal) * 100;
            if (Math.abs(diffPct) > 20) {
                list.push({
                    type: diffPct > 0 ? 'info' : 'success',
                    title: '年度開支變動',
                    text: `今年總支出較去年同期${diffPct > 0 ? '增加' : '減少'}了 ${Math.abs(diffPct).toFixed(1)}%，請留意採購規模變化。`,
                    icon: diffPct > 0 ? <TrendingUp size={18} className="text-blue" /> : <ShieldCheck size={18} className="text-green" />
                });
            }
        }

        // 3. 廠商高度依賴性檢測
        const vendorSpending: Record<string, number> = {};
        purchases.forEach(p => {
            vendorSpending[p.vendor] = (vendorSpending[p.vendor] || 0) + p.amount;
        });
        const topVendor = Object.entries(vendorSpending).sort((a, b) => b[1] - a[1])[0];
        if (topVendor && currentTotal > 0) {
            const ratio = (topVendor[1] / currentTotal) * 100;
            if (ratio > 50) {
                list.push({
                    type: 'tip',
                    title: '供應商高度集中',
                    text: `「${topVendor[0]}」之採購額佔總支出 ${ratio.toFixed(0)}%，建議評估供應鏈集中風險。`,
                    icon: <Lightbulb size={18} className="text-purple" />
                });
            }
        }

        // 4. [進階] 異常大額偵測 (檢測單筆是否異常偏高)
        const accSpendStats: Record<string, { total: number, count: number, max: number }> = {};
        purchases.forEach(p => {
            if (!accSpendStats[p.ledgerAccountId]) accSpendStats[p.ledgerAccountId] = { total: 0, count: 0, max: 0 };
            accSpendStats[p.ledgerAccountId].total += p.amount;
            accSpendStats[p.ledgerAccountId].count += 1;
            accSpendStats[p.ledgerAccountId].max = Math.max(accSpendStats[p.ledgerAccountId].max, p.amount);
        });

        for (const [accId, stat] of Object.entries(accSpendStats)) {
            const avg = stat.total / stat.count;
            if (stat.count >= 2 && stat.max > avg * 3) {
                const accName = ledgerAccounts.find(a => a.id === accId)?.name.replace(/^[A-Z]\d{5}\s+/, '') || '未知科目';
                list.push({
                    type: 'warning',
                    title: '檢測到異常大額請購',
                    text: `「${accName}」科目中出現單筆遠高於平均（約 ${fmt(stat.max)}）的單據，請確認必要性。`,
                    icon: <AlertTriangle size={18} className="text-red" />
                });
                break; // 只報一條
            }
        }

        // 5. [進階] 重複採購檢測 (三天內相同廠商與相似品名)
        const sorted = [...purchases].sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
        for (let i = 0; i < sorted.length - 1; i++) {
            const p1 = sorted[i];
            const p2 = sorted[i + 1];
            const diffDays = (p1.purchaseDate.toMillis() - p2.purchaseDate.toMillis()) / (1000 * 60 * 60 * 24);
            if (diffDays <= 3 && p1.vendor === p2.vendor && (p1.title.includes(p2.title) || p2.title.includes(p1.title))) {
                list.push({
                    type: 'tip',
                    title: '疑似重複請購提醒',
                    text: `發現廠商「${p1.vendor}」在 3 天內有兩筆品名高度相似（${p1.title} / ${p2.title}），請確認是否重複。`,
                    icon: <RefreshCw size={18} className="text-blue" />
                });
                break;
            }
        }

        // 6. 預設鼓勵或小提示 (若無其他洞察)
        if (list.length === 0) {
            list.push({
                type: 'success',
                title: '數據分析正常',
                text: '目前的採購頻率與預算分配皆在穩定區間，未檢測到異常波動。',
                icon: <Zap size={18} className="text-yellow" />
            });
        }

        return list.slice(0, 4); // 調整為顯示更多洞察
    }, [purchases, ledgerAccounts, comparePurchases]);

    return (
        <div className="insight-card">
            <div className="insight-header">
                <Zap size={18} className="insight-logo" />
                <span className="insight-title">AI 智能洞察</span>
            </div>
            <div className="insight-grid">
                {insights.map((item, idx) => (
                    <div key={idx} className={`insight-item type-${item.type}`}>
                        <div className="insight-icon-box">{item.icon}</div>
                        <div className="insight-content">
                            <div className="insight-item-title">{item.title}</div>
                            <div className="insight-item-text">{item.text}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SmartInsightCard;
