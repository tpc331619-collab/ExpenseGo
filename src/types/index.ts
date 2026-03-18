import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'user' | 'pending' | 'rejected' | 'guest';

export interface AppUser {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    role: UserRole;
    approvedAt: Timestamp | null;
    createdAt: Timestamp;
}

export interface LedgerAccount {
    id: string;
    code: string;
    name: string;
    budget?: number;
    createdAt: Timestamp;
}

export interface Vendor {
    id: string;
    code?: string;
    name: string;
    taxId?: string;       // 統編
    contact?: string;     // 聯絡人
    phone?: string;       // 電話
    createdAt: Timestamp;
}

export interface Purchase {
    id: string;
    title: string;          // 採購品名
    vendor: string;         // 廠商
    ledgerAccountId: string;
    ledgerAccountName: string; // 總帳科目名稱（冗餘存放方便查詢）
    amount: number;         // 金額
    quantity: number;       // 數量
    unit: string;           // 單位
    purchaseDate: Timestamp;
    purchaseType: string;      // 採購類型: 工程, 財務, 勞務
    requisitionType: string;   // 請購類型: 經MM, 非經MM
    itemNo: number;            // 項次: 10, 20, 30...
    groupId: string;           // 群組 ID，用於關聯同一筆採購的多個品項
    docNumber: string;         // 文件號碼
    note: string;
    createdBy: string;      // uid
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface PurchaseItem {
    id?: string;               // 用於編輯時追蹤
    title: string;
    ledgerAccountId: string;
    ledgerAccountName: string;
    amount: string;
}

export interface PurchaseFormData {
    vendor: string;
    purchaseDate: string;
    purchaseType: string;
    requisitionType: string;
    items: PurchaseItem[];
    docNumber: string;
    note: string;
}

export interface AnnualSummaryByAccount {
    ledgerAccountId: string;
    ledgerAccountCode: string;
    ledgerAccountName: string;
    total: number;
    count: number;
    items: Purchase[];
}

export interface AnnualSummaryByVendor {
    vendor: string;
    total: number;
    count: number;
    items: Purchase[];
}

export interface AnnualSummaryByRequisition {
    type: string;
    total: number;
    count: number;
    items: Purchase[];
}

export interface AnnualSummaryByPurchaseType {
    type: string;
    total: number;
    count: number;
    items: Purchase[];
}

export interface NotebookEntry {
    id: string;
    caseName: string;      // 採購案號
    vendor: string;        // 廠商
    contractType: string;  // 契約形式
    totalAmount: number;   // 總額(未稅)
    procNumber: string;    // 採購編號
    startDate: string;     // 契約起
    endDate: string;       // 契約訖
    status: '招標中' | '執行中' | '已結案' | '已終止'; // 狀態
    createdBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface PassNoteEntry {
    id: string;
    account: string;       // 帳號
    password: string;      // 密碼
    note?: string;         // 備註 (選填)
    createdBy: string;
    updatedByName: string; // 顯示是誰更新或創建
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface SystemOptions {
    purchaseTypes: string[];
    requisitionTypes: string[];
    contractTypes?: string[];
    contractExpireDays?: number;
    updatedAt?: Timestamp;
}

export interface PassNoteHistory {
    id: string;
    noteId: string;
    action: 'update';
    updatedByUid: string;
    updatedByName: string;
    updatedAt: Timestamp;
    changes: {
        field: string;
        oldValue: string;
        newValue: string;
    }[];
}
