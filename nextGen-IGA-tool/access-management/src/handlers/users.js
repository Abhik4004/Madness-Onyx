import { jc, getNats } from "../nats/connector.js";
import { db } from "../db/client.js";
import { logActivity } from "./sync.js";
import http from "http";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

// Subscribe to events.auth.user.created / updated / deleted
// Auth svc must publish these on register/update/delete

export async function handleUserCreated(msg) {
  const data = jc.decode(msg.data);
  // Support multiple ID field names (userId, uid, id)
  const userId = data.userId || data.uid || data.id;
  const { email, full_name, role } = data;
  let manager_id = data.manager_id || data.manager || null;
  if (manager_id && String(manager_id).includes('uid=')) {
    const match = String(manager_id).match(/uid=([^,]+)/i);
    manager_id = match ? match[1] : manager_id;
  }

  if (!userId || String(userId) === "null") {
    console.warn("[users] Ignoring user creation with null/missing identifier. Received:", JSON.stringify(data));
    return msg.respond(jc.encode({ ok: false, status: 400, message: "Valid userId/uid is required" }));
  }

  console.log(`[users] Creating user: ${userId} (${email})`);

  try {
    const status = (data.status || 'PENDING_APPROVAL').toUpperCase();
    const normalizedId = String(userId).toLowerCase();

    // 1. Strict existence validation
    const { rows: existing } = await db.query(
      "SELECT id FROM users_access WHERE LOWER(id) = ?",
      [normalizedId]
    );

    if (existing.length > 0) {
      console.log(`[users] User ${normalizedId} already exists, returning existing record.`);
      return msg.respond(jc.encode({ ok: true, status: 200, message: "User already exists", data: existing[0] }));
    }

    // 2. Provision in LDAP (Requirement: Consolidate to single backend flow)
    try {
      console.log(`[users] Provisioning user ${userId} in LDAP...`);
      const authUrl = process.env.EXTERNAL_AUTH_URL || "http://18.60.129.12:8080";
      const provRes = await fetch(`${authUrl}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: userId,
          mail: email,
          givenName: data.givenName || userId,
          sn: data.sn || "User",
          cn: full_name || userId,
          password: data.password || "Welcome123!"
        })
      });
      const provData = await provRes.json().catch(() => ({}));
      if (!provRes.ok) {
        // Graceful handling: If user already exists in LDAP (403/409), treat as soft success and proceed to DB creation
        if (provRes.status === 403 || provRes.status === 409) {
          console.warn(`[users] User ${userId} already exists in LDAP (Status ${provRes.status}). Proceeding to governance DB registration.`);
        } else {
          console.error(`[users] LDAP Provisioning failed for ${userId}:`, provData.message);
          return msg.respond(jc.encode({ ok: false, status: provRes.status, message: provData.message || "LDAP Provisioning failed" }));
        }
      } else {
        console.log(`[users] LDAP Provisioning successful for ${userId}`);
      }
    } catch (provErr) {
      console.error(`[users] LDAP Provisioning error for ${userId}:`, provErr.message);
      return msg.respond(jc.encode({ ok: false, status: 500, message: "LDAP Service unavailable" }));
    }

    try {
      await db.query(
        `INSERT INTO users_access (id, full_name, email, role_id, manager_id, status, isApproved)
         VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
        [
          normalizedId,
          full_name || normalizedId,
          email || null,
          role || 'end_user',
          manager_id || null,
          status || 'PENDING_APPROVAL'
        ]
      );
    } catch (dbErr) {
      if (dbErr.message.includes("Duplicate entry")) {
        console.warn(`[users] Race condition caught: ${userId} already exists.`);
        return msg.respond(jc.encode({ ok: false, status: 409, message: `Username ${userId} is already taken.` }));
      }
      throw dbErr;
    }

    await logActivity("USER_CREATED", normalizedId, normalizedId, normalizedId, { email, role, status });
    console.log(`[users] Database successfully updated for user: ${userId} (Status: ${status})`);

    // Notify Admin about new registration
    try {
      const { js } = getNats();
      await js.publish("events.notify.email", jc.encode({
        to: "admin@nextgen-iga.com",
        subject: "Action Required: New User Registration",
        body: `A new user (${full_name || userId}) has registered and is awaiting approval.\n\nPlease log in to the Admin Dashboard to review and approve this account.`
      }));
    } catch (notifyErr) {
      console.error("[users] Failed to notify admin:", notifyErr.message);
    }

    if (msg.reply) {
      msg.respond(jc.encode({ ok: true, status: 201, message: "User created and pending approval" }));
    } else {
      msg.ack();
    }
  } catch (e) {
    console.error("[users] create error:", e.message);
    if (msg.reply) {
      msg.respond(jc.encode({ ok: false, status: 500, message: e.message }));
    } else {
      msg.nak();
    }
  }
}

export async function handleUserGet(msg) {
  try {
    const envelope = jc.decode(msg.data);
    const userId = envelope.params?.uid || envelope.body?.uid || envelope.uid;
    console.log(`[users] Fetching user: ${userId}`);

    const { rows } = await db.query(
      "SELECT id, full_name, email, role_id, manager_id, status, isApproved, created_at FROM users_access WHERE LOWER(id) = LOWER(?)",
      [userId]
    );

    if (rows.length === 0) {
      return msg.respond(jc.encode({ ok: false, status: 404, message: "User not found" }));
    }

    msg.respond(jc.encode({ ok: true, status: 200, data: rows[0] }));
  } catch (e) {
    console.error("[users] get user error:", e.message);
    msg.respond(jc.encode({ ok: false, status: 500, message: e.message }));
  }
}

export async function handleUserSync(msg) {

  const data = jc.decode(msg.data);
  const { userId, email, full_name, role, status } = data;
  let manager_id = data.manager_id || data.manager || null;
  if (manager_id && String(manager_id).includes('uid=')) {
    const match = String(manager_id).match(/uid=([^,]+)/i);
    manager_id = match ? match[1] : manager_id;
  }
  console.log(`[users] Syncing user: ${userId} (${email}), manager: ${manager_id}`);

  try {
    const normalizedId = String(userId).toLowerCase();

    // Check if user already exists
    const { rows: existing } = await db.query(
      "SELECT id FROM users_access WHERE LOWER(id) = ?",
      [normalizedId]
    );

    if (existing.length > 0) {
      // User exists, do nothing as per requirements ("DO NOT refetch/reinsert duplicate account")
      console.log(`[users] User ${normalizedId} already exists, skipping sync.`);
      return msg.respond(jc.encode({ ok: true, status: 200, message: "User already exists", data: existing[0] }));
    }

    // Insert new user — try to fetch manager from external LDAP first
    let resolvedManagerId = manager_id ?? null;
    if (!resolvedManagerId) {
      try {
        const authUrl = process.env.EXTERNAL_AUTH_URL || "http://18.60.129.12:8080";
        const extRes = await fetch(`${authUrl}/api/user/details`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: normalizedId })
        });
        if (extRes.ok) {
          const extData = await extRes.json().catch(() => ({}));
          const managerRaw = extData?.data?.manager || extData?.manager || null;
          if (managerRaw) {
            // Extract uid from DN like uid=jsmith,ou=users,dc=...
            const match = String(managerRaw).match(/uid=([^,]+)/i);
            resolvedManagerId = match ? match[1] : String(managerRaw);
          }
        }
      } catch (e) {
        console.warn("[users] Could not fetch manager from LDAP for", normalizedId, e.message);
      }
    }

    const defaultStatus = (status || 'PENDING_APPROVAL').toUpperCase();
    await db.query(
      `INSERT INTO users_access (id, full_name, email, role_id, manager_id, status, isApproved)
       VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
      [normalizedId, full_name ?? "", email, role ?? "end_user", resolvedManagerId, defaultStatus],
    );
    await logActivity("USER_SYNCED", userId, full_name || userId, userId, { email, status: defaultStatus, manager_id: resolvedManagerId });
    console.log(`[users] User synced to DB: ${userId} (isApproved=FALSE, manager=${resolvedManagerId})`);

    // Log to SYSTEM_LOGS
    try {
      await db.query(
        `INSERT INTO system_logs (event_type, entity_type, entity_id, actor_id, status, source_service)
         VALUES ('FIRST_LOGIN_SYNC', 'USER', ?, ?, 'SUCCESS', 'access-management')`,
        [normalizedId, normalizedId]
      );
    } catch (logErr) {
      console.error("[users] Failed to write system_logs:", logErr.message);
    }

    msg.respond(jc.encode({ ok: true, status: 201, message: "User synced successfully" }));
  } catch (e) {
    console.error("[users] sync error:", e.message);

    try {
      await db.query(
        `INSERT INTO system_logs (event_type, entity_type, entity_id, actor_id, status, source_service, payload)
         VALUES ('FIRST_LOGIN_SYNC', 'USER', ?, ?, 'FAILURE', 'access-management', ?)`,
        [userId, userId, JSON.stringify({ error: e.message })]
      );
    } catch (logErr) { }

    msg.respond(jc.encode({ ok: false, status: 500, message: e.message }));
  }
}

export async function handleUserUpdated(msg) {
  try {
    const envelope = jc.decode(msg.data);
    const data = envelope.body || envelope;
    
    // Support both bulk (from UI) and single (from other services) updates
    const usersToUpdate = Array.isArray(data.users) ? data.users : [data];

    console.log(`[users] Bulk update requested for ${usersToUpdate.length} users`);

    for (const u of usersToUpdate) {
      const userId = u.uid || u.userId || u.id;
      const attrs = u.attributes || u;
      const { email, full_name, role_id } = attrs;
      let resolvedManagerId = attrs.manager_id || attrs.manager || null;
      if (resolvedManagerId && String(resolvedManagerId).includes('uid=')) {
        const match = String(resolvedManagerId).match(/uid=([^,]+)/i);
        resolvedManagerId = match ? match[1] : resolvedManagerId;
      }

      if (!userId) continue;

      console.log(`[users] Updating user: ${userId}`, { role_id, resolvedManagerId });

      await db.query(
        `UPDATE users_access
         SET full_name  = COALESCE(?, full_name),
             email      = COALESCE(?, email),
             role_id    = COALESCE(?, role_id),
             manager_id = COALESCE(?, manager_id),
             updated_at = NOW()
         WHERE id = ?`,
        [full_name || null, email || null, role_id || null, resolvedManagerId || null, userId],
      );
    }

    msg.respond(jc.encode({ ok: true, message: "Users updated successfully" }));
  } catch (e) {
    console.error("[users] update error:", e.message);
    msg.respond(jc.encode({ ok: false, message: e.message }));
  }
}

export async function handleUserDeleted(msg) {
  const { userId } = jc.decode(msg.data);
  try {
    await db.query(
      `UPDATE users_access SET is_active = false, updated_at = NOW() WHERE id = ?`,
      [userId],
    );
    console.log(`[users] deactivated user:${userId}`);
    msg.ack();
  } catch (e) {
    console.error("[users] delete error:", e.message);
    msg.nak();
  }
}

/**
 * handleUserApprove
 * POST /api/admin/user/approve
 */
export async function handleUserApprove(msg) {
  try {
    const envelope = jc.decode(msg.data);
    const data = envelope.body || envelope;
    const { userId, mfaLink } = data;

    if (!userId) {
      return msg.respond(jc.encode({ ok: false, status: 400, message: "userId is required" }));
    }

    // Case-insensitive lookup to find the correct record to update
    const { rows: userRows } = await db.query(
      "SELECT id, full_name, email FROM users_access WHERE LOWER(id) = LOWER(?)",
      [userId]
    );
    const user = userRows[0];
    const targetId = user?.id || userId;

    // Use the login page with pre-filled UID for the MFA activation flow
    const frontendUrl = process.env.FRONTEND_URL || "http://54.167.248.162";
    const finalMfaLink = `${frontendUrl}/login?uid=${targetId}`;

    console.log(`[users] Approving user: searchId=${userId}, targetId=${targetId}`);

    const { rows: updateResult } = await db.query(
      `INSERT INTO users_access (id, status, isApproved, mfa_setup_link, full_name, email)
       VALUES (?, 'ACTIVE', TRUE, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         status = 'ACTIVE',
         isApproved = TRUE,
         mfa_setup_link = VALUES(mfa_setup_link),
         updated_at = NOW()`,
      [targetId, finalMfaLink, user?.full_name || targetId, user?.email || `${targetId}@example.com`]
    );

    console.log(`[users] User APPROVE update result for ${userId}:`, updateResult);

    await logActivity("USER_APPROVED", envelope.userId, envelope.userId, userId, { status: 'ACTIVE' });

    console.log(`[users] User APPROVED and MFA generated: ${userId}`);

    // Trigger Notification Email
    try {
      const { js } = getNats();
      const recipient = user?.email || `${userId}@example.com`;
      const emailBody = `Hello ${user?.full_name || userId},\n\nYour account has been approved. Please set up your MFA using the link below:\n\n${finalMfaLink}\n\nRegards,\nNextGen IGA Team`;

      console.log("--------------------------------------------------");
      console.log(`[users] PUBLISHING MFA EMAIL:`);
      console.log(`To:   ${recipient}`);
      console.log(`Body: ${emailBody}`);
      console.log("--------------------------------------------------");

      await js.publish("events.notify.email", jc.encode({
        to: recipient,
        subject: "Action Required: Set up your MFA Access",
        body: emailBody
      }));
      console.log(`[users] MFA Notification event published for ${userId}`);
    } catch (notifyErr) {
      console.error("[users] Failed to publish notification:", notifyErr.message);
    }

    msg.respond(jc.encode({
      ok: true,
      status: 200,
      message: "User approved successfully",
      data: { userId, mfaLink: finalMfaLink }
    }));
  } catch (e) {
    console.error("[users] approve error:", e.message);
    msg.respond(jc.encode({ ok: false, status: 500, message: e.message }));
  }
}

/**
 * mfaSetupLogic
 */
export async function mfaSetupLogic(data, headers = {}) {
  const { uid } = data;
  if (!uid) return { ok: false, status: 400, message: "uid required" };

  // Check DB if user isApproved
  const { rows } = await db.query("SELECT id, isApproved FROM users_access WHERE LOWER(id) = LOWER(?)", [uid]);
  if (!rows.length) return { ok: false, status: 404, message: "User not found in DB" };

  if (!rows[0].isApproved) {
    return { ok: false, status: 403, message: "User is not approved. MFA setup blocked." };
  }

  // 2. Call external MFA service
  try {
    const authUrl = process.env.EXTERNAL_AUTH_URL || "http://18.60.129.12:8080";
    const extRes = await fetch(`${authUrl}/api/mfa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": headers.authorization || headers.Authorization || "" },
      body: JSON.stringify({ uid })
    });
    
    const extData = await extRes.json().catch(() => ({}));
    if (extRes.ok) return { ok: true, status: 200, data: extData.data || extData };
    throw new Error(extData.message || "External MFA setup failed");
  } catch (err) {
    console.warn(`[users] MFA Setup Fallback for ${uid}:`, err.message);
    
    // Generate REAL TOTP Secret
    const secret = speakeasy.generateSecret({ name: `IGA Platform (${uid})` });
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    await db.query("UPDATE users_access SET mfa_secret = ?, isApproved = TRUE, status = 'ACTIVE' WHERE id = ?", [secret.base32, uid]);
    
    return { 
      ok: true, 
      status: 200, 
      data: { 
        qrCode: qrCodeDataUrl, 
        secret: secret.base32,
        isFallback: true
      } 
    };
  }
}

export async function handleMfaSetup(msg) {
  try {
    const envelope = jc.decode(msg.data);
    const data = envelope.body || envelope;
    const result = await mfaSetupLogic(data, envelope.headers || {});
    msg.respond(jc.encode(result));
  } catch (e) {
    console.error("[users] mfa setup error:", e.message);
    msg.respond(jc.encode({ ok: false, status: 500, message: e.message }));
  }
}


/**
 * mfaVerifyLogic
 */
export async function mfaVerifyLogic(data, token = null, headers = {}) {
  const { uid, code } = data;
  console.log(`[users] mfaVerifyLogic for ${uid}`);

  if (!uid || !code) return { ok: false, status: 400, message: "uid and code required" };

  // 1. Check DB first
  const { rows } = await db.query("SELECT id, isApproved, mfa_secret FROM users_access WHERE LOWER(id) = LOWER(?)", [uid]);
  if (!rows.length) return { ok: false, status: 404, message: "User not found in DB" };
  
  if (rows[0].mfa_secret && rows[0].mfa_secret !== 'LOCAL_FALLBACK_ACTIVE') {
    const verified = speakeasy.totp.verify({
      secret: rows[0].mfa_secret,
      encoding: 'base32',
      token: code,
      window: 1 // Allow 30s clock drift
    });

    if (verified) {
      console.log(`[users] Local TOTP verified for ${uid}`);
      return { ok: true, status: 200, data: { message: "MFA verified locally" } };
    } else {
      return { ok: false, status: 401, message: "Invalid MFA code" };
    }
  }

  const authHeader = headers.authorization || headers.Authorization || "";

  // 2. Call external MFA service
  try {
    const authUrl = process.env.EXTERNAL_AUTH_URL || "http://18.60.129.12:8080";
    const extRes = await fetch(`${authUrl}/api/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({ uid, code })
    });
    
    const extData = await extRes.json().catch(() => ({}));
    if (extRes.ok) return { ok: true, status: 200, data: extData.data || extData };
    throw new Error(extData.message || "External MFA verify failed");
  } catch (err) {
    console.error(`[users] MFA Verify Fallback check failed for ${uid}:`, err.message);
    return { ok: false, status: 502, message: "MFA Service unreachable and no local fallback found" };
  }
}

export async function handleMfaVerify(msg) {
  try {
    const envelope = jc.decode(msg.data);
    const data = envelope.body || envelope;
    const result = await mfaVerifyLogic(data, envelope.token, envelope.headers || {});
    msg.respond(jc.encode(result));
  } catch (e) {
    console.error("[users] mfa verify error:", e.message);
    msg.respond(jc.encode({ ok: false, status: 500, message: e.message }));
  }
}


/**
 * loginPrimaryLogic - core authentication logic
 */

export async function loginPrimaryLogic(data) {
  const { uid, password } = data;
  console.log(`[users] loginPrimaryLogic for uid=${uid}`);

  if (!uid || !password) return { ok: false, status: 400, message: "uid and password required" };

  // Only block if record exists AND is explicitly unapproved
  const { rows } = await db.query(
    "SELECT id, isApproved, status FROM users_access WHERE LOWER(id) = LOWER(?)",
    [uid]
  );
  if (rows.length && rows[0].isApproved === 0 && rows[0].status !== 'ACTIVE') {
    return { ok: false, status: 403, message: "User is not approved by administrator." };
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({ uid, password });
    
    const options = {
      hostname: "18.60.129.12",
      port: 8080,
      path: "/api/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "User-Agent": "Node-IGA-Backend",
        "Accept": "application/json"
      },
      timeout: 15000,
      family: 4 // Force IPv4 to prevent hanging
    };

    console.log(`[users] Native HTTP calling: http://${options.hostname}:${options.port}${options.path}`);

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          console.log(`[users] Native HTTP result: ${res.statusCode}`);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: 200, data: parsed.data || parsed });
          } else {
            resolve({ ok: false, status: res.statusCode, message: parsed.message || "External auth failed" });
          }
        } catch (e) {
          resolve({ ok: false, status: 502, message: "Invalid response from auth server" });
        }
      });
    });

    req.on("error", (err) => {
      console.error("[users] Native HTTP error:", err.message);
      resolve({ ok: false, status: 502, message: "External auth server unreachable" });
    });

    req.on("timeout", () => {
      req.destroy();
      console.error("[users] Native HTTP timeout");
      resolve({ ok: false, status: 504, message: "External auth server timed out" });
    });

    req.write(postData);
    req.end();
  });
}

export async function handleLoginPrimary(msg) {
  try {
    const envelope = jc.decode(msg.data);
    const data = envelope.body || envelope;

    const result = await loginPrimaryLogic(data);
    msg.respond(jc.encode(result));
  } catch (e) {
    console.error("[users] login primary error:", e.message);
    msg.respond(jc.encode({ ok: false, status: 500, message: e.message }));
  }
}

