-- Diagnostics Appointment & Reporting System — MySQL 8 schema
SET NAMES utf8mb4;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('ADMIN','TECHNICIAN','PATIENT') NOT NULL DEFAULT 'PATIENT',
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(150) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  address TEXT NULL,
  dob DATE NULL,
  gender ENUM('M','F','O') NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE api_tokens (
  token CHAR(64) PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NULL,
  name VARCHAR(150) NOT NULL,
  sample_type VARCHAR(50) NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  technician_id INT UNSIGNED NULL,
  scheduled_at DATETIME NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status ENUM('BOOKED','ASSIGNED','ON_WAY','SAMPLE_COLLECTED','REPORT_READY','CANCELLED') NOT NULL DEFAULT 'BOOKED',
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status ENUM('PENDING','PAID','REFUNDED') NOT NULL DEFAULT 'PENDING',
  reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES users(id),
  FOREIGN KEY (technician_id) REFERENCES users(id),
  INDEX idx_appt_status (status),
  INDEX idx_appt_sched (scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE appointment_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  test_id INT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id)
) ENGINE=InnoDB;

CREATE TABLE appointment_status_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  status VARCHAR(30) NOT NULL,
  changed_by INT UNSIGNED NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  uploaded_by INT UNSIGNED NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
  gateway_order_id VARCHAR(100) NULL,
  gateway_payment_id VARCHAR(100) NULL,
  status ENUM('CREATED','PAID','FAILED') NOT NULL DEFAULT 'CREATED',
  receipt_no VARCHAR(30) NULL UNIQUE,
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed data. Default admin password: Admin@123  (CHANGE AFTER FIRST LOGIN)
INSERT INTO users (role, full_name, phone, email, password_hash) VALUES
('ADMIN', 'Administrator', '9999999999', 'admin@example.com',
 '$2y$10$t17xlLbzS4cz7P.klUumvOTl.94LDWx1G6iA7/GkEQK0vpyBN3Lq.');

INSERT INTO tests (code, name, sample_type, price) VALUES
('CBC', 'Complete Blood Count', 'Blood', 350.00),
('LFT', 'Liver Function Test', 'Blood', 600.00),
('KFT', 'Kidney Function Test', 'Blood', 550.00),
('TSH', 'Thyroid Stimulating Hormone', 'Blood', 300.00),
('URINE', 'Urine Routine', 'Urine', 150.00);
