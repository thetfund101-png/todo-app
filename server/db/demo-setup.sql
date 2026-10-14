CREATE DATABASE IF NOT EXISTS thet_fund_tasks
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'thet_app'@'localhost' IDENTIFIED BY 'test1234';
ALTER USER 'thet_app'@'localhost' IDENTIFIED BY 'test1234';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON thet_fund_tasks.* TO 'thet_app'@'localhost';

CREATE USER IF NOT EXISTS 'thet_app'@'127.0.0.1' IDENTIFIED BY 'test1234';
ALTER USER 'thet_app'@'127.0.0.1' IDENTIFIED BY 'test1234';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON thet_fund_tasks.* TO 'thet_app'@'127.0.0.1';

CREATE USER IF NOT EXISTS 'thet_migrator'@'localhost' IDENTIFIED BY 'admin123';
ALTER USER 'thet_migrator'@'localhost' IDENTIFIED BY 'admin123';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON thet_fund_tasks.* TO 'thet_migrator'@'localhost';

CREATE USER IF NOT EXISTS 'thet_migrator'@'127.0.0.1' IDENTIFIED BY 'admin123';
ALTER USER 'thet_migrator'@'127.0.0.1' IDENTIFIED BY 'admin123';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON thet_fund_tasks.* TO 'thet_migrator'@'127.0.0.1';
