import { db } from '../src/db/client.js';

async function seed() {
  try {
    const { rows: users } = await db.query('SELECT id FROM users LIMIT 15');
    const { rows: apps } = await db.query('SELECT id FROM applications LIMIT 5');

    if (!users.length || !apps.length) {
      console.log('No users or apps found. Please create some first.');
      process.exit(0);
    }

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const app = apps[i % apps.length];
      
      await db.query(
        'INSERT INTO user_access (user_id, application_id, status, access_type, granted_at) VALUES (?, ?, "ACTIVE", "REGULAR", NOW())',
        [user.id, app.id]
      );
      console.log(`Granted access for ${user.id} to ${app.id}`);
    }

    console.log('Successfully seeded dummy access data!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
}

seed();
