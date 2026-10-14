CREATE TABLE IF NOT EXISTS weekly_plans (
  id CHAR(36) NOT NULL PRIMARY KEY,
  week_start DATE NOT NULL,
  plans TEXT NOT NULL,
  responsible_role VARCHAR(120) NOT NULL,
  responsible_name VARCHAR(120) NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_weekly_plans_week_start_created (week_start, created_at),
  CONSTRAINT fk_weekly_plans_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO weekly_plans (id, week_start, plans, responsible_role, responsible_name, created_by)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY),
    'Implementing the campaign concept for the internship funding window
To cover the foundational institutional strengthening funding window
To film THET TAKE series.',
    'Digital marketing and Branding officer',
    'Mahzouba Maya Faal',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY),
    'Work on procurement tenders; print, get signatures and send to GPPA
To submit grants manual
To work on Ndeban''s borehole installation',
    'Director of programme',
    'Modou Touray',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY),
    'Supporting Director Kumbale: follow up with GICTA
Follow up with Grant Management System
Finalizing the internship funding window (2 days training for interns)
Draft MOU with GRA and Africell impact foundation
Follow up on pledge-a-thon pending payments',
    'Director of education support and workforce development',
    'Yassin Sagnia',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY),
    'Engaged',
    'Director of infrastructure and strategic partnership',
    'Kumbale Goode',
    NULL
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY),
    'Working with Aji for the location of finance files
Reviewing the budget and budget line
Concluded on the VIREMENT',
    'Director of Finance',
    'John Bass',
    NULL
  );
