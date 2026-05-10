import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:Rij!2004@localhost:5432/onyx"
});

async function seed() {
  try {
    console.log("Seeding data in onyx...");
    
    // 1. Ensure admin user exists
    await pool.query(`
      INSERT INTO users (id, full_name, email, role_id, status)
      VALUES ('admin', 'System Admin', 'admin@nextgen-iga.com', 'admin', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("Admin user checked.");

    // 2. Seed applications
    await pool.query(`
      INSERT INTO applications (id, app_name, app_type, owner_id, risk_level)
      VALUES 
        ('ad_primary', 'Active Directory', 'infrastructure', 'admin', 'HIGH'),
        ('sap_erp', 'SAP ERP', 'business', 'admin', 'HIGH'),
        ('sn_itil', 'ServiceNow', 'it_service', 'admin', 'MEDIUM')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("Applications seeded.");
    
    console.log("Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
