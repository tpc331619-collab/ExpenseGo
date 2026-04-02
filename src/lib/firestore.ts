import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    Timestamp,
    setDoc,
    writeBatch,
    limit,
    startAfter,
    QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, LedgerAccount, Purchase, PurchaseFormData, Vendor, NotebookEntry, PassNoteEntry, PassNoteHistory, SystemOptions } from '../types';

// ─── Users ────────────────────────────────────────────────────────────────────

export const createOrGetUser = async (uid: string, email: string, displayName: string, photoURL: string) => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as AppUser;

    const ADMIN_EMAIL = 'B28803078@gmail.com';
    let role: AppUser['role'] = 'pending';
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        role = 'admin';
    } else if (email === '') {
        role = 'guest'; // Anonymous user starts as 'guest' to preview the app read-only
    }

    const user: Omit<AppUser, 'id'> = {
        uid,
        email: email || `guest-${uid.substring(0, 5)}@anonymous.local`,
        displayName: displayName || '訪客',
        photoURL: photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
        role,
        approvedAt: ['admin', 'user', 'guest'].includes(role) ? Timestamp.now() : null,
        createdAt: Timestamp.now(),
    };
    await setDoc(ref, user);
    return user as AppUser;
};

export const getUser = async (uid: string): Promise<AppUser | null> => {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as AppUser) : null;
};

export const getPendingUsers = async (): Promise<AppUser[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'pending'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AppUser);
};

export const getAllUsers = async (): Promise<AppUser[]> => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AppUser);
};

export const updateUserRole = async (uid: string, role: AppUser['role']) => {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, {
        role,
        approvedAt: role === 'admin' || role === 'user' ? Timestamp.now() : null,
    });
};

export const deleteUser = async (uid: string) => {
    await deleteDoc(doc(db, 'users', uid));
};

// ─── Ledger Accounts ─────────────────────────────────────────────────────────

const getLedgerAccountRef = (year: number) => collection(db, 'years', String(year), 'ledgerAccounts');

export const getLedgerAccounts = async (year: number): Promise<LedgerAccount[]> => {
    const q = query(getLedgerAccountRef(year));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerAccount);
    return data.sort((a, b) => a.code.localeCompare(b.code));
};

export const addLedgerAccount = async (year: number, code: string, name: string, budget: number) => {
    await addDoc(getLedgerAccountRef(year), {
        code,
        name,
        budget,
        createdAt: Timestamp.now()
    });
};

export const deleteLedgerAccount = async (id: string, year: number) => {
    await deleteDoc(doc(db, 'years', String(year), 'ledgerAccounts', id));
};

export const updateLedgerAccount = async (id: string, year: number, code: string, name: string, budget: number) => {
    await updateDoc(doc(db, 'years', String(year), 'ledgerAccounts', id), { code, name, budget });
};

// ─── Vendors ──────────────────────────────────────────────────────────────────

export const getVendors = async (): Promise<Vendor[]> => {
    const q = query(collection(db, 'vendors'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vendor);
};

export const getVendor = async (id: string): Promise<Vendor | null> => {
    const snap = await getDoc(doc(db, 'vendors', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Vendor;
};

export const addVendor = async (data: Partial<Vendor>) => {
    await addDoc(collection(db, 'vendors'), { ...data, createdAt: Timestamp.now() });
};

export const deleteVendor = async (id: string) => {
    await deleteDoc(doc(db, 'vendors', id));
};

export const updateVendor = async (id: string, data: Partial<Vendor>) => {
    await updateDoc(doc(db, 'vendors', id), data);
};

// ─── Purchases ───────────────────────────────────────────────────────────────

const getPurchaseRef = (year: number) => collection(db, 'years', String(year), 'purchases');

/** Parse a YYYY-MM-DD string as local time (not UTC) to avoid timezone shift */
const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export interface PaginatedResult<T> {
    data: T[];
    lastDoc: QueryDocumentSnapshot | null;
    hasMore: boolean;
}

export const getPaginatedPurchases = async (
    year: number,
    pageSize: number = 200,
    lastDoc: QueryDocumentSnapshot | null = null,
    filters: {
        uid?: string;
        ledgerAccountId?: string;
        vendor?: string;
        requisitionType?: string;
        purchaseType?: string;
    } = {}
): Promise<PaginatedResult<Purchase>> => {
    const purchaseRef = getPurchaseRef(year);
    let q = query(purchaseRef, orderBy('purchaseDate', 'desc'), orderBy('createdAt', 'desc'));

    // Only filter by uid server-side (single field, no composite index needed)
    if (filters.uid) {
        q = query(q, where('createdBy', '==', filters.uid));
    }

    if (lastDoc) {
        q = query(q, startAfter(lastDoc));
    }

    q = query(q, limit(pageSize));

    const snap = await getDocs(q);
    let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase);

    // Client-side filtering for the rest (avoids Firestore composite index requirement)
    if (filters.ledgerAccountId) {
        data = data.filter(p => p.ledgerAccountId === filters.ledgerAccountId);
    }
    if (filters.requisitionType) {
        data = data.filter(p => p.requisitionType === filters.requisitionType);
    }
    if (filters.purchaseType) {
        data = data.filter(p => p.purchaseType === filters.purchaseType);
    }
    if (filters.vendor) {
        data = data.filter(p => p.vendor === filters.vendor);
    }

    const nextLastDoc = snap.docs[snap.docs.length - 1] || null;

    return {
        data,
        lastDoc: nextLastDoc,
        hasMore: snap.docs.length === pageSize
    };
};

export const getPurchases = async (year: number, uid?: string): Promise<Purchase[]> => {
    const purchaseRef = getPurchaseRef(year);
    let q;

    if (uid) {
        // 僅使用相等過濾，不加入 orderBy 以避免需要複合索引
        q = query(purchaseRef, where('createdBy', '==', uid));
    } else {
        q = query(purchaseRef, orderBy('purchaseDate', 'desc'));
    }

    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase);

    // 如果是依 UID 過濾，則在記憶體中進行排序
    if (uid) {
        data.sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis());
    }

    return data;
};

export const addPurchase = async (data: PurchaseFormData, uid: string): Promise<string> => {
    const year = parseLocalDate(data.purchaseDate).getFullYear();
    const purchaseRef = getPurchaseRef(year);
    const groupId = doc(purchaseRef).id;
    const batch = writeBatch(db);

    data.items.forEach((item, index) => {
        const ref = doc(purchaseRef);
        batch.set(ref, {
            title: item.title,
            vendor: data.vendor,
            ledgerAccountId: item.ledgerAccountId,
            ledgerAccountName: item.ledgerAccountName,
            amount: parseFloat(item.amount) || 0,
            purchaseDate: Timestamp.fromDate(parseLocalDate(data.purchaseDate)),
            purchaseType: data.purchaseType,
            requisitionType: data.requisitionType,
            itemNo: (index + 1) * 10,
            groupId: groupId,
            docNumber: data.docNumber,
            note: data.note,
            createdBy: uid,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
    });

    await batch.commit();
    return groupId;
};

export const updatePurchase = async (groupId: string, data: PurchaseFormData, currentUid: string, originalYear?: number, isAdmin: boolean = false) => {
    console.log(`[updatePurchase] START - groupId: ${groupId}, currentUid: ${currentUid}, isAdmin: ${isAdmin}`);
    const year = parseLocalDate(data.purchaseDate).getFullYear();
    const purchaseRef = getPurchaseRef(year);

    // 1. 取得舊資料：優先尋找原始年份，否則尋找當前年份
    const searchYear = originalYear || year;
    const q = isAdmin
        ? query(getPurchaseRef(searchYear), where('groupId', '==', groupId))
        : query(getPurchaseRef(searchYear), where('createdBy', '==', currentUid));

    const snap = await getDocs(q);
    const existingDocs = isAdmin ? snap.docs : snap.docs.filter(d => d.data().groupId === groupId);

    const batch = writeBatch(db);

    // 2. 刪除舊資料
    existingDocs.forEach(d => batch.delete(d.ref));

    // 3. 寫入新資料 (保留原建立時間)
    const oldCreatedAt = existingDocs[0]?.data()?.createdAt || Timestamp.now();

    data.items.forEach((item, index) => {
        const ref = doc(purchaseRef);
        batch.set(ref, {
            title: item.title,
            vendor: data.vendor,
            ledgerAccountId: item.ledgerAccountId,
            ledgerAccountName: item.ledgerAccountName,
            amount: parseFloat(item.amount) || 0,
            quantity: 1,
            unit: '項',
            purchaseDate: Timestamp.fromDate(parseLocalDate(data.purchaseDate)),
            purchaseType: data.purchaseType,
            requisitionType: data.requisitionType,
            itemNo: (index + 1) * 10,
            groupId: groupId,
            docNumber: data.docNumber,
            note: data.note,
            updatedAt: Timestamp.now(),
            createdBy: currentUid,
            createdAt: oldCreatedAt,
        });
    });

    await batch.commit();
};

export const deletePurchaseGroup = async (groupId: string, year: number, uid?: string) => {
    const purchaseRef = getPurchaseRef(year);
    // 非 admin (有傳 uid) 時，必須帶 createdBy 條件才符合 Firestore read rule
    const q = uid
        ? query(purchaseRef, where('groupId', '==', groupId), where('createdBy', '==', uid))
        : query(purchaseRef, where('groupId', '==', groupId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
};

export const deletePurchasesBatch = async (groupIds: string[], year: number, uid?: string) => {
    const purchaseRef = getPurchaseRef(year);
    let batch = writeBatch(db);
    let opCount = 0;

    for (const groupId of groupIds) {
        const q = uid
            ? query(purchaseRef, where('groupId', '==', groupId), where('createdBy', '==', uid))
            : query(purchaseRef, where('groupId', '==', groupId));
        const snap = await getDocs(q);

        for (const d of snap.docs) {
            batch.delete(d.ref);
            opCount++;

            if (opCount >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                opCount = 0;
            }
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }
};

/**
 * 自動去重清理：尋找並刪除完全重複且資訊較差（無預算科目ID）的採購紀錄
 */
export const cleanupDuplicatePurchases = async (year: number, validLedgerAccountIds: string[]) => {
    const purchaseRef = getPurchaseRef(year);
    const snap = await getDocs(query(purchaseRef));
    const all = snap.docs.map(d => ({ ...(d.data() as Purchase), id: d.id, ref: d.ref }));

    const seen = new Map<string, typeof all[0]>();
    const toDelete: typeof all[0][] = [];

    all.forEach(p => {
        const d = p.purchaseDate.toDate();
        const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        // 唯一鍵值：日期 + 廠商 + 單號 + 品名 + 金額
        const key = `${dateStr}|${p.vendor}|${p.docNumber || 'no-doc'}|${p.title}|${p.amount}`;

        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, p);
        } else {
            // 比對品質
            const existingIsGood = validLedgerAccountIds.includes(existing.ledgerAccountId);
            const currentIsGood = validLedgerAccountIds.includes(p.ledgerAccountId);

            if (!existingIsGood && currentIsGood) {
                // 之前的不好，現在的好 -> 標記之前的刪除，保留現在的
                toDelete.push(existing);
                seen.set(key, p);
            } else {
                // 如果現在的不好，或者是兩個都好/兩個都不好（取先看到的），則刪除現在的
                toDelete.push(p);
            }
        }
    });

    if (toDelete.length === 0) return 0;

    let batch = writeBatch(db);
    let count = 0;
    for (const item of toDelete) {
        batch.delete(item.ref);
        count++;
        if (count % 450 === 0) {
            await batch.commit();
            batch = writeBatch(db);
        }
    }
    await batch.commit();
    return toDelete.length;
};

// ─── Migration Utility ────────────────────────────────────────────────────────

export const migrateToYearlyStructure = async () => {
    console.log('Starting migration to yearly structure...');
    const legacyRef = collection(db, 'purchases');
    const snap = await getDocs(legacyRef);

    if (snap.empty) {
        console.log('No legacy data to migrate.');
        return;
    }

    const batch = writeBatch(db);
    let count = 0;

    snap.docs.forEach((d) => {
        const data = d.data();
        const pDate = data.purchaseDate?.toDate();
        if (!pDate) return;

        const year = pDate.getFullYear();
        const newRef = doc(getPurchaseRef(year), d.id);

        // Copy to new path
        batch.set(newRef, data);
        // Mark for deletion from old path
        batch.delete(d.ref);
        count++;
    });

    await batch.commit();
    console.log(`Migration complete. Moved ${count} documents.`);
};

// ─── Notebooks ───────────────────────────────────────────────────────────────

export const getNotebookEntries = async (uid: string): Promise<NotebookEntry[]> => {
    const q = query(
        collection(db, 'notebooks'),
        where('createdBy', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as NotebookEntry);
};

export const addNotebookEntry = async (data: Omit<NotebookEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>, uid: string) => {
    await addDoc(collection(db, 'notebooks'), {
        ...data,
        createdBy: uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

export const updateNotebookEntry = async (id: string, data: Partial<Omit<NotebookEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>) => {
    const ref = doc(db, 'notebooks', id);
    await updateDoc(ref, {
        ...data,
        updatedAt: Timestamp.now(),
    });
};

export const deleteNotebookEntry = async (id: string) => {
    await deleteDoc(doc(db, 'notebooks', id));
};

// ─── PassNotes ───────────────────────────────────────────────────────────────

export const getPassNotes = async (): Promise<PassNoteEntry[]> => {
    const q = query(
        collection(db, 'passNotes')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as PassNoteEntry);
};

export const addPassNote = async (data: Omit<PassNoteEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedByName'>, uid: string, operatorName: string) => {
    await addDoc(collection(db, 'passNotes'), {
        ...data,
        createdBy: uid,
        updatedByName: operatorName,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

export const updatePassNote = async (id: string, oldData: PassNoteEntry, newData: Partial<Omit<PassNoteEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedByName'>>, operatorUid: string, operatorName: string) => {
    const changes: { field: string, oldValue: string, newValue: string }[] = [];

    // Compare fields
    if (newData.account !== undefined && newData.account !== oldData.account) {
        changes.push({ field: '帳號', oldValue: oldData.account, newValue: newData.account });
    }
    if (newData.password !== undefined && newData.password !== oldData.password) {
        changes.push({ field: '密碼', oldValue: oldData.password, newValue: newData.password });
    }
    if (newData.note !== undefined && newData.note !== oldData.note) {
        changes.push({ field: '備註', oldValue: oldData.note || '', newValue: newData.note });
    }

    const batch = writeBatch(db);

    const ref = doc(db, 'passNotes', id);
    batch.update(ref, {
        ...newData,
        updatedByName: operatorName,
        updatedAt: Timestamp.now(),
    });

    if (changes.length > 0) {
        const historyRef = doc(collection(db, 'passNotes', id, 'history'));
        batch.set(historyRef, {
            noteId: id,
            action: 'update',
            updatedByUid: operatorUid,
            updatedByName: operatorName,
            updatedAt: Timestamp.now(),
            changes: changes
        });
    }

    await batch.commit();
};

export const getPassNoteHistory = async (noteId: string): Promise<PassNoteHistory[]> => {
    const q = query(
        collection(db, 'passNotes', noteId, 'history')
    );
    const snap = await getDocs(q);
    const history = snap.docs.map(d => ({ id: d.id, ...d.data() }) as PassNoteHistory);
    // Sort in memory to avoid needing composite index in Firestore
    return history.sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis());
};

export const deletePassNoteHistoryEntries = async (noteId: string, historyIds: string[]) => {
    const batch = writeBatch(db);
    historyIds.forEach(id => {
        const ref = doc(db, 'passNotes', noteId, 'history', id);
        batch.delete(ref);
    });
    await batch.commit();
};

export const deletePassNote = async (id: string) => {
    // Delete all history entries first to completely remove the document node from Firestore console
    const historyRef = collection(db, 'passNotes', id, 'history');
    const historySnap = await getDocs(historyRef);

    const batch = writeBatch(db);
    historySnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // Delete the note document itself
    batch.delete(doc(db, 'passNotes', id));

    await batch.commit();
};

// ─── System Options ──────────────────────────────────────────────────────────

export const getSystemOptions = async (): Promise<SystemOptions> => {
    const ref = doc(db, 'settings', 'systemOptions');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        const defaultOptions: SystemOptions = {
            purchaseTypes: ['工程', '財務', '勞務'],
            requisitionTypes: ['經MM', '非經MM'],
            contractTypes: ['勞務契約', '小額採購契約', '共同供應契約'],
            contractExpireDays: 120
        };
        // 嘗試寫入預設值
        try {
            await setDoc(ref, { ...defaultOptions, updatedAt: Timestamp.now() });
        } catch (e) {
            console.warn('Failed to set default system options, likely due to rules during initial read', e);
        }
        return defaultOptions;
    }
    return snap.data() as SystemOptions;
};

export const updateSystemOptions = async (data: Partial<SystemOptions>) => {
    const ref = doc(db, 'settings', 'systemOptions');
    // 使用 setDoc 與 merge 以確保文件即使一開始不存在也能成功更新
    await setDoc(ref, {
        ...data,
        updatedAt: Timestamp.now()
    }, { merge: true });
};
