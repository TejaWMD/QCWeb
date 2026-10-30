import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { ErrorBoundary } from './components/ErrorBoundary';
// Add page imports here
import Home from './pages/Home';
import AttentionDashboard from './pages/AttentionDashboard';
import RequestsStoppages from './pages/RequestsStoppages';
import Staffing from './pages/Staffing';
import QaHaccp from './pages/QaHaccp';
import TaskMatrix from './pages/TaskMatrix';
import CapaTracker from './pages/CapaTracker';
import KpiScorecards from './pages/KpiScorecards';
import AuditTrailLog from './pages/AuditTrailLog';
import ActivityHistory from './pages/ActivityHistory';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ActivityLogs from './pages/ActivityLogs';
import UserManagement from './pages/UserManagement';
import DataImport from './pages/DataImport';
import OvertimeRecord from './pages/OvertimeRecord';
import OperationLogs from './pages/OperationLogs';
import WastageLogs from './pages/WastageLogs';
import BaselineCapacity from './pages/BaselineCapacity';
import ShiftLogDraft from './pages/ShiftLogDraft';
import ProductionLineLogs from './pages/ProductionLineLogs';
import YieldLoss from './pages/YieldLoss';
import GoodsReceiving from './pages/GoodsReceiving';
import GoodsTracker from './pages/GoodsTracker';
import GoodsIssued from './pages/GoodsIssued';
import PackagingStock from './pages/PackagingStock';
import PackagingMovements from './pages/PackagingMovements';
import PackagingApprovals from './pages/PackagingApprovals';
import ProductMaster from './pages/ProductMaster';
import PicProductEntry from './pages/PicProductEntry';
import RecipeMaster from './pages/RecipeMaster';
import Machines from './pages/Machines';
import ProductionOrders from './pages/ProductionOrders';
import ProductionSchedule from './pages/ProductionSchedule';
import RecentlyDeletedOrders from './pages/RecentlyDeletedOrders';
import CreateBatch from './pages/CreateBatch';
import BatchRecords from './pages/BatchRecords';
import Traceability from './pages/Traceability';
import Layout from './components/Layout';
import ModuleGuard from './components/ModuleGuard';
import AccessGate from './components/AccessGate';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login disabled for now
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route element={<AccessGate />}>
      <Route element={<Layout />}>
        <Route element={<ModuleGuard />}>
          <Route path="/" element={<AttentionDashboard />} />
          <Route path="/operations-overview" element={<Home />} />
          <Route path="/downtime" element={<RequestsStoppages />} />
          <Route path="/staffing" element={<Staffing />} />
          <Route path="/qa-haccp" element={<QaHaccp />} />
          <Route path="/task-matrix" element={<TaskMatrix />} />
          <Route path="/capa-tracker" element={<CapaTracker />} />
          <Route path="/kpi-scorecards" element={<KpiScorecards />} />
          <Route path="/audit-trail" element={<AuditTrailLog />} />
          <Route path="/activity-history" element={<ActivityHistory />} />
          <Route path="/activity-logs" element={<ActivityLogs />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/data-import" element={<DataImport />} />
          <Route path="/overtime-record" element={<OvertimeRecord />} />
          <Route path="/operation-logs" element={<OperationLogs />} />
          <Route path="/wastage-logs" element={<WastageLogs />} />
          <Route path="/baseline-capacity" element={<BaselineCapacity />} />
          <Route path="/shift-log-draft" element={<ShiftLogDraft />} />
          <Route path="/production-line-logs" element={<ProductionLineLogs />} />
          <Route path="/yield-loss" element={<YieldLoss />} />
          <Route path="/goods-receiving" element={<GoodsReceiving />} />
          <Route path="/goods-tracker" element={<GoodsTracker />} />
          <Route path="/goods-issued" element={<GoodsIssued />} />
          <Route path="/packaging-stock" element={<PackagingStock />} />
          <Route path="/packaging-movements" element={<PackagingMovements />} />
          <Route path="/packaging-approvals" element={<PackagingApprovals />} />
          <Route path="/pic-product-entry" element={<PicProductEntry />} />
          <Route path="/product-master" element={<ProductMaster />} />
          <Route path="/recipe-master" element={<RecipeMaster />} />
          <Route path="/machines" element={<Machines />} />
          <Route path="/production-orders" element={<ProductionOrders />} />
          <Route path="/production-schedule" element={<ProductionSchedule />} />
          <Route path="/create-batch" element={<CreateBatch />} />
          <Route path="/batch-records" element={<BatchRecords />} />
          <Route path="/traceability" element={<Traceability />} />
          <Route path="/recently-deleted" element={<RecentlyDeletedOrders />} />
        </Route>
      </Route>
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App