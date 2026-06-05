CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  salon TEXT DEFAULT '',
  role TEXT DEFAULT '',
  commission_rate REAL NOT NULL,
  product_commission_rate REAL DEFAULT 50,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS salary_records (
  employee_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  service_total INTEGER DEFAULT 0,
  product_total INTEGER DEFAULT 0,
  purchase_total INTEGER DEFAULT 0,
  product_items TEXT DEFAULT '[]',
  purchase_items TEXT DEFAULT '[]',
  payroll TEXT DEFAULT '{}',
  payment_details TEXT DEFAULT '{}',
  saved_at TEXT,
  PRIMARY KEY (employee_id, year, month)
);
