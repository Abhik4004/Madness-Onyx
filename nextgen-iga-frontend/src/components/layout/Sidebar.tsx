import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Plus,
  CheckSquare, Users, Shield, Award, Building2,
  Activity, ClipboardList, Lock, Cpu, Database,
  LogOut, Sparkles, UserPlus, Upload, Trash2,
  ChevronDown, ChevronRight, History as HistoryIcon, MessageSquare, User
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { authApi } from '../../api/auth.api';
import { useQuery } from '@tanstack/react-query';
import { requestsApi } from '../../api/requests.api';


export function Sidebar() {
  const { user, logout } = useAuth();
  const { isSupervisor, isAdmin } = usePermissions();
  const location = useLocation();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    requests: location.pathname.startsWith('/requests'),
    adminUsers: location.pathname.startsWith('/admin/users'),
    provisioning: location.pathname.startsWith('/admin/provisioning'),
    certifications: location.pathname.startsWith('/admin/certifications'),
    manageEntitlements: location.pathname.startsWith('/admin/applications') || location.pathname.startsWith('/admin/access'),
  });

  const toggle = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const { data: approvalsData } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => requestsApi.list({}),
    enabled: isSupervisor,
    refetchInterval: 30000,
  });
  const pendingApprovals = Array.isArray(approvalsData?.data)
    ? approvalsData.data.filter(r => r.status === 'PENDING').length
    : 0;

  const initials = (user?.full_name || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    window.location.href = '/login';
  };

  const navCls = (isActive: boolean, isSub = false) =>
    `sidebar-item ${isActive ? 'active' : ''} ${isSub ? 'sub-item' : ''}`;

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <h1>NextGen IGA</h1>
        <span>Identity Governance</span>
      </div>

      <div className="sidebar-nav">
        {/* ── End User ── */}
        <div className="sidebar-section-label">My Workspace</div>
        <NavLink className={({ isActive }) => navCls(isActive)} to="/dashboard"><LayoutDashboard size={16} /> Dashboard</NavLink>
        <NavLink className={({ isActive }) => navCls(isActive)} to="/profile"><User size={16} /> My Profile</NavLink>

        {/* Collapsible Requests */}
        <div
          className={`sidebar-item ${expanded.requests ? 'parent-active' : ''}`}
          onClick={() => toggle('requests')}
          style={{ cursor: 'pointer', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={16} /> My Requests
          </div>
          <ChevronDown size={14} style={{ transform: expanded.requests ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
        </div>
        <div className={`sidebar-dropdown ${expanded.requests ? 'open' : ''}`}>
          <NavLink className={({ isActive }) => navCls(isActive, true)} to="/requests" end>All Requests</NavLink>
          <NavLink className={({ isActive }) => navCls(isActive, true)} to="/requests/new"><Plus size={16} /> New Request</NavLink>
          <NavLink className={({ isActive }) => navCls(isActive, true)} to="/requests/remove"><Trash2 size={16} /> Remove Request</NavLink>
        </div>


        {/* ── Supervisor ── */}
        {isSupervisor && (
          <>
            <div className="sidebar-section-label">Supervisor</div>
            <NavLink
              className={({ isActive }) => navCls(isActive, true)}
              to="/supervisor/approvals"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><CheckSquare size={16} /> Approvals</span>
              {pendingApprovals > 0 && (
                <span style={{ backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                  {pendingApprovals > 99 ? '99+' : pendingApprovals}
                </span>
              )}
            </NavLink>
            <NavLink className={({ isActive }) => navCls(isActive, true)} to="/supervisor/team"><Users size={16} /> My Team</NavLink>
            <NavLink className={({ isActive }) => navCls(isActive, true)} to="/supervisor/certifications/my-tasks"><Award size={16} /> Cert Tasks</NavLink>

            {/* Show these only for pure supervisors — admins see them in the Admin section */}
            {!isAdmin && (
              <>
                <NavLink className={({ isActive }) => navCls(isActive, true)} to="/supervisor/certifications/history"><HistoryIcon size={16} /> Campaign History</NavLink>
                <NavLink className={({ isActive }) => navCls(isActive, true)} to="/supervisor/ai-audit"><Sparkles size={16} /> AI Audit & Reports</NavLink>
                <NavLink className={({ isActive }) => navCls(isActive, true)} to="/supervisor/ai-assistant"><MessageSquare size={16} /> AI Assistant</NavLink>
              </>
            )}
          </>
        )}

        {/* ── Admin ── */}
        {isAdmin && (
          <>
            <div className="sidebar-section-label">Administration</div>

            {/* Collapsible Admin Users */}
            <div
              className={`sidebar-item ${expanded.adminUsers ? 'parent-active' : ''}`}
              onClick={() => toggle('adminUsers')}
              style={{ cursor: 'pointer', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={16} /> Users
              </div>
              <ChevronDown size={14} style={{ transform: expanded.adminUsers ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </div>
            <div className={`sidebar-dropdown ${expanded.adminUsers ? 'open' : ''}`}>
              <NavLink className={({ isActive }) => navCls(isActive, true)} to="/admin/users" end>User List</NavLink>
              <NavLink className={({ isActive }) => navCls(isActive, true)} style={{ paddingLeft: 44 }} to="/admin/users/new"><UserPlus size={16} /> Create Account</NavLink>
            </div>

            <NavLink className={({ isActive }) => navCls(isActive, true)} to="/admin/roles"><Shield size={16} /> Roles</NavLink>

            {/* Collapsible Manage Entitlements */}
            <div
              className={`sidebar-item ${expanded.manageEntitlements ? 'parent-active' : ''}`}
              onClick={() => toggle('manageEntitlements')}
              style={{ cursor: 'pointer', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={16} /> Manage Entitlements
              </div>
              <ChevronDown size={14} style={{ transform: expanded.manageEntitlements ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </div>
            <div className={`sidebar-dropdown ${expanded.manageEntitlements ? 'open' : ''}`}>
              <NavLink className={({ isActive }) => navCls(isActive, true)} style={{ paddingLeft: 44 }} to="/admin/applications">Add Entitlement</NavLink>
            </div>

            {/* Collapsible Provisioning */}
            <div
              className={`sidebar-item ${expanded.provisioning ? 'parent-active' : ''}`}
              onClick={() => toggle('provisioning')}
              style={{ cursor: 'pointer', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Cpu size={16} /> Provisioning
              </div>
              <ChevronDown size={14} style={{ transform: expanded.provisioning ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </div>
            <div className={`sidebar-dropdown ${expanded.provisioning ? 'open' : ''}`}>
              <NavLink className={({ isActive }) => navCls(isActive, true)} style={{ paddingLeft: 44 }} to="/admin/provisioning/csv"><Upload size={16} /> Bulk Upload</NavLink>
            </div>

            {/* Collapsible Certifications */}
            <div
              className={`sidebar-item ${expanded.certifications ? 'parent-active' : ''}`}
              onClick={() => toggle('certifications')}
              style={{ cursor: 'pointer', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ClipboardList size={16} /> Certifications
              </div>
              <ChevronDown size={14} style={{ transform: expanded.certifications ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
            </div>
            <div className={`sidebar-dropdown ${expanded.certifications ? 'open' : ''}`}>
              <NavLink className={({ isActive }) => navCls(isActive, true)} to="/admin/certifications" end>Active Campaigns</NavLink>
              <NavLink className={({ isActive }) => navCls(isActive, true)} style={{ paddingLeft: 44 }} to="/admin/certifications/history"><HistoryIcon size={16} /> Campaign History</NavLink>
            </div>

            <NavLink className={({ isActive }) => navCls(isActive, true)} to="/admin/audit"><Activity size={16} /> Audit Logs</NavLink>

            {/* Shared with supervisor — shown here for admins, in supervisor section for non-admin supervisors */}
            <NavLink className={({ isActive }) => navCls(isActive, true)} to="/admin/ai-audit"><Sparkles size={16} /> AI Audit & Reports</NavLink>
            <NavLink className={({ isActive }) => navCls(isActive, true)} to="/admin/ai-assistant"><MessageSquare size={16} /> AI Assistant</NavLink>
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
          <button
            className="btn-icon"
            onClick={handleLogout}
            aria-label="Log out"
            style={{ color: 'var(--color-gray-400)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}