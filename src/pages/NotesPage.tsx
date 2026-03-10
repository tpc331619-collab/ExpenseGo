import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getPassNotes, addPassNote, updatePassNote, deletePassNote, getPassNoteHistory, deletePassNoteHistoryEntries } from '../lib/firestore';
import type { PassNoteEntry, PassNoteHistory } from '../types';
import { Plus, Edit2, Trash2, X, Eye, EyeOff, Clock, CheckSquare } from 'lucide-react';
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
    const [showPassword, setShowPassword] = useState(true);

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
        setShowPassword(true);
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
                    if (editingEntry &&
                        account === editingEntry.account &&
                        password === editingEntry.password &&
                        (note || '') === (editingEntry.note || '')) {
                        alert('資料一樣');
                        return;
                    }
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
            <div className="modal-box confirm-modal-fancy" onClick={e => e.stopPropagation()}>
                <div className="confirm-icon-wrapper">
                    <Trash2 size={32} />
                </div>
                <h3>確認刪除筆記</h3>
                <p>您確定要刪除這筆筆記嗎？<br />此動作將無法復原，請務必確認。</p>
                <div className="confirm-actions-fancy">
                    <button className="btn-cancel-fancy" onClick={onCancel}>
                        取消
                    </button>
                    <button className="btn-delete-fancy" onClick={onConfirm}>
                        確定刪除
                    </button>
                </div>
            </div>
        </div>
    );
};

const NoteHistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; noteId: string | null }> = ({ isOpen, onClose, noteId }) => {
    const [history, setHistory] = useState<PassNoteHistory[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [deleting, setDeleting] = useState(false);

    const fetchHistory = async () => {
        if (!noteId) return;
        setLoading(true);
        try {
            const data = await getPassNoteHistory(noteId);
            setHistory(data);
        } catch (err) {
            console.error('Failed to fetch history', err);
            alert('讀取紀錄失敗，請檢查網路或 Firebase 規則設定。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && noteId) {
            setSelectedIds([]);
            fetchHistory();
        }
    }, [isOpen, noteId]);

    const handleBatchDelete = async () => {
        if (selectedIds.length === 0 || !noteId) return;
        if (!window.confirm(`確定要刪除這 ${selectedIds.length} 筆修改紀錄嗎？此動作成法復原。`)) return;

        setDeleting(true);
        try {
            await deletePassNoteHistoryEntries(noteId, selectedIds);
            setSelectedIds([]);
            await fetchHistory();
        } catch (err: any) {
            alert('刪除失敗：' + (err.message || err));
        } finally {
            setDeleting(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === history.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(history.map(h => h.id));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box admin-modal" style={{ maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{ flexShrink: 0 }}>
                    <h2>修改紀錄</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body" style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
                    {loading ? (
                        <div className="full-loading" style={{ height: 100 }}><div className="spinner" /></div>
                    ) : history.length === 0 ? (
                        <div className="empty-state" style={{ padding: '20px 0' }}>
                            <p>尚無修改紀錄</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                <button
                                    className="btn-text"
                                    onClick={toggleSelectAll}
                                    style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                    <CheckSquare size={14} />
                                    {selectedIds.length === history.length ? '取消全選' : '全選所有紀錄'}
                                </button>
                                {selectedIds.length > 0 && (
                                    <button
                                        className="btn-danger-confirm"
                                        onClick={handleBatchDelete}
                                        disabled={deleting}
                                        style={{ padding: '6px 12px', fontSize: 12, height: 'auto' }}
                                    >
                                        {deleting ? '刪除中...' : `刪除已選 (${selectedIds.length})`}
                                    </button>
                                )}
                            </div>
                            <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {history.map((item, idx) => {
                                    const isLatest = idx === 0;
                                    const isSelected = selectedIds.includes(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleSelect(item.id)}
                                            style={{
                                                background: isSelected ? '#dbeafe' : (isLatest ? '#eff6ff' : '#f8fafc'),
                                                padding: '14px',
                                                borderRadius: '10px',
                                                border: `1px solid ${isSelected ? '#3b82f6' : (isLatest ? '#bfdbfe' : '#e2e8f0')}`,
                                                cursor: 'pointer',
                                                position: 'relative',
                                                transition: 'all 0.2s ease',
                                                boxShadow: isLatest ? '0 2px 4px rgba(59, 130, 246, 0.05)' : 'none'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', fontSize: 13, color: 'var(--text3)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => { }} // Managed by parent click
                                                        style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                                                    />
                                                    <span style={{ fontWeight: 800, color: isLatest ? '#1e293b' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14 }}>
                                                        {item.updatedByName}
                                                    </span>
                                                    {isLatest && <span style={{ background: '#3b82f6', color: 'white', padding: '3px 10px', borderRadius: '8px', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' }}>最新!</span>}
                                                </div>
                                                <span style={{ marginLeft: 8, flexShrink: 0, opacity: 0.8 }}>
                                                    {item.updatedAt.toDate().toLocaleString('zh-TW', {
                                                        year: 'numeric', month: '2-digit', day: '2-digit',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '26px' }}>
                                                {item.changes.map((change, cIdx) => (
                                                    <div key={cIdx} style={{ fontSize: 13, lineHeight: '1.4' }}>
                                                        <span style={{ fontWeight: 600, color: isLatest ? '#3b82f6' : '#94a3b8', marginRight: 6 }}>{change.field}</span>
                                                        <span style={{ color: '#94a3b8', textDecoration: 'line-through', marginRight: 6 }}>{change.oldValue || '(空)'}</span>
                                                        <span style={{ color: isLatest ? '#1e293b' : '#64748b', fontWeight: 500 }}>➔ {change.newValue || '(空)'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
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
    const [historyTargetId, setHistoryTargetId] = useState<string | null>(null);
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
                await updatePassNote(editingEntry.id, editingEntry, data, appUser.uid, appUser.displayName || '未知');
            } else {
                await addPassNote(data, appUser.uid, appUser.displayName || '未知');
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
                                    <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, fontWeight: 500 }}>
                                        {idx + 1}
                                    </td>
                                    <td>
                                        <div className={`note-text-clickable ${copiedField === entry.id + 'acc' ? 'copied' : ''}`} onClick={() => copyText(entry.account, entry.id + 'acc')} title="點擊複製帳號">
                                            <span>{entry.account}</span>
                                            {copiedField === entry.id + 'acc' && <span className="copy-feedback">已複製!</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div className={`note-text-clickable password-cell ${copiedField === entry.id + 'pwd' ? 'copied' : ''}`} onClick={() => copyText(entry.password, entry.id + 'pwd')} title="點擊複製密碼">
                                            <span>{entry.password}</span>
                                            {copiedField === entry.id + 'pwd' && <span className="copy-feedback">已複製!</span>}
                                        </div>
                                    </td>
                                    <td><span style={{ fontSize: 14, color: 'var(--text2)' }}>{entry.note || '-'}</span></td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>
                                            {entry.updatedByName || '-'}
                                        </span>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: 13, color: 'var(--text3)' }}>
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
                                            <button className="icon-btn-fancy history" onClick={() => setHistoryTargetId(entry.id)} title="歷史紀錄">
                                                <Clock size={15} />
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

            <NoteHistoryModal
                isOpen={!!historyTargetId}
                onClose={() => setHistoryTargetId(null)}
                noteId={historyTargetId}
            />
        </div>
    );
};

export default NotesPage; 
