import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getPassNotes, addPassNote, updatePassNote, deletePassNote } from '../lib/firestore';
import type { PassNoteEntry } from '../types';
import { Plus, Edit2, Trash2, X, Eye, EyeOff } from 'lucide-react';
import './NotesPage.css';
import '../components/PurchaseModal.css';

interface PassNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<PassNoteEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedByName'>) => Promise<void>;
    editingEntry: PassNoteEntry | null;
    saving: boolean;
}

const PassNoteModal: React.FC<PassNoteModalProps> = ({ isOpen, onClose, onSave, editingEntry, saving }) => {
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [note, setNote] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (editingEntry) {
            setAccount(editingEntry.account);
            setPassword(editingEntry.password);
            setNote(editingEntry.note || '');
        } else {
            setAccount('');
            setPassword('');
            setNote('');
        }
        setShowPassword(false);
    }, [editingEntry, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box admin-modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{editingEntry ? '編輯筆記' : '新增筆記'}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form className="modal-form" onSubmit={e => {
                    e.preventDefault();
                    onSave({ account, password, note });
                }}>
                    <div className="form-group">
                        <label>帳號 <span className="required">*</span></label>
                        <input value={account} onChange={e => setAccount(e.target.value)} placeholder="請輸入帳號" required />
                    </div>
                    <div className="form-group">
                        <label>密碼 <span className="required">*</span></label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="請輸入密碼"
                                required
                            />
                            <button
                                type="button"
                                style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'
                                }}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>備註</label>
                        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="選填..." rows={3}></textarea>
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

const ConfirmDeleteModal: React.FC<{ isOpen: boolean; onConfirm: () => void; onCancel: () => void; }> = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="confirm-content">
                    <div className="confirm-icon icon-danger">⚠️</div>
                    <h3>刪除筆記</h3>
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

const NotesPage: React.FC = () => {
    const { appUser } = useAuth();
    const { refreshContractAndNoteCounts } = useApp();
    const [entries, setEntries] = useState<PassNoteEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<PassNoteEntry | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const fetchEntries = async () => {
        if (!appUser) return;
        setLoading(true);
        try {
            const data = await getPassNotes();
            data.sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis());
            setEntries(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, [appUser]);

    const handleSave = async (data: Omit<PassNoteEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedByName'>) => {
        if (!appUser) return;
        setSaving(true);
        try {
            if (editingEntry) {
                await updatePassNote(editingEntry.id, data, appUser.displayName);
            } else {
                await addPassNote(data, appUser.uid, appUser.displayName);
            }
            setShowModal(false);
            setEditingEntry(null);
            await fetchEntries();
            await refreshContractAndNoteCounts();
        } catch (err: any) {
            alert('儲存失敗：' + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTargetId) return;
        try {
            await deletePassNote(deleteTargetId);
            setDeleteTargetId(null);
            await fetchEntries();
            await refreshContractAndNoteCounts();
        } catch (err: any) {
            alert('刪除失敗：' + (err.message || err));
        }
    };

    const copyText = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(id);
        setTimeout(() => setCopiedField(null), 1500);
    };

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="page-title">筆記管理</h1>
                <button className="btn-primary" onClick={() => { setEditingEntry(null); setShowModal(true); }} style={{ height: '44px', borderRadius: '10px', padding: '0 24px' }}>
                    <Plus size={18} /> 新增筆記
                </button>
            </div>

            <div className="ch-table-wrapper table-wrapper">
                {loading ? (
                    <div className="full-loading"><div className="spinner" /></div>
                ) : entries.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔐</div>
                        <p>尚未加入任何筆記</p>
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th style={{ width: 60, textAlign: 'center' }}>序號</th>
                                <th>帳號</th>
                                <th>密碼</th>
                                <th>備註</th>
                                <th style={{ width: 120, whiteSpace: 'nowrap' }}>更新者</th>
                                <th style={{ width: 160, whiteSpace: 'nowrap' }}>更新時間</th>
                                <th style={{ width: 100, textAlign: 'center' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, idx) => (
                                <tr key={entry.id}>
                                    <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 16, fontWeight: 500 }}>
                                        {idx + 1}
                                    </td>
                                    <td>
                                        <div className={`note-text-clickable ${copiedField === entry.id + 'acc' ? 'copied' : ''}`} onClick={() => copyText(entry.account, entry.id + 'acc')} title="點擊複製帳號">
                                            <span>{entry.account}</span>
                                            {copiedField === entry.id + 'acc' && <span className="copy-feedback">已複製!</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div className={`note-text-clickable ${copiedField === entry.id + 'pwd' ? 'copied' : ''}`} onClick={() => copyText(entry.password, entry.id + 'pwd')} title="點擊複製密碼">
                                            <span>{entry.password}</span>
                                            {copiedField === entry.id + 'pwd' && <span className="copy-feedback">已複製!</span>}
                                        </div>
                                    </td>
                                    <td><span style={{ fontSize: 16, color: 'var(--text2)' }}>{entry.note || '-'}</span></td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: 16, color: 'var(--text2)', fontWeight: 500 }}>
                                            {entry.updatedByName || '-'}
                                        </span>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: 15, color: 'var(--text3)' }}>
                                            {entry.updatedAt.toDate().toLocaleString('zh-TW', {
                                                year: 'numeric', month: '2-digit', day: '2-digit',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-group">
                                            <button className="icon-btn-fancy edit" onClick={() => { setEditingEntry(entry); setShowModal(true); }} title="編輯">
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="icon-btn-fancy delete" onClick={() => setDeleteTargetId(entry.id)} title="刪除">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <PassNoteModal
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

export default NotesPage; 
