// src/jobs/precomputeJob.js
const cron = require('node-cron');
const { transaction } = require('../db/pool');
const logger = require('../utils/logger');

async function refreshPrecomputedTable() {
  try {
    logger.info('Starting precompute job...');

    await transaction(async (conn) => {
      // 0. Ensure base table exists
      await conn.query(`
        CREATE TABLE IF NOT EXISTS role_access_summary (
          role_id VARCHAR(50),
          manager_id VARCHAR(255),
          total_people INT,
          access_type VARCHAR(50),
          users_with_access INT,
          risk_level VARCHAR(50),
          requestable_by VARCHAR(50),
          PRIMARY KEY (role_id, manager_id, access_type)
        )
      `);

      // 1. Create new table with same structure
      await conn.query(`DROP TABLE IF EXISTS role_access_summary_new`);
      await conn.query(`
        CREATE TABLE role_access_summary_new LIKE role_access_summary;
      `);

      // 2. Insert computed data into NEW table
      await conn.query(`
        INSERT INTO role_access_summary_new
        (role_id, manager_id, total_people, access_type, users_with_access, risk_level, requestable_by)
        SELECT 
            r.id AS role_id,
            COALESCE(u.manager_id, 'NO_MANAGER') AS manager_id,
            (SELECT COUNT(*) FROM users_access u2 WHERE u2.role_id = r.id AND COALESCE(u2.manager_id, 'NO_MANAGER') = COALESCE(u.manager_id, 'NO_MANAGER')) AS total_people,
            COALESCE(ua.application_id, 'NO_ACCESS') AS access_type,
            COUNT(DISTINCT ua.user_id) AS users_with_access,
            MAX(ac.risk_level) AS risk_level,
            MAX(ac.approval_required) AS requestable_by
        FROM users_access u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN user_access ua ON u.id = ua.user_id AND ua.status = 'ACTIVE'
        LEFT JOIN access_catalog ac ON ua.application_id = ac.id
        GROUP BY r.id, manager_id, access_type;
      `);

      // 3. Swap tables (atomic)
      await conn.query(`DROP TABLE IF EXISTS role_access_summary_old`);
      await conn.query(`
        RENAME TABLE 
          role_access_summary TO role_access_summary_old,
          role_access_summary_new TO role_access_summary;
      `);

      // 4. Drop old table
      await conn.query(`
        DROP TABLE role_access_summary_old;
      `);
    });

    logger.info('Precompute table refreshed safely');

  } catch (err) {
    logger.error('Precompute job failed', err);
  }
}

function startPrecomputeJob() {
  // Runs every 5 minutes
  cron.schedule('*/1 * * * *', refreshPrecomputedTable);
  logger.info('Precompute cron job scheduled (every 1 min)');
}

module.exports = { startPrecomputeJob, refreshPrecomputedTable };