import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import PendingPage from './pages/PendingPage';
import Dashboard from './pages/Dashboard';
import PurchaseListPage from './pages/PurchaseListPage';
import ReportPage from './pages/ReportPage';
import AdminPage from './pages/AdminPage';
import ContractHistoryPage from './pages/ContractHistoryPage';
import { useRegisterSW } from 'virtual:pwa-register/react';
import QuickAddFAB from './components/QuickAddFAB';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Navbar />
    <main className="main-content">{children}</main>
    <QuickAddFAB />
  </>
);

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
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pending" element={<PendingPage />} />

            <Route element={<PrivateRoute />}>
              <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
              <Route path="/purchases" element={<AppLayout><PurchaseListPage /></AppLayout>} />
              <Route path="/report" element={<AppLayout><ReportPage /></AppLayout>} />
              <Route path="/admin" element={<AppLayout><AdminPage /></AppLayout>} />
              <Route path="/contracts" element={<AppLayout><ContractHistoryPage /></AppLayout>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
