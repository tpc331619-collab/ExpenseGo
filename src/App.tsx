import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PendingPage = lazy(() => import('./pages/PendingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PurchaseListPage = lazy(() => import('./pages/PurchaseListPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ContractHistoryPage = lazy(() => import('./pages/ContractHistoryPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));

const LoadingFallback = () => <div className="p-4 flex justify-center text-gray-500">載入中...</div>;
import { useRegisterSW } from 'virtual:pwa-register/react';
import QuickAddFAB from './components/QuickAddFAB';
import SpotlightSearch from './components/SpotlightSearch';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSpotlightOpen, setIsSpotlightOpen] = React.useState(false);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <>
      <Navbar />
      <main className="main-content">{children}</main>
      <QuickAddFAB />
      <SpotlightSearch
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
      />
    </>
  );
};

const App: React.FC = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        // 每小時檢查一次更新
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  React.useEffect(() => {
    if (needRefresh) {
      if (confirm('發現新的版本，是否立即更新以獲取最新功能？')) {
        updateServiceWorker(true);
      }
    }
  }, [needRefresh, updateServiceWorker]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/pending" element={<PendingPage />} />

              <Route element={<PrivateRoute />}>
                <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
                <Route path="/purchases" element={<AppLayout><PurchaseListPage /></AppLayout>} />
                <Route path="/report" element={<AppLayout><ReportPage /></AppLayout>} />
                <Route path="/admin" element={<AppLayout><AdminPage /></AppLayout>} />
                <Route path="/contracts" element={<AppLayout><ContractHistoryPage /></AppLayout>} />
                <Route path="/notes" element={<AppLayout><NotesPage /></AppLayout>} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
