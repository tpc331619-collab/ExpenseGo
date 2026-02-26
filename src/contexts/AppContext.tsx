import React, { createContext, useContext, useEffect, useState } from 'react';
import { getLedgerAccounts, getPurchases, getVendors } from '../lib/firestore';
import type { LedgerAccount, Purchase, Vendor } from '../types';
import { useAuth } from './AuthContext';

interface AppContextValue {
    purchases: Purchase[];
    ledgerAccounts: LedgerAccount[];
    vendors: Vendor[];
    loadingData: boolean;
    selectedYear: number;
    setSelectedYear: (year: number) => void;
    refreshPurchases: (year?: number) => Promise<void>;
    refreshLedgerAccounts: () => Promise<void>;
    refreshVendors: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { appUser } = useAuth();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const refreshPurchases = async (year: number = selectedYear) => {
        if (!appUser) return;
        const filterUid = appUser.role === 'admin' ? undefined : appUser.uid;
        const data = await getPurchases(year, filterUid);
        setPurchases(data);
    };

    const refreshLedgerAccounts = async () => {
        const data = await getLedgerAccounts();
        setLedgerAccounts(data);
    };

    const refreshVendors = async () => {
        const data = await getVendors();
        setVendors(data);
    };

    useEffect(() => {
        if (appUser && (appUser.role === 'admin' || appUser.role === 'user')) {
            setLoadingData(true);

            // 執行一次性遷移 + 載入初始數據
            const init = async () => {
                // Migration check removed to avoid permission errors in console

                try {
                    console.log(`Fetching initial data for year ${selectedYear}...`);
                    await Promise.all([
                        refreshPurchases(selectedYear).catch(e => { throw new Error(`Purchases fetch failed: ${e.message}`); }),
                        refreshLedgerAccounts().catch(e => { throw new Error(`Accounts fetch failed: ${e.message}`); }),
                        refreshVendors().catch(e => { throw new Error(`Vendors fetch failed: ${e.message}`); })
                    ]);
                    console.log('Initial data loaded successfully.');
                } catch (e: any) {
                    console.error('Initial data load failed:', e.message);
                }
            };

            init().finally(() => setLoadingData(false));
        }
    }, [appUser, selectedYear]);

    return (
        <AppContext.Provider value={{
            purchases, ledgerAccounts, vendors, loadingData,
            selectedYear, setSelectedYear,
            refreshPurchases, refreshLedgerAccounts, refreshVendors
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};
