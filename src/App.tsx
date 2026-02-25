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

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Navbar />
    <main className="main-content">{children}</main>
  </>
);

const App: React.FC = () => (
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
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
