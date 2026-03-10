import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { getLedgerAccounts, getPurchases, getVendors, getSystemOptions } from '../lib/firestore';
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
    purchaseListRefreshKey: number;
    incrementPurchaseListRefresh: () => void;
    purchaseTypes: string[];
    requisitionTypes: string[];
    contractTypes: string[];
    contractExpireDays: number;
    refreshSystemOptions: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { appUser } = useAuth();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [purchaseListRefreshKey, setPurchaseListRefreshKey] = useState(0);
    const [purchaseTypes, setPurchaseTypes] = useState<string[]>([]);
    const [requisitionTypes, setRequisitionTypes] = useState<string[]>([]);
    const [contractTypes, setContractTypes] = useState<string[]>([]);
    const [contractExpireDays, setContractExpireDays] = useState<number>(120);
    const incrementPurchaseListRefresh = () => setPurchaseListRefreshKey(k => k + 1);
    const [compareYearState, setCompareYearState] = useState<number | null>(() => {
        const saved = localStorage.getItem('compareYear');
        return saved ? Number(saved) : null;
    });

    const setCompareYear = useCallback((year: number | null) => {
        setCompareYearState(year);
        if (year === null) {
            localStorage.removeItem('compareYear');
        } else {
            localStorage.setItem('compareYear', String(year));
        }
    }, []);

    const refreshPurchases = useCallback(async (year: number = selectedYear) => {
        if (!appUser) return;
        const filterUid = ['admin', 'guest'].includes(appUser.role) ? undefined : appUser.uid;
        const data = await getPurchases(year, filterUid);
        setPurchases(data);
    }, [appUser, selectedYear]);

    const refreshLedgerAccounts = useCallback(async () => {
        const data = await getLedgerAccounts(selectedYear);
        setLedgerAccounts(data);
    }, [selectedYear]);

    const refreshVendors = useCallback(async () => {
        const data = await getVendors();
        setVendors(data);
    }, []);

    const refreshSystemOptions = useCallback(async () => {
        const options = await getSystemOptions();
        setPurchaseTypes(options.purchaseTypes || []);
        setRequisitionTypes(options.requisitionTypes || []);
        setContractTypes(options.contractTypes || []);
        setContractExpireDays(options.contractExpireDays || 120);
    }, []);

    useEffect(() => {
        if (compareYearState !== null && compareYearState === selectedYear) {
            setCompareYear(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear, compareYearState]);

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
                        refreshVendors().catch(e => { throw new Error(`Vendors fetch failed: ${e.message}`); }),
                        refreshSystemOptions().catch(e => { throw new Error(`SystemOptions fetch failed: ${e.message}`); })
                    ]);
                    console.log('Initial data loaded successfully.');
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        console.error('Initial data load failed:', e.message);
                    } else {
                        console.error('Initial data load failed with unknown error:', e);
                    }
                }
            };

            init().finally(() => setLoadingData(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appUser, selectedYear]);

    const contextValue = useMemo(() => ({
        purchases, ledgerAccounts, vendors, loadingData,
        selectedYear, setSelectedYear,
        compareYear: compareYearState, setCompareYear,
        refreshPurchases, refreshLedgerAccounts, refreshVendors,
        purchaseListRefreshKey, incrementPurchaseListRefresh,
        purchaseTypes, requisitionTypes, contractTypes, contractExpireDays, refreshSystemOptions
    }), [
        purchases, ledgerAccounts, vendors, loadingData,
        selectedYear, compareYearState, purchaseListRefreshKey,
        purchaseTypes, requisitionTypes, contractTypes, contractExpireDays,
        setCompareYear, refreshPurchases, refreshLedgerAccounts, refreshVendors, refreshSystemOptions
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};
