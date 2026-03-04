import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getNotebookEntries, addNotebookEntry } from '../lib/firestore';
import type { NotebookEntry } from '../types';
import { Trash2, Edit2, Plus, X, Search, Copy, Check } from 'lucide-react';
import './NotebookModal.css';

interface Props {
    onClose: () => void;
    onEdit: (entry: NotebookEntry) => void;
    onDelete: (id: string) => void;
    refreshKey: number;
}

const NotebookModal: React.FC<Props> = ({ onClose, onEdit, onDelete, refreshKey }) => {
    const { appUser } = useAuth();
    const [entries, setEntries] = useState<NotebookEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [form, setForm] = useState({
        caseName: '',
        procNumber: '',
        startDate: '',
        endDate: ''
    });

    const fetchEntries = async () => {
        if (!appUser) return;
        setLoading(true);
        try {
            const data = await getNotebookEntries(appUser.uid);
            // Sort by createdAt to maintain consistent list order
            setEntries(data.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, [appUser, refreshKey]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!appUser) return;
        try {
            await addNotebookEntry(form, appUser.uid);
            setForm({ caseName: '', procNumber: '', startDate: '', endDate: '' });
            fetchEntries();
        } catch (err) {
            console.error(err);
            alert('儲存失敗');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box notebook-modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>契約履歷</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="notebook-form">
                    <form onSubmit={handleSubmit} className="form-grid">
                        <div className="form-group col-3">
                            <label>案名</label>
                            <input
                                value={form.caseName}
                                onChange={e => setForm({ ...form, caseName: e.target.value })}
                                placeholder="請輸入案名"
                                required
                            />
                        </div>
                        <div className="form-group col-3">
                            <label>採購編號</label>
                            <input
                                value={form.procNumber}
                                onChange={e => setForm({ ...form, procNumber: e.target.value })}
                                placeholder="請輸入編號"
                                required
                            />
                        </div>
                        <div className="form-group col-5">
                            <label>契約起訖</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="date"
                                    style={{ flex: 1 }}
                                    value={form.startDate}
                                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                                    required
                                />
                                <span style={{ color: 'var(--text3)' }}>~</span>
                                <input
                                    type="date"
                                    style={{ flex: 1 }}
                                    value={form.endDate}
                                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group col-1" style={{ justifyContent: 'flex-end', paddingBottom: '2px' }}>
                            <button type="submit" className="btn-primary" style={{ height: '42px', width: '100%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={20} />
                            </button>
                        </div>
                    </form>
                </div>

                <table className="notebook-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>案名</th>
                            <th>採購編號</th>
                            <th>契約起訖</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>載入中...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={5}>
                                <div className="notebook-empty">
                                    <div className="notebook-empty-icon"><Search size={48} /></div>
                                    <p>尚未加入任何紀錄</p>
                                </div>
                            </td></tr>
                        ) : (
                            entries.map((entry, idx) => (
                                <tr key={entry.id} className="notebook-row">
                                    <td className="nb-seq">{idx + 1}</td>
                                    <td className="nb-name" title={entry.caseName}>{entry.caseName}</td>
                                    <td className="nb-proc">
                                        <span>{entry.procNumber}</span>
                                        <button
                                            className={`btn-copy ${copiedId === entry.id ? 'copied' : ''}`}
                                            onClick={() => {
                                                navigator.clipboard.writeText(entry.procNumber);
                                                setCopiedId(entry.id);
                                                setTimeout(() => setCopiedId(null), 1500);
                                            }}
                                            title="複製採購編號"
                                        >
                                            {copiedId === entry.id ? <Check size={13} /> : <Copy size={13} />}
                                        </button>
                                    </td>
                                    <td className="nb-date">
                                        <span>{entry.startDate}</span>
                                        <span style={{ margin: '0 4px', color: '#94a3b8' }}>~</span>
                                        <span style={{ color: '#9f1239' }}>{entry.endDate}</span>
                                    </td>
                                    <td className="nb-actions">
                                        <button className="btn-icon-premium" onClick={() => onEdit(entry)} title="編輯">
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="btn-icon-premium delete" onClick={() => onDelete(entry.id)} title="刪除">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="modal-footer-combined" style={{ padding: '20px 32px' }}>
                    <div style={{ color: 'var(--text3)', fontSize: '13px', fontWeight: 500 }}>
                        共 {entries.length} 筆紀錄
                    </div>
                    <button className="btn-outline" onClick={onClose}>關閉視窗</button>
                </div>
            </div>
        </div>
    );
};

export default NotebookModal;
