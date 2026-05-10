import { db } from './src/db/client.js';

async function seed() {
  try {
    await db.query(`
      INSERT INTO users (id, full_name, email, role_id) 
      VALUES ('admin', 'System Admin', 'admin@example.com', 'admin') 
      ON CONFLICT DO NOTHING;
    `);
    await db.query(`
      INSERT INTO users (id, full_name, email, role_id) 
      VALUES ('jdoe', 'John Doe', 'jdoe@example.com', 'end_user') 
      ON CONFLICT DO NOTHING;
    `);
    
    await db.query(`
      INSERT INTO applications (id, app_name) 
      VALUES ('res-s3-prod', 'AWS S3 Production') 
      ON CONFLICT DO NOTHING;
    `);
    console.log('Seeding successful');
  } catch (err) {
    console.error('Seeding failed', err);
  } finally {
    process.exit(0);
  }
}
seed();
