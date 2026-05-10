import { db } from './src/db/client.js';

async function test() {
  const { rows } = await db.query(`
       SELECT
         ar.id,
         ar.user_id,
         u.full_name AS user_name,
         ar.application_id,
         a.app_name AS application_name,
         ar.requested_role AS role_name,
         ar.justification,
         ar.status,
         ar.approver_id,
         appr.full_name AS approver_name,
         ar.created_at AS submitted_at,
         ar.approved_at AS decided_at
       FROM access_requests ar
       LEFT JOIN users u ON ar.user_id = u.id
       LEFT JOIN applications a ON ar.application_id = a.id
       LEFT JOIN users appr ON ar.approver_id = appr.id
  `);
  console.log(rows);
  process.exit(0);
}
test();
