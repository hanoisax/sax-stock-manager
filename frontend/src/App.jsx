import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import StockImports from './pages/StockImports';
import StockTakes from './pages/StockTakes';
import Reports from './pages/Reports';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './lib/auth';

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Đang tải...
      </div>
    );
  }
  if (!session) return <Login />;

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/products"  element={<Products />} />
          <Route path="/orders"    element={<Orders />} />
          <Route path="/imports"   element={<StockImports />} />
          <Route path="/stocktakes" element={<StockTakes />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/reports"   element={<Reports />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
