import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';

// Auth
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CallbackPage } from '../features/auth/CallbackPage';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { NotFoundPage } from '../features/auth/NotFoundPage';

// Dashboard
import { UserDashboard } from '../features/dashboard/UserDashboard';
import { AdminDashboard } from '../features/dashboard/AdminDashboard';

// Access Requests
import { RequestListPage } from '../features/access-requests/RequestListPage';
import { NewRequestPage } from '../features/access-requests/NewRequestPage';
import { RequestDetailPage } from '../features/access-requests/RequestDetailPage';

// Approvals
import { ApprovalQueuePage } from '../features/approvals/ApprovalQueuePage';
import { ApprovalDetailPage } from '../features/approvals/ApprovalDetailPage';
import { ApprovalHistoryPage } from '../features/approvals/ApprovalHistoryPage';

// Team
import { TeamAccessPage } from '../features/team/TeamAccessPage';
import { TeamMemberDetailPage } from '../features/team/TeamMemberDetailPage';

// Certification
import { MyCertificationTasksPage } from '../features/certification/MyCertificationTasksPage';
import { CertificationListPage } from '../features/certification/CertificationListPage';
import { CreateCampaignPage } from '../features/certification/CreateCampaignPage';
import { CampaignDetailPage } from '../features/certification/CampaignDetailPage';
import { CampaignReportPage } from '../features/certification/CampaignReportPage';
import { CertificationHistoryPage } from '../features/certification/CertificationHistoryPage';

// Users
import { UserListPage } from '../features/user-management/UserListPage';
import { UserDetailPage } from '../features/user-management/UserDetailPage';
import { EditUserRolePage } from '../features/user-management/EditUserRolePage';
import { CreateUserPage } from '../features/user-management/CreateUserPage';

// Roles
import { RoleListPage } from '../features/roles/RoleListPage';
import { RoleDetailPage } from '../features/roles/RoleDetailPage';
import { CreateRolePage } from '../features/roles/CreateRolePage';

// Permissions
import { PermissionCatalogPage } from '../features/roles/PermissionCatalogPage';

// Applications
import { ApplicationListPage } from '../features/applications/ApplicationListPage';
import { ApplicationDetailPage } from '../features/applications/ApplicationDetailPage';
import { RegisterApplicationPage } from '../features/applications/RegisterApplicationPage';

// Provisioning
import { ProvisioningDashboard } from '../features/provisioning/ProvisioningDashboard';
import { JobDetailPage } from '../features/provisioning/JobDetailPage';
import { CsvProvisionPage } from '../features/provisioning/CsvProvisionPage';

// Active Access
import { ActiveAccessPage } from '../features/provisioning/ActiveAccessPage';

// Audit
import { AuditLogExplorerPage } from '../features/audit/AuditLogExplorerPage';
import { AuditLogDetailPage } from '../features/audit/AuditLogDetailPage';

// System
import { SystemHealthPage } from '../features/audit/SystemHealthPage';

// Profile & Notifications
import { ProfilePage } from '../features/profile/ProfilePage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';

// Recommendations
import { RecommendationsPage } from '../features/recommendations/RecommendationsPage';
import { OnboardingRecommendationsPage } from '../features/recommendations/OnboardingRecommendationsPage';

// AI Audit
import { AIAuditPage } from '../features/ai/AIAuditPage';
import { AIAssistantPage } from '../features/ai/AIAssistantPage';
import { AIAuditLogPage } from '../features/ai/AIAuditLogPage';

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/auth/callback', element: <CallbackPage /> },
  { path: '/403', element: <ForbiddenPage /> },
  { path: '/404', element: <NotFoundPage /> },
  {
    path: '/',
    element: <Protected><AppShell /></Protected>,
    children: [
      { index: true, element: <UserDashboard /> },
      { path: 'dashboard', element: <UserDashboard /> },
      { path: 'requests', element: <RequestListPage /> },
      { path: 'requests/new', element: <NewRequestPage /> },
      { path: 'requests/:id', element: <RequestDetailPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'recommendations', element: <RecommendationsPage /> },
      { path: 'onboarding-recommendations', element: <OnboardingRecommendationsPage /> },

      // Supervisor
      {
        path: 'supervisor/approvals',
        element: <RoleGuard required="supervisor"><ApprovalQueuePage /></RoleGuard>,
      },
      {
        path: 'supervisor/approvals/history',
        element: <RoleGuard required="supervisor"><ApprovalHistoryPage /></RoleGuard>,
      },
      {
        path: 'supervisor/approvals/:id',
        element: <RoleGuard required="supervisor"><ApprovalDetailPage /></RoleGuard>,
      },
      {
        path: 'supervisor/team',
        element: <RoleGuard required="supervisor"><TeamAccessPage /></RoleGuard>,
      },
      {
        path: 'supervisor/team/:userId',
        element: <RoleGuard required="supervisor"><TeamMemberDetailPage /></RoleGuard>,
      },
      {
        path: 'supervisor/certifications/my-tasks',
        element: <RoleGuard required="supervisor"><MyCertificationTasksPage /></RoleGuard>,
      },

      // Admin
      {
        path: 'admin/dashboard',
        element: <RoleGuard required="admin"><AdminDashboard /></RoleGuard>,
      },
      {
        path: 'admin/users',
        element: <RoleGuard required="admin"><UserListPage /></RoleGuard>,
      },
      {
        path: 'admin/users/new',
        element: <RoleGuard required="admin"><CreateUserPage /></RoleGuard>,
      },
      {
        path: 'admin/users/:id',
        element: <RoleGuard required="admin"><UserDetailPage /></RoleGuard>,
      },
      {
        path: 'admin/users/:id/edit',
        element: <RoleGuard required="admin"><EditUserRolePage /></RoleGuard>,
      },
      {
        path: 'admin/roles',
        element: <RoleGuard required="admin"><RoleListPage /></RoleGuard>,
      },
      {
        path: 'admin/roles/new',
        element: <RoleGuard required="admin"><CreateRolePage /></RoleGuard>,
      },
      {
        path: 'admin/roles/:id',
        element: <RoleGuard required="admin"><RoleDetailPage /></RoleGuard>,
      },
      {
        path: 'admin/permissions',
        element: <RoleGuard required="admin"><PermissionCatalogPage /></RoleGuard>,
      },
      {
        path: 'admin/applications',
        element: <RoleGuard required="admin"><ApplicationListPage /></RoleGuard>,
      },
      {
        path: 'admin/applications/new',
        element: <RoleGuard required="admin"><RegisterApplicationPage /></RoleGuard>,
      },
      {
        path: 'admin/applications/:id',
        element: <RoleGuard required="admin"><ApplicationDetailPage /></RoleGuard>,
      },
      {
        path: 'admin/provisioning',
        element: <RoleGuard required="admin"><ProvisioningDashboard /></RoleGuard>,
      },
      {
        path: 'admin/provisioning/csv',
        element: <RoleGuard required="admin"><CsvProvisionPage /></RoleGuard>,
      },
      {
        path: 'admin/provisioning/:jobId',
        element: <RoleGuard required="admin"><JobDetailPage /></RoleGuard>,
      },
      {
        path: 'admin/access',
        element: <RoleGuard required="admin"><ActiveAccessPage /></RoleGuard>,
      },
      {
        path: 'admin/certifications',
        element: <RoleGuard required="admin"><CertificationListPage /></RoleGuard>,
      },
      {
        path: 'admin/certifications/new',
        element: <RoleGuard required="admin"><CreateCampaignPage /></RoleGuard>,
      },
      {
        path: 'admin/certifications/history',
        element: <RoleGuard required="admin"><CertificationHistoryPage /></RoleGuard>,
      },
      {
        path: 'admin/certifications/:id',
        element: <RoleGuard required="admin"><CampaignDetailPage /></RoleGuard>,
      },
      {
        path: 'admin/certifications/:id/report',
        element: <RoleGuard required="admin"><CampaignReportPage /></RoleGuard>,
      },
      {
        path: 'admin/audit',
        element: <RoleGuard required="admin"><AuditLogExplorerPage /></RoleGuard>,
      },
      {
        path: 'admin/audit/:eventId',
        element: <RoleGuard required="admin"><AuditLogDetailPage /></RoleGuard>,
      },
      {
        path: 'admin/ai-audit',
        element: <RoleGuard required="admin"><AIAuditPage /></RoleGuard>,
      },
      {
        path: 'admin/ai-audit/logs',
        element: <RoleGuard required="admin"><AIAuditLogPage /></RoleGuard>,
      },
      {
        path: 'admin/ai-assistant',
        element: <RoleGuard required="admin"><AIAssistantPage /></RoleGuard>,
      },
      {
        path: 'admin/system',
        element: <RoleGuard required="admin"><SystemHealthPage /></RoleGuard>,
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
