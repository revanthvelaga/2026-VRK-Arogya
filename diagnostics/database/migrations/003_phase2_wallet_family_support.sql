-- Phase 2 of the Arogya feature port: wallet + referrals, family members,
-- support tickets, documents/prescriptions. Run once after 002.
SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN referral_code VARCHAR(20) NULL UNIQUE,
  ADD COLUMN referred_by_id INT UNSIGNED NULL,
  ADD COLUMN referral_rewarded_at DATETIME NULL,
  ADD CONSTRAINT fk_users_referrer FOREIGN KEY (referred_by_id) REFERENCES users(id);

CREATE TABLE wallet_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,          -- positive = credit, negative = spend
  reason VARCHAR(200) NOT NULL,
  appointment_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_wallet_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE family_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  relation VARCHAR(40) NOT NULL,
  dob DATE NULL,
  gender ENUM('M','F','O') NULL,
  phone VARCHAR(15) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE appointments
  ADD COLUMN member_id INT UNSIGNED NULL,
  ADD COLUMN wallet_used DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT fk_appt_member FOREIGN KEY (member_id) REFERENCES family_members(id);

CREATE TABLE tickets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NULL,
  raised_by INT UNSIGNED NOT NULL,
  subject VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  resolved_by INT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (raised_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE ticket_comments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT UNSIGNED NOT NULL,
  author_id INT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NULL,
  kind ENUM('PRESCRIPTION','ID','REPORT','OTHER') NOT NULL DEFAULT 'PRESCRIPTION',
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime VARCHAR(60) NOT NULL,
  note VARCHAR(255) NULL,
  status ENUM('PENDING','REVIEWED') NOT NULL DEFAULT 'PENDING',
  admin_note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Referral codes for existing users (new users get one at registration)
UPDATE users SET referral_code = CONCAT('RF', UPPER(SUBSTRING(MD5(CONCAT(id, phone)), 1, 6))) WHERE referral_code IS NULL;
