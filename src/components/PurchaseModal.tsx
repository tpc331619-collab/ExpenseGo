import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { addPurchase, updatePurchase } from '../lib/firestore';
import type { Purchase, PurchaseFormData, PurchaseItem, Vendor } from '../types';
import { Sparkles } from 'lucide-react';
import './PurchaseModal.css';

interface Props {
    onClose: (refresh?: boolean) => void;
    editPurchase?: Purchase | null;
    isCopy?: boolean;
}

const emptyItem = () => ({
    title: '',
    ledgerAccountId: '',
    ledgerAccountName: '',
    amount: '',
    _isManual: false,
});

const emptyForm = (): PurchaseFormData => ({
    vendor: '',
    items: [emptyItem()],
    purchaseDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
    purchaseType: '勞務',
    requisitionType: '經MM',
    docNumber: '',
    note: '',
});

const PurchaseModal: React.FC<Props> = ({ onClose, editPurchase, isCopy }) => {
    const { appUser } = useAuth();
    const { purchases, ledgerAccounts, vendors, selectedYear } = useApp();
    const [form, setForm] = useState<PurchaseFormData>(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        let defaultDate = today.toLocaleDateString('en-CA');

        if (selectedYear !== currentYear) {
            defaultDate = `${selectedYear}-01-01`;
        }

        return {
            ...emptyForm(),
            purchaseDate: defaultDate
        };
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isGrossMode, setIsGrossMode] = useState(false);

    useEffect(() => {
        if (editPurchase) {
            const groupItems = purchases.filter(p => p.groupId === editPurchase.groupId)
                .sort((a, b) => a.itemNo - b.itemNo);

            const d = editPurchase.purchaseDate.toDate();
            setForm({
                vendor: editPurchase.vendor,
                purchaseDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                purchaseType: editPurchase.purchaseType || '工程',
                requisitionType: editPurchase.requisitionType || '非經MM',
                docNumber: isCopy ? '' : (editPurchase.docNumber || ''),
                note: editPurchase.note,
                items: (groupItems.length > 0 ? groupItems : [editPurchase]).map(p => ({
                    id: isCopy ? undefined : p.id,
                    title: p.title,
                    ledgerAccountId: p.ledgerAccountId,
                    ledgerAccountName: p.ledgerAccountName,
                    amount: String(p.amount),
                    _isManual: true // Existing items are treated as manually set
                }))
            });
        }
    }, [editPurchase, purchases, isCopy]);

    const set = (k: keyof PurchaseFormData, v: any) =>
        setForm((f) => ({ ...f, [k]: v }));

    const addItem = () => {
        set('items', [...form.items, emptyItem()]);
    };

    const removeItem = (idx: number) => {
        if (form.items.length <= 1) return;
        set('items', form.items.filter((_, i) => i !== idx));
    };

    const setItem = (idx: number, k: keyof PurchaseItem | '_isManual', v: any) => {
        const newItems = [...form.items] as any[];
        newItems[idx] = { ...newItems[idx], [k]: v };

        if (k === 'ledgerAccountId') {
            const acc = ledgerAccounts.find(a => a.id === v);
            newItems[idx].ledgerAccountName = acc ? acc.name : '';
            // If user selects an account, mark as manual. If they clear it, reset to auto-fill mode.
            newItems[idx]._isManual = !!v;
        }

        set('items', newItems);
    };

    const handleTitleChange = (idx: number, title: string) => {
        const newItems = [...form.items] as any[];
        newItems[idx] = { ...newItems[idx], title };

        const q = title.trim().toLowerCase();
        // Only suggest if the user has typed at least 2 chars AND hasn't manually picked an account for this row
        if (q.length >= 2 && !newItems[idx]._isManual) {
            // Fuzzy search: include any previous title that contains the current input
            const matches = purchases.filter(p => p.title.toLowerCase().includes(q));

            if (matches.length > 0) {
                const accountCounts: Record<string, number> = {};
                matches.forEach(p => {
                    accountCounts[p.ledgerAccountId] = (accountCounts[p.ledgerAccountId] || 0) + 1;
                });

                // Get the most frequent account associated with this keyword
                const sortedAccounts = Object.entries(accountCounts).sort((a, b) => b[1] - a[1]);
                const topAccountId = sortedAccounts[0][0];
                const acc = ledgerAccounts.find(a => a.id === topAccountId);

                if (acc) {
                    newItems[idx].ledgerAccountId = acc.id;
                    newItems[idx].ledgerAccountName = acc.name;
                }
            }
        }
        set('items', newItems);
    };

    const handleVendorChange = (vendorName: string) => {
        set('vendor', vendorName);
        if (!vendorName) return;

        // Predictive Suggestion: Find most frequent account and title for this vendor
        const vendorHistory = purchases.filter(p => p.vendor === vendorName);
        if (vendorHistory.length > 0) {
            const accountCounts: Record<string, number> = {};
            const titleCounts: Record<string, number> = {};

            vendorHistory.forEach(p => {
                accountCounts[p.ledgerAccountId] = (accountCounts[p.ledgerAccountId] || 0) + 1;
                titleCounts[p.title] = (titleCounts[p.title] || 0) + 1;
            });

            const topAccountId = Object.entries(accountCounts).sort((a, b) => b[1] - a[1])[0][0];
            const topTitle = Object.entries(titleCounts).sort((a, b) => b[1] - a[1])[0][0];

            const newItems = [...form.items];
            const acc = ledgerAccounts.find(a => a.id === topAccountId);

            if (acc || topTitle) {
                newItems.forEach((it, idx) => {
                    const isNewOrCopy = !editPurchase || isCopy;
                    const isSingleItem = newItems.length === 1;

                    // 自動切換品名：如果是空的，或者單一品項且為新增模式
                    if (topTitle && (!it.title || (isSingleItem && isNewOrCopy))) {
                        it.title = topTitle;
                    }

                    // 自動切換科目
                    if (acc && (!it.ledgerAccountId || (isSingleItem && isNewOrCopy))) {
                        it.ledgerAccountId = acc.id;
                        it.ledgerAccountName = acc.name;
                    }

                    newItems[idx] = { ...it };
                });
                set('items', newItems);
            }
        }
    };

    const toggleTaxMode = () => {
        const nextMode = !isGrossMode;
        const newItems = form.items.map(it => {
            if (!it.amount) return it;
            const val = parseFloat(it.amount);
            if (isNaN(val)) return it;
            const newVal = nextMode ? val * 1.05 : val / 1.05;
            return { ...it, amount: Math.round(newVal).toString() };
        });
        set('items', newItems);
        setIsGrossMode(nextMode);
    };

    const sortedVendors = useMemo(() => {
        // Sort vendors: Recently used first
        const recentVendors = new Set(purchases.slice(0, 20).map(p => p.vendor));
        return [...vendors].sort((a, b) => {
            const aRecent = recentVendors.has(a.name);
            const bRecent = recentVendors.has(b.name);
            if (aRecent && !bRecent) return -1;
            if (!aRecent && bRecent) return 1;
            return a.name.localeCompare(b.name, 'zh-TW');
        });
    }, [vendors, purchases]);

    const totalExclTax = form.items.reduce((s, item) => {
        const val = parseFloat(item.amount) || 0;
        return s + (isGrossMode ? val / 1.05 : val);
    }, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const invalid = form.items.some(it => !it.title || !it.ledgerAccountId || !it.amount);
        if (!form.vendor || !form.docNumber || invalid) {
            setError('請填寫必填欄位（廠商、單號，以及所有品項的品名/科目/金額）');
            return;
        }
        setSaving(true);
        setError('');
        try {
            // Normalize amounts to Net before saving
            const finalForm = {
                ...form,
                items: form.items.map(it => ({
                    ...it,
                    amount: isGrossMode
                        ? (Math.round((parseFloat(it.amount) / 1.05) * 100) / 100).toString()
                        : it.amount
                }))
            };

            if (editPurchase && !isCopy) {
                const originalYear = editPurchase.purchaseDate.toDate().getFullYear();
                const isAdmin = appUser?.role === 'admin';
                await updatePurchase(editPurchase.groupId, finalForm, appUser!.uid, originalYear, isAdmin);
            } else {
                await addPurchase(finalForm, appUser!.uid);
            }
            onClose(true);
        } catch (err: any) {
            const msg = err.message || '儲存失敗，請再試一次';
            setError(msg);
            alert('儲存失敗：' + msg);
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={() => onClose()}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{isCopy ? '複製採購紀錄' : editPurchase ? '編輯採購紀錄' : '新增採購紀錄'}</h2>
                    <button className="modal-close" onClick={() => onClose()}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="form-error">{error}</div>}

                    <div className="form-grid">
                        {/* Row 1: 採購日期 / 採購類型 / 請購類型 */}
                        <div className="form-group col-4">
                            <label>採購日期 <span className="required">*</span></label>
                            <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
                        </div>
                        <div className="form-group col-4">
                            <label>採購類型</label>
                            <select value={form.purchaseType} onChange={(e) => set('purchaseType', e.target.value)}>
                                <option value="工程">工程</option>
                                <option value="財務">財務</option>
                                <option value="勞務">勞務</option>
                            </select>
                        </div>
                        <div className="form-group col-4">
                            <label>請購類型</label>
                            <select
                                value={form.requisitionType}
                                onChange={(e) => {
                                    const reqType = e.target.value;
                                    let newDocNumber = form.docNumber;

                                    if (reqType === '非經MM') {
                                        // Auto-prefix FL and keep only numbers from existing input
                                        const numsOnly = newDocNumber.replace(/\D/g, '');
                                        newDocNumber = `FL${numsOnly}`;
                                    } else if (form.requisitionType === '非經MM' && reqType !== '非經MM') {
                                        // Remove FL prefix if switching away from 非經MM
                                        newDocNumber = newDocNumber.replace(/^FL/, '');
                                    }

                                    setForm(f => ({ ...f, requisitionType: reqType, docNumber: newDocNumber }));
                                }}
                            >
                                <option value="經MM">經MM</option>
                                <option value="非經MM">非經MM</option>
                            </select>
                        </div>

                        {/* Row 2: 廠商 / 文件號碼 */}
                        <div className="form-group col-6">
                            <label>廠商 <span className="required">*</span></label>
                            <select
                                value={form.vendor}
                                onChange={(e) => handleVendorChange(e.target.value)}
                            >
                                <option value="">選擇廠商</option>
                                {sortedVendors.map((v: Vendor) => (
                                    <option key={v.id} value={v.name}>
                                        {v.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group col-6">
                            <label>{form.requisitionType === '非經MM' ? 'FL費用報核單號' : '發票文件號碼'} <span className="required">*</span></label>
                            <input
                                value={form.docNumber}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    if (form.requisitionType === '非經MM') {
                                        // Always start with FL, and only allow numbers after FL
                                        const numsOnly = val.replace(/^FL/i, '').replace(/\D/g, '');
                                        val = `FL${numsOnly}`;
                                    }
                                    set('docNumber', val);
                                }}
                                placeholder={`請輸入${form.requisitionType === '非經MM' ? 'FL單號 (僅需輸入數字)' : '發票文件號碼'}`}
                                required
                            />
                        </div>


                        <div className="items-section col-12">
                            <div className="items-header">
                                <div>
                                    <h3>採購品項</h3>
                                    <div className="tax-mode-info">
                                        <div className="tax-toggle">
                                            <button type="button" className={!isGrossMode ? 'active' : ''} onClick={toggleTaxMode}>未稅輸入</button>
                                            <button type="button" className={isGrossMode ? 'active' : ''} onClick={toggleTaxMode}>含稅輸入</button>
                                        </div>
                                        <p className="section-note">
                                            {isGrossMode ? '※ 您輸入的是「含稅價」，系統會自動反推 5% 營業稅。' : '※ 您輸入的是「未稅價」，系統將自動計算 5% 營業稅。'}
                                        </p>
                                    </div>
                                </div>
                                <button type="button" className="btn-add-item" onClick={addItem}>＋ 新增品項</button>
                            </div>

                            <div className="smart-tip">
                                <Sparkles size={14} className="sparkle-icon" />
                                <span><b>智能聯想：</b>輸入兩字以上品名或選擇廠商，系統將自動推薦最可能的總帳科目。</span>
                            </div>

                            <div className="items-list">
                                {form.items.map((item, idx) => (
                                    <div key={idx} className="item-row">
                                        <div className="item-no">{(idx + 1) * 10}</div>
                                        <div className="item-fields">
                                            <div className="f-group">
                                                <input placeholder="採購品名" value={item.title} onChange={(e) => handleTitleChange(idx, e.target.value)} required />
                                            </div>
                                            <div className="f-group">
                                                <select value={item.ledgerAccountId} onChange={(e) => setItem(idx, 'ledgerAccountId', e.target.value)} required>
                                                    <option value="">選擇科目</option>
                                                    {ledgerAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="f-group">
                                                <input
                                                    type="number"
                                                    placeholder={isGrossMode ? "金額 (含稅)" : "金額 (未稅)"}
                                                    value={item.amount}
                                                    onChange={(e) => setItem(idx, 'amount', e.target.value)}
                                                    required
                                                />
                                                {(() => {
                                                    const rawVal = parseFloat(item.amount) || 0;
                                                    if (rawVal <= 0) return null;

                                                    const itemAmountNet = isGrossMode ? rawVal / 1.05 : rawVal;
                                                    const currentYear = new Date(form.purchaseDate).getFullYear();

                                                    // 1. Budget Warning
                                                    const acc = ledgerAccounts.find(a => a.id === item.ledgerAccountId);
                                                    let budgetWarn = null;
                                                    if (acc && acc.budget) {
                                                        const spent = purchases
                                                            .filter(p => p.ledgerAccountId === acc.id && p.purchaseDate.toDate().getFullYear() === currentYear && p.id !== (editPurchase?.id))
                                                            .reduce((sum, p) => sum + p.amount, 0);
                                                        const totalAfter = spent + itemAmountNet;
                                                        if (totalAfter > acc.budget) {
                                                            budgetWarn = (
                                                                <div className="budget-warning">
                                                                    ⚠️ 已超出預算 ${(totalAfter - acc.budget).toLocaleString()}
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    // 2. Price Anomaly Detection (Trend Label)
                                                    let trendLabel = null;
                                                    if (form.vendor && item.title.trim().length >= 2) {
                                                        const history = purchases.filter(p =>
                                                            p.vendor === form.vendor &&
                                                            p.title.trim().toLowerCase() === item.title.trim().toLowerCase() &&
                                                            p.id !== (editPurchase?.id)
                                                        );

                                                        if (history.length > 0) {
                                                            const avgPrice = history.reduce((s, p) => s + p.amount, 0) / history.length;
                                                            const diffRate = (itemAmountNet - avgPrice) / avgPrice;

                                                            if (Math.abs(diffRate) >= 0.1) { // 差異超過 10%
                                                                const isUp = diffRate > 0;
                                                                const percent = Math.abs(Math.round(diffRate * 100));
                                                                trendLabel = (
                                                                    <div className={`price-trend-tag ${isUp ? 'up' : 'down'}`}>
                                                                        {isUp ? '↑' : '↓'} {isUp ? '漲幅' : '降幅'} {percent}%
                                                                        <span className="avg-hint">(均價 ${Math.round(avgPrice).toLocaleString()})</span>
                                                                    </div>
                                                                );
                                                            }
                                                        }
                                                    }

                                                    if (!budgetWarn && !trendLabel) return null;

                                                    return (
                                                        <div className="item-alerts">
                                                            {trendLabel}
                                                            {budgetWarn}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        {form.items.length > 1 && (
                                            <button type="button" className="btn-remove-item" onClick={() => removeItem(idx)}>✕</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="form-group col-12">
                            <label>備註</label>
                            <input value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="備註說明" />
                        </div>
                    </div>

                    <div className="modal-footer-combined">
                        <div className="footer-total-box">
                            <label>總金額 (含稅)</label>
                            <div className="total-display-premium">{Math.round(totalExclTax * 1.05).toLocaleString()}</div>
                        </div>
                        <div className="footer-actions">
                            <button type="button" className="btn-outline" onClick={() => onClose()}>取消</button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? '儲存中⋯' : (isCopy ? '複製' : (editPurchase ? '更新' : '新增'))}
                            </button>
                        </div>
                    </div>
                </form>
            </div >
        </div >
    );
};

export default PurchaseModal;
