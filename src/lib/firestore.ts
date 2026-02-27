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
import type { AppUser, LedgerAccount, Purchase, PurchaseFormData, Vendor } from '../types';

// ─── Users ────────────────────────────────────────────────────────────────────

export const createOrGetUser = async (uid: string, email: string, displayName: string, photoURL: string) => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as AppUser;

    const ADMIN_EMAIL = 'B28803078@gmail.com';
    const role = email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'pending';

    const user: Omit<AppUser, 'id'> = {
        uid,
        email,
        displayName,
        photoURL,
        role,
        approvedAt: role === 'admin' ? Timestamp.now() : null,
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

// ─── Ledger Accounts ─────────────────────────────────────────────────────────

export const getLedgerAccounts = async (): Promise<LedgerAccount[]> => {
    const q = query(collection(db, 'ledgerAccounts'), orderBy('code', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerAccount);
};

export const addLedgerAccount = async (code: string, name: string, budget: number) => {
    await addDoc(collection(db, 'ledgerAccounts'), {
        code,
        name,
        budget,
        createdAt: Timestamp.now()
    });
};

export const deleteLedgerAccount = async (id: string) => {
    await deleteDoc(doc(db, 'ledgerAccounts', id));
};

export const updateLedgerAccount = async (id: string, code: string, name: string, budget: number) => {
    await updateDoc(doc(db, 'ledgerAccounts', id), { code, name, budget });
};

// ─── Vendors ──────────────────────────────────────────────────────────────────

export const getVendors = async (): Promise<Vendor[]> => {
    const q = query(collection(db, 'vendors'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vendor);
};

export const addVendor = async (code: string, name: string) => {
    await addDoc(collection(db, 'vendors'), { code, name, createdAt: Timestamp.now() });
};

export const deleteVendor = async (id: string) => {
    await deleteDoc(doc(db, 'vendors', id));
};

export const updateVendor = async (id: string, code: string, name: string) => {
    await updateDoc(doc(db, 'vendors', id), { code, name });
};

// ─── Purchases ───────────────────────────────────────────────────────────────

const getPurchaseRef = (year: number) => collection(db, 'years', String(year), 'purchases');

export interface PaginatedResult<T> {
    data: T[];
    lastDoc: QueryDocumentSnapshot | null;
    hasMore: boolean;
}

export const getPaginatedPurchases = async (
    year: number,
    pageSize: number = 20,
    lastDoc: QueryDocumentSnapshot | null = null,
    filters: {
        uid?: string;
        ledgerAccountId?: string;
        vendor?: string;
    } = {}
): Promise<PaginatedResult<Purchase>> => {
    const purchaseRef = getPurchaseRef(year);
    let q = query(purchaseRef, orderBy('purchaseDate', 'desc'), orderBy('createdAt', 'desc'));

    if (filters.uid) {
        q = query(q, where('createdBy', '==', filters.uid));
    }
    if (filters.ledgerAccountId) {
        q = query(q, where('ledgerAccountId', '==', filters.ledgerAccountId));
    }
    if (filters.vendor) {
        // Firestore doesn't support partial string match ('contains') natively with where.
        // For simple equality:
        q = query(q, where('vendor', '==', filters.vendor));
    }

    if (lastDoc) {
        q = query(q, startAfter(lastDoc));
    }

    q = query(q, limit(pageSize));

    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase);
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
    const year = new Date(data.purchaseDate).getFullYear();
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
            purchaseDate: Timestamp.fromDate(new Date(data.purchaseDate)),
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
    const year = new Date(data.purchaseDate).getFullYear();
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
            purchaseDate: Timestamp.fromDate(new Date(data.purchaseDate)),
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

export const deletePurchaseGroup = async (groupId: string, year: number) => {
    const purchaseRef = getPurchaseRef(year);
    const q = query(purchaseRef, where('groupId', '==', groupId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
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
