const { query } = require('../db/pool');

/**
 * Persists an activity log to the centralized system_logs table.
 * Used by recommendation service to ensure E2E audit trail.
 */
async function logActivity(eventType, actorId, actorName, targetId, payload = {}) {
  try {
    const sql = `
      INSERT INTO system_logs (event_type, entity_type, entity_id, actor_id, payload, status, source_service)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      eventType,
      'RECOMMENDATION',
      targetId,
      actorId,
      JSON.stringify(payload),
      payload.status || 'SUCCESS',
      'recommendation-service'
    ];
    
    await query(sql, params);
  } catch (err) {
    console.error(`[activity-logger] Failed to log ${eventType}:`, err.message);
  }
}

module.exports = { logActivity };
