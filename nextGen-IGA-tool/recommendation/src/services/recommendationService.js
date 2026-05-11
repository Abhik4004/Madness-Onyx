const { query } = require('../db/pool');
const logger = require('../utils/logger');
const { getRiskScore } = require('./riskScore');

// ─── Single user fetch (used by single route) ─────────────────
async function getUserForRecommendation(userId) {
  const rows = await query(`
    SELECT u.id, u.role_id, u.manager_id, r.role_type, r.role_name
    FROM users_access u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `, [userId]);

  if (!rows || rows.length === 0) {
    throw Object.assign(
      new Error(`User ${userId} not found or inactive`),
      { code: 'USER_NOT_FOUND', status: 404 }
    );
  }
  return rows[0];
}

// ─── Single access details fetch (used by single route) ───────
async function getAccessDetails(role_id, manager_id, accessType) {
  const sqlQuery = `
    SELECT 
      SUM(CASE WHEN role_id = ? AND manager_id <=> ? THEN total_people ELSE 0 END) AS same_manager_total_people,
      SUM(CASE WHEN role_id = ? AND manager_id <=> ? THEN users_with_access ELSE 0 END) AS same_manager_with_access,
      SUM(CASE WHEN role_id = ? AND NOT (manager_id <=> ?) THEN total_people ELSE 0 END) AS different_manager_total_people,
      SUM(CASE WHEN role_id = ? AND NOT (manager_id <=> ?) THEN users_with_access ELSE 0 END) AS different_manager_with_access,
      MAX(risk_level) AS risk_level,
      MAX(requestable_by) AS requestable_by
    FROM role_access_summary
    WHERE access_type = ?
  `;

  const [result] = await query(sqlQuery, [
    role_id, manager_id,
    role_id, manager_id,
    role_id, manager_id,
    role_id, manager_id,
    accessType
  ]);
  return result;
}

// ─── Batch user fetch (used by bulk route) ────────────────────
// One query for ALL user_ids instead of one per task
async function batchGetUsers(userIds) {
  if (userIds.length === 0) return new Map();

  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await query(`
    SELECT u.id, u.role_id, u.manager_id, r.role_type, r.role_name
    FROM users_access u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id IN (${placeholders}) AND u.status = 'ACTIVE'
  `, userIds);

  // Return as Map for O(1) lookup: userId → user
  const userMap = new Map();
  for (const row of rows) {
    userMap.set(row.id, row);
  }
  return userMap;
}

// ─── Batch access details fetch (used by bulk route) ──────────
// One query per unique accessType (not per task)
// Because ROLE_ACCESS_SUMMARY is grouped by access_type
async function batchGetAccessDetails(tasks, userMap) {
  if (tasks.length === 0) return new Map();

  // Group tasks by accessType — many tasks may share the same role
  // so we only query each unique (role_id, manager_id, accessType) combo once
  const uniqueCombos = new Map();

  for (const task of tasks) {
    const user = userMap.get(task.user_id);
    if (!user) continue;

    const comboKey = `${user.role_id}::${user.manager_id}::${task.requested_role}`;
    if (!uniqueCombos.has(comboKey)) {
      uniqueCombos.set(comboKey, {
        role_id: user.role_id,
        manager_id: user.manager_id,
        accessType: task.requested_role
      });
    }
  }

  // Fetch all unique combos in parallel (still far fewer than N tasks)
  const accessMap = new Map();

  await Promise.all(
    [...uniqueCombos.entries()].map(async ([comboKey, combo]) => {
      try {
        const details = await getAccessDetails(
          combo.role_id,
          combo.manager_id,
          combo.accessType
        );
        accessMap.set(comboKey, details);
      } catch (err) {
        logger.error(`Failed to get access details for ${comboKey}: ${err.message}`);
        accessMap.set(comboKey, null);
      }
    })
  );

  return accessMap;
}

// ─── Single recommendation (single route uses this) ───────────
async function getSingleRecommendation({ userId, accessType, context, mode }) {
  try {
    const user = await getUserForRecommendation(userId);
    const accessDetails = await getAccessDetails(user.role_id, user.manager_id, accessType);

    // ✅ Fixed: pass object as second argument to match getRiskScore signature
    const result = getRiskScore(accessDetails, { userId, accessType, context });
    return result;
  } catch (error) {
    logger.error(error);
    throw error; // re-throw so caller can handle
  }
}

// ─── Bulk recommendation (bulk route uses this) ───────────────
async function getBulkRecommendation({ userId, accessType, context, userMap, accessMap }) {
  const user = userMap.get(userId);

  if (!user) {
    throw Object.assign(
      new Error(`User ${userId} not found or inactive`),
      { code: 'USER_NOT_FOUND' }
    );
  }

  const comboKey = `${user.role_id}::${user.manager_id}::${accessType}`;
  const accessDetails = accessMap.get(comboKey);

  if (!accessDetails) {
    throw new Error(`Access details not found for combo: ${comboKey}`);
  }

  // ✅ Same fixed signature
  const result = getRiskScore(accessDetails, { userId, accessType, context });
  return result;
}

async function getOnboardingRecommendations(userId) {
  const user = await getUserForRecommendation(userId);

  // 1. Get current active access for the user
  const currentAccess = await query(`
    SELECT application_id FROM user_access WHERE user_id = ? AND status = 'ACTIVE'
  `, [userId]);
  const existingSet = new Set(currentAccess.map(a => a.application_id));

  // 2. Suggest common access for this peer group
  let suggestions = await query(`
    SELECT access_type, users_with_access, total_people, risk_level
    FROM role_access_summary
    WHERE role_id = ? AND manager_id = ? 
    AND (users_with_access / total_people) >= 0.5
    AND access_type != 'NO_ACCESS'
  `, [user.role_id, user.manager_id || 'NO_MANAGER']);

  if (!suggestions.length) {
    // Fallback: Global recommendations for this Role if the Team data is insufficient
    suggestions = await query(`
      SELECT 
        access_type, 
        SUM(users_with_access) as users_with_access, 
        SUM(total_people) as total_people, 
        MAX(risk_level) as risk_level
      FROM role_access_summary
      WHERE role_id = ? AND access_type != 'NO_ACCESS'
      GROUP BY access_type
      HAVING (SUM(users_with_access) / SUM(total_people)) >= 0.3
    `, [user.role_id]);
  }

  // 3. Filter out what the user already has and handle division safely
  return suggestions
    .filter(s => !existingSet.has(s.access_type) && s.total_people > 0)
    .map(s => {
      const confidenceRatio = s.users_with_access / s.total_people;
      const confidence = (confidenceRatio * 100).toFixed(0);
      return {
        entitlement: s.access_type,
        confidence,
        risk: s.risk_level || 'low',
        reason: `Commonly held by ${confidence}% of your team members.`
      };
    });
}

async function getTeamOnboardingRecommendations(managerId) {
  const reports = await query(`
    SELECT id, full_name, role_id FROM users_access WHERE manager_id = ? AND status = 'ACTIVE'
  `, [managerId]);

  if (reports.length === 0) return [];

  const results = [];
  for (const user of reports) {
    try {
      const suggestions = await getOnboardingRecommendations(user.id);
      if (suggestions.length > 0) {
        results.push({
          userId: user.id,
          userName: user.full_name,
          suggestions
        });
      }
    } catch (e) {}
  }
  return results;
}

module.exports = {
  getSingleRecommendation,
  getBulkRecommendation,
  getOnboardingRecommendations,
  getTeamOnboardingRecommendations,
  batchGetUsers,
  batchGetAccessDetails
};