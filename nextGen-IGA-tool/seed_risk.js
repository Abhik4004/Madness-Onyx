const { db } = require('./access-management/src/db/client.js');

async function run() {
  try {
    console.log('Connecting to DB...');
    // Seed risk scores for all items that don't have one
    const result = await db.query(`
      UPDATE certification_items 
      SET 
        risk_score = CASE 
          WHEN application_id = 'aws' THEN 82
          WHEN application_id = 'github' THEN 64
          WHEN application_id = 'salesforce' THEN 48
          WHEN application_id = 'slack' THEN 31
          ELSE (30 + FLOOR(RAND() * 50))
        END,
        recommended_action = CASE 
          WHEN application_id = 'aws' THEN 'REVIEW'
          WHEN application_id = 'github' THEN 'REVIEW'
          WHEN application_id = 'salesforce' THEN 'RETAIN'
          WHEN application_id = 'slack' THEN 'RETAIN'
          ELSE IF((30 + FLOOR(RAND() * 50)) > 60, 'REVIEW', 'RETAIN')
        END
    `);
    console.log(`Successfully updated ${result.affectedRows || result.rows?.affectedRows || 'all'} certification items with mock risk scores.`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding risk scores:', err);
    process.exit(1);
  }
}

run();
