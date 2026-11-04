-- Phase 3 of the Arogya feature port: report values + trends, health
-- tracking, report sharing, technician leaves/salary, holidays, staff
-- alerts, push device tokens, phone OTP, Google and passkey sign-in.
SET NAMES utf8mb4;

-- Catalogue details used by insights, abnormal flags and booking prep notes
ALTER TABLE tests
  ADD COLUMN category VARCHAR(50) NULL,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN preparation_instructions TEXT NULL,
  ADD COLUMN normal_range_low DECIMAL(10,2) NULL,
  ADD COLUMN normal_range_high DECIMAL(10,2) NULL,
  ADD COLUMN normal_range_unit VARCHAR(30) NULL;

-- Google accounts may sign up without a phone; they add it before booking
ALTER TABLE users
  MODIFY phone VARCHAR(15) NULL,
  ADD COLUMN google_sub VARCHAR(64) NULL UNIQUE,
  ADD COLUMN monthly_salary DECIMAL(10,2) NULL;

CREATE TABLE report_values (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  test_id INT UNSIGNED NULL,
  test_name VARCHAR(150) NOT NULL,          -- copied so renames don't change old results
  category VARCHAR(50) NULL,
  value DECIMAL(12,3) NOT NULL,
  unit VARCHAR(30) NULL,
  normal_low DECIMAL(10,2) NULL,
  normal_high DECIMAL(10,2) NULL,
  is_abnormal TINYINT(1) NOT NULL DEFAULT 0, -- computed once at write time
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL,
  INDEX idx_rv_appt (appointment_id)
) ENGINE=InnoDB;

CREATE TABLE report_shares (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  token CHAR(43) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE vital_readings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NULL,
  type ENUM('BP','SUGAR_FASTING','SUGAR_RANDOM','WEIGHT','PULSE') NOT NULL,
  value DECIMAL(7,2) NOT NULL,              -- systolic for BP
  value2 DECIMAL(7,2) NULL,                 -- diastolic for BP only
  recorded_at DATETIME NOT NULL,
  note VARCHAR(200) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
  INDEX idx_vitals (user_id, type, recorded_at)
) ENGINE=InnoDB;

CREATE TABLE health_goals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  metric VARCHAR(80) NOT NULL,              -- a vital type, or "test:<id>"
  label VARCHAR(100) NOT NULL,
  direction ENUM('BELOW','ABOVE') NOT NULL,
  target DECIMAL(8,2) NOT NULL,
  unit VARCHAR(20) NULL,
  start_value DECIMAL(8,2) NULL,
  target_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE medicines (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  dosage VARCHAR(80) NULL,
  brand VARCHAR(80) NULL,
  timings SET('MORNING','AFTERNOON','EVENING','NIGHT') NULL,
  food ENUM('BEFORE','AFTER') NULL,
  reminder TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One retest reminder per (patient, test, result date)
CREATE TABLE retest_reminders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  test_id INT UNSIGNED NOT NULL,
  last_tested_at DATETIME NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_retest (user_id, test_id, last_tested_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE leaves (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type VARCHAR(50) NOT NULL,
  reason TEXT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE holidays (
  holiday_date DATE PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  source ENUM('MANUAL','GOOGLE') NOT NULL DEFAULT 'MANUAL'
) ENGINE=InnoDB;

CREATE TABLE staff_alerts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,            -- the admin who sees it
  agent_id INT UNSIGNED NOT NULL,
  kind VARCHAR(40) NOT NULL,
  message VARCHAR(300) NOT NULL,
  link VARCHAR(200) NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_alerts (user_id, read_at)
) ENGINE=InnoDB;

CREATE TABLE device_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE otp_challenges (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT NOT NULL DEFAULT 0,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_phone (phone, created_at)
) ENGINE=InnoDB;

CREATE TABLE passkeys (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  credential_id VARBINARY(255) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,                 -- PEM
  sign_count INT UNSIGNED NOT NULL DEFAULT 0,
  label VARCHAR(80) NULL,
  last_used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Reference ranges for the sample tests
UPDATE tests SET category='Blood',   normal_range_low=12,  normal_range_high=17,  normal_range_unit='g/dL', preparation_instructions='No fasting needed.' WHERE code='CBC';
UPDATE tests SET category='Liver',   normal_range_low=7,   normal_range_high=56,  normal_range_unit='U/L (ALT)', preparation_instructions='Fast for 8–10 hours.' WHERE code='LFT';
UPDATE tests SET category='Kidney',  normal_range_low=0.6, normal_range_high=1.3, normal_range_unit='mg/dL (creatinine)', preparation_instructions='Drink water as usual.' WHERE code='KFT';
UPDATE tests SET category='Thyroid', normal_range_low=0.4, normal_range_high=4.0, normal_range_unit='mIU/L', preparation_instructions='Take the sample before thyroid medicine.' WHERE code='TSH';
UPDATE tests SET category='Urine',   preparation_instructions='Collect the first morning sample.' WHERE code='URINE';
