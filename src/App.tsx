import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { OrdersProvider } from './contexts/OrdersContext';
import { DeliveryProvider } from './contexts/DeliveryContext';
import { AuthPage } from './components/auth/AuthPage';
import CustomerDashboard from './components/customer/CustomerDashboard';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { RestaurantDashboard } from './components/restaurant/RestaurantDashboard';
import { LoadingSpinner } from './components/LoadingSpinner';
import { MenuManagement } from './components/restaurant/MenuManagement';
import { AdvertisementManagement } from './components/restaurant/AdvertisementManagement';
import LockedDepositsPage from './components/customer/LockedDeposits';
import CreditPage from './components/customer/CreditPage';

function AppContent() {
  const { profile, loading } = useAuth();
  const supportedRoles = new Set(['customer', 'driver', 'restaurant']);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return <AuthPage />;
  }

  if (!supportedRoles.has(profile.role)) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff8dd_0%,_#edf9ff_35%,_#f8fafc_100%)] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#f0d87d] bg-white/80 p-6 shadow-lg shadow-[#f4c95d]/15 text-center backdrop-blur-sm">
          <h1 className="text-xl font-bold text-[#173b57]">Account Role Not Routed Yet</h1>
          <p className="mt-2 text-sm text-[#2e4966]">
            You are signed in, but this account role does not have an app dashboard route yet.
          </p>
          <p className="mt-2 text-xs text-[#5d748a]">
            Role: {profile.role}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* CUSTOMER ROUTES */}
        {profile.role === 'customer' && (
          <>
            <Route
              path="/"
              element={
                <OrdersProvider>
                  <CustomerDashboard />
                </OrdersProvider>
              }
            />
            <Route
              path="/locked-deposits"
              element={
                <OrdersProvider>
                  <LockedDepositsPage />
                </OrdersProvider>
              }
            />
            <Route
              path="/credit"
              element={
                <OrdersProvider>
                  <CreditPage />
                </OrdersProvider>
              }
            />
            {/* Optional: catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}

      {/* DRIVER ROUTES */}
      {profile.role === 'driver' && (
        <Route
          path="/*"
          element={
            <OrdersProvider>
              <DeliveryProvider>
                <DriverDashboard />
              </DeliveryProvider>
            </OrdersProvider>
          }
        />
      )}

      {/* RESTAURANT ROUTES */}
      {profile.role === 'restaurant' && (
        <>
          <Route
            path="/restaurant"
            element={
              <OrdersProvider>
                <RestaurantDashboard />
              </OrdersProvider>
            }
          />
          <Route
            path="/restaurant/menu"
            element={
              <OrdersProvider>
                <MenuManagement />
              </OrdersProvider>
            }
          />
          <Route
            path="/restaurant/ads"
            element={
              <OrdersProvider>
                <AdvertisementManagement />
              </OrdersProvider>
            }
          />
          {/* Default redirect for restaurants */}
          <Route path="*" element={<Navigate to="/restaurant" replace />} />
        </>
      )}

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;