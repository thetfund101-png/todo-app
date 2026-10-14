CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT chk_users_failed_attempts CHECK (failed_login_attempts <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_categories_name (name),
  CONSTRAINT fk_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('todo', 'in-progress', 'completed', 'on-hold') NOT NULL DEFAULT 'todo',
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  category_id CHAR(36) NOT NULL,
  due_date DATE NULL,
  completed_at DATETIME(3) NULL,
  created_by CHAR(36) NOT NULL,
  assigned_to CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  KEY idx_tasks_status (status),
  KEY idx_tasks_due_date (due_date),
  KEY idx_tasks_assigned_to (assigned_to),
  KEY idx_tasks_created_by (created_by),
  KEY idx_tasks_category_id (category_id),
  CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_tasks_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_tasks_title CHECK (CHAR_LENGTH(TRIM(title)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subtasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  task_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_subtasks_task_position (task_id, position),
  CONSTRAINT fk_subtasks_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT chk_subtasks_title CHECK (CHAR_LENGTH(TRIM(title)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE follow_ups (
  id CHAR(36) NOT NULL PRIMARY KEY,
  task_id CHAR(36) NOT NULL,
  follow_up_date DATE NOT NULL,
  note VARCHAR(1000) NOT NULL DEFAULT '',
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  KEY idx_follow_ups_task_date (task_id, follow_up_date),
  KEY idx_follow_ups_date_done (follow_up_date, is_done),
  CONSTRAINT fk_follow_ups_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  family_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  replaced_by CHAR(36) NULL,
  user_agent VARCHAR(500) NOT NULL DEFAULT '',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_family (family_id),
  KEY idx_refresh_tokens_user (user_id),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_replaced_by FOREIGN KEY (replaced_by) REFERENCES refresh_tokens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_settings (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  theme ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system',
  default_priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  default_category_id CHAR(36) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_settings_category FOREIGN KEY (default_category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id CHAR(36) NULL,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_logs_created_at (created_at),
  KEY idx_audit_logs_user_created (user_id, created_at),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
