import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AdminRoute } from '@/features/auth/AdminRoute';
import { SiteManagerRoute } from '@/features/auth/SiteManagerRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { SiteEntryRedirect } from './SiteEntryRedirect';
import { LoginPage } from '@/pages/Login/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPassword/ForgotPasswordPage';
import { FirstTimePasswordPage } from '@/pages/FirstTimePassword/FirstTimePasswordPage';
import { PasswordResetsPage } from '@/pages/PasswordResets/PasswordResetsPage';
import { FirmwareManagementPage } from '@/pages/Firmware/FirmwareManagementPage';
import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
import { DataReportPage } from '@/pages/DataReport/DataReportPage';
import { UsersManagementPage } from '@/pages/UsersManagement/UsersManagementPage';
import { SitesManagementPage } from '@/pages/SitesManagement/SitesManagementPage';
import { SiteDetailPage } from '@/pages/SitesManagement/SiteDetailPage';
import { DevicesManagementPage } from '@/pages/DevicesManagement/DevicesManagementPage';
import { BoardDetailPage } from '@/pages/DevicesManagement/BoardDetailPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';
import { LoginHistoryPage } from '@/pages/Settings/LoginHistoryPage';
import { NotFoundPage } from '@/pages/NotFound/NotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        {/* Mandatory password-change page — rendered without AppLayout so the
            sidebar is hidden and the user can't navigate away while their
            session is in transitional mode. */}
        <Route path="/first-time-password" element={<FirstTimePasswordPage />} />

        <Route path="/" element={<SiteEntryRedirect />} />

        <Route element={<AppLayout />}>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/login-history" element={<LoginHistoryPage />} />
        </Route>

        {/* Super-admin only: central platform pages (cross-site devices). */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="devices" element={<DevicesManagementPage />} />
            <Route path="firmware" element={<FirmwareManagementPage />} />
          </Route>
        </Route>

        {/* Super-admin OR site-admin: per-site management + user management.
            UsersManagementPage and SitesManagementPage both filter their data
            and form options based on the actor's role. */}
        <Route element={<SiteManagerRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/admin/users" element={<UsersManagementPage />} />
            <Route
              path="/admin/password-resets"
              element={<PasswordResetsPage />}
            />
            <Route path="/admin/sites" element={<SitesManagementPage />} />
            <Route path="/admin/sites/:siteId" element={<SiteDetailPage />} />
            <Route path="/admin/devices/:boardId" element={<BoardDetailPage />} />
          </Route>
        </Route>

        <Route path="/sites/:siteId" element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="reports" element={<DataReportPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
