-- Arogya DB Schema (PostgreSQL + PostGIS) — v1

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== USERS & AUTH ==========
CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========== DIAGNOSTIC CENTERS ==========
CREATE TABLE diagnostic_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    address TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,  -- lat/lng
    service_radius_km NUMERIC(5,2) NOT NULL DEFAULT 20,
    owner_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_centers_location ON diagnostic_centers USING GIST (location);

-- ========== PICKUP POINTS (villages/panchayat offices) ==========
CREATE TABLE pickup_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID REFERENCES diagnostic_centers(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,            -- e.g. "Rachapalle Panchayat Office"
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    village_name VARCHAR(150),
    distance_km NUMERIC(5,2),               -- cached distance from center, recomputed on insert
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pickup_points_location ON pickup_points USING GIST (location);

-- Recurring visit schedule for a pickup point (e.g. every Tuesday 9-11am)
CREATE TABLE pickup_point_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pickup_point_id UUID REFERENCES pickup_points(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,          -- 0=Sunday ... 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

-- ========== PARTNER LABS ==========
CREATE TABLE partner_labs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,             -- e.g. "Visakhapatnam Partner Lab"
    city VARCHAR(100),
    contact_phone VARCHAR(15),
    default_turnaround_hours INT DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== CATALOG: TESTS & PACKAGES ==========
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID REFERENCES diagnostic_centers(id),
    name VARCHAR(150) NOT NULL,             -- e.g. "Complete Blood Count (CBC)"
    code VARCHAR(50),
    sample_type VARCHAR(50),                -- e.g. "Blood", "Urine"
    price NUMERIC(10,2) NOT NULL,
    is_in_house BOOLEAN DEFAULT TRUE,       -- FALSE => must route to partner lab
    partner_lab_id UUID REFERENCES partner_labs(id),  -- set if is_in_house = FALSE
    turnaround_hours INT DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID REFERENCES diagnostic_centers(id),
    name VARCHAR(150) NOT NULL,             -- e.g. "Full Body Checkup"
    description TEXT,
    price NUMERIC(10,2) NOT NULL,           -- combined/discounted price
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE package_tests (
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    PRIMARY KEY (package_id, test_id)
);

-- ========== BOOKINGS ==========
CREATE TYPE collection_mode AS ENUM ('WALK_IN', 'PICKUP_POINT', 'HOME_VISIT');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES users(id),
    center_id UUID REFERENCES diagnostic_centers(id),
    pickup_point_id UUID REFERENCES pickup_points(id),   -- NULL if WALK_IN
    collection_mode collection_mode NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status booking_status DEFAULT 'PENDING',
    total_amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE booking_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id),
    package_id UUID REFERENCES packages(id),
    price NUMERIC(10,2) NOT NULL,
    CHECK (test_id IS NOT NULL OR package_id IS NOT NULL)
);

-- ========== SAMPLES (physical specimen lifecycle) ==========
CREATE TYPE sample_status AS ENUM (
    'BOOKED', 'COLLECTED', 'IN_TRANSIT_TO_CENTER', 'AT_CENTER',
    'IN_HOUSE_PROCESSING', 'ROUTED_TO_PARTNER_LAB',
    'RESULT_READY', 'DELIVERED'
);

CREATE TABLE samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    booking_item_id UUID REFERENCES booking_items(id),
    collected_by UUID REFERENCES users(id),   -- staff who collected it
    status sample_status DEFAULT 'BOOKED',
    collected_at TIMESTAMPTZ,
    routed_to_partner_lab_id UUID REFERENCES partner_labs(id),
    expected_result_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sample_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
    status sample_status NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);

-- ========== REPORTS ==========
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,                 -- S3 URL
    generated_at TIMESTAMPTZ DEFAULT now(),
    reviewed_by UUID REFERENCES users(id)
);

-- ========== EXAMPLE: 20km radius query ==========
-- Find all pickup points within a center's service radius:
-- SELECT pp.* FROM pickup_points pp
-- JOIN diagnostic_centers dc ON dc.id = pp.center_id
-- WHERE ST_DWithin(dc.location, pp.location, dc.service_radius_km * 1000)
--   AND pp.center_id = :centerId;
