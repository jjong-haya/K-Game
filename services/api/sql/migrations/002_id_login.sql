-- Add username and password columns for ID-based login

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'username');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN username VARCHAR(50) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'password_hash');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add unique index on username
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_username');
SET @sql = IF(@idx_exists = 0, 'CREATE UNIQUE INDEX idx_users_username ON users(username)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
