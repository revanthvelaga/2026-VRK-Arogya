-- Phase 1 of the Arogya feature port: packages, centres + pickup points,
-- partner labs, coupons, collection modes. Safe to run once on a fresh
-- install (docker-compose runs it automatically after schema.sql).
SET NAMES utf8mb4;

CREATE TABLE partner_labs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(100) NULL,
  contact_phone VARCHAR(15) NULL,
  default_turnaround_hours INT NOT NULL DEFAULT 24,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE tests
  ADD COLUMN is_in_house TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN partner_lab_id INT UNSIGNED NULL,
  ADD COLUMN turnaround_hours INT NOT NULL DEFAULT 24,
  ADD CONSTRAINT fk_tests_lab FOREIGN KEY (partner_lab_id) REFERENCES partner_labs(id);

CREATE TABLE packages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL,
  tier ENUM('BASIC','STANDARD','PREMIUM') NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE package_tests (
  package_id INT UNSIGNED NOT NULL,
  test_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (package_id, test_id),
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE centers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address TEXT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  service_radius_km DECIMAL(5,2) NOT NULL DEFAULT 20,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE pickup_points (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  village_name VARCHAR(150) NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  distance_km DECIMAL(6,2) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pickup_point_schedules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pickup_point_id INT UNSIGNED NOT NULL,
  day_of_week TINYINT NOT NULL,           -- 0=Sunday ... 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  FOREIGN KEY (pickup_point_id) REFERENCES pickup_points(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE coupons (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  description VARCHAR(200) NOT NULL,
  discount_type ENUM('PERCENT','FLAT') NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  max_discount DECIMAL(10,2) NULL,
  min_order DECIMAL(10,2) NOT NULL DEFAULT 0,
  valid_until DATETIME NULL,
  usage_limit INT NULL,
  per_customer_limit INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE appointments
  ADD COLUMN collection_mode ENUM('HOME_VISIT','PICKUP_POINT','WALK_IN') NOT NULL DEFAULT 'HOME_VISIT',
  ADD COLUMN pickup_point_id INT UNSIGNED NULL,
  ADD COLUMN subtotal DECIMAL(10,2) NULL,
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN coupon_code VARCHAR(30) NULL,
  ADD CONSTRAINT fk_appt_pickup FOREIGN KEY (pickup_point_id) REFERENCES pickup_points(id);

ALTER TABLE appointment_items
  MODIFY test_id INT UNSIGNED NULL,
  ADD COLUMN package_id INT UNSIGNED NULL,
  ADD CONSTRAINT fk_item_pkg FOREIGN KEY (package_id) REFERENCES packages(id);

-- Sample data
INSERT INTO packages (name, description, price, tier) VALUES
('Basic Health Checkup', 'CBC, urine routine and thyroid', 649.00, 'BASIC'),
('Full Body Checkup', 'CBC, LFT, KFT, TSH and urine routine', 1499.00, 'STANDARD');
INSERT INTO package_tests (package_id, test_id)
  SELECT 1, id FROM tests WHERE code IN ('CBC','TSH','URINE');
INSERT INTO package_tests (package_id, test_id)
  SELECT 2, id FROM tests WHERE code IN ('CBC','LFT','KFT','TSH','URINE');
INSERT INTO coupons (code, description, discount_type, value, max_discount, min_order, per_customer_limit)
VALUES ('FIRST20', '20% off your first booking (up to ₹300)', 'PERCENT', 20, 300, 300, 1);
