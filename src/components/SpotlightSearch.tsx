import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Calendar, User, FileText, CornerDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { Purchase } from '../types';
import './SpotlightSearch.css';

interface SpotlightSearchProps {
    isOpen: boolean;
    onClose: () => void;
}

const SpotlightSearch: React.FC<SpotlightSearchProps> = ({ isOpen, onClose }) => {
    const { purchases, ledgerAccounts } = useApp();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    // Create a map for account codes for faster lookup
    const accountCodeMap = useMemo(() => {
        const map: Record<string, string> = {};
        ledgerAccounts.forEach(acc => {
            map[acc.id] = acc.code.toLowerCase();
        });
        return map;
    }, [ledgerAccounts]);

    // Filter logic
    const results = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase().trim();

        // 1. 金額指令解析 (> or < number)
        if (q.startsWith('>') || q.startsWith('<')) {
            const operator = q[0];
            const amountStr = q.substring(1).trim();
            const amount = parseFloat(amountStr);
            if (!isNaN(amount)) {
                return purchases.filter(p =>
                    operator === '>' ? p.amount > amount : p.amount < amount
                ).sort((a, b) => b.amount - a.amount).slice(0, 10);
            }
        }

        // 2. 廠商指令解析 (@vendor)
        if (q.startsWith('@')) {
            const vendorPart = q.substring(1).trim();
            return purchases.filter(p =>
                p.vendor.toLowerCase().includes(vendorPart)
            ).sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis()).slice(0, 8);
        }

        // 3. 科目指令解析 (#account)
        if (q.startsWith('#')) {
            const accPart = q.substring(1).trim();
            return purchases.filter(p => {
                const accCode = accountCodeMap[p.ledgerAccountId] || '';
                return p.ledgerAccountName.toLowerCase().includes(accPart) || accCode.includes(accPart);
            }).sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis()).slice(0, 8);
        }

        // 基本關鍵字搜尋
        return purchases.filter(p => {
            const accCode = accountCodeMap[p.ledgerAccountId] || '';
            return (
                p.title.toLowerCase().includes(q) ||
                p.vendor.toLowerCase().includes(q) ||
                p.docNumber.toLowerCase().includes(q) ||
                p.ledgerAccountName.toLowerCase().includes(q) ||
                accCode.includes(q) ||
                (p.note && p.note.toLowerCase().includes(q))
            );
        }).slice(0, 8);
    }, [query, purchases, accountCodeMap]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleSelect = (p: Purchase) => {
        onClose();
        navigate(`/purchases?q=${encodeURIComponent(p.title)}`);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowDown') {
                if (results.length > 0) {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
                }
            } else if (e.key === 'ArrowUp') {
                if (results.length > 0) {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
                }
            } else if (e.key === 'Enter') {
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, results, selectedIndex, onClose]);

    // Scroll active item into view
    useEffect(() => {
        const activeItem = resultsRef.current?.querySelector('.spotlight-result-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    const fmt = (n: number) => n.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
    const fmtDate = (d: import('firebase/firestore').Timestamp) => {
        const date = d.toDate();
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    };

    return (
        <div className="spotlight-overlay" onClick={onClose}>
            <div className="spotlight-container" onClick={e => e.stopPropagation()}>
                <div className="spotlight-search-box">
                    <Search className="spotlight-icon" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="搜尋品名、廠商、單號或備註..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="spotlight-input"
                        autoComplete="off"
                    />
                    <div className="spotlight-kbd-hint" onClick={onClose} style={{ cursor: 'pointer' }}>ESC 關閉</div>
                </div>

                {query && (
                    <div className="spotlight-results" ref={resultsRef}>
                        {results.length > 0 ? (
                            results.map((p, idx) => (
                                <div
                                    key={p.id}
                                    className={`spotlight-result-item ${idx === selectedIndex ? 'active' : ''}`}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    onClick={() => handleSelect(p)}
                                >
                                    <div className="result-main">
                                        <div className="result-title">{p.title}</div>
                                        <div className="result-meta">
                                            <span><Calendar size={12} /> {fmtDate(p.purchaseDate)}</span>
                                            <span><User size={12} /> {p.vendor}</span>
                                            {p.docNumber && <span><FileText size={12} /> {p.docNumber}</span>}
                                        </div>
                                    </div>
                                    <div className="result-right">
                                        <div className="result-amount">{fmt(p.amount)}</div>
                                        {idx === selectedIndex && <CornerDownLeft size={14} className="enter-icon" />}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="spotlight-no-results">
                                找不到符合「{query}」的項目
                            </div>
                        )}
                    </div>
                )}

                {!query && (
                    <div className="spotlight-footer">
                        <div className="spotlight-hints">
                            <span className="hint-tag">@廠商</span>
                            <span className="hint-tag">#科目</span>
                            <span className="hint-tag">&gt;金額</span>
                            <span className="hint-tag">&lt;金額</span>
                        </div>
                        提示：輸入關鍵字或使用指令過濾
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpotlightSearch;
