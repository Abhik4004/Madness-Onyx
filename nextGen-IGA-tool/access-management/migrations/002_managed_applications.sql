-- Managed Applications and LDAP Mappings
CREATE TABLE IF NOT EXISTS managed_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(255) REFERENCES applications(id),
    ldap_group VARCHAR(255) NOT NULL,
    access_group_name VARCHAR(255) NOT NULL, -- The "access management group" mentioned by user
    is_automated BOOLEAN DEFAULT FALSE,
    auto_approve_role VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some managed apps
INSERT INTO managed_applications (app_id, ldap_group, access_group_name, is_automated, auto_approve_role)
SELECT id, 'ldap-dev-group', 'Development Access Group', TRUE, 'developer'
FROM applications WHERE app_name = 'Development'
ON CONFLICT DO NOTHING;

INSERT INTO managed_applications (app_id, ldap_group, access_group_name, is_automated)
SELECT id, 'ldap-hr-group', 'HR System Access Group', FALSE
FROM applications WHERE app_name = 'HR Portal'
ON CONFLICT DO NOTHING;
