/**
 * Event Manager Routing Table - RESTART FOR GROUP V2 FIX
 *
 * maps (method, pathPattern) → routing descriptor.
 *
 * mode:
 *   "sync"  → NATS Core request/reply to `subject`; reply forwarded back to gateway
 *   "async" → Publish to JetStream `subject`; gateway gets an immediate 202 ack
 */
console.log("[router] router.js loaded with debug logs");

export const ROUTES = [
  // ── User List (Highest Priority) ─────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/users\/?$/,
    mode: "sync",
    subject: "admin.users.list.v2",
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/users\/?$/,
    mode: "sync",
    subject: "admin.users.list.v2",
  },
  // ── User Details (High Priority) ─────────────────────────────────────────
  // ── Auth ────────────────────────────────────────────────────────────────
  {
    method: "POST",
    pattern: /^\/api\/user\/login$/,
    mode: "sync",
    subject: "auth.login",
  },
  {
    method: "POST",
    pattern: /^\/api\/auth\/loginPrimary$/,
    mode: "sync",
    subject: "auth.login.primary",
    
  },
  {
    method: "POST",
    pattern: /^\/api\/login$/,
    mode: "sync",
    subject: "auth.login.primary",
    
  },
  {
    method: "POST",
    pattern: /^\/api\/user\/logout$/,
    mode: "sync",
    subject: "auth.logout",
  },
  {
    method: "POST",
    pattern: /^\/api\/user\/refresh$/,
    mode: "sync",
    subject: "auth.refresh",
  },
  {
    method: "POST",
    pattern: /^\/api\/auth\/mfa\/setup$/,
    mode: "sync",
    subject: "auth.mfa.setup",
    
  },
  {
    method: "POST",
    pattern: /^\/api\/auth\/mfa\/verify$/,
    mode: "sync",
    subject: "auth.mfa.verify",
    
  },
  {
    method: "POST",
    pattern: /^\/api\/mfa\/setup$/,
    mode: "sync",
    subject: "auth.mfa.setup",
    
  },
  {
    method: "POST",
    pattern: /^\/api\/mfa\/verify$/,
    mode: "sync",
    subject: "auth.mfa.verify",
    
  },

  // ── User Creation Route (Sync for reliability) ──────────────────────
  {
    method: "POST",
    pattern: /^\/api\/user\/register$/,
    mode: "sync",
    subject: "access.user.create",
    
  },
  {
    method: "POST",
    pattern: /^\/api\/user\/sync$/,
    mode: "sync",
    subject: "access.user.sync",
    
  },

  // ── Provision / Deprovision ──────────────────────────────────────────────
  {
    method: "POST",
    pattern: /^\/api\/provision\/users$/,
    mode: "async",
    subject: "events.provision.bulk",
  },
  {
    method: "POST",
    pattern: /^\/api\/provision\/view$/,
    mode: "sync",
    subject: "provision.view", // This was previously direct HTTP, but we can relay it too if we want. Wait!
  },
  {
    method: "POST",
    pattern: /^\/api\/provision\/time\/?$/,
    mode: "async",
    subject: "events.provision.time",
  },
  {
    method: "POST",
    pattern: /^\/api\/provision\/user$/,
    mode: "async",
    subject: "events.provision.single",
  },
  {
    method: "DELETE",
    pattern: /^\/api\/provision\/user\/(.+)$/,
    mode: "async",
    subject: "events.deprovision.user",
  },

  // ── Access Request ───────────────────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/access\/request\/?$/,
    mode: "sync",
    subject: "access.request.list",
  },
  {
    method: "POST",
    pattern: /^\/api\/access\/request$/,
    mode: "sync",
    subject: "access.request.create",
  },
  {
    method: "GET",
    pattern: /^\/api\/access\/request\/(.+)$/,
    mode: "sync",
    subject: "access.request.get",
  },
  {
    method: "PUT",
    pattern: /^\/api\/access\/request\/(.+)$/,
    mode: "async",
    subject: "events.access.request.update",
  },

  // ── Time-based Access ────────────────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/access\/time\/?$/,
    mode: "sync",
    subject: "access.time.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/access\/time\/(.+)$/,
    mode: "sync",
    subject: "access.time.get",
  },
  {
    method: "POST",
    pattern: /^\/api\/access\/time.*$/,
    mode: "async",
    subject: "events.provision.time",
    
  },
  {
    method: "DELETE",
    pattern: /^\/api\/access\/time\/(.+)$/,
    mode: "async",
    subject: "events.access.time.revoke",
  },

  // ── General Active Access ────────────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/access\/active\/?$/,
    mode: "sync",
    subject: "access.active.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/user\/([^/]+)\/access\/?$/,
    mode: "sync",
    subject: "user.access.list",
  },
  {
    method: "POST",
    pattern: /^\/api\/user\/access\/details\/?$/,
    mode: "sync",
    subject: "access.user.list",
  },

  // ── Access Certification ─────────────────────────────────────────────────
  {
    method: "POST",
    pattern: /^\/api\/access\/cert\/campaign$/,
    mode: "sync",
    subject: "certification.generate",
  },
  {
    method: "GET",
    pattern: /^\/api\/access\/cert\/campaign$/,
    mode: "sync",
    subject: "certification.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/access\/cert\/items\/?$/,
    mode: "sync",
    subject: "certification.items.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/access\/cert\/campaign\/(.+)\/items\/?$/,
    mode: "sync",
    subject: "certification.items.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/access\/cert\/campaign\/(.+)$/,
    mode: "sync",
    subject: "certification.get",
  },
  {
    method: "GET",
    pattern: /^\/api\/access\/cert\/campaign\/(.+)\/report\/?$/,
    mode: "sync",
    subject: "certification.report",
  },
  {
    method: "PUT",
    pattern: /^\/api\/access\/cert\/decision$/,
    mode: "sync",
    subject: "certification.item.update",
  },
  {
    method: "POST",
    pattern: /^\/api\/create\/group\/?$/,
    mode: "sync",
    subject: "admin.group.create",
  },
  {
    method: "POST",
    pattern: /^\/api\/access\/managed-apps\/?$/,
    mode: "sync",
    subject: "access.managed_apps.create",
  },
  {
    method: "POST",
    pattern: /^\/api\/access\/managed-apps\/sync\/?$/,
    mode: "sync",
    subject: "access.managed_apps.sync",
  },
  {
    method: "DELETE",
    pattern: /^\/api\/access\/managed-apps\/sync\/?$/,
    mode: "sync",
    subject: "access.managed_apps.sync",
  },

  // ── Applications ─────────────────────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/applications\/?$/,
    mode: "sync",
    subject: "applications.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/applications\/([^/]+)\/?$/,
    mode: "sync",
    subject: "applications.get",
  },
  {
    method: "POST",
    pattern: /^\/api\/applications\/?$/,
    mode: "sync",
    subject: "applications.create",
  },

  // ── Access Recommendation ────────────────────────────────────────────────
  {
    method: "POST",
    pattern: /^\/api\/recommendation\/run$/,
    mode: "async",
    subject: "events.recommendation.run",
  },
  {
    method: "GET",
    pattern: /^\/api\/access\/cert\/history\/?$/,
    mode: "sync",
    subject: "certification.history.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/recommendation\/onboarding\/(.+)$/,
    mode: "sync",
    subject: "recommendation.onboarding",
  },
  {
    method: "GET",
    pattern: /^\/api\/recommendation\/team\/(.+)$/,
    mode: "sync",
    subject: "recommendation.team",
  },
  {
    method: "GET",
    pattern: /^\/api\/recommendation\/(.+)$/,
    mode: "sync",
    subject: "certification.list", // Placeholder for actual recommendation list if needed
  },

  // ── Admin User Management ────────────────────────────────────────────────
  // List: GET /api/users → admin.users.list
  {
    method: "GET",
    pattern: /^\/api\/(admin\/)?users\/?$/,
    mode: "sync",
    subject: "admin.users.list",
  },
  // User Approval: POST /api/admin/user/approve → admin.user.approve
  {
    method: "POST",
    pattern: /^\/api\/admin\/user\/approve\/?$/,
    mode: "sync",
    subject: "admin.user.approve",
    
  },

  // Update: POST /api/users/update → admin.users.update
  {
    method: "POST",
    pattern: /^\/api\/(admin\/)?users\/update\/?$/,
    mode: "sync",
    subject: "admin.users.update",
    
  },
  // Group Add/Remove: POST/DELETE /api/users/group → admin.user.group.add/remove
  {
    method: "POST",
    pattern: /^\/api\/(admin\/)?users\/group\/?$/,
    mode: "sync",
    subject: "admin.user.group.add.v2",
    
  },
  {
    method: "DELETE",
    pattern: /^\/api\/(admin\/)?users\/group\/?$/,
    mode: "sync",
    subject: "admin.user.group.remove",
    
  },
  // Groups List: GET /api/users/:uid/groups → admin.users.groups
  {
    method: "GET",
    pattern: /^\/api\/(admin\/)?users\/([^/]+)\/groups\/?$/,
    mode: "sync",
    subject: "admin.users.groups",
  },
  // Org Hierarchy
  {
    method: "GET",
    pattern: /^\/api\/admin\/org\/hierarchy\/?$/,
    mode: "sync",
    subject: "admin.org.hierarchy",
  },
  // Async Group Events (for audit/triggers)
  {
    method: "POST",
    pattern: /^\/api\/(admin\/)?users\/([^/]+)\/group\/?$/,
    mode: "sync",
    subject: "admin.user.group.add.v2",
  },
  {
    method: "DELETE",
    pattern: /^\/api\/(admin\/)?users\/([^/]+)\/group\/?$/,
    mode: "async",
    subject: "events.admin.users.group.remove",
  },

  // ── AI Auditing & Reporting ──────────────────────────────────────────────
  {
    method: "POST",
    pattern: /^\/api\/audit\/report$/,
    mode: "async",
    subject: "events.audit.report",
  },
  {
    method: "GET",
    pattern: /^\/api\/audit\/log\/?$/,
    mode: "sync",
    subject: "audit.query.logs",
  },

  // ── User Management ──────────────────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/user\/me$/,
    mode: "sync",
    subject: "user.me",
  },
  {
    method: "PUT",
    pattern: /^\/api\/user\/password$/,
    mode: "sync",
    subject: "user.password.change",
  },
  {
    method: "GET",
    pattern: /^\/api\/user\/?$/,
    mode: "sync",
    subject: "user.list.v2",
  },
  {
    method: "GET",
    pattern: /^\/api\/user\/([^/]+)\/access$/,
    mode: "sync",
    subject: "user.access.list",
  },
  {
    method: "POST",
    pattern: /^\/api\/user\/access\/details$/,
    mode: "sync",
    subject: "access.user.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/user\/([^/]+)$/,
    mode: "sync",
    subject: "user.get",
  },
  {
    method: "PUT",
    pattern: /^\/api\/user\/([^/]+)\/role$/,
    mode: "async",
    subject: "events.user.role.update",
  },
  {
    method: "PUT",
    pattern: /^\/api\/user\/([^/]+)\/deactivate$/,
    mode: "async",
    subject: "events.user.deactivate",
  },

  // ── Applications & Groups ──────────────────────────────────────────────────
  {
    method: "POST",
    pattern: /\/api\/create\/group/i,
    mode: "sync",
    subject: "infra.group.create.relay",
  },

  // ── Applications ─────────────────────────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/applications\/?$/,
    mode: "sync",
    subject: "applications.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/applications\/([^/]+)\/roles$/,
    mode: "sync",
    subject: "sync.applications.roles.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/applications\/([^/]+)$/,
    mode: "sync",
    subject: "applications.get",
  },
  {
    method: "POST",
    pattern: /^\/api\/applications\/?$/,
    mode: "async",
    subject: "events.applications.create",
  },

  // ── Admin Dashboard ──────────────────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/admin\/dashboard\/?$/,
    mode: "sync",
    subject: "admin.dashboard.stats",
  },

  // ── Notifications ────────────────────────────────────────────────────────
  {
    method: "GET",
    pattern: /^\/api\/notifications\/?$/,
    mode: "sync",
    subject: "notifications.list",
  },
  {
    method: "PUT",
    pattern: /^\/api\/notifications\/([^/]+)\/read$/,
    mode: "async",
    subject: "events.notifications.read",
  },
  {
    method: "GET",
    pattern: /^\/api\/notifications\/preferences\/?$/,
    mode: "sync",
    subject: "notifications.preferences.get",
  },
  {
    method: "PUT",
    pattern: /^\/api\/notifications\/preferences\/?$/,
    mode: "async",
    subject: "events.notifications.preferences.update",
  },
  {
    method: "GET",
    pattern: /^\/api\/roles\/?$/,
    mode: "sync",
    subject: "roles.list",
  },
  {
    method: "GET",
    pattern: /^\/api\/roles\/([^/]+)$/,
    mode: "sync",
    subject: "roles.get",
  },
  {
    method: "POST",
    pattern: /^\/api\/roles\/?$/,
    mode: "async",
    subject: "events.roles.create",
  },
  {
    method: "PUT",
    pattern: /^\/api\/roles\/([^/]+)$/,
    mode: "async",
    subject: "events.roles.update",
  },
  {
    method: "GET",
    pattern: /^\/api\/permissions\/?$/,
    mode: "sync",
    subject: "permissions.list",
  },

  // ── AI Service ───────────────────────────────────────────────────────────
  {
    method: "POST",
    pattern: /^\/ai\/chat$/,
    mode: "sync",
    subject: "ai.chat",
  },
  {
    method: "GET",
    pattern: /^\/ai\/chat\/(.+)$/,
    mode: "sync",
    subject: "ai.chat.history",
  },
  {
    method: "GET",
    pattern: /^\/ai\/recommendations\/insight\/(.+)$/,
    mode: "sync",
    subject: "ai.recommendation.insight",
  },
  {
    method: "GET",
    pattern: /^\/ai\/certifications\/(.+)\/suggestions$/,
    mode: "sync",
    subject: "ai.certification.suggestions",
  },
  {
    method: "GET",
    pattern: /^\/ai\/certifications\/(.+)\/summary$/,
    mode: "sync",
    subject: "ai.certification.summary",
  },
  {
    method: "POST",
    pattern: /^\/ai\/certifications\/(.+)\/apply-suggestions$/,
    mode: "async",
    subject: "events.ai.certification.apply",
  },
  {
    method: "GET",
    pattern: /^\/ai\/audit\/insights$/,
    mode: "sync",
    subject: "ai.audit.insights",
  },
  {
    method: "GET",
    pattern: /^\/ai\/audit\/anomalies$/,
    mode: "sync",
    subject: "ai.audit.anomalies",
  },
  {
    method: "POST",
    pattern: /^\/ai\/reports\/generate$/,
    mode: "async",
    subject: "events.ai.report.generate",
  },
  {
    method: "GET",
    pattern: /^\/ai\/reports$/,
    mode: "sync",
    subject: "ai.report.list",
  },
  {
    method: "GET",
    pattern: /^\/ai\/reports\/(.+)$/,
    mode: "sync",
    subject: "ai.report.get",
  },
];

/**
 * @param {string} method
 * @param {string} path
 * @returns {{ mode: string, subject: string } | null}
 */
export function resolveRoute(method, path) {
  const m = method.toUpperCase();
  console.log(`[router] resolving ${m} ${path}`);
  for (const r of ROUTES) {
    if (r.method === m && r.pattern.test(path)) {
      console.log(`[router] matched: ${r.subject}`);
      return r;
    }
  }
  console.log(`[router] NO MATCH found`);
  return null;
}
