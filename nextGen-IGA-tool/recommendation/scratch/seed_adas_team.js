const { query } = require('../src/db/pool.js');

async function seed() {
  try {
    // 1. Move people under adas
    await query("UPDATE users SET manager_id = 'adas' WHERE id IN ('sarah', 'syadav', 'mthompson01')");
    console.log("Moved Sarah, Syadav, MThompson under Adas");

    // 2. Grant them some common access
    const access = [
      ['sarah', 'aws'], ['sarah', 'github'], ['sarah', 'slack'],
      ['syadav', 'aws'], ['syadav', 'github'],
      ['mthompson01', 'aws'], ['mthompson01', 'slack']
    ];

    for (const [uid, app] of access) {
      await query("INSERT INTO user_access (user_id, application_id, status) VALUES (?, ?, 'ACTIVE') ON DUPLICATE KEY UPDATE status='ACTIVE'", [uid, app]);
    }
    console.log("Granted common access to adas team");

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
seed();
