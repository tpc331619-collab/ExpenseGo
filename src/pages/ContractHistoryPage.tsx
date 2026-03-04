import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    getNotebookEntries,
    addNotebookEntry,
    updateNotebookEntry,
    deleteNotebookEntry,
} from '../lib/firestore';
import type { NotebookEntry } from '../types';
import { Plus, Edit2, Trash2, X, Copy, Check } from 'lucide-react';
import './ContractHistoryPage.css';
import '../components/PurchaseModal.css'; // Reuse modal styles

// ── Edit / Add Modal ──────────────────────────────────────────────────────────
interface EntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { caseName: string; procNumber: string; startDate: string; endDate: string }) => Promise<void>;
    editingEntry: NotebookEntry | null;
    saving: boolean;
}

const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, onSave, editingEntry, saving }) => {
    const [caseName, setCaseName] = useState('');
    const [procNumber, setProcNumber] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        if (editingEntry) {
            setCaseName(editingEntry.caseName);
            setProcNumber(editingEntry.procNumber);
            setStartDate(editingEntry.startDate);
            setEndDate(editingEntry.endDate);
        } else {
            setCaseName('');
            setProcNumber('');
            setStartDate('');
            setEndDate('');
        }
    }, [editingEntry, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box admin-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{editingEntry ? '編輯契約履歷' : '新增契約履歷'}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ caseName, procNumber, startDate, endDate }); }}>
                    <div className="form-group">
                        <label>案名 <span className="required">*</span></label>
                        <input value={caseName} onChange={e => setCaseName(e.target.value)} placeholder="請輸入案名" required />
                    </div>
                    <div className="form-group">
                        <label>採購編號 <span className="required">*</span></label>
                        <input value={procNumber} onChange={e => setProcNumber(e.target.value)} placeholder="請輸入採購編號" required />
                    </div>
                    <div className="form-group">
                        <label>契約起訖 <span className="required">*</span></label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ flex: 1 }} />
                            <span style={{ color: 'var(--text3)', fontWeight: 600 }}>~</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={{ flex: 1 }} />
                        </div>
                    </div>
                    <div className="modal-footer-combined">
                        <div className="footer-actions" style={{ marginLeft: 'auto' }}>
                            <button type="button" className="btn-outline" onClick={onClose}>取消</button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? '儲存中...' : '確認儲存'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Confirm Delete Modal ──────────────────────────────────────────────────────
interface ConfirmDeleteProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteProps> = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="confirm-content">
                    <div className="confirm-icon icon-danger">⚠️</div>
                    <h3>刪除契約履歷</h3>
                    <p>確定要刪除此筆紀錄？<br />此操作無法復原。</p>
                </div>
                <div className="confirm-footer">
                    <button className="btn-outline" onClick={onCancel}>取消</button>
                    <button className="btn-danger-confirm" onClick={onConfirm}>確定刪除</button>
                </div>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const ContractHistoryPage: React.FC = () => {
    const { appUser } = useAuth();

    const [entries, setEntries] = useState<NotebookEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<NotebookEntry | null>(null);
    const [saving, setSaving] = useState(false);

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchEntries = async () => {
        if (!appUser) return;
        setLoading(true);
        try {
            const data = await getNotebookEntries(appUser.uid);
            setEntries(data.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEntries(); }, [appUser]);

    const handleSave = async (data: { caseName: string; procNumber: string; startDate: string; endDate: string }) => {
        if (!appUser) return;
        setSaving(true);
        try {
            if (editingEntry) {
                await updateNotebookEntry(editingEntry.id, data);
            } else {
                await addNotebookEntry(data, appUser.uid);
            }
            setShowModal(false);
            setEditingEntry(null);
            await fetchEntries();
        } catch (err: any) {
            alert('儲存失敗：' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTargetId) return;
        try {
            await deleteNotebookEntry(deleteTargetId);
            setDeleteTargetId(null);
            await fetchEntries();
        } catch (err: any) {
            alert('刪除失敗：' + err.message);
        }
    };

    const startAdd = () => { setEditingEntry(null); setShowModal(true); };
    const startEdit = (entry: NotebookEntry) => { setEditingEntry(entry); setShowModal(true); };

    const copyProcNumber = (entry: NotebookEntry) => {
        navigator.clipboard.writeText(entry.procNumber);
        setCopiedId(entry.id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">契約履歷</h1>
                <div className="header-actions">
                    <button className="btn-primary" onClick={startAdd}>
                        <Plus size={18} /> 新增履歷
                    </button>
                </div>
            </div>

            <div className="ch-table-wrapper table-wrapper">
                {loading ? (
                    <div className="full-loading"><div className="spinner" /></div>
                ) : entries.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <p>尚未加入任何契約履歷</p>
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th style={{ width: 48, color: 'var(--text3)' }}>#</th>
                                <th>案名</th>
                                <th>採購編號</th>
                                <th>契約起日</th>
                                <th>契約訖日</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, idx) => (
                                <tr key={entry.id}>
                                    <td style={{ color: 'var(--text3)', textAlign: 'center', fontSize: 13 }}>{idx + 1}</td>
                                    <td style={{ fontWeight: 600 }}>{entry.caseName}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <code style={{ fontSize: 13, background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                                {entry.procNumber}
                                            </code>
                                            <button
                                                className={`ch-copy-btn ${copiedId === entry.id ? 'copied' : ''}`}
                                                onClick={() => copyProcNumber(entry)}
                                                title="複製採購編號"
                                            >
                                                {copiedId === entry.id ? <Check size={13} /> : <Copy size={13} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ color: '#1e293b', fontSize: 14 }}>{entry.startDate}</td>
                                    <td style={{ color: '#9f1239', fontWeight: 600, fontSize: 14 }}>{entry.endDate}</td>
                                    <td>
                                        <div className="role-actions">
                                            <button className="role-btn user" onClick={() => startEdit(entry)}>
                                                <Edit2 size={14} style={{ marginRight: 4 }} />編輯
                                            </button>
                                            <button className="role-btn reject" onClick={() => setDeleteTargetId(entry.id)}>
                                                <Trash2 size={14} style={{ marginRight: 4 }} />刪除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <EntryModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingEntry(null); }}
                onSave={handleSave}
                editingEntry={editingEntry}
                saving={saving}
            />

            <ConfirmDeleteModal
                isOpen={!!deleteTargetId}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTargetId(null)}
            />
        </div>
    );
};

export default ContractHistoryPage;
