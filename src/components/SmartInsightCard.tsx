import React, { useMemo } from 'react';
import { Lightbulb, AlertTriangle, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
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

        // 4. 預設鼓勵或小提示 (若無其他洞察)
        if (list.length === 0) {
            list.push({
                type: 'success',
                title: '數據分析正常',
                text: '目前的採購頻率與預算分配皆在穩定區間，未檢測到異常波動。',
                icon: <Zap size={18} className="text-yellow" />
            });
        }

        return list.slice(0, 3); // 最多顯示 3 條
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
