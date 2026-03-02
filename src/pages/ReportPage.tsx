import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { exporttoExcel } from '../lib/excelExport';
import type { AnnualSummaryByAccount, AnnualSummaryByVendor, AnnualSummaryByRequisition, AnnualSummaryByPurchaseType } from '../types';
import { BarChartBig, FolderOpen, Building2, Tags, Layers, Copy } from 'lucide-react';
import { copyChart } from '../lib/chartUtils';
import './ReportPage.css';

type Tab = 'account' | 'vendor' | 'requisition' | 'purchaseType';

const ReportPage: React.FC = () => {
    const { purchases, ledgerAccounts, selectedYear: year } = useApp();
    const [tab, setTab] = useState<Tab>('account');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
    const [exporting, setExporting] = useState(false);

    const handleTabChange = (t: Tab) => {
        setTab(t);
        setSelectedId(null);
        setExpandedIds({});
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };
    const [showAnalysis, setShowAnalysis] = useState(false);

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
        return Object.values(map).map(v => {
            v.items.sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
            return v;
        }).sort((a, b) => b.total - a.total);
    }, [yearPurchases, ledgerAccounts]);

    const byVendor: AnnualSummaryByVendor[] = useMemo(() => {
        const map: Record<string, AnnualSummaryByVendor> = {};
        yearPurchases.forEach((p) => {
            if (!map[p.vendor]) map[p.vendor] = { vendor: p.vendor, total: 0, count: 0, items: [] };
            map[p.vendor].total += p.amount;
            map[p.vendor].count += 1;
            map[p.vendor].items.push(p);
        });
        return Object.values(map).map(v => {
            v.items.sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
            return v;
        }).sort((a, b) => b.total - a.total);
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
        return Object.values(map).map(v => {
            v.items.sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
            return v;
        }).sort((a, b) => b.total - a.total);
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
        return Object.values(map).map(v => {
            v.items.sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
            return v;
        }).sort((a, b) => b.total - a.total);
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

    // Budget execution rate per account (spent / budget)
    const getBudgetExec = (acc: AnnualSummaryByAccount) => {
        const la = ledgerAccounts.find(a => a.id === acc.ledgerAccountId);
        const budget = la?.budget ?? 0;
        if (!budget) return { pct: null, hasBudget: false };
        const pct = (acc.total / budget) * 100;
        return { pct, hasBudget: true };
    };

    // Percentage of grand total (used for vendor / requisition / purchaseType tabs)
    const pct = (v: number) => grandTotal ? ((v / grandTotal) * 100).toFixed(1) : '0.0';

    const renderDocNumber = (docNumber: string | undefined) => {
        if (!docNumber) return <div style={{ fontSize: '11px', color: 'var(--text2)' }}>-</div>;
        return (
            <div
                style={{
                    fontSize: '11px',
                    color: 'var(--blue)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(37, 99, 235, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(docNumber);
                    alert('已複製：' + docNumber);
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(37, 99, 235, 0.15)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(37, 99, 235, 0.05)';
                }}
                title="點擊複製單號"
            >
                {docNumber}
            </div>
        );
    };

    const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b', '#14b8a6'];

    const PieChart = ({ data, total, title, selectedId, onSelect }: { data: { id: string, label: string, value: number }[], total: number, title: string, selectedId: string | null, onSelect: (id: string | null) => void }) => {
        const containerRef = React.useRef<HTMLDivElement>(null);
        const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

        const handleSegClick = (item: { id: string }) => {
            if (selectedId === item.id) {
                onSelect(null);
            } else {
                onSelect(item.id);
            }
        };

        const sorted = [...data].sort((a, b) => b.value - a.value);
        const top = sorted.slice(0, 8);
        const others = sorted.slice(8).reduce((sum, item) => sum + item.value, 0);

        const chartData = [...top];
        if (others > 0) {
            chartData.push({ id: 'others', label: '其他', value: others });
        }

        let currentAngle = -Math.PI / 2;
        const radius = 95;
        const innerRadius = 65;
        const centerX = 130;
        const centerY = 125;

        const fmt = (n: number) => n.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

        return (
            <div ref={containerRef} className="chart-wrapper pie-wrapper">
                <div className="chart-header-row">
                    <h4 className="chart-subtitle">{title}</h4>
                    <button className="btn-icon-sub" onClick={() => copyChart(containerRef.current, title)} title="複製圖片">
                        <Copy size={14} />
                    </button>
                </div>
                <div className="pie-content-layout">
                    <div className="pie-container">
                        {/* Enlarged SVG for better balance, width covers legend for copy fix */}
                        <svg width="500" height="250" viewBox="0 0 500 250" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 1 }}>
                            <g style={{ pointerEvents: 'auto' }}>
                                {total > 0 && chartData.map((item, idx) => {
                                    const percent = item.value / total;
                                    if (percent <= 0) return null;
                                    const arcLength = percent * 2 * Math.PI;

                                    const x1 = centerX + Math.cos(currentAngle) * radius;
                                    const y1 = centerY + Math.sin(currentAngle) * radius;
                                    const x2 = centerX + Math.cos(currentAngle + arcLength) * radius;
                                    const y2 = centerY + Math.sin(currentAngle + arcLength) * radius;

                                    const ix2 = centerX + Math.cos(currentAngle + arcLength) * innerRadius;
                                    const iy2 = centerY + Math.sin(currentAngle + arcLength) * innerRadius;
                                    const ix1 = centerX + Math.cos(currentAngle) * innerRadius;
                                    const iy1 = centerY + Math.sin(currentAngle) * innerRadius;

                                    const largeArc = arcLength > Math.PI ? 1 : 0;

                                    let d: string;
                                    if (chartData.length === 1) {
                                        // SVG cannot draw an arc from a point to itself; use two 180° arcs
                                        const top = { x: centerX, y: centerY - radius };
                                        const bot = { x: centerX, y: centerY + radius };
                                        const itop = { x: centerX, y: centerY - innerRadius };
                                        const ibot = { x: centerX, y: centerY + innerRadius };
                                        d = [
                                            `M ${top.x} ${top.y}`,
                                            `A ${radius} ${radius} 0 0 1 ${bot.x} ${bot.y}`,
                                            `A ${radius} ${radius} 0 0 1 ${top.x} ${top.y}`,
                                            `L ${itop.x} ${itop.y}`,
                                            `A ${innerRadius} ${innerRadius} 0 0 0 ${ibot.x} ${ibot.y}`,
                                            `A ${innerRadius} ${innerRadius} 0 0 0 ${itop.x} ${itop.y}`,
                                            'Z'
                                        ].join(' ');
                                    } else {
                                        d = [
                                            `M ${x1} ${y1}`,
                                            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                                            `L ${ix2} ${iy2}`,
                                            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
                                            'Z'
                                        ].join(' ');
                                    }

                                    const color = item.id === 'others' ? '#94a3b8' : CHART_COLORS[idx % CHART_COLORS.length];
                                    const isFocused = hoveredIdx === idx || selectedId === item.id;

                                    // Smooth Curved Leader Line Logic
                                    const midAngle = currentAngle + arcLength / 2;
                                    const lx1 = centerX + Math.cos(midAngle) * radius;
                                    const ly1 = centerY + Math.sin(midAngle) * radius;

                                    const targetX = 304; // Points to the left edge of the legend text area
                                    const totalItems = chartData.length;
                                    const lgGap = 4;
                                    // Match CSS min-height/max-height flexible logic
                                    const itemH = Math.min(42, Math.max(28, (250 - (totalItems - 1) * lgGap) / totalItems));
                                    const totalLgH = (totalItems * itemH) + ((totalItems - 1) * lgGap);
                                    // Safe centering: offset can't be negative (starting from top if overflow)
                                    const centeringOffset = Math.max(0, (250 - totalLgH) / 2);
                                    const targetY = centeringOffset + (idx * (itemH + lgGap)) + itemH / 2;

                                    const isLeft = Math.cos(midAngle) < 0;
                                    let pathD = "";
                                    if (isLeft) {
                                        // Fluid wrap around curve: dynamic bounds based on 250px height
                                        const wrapY = midAngle < Math.PI ? 249 : 1;
                                        const cp1x = lx1 - 45;
                                        const cpMidX = lx1 + (targetX - lx1) * 0.3;
                                        pathD = `M ${lx1} ${ly1} C ${cp1x} ${ly1}, ${cp1x} ${wrapY}, ${cpMidX} ${wrapY} S ${targetX} ${targetY}, ${targetX} ${targetY}`;
                                    } else {
                                        // Smooth S-curve: balanced horizontal points to prevent inward bulging
                                        const cp1x = lx1 + (targetX - lx1) * 0.5;
                                        const cp2x = targetX - (targetX - lx1) * 0.5;
                                        pathD = `M ${lx1} ${ly1} C ${cp1x} ${ly1}, ${cp2x} ${targetY}, ${targetX} ${targetY}`;
                                    }

                                    const path = (
                                        <g key={item.id} onClick={(e) => { e.stopPropagation(); handleSegClick(item); }}>
                                            {isFocused && (
                                                <path
                                                    d={pathD}
                                                    fill="none"
                                                    stroke={color}
                                                    strokeWidth="0.7"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    style={{ pointerEvents: 'none', transition: 'all 0.4s ease-out' }}
                                                />
                                            )}
                                            <path
                                                d={d}
                                                fill={color}
                                                style={{
                                                    opacity: (hoveredIdx === null && !selectedId) || isFocused ? 1 : 0.5,
                                                    transform: isFocused ? 'scale(1.04)' : 'scale(1)',
                                                    transformOrigin: 'center',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    cursor: 'pointer',
                                                    filter: isFocused ? 'brightness(1.05)' : 'none'
                                                }}
                                                onMouseEnter={() => setHoveredIdx(idx)}
                                                onMouseLeave={() => setHoveredIdx(null)}
                                            />
                                        </g>
                                    );
                                    currentAngle += arcLength;
                                    return path;
                                })}
                            </g>

                            {/* Center labels */}
                            <g transform={`translate(${centerX}, ${centerY})`} style={{ pointerEvents: 'none' }}>
                                <text
                                    textAnchor="middle"
                                    y="-5"
                                    className="pie-center-label"
                                >
                                    {hoveredIdx !== null || selectedId
                                        ? chartData[hoveredIdx ?? chartData.findIndex(d => d.id === selectedId)].label
                                        : '總計金額'}
                                </text>
                                <text
                                    textAnchor="middle"
                                    y="18"
                                    className="pie-center-value"
                                >
                                    {hoveredIdx !== null || selectedId
                                        ? fmt(chartData[hoveredIdx ?? chartData.findIndex(d => d.id === selectedId)].value)
                                        : fmt(total)}
                                </text>
                            </g>
                        </svg>
                    </div>
                    <div className="pie-legend-custom">
                        {chartData.map((item, idx) => (
                            <div
                                key={item.id}
                                className={`pie-legend-item ${hoveredIdx === idx ? 'active' : ''} ${selectedId === item.id ? 'pinned' : ''}`}
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                                onClick={(e) => { e.stopPropagation(); handleSegClick(item); }}
                            >
                                <span className="pie-legend-dot" style={{ backgroundColor: item.id === 'others' ? '#94a3b8' : CHART_COLORS[idx % CHART_COLORS.length] }} />
                                <span className="pie-legend-name">{item.label}</span>
                                <span className="pie-legend-percent">{((item.value / total) * 100).toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const StackedBarChart = ({ datasets, title }: { datasets: { label: string, color: string, purchases: any[] }[], title: string }) => {
        const containerRef = React.useRef<HTMLDivElement>(null);
        const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
        const months = 12;

        const seriesData = datasets.map(ds => {
            const monthly = Array(months).fill(0);
            ds.purchases.forEach(p => {
                const m = p.purchaseDate.toDate().getMonth();
                monthly[m] += p.amount;
            });
            return { ...ds, monthly };
        });

        const stackedMonthly = Array.from({ length: months }, (_, mIndex) => {
            let currentStack = 0;
            return seriesData.map(s => {
                const start = currentStack;
                currentStack += s.monthly[mIndex];
                return { start, end: currentStack };
            });
        });

        const maxTotal = Math.max(...stackedMonthly.map(m => m[m.length - 1]?.end || 0), 1) * 1.1;

        const width = 400;
        const height = 200;
        const padding = 35;
        const bottomPadding = 30;
        const chartHeight = height - padding - bottomPadding;
        const slotWidth = (width - 2 * padding) / months;
        const barWidth = Math.min(slotWidth * 0.6, 24);

        const fmt = (n: number) => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });

        return (
            <div ref={containerRef} className="chart-wrapper trend-wrapper">
                <div className="chart-header-row">
                    <h4 className="chart-subtitle">{title}</h4>
                    <button className="btn-icon-sub" onClick={() => copyChart(containerRef.current, title)} title="複製圖片">
                        <Copy size={14} />
                    </button>
                </div>

                <div className="trend-content-layout">
                    <div className="trend-svg-container">
                        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                            {/* Grid lines & Y-Axis Labels */}
                            {[0, 0.25, 0.5, 0.75, 1].map(v => {
                                const y = height - bottomPadding - v * chartHeight;
                                return (
                                    <g key={v}>
                                        <line
                                            x1={padding} y1={y} x2={width - padding} y2={y}
                                            stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3"
                                        />
                                        <text
                                            x={padding - 8} y={y + 3}
                                            textAnchor="end" fontSize="9" fill="#000000"
                                        >
                                            {fmt(v * maxTotal / 1000)}k
                                        </text>
                                    </g>
                                );
                            })}

                            {stackedMonthly.map((monthData, mIdx) => {
                                const xCenter = padding + mIdx * slotWidth + slotWidth / 2;
                                const xBar = xCenter - barWidth / 2;

                                return (
                                    <g key={mIdx}>
                                        {/* Month Axis Label */}
                                        <text
                                            x={xCenter} y={height - 8}
                                            textAnchor="middle" fontSize="10" fill="#000000" fontWeight="600"
                                        >
                                            {mIdx + 1}月
                                        </text>

                                        {/* Bar Segments */}
                                        {monthData.map((s, sIdx) => {
                                            const h = (s.end - s.start) / maxTotal * chartHeight;
                                            const y = height - bottomPadding - (s.end / maxTotal * chartHeight);
                                            const isHovered = hoveredIdx === sIdx;
                                            if (h <= 0.5) return null;

                                            return (
                                                <rect
                                                    key={sIdx}
                                                    x={xBar} y={y}
                                                    width={barWidth} height={h}
                                                    fill={seriesData[sIdx].color}
                                                    rx="2"
                                                    style={{
                                                        opacity: hoveredIdx !== null && !isHovered ? 0.3 : 1,
                                                        filter: isHovered ? 'brightness(1.1)' : 'none',
                                                        transition: 'all 0.2s ease',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={() => setHoveredIdx(sIdx)}
                                                    onMouseLeave={() => setHoveredIdx(null)}
                                                >
                                                    <title>{seriesData[sIdx].label}: NT$ {Math.round(s.end - s.start).toLocaleString()}</title>
                                                </rect>
                                            );
                                        })}

                                        {/* Total Amount Label on Top */}
                                        {monthData[monthData.length - 1].end > 0 && (
                                            <text
                                                x={xCenter}
                                                y={height - bottomPadding - (monthData[monthData.length - 1].end / maxTotal * chartHeight) - 6}
                                                textAnchor="middle"
                                                fontSize="9"
                                                fontWeight="800"
                                                fill="#000000"
                                            >
                                                {fmt(monthData[monthData.length - 1].end / 1000)}k
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    <div className="trend-legend-custom">
                        {seriesData.map((ds, idx) => (
                            <div
                                key={idx}
                                className={`pie-legend-item ${hoveredIdx === idx ? 'active' : ''}`}
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                            >
                                <span className="pie-legend-dot" style={{ backgroundColor: ds.color }} />
                                <span className="pie-legend-name" style={{ fontSize: '11px' }}>{ds.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const VisualAnalysisBoard = ({ data, total, titlePrefix, pieTitle, selectedId, onSelect }: { data: any[], total: number, titlePrefix: string, pieTitle: string, selectedId: string | null, onSelect: (id: string | null) => void }) => {
        if (total === 0) return null;

        // Sync with PieChart's top categories
        const sortedData = [...data].sort((a, b) => b.value - a.value);
        const top8 = sortedData.slice(0, 8); // Showing top 8 in pie as per current logic

        let datasets = top8.map((item, idx) => ({
            label: item.label,
            color: CHART_COLORS[idx % CHART_COLORS.length],
            purchases: item.items
        }));

        // Filter datasets for StackedBarChart if something is selected
        if (selectedId) {
            datasets = datasets.filter(d => {
                const item = top8.find(t => t.id === selectedId);
                return d.label === item?.label;
            });
            // If the selected item is NOT in top 8 (e.g. in others), we might need to handle it.
            // But usually users click what they see.
            if (datasets.length === 0) {
                const item = data.find(t => t.id === selectedId);
                if (item) {
                    datasets = [{
                        label: item.label,
                        color: '#94a3b8',
                        purchases: item.items
                    }];
                }
            }
        }

        const trendTitle = `${titlePrefix}${selectedId ? `：${datasets[0]?.label} ` : ''}堆疊趨勢圖`;

        return (
            <div className="visual-board">
                <PieChart
                    data={data.map(d => ({ id: d.id, label: d.label, value: d.value }))}
                    total={total}
                    title={pieTitle}
                    selectedId={selectedId}
                    onSelect={onSelect}
                />
                <StackedBarChart datasets={datasets} title={trendTitle} />
            </div>
        );
    };

    const SubjectSummaryModal = () => {
        const sortedData = [...byAccount].sort((a, b) => b.total - a.total);

        // 清理品名，移除「第X期」、「X月份」、「XX年度」等重複性字眼
        const cleanTitle = (t: string) => {
            return t.replace(/\d+\s*月份/g, '')
                .replace(/第\s*\d+\s*[期次]/g, '')
                .replace(/\d+\s*年度/g, '')
                .replace(/\d+年\d+月/g, '')
                .replace(/[-\s]+$/g, '')
                .trim();
        };

        const summarizeTitles = (titles: string[]) => {
            const unique = [...new Set(titles.map(cleanTitle))].filter(t => t.length > 0);
            if (unique.length === 0) return '無明確品名';
            if (unique.length === 1) return unique[0];
            // 取第一個項目的前幾個字作為代表，避免太長
            const representative = unique[0].length > 10 ? unique[0].substring(0, 10) : unique[0];
            return `${representative}等費用支出`;
        };

        const copyToClipboard = () => {
            const text = sortedData.map(acc => {
                const titles = acc.items.map(it => it.title);
                const summary = summarizeTitles(titles);
                return `${acc.ledgerAccountCode}，總金額 ${acc.total.toLocaleString()} NTD，包含：${summary}`;
            }).join('；\n');

            navigator.clipboard.writeText(text);
            alert('已複製到剪貼簿！');
        };

        return (
            <div className="modal-overlay" onClick={() => setShowAnalysis(false)}>
                <div className="modal-box analysis-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>AI 分析列表</h2>
                        <button className="modal-close" onClick={() => setShowAnalysis(false)}>✕</button>
                    </div>
                    <div className="pop-body">
                        <div className="analysis-intro">
                            系統已自動簡化重複性採購（如月份、期數），僅顯示核心採購項目。
                        </div>
                        <div className="analysis-content">
                            {sortedData.map(acc => {
                                return (
                                    <div key={acc.ledgerAccountId} className="analysis-item">
                                        <div className="ai-item-actions">
                                            <button
                                                className="btn-copy-item"
                                                title="複製此項"
                                                onClick={() => {
                                                    const titles = acc.items.map(it => it.title);
                                                    const summary = summarizeTitles(titles);
                                                    const text = `${acc.ledgerAccountCode}，總金額 ${acc.total.toLocaleString()} NTD，包含：${summary}`;
                                                    navigator.clipboard.writeText(text);
                                                }}
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                        <div className="ai-header">
                                            <span className="ai-code">{acc.ledgerAccountCode}</span>
                                            <span className="ai-name">{acc.ledgerAccountName}</span>
                                        </div>
                                        <div className="ai-values">
                                            <span className="ai-amount">NT$ {acc.total.toLocaleString()}</span>
                                            <span className="ai-count">({acc.count} 筆)</span>
                                        </div>
                                        <div className="ai-description">
                                            包含：{summarizeTitles(acc.items.map(it => it.title))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="analysis-footer">
                            <button className="btn-primary" onClick={copyToClipboard}>📋 複製純文字報告</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BarChartBig size={26} color="var(--purple)" />
                    年度採購報表
                </h1>
                <div className="report-actions">
                    <button className="btn-analysis" onClick={() => setShowAnalysis(true)}>
                        ✨ AI 分析列表
                    </button>
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
                <button className={`tab-btn ${tab === 'account' ? 'active' : ''}`} onClick={() => handleTabChange('account')}>
                    <FolderOpen size={16} /> 依總帳科目
                </button>
                <button className={`tab-btn ${tab === 'vendor' ? 'active' : ''}`} onClick={() => handleTabChange('vendor')}>
                    <Building2 size={16} /> 依廠商
                </button>
                <button className={`tab-btn ${tab === 'requisition' ? 'active' : ''}`} onClick={() => handleTabChange('requisition')}>
                    <Tags size={16} /> 依請購類型
                </button>
                <button className={`tab-btn ${tab === 'purchaseType' ? 'active' : ''}`} onClick={() => handleTabChange('purchaseType')}>
                    <Layers size={16} /> 依採購類型
                </button>
            </div>

            {/* Visual Analysis Area */}
            {tab === 'account' && <VisualAnalysisBoard
                data={byAccount.map(a => ({ id: a.ledgerAccountId, label: a.ledgerAccountName, value: a.total, items: a.items }))}
                total={grandTotal}
                titlePrefix="總帳科目"
                pieTitle="總帳科目金額比例"
                selectedId={selectedId}
                onSelect={setSelectedId}
            />}
            {tab === 'vendor' && <VisualAnalysisBoard
                data={byVendor.map(v => ({ id: v.vendor, label: v.vendor, value: v.total, items: v.items }))}
                total={grandTotal}
                titlePrefix="廠商"
                pieTitle="廠商金額比例"
                selectedId={selectedId}
                onSelect={setSelectedId}
            />}
            {tab === 'requisition' && <VisualAnalysisBoard
                data={byRequisition.map(r => ({ id: r.type, label: r.type, value: r.total, items: r.items }))}
                total={grandTotal}
                titlePrefix="MM/非MM"
                pieTitle="MM/非MM金額比例"
                selectedId={selectedId}
                onSelect={setSelectedId}
            />}
            {tab === 'purchaseType' && <VisualAnalysisBoard
                data={byPurchaseType.map(p => ({ id: p.type, label: p.type, value: p.total, items: p.items }))}
                total={grandTotal}
                titlePrefix="勞務/財務/工程"
                pieTitle="勞務/財務/工程金額比例"
                selectedId={selectedId}
                onSelect={setSelectedId}
            />}

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
                    ) : byAccount.filter(acc => !selectedId || acc.ledgerAccountId === selectedId).map((acc) => (
                        <div className="report-section" key={acc.ledgerAccountId}>
                            <div className="report-section-header" onClick={() => toggleExpand(acc.ledgerAccountId)}>
                                <div className="rs-left">
                                    <span className="rs-expand">{(expandedIds[acc.ledgerAccountId] || selectedId === acc.ledgerAccountId) ? '▾' : '▸'}</span>
                                    <span className="rs-name">{acc.ledgerAccountCode}</span>
                                    <span className="rs-count">{acc.count} 筆</span>
                                </div>
                                <div className="rs-right">
                                    {(() => {
                                        const be = getBudgetExec(acc);
                                        if (!be.hasBudget) return (
                                            <>
                                                <div className="rs-bar-wrap"><div className="rs-bar" style={{ width: '0%' }} /></div>
                                                <span className="rs-pct rs-pct-none">未設預算</span>
                                                <span className="rs-amount">{fmt(acc.total)}</span>
                                            </>
                                        );
                                        const p = be.pct!;
                                        const cls = p > 100 ? 'rs-pct-over' : p > 90 ? 'rs-pct-warn' : 'rs-pct-ok';
                                        return (
                                            <>
                                                <div className="rs-bar-wrap">
                                                    <div className={`rs-bar ${p > 100 ? 'rs-bar-over' : p > 90 ? 'rs-bar-warn' : ''}`}
                                                        style={{ width: `${Math.min(p, 100)}%` }} />
                                                </div>
                                                <span className={`rs-pct ${cls}`}>{p.toFixed(1)}%</span>
                                                <span className="rs-amount">{fmt(acc.total)}</span>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                            {(expandedIds[acc.ledgerAccountId] || selectedId === acc.ledgerAccountId) && (
                                <div className="detail-table-wrap">
                                    <table className="detail-table">
                                        <thead>
                                            <tr><th>序號</th><th>日期</th><th>品名</th><th>廠商</th><th>金額 (未稅)</th><th>文件號碼</th><th>請購類型</th><th>採購類型</th></tr>
                                        </thead>
                                        <tbody>
                                            {acc.items.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td className="td-center">{index + 1}</td>
                                                    <td>{fmtDate(item.purchaseDate)}</td>
                                                    <td>{item.title}</td>
                                                    <td>{item.vendor}</td>
                                                    <td>{fmt(item.amount)}</td>
                                                    <td className="td-center">
                                                        {renderDocNumber(item.docNumber)}
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
                    ) : byVendor.filter(v => !selectedId || v.vendor === selectedId).map((v) => (
                        <div className="report-section" key={v.vendor}>
                            <div className="report-section-header" onClick={() => toggleExpand(v.vendor)}>
                                <div className="rs-left">
                                    <span className="rs-expand">{(expandedIds[v.vendor] || selectedId === v.vendor) ? '▾' : '▸'}</span>
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
                            {(expandedIds[v.vendor] || selectedId === v.vendor) && (
                                <div className="detail-table-wrap">
                                    <table className="detail-table">
                                        <thead>
                                            <tr><th>序號</th><th>日期</th><th>項次</th><th>品名</th><th>科目</th><th>金額 (未稅)</th><th>文件號碼</th><th>請購類型</th><th>採購類型</th></tr>
                                        </thead>
                                        <tbody>
                                            {v.items.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td className="td-center">{index + 1}</td>
                                                    <td>{fmtDate(item.purchaseDate)}</td>
                                                    <td className="td-center" style={{ color: 'var(--text3)', fontSize: '12px' }}>{item.itemNo}</td>
                                                    <td>{item.title}</td>
                                                    <td>{item.ledgerAccountName}</td>
                                                    <td className="td-amount">{fmt(item.amount)}</td>
                                                    <td className="td-center">
                                                        {renderDocNumber(item.docNumber)}
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
                    ) : byRequisition.filter(r => !selectedId || r.type === selectedId).map((r) => (
                        <div className="report-section" key={r.type}>
                            <div className="report-section-header" onClick={() => toggleExpand(r.type)}>
                                <div className="rs-left">
                                    <span className="rs-expand">{(expandedIds[r.type] || selectedId === r.type) ? '▾' : '▸'}</span>
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
                            {(expandedIds[r.type] || selectedId === r.type) && (
                                <div className="detail-table-wrap">
                                    <table className="detail-table">
                                        <thead>
                                            <tr><th>序號</th><th>日期</th><th>品名</th><th>廠商</th><th>科目</th><th>金額 (未稅)</th><th>文件號碼</th><th>請購類型</th><th>採購類型</th></tr>
                                        </thead>
                                        <tbody>
                                            {r.items.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td className="td-center">{index + 1}</td>
                                                    <td>{fmtDate(item.purchaseDate)}</td>
                                                    <td>{item.title}</td>
                                                    <td>{item.vendor}</td>
                                                    <td>{item.ledgerAccountName}</td>
                                                    <td className="td-amount">{fmt(item.amount)}</td>
                                                    <td className="td-center">
                                                        {renderDocNumber(item.docNumber)}
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
                    ) : byPurchaseType.filter(rt => !selectedId || rt.type === selectedId).map((rt) => (
                        <div className="report-section" key={rt.type}>
                            <div className="report-section-header" onClick={() => toggleExpand(rt.type)}>
                                <div className="rs-left">
                                    <span className="rs-expand">{(expandedIds[rt.type] || selectedId === rt.type) ? '▾' : '▸'}</span>
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
                            {(expandedIds[rt.type] || selectedId === rt.type) && (
                                <div className="detail-table-wrap">
                                    <table className="detail-table">
                                        <thead>
                                            <tr><th>序號</th><th>日期</th><th>品名</th><th>廠商</th><th>科目</th><th>金額 (未稅)</th><th>文件號碼</th><th>請購類型</th><th>採購類型</th></tr>
                                        </thead>
                                        <tbody>
                                            {rt.items.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td className="td-index">{index + 1}</td>
                                                    <td>{fmtDate(item.purchaseDate)}</td>
                                                    <td>{item.title}</td>
                                                    <td>{item.vendor}</td>
                                                    <td>{item.ledgerAccountName}</td>
                                                    <td className="td-amount">{fmt(item.amount)}</td>
                                                    <td className="td-center">
                                                        {renderDocNumber(item.docNumber)}
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

            {showAnalysis && <SubjectSummaryModal />}
        </div>
    );
};

export default ReportPage;
