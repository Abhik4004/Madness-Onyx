const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const logger = require('../utils/logger');

// ─── AI Insights ─────────────────────────────────────────────────────────────
router.get('/insights', async (req, res) => {
  try {
    // Basic DB-backed "AI" logic: Find users without managers, roles with too many members, etc.
    const noManagerRows = await query("SELECT COUNT(*) as count FROM users_access WHERE manager_id IS NULL AND status = 'ACTIVE'");
    const noManager = noManagerRows[0] || { count: 0 };
    
    const overprivileged = await query(`
      SELECT access_type, COUNT(*) as count 
      FROM user_access 
      WHERE status = 'ACTIVE' 
      GROUP BY access_type 
      HAVING count > 10
    `);

    const insights = [];
    if (noManager.count > 0) {
      insights.push({
        id: 'ins_1',
        category: 'Hierarchy',
        description: `${noManager.count} active users have no manager assigned.`,
        severity: 'MEDIUM',
        recommendation: 'Perform a hierarchy cleanup or LDAP sync.',
        timestamp: new Date().toISOString()
      });
    }

    overprivileged.forEach((p, i) => {
      insights.push({
        id: `ins_op_${i}`,
        category: 'Privilege',
        description: `Entitlement "${p.access_type}" is held by ${p.count} users.`,
        severity: 'LOW',
        recommendation: 'Review if this should be a birthright role or needs tighter certification.',
        timestamp: new Date().toISOString()
      });
    });

    res.json({ ok: true, data: insights });
  } catch (err) {
    logger.error('AI Insights error:', err.message);
    res.status(500).json({ ok: false, message: 'Internal AI Error' });
  }
});

// ─── AI Anomalies ────────────────────────────────────────────────────────────
router.get('/anomalies', async (req, res) => {
  try {
    // Detect anomalies: e.g. users who have 'ACTIVE' status but haven't logged in recently, 
    // or access requests that were approved very quickly
    const inactiveUsersRows = await query("SELECT id, full_name, last_login FROM users_access WHERE status = 'ACTIVE' AND (last_login < NOW() - INTERVAL 30 DAY OR last_login IS NULL) LIMIT 10");
    
    const anomalies = [];
    inactiveUsersRows.forEach((u, i) => {
      anomalies.push({
        id: `anom_inact_${i}`,
        severity: u.last_login ? 'MEDIUM' : 'HIGH',
        description: `Active user "${u.full_name}" has not logged in recently (Last login: ${u.last_login || 'Never'}).`,
        affected_entities: [u.id],
        recommendations: ['Suspend account', 'Trigger micro-certification'],
        categories: ['Security', 'Dormant Account'],
        timestamp: new Date().toISOString()
      });
    });

    res.json({ ok: true, data: anomalies });
  } catch (err) {
    logger.error('AI Anomalies error:', err.message);
    res.status(500).json({ ok: false, message: 'Internal AI Error' });
  }
});

// ─── AI Chat Assistant ───────────────────────────────────────────────────────
router.post('/assistant/chat', async (req, res) => {
  try {
    const { message } = req.body;
    let response_text = "I'm your IGA Assistant. How can I help you today?";
    let suggestions = ["Show me pending requests", "List dormant accounts"];

    if (message.toLowerCase().includes("request") || message.toLowerCase().includes("pending")) {
      const pendingRows = await query("SELECT COUNT(*) as count FROM access_requests WHERE status = 'PENDING'");
      response_text = `There are currently ${pendingRows[0].count} pending access requests requiring attention in the system.`;
    } else if (message.toLowerCase().includes("risk") || message.toLowerCase().includes("dormant")) {
      const dormantRows = await query("SELECT COUNT(*) as count FROM users_access WHERE status = 'ACTIVE' AND (last_login < NOW() - INTERVAL 30 DAY OR last_login IS NULL)");
      response_text = `Found ${dormantRows[0].count} active users with dormant accounts (no login in 30+ days).`;
    }

    res.json({
      ok: true,
      data: {
        response_text,
        suggestions,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    logger.error('AI Chat error:', err.message);
    res.status(500).json({ ok: false, message: 'Internal AI Error' });
  }
});

// ─── AI Reports ──────────────────────────────────────────────────────────────
const reportStore = {}; // in-memory store keyed by report_id

router.get('/reports', async (req, res) => {
  const list = Object.values(reportStore).map(r => ({
    report_id: r.report_id, id: r.report_id,
    title: r.title, type: r.type, generated_at: r.generated_at
  }));
  res.json({ ok: true, reports: list });
});

router.post('/reports/generate', async (req, res) => {
  try {
    const { query: q = 'governance summary', user_id } = req.body;

    const [pending, approved, rejected, total, dormant] = await Promise.all([
      query("SELECT COUNT(*) as c FROM access_requests WHERE status='PENDING'"),
      query("SELECT COUNT(*) as c FROM access_requests WHERE status='APPROVED'"),
      query("SELECT COUNT(*) as c FROM access_requests WHERE status='REJECTED'"),
      query("SELECT COUNT(*) as c FROM users_access WHERE status='ACTIVE'"),
      query("SELECT COUNT(*) as c FROM users_access WHERE status='ACTIVE' AND (last_login < NOW() - INTERVAL 30 DAY OR last_login IS NULL)")
    ]);

    const records = await query(`
      SELECT ar.id as request_id, ar.requester_id, ar.resource_id, ar.status,
             ar.created_at, ua.full_name, ua.role_id
      FROM access_requests ar
      LEFT JOIN users_access ua ON ua.id = ar.requester_id
      ORDER BY ar.created_at DESC LIMIT 50
    `);

    const report_id = 'rep_' + Date.now();
    const report = {
      report_id,
      id: report_id,
      title: `Governance Report: ${q.slice(0, 60)}`,
      type: 'GOVERNANCE_SUMMARY',
      header: `Generated for user ${user_id || 'system'} on ${new Date().toISOString()}`,
      summary: `Active users: ${total[0].c}. Pending requests: ${pending[0].c}. Approved: ${approved[0].c}. Rejected: ${rejected[0].c}. Dormant accounts: ${dormant[0].c}.`,
      findings: [
        `${pending[0].c} access requests are awaiting approval.`,
        `${dormant[0].c} active users have not logged in for 30+ days.`,
        `${rejected[0].c} requests were rejected in this period.`
      ],
      recommendations: [
        'Review and action all pending access requests promptly.',
        'Initiate micro-certifications for dormant accounts.',
        'Audit rejected requests for potential policy violations.'
      ],
      risk_sections: [
        { label: 'Dormant Accounts', value: String(dormant[0].c) },
        { label: 'Pending Approvals', value: String(pending[0].c) }
      ],
      detailed_records: records,
      generated_at: new Date().toISOString()
    };

    reportStore[report_id] = report;
    res.json({ ok: true, report_id, report });
  } catch (err) {
    logger.error('Report generate error:', err.message);
    res.status(500).json({ ok: false, message: 'Report generation failed: ' + err.message });
  }
});

router.get('/reports/:id/download', async (req, res) => {
  const r = reportStore[req.params.id];
  if (!r) return res.status(404).json({ ok: false, message: 'Report not found' });
  res.json({ ok: true, report_id: r.report_id, report: r });
});

router.get('/reports/:id', async (req, res) => {
  const r = reportStore[req.params.id];
  if (!r) return res.status(404).json({ ok: false, message: 'Report not found' });
  res.json({ ok: true, report_id: r.report_id, report: r });
});

module.exports = router;
