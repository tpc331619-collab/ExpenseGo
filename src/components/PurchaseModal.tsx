import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { addPurchase, updatePurchase } from '../lib/firestore';
import type { Purchase, PurchaseFormData, PurchaseItem } from '../types';
import './PurchaseModal.css';

interface Props {
    onClose: () => void;
    editPurchase?: Purchase | null;
    isCopy?: boolean;
}

const emptyItem = () => ({
    title: '',
    ledgerAccountId: '',
    ledgerAccountName: '',
    amount: '',
});

const emptyForm = (): PurchaseFormData => ({
    vendor: '',
    items: [emptyItem()],
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseType: '工程',
    requisitionType: '非經MM',
    invoice: '',
    docNumber: '',
    note: '',
});

const PurchaseModal: React.FC<Props> = ({ onClose, editPurchase, isCopy }) => {
    const { appUser } = useAuth();
    const { purchases, ledgerAccounts, vendors, refreshPurchases } = useApp();
    const [form, setForm] = useState<PurchaseFormData>(emptyForm());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

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
                invoice: isCopy ? '' : (editPurchase.invoice || ''),
                docNumber: isCopy ? '' : (editPurchase.docNumber || ''),
                note: editPurchase.note,
                items: groupItems.length > 0 ? groupItems.map(p => ({
                    id: isCopy ? undefined : p.id,
                    title: p.title,
                    ledgerAccountId: p.ledgerAccountId,
                    ledgerAccountName: p.ledgerAccountName,
                    amount: String(p.amount)
                })) : [{
                    id: isCopy ? undefined : editPurchase.id,
                    title: editPurchase.title,
                    ledgerAccountId: editPurchase.ledgerAccountId,
                    ledgerAccountName: editPurchase.ledgerAccountName,
                    amount: String(editPurchase.amount)
                }]
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

    const setItem = (idx: number, k: keyof PurchaseItem, v: string) => {
        const newItems = [...form.items];
        newItems[idx] = { ...newItems[idx], [k]: v };

        if (k === 'ledgerAccountId') {
            const acc = ledgerAccounts.find(a => a.id === v);
            newItems[idx].ledgerAccountName = acc ? `${acc.code} ${acc.name}` : '';
        }

        set('items', newItems);
    };

    const totalExclTax = form.items.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const invalid = form.items.some(it => !it.title || !it.ledgerAccountId || !it.amount);
        if (!form.vendor || !form.invoice || !form.docNumber || invalid) {
            setError('請填寫必填欄位（廠商、發票、單號，以及所有品項的品名/科目/金額）');
            return;
        }
        setSaving(true);
        setError('');
        try {
            if (editPurchase && !isCopy) {
                await updatePurchase(editPurchase.groupId, form);
            } else {
                await addPurchase(form, appUser!.uid);
            }
            await refreshPurchases();
            onClose();
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{isCopy ? '複製採購紀錄' : editPurchase ? '編輯採購紀錄' : '新增採購紀錄'}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
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
                            <select value={form.requisitionType} onChange={(e) => set('requisitionType', e.target.value)}>
                                <option value="經MM">經MM</option>
                                <option value="非經MM">非經MM</option>
                            </select>
                        </div>

                        {/* Row 2: 廠商 / 發票號碼 / FI費用報核單號 */}
                        <div className="form-group col-4">
                            <label>廠商 <span className="required">*</span></label>
                            <select value={form.vendor} onChange={(e) => set('vendor', e.target.value)}>
                                <option value="">選擇廠商</option>
                                {vendors.map(v => (
                                    <option key={v.id} value={v.name}>
                                        {v.code ? `${v.code} ${v.name}` : v.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group col-4">
                            <label>發票號碼 <span className="required">*</span></label>
                            <input
                                value={form.invoice}
                                onChange={(e) => set('invoice', e.target.value.toUpperCase())}
                                placeholder="請輸入發票號碼"
                                required
                            />
                        </div>
                        <div className="form-group col-4">
                            <label>{form.requisitionType === '非經MM' ? 'FI費用報核單號' : '發票文件號碼'} <span className="required">*</span></label>
                            <input
                                value={form.docNumber}
                                onChange={(e) => set('docNumber', e.target.value)}
                                placeholder={`請輸入${form.requisitionType === '非經MM' ? 'FI單號' : '發票文件號碼'}`}
                                required
                            />
                        </div>

                        <div className="items-section col-12">
                            <div className="items-header">
                                <div>
                                    <h3>採購品項</h3>
                                    <p className="section-note">※ 請輸入未稅金額，系統將自動計算 5% 營業稅。</p>
                                </div>
                                <button type="button" className="btn-add-item" onClick={addItem}>＋ 新增品項</button>
                            </div>

                            <div className="items-list">
                                {form.items.map((item, idx) => (
                                    <div key={idx} className="item-row">
                                        <div className="item-no">{(idx + 1) * 10}</div>
                                        <div className="item-fields">
                                            <div className="f-group">
                                                <input placeholder="採購品名" value={item.title} onChange={(e) => setItem(idx, 'title', e.target.value)} required />
                                            </div>
                                            <div className="f-group">
                                                <select value={item.ledgerAccountId} onChange={(e) => setItem(idx, 'ledgerAccountId', e.target.value)} required>
                                                    <option value="">選擇科目</option>
                                                    {ledgerAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="f-group">
                                                <input type="number" placeholder="金額 (未稅)" value={item.amount} onChange={(e) => setItem(idx, 'amount', e.target.value)} required />
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
                            <button type="button" className="btn-outline" onClick={onClose}>取消</button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? '儲存中⋯' : (isCopy ? '複製' : (editPurchase ? '更新' : '新增'))}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PurchaseModal;
