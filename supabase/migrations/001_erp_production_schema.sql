-- =============================================================================
-- MRO PROCUREMENT SOLUTION — PRODUCTION POSTGRESQL SCHEMA, RLS, STORAGE & REALTIME
-- Target Project: https://plvjsiehhpdoyvzgahpr.supabase.co
-- Idempotent migration script: safe to re-run without destroying existing rows.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. ROLES, PERMISSIONS & USER PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  approval_limit numeric(14, 2) NOT NULL DEFAULT 0,
  default_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id text PRIMARY KEY,
  module_key text NOT NULL,
  action_key text NOT NULL,
  description text DEFAULT '',
  UNIQUE (module_key, action_key)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id text PRIMARY KEY,
  role_id text NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id text PRIMARY KEY,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  mobile text DEFAULT '',
  designation text DEFAULT '',
  department text DEFAULT 'Procurement',
  role text NOT NULL DEFAULT 'PROCUREMENT_EMPLOYEE',
  role_id text REFERENCES public.roles(id) ON DELETE SET NULL,
  company_name text DEFAULT '',
  associated_id text DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  must_change_password boolean NOT NULL DEFAULT false,
  approval_limit numeric(14, 2) NOT NULL DEFAULT 0,
  approval_authority jsonb NOT NULL DEFAULT '{}'::jsonb,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.login_audit_logs (
  id text PRIMARY KEY,
  user_id text REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  username text NOT NULL,
  role text NOT NULL,
  status text NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  ip_address text DEFAULT '',
  user_agent text DEFAULT '',
  device_type text DEFAULT '',
  session_id text DEFAULT '',
  failure_reason text DEFAULT '',
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. COMPANIES, PURCHASE EXECUTIVES & CUSTOMERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id text PRIMARY KEY,
  company_code text NOT NULL DEFAULT '',
  company_name text NOT NULL,
  gstin text DEFAULT '',
  pan text DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  pincode text DEFAULT '',
  contact_person text DEFAULT '',
  mobile text DEFAULT '',
  email text DEFAULT '',
  payment_terms text DEFAULT '',
  delivery_address text DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  remarks text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_executives (
  id text PRIMARY KEY,
  company_id text REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  name text NOT NULL,
  designation text DEFAULT '',
  mobile text DEFAULT '',
  email text DEFAULT '',
  department text DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  remarks text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id text PRIMARY KEY,
  company_code text DEFAULT '',
  company_name text NOT NULL,
  contact_person text DEFAULT '',
  mobile text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  pincode text DEFAULT '',
  gstin text DEFAULT '',
  pan text DEFAULT '',
  payment_terms text DEFAULT '',
  delivery_address text DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  designation text DEFAULT '',
  department text DEFAULT '',
  email text DEFAULT '',
  mobile text DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. BRANDS, CATEGORIES, PRODUCT TYPES & MASTER PRODUCTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text DEFAULT '',
  manufacturer text DEFAULT '',
  category text DEFAULT '',
  website text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  status text DEFAULT 'ACTIVE',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text DEFAULT '',
  description text DEFAULT '',
  sub_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_types (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text DEFAULT '',
  sub_category text DEFAULT '',
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  item_code text DEFAULT '',
  item_name text NOT NULL,
  category text DEFAULT '',
  sub_category text DEFAULT '',
  brand text DEFAULT '',
  manufacturer text DEFAULT '',
  manufacturer_code text DEFAULT '',
  part_number text DEFAULT '',
  model_number text DEFAULT '',
  specification text DEFAULT '',
  uom text NOT NULL DEFAULT 'NOS',
  hsn_code text DEFAULT '',
  gst_rate numeric(6, 2) DEFAULT 18,
  mrp numeric(14, 2) DEFAULT 0,
  discount_percentage numeric(6, 2) DEFAULT 0,
  net_purchase_rate numeric(14, 2) DEFAULT 0,
  stock_qty numeric(14, 3) DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  image_url text DEFAULT '',
  datasheet_url text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. VENDORS, CONTACTS, DOCUMENTS, BRANDS & PRODUCT MAPPING
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendors (
  id text PRIMARY KEY,
  vendor_code text DEFAULT '',
  company_name text NOT NULL,
  legal_name text DEFAULT '',
  vendor_type text DEFAULT '',
  contact_person text DEFAULT '',
  mobile text DEFAULT '',
  alternate_mobile text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  country text DEFAULT 'India',
  pincode text DEFAULT '',
  gstin text DEFAULT '',
  pan text DEFAULT '',
  msme_status text DEFAULT '',
  payment_terms text DEFAULT '30 Days Net',
  delivery_terms text DEFAULT '',
  rating numeric(3, 2) DEFAULT 4.0,
  intelligence_score numeric(5, 2) DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  brands_supplied jsonb NOT NULL DEFAULT '[]'::jsonb,
  material_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_families jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text,
  created_by text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_contacts (
  id text PRIMARY KEY,
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  department text DEFAULT 'Sales',
  designation text DEFAULT '',
  email text DEFAULT '',
  mobile text DEFAULT '',
  alternate_mobile text DEFAULT '',
  landline text DEFAULT '',
  whatsapp text DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  source text DEFAULT '',
  confidence numeric(5, 2) DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id text PRIMARY KEY,
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'PDF',
  file_size_bytes bigint DEFAULT 0,
  storage_bucket text DEFAULT 'vendor-catalogues',
  storage_path text DEFAULT '',
  file_url text DEFAULT '',
  processing_status text DEFAULT 'UPLOADED',
  products_identified_count integer DEFAULT 0,
  uploaded_by text DEFAULT '',
  upload_date timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.vendor_brands (
  id text PRIMARY KEY,
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  brand_id text REFERENCES public.brands(id) ON DELETE SET NULL,
  brand_name text NOT NULL,
  relationship_type text DEFAULT 'Deals In',
  product_count integer DEFAULT 0,
  source text DEFAULT '',
  source_url text DEFAULT '',
  confidence numeric(5, 2) DEFAULT 80,
  evidence text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, brand_name)
);

CREATE TABLE IF NOT EXISTS public.vendor_products (
  id text PRIMARY KEY,
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  brand text DEFAULT '',
  category text DEFAULT '',
  sub_category text DEFAULT '',
  part_number text DEFAULT '',
  manufacturer_code text DEFAULT '',
  model_number text DEFAULT '',
  specification text DEFAULT '',
  uom text DEFAULT 'NOS',
  mrp numeric(14, 2) DEFAULT 0,
  discount_percent numeric(6, 2) DEFAULT 0,
  purchase_rate numeric(14, 2) DEFAULT 0,
  source_type text DEFAULT 'MANUAL',
  source_file text DEFAULT '',
  source_page text DEFAULT '',
  source_url text DEFAULT '',
  confidence_level text DEFAULT 'Medium',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_product_mapping (
  id text PRIMARY KEY,
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_code text DEFAULT '',
  vendor_name text DEFAULT '',
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  category text DEFAULT '',
  sub_category text DEFAULT '',
  product_type text DEFAULT '',
  brand text DEFAULT '',
  model_number text DEFAULT '',
  part_number text DEFAULT '',
  specification text DEFAULT '',
  uom text DEFAULT 'NOS',
  supply_type text DEFAULT 'Dealer',
  availability text DEFAULT 'Regular Stock',
  status text NOT NULL DEFAULT 'ACTIVE',
  remarks text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. CATALOGUES, IMPORT BATCHES, ITEMS & IMMUTABLE RATE HISTORY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogue_import_batches (
  id text PRIMARY KEY,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  file_name text NOT NULL,
  source_type text DEFAULT 'PDF',
  storage_bucket text DEFAULT 'vendor-catalogues',
  storage_path text DEFAULT '',
  file_size_bytes bigint DEFAULT 0,
  version text DEFAULT '1.0',
  status text DEFAULT 'COMPLETED',
  total_pages integer DEFAULT 0,
  pages_processed integer DEFAULT 0,
  total_records integer DEFAULT 0,
  new_count integer DEFAULT 0,
  updated_count integer DEFAULT 0,
  unchanged_count integer DEFAULT 0,
  duplicate_count integer DEFAULT 0,
  invalid_count integer DEFAULT 0,
  uploaded_by text DEFAULT '',
  effective_date text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalogues (
  id text PRIMARY KEY,
  vendor_id text REFERENCES public.vendors(id) ON DELETE CASCADE,
  batch_id text REFERENCES public.catalogue_import_batches(id) ON DELETE SET NULL,
  brand text DEFAULT '',
  title text NOT NULL,
  catalogue_version text DEFAULT '',
  effective_date text DEFAULT '',
  file_name text DEFAULT '',
  storage_bucket text DEFAULT 'vendor-catalogues',
  storage_path text DEFAULT '',
  file_url text DEFAULT '',
  status text DEFAULT 'ACTIVE',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalogue_items (
  id text PRIMARY KEY,
  catalogue_id text REFERENCES public.catalogues(id) ON DELETE CASCADE,
  batch_id text REFERENCES public.catalogue_import_batches(id) ON DELETE SET NULL,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  part_code text NOT NULL,
  normalized_part_code text NOT NULL DEFAULT '',
  manufacturer_code text DEFAULT '',
  model_number text DEFAULT '',
  product_name text NOT NULL,
  brand text DEFAULT '',
  category text DEFAULT '',
  sub_category text DEFAULT '',
  specification text DEFAULT '',
  uom text DEFAULT 'NOS',
  mrp numeric(14, 2) DEFAULT 0,
  discount_percent numeric(6, 2) DEFAULT 0,
  purchase_rate numeric(14, 2) DEFAULT 0,
  catalogue_version text DEFAULT '',
  effective_date text DEFAULT '',
  source_file text DEFAULT '',
  source_page text DEFAULT '',
  source_url text DEFAULT '',
  status text DEFAULT 'ACTIVE',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_history (
  id text PRIMARY KEY,
  catalogue_item_id text REFERENCES public.catalogue_items(id) ON DELETE SET NULL,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  brand text DEFAULT '',
  part_code text NOT NULL,
  product_name text DEFAULT '',
  mrp numeric(14, 2) DEFAULT 0,
  discount_percent numeric(6, 2) DEFAULT 0,
  purchase_rate numeric(14, 2) DEFAULT 0,
  effective_from text DEFAULT '',
  effective_to text DEFAULT '',
  year integer,
  import_batch_id text DEFAULT '',
  catalogue_version text DEFAULT '',
  source text DEFAULT 'CATALOGUE',
  is_current boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 6. PROCUREMENT WORKFLOW: REQUIREMENTS, RFQS, QUOTES, POS, INVOICES, DISPATCH
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.requirements (
  id text PRIMARY KEY,
  rfq_number text DEFAULT '',
  customer_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text DEFAULT '',
  company_id text REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name text DEFAULT '',
  purchase_executive_id text DEFAULT '',
  purchase_executive_name text DEFAULT '',
  requirement_date text DEFAULT '',
  required_delivery_date text DEFAULT '',
  priority text DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'NEW_REQUIREMENT',
  created_by text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requirement_items (
  id text PRIMARY KEY,
  requirement_id text NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  item_code text DEFAULT '',
  item_name text NOT NULL,
  brand text DEFAULT '',
  part_number text DEFAULT '',
  model_number text DEFAULT '',
  category text DEFAULT '',
  sub_category text DEFAULT '',
  specification text DEFAULT '',
  quantity numeric(14, 3) NOT NULL DEFAULT 1,
  uom text NOT NULL DEFAULT 'NOS',
  target_price numeric(14, 2) DEFAULT 0,
  selected_vendor_id text DEFAULT '',
  selected_vendor_name text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rfqs (
  id text PRIMARY KEY,
  rfq_number text NOT NULL UNIQUE,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  customer_id text DEFAULT '',
  customer_name text DEFAULT '',
  company_id text DEFAULT '',
  company_name text DEFAULT '',
  purchase_executive_id text DEFAULT '',
  purchase_executive_name text DEFAULT '',
  required_date text DEFAULT '',
  sent_date text DEFAULT '',
  status text NOT NULL DEFAULT 'NEW_RFQ',
  notes text DEFAULT '',
  commercial_terms text DEFAULT '',
  created_by text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  closed_at timestamptz,
  closed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rfq_items (
  id text PRIMARY KEY,
  rfq_id text NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  product_id text DEFAULT '',
  brand text DEFAULT '',
  part_code text DEFAULT '',
  part_number text DEFAULT '',
  model_number text DEFAULT '',
  manufacturer_code text DEFAULT '',
  item_name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '',
  sub_category text DEFAULT '',
  specifications text DEFAULT '',
  quantity numeric(14, 3) NOT NULL DEFAULT 1,
  uom text NOT NULL DEFAULT 'NOS',
  target_price numeric(14, 2) DEFAULT 0,
  rate numeric(14, 2) DEFAULT 0,
  vendor_id text DEFAULT '',
  vendor_name text DEFAULT '',
  required_delivery_date text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rfq_vendors (
  id text PRIMARY KEY,
  rfq_id text NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_name text DEFAULT '',
  status text DEFAULT 'SENT',
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS public.quotes (
  id text PRIMARY KEY,
  enquiry_id text REFERENCES public.rfqs(id) ON DELETE SET NULL,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  customer_name text DEFAULT '',
  submission_date text DEFAULT '',
  valid_until text DEFAULT '',
  payment_terms text DEFAULT '',
  status text NOT NULL DEFAULT 'SUBMITTED',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id text PRIMARY KEY,
  quote_id text NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  requirement_item_id text DEFAULT '',
  item_name text NOT NULL,
  part_number text DEFAULT '',
  brand text DEFAULT '',
  category text DEFAULT '',
  quantity numeric(14, 3) DEFAULT 1,
  uom text DEFAULT 'NOS',
  mrp numeric(14, 2) DEFAULT 0,
  discount_percentage numeric(6, 2) DEFAULT 0,
  net_purchase_rate numeric(14, 2) DEFAULT 0,
  reseller_price numeric(14, 2) DEFAULT 0,
  gst_percent numeric(6, 2) DEFAULT 18,
  total_landed_cost numeric(14, 2) DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.vendor_responses (
  id text PRIMARY KEY,
  rfq_id text REFERENCES public.rfqs(id) ON DELETE SET NULL,
  quote_id text REFERENCES public.quotes(id) ON DELETE SET NULL,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  response_status text DEFAULT 'RECEIVED',
  notes text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_quotations (
  id text PRIMARY KEY,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  customer_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text DEFAULT '',
  quotation_date text DEFAULT '',
  validity_date text DEFAULT '',
  subtotal numeric(14, 2) DEFAULT 0,
  total_tax numeric(14, 2) DEFAULT 0,
  grand_total numeric(14, 2) DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_quotation_items (
  id text PRIMARY KEY,
  quotation_id text NOT NULL REFERENCES public.customer_quotations(id) ON DELETE CASCADE,
  requirement_item_id text DEFAULT '',
  item_name text NOT NULL,
  part_number text DEFAULT '',
  quantity numeric(14, 3) DEFAULT 1,
  uom text DEFAULT 'NOS',
  selected_vendor_id text DEFAULT '',
  purchase_price numeric(14, 2) DEFAULT 0,
  selling_unit_price numeric(14, 2) DEFAULT 0,
  gst_percent numeric(6, 2) DEFAULT 18,
  final_line_total numeric(14, 2) DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.customer_pos (
  id text PRIMARY KEY,
  quotation_id text REFERENCES public.customer_quotations(id) ON DELETE SET NULL,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  customer_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text DEFAULT '',
  customer_po_number text NOT NULL,
  po_date text DEFAULT '',
  po_amount numeric(14, 2) DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_po_items (
  id text PRIMARY KEY,
  customer_po_id text NOT NULL REFERENCES public.customer_pos(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  part_number text DEFAULT '',
  quantity numeric(14, 3) DEFAULT 1,
  uom text DEFAULT 'NOS',
  unit_price numeric(14, 2) DEFAULT 0,
  total_amount numeric(14, 2) DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.vendor_pos (
  id text PRIMARY KEY,
  customer_po_id text REFERENCES public.customer_pos(id) ON DELETE SET NULL,
  quotation_id text REFERENCES public.customer_quotations(id) ON DELETE SET NULL,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  po_date text DEFAULT '',
  subtotal numeric(14, 2) DEFAULT 0,
  gst_amount numeric(14, 2) DEFAULT 0,
  total_amount numeric(14, 2) DEFAULT 0,
  status text DEFAULT 'ISSUED',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_po_items (
  id text PRIMARY KEY,
  vendor_po_id text NOT NULL REFERENCES public.vendor_pos(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  part_number text DEFAULT '',
  quantity numeric(14, 3) DEFAULT 1,
  uom text DEFAULT 'NOS',
  unit_rate numeric(14, 2) DEFAULT 0,
  gst_percent numeric(6, 2) DEFAULT 18,
  total_amount numeric(14, 2) DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.proforma_invoices (
  id text PRIMARY KEY,
  vendor_po_id text REFERENCES public.vendor_pos(id) ON DELETE SET NULL,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  pi_number text DEFAULT '',
  pi_date text DEFAULT '',
  total_amount numeric(14, 2) DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY,
  pi_id text REFERENCES public.proforma_invoices(id) ON DELETE SET NULL,
  vendor_po_id text REFERENCES public.vendor_pos(id) ON DELETE SET NULL,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  total_pi_amount numeric(14, 2) DEFAULT 0,
  amount_paid numeric(14, 2) DEFAULT 0,
  payment_date text DEFAULT '',
  payment_mode text DEFAULT 'NEFT',
  transaction_reference text DEFAULT '',
  status text DEFAULT 'PAYMENT_PENDING',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispatches (
  id text PRIMARY KEY,
  vendor_po_id text REFERENCES public.vendor_pos(id) ON DELETE SET NULL,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  dispatch_date text DEFAULT '',
  vendor_invoice_number text DEFAULT '',
  transporter text DEFAULT '',
  lr_number text DEFAULT '',
  tracking_number text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id text PRIMARY KEY,
  dispatch_id text REFERENCES public.dispatches(id) ON DELETE SET NULL,
  requirement_id text REFERENCES public.requirements(id) ON DELETE SET NULL,
  delivery_date text DEFAULT '',
  received_by text DEFAULT '',
  status text DEFAULT 'DELIVERED',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7. INVENTORY, BILLING, DOCUMENTS, APPROVALS, NOTIFICATIONS & AUDIT LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory (
  id text PRIMARY KEY,
  product_id text REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse text DEFAULT 'Central Stores',
  stock_qty numeric(14, 3) DEFAULT 0,
  min_stock_level numeric(14, 3) DEFAULT 0,
  unit_cost numeric(14, 2) DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id text PRIMARY KEY,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text DEFAULT '',
  movement_type text NOT NULL,
  quantity numeric(14, 3) NOT NULL DEFAULT 0,
  balance_after numeric(14, 3) DEFAULT 0,
  unit_cost numeric(14, 2) DEFAULT 0,
  total_value numeric(14, 2) DEFAULT 0,
  reference_id text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_bills (
  id text PRIMARY KEY,
  bill_number text DEFAULT '',
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  vendor_po_id text DEFAULT '',
  requirement_id text DEFAULT '',
  grand_total numeric(14, 2) DEFAULT 0,
  paid_amount numeric(14, 2) DEFAULT 0,
  balance_due numeric(14, 2) DEFAULT 0,
  status text DEFAULT 'UNPAID',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_bills (
  id text PRIMARY KEY,
  invoice_number text DEFAULT '',
  customer_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text DEFAULT '',
  customer_po_id text DEFAULT '',
  requirement_id text DEFAULT '',
  grand_total numeric(14, 2) DEFAULT 0,
  paid_amount numeric(14, 2) DEFAULT 0,
  balance_due numeric(14, 2) DEFAULT 0,
  status text DEFAULT 'UNPAID',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id text PRIMARY KEY,
  expense_number text DEFAULT '',
  category text DEFAULT 'OTHER',
  paid_to text DEFAULT '',
  amount numeric(14, 2) DEFAULT 0,
  requirement_id text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challans (
  id text PRIMARY KEY,
  challan_number text DEFAULT '',
  customer_id text DEFAULT '',
  customer_name text DEFAULT '',
  status text DEFAULT 'DELIVERED',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approvals (
  id text PRIMARY KEY,
  request_type text NOT NULL,
  request_number text DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING',
  amount numeric(14, 2) DEFAULT 0,
  requestor_name text DEFAULT '',
  approver_name text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id text PRIMARY KEY,
  name text NOT NULL,
  doc_type text DEFAULT 'PDF',
  category text DEFAULT 'VENDOR_DOC',
  associated_transaction_id text DEFAULT '',
  party_name text DEFAULT '',
  storage_bucket text DEFAULT 'other-erp-documents',
  storage_path text DEFAULT '',
  file_size_bytes bigint DEFAULT 0,
  mime_type text DEFAULT '',
  url text DEFAULT '',
  uploaded_by text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text DEFAULT 'INFO',
  is_read boolean NOT NULL DEFAULT false,
  link_tab text DEFAULT '',
  link_id text DEFAULT '',
  target_role jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  actor_user text NOT NULL DEFAULT 'System',
  actor_role text NOT NULL DEFAULT 'SYSTEM',
  action text NOT NULL,
  module text NOT NULL DEFAULT 'ERP',
  record_id text DEFAULT '',
  old_data jsonb,
  new_data jsonb,
  remarks text DEFAULT '',
  ip_address text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.erp_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deleted_tombstones (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  deleted_by text DEFAULT '',
  reason text DEFAULT '',
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

-- -----------------------------------------------------------------------------
-- 8. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vendors_company_name ON public.vendors (lower(company_name));
CREATE INDEX IF NOT EXISTS idx_vendors_gstin ON public.vendors (upper(gstin)) WHERE gstin <> '';
CREATE INDEX IF NOT EXISTS idx_vendors_active ON public.vendors (is_deleted, status);
CREATE INDEX IF NOT EXISTS idx_vendor_product_mapping_vendor ON public.vendor_product_mapping (vendor_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_vendor_product_mapping_part ON public.vendor_product_mapping (upper(part_number));
CREATE INDEX IF NOT EXISTS idx_catalogue_items_part ON public.catalogue_items (upper(part_code));
CREATE INDEX IF NOT EXISTS idx_catalogue_items_norm_part ON public.catalogue_items (normalized_part_code);
CREATE INDEX IF NOT EXISTS idx_rate_history_part ON public.rate_history (upper(part_code), is_current);
CREATE INDEX IF NOT EXISTS idx_products_part_number ON public.products (upper(part_number));
CREATE INDEX IF NOT EXISTS idx_rfqs_number ON public.rfqs (rfq_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);

-- -----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS & POLICIES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.erp_current_profile()
RETURNS public.user_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.*
  FROM public.user_profiles up
  WHERE up.auth_user_id = auth.uid()
     OR lower(up.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.erp_is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE (up.auth_user_id = auth.uid() OR lower(up.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      AND up.status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.erp_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE (up.auth_user_id = auth.uid() OR lower(up.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      AND up.status = 'ACTIVE'
      AND (
        upper(up.role) IN ('SUPER_ADMIN', 'ADMIN')
        OR lower(up.username) = 'admin'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.erp_has_module_access(module_key text, action_key text DEFAULT 'canView')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof public.user_profiles;
  mod_allowed boolean;
  act_allowed boolean;
BEGIN
  SELECT * INTO prof FROM public.erp_current_profile();
  IF prof.id IS NULL OR prof.status <> 'ACTIVE' THEN
    RETURN false;
  END IF;

  IF upper(prof.role) IN ('SUPER_ADMIN', 'ADMIN') OR lower(prof.username) = 'admin' THEN
    RETURN true;
  END IF;

  mod_allowed := coalesce((prof.permissions -> 'modules' ->> module_key)::boolean, false);
  IF NOT mod_allowed THEN
    RETURN false;
  END IF;

  IF action_key = 'canView' THEN
    RETURN true;
  END IF;

  act_allowed := coalesce(
    (prof.permissions -> 'actions' ->> action_key)::boolean,
    CASE
      WHEN action_key = 'canCreate' THEN (prof.permissions -> 'actions' ->> 'canAdd')::boolean
      WHEN action_key = 'canAdd' THEN (prof.permissions -> 'actions' ->> 'canCreate')::boolean
      ELSE false
    END,
    false
  );
  RETURN coalesce(act_allowed, false);
END;
$$;

-- Enable RLS across all ERP tables
DO $$
DECLARE
  tbl text;
  all_tables text[] := ARRAY[
    'roles','permissions','role_permissions','user_profiles','login_audit_logs',
    'companies','purchase_executives','customers','customer_contacts',
    'brands','categories','product_types','products',
    'vendors','vendor_contacts','vendor_documents','vendor_brands','vendor_products','vendor_product_mapping',
    'catalogues','catalogue_import_batches','catalogue_items','rate_history',
    'requirements','requirement_items','rfqs','rfq_items','rfq_vendors',
    'quotes','quote_items','vendor_responses','customer_quotations','customer_quotation_items',
    'customer_pos','customer_po_items','vendor_pos','vendor_po_items',
    'proforma_invoices','payments','dispatches','deliveries',
    'inventory','stock_movements','purchase_bills','sales_bills','expenses','challans',
    'approvals','documents','notifications','audit_logs','erp_settings','deleted_tombstones'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- User profiles & roles policies
DROP POLICY IF EXISTS user_profiles_select_self_or_admin ON public.user_profiles;
CREATE POLICY user_profiles_select_self_or_admin ON public.user_profiles
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR public.erp_is_admin() OR public.erp_is_active_user());

DROP POLICY IF EXISTS user_profiles_admin_write ON public.user_profiles;
CREATE POLICY user_profiles_admin_write ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.erp_is_admin())
  WITH CHECK (public.erp_is_admin());

DROP POLICY IF EXISTS roles_read_active ON public.roles;
CREATE POLICY roles_read_active ON public.roles
  FOR SELECT TO authenticated USING (public.erp_is_active_user());

DROP POLICY IF EXISTS roles_admin_write ON public.roles;
CREATE POLICY roles_admin_write ON public.roles
  FOR ALL TO authenticated USING (public.erp_is_admin()) WITH CHECK (public.erp_is_admin());

-- Immutable Audit Logs (append-only for active users, never editable or deletable by non-admins/users)
DROP POLICY IF EXISTS audit_logs_read_authorized ON public.audit_logs;
CREATE POLICY audit_logs_read_authorized ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.erp_has_module_access('auditTrail', 'canView') OR public.erp_is_admin());

DROP POLICY IF EXISTS audit_logs_insert_active ON public.audit_logs;
CREATE POLICY audit_logs_insert_active ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.erp_is_active_user());

-- Helper macro for module-gated ERP tables
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('vendors', 'vendors'),
      ('vendor_contacts', 'vendors'),
      ('vendor_documents', 'vendors'),
      ('vendor_brands', 'vendors'),
      ('vendor_products', 'vendors'),
      ('vendor_product_mapping', 'vendors'),
      ('catalogues', 'vendors'),
      ('catalogue_import_batches', 'vendors'),
      ('catalogue_items', 'vendors'),
      ('rate_history', 'vendors'),
      ('brands', 'categories'),
      ('categories', 'categories'),
      ('product_types', 'products'),
      ('products', 'products'),
      ('companies', 'customers'),
      ('purchase_executives', 'customers'),
      ('customers', 'customers'),
      ('customer_contacts', 'customers'),
      ('requirements', 'requirements'),
      ('requirement_items', 'requirements'),
      ('rfqs', 'rfqs'),
      ('rfq_items', 'rfqs'),
      ('rfq_vendors', 'rfqs'),
      ('quotes', 'rfqs'),
      ('quote_items', 'rfqs'),
      ('vendor_responses', 'rfqs'),
      ('customer_quotations', 'quotations'),
      ('customer_quotation_items', 'quotations'),
      ('customer_pos', 'customerPos'),
      ('customer_po_items', 'customerPos'),
      ('vendor_pos', 'vendorPos'),
      ('vendor_po_items', 'vendorPos'),
      ('proforma_invoices', 'pi'),
      ('payments', 'payments'),
      ('dispatches', 'dispatch'),
      ('deliveries', 'delivery'),
      ('inventory', 'products'),
      ('stock_movements', 'products'),
      ('purchase_bills', 'payments'),
      ('sales_bills', 'quotations'),
      ('expenses', 'payments'),
      ('challans', 'dispatch'),
      ('approvals', 'approvals'),
      ('documents', 'documents')
    ) AS t(tbl_name, mod_key)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', rec.tbl_name || '_select_policy', rec.tbl_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.erp_has_module_access(%L, ''canView'') OR public.erp_is_active_user());',
      rec.tbl_name || '_select_policy', rec.tbl_name, rec.mod_key
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', rec.tbl_name || '_insert_policy', rec.tbl_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.erp_has_module_access(%L, ''canCreate''));',
      rec.tbl_name || '_insert_policy', rec.tbl_name, rec.mod_key
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', rec.tbl_name || '_update_policy', rec.tbl_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.erp_has_module_access(%L, ''canEdit'')) WITH CHECK (public.erp_has_module_access(%L, ''canEdit''));',
      rec.tbl_name || '_update_policy', rec.tbl_name, rec.mod_key, rec.mod_key
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', rec.tbl_name || '_delete_policy', rec.tbl_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.erp_has_module_access(%L, ''canDelete'') OR public.erp_is_admin());',
      rec.tbl_name || '_delete_policy', rec.tbl_name, rec.mod_key
    );
  END LOOP;
END $$;

-- Shared metadata / notifications / settings policies for active users
DROP POLICY IF EXISTS notifications_active ON public.notifications;
CREATE POLICY notifications_active ON public.notifications
  FOR ALL TO authenticated
  USING (public.erp_is_active_user())
  WITH CHECK (public.erp_is_active_user());

DROP POLICY IF EXISTS erp_settings_read ON public.erp_settings;
CREATE POLICY erp_settings_read ON public.erp_settings
  FOR SELECT TO authenticated USING (public.erp_is_active_user());

DROP POLICY IF EXISTS erp_settings_admin_write ON public.erp_settings;
CREATE POLICY erp_settings_admin_write ON public.erp_settings
  FOR ALL TO authenticated USING (public.erp_is_admin()) WITH CHECK (public.erp_is_admin());

DROP POLICY IF EXISTS deleted_tombstones_active ON public.deleted_tombstones;
CREATE POLICY deleted_tombstones_active ON public.deleted_tombstones
  FOR ALL TO authenticated
  USING (public.erp_is_active_user())
  WITH CHECK (public.erp_is_active_user());

DROP POLICY IF EXISTS login_audit_logs_policy ON public.login_audit_logs;
CREATE POLICY login_audit_logs_policy ON public.login_audit_logs
  FOR SELECT TO authenticated USING (public.erp_is_admin());

-- -----------------------------------------------------------------------------
-- 10. SUPABASE STORAGE BUCKETS (Up to 250 MB configurable)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('vendor-catalogues', 'vendor-catalogues', false, 262144000),
  ('vendor-documents', 'vendor-documents', false, 262144000),
  ('product-images', 'product-images', false, 52428800),
  ('product-datasheets', 'product-datasheets', false, 104857600),
  ('rfq-documents', 'rfq-documents', false, 104857600),
  ('quotation-documents', 'quotation-documents', false, 104857600),
  ('purchase-orders', 'purchase-orders', false, 104857600),
  ('invoices', 'invoices', false, 104857600),
  ('other-erp-documents', 'other-erp-documents', false, 262144000)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS erp_storage_authenticated_read ON storage.objects;
CREATE POLICY erp_storage_authenticated_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN (
      'vendor-catalogues','vendor-documents','product-images','product-datasheets',
      'rfq-documents','quotation-documents','purchase-orders','invoices','other-erp-documents'
    )
    AND public.erp_is_active_user()
  );

DROP POLICY IF EXISTS erp_storage_authenticated_insert ON storage.objects;
CREATE POLICY erp_storage_authenticated_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN (
      'vendor-catalogues','vendor-documents','product-images','product-datasheets',
      'rfq-documents','quotation-documents','purchase-orders','invoices','other-erp-documents'
    )
    AND public.erp_is_active_user()
  );

DROP POLICY IF EXISTS erp_storage_authenticated_update ON storage.objects;
CREATE POLICY erp_storage_authenticated_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (public.erp_is_active_user())
  WITH CHECK (public.erp_is_active_user());

DROP POLICY IF EXISTS erp_storage_admin_delete ON storage.objects;
CREATE POLICY erp_storage_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (public.erp_is_admin());

-- -----------------------------------------------------------------------------
-- 11. SUPABASE REALTIME PUBLICATION
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  rt_tbl text;
  rt_tables text[] := ARRAY[
    'vendors','vendor_product_mapping','products','brands','categories',
    'requirements','rfqs','quotes','customer_quotations','customer_pos',
    'vendor_pos','proforma_invoices','payments','dispatches','deliveries',
    'notifications','audit_logs','catalogue_import_batches','rate_history'
  ];
BEGIN
  FOREACH rt_tbl IN ARRAY rt_tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', rt_tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
