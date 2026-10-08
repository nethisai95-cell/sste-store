CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('Furniture', 'Lighting', 'Decor', 'Storage')),
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  rating NUMERIC(2, 1) NOT NULL DEFAULT 4.8 CHECK (rating >= 0 AND rating <= 5),
  tag VARCHAR(40) NOT NULL DEFAULT 'New',
  accent VARCHAR(80) NOT NULL DEFAULT '',
  description VARCHAR(500) NOT NULL DEFAULT '',
  story VARCHAR(1000) NOT NULL DEFAULT '',
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) CHECK (gst_rate >= 0 AND gst_rate <= 100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(8) NOT NULL DEFAULT '';
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_reserved_quantity_check;
ALTER TABLE products ADD CONSTRAINT products_reserved_quantity_check
  CHECK (reserved_quantity <= stock_on_hand);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_salt CHAR(32) NOT NULL,
  password_hash CHAR(128) NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR(24) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'shipped', 'delivered', 'cancelled')),
  total NUMERIC(12, 2) NOT NULL CHECK (total > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(160);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS state VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code VARCHAR(6);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(24) NOT NULL DEFAULT 'not_paid';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('not_paid', 'demo_paid', 'razorpay_pending', 'razorpay_paid', 'razorpay_failed'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(24);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('demo_upi', 'razorpay'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider_order_id VARCHAR(80) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider_payment_id VARCHAR(80) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider_mode VARCHAR(8);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_provider_mode_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_provider_mode_check
  CHECK (payment_provider_mode IS NULL OR payment_provider_mode IN ('test', 'live'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS taxable_subtotal NUMERIC(12, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_total NUMERIC(12, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_gst_registered BOOLEAN;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_legal_name VARCHAR(160);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_gstin VARCHAR(15);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_registered_address VARCHAR(500);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_registered_state VARCHAR(80);
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_key ON orders (invoice_number) WHERE invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_customer_created_idx
  ON orders (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(120) NOT NULL,
  image_url TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS inventory_tracked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(8);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS inventory_status VARCHAR(16) NOT NULL DEFAULT 'not_tracked';
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_inventory_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_inventory_status_check
  CHECK (inventory_status IN ('not_tracked', 'reserved', 'committed', 'released'));

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(120) NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  movement_type VARCHAR(24) NOT NULL
    CHECK (movement_type IN ('stock_adjustment', 'reservation', 'reservation_release', 'sale')),
  quantity_change INTEGER NOT NULL DEFAULT 0,
  reserved_change INTEGER NOT NULL DEFAULT 0,
  note VARCHAR(240) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_movements_created_idx
  ON inventory_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_product_created_idx
  ON inventory_movements (product_id, created_at DESC);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(254) NOT NULL DEFAULT 'system';

CREATE TABLE IF NOT EXISTS inventory_units (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  status VARCHAR(16) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'sold', 'retired')),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status <> 'reserved' OR (order_id IS NOT NULL AND order_item_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS inventory_units_product_status_created_idx
  ON inventory_units (product_id, status, created_at, id);
CREATE INDEX IF NOT EXISTS inventory_units_order_item_idx
  ON inventory_units (order_item_id) WHERE order_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_unit_events (
  id UUID PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES inventory_units(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL
    CHECK (event_type IN ('opening_stock', 'stock_received', 'reserved', 'released', 'sold', 'retired')),
  note VARCHAR(240) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_unit_events_unit_created_idx
  ON inventory_unit_events (unit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_agents (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_salt CHAR(32) NOT NULL,
  password_hash CHAR(128) NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE delivery_agents ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  agent_id UUID NOT NULL REFERENCES delivery_agents(id) ON DELETE RESTRICT,
  status VARCHAR(24) NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivery_failed', 'delivered', 'cancelled')),
  pin_seed UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check
  CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivery_failed', 'delivered', 'cancelled'));

CREATE INDEX IF NOT EXISTS deliveries_agent_status_idx
  ON deliveries (agent_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS delivery_events (
  id UUID PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE RESTRICT,
  actor_role VARCHAR(12) NOT NULL CHECK (actor_role IN ('owner', 'driver', 'system')),
  actor_id UUID,
  event_type VARCHAR(24) NOT NULL
    CHECK (event_type IN ('assigned', 'unit_picked_up', 'picked_up', 'in_transit', 'out_for_delivery', 'delivery_failed', 'delivered', 'cancelled')),
  unit_id UUID REFERENCES inventory_units(id) ON DELETE RESTRICT,
  note VARCHAR(240) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delivery_events_delivery_created_idx
  ON delivery_events (delivery_id, created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_unit_scans (
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES inventory_units(id) ON DELETE RESTRICT,
  scanned_by UUID NOT NULL REFERENCES delivery_agents(id) ON DELETE RESTRICT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (delivery_id, unit_id)
);

INSERT INTO inventory_units (id, product_id, status)
SELECT gen_random_uuid(), p.id, 'available'
FROM products p
CROSS JOIN LATERAL generate_series(1, p.stock_on_hand)
WHERE p.inventory_tracking_enabled
  AND NOT EXISTS (SELECT 1 FROM inventory_units u WHERE u.product_id = p.id);

WITH reservation_items AS (
  SELECT oi.id AS order_item_id, oi.order_id, oi.product_id, oi.quantity,
    SUM(oi.quantity) OVER (
      PARTITION BY oi.product_id
      ORDER BY o.created_at, oi.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS end_position
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.inventory_status = 'reserved'
    AND oi.inventory_tracked
    AND oi.product_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM inventory_units assigned
      WHERE assigned.order_item_id = oi.id AND assigned.status = 'reserved'
    )
),
available_units AS (
  SELECT u.id, u.product_id,
    ROW_NUMBER() OVER (PARTITION BY u.product_id ORDER BY u.created_at, u.id) AS position
  FROM inventory_units u
  WHERE u.status = 'available'
),
allocations AS (
  SELECT units.id AS unit_id, items.order_id, items.order_item_id
  FROM reservation_items items
  JOIN available_units units ON units.product_id = items.product_id
    AND units.position BETWEEN items.end_position - items.quantity + 1 AND items.end_position
)
UPDATE inventory_units u
SET status = 'reserved', order_id = allocations.order_id,
    order_item_id = allocations.order_item_id, updated_at = NOW()
FROM allocations
WHERE u.id = allocations.unit_id;

INSERT INTO inventory_unit_events (id, unit_id, product_id, event_type, note)
SELECT gen_random_uuid(), u.id, u.product_id, 'opening_stock',
  'Unique unit record created from the existing physical stock count'
FROM inventory_units u
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_unit_events e WHERE e.unit_id = u.id
);

INSERT INTO inventory_unit_events (id, unit_id, product_id, order_id, order_item_id, event_type, note)
SELECT gen_random_uuid(), u.id, u.product_id, u.order_id, u.order_item_id, 'reserved',
  'Existing checkout reservation linked during per-unit tracking setup'
FROM inventory_units u
WHERE u.status = 'reserved'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_unit_events e
    WHERE e.unit_id = u.id AND e.event_type = 'reserved'
  );

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  category VARCHAR(24) NOT NULL
    CHECK (category IN ('order', 'delivery', 'payment', 'product', 'return', 'other')),
  subject VARCHAR(120) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_customer_updated_idx
  ON support_tickets (customer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_updated_idx
  ON support_tickets (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_role VARCHAR(12) NOT NULL CHECK (author_role IN ('customer', 'owner')),
  author_name VARCHAR(254) NOT NULL,
  message VARCHAR(3000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_created_idx
  ON support_messages (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS order_feedback (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message VARCHAR(2000) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_feedback_status_created_idx
  ON order_feedback (status, created_at DESC);

CREATE TABLE IF NOT EXISTS finance_entries (
  id UUID PRIMARY KEY,
  entry_type VARCHAR(16) NOT NULL CHECK (entry_type IN ('sale', 'expense', 'refund', 'reconciliation')),
  amount_paise BIGINT NOT NULL CHECK (amount_paise <> 0),
  payment_mode VARCHAR(8) CHECK (payment_mode IS NULL OR payment_mode IN ('live', 'test', 'demo')),
  order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
  category VARCHAR(80) NOT NULL,
  reference VARCHAR(120) NOT NULL DEFAULT '',
  note VARCHAR(1000) NOT NULL,
  recorded_by VARCHAR(254) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (entry_type = 'sale' AND amount_paise > 0 AND order_id IS NOT NULL AND payment_mode IS NOT NULL) OR
    (entry_type = 'expense' AND amount_paise < 0 AND order_id IS NULL) OR
    (entry_type = 'refund' AND amount_paise < 0 AND order_id IS NOT NULL) OR
    (entry_type = 'reconciliation' AND order_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_order_sale_idx
  ON finance_entries (order_id) WHERE entry_type = 'sale';
CREATE INDEX IF NOT EXISTS finance_entries_created_idx
  ON finance_entries (created_at DESC, id);
CREATE INDEX IF NOT EXISTS finance_entries_type_created_idx
  ON finance_entries (entry_type, created_at DESC);

CREATE TABLE IF NOT EXISTS store_tax_profile (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  gst_registered BOOLEAN NOT NULL DEFAULT FALSE,
  legal_name VARCHAR(160) NOT NULL DEFAULT '',
  gstin VARCHAR(15) NOT NULL DEFAULT '',
  registered_address VARCHAR(500) NOT NULL DEFAULT '',
  registered_state VARCHAR(80) NOT NULL DEFAULT '',
  accountant_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by VARCHAR(254),
  reviewed_at TIMESTAMPTZ,
  updated_by VARCHAR(254),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT accountant_reviewed OR (gst_registered AND gstin <> '' AND legal_name <> '' AND registered_address <> '' AND registered_state <> ''))
);

INSERT INTO store_tax_profile (singleton) VALUES (TRUE) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_salt CHAR(32) NOT NULL,
  password_hash CHAR(128) NOT NULL,
  role VARCHAR(24) NOT NULL CHECK (role IN ('manager', 'inventory', 'support', 'finance', 'cashier')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  auth_version INTEGER NOT NULL DEFAULT 1,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employees_active_role_idx ON employees (active, role, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_events (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  actor_email VARCHAR(254) NOT NULL,
  event_type VARCHAR(24) NOT NULL CHECK (event_type IN ('created', 'role_changed', 'activated', 'deactivated', 'password_reset')),
  detail VARCHAR(240) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_events_employee_created_idx
  ON employee_events (employee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS account_recovery_tokens (
  id UUID PRIMARY KEY,
  account_type VARCHAR(16) NOT NULL CHECK (account_type IN ('customer', 'employee', 'delivery')),
  account_id UUID NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_recovery_tokens_active_idx
  ON account_recovery_tokens (account_type, account_id, expires_at DESC)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_contact_sync (
  customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'synced', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error VARCHAR(1000),
  zoho_contact_id VARCHAR(80),
  refresh_requested BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_contact_sync
  ADD COLUMN IF NOT EXISTS refresh_requested BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS crm_contact_sync_queue_idx
  ON crm_contact_sync (next_attempt_at, updated_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('manager', 'inventory', 'support', 'finance', 'cashier'));

CREATE SEQUENCE IF NOT EXISTS pos_receipt_seq START 1001;

CREATE TABLE IF NOT EXISTS pos_sales (
  id UUID PRIMARY KEY,
  receipt_number VARCHAR(24) NOT NULL UNIQUE,
  status VARCHAR(12) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
  payment_method VARCHAR(8) NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card')),
  payment_reference VARCHAR(80) NOT NULL DEFAULT '',
  customer_name VARCHAR(120) NOT NULL DEFAULT '',
  customer_phone VARCHAR(10) NOT NULL DEFAULT '',
  taxable_subtotal NUMERIC(12, 2) NOT NULL CHECK (taxable_subtotal >= 0),
  tax_total NUMERIC(12, 2) NOT NULL CHECK (tax_total >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total > 0),
  amount_tendered NUMERIC(12, 2),
  change_due NUMERIC(12, 2),
  seller_legal_name VARCHAR(160) NOT NULL DEFAULT '',
  seller_gstin VARCHAR(15) NOT NULL DEFAULT '',
  recorded_by VARCHAR(254) NOT NULL,
  cashier_name VARCHAR(120) NOT NULL DEFAULT '',
  void_reason VARCHAR(240),
  voided_by VARCHAR(254),
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pos_sales_created_idx ON pos_sales (created_at DESC, id);

CREATE TABLE IF NOT EXISTS pos_sale_items (
  id UUID PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(120) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  gst_rate NUMERIC(5, 2) NOT NULL,
  hsn_code VARCHAR(8) NOT NULL DEFAULT '',
  tax_amount NUMERIC(12, 2) NOT NULL,
  inventory_tracked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS pos_sale_items_sale_idx ON pos_sale_items (sale_id);

ALTER TABLE inventory_units
  ADD COLUMN IF NOT EXISTS pos_sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS inventory_units_pos_sale_idx
  ON inventory_units (pos_sale_id) WHERE pos_sale_id IS NOT NULL;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS seller_registered_address TEXT NOT NULL DEFAULT '';
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS seller_registered_state VARCHAR(80) NOT NULL DEFAULT '';
