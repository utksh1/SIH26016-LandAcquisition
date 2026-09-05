-- SIH26016 MVP: Mock eHRMS Users table and initial seeded government employees.
-- Apply with: psql "$DATABASE_URL" -f db/migrations/002_ehrms_users.sql

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the five demo government employees for eHRMS authentication
INSERT INTO users (employee_id, name, designation, department, role)
VALUES
    ('EMP001', 'Raj Sharma', 'Collector', 'District Administration', 'COLLECTOR'),
    ('EMP002', 'Amit Verma', 'Revenue Officer', 'Revenue Department', 'REVENUE_OFFICER'),
    ('EMP003', 'Neha Singh', 'GIS Officer', 'Survey Department', 'GIS_OFFICER'),
    ('EMP004', 'Ravi Kumar', 'Finance Officer', 'Finance Department', 'FINANCE_OFFICER'),
    ('EMP005', 'Suresh Patel', 'Rehabilitation Officer', 'R&R Department', 'REHABILITATION_OFFICER'),
    ('EMP006', 'Praveen Singhal', 'Chief Project Officer', 'Land Requiring Body (NHAI)', 'LAND_REQUIRING_BODY'),
    ('EMP007', 'Dr. Arvinder Roy', 'SIA Officer', 'Social Impact Assessment Unit', 'SIA_OFFICER'),
    ('EMP008', 'Harish Meena', 'Additional Collector', 'District Collectorate / CALA', 'ADDITIONAL_COLLECTOR'),
    ('EMP009', 'Adv. Madhav Joshi', 'Legal Officer', 'Legal & Litigation Cell', 'LEGAL_OFFICER'),
    ('EMP010', 'Meenakshi Sundaram', 'Joint Secretary / Reviewer', 'Appropriate Government / Oversight', 'GOVERNMENT_REVIEWER')
ON CONFLICT (employee_id) DO UPDATE SET
    name = EXCLUDED.name,
    designation = EXCLUDED.designation,
    department = EXCLUDED.department,
    role = EXCLUDED.role;
