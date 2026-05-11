import "dotenv/config";
import { connectNats, jc } from "./nats/connector.js";

import { db } from "./db/client.js";
// Force restart to apply latest User List fixes
import {
  handleRequestList,
  handleRequestGet,
  handleRequestCreate,
  handleTimeList,
  handleTimeGet,
  handleAdminStats,
  handleAuditLogs,
  handleUserAccessList,
  handleManagedAppCreate,
  handleManagedAppSync,
  handleGroupCreate,
  handleUserList,
  handleApplicationsList,
  handleRolesList,
  handleUserGet,
  handleUserGroupAdd,
  handleUserGroupRemove,
  handleTimeProvision,
  startAutoRevocationCheck,
  handleCertificationList,
  handleCertificationGet,
  handleCertificationItemUpdate,
  handleSelfSignup,
  handleBulkImport,
  handleOrgHierarchy,
  handleCertificationGenerate,
  handleCertificationHistoryList,
  handleCertificationItemsList,
  handleRecommendationGenerated,
  handleApplicationCreate,
  handleActiveAccessList,
  handleCertificationReport,
  handlePermissionsList,
  startBackgroundLdapSync,
  handleManualLdapSync,
  startLdapReconciliationJob
} from "./handlers/sync.js";
import {
  handleUserCreated,
  handleUserApprove,
  handleUserSync,
  handleUserUpdated,
  handleMfaSetup,
  handleMfaVerify,
  handleLoginPrimary
} from "./handlers/users.js";
import {
  handleRequestUpdate,
  handleTimeRevoke,
} from "./handlers/async.js";

const STREAM = "EVENTS_ACCESS";
const SVC_NAME = "access-management";

const getIdentity = (req) => ({
  userId: req.headers["x-user-id"] || "admin",
  role: req.headers["x-user-role"] || "admin"
});

async function main() {
  const { nc, js, jsm } = await connectNats();

  // ── Sync: NATS Core subscribe + reply ───────────────────────────────────────
  const syncRoutes = [
    ["admin.users.list.v2", handleUserList],
    ["access.request.list", handleRequestList],
    ["access.request.get", handleRequestGet],
    ["access.request.create", handleRequestCreate],   // POST — sync so we return id
    ["access.time.create", handleTimeProvision],
    ["access.time.list", handleTimeList],
    ["access.time.get", handleTimeGet],
    ["user.access.list", handleUserAccessList],
    ["admin.dashboard.stats", handleAdminStats],
    ["audit.query.logs", handleAuditLogs],
    ["access.managed_apps.create", handleManagedAppCreate],
    ["access.managed_apps.sync", handleManagedAppSync],
    ["admin.group.create", handleGroupCreate],
    ["applications.list", handleApplicationsList],
    ["applications.get", handleApplicationsList],     // alias: single app falls back to list
    ["admin.user.get", handleUserGet],
    ["user.get", handleUserGet],                      // /api/user/:id → same handler
    ["user.me", handleUserGet],                       // /api/user/me → same handler
    ["user.list.v2", handleUserList],                    // /api/user/ list
    ["admin.user.approve", handleUserApprove],
    ["admin.user.group.add.v2", handleUserGroupAdd],
    ["admin.user.group.remove", handleUserGroupRemove],
    ["access.user.create", handleUserCreated],
    ["certification.list", handleCertificationList],
    ["certification.get", handleCertificationGet],
    ["certification.items.list", handleCertificationItemsList],
    ["certification.item.update", handleCertificationItemUpdate],
    ["user.self_signup", handleSelfSignup],
    ["events.provision.bulk", handleBulkImport],
    ["user.bulk_import", handleBulkImport],
    ["admin.org.hierarchy", handleOrgHierarchy],
    ["certification.generate", handleCertificationGenerate],
    ["certification.report", handleCertificationReport],
    ["applications.create", handleApplicationCreate],
    ["access.active.list", handleActiveAccessList],
    ["admin.users.update", handleUserUpdated],
    ["permissions.list", handlePermissionsList],
    ["roles.list", handleRolesList],
    ["roles.get", handleRolesList],                   // single role falls back to list
    ["certification.history.list", handleCertificationHistoryList],
    ["access.user.sync", handleManualLdapSync],
    ["auth.mfa.setup", handleMfaSetup],
    ["auth.mfa.verify", handleMfaVerify],
    ["auth.login.primary", handleLoginPrimary],
    ["auth.login", handleLoginPrimary],
  ];

  console.log("[db] Connected to MySQL ✅");

  // Schema Patch: Ensure tables and columns exist (MySQL Syntax)
  try {
    // 1. Core extensions for access_requests
    await db.query(`
      CREATE TABLE IF NOT EXISTS access_requests (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        target_user_id VARCHAR(255),
        application_id VARCHAR(255),
        application_name VARCHAR(255),
        role_id VARCHAR(100),
        role_name VARCHAR(100),
        requested_role VARCHAR(100),
        justification TEXT,
        duration_seconds INT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        approver_id VARCHAR(255),
        assigned_approver_id VARCHAR(255),
        review_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        submitted_at TIMESTAMP NULL,
        approved_at TIMESTAMP NULL,
        decided_at TIMESTAMP NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Column patches for existing tables
    const columns = [
      ["duration_seconds", "INT NULL"],
      ["submitted_at", "TIMESTAMP NULL"],
      ["approved_at", "TIMESTAMP NULL"],
      ["decided_at", "TIMESTAMP NULL"],
      ["review_note", "TEXT NULL"]
    ];

    for (const [col, type] of columns) {
      try {
        await db.query(`ALTER TABLE access_requests ADD COLUMN ${col} ${type}`);
        console.log(`[db] Added missing column: ${col} to access_requests`);
      } catch (e) {
        // Ignore "Duplicate column name" error (1060)
        if (!e.message.includes("Duplicate column name")) {
          console.warn(`[db] Failed to add column ${col}:`, e.message);
        }
      }
    }


    // 2. User extensions
    await db.query(`
      CREATE TABLE IF NOT EXISTS users_access (
        id VARCHAR(255) PRIMARY KEY,
        employee_id VARCHAR(100),
        full_name VARCHAR(255),
        email VARCHAR(255),
        role_id VARCHAR(50),
        manager_id VARCHAR(255),
        status VARCHAR(50),
        mfa_setup_link TEXT,
        last_login DATETIME,
        last_synced TIMESTAMP NULL,
        isApproved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Ensure mfa_secret column exists
    try {
      await db.query("ALTER TABLE users_access ADD COLUMN mfa_secret VARCHAR(255) NULL AFTER mfa_setup_link");
    } catch (e) { }

    // 2.1 ROLES (Centralized)
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(50) PRIMARY KEY,
        role_name VARCHAR(255) NOT NULL,
        role_type VARCHAR(50) DEFAULT 'STANDARD',
        description TEXT,
        permissions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Notifications
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        \`read\` TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. ACCESS CERTIFICATIONS (Enterprise Scope)
    await db.query(`
      CREATE TABLE IF NOT EXISTS access_certifications (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        certification_owner_id VARCHAR(255),
        hierarchy_scope_type VARCHAR(50) DEFAULT 'DIRECT_REPORTS',
        creator_id VARCHAR(255),
        due_date DATETIME,
        start_date DATETIME,
        end_date DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_owner (certification_owner_id)
      )
    `);

    // 4.1 CERTIFICATION CAMPAIGN HISTORY (Summary Tracking)
    await db.query(`
      CREATE TABLE IF NOT EXISTS certification_campaign_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id VARCHAR(255) UNIQUE NOT NULL,
        campaign_name VARCHAR(255) NOT NULL,
        created_by VARCHAR(255),
        hierarchy_scope VARCHAR(50),
        assigned_manager_id VARCHAR(255),
        total_users INT DEFAULT 0,
        total_accesses INT DEFAULT 0,
        certified_count INT DEFAULT 0,
        revoked_count INT DEFAULT 0,
        pending_count INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'CREATED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        FOREIGN KEY (campaign_id) REFERENCES access_certifications(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_manager_id) REFERENCES users_access(id) ON DELETE SET NULL
      )
    `);

    // 5. CERTIFICATION ITEMS (Recommendation Aware)
    await db.query(`
      CREATE TABLE IF NOT EXISTS certification_items (
        id VARCHAR(255) PRIMARY KEY,
        certification_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        application_id VARCHAR(255) NOT NULL,
        manager_id VARCHAR(255),
        decision VARCHAR(50) DEFAULT 'PENDING',
        recommendation_score FLOAT,
        recommended_action VARCHAR(50),
        risk_score FLOAT DEFAULT 0,
        comments TEXT,
        reviewed_at DATETIME,
        reviewed_by VARCHAR(255),
        INDEX idx_cert_id (certification_id),
        INDEX idx_user_id (user_id),
        INDEX idx_manager_id (manager_id),
        FOREIGN KEY (user_id) REFERENCES users_access(id) ON DELETE CASCADE
      )
    `);

    // 6. APPLICATIONS
    await db.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id VARCHAR(255) PRIMARY KEY,
        app_name VARCHAR(255) NOT NULL,
        app_type VARCHAR(50) DEFAULT 'BUSINESS',
        risk_level VARCHAR(50) DEFAULT 'MEDIUM',
        risk_score FLOAT DEFAULT 0,
        description TEXT,
        owner_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. USER ACCESS (Entitlements)
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_access (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        application_id VARCHAR(255) NOT NULL,
        role_name VARCHAR(100),
        access_type VARCHAR(50) DEFAULT 'REGULAR',
        status VARCHAR(50) DEFAULT 'ACTIVE',
        granted_by VARCHAR(255),
        approved_at TIMESTAMP NULL,
        valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_to TIMESTAMP NULL,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users_access(id) ON DELETE CASCADE
      )
    `);

    // 8. ACCESS CATALOG
    await db.query(`
      CREATE TABLE IF NOT EXISTS access_catalog (
        id VARCHAR(255) PRIMARY KEY,
        access_code VARCHAR(100) UNIQUE,
        access_name VARCHAR(255) NOT NULL,
        description TEXT,
        application_id VARCHAR(255),
        access_type VARCHAR(50),
        risk_level VARCHAR(50),
        approval_required TINYINT(1) DEFAULT 1,
        auto_approvable TINYINT(1) DEFAULT 0,
        validity_period INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 9. SYSTEM LOGS (Centralized Logging)
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id VARCHAR(255),
        actor_id VARCHAR(255),
        payload JSON,
        status VARCHAR(50),
        source_service VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. AUDIT LOGS (Legacy Support)
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(100),
        actor_id VARCHAR(255),
        actor_name VARCHAR(255),
        target_id VARCHAR(255),
        details JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. ACCESS RULES (Rule Engine)
    await db.query(`
      CREATE TABLE IF NOT EXISTS access_rules (
        rule_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        priority INT DEFAULT 0,
        enabled TINYINT(1) DEFAULT 1,
        condition_logic VARCHAR(10) DEFAULT 'AND',
        conditions JSON,
        action JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    try { await db.query("CREATE INDEX idx_notifications_user_id ON notifications(user_id)"); } catch (e) { }
    try { await db.query("CREATE INDEX idx_cert_manager_id ON certification_items(manager_id)"); } catch (e) { }

    // Migration support for existing tables
    try { await db.query("ALTER TABLE users_access ADD COLUMN last_synced TIMESTAMP NULL AFTER last_login"); } catch (e) { }
    try { await db.query("ALTER TABLE user_access ADD COLUMN granted_by VARCHAR(255)"); } catch (e) { }
    try { await db.query("ALTER TABLE user_access ADD COLUMN approved_at TIMESTAMP NULL"); } catch (e) { }
    try { await db.query("ALTER TABLE users_access ADD COLUMN isApproved BOOLEAN DEFAULT FALSE"); } catch (e) { }
    // Fix id column if it was created as INT AUTO_INCREMENT — drop FK-dependent tables and recreate
    try { await db.query("ALTER TABLE user_access MODIFY COLUMN id VARCHAR(255) NOT NULL"); } catch (e) { }
    try { await db.query("ALTER TABLE access_certifications ADD COLUMN certification_owner_id VARCHAR(255) AFTER status"); } catch (e) { }
    try { await db.query("ALTER TABLE access_certifications ADD COLUMN hierarchy_scope_type VARCHAR(50) DEFAULT 'DIRECT_REPORTS' AFTER certification_owner_id"); } catch (e) { }
    try { await db.query("ALTER TABLE applications ADD COLUMN app_type VARCHAR(50) DEFAULT 'BUSINESS' AFTER app_name"); } catch (e) { }
    try { await db.query("ALTER TABLE applications ADD COLUMN risk_level VARCHAR(50) DEFAULT 'MEDIUM' AFTER app_type"); } catch (e) { }
    try { await db.query("ALTER TABLE applications ADD COLUMN risk_score FLOAT DEFAULT 0 AFTER risk_level"); } catch (e) { }
    try { await db.query("ALTER TABLE certification_items ADD COLUMN recommendation_score FLOAT AFTER decision"); } catch (e) { }
    try { await db.query("ALTER TABLE certification_items ADD COLUMN recommended_action VARCHAR(50) AFTER recommendation_score"); } catch (e) { }
    try { await db.query("ALTER TABLE certification_items ADD COLUMN reviewed_by VARCHAR(255) AFTER recommended_action"); } catch (e) { }
    try { await db.query("ALTER TABLE certification_items ADD COLUMN reviewed_at DATETIME AFTER reviewed_by"); } catch (e) { }
    try { await db.query("ALTER TABLE certification_items ADD COLUMN risk_score FLOAT AFTER recommendation_score"); } catch (e) { }
    try { await db.query("ALTER TABLE access_requests ADD COLUMN duration_seconds INT DEFAULT NULL AFTER justification"); } catch (e) { }
    try { await db.query("ALTER TABLE access_requests ADD COLUMN application_name VARCHAR(255) AFTER application_id"); } catch (e) { }
    try { await db.query("ALTER TABLE access_requests ADD COLUMN role_id VARCHAR(100) AFTER application_name"); } catch (e) { }
    try { await db.query("ALTER TABLE access_requests ADD COLUMN role_name VARCHAR(100) AFTER role_id"); } catch (e) { }
    try { await db.query("ALTER TABLE user_access ADD COLUMN role_name VARCHAR(100) AFTER application_id"); } catch (e) { }
    try { await db.query("ALTER TABLE certification_items ADD COLUMN role_name VARCHAR(100) AFTER application_id"); } catch (e) { }
    try { await db.query("ALTER TABLE roles ADD COLUMN permissions JSON AFTER description"); } catch (e) { }
    try { await db.query("ALTER TABLE access_certifications ADD COLUMN start_date DATETIME AFTER status"); } catch (e) { }
    try { await db.query("ALTER TABLE access_certifications ADD COLUMN end_date DATETIME AFTER start_date"); } catch (e) { }

    console.log("[db] MySQL Schema verified and certification tables expanded ✅");

    // Force Admin to be active
    await db.query(`
      INSERT INTO users_access (id, employee_id, full_name, email, role_id, status, isApproved)
      VALUES ('admin', 'admin', 'System Admin', 'admin@nextgen-iga.com', 'admin', 'ACTIVE', TRUE)
      ON DUPLICATE KEY UPDATE status = 'ACTIVE', role_id = 'admin', isApproved = TRUE
    `);
    console.log("[db] System Admin verified and forced to ACTIVE status ✅");

    // Seed Applications
    await db.query(`
      INSERT INTO applications (id, app_name, description)
      VALUES 
        ('salesforce', 'Salesforce CRM', 'Customer relationship management platform'),
        ('aws', 'AWS Cloud Console', 'Amazon Web Services infrastructure access'),
        ('github', 'GitHub Enterprise', 'Source code management and collaboration'),
        ('slack', 'Slack Workspace', 'Internal communication and messaging')
      ON DUPLICATE KEY UPDATE app_name = VALUES(app_name)
    `);
    console.log("[db] Seed applications created ✅");

    // Seed Access Catalog
    await db.query(`
      INSERT INTO access_catalog (id, access_code, access_name, description, application_id, access_type, risk_level)
      VALUES 
        ('cat-1', 'AWS_READ', 'AWS Read Only', 'ReadOnly access to AWS Console', 'aws', 'REGULAR', 'LOW'),
        ('cat-2', 'AWS_ADMIN', 'AWS Admin', 'Full Administrator access to AWS', 'aws', 'PRIVILEGED', 'HIGH'),
        ('cat-3', 'SF_USER', 'Salesforce User', 'Standard Salesforce User access', 'salesforce', 'REGULAR', 'MEDIUM'),
        ('cat-4', 'GH_DEV', 'GitHub Developer', 'Write access to GitHub repositories', 'github', 'REGULAR', 'MEDIUM')
      ON DUPLICATE KEY UPDATE access_name = VALUES(access_name)
    `);
    console.log("[db] Seed access catalog created ✅");

    // Seed Roles
    await db.query(`
      INSERT INTO roles (id, role_name, role_type, description, permissions)
      VALUES 
        ('end_user', 'End User', 'STANDARD', 'Standard access for requesting and managing personal application permissions.', '["READ_SELF", "CREATE_REQUEST"]'),
        ('supervisor', 'Supervisor', 'MANAGEMENT', 'Managerial access to review team requests and monitor team compliance.', '["READ_TEAM", "APPROVE_REQUEST", "MANAGE_APPLICATIONS"]'),
        ('admin', 'Administrator', 'SYSTEM', 'Full administrative control over the platform.', '["*"]')
      ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)
    `);
    console.log("[db] Seed roles created ✅");
  } catch (err) {
    console.error("[db] Schema verification error:", err.message);
  }

  for (const [subject, handler] of syncRoutes) {
    const sub = nc.subscribe(subject);
    console.log("[sync] listening:", subject);

    (async () => {
      for await (const msg of sub) {
        handler(msg).catch((e) =>
          console.error(`[sync] ${subject} unhandled:`, e.message),
        );
      }
    })();
  }

  // ── Async: JetStream durable consumers ──────────────────────────────────────
  const asyncRoutes = [
    { subject: "events.access.request.update", handler: handleRequestUpdate, name: "req-update" },
    { subject: "events.access.time.revoke", handler: handleTimeRevoke, name: "time-revoke" },
    { subject: "events.provision.time", handler: handleTimeProvision, name: "time-provision" },
    { subject: "certification.recommendation.generated", handler: handleRecommendationGenerated, name: "cert-recommend" },
  ];

  for (const { subject, handler, name } of asyncRoutes) {
    const durable = `${SVC_NAME}-${name}`;
    let consumerReady = false;
    let attempts = 0;

    while (!consumerReady && attempts < 10) {
      try {
        attempts++;
        // Ensure stream exists first
        await jsm.streams.info(STREAM);

        try {
          await jsm.consumers.info(STREAM, durable);
          console.log("[async] consumer exists:", durable);
        } catch {
          await jsm.consumers.add(STREAM, {
            durable_name: durable,
            filter_subject: subject,
            ack_policy: "explicit",
            deliver_policy: "all",
            max_deliver: 5,
            ack_wait: 30_000_000_000,
          });
          console.log("[async] consumer created:", durable);
        }

        const consumer = await js.consumers.get(STREAM, durable);
        const messages = await consumer.consume();
        console.log("[async] consuming:", subject);

        (async () => {
          for await (const msg of messages) {
            handler(msg).catch((e) => {
              console.error(`[async] ${subject} unhandled:`, e.message);
              msg.nak();
            });
          }
        })();

        consumerReady = true;
      } catch (err) {
        if (err.message?.includes("stream not found")) {
          console.warn(`[async] Stream ${STREAM} not found yet, retrying in 2s... (attempt ${attempts}/10)`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw err;
        }
      }
    }
  }

  console.log("[access-management] ready");
  startAutoRevocationCheck();
  startBackgroundLdapSync();
  startLdapReconciliationJob();

  // ── HTTP API for direct communication (Bypass NATS for Auth) ────────────────
  const express = (await import("express")).default;
  const cors = (await import("cors")).default;
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.post("/api/login", async (req, res) => {
    try {
      const result = await handleLoginPrimaryLogic(req.body);
      res.status(result.status || 200).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/mfa/setup", async (req, res) => {
    try {
      const { mfaSetupLogic } = await import("./handlers/users.js");
      const result = await mfaSetupLogic(req.body, req.headers);
      res.status(result.status || 200).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/mfa/verify", async (req, res) => {
    try {
      const { mfaVerifyLogic } = await import("./handlers/users.js");
      // For verify, we might need the token from Authorization header if present
      const token = req.headers.authorization?.replace("Bearer ", "");
      const result = await mfaVerifyLogic(req.body, token, req.headers);
      res.status(result.status || 200).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/access/request/create", async (req, res) => {
    console.log("[access-management] HTTP: POST /api/access/request/create hit");
    try {
      const { handleRequestCreate } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          body: req.body 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleRequestCreate(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/users/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/users/list hit");
    try {
      const { handleUserList } = await import("./handlers/sync.js");
      const msg = {
        data: jc.encode({}),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleUserList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/users/group/add", async (req, res) => {
    console.log("[access-management] HTTP: POST /api/users/group/add hit");
    try {
      const { handleUserGroupAdd } = await import("./handlers/sync.js");
      const msg = {
        data: jc.encode(req.body),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleUserGroupAdd(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/users/update", async (req, res) => {
    console.log("[access-management] HTTP: POST /api/users/update hit");
    try {
      const { handleUserUpdated } = await import("./handlers/users.js");
      const msg = {
        data: jc.encode(req.body),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleUserUpdated(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/request/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/access/request/list hit");
    try {
      const { handleRequestList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          query: req.query 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleRequestList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/dashboard/stats hit");
    try {
      const { handleAdminStats } = await import("./handlers/sync.js");
      const msg = {
        data: jc.encode({ userId: "admin", role: "admin" }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleAdminStats(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/applications/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/applications/list hit");
    try {
      const { handleApplicationsList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleApplicationsList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/roles/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/roles/list hit");
    try {
      const { handleRolesList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleRolesList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/permissions/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/permissions/list hit");
    try {
      const { handlePermissionsList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handlePermissionsList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/audit/logs", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/audit/logs hit");
    try {
      const { handleAuditLogs } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          query: req.query 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleAuditLogs(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/active", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/access/active hit");
    try {
      const { handleUserAccessList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleActiveAccessList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/time", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/access/time hit");
    try {
      const { handleTimeList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleTimeList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/notifications/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/notifications/list hit");
    try {
      const { handleNotificationsList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          query: req.query 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          // FORCE data to be a flat array for the frontend
          if (result.ok) {
            if (result.data && result.data.data && Array.isArray(result.data.data)) {
              result.data = result.data.data;
            } else if (!Array.isArray(result.data)) {
              result.data = [];
            }
          } else {
            result.data = [];
          }
          res.status(result.status || 200).json(result);
        }
      };
      await handleNotificationsList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/users/approve", async (req, res) => {
    console.log("[access-management] HTTP: POST /api/users/approve hit");
    try {
      const { handleUserApprove } = await import("./handlers/users.js");
      const { userId: adminId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId: adminId, 
          role,
          body: req.body 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleUserApprove(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/cert/campaign/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/access/cert/campaign/list hit");
    try {
      const { handleCertificationList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleCertificationList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/cert/history/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/access/cert/history/list hit");
    try {
      const { handleCertificationHistoryList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleCertificationHistoryList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/access/cert/campaign", async (req, res) => {
    console.log("[access-management] HTTP: POST /api/access/cert/campaign hit");
    try {
      const { handleCertificationGenerate } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          body: req.body 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleCertificationGenerate(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/cert/items/list", async (req, res) => {
    console.log("[access-management] HTTP: GET /api/access/cert/items/list hit");
    try {
      const { handleCertificationItemsList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          path: req.originalUrl || "/api/access/cert/items/list",
          query: req.query 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleCertificationItemsList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/access/cert/item/update", async (req, res) => {
    console.log("[access-management] HTTP: POST /api/access/cert/item/update hit");
    try {
      const { handleCertificationItemUpdate } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role, body: req.body }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleCertificationItemUpdate(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  // ── Provisioning Direct HTTP Bypass ──────────────────────────────────────────
  app.post("/api/provision/users", async (req, res) => {
    console.log("[access-management] HTTP: POST /api/provision/users hit (Direct Bypass)");
    try {
      const { handleBulkImport } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role, body: req.body }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleBulkImport(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/provision/user", async (req, res) => {
    console.log("[access-management] HTTP: POST /api/provision/user hit (Direct Bypass)");
    try {
      const { handleUserCreated } = await import("./handlers/users.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ userId, role, body: req.body }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleUserCreated(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/cert/campaign/:id/items/list", async (req, res) => {
    console.log(`[access-management] HTTP: GET /api/access/cert/campaign/${req.params.id}/items/list hit`);
    try {
      const { handleCertificationItemsList } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          path: req.originalUrl || `/api/access/cert/campaign/${req.params.id}/items/list`,
          query: req.query 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleCertificationItemsList(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/cert/campaign/:id", async (req, res) => {
    console.log(`[access-management] HTTP: GET /api/access/cert/campaign/${req.params.id} hit`);
    try {
      const { handleCertificationGet } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          path: req.originalUrl,
          params: req.params 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleCertificationGet(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/access/cert/campaign/:id/report", async (req, res) => {
    console.log(`[access-management] HTTP: GET /api/access/cert/campaign/${req.params.id}/report hit`);
    try {
      const { handleCertificationReport } = await import("./handlers/sync.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          path: req.originalUrl,
          params: req.params 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleCertificationReport(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });


  app.get("/api/users/:uid", async (req, res) => {
    try {
      const { handleUserGet } = await import("./handlers/users.js");
      // Mock NATS msg object for handleUserGet
      const msg = {
        data: jc.encode({ params: req.params }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        }
      };
      await handleUserGet(msg);
    } catch (err) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.put("/api/access/request/:id", async (req, res) => {
    console.log(`[access-management] HTTP: PUT /api/access/request/${req.params.id} hit`);
    try {
      const { handleRequestUpdate } = await import("./handlers/async.js");
      const { userId, role } = getIdentity(req);
      const msg = {
        data: jc.encode({ 
          userId, 
          role,
          path: req.originalUrl || `/api/access/request/${req.params.id}`,
          body: req.body 
        }),
        respond: (payload) => {
          const result = jc.decode(payload);
          res.status(result.status || 200).json(result);
        },
        ack: () => {
          if (!res.headersSent) res.status(200).json({ ok: true, message: "Request updated" });
        },
        nak: () => {
          if (!res.headersSent) res.status(500).json({ ok: false, message: "Update failed" });
        }
      };
      await handleRequestUpdate(msg);
    } catch (err) {
      console.error("[access-management] HTTP Request Update error:", err.message);
      if (!res.headersSent) res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.get("/api/user/:userId/access", async (req, res) => {
    try {
      const { userId } = req.params;
      const { rows } = await db.query(
        `SELECT ua.id, ua.user_id, ua.application_id, 
                a.app_name AS application_name, ua.role_name,
                ua.valid_from AS granted_at, ua.valid_to AS expires_at, ua.status
         FROM user_access ua
         LEFT JOIN applications a ON ua.application_id = a.id
         WHERE ua.user_id = ?
         ORDER BY ua.valid_from DESC`,
        [userId],
      );
      res.json({ ok: true, data: rows });
    } catch (e) {
      console.error("[api] user access fetch error:", e.message);
      res.status(500).json({ ok: false, message: "DB error" });
    }
  });

  const HTTP_PORT = process.env.ACCESS_MGMT_PORT || 3001;


  app.listen(HTTP_PORT, () => {
    console.log(`[access-management] HTTP API listening on :${HTTP_PORT}`);
  });
}

// Rename the logic for clearer usage or import it
async function handleLoginPrimaryLogic(body) {
  const { loginPrimaryLogic } = await import("./handlers/users.js");
  return loginPrimaryLogic(body);
}

main().catch((e) => {
  console.error("[access-management] fatal:", e);
  process.exit(1);
});


