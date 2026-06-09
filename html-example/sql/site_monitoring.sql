DROP DATABASE IF EXISTS site_monitoring;
CREATE DATABASE site_monitoring CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE site_monitoring;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE meter_readings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_name VARCHAR(50) NOT NULL,
  voltage DECIMAL(8,2) NOT NULL,
  current DECIMAL(8,2) NOT NULL,
  power DECIMAL(8,2) NOT NULL,
  temperature DECIMAL(8,2) NOT NULL,
  energy DECIMAL(10,2) NOT NULL,
  reading_time DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_site_time (site_name, reading_time)
);

INSERT INTO users (username, full_name, password_hash, role) VALUES
('admin', 'Admin User', '$2y$12$Q80TgcLivy4ZiE4wBBTGvOx1T0b5zgzyS8BX0A1dt7vFZf8KVjZt.', 'admin');

DELIMITER $$
CREATE PROCEDURE seed_readings()
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE base_time DATETIME DEFAULT DATE_SUB(NOW(), INTERVAL 12 HOUR);
  WHILE i < 288 DO
    INSERT INTO meter_readings (site_name, voltage, current, power, temperature, energy, reading_time)
    VALUES (
      'SITE-03',
      ROUND(224 + (RAND()*8), 2),
      ROUND(16 + (RAND()*5), 2),
      ROUND(3.3 + (RAND()*2.2), 2),
      ROUND(34 + (RAND()*8), 2),
      ROUND(1200 + i * 0.15 + (RAND()*2), 2),
      DATE_ADD(base_time, INTERVAL i*5 MINUTE)
    );
    SET i = i + 1;
  END WHILE;
END $$
DELIMITER ;

CALL seed_readings();
DROP PROCEDURE seed_readings;
