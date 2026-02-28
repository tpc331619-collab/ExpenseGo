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
    compareYear: number | null;
    setCompareYear: (year: number | null) => void;
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
    const [compareYear, setCompareYearState] = useState<number | null>(() => {
        const saved = localStorage.getItem('compareYear');
        return saved ? Number(saved) : null;
    });

    const setCompareYear = (year: number | null) => {
        setCompareYearState(year);
        if (year === null) {
            localStorage.removeItem('compareYear');
        } else {
            localStorage.setItem('compareYear', String(year));
        }
    };

    const refreshPurchases = async (year: number = selectedYear) => {
        if (!appUser) return;
        const filterUid = ['admin', 'guest'].includes(appUser.role) ? undefined : appUser.uid;
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
        if (compareYear !== null && compareYear === selectedYear) {
            setCompareYear(null);
        }
    }, [selectedYear, compareYear]);

    useEffect(() => {
        if (appUser && ['admin', 'user', 'guest'].includes(appUser.role)) {
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
            compareYear, setCompareYear,
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
