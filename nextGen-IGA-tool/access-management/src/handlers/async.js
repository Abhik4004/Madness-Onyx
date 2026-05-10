import { jc, getNats } from "../nats/connector.js";
import { db } from "../db/client.js";
import { randomUUID } from "crypto";
import { evaluateRules } from "../rules/engine.js";
import { SUBJECTS } from "../../../event-manager/constants.js";
import { logActivity } from "./sync.js";

async function callExternalAddUser(userId, groupCn) {
  const authUrl = process.env.EXTERNAL_AUTH_URL || "http://18.60.129.12:8080";
  const url = `${authUrl}/api/adduser/group`;

  const payload = { uid: userId, groupCn: groupCn };

  console.log(`[external-api] Adding user '${userId}' to group '${groupCn}'...`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    console.log(`[external-api] Response for ${userId}:`, JSON.stringify(data));
  } catch (e) {
    console.error(`[external-api] Failed to add user ${userId} to ${groupCn}:`, e.message);
  }
}

async function publishLdapEvent(action, { userId, resourceId, requestId }) {
  const { js } = getNats();
  const subject = action === "grant" ? SUBJECTS.LDAP_GRANT : SUBJECTS.LDAP_REVOKE;

  if (action === "grant") {
    await callExternalAddUser(userId, resourceId);
  }

  await js.publish(subject, jc.encode({
    action,
    userId,
    resourceId,
    requestId,
    timestamp: Date.now(),
  }));
  
  // Also publish domain events
  const domainSubject = action === "grant" ? SUBJECTS.ACCESS_GRANTED : SUBJECTS.ACCESS_REVOKED;
  await js.publish(domainSubject, jc.encode({ userId, resourceId, requestId }));
}

async function getManagerId(userId) {
  const { rows } = await db.query(`SELECT manager_id FROM users_access WHERE LOWER(id) = LOWER(?)`, [userId]);
  const raw = rows[0]?.manager_id ?? null;
  if (!raw) return null;
  // Resolve LDAP DN "uid=jsmith,ou=users,..." -> "jsmith"
  if (raw.includes('uid=')) {
    const match = raw.match(/uid=([^,]+)/i);
    return match ? match[1] : raw;
  }
  return raw;
}

async function notifyManager(managerId, requestId, applicantId) {
  if (!managerId) return;
  // Look up manager email from DB
  const { rows } = await db.query(`SELECT email, full_name FROM users_access WHERE LOWER(id) = LOWER(?)`, [managerId]);
  const mgrEmail = rows[0]?.email || `${managerId}@nextgen-iga.com`;
  const { js } = getNats();
  await js.publish(SUBJECTS.NOTIFY_EMAIL, jc.encode({
    userId: managerId,
    to: mgrEmail,
    subject: "Action Required: Access Approval Needed",
    body: `A new access request (${requestId}) from ${applicantId} is awaiting your approval.\n\nPlease log in to the dashboard to review and take action.`,
    type: "approval"
  }));
}

export async function handleRequestCreate(msg) {
  const envelope = jc.decode(msg.data);
  const {
    resourceId,
    role_id = "",
    role_name = "",
    application_name = "",
    justification,
    duration,
    targetUserId,
  } = envelope.body ?? {};

  try {
    const id = randomUUID();
    const requesterId = envelope.userId;
    const requesteeId = targetUserId || envelope.userId;

    await db.query(
      `INSERT INTO access_requests
         (id, user_id, target_user_id, application_id, application_name, role_id, role_name,
          justification, duration_seconds, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [
        id,
        requesterId,
        requesteeId,
        resourceId,
        application_name,
        role_id,
        role_name,
        justification,
        duration ?? null,
      ],
    );

    const ctx = {
      userId:        requesteeId,
      requesterId:   requesterId,
      role:          envelope.role,
      resourceId,
      duration:      Number(duration ?? 0),
      justification: justification ?? "",
    };

    const matchedRule = await evaluateRules(ctx);

    if (matchedRule) {
      await db.query(
        `UPDATE access_requests
         SET status = 'APPROVED', review_note = ?, decided_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [`Auto-approved by rule: ${matchedRule.name}`, id],
      );

      const ldapGroup = matchedRule.action?.ldap_group ?? resourceId;
      await publishLdapEvent("grant", {
        userId: requesteeId,
        resourceId: ldapGroup,
        requestId: id,
      });

      console.log(`[async] auto-approved ${id} via rule "${matchedRule.name}"`);
    } else {
      const managerId = await getManagerId(requesteeId);

      await db.query(
        `UPDATE access_requests
         SET assigned_approver_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [managerId, id],
      );

      await notifyManager(managerId, id, requesteeId);
      console.log(
        `[async] request ${id} assigned to manager:${managerId ?? "none"}`,
      );
    }

    msg.ack();
  } catch (e) {
    console.error("[async] create error:", e.message);
    msg.nak();
  }
}

export async function handleRequestUpdate(msg) {
  const envelope = jc.decode(msg.data);
  const requestId = envelope.path.split("/").pop();
  const { status, reviewNote } = envelope.body ?? {};

  console.log(`[async] Received Request Update: ${requestId} -> ${status} [User: ${envelope.userId}, Role: ${envelope.role}]`);

  const VALID = new Set(["approved", "rejected", "cancelled"]);
  if (!VALID.has((status ?? "").toLowerCase())) {
    console.warn(`[async] Invalid status: ${status}`);
    return msg.ack();
  }

  const normalised = status.toUpperCase();

  try {
    const { rows } = await db.query(
      `SELECT target_user_id, application_id, status AS current_status, assigned_approver_id, duration_seconds
       FROM access_requests WHERE id = ?`,
      [requestId]
    );

    if (!rows.length) return msg.ack();

    const {
      target_user_id: userId,
      application_id: resourceId,
      current_status,
      assigned_approver_id,
      duration_seconds
    } = rows[0];

    // RBAC: only assigned manager OR admin
    if (envelope.role !== "admin" && assigned_approver_id && envelope.userId !== assigned_approver_id) {
      return msg.ack();
    }

    const now = new Date();
    let validTill = null;
    if (normalised === "APPROVED" && duration_seconds) {
      validTill = new Date(now.getTime() + (duration_seconds * 1000));
    }

    await db.query(
      `UPDATE access_requests
       SET status = ?, review_note = ?, approver_id = ?,
           approved_at = ?, decided_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [normalised, reviewNote ?? null, envelope.userId, (normalised === 'APPROVED' ? now : null), requestId]
    );

    await logActivity(`REQUEST_${normalised}`, envelope.userId, envelope.userId, requestId, { status: normalised, reviewNote });

    if (normalised === "APPROVED") {
      // 1. Grant LDAP
      await publishLdapEvent("grant", { userId, resourceId, requestId });
      
      // 2. Insert into user_access with TIMER info
      await db.query(
        `INSERT INTO user_access (id, user_id, application_id, access_type, status, valid_from, valid_to, approved_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = 'ACTIVE', valid_from = VALUES(valid_from), valid_to = VALUES(valid_to), approved_at = VALUES(approved_at)`,
        [randomUUID(), userId, resourceId, 'NORMAL', now, validTill, now]
      );
      
      // 3. Publish Timer Event
      if (validTill) {
        const { js } = getNats();
        await js.publish(SUBJECTS.ACCESS_TIMER_STARTED, jc.encode({ userId, resourceId, requestId, expires_at: validTill }));
      }
    } else if (normalised === "REJECTED" || normalised === "CANCELLED") {
      if (current_status === "APPROVED") {
        await publishLdapEvent("revoke", { userId, resourceId, requestId });
        await db.query("UPDATE user_access SET status = 'REVOKED' WHERE user_id = ? AND application_id = ?", [userId, resourceId]);
      }
    }

    msg.ack();
  } catch (e) {
    console.error("[async] update error:", e.message);
    msg.nak();
  }
}

export async function handleTimeRevoke(msg) {
  const envelope = jc.decode(msg.data);
  const id = envelope.path.split("/").pop();

  try {
    const { rows } = await db.query(
      `SELECT user_id, application_id AS resource_id FROM user_access WHERE id = ?`,
      [id]
    );

    if (!rows.length) return msg.ack();

    const { user_id: userId, resource_id: resourceId } = rows[0];

    await db.query(`UPDATE user_access SET status = 'REVOKED' WHERE id = ?`, [id]);
    await publishLdapEvent("revoke", { userId, resourceId, requestId: id });
    await logActivity("ACCESS_REVOKED", envelope.userId || "SYSTEM", envelope.userId || "SYSTEM", id, { userId, resourceId });

    msg.ack();
  } catch (e) {
    console.error("[async] time.revoke error:", e.message);
    msg.nak();
  }
}
