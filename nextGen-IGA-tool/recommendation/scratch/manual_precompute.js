const { transaction } = require('../src/db/pool');
const logger = require('../src/utils/logger');

async function setup() {
  try {
    console.log('Running manual precompute...');
    await transaction(async (conn) => {
      // Create table if not exists (redundant but safe)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS role_access_summary (
          role_id VARCHAR(255),
          manager_id VARCHAR(255),
          total_people INT,
          access_type VARCHAR(100),
          users_with_access INT,
          risk_level VARCHAR(50),
          requestable_by VARCHAR(50),
          PRIMARY KEY (role_id, manager_id, access_type)
        )
      `);

      // Clear and Rebuild
      await conn.query('DELETE FROM role_access_summary');
      
      await conn.query(`
        INSERT INTO role_access_summary
        (role_id, manager_id, total_people, access_type, users_with_access, risk_level, requestable_by)
        SELECT 
            r.id AS role_id,
            COALESCE(u.manager_id, 'NO_MANAGER') AS manager_id,
            COUNT(DISTINCT u.id) AS total_people,
            COALESCE(ua.application_id, 'NO_ACCESS') AS access_type,
            COUNT(DISTINCT CASE WHEN ua.status = 'ACTIVE' THEN u.id END) AS users_with_access,
            'LOW' AS risk_level,
            'SELF' AS requestable_by
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN user_access ua ON u.id = ua.user_id
        GROUP BY r.id, u.manager_id, ua.application_id;
      `);
    });
    console.log('Precompute complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
setup();
