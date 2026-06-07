-- =============================================================
-- SHIPPING SYSTEM - Del 1: Datamodel
-- =============================================================
-- Reversible: se ned-migration nederst i filen
-- conversation_id bruges som "transaction_id" da der ingen
-- separat transactions-tabel er.
-- =============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE shipping_size_category AS ENUM ('small', 'medium', 'large', 'xlarge');
CREATE TYPE shipping_carrier       AS ENUM ('postnord', 'dao', 'gls');
CREATE TYPE shipping_service_type  AS ENUM ('service_point', 'home_delivery', 'parcel_shop');
CREATE TYPE shipment_status        AS ENUM ('pending', 'booked', 'printed', 'in_transit', 'delivered', 'failed', 'cancelled');
CREATE TYPE invoice_status         AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE delivery_method        AS ENUM ('pickup', 'shipping', 'custom');
CREATE TYPE delivery_status_enum   AS ENUM ('pending', 'in_progress', 'completed');

-- ── shipping_options (per opslag) ────────────────────────────

CREATE TABLE shipping_options (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id                  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    allow_pickup                BOOLEAN NOT NULL DEFAULT false,
    allow_shipping              BOOLEAN NOT NULL DEFAULT false,
    allow_custom                BOOLEAN NOT NULL DEFAULT false,
    pickup_address              TEXT,
    pickup_hours                JSONB,          -- { mon: "08-16", tue: "08-16", ... }
    pickup_notes                TEXT,
    shipping_size_category      shipping_size_category,
    shipping_included_in_price  BOOLEAN NOT NULL DEFAULT false,
    shipping_estimated_cost_dkk DECIMAL(8,2),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT shipping_options_listing_unique UNIQUE (listing_id),
    CONSTRAINT at_least_one_option CHECK (allow_pickup OR allow_shipping OR allow_custom)
);

CREATE INDEX idx_shipping_options_listing ON shipping_options(listing_id);

-- ── shipmondo_price_cache ─────────────────────────────────────

CREATE TABLE shipmondo_price_cache (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier      shipping_carrier    NOT NULL,
    service_type shipping_service_type NOT NULL,
    size_category shipping_size_category NOT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'DK',
    price_dkk    DECIMAL(8,2) NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT price_cache_unique UNIQUE (carrier, service_type, size_category, country_code)
);

-- Seed med repræsentative priser (opdateres dagligt af cron)
INSERT INTO shipmondo_price_cache (carrier, service_type, size_category, price_dkk) VALUES
    ('postnord', 'service_point', 'small',  49.00),
    ('postnord', 'service_point', 'medium', 65.00),
    ('postnord', 'service_point', 'large',  89.00),
    ('postnord', 'service_point', 'xlarge', 139.00),
    ('postnord', 'home_delivery', 'small',  69.00),
    ('postnord', 'home_delivery', 'medium', 89.00),
    ('postnord', 'home_delivery', 'large',  119.00),
    ('postnord', 'home_delivery', 'xlarge', 179.00),
    ('dao',      'parcel_shop',   'small',  45.00),
    ('dao',      'parcel_shop',   'medium', 59.00),
    ('dao',      'parcel_shop',   'large',  79.00),
    ('dao',      'parcel_shop',   'xlarge', 119.00),
    ('dao',      'home_delivery', 'small',  65.00),
    ('dao',      'home_delivery', 'medium', 79.00),
    ('dao',      'home_delivery', 'large',  109.00),
    ('dao',      'home_delivery', 'xlarge', 159.00),
    ('gls',      'parcel_shop',   'small',  48.00),
    ('gls',      'parcel_shop',   'medium', 62.00),
    ('gls',      'parcel_shop',   'large',  85.00),
    ('gls',      'parcel_shop',   'xlarge', 130.00);

-- ── shipments ─────────────────────────────────────────────────

CREATE TABLE shipments (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id              UUID NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
    seller_institution_id        UUID REFERENCES institutions(id) ON DELETE SET NULL,
    buyer_institution_id         UUID REFERENCES institutions(id) ON DELETE SET NULL,
    shipmondo_shipment_id        TEXT UNIQUE,          -- NULL until booked
    carrier                      shipping_carrier NOT NULL,
    service_type                 shipping_service_type NOT NULL,
    size_category                shipping_size_category NOT NULL,
    cost_dkk                     DECIMAL(8,2),         -- faktisk pris til Shipmondo
    markup_dkk                   DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    total_charged_to_seller_dkk  DECIMAL(8,2),         -- cost + markup
    tracking_number              TEXT,
    tracking_url                 TEXT,
    label_pdf_url                TEXT,
    pickup_point_id              TEXT,
    pickup_point_name            TEXT,
    pickup_point_address         TEXT,
    status                       shipment_status NOT NULL DEFAULT 'pending',
    booked_at                    TIMESTAMPTZ,
    printed_at                   TIMESTAMPTZ,
    shipped_at                   TIMESTAMPTZ,
    delivered_at                 TIMESTAMPTZ,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipments_conversation   ON shipments(conversation_id);
CREATE INDEX idx_shipments_seller         ON shipments(seller_institution_id);
CREATE INDEX idx_shipments_buyer          ON shipments(buyer_institution_id);
CREATE INDEX idx_shipments_status         ON shipments(status);
CREATE INDEX idx_shipments_shipmondo_id   ON shipments(shipmondo_shipment_id) WHERE shipmondo_shipment_id IS NOT NULL;

-- ── shipping_invoices ─────────────────────────────────────────

CREATE TABLE shipping_invoices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id   UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
    invoice_number   TEXT UNIQUE NOT NULL,    -- fx "BL-SHIP-2026-001"
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    total_amount_dkk DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status           invoice_status NOT NULL DEFAULT 'draft',
    due_date         DATE NOT NULL,
    html_url         TEXT,                    -- link til HTML i Supabase Storage
    sent_at          TIMESTAMPTZ,
    paid_at          TIMESTAMPTZ,
    marked_paid_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_invoices_institution ON shipping_invoices(institution_id);
CREATE INDEX idx_shipping_invoices_status      ON shipping_invoices(status);
CREATE INDEX idx_shipping_invoices_due_date    ON shipping_invoices(due_date);

-- ── shipping_invoice_lines ────────────────────────────────────

CREATE TABLE shipping_invoice_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipping_invoice_id UUID NOT NULL REFERENCES shipping_invoices(id) ON DELETE CASCADE,
    shipment_id         UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    description         TEXT NOT NULL,
    amount_dkk          DECIMAL(8,2) NOT NULL,
    shipment_date       DATE NOT NULL,
    tracking_number     TEXT
);

CREATE INDEX idx_invoice_lines_invoice  ON shipping_invoice_lines(shipping_invoice_id);
CREATE INDEX idx_invoice_lines_shipment ON shipping_invoice_lines(shipment_id);

-- ── Udvid conversations ───────────────────────────────────────

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS delivery_method  delivery_method,
    ADD COLUMN IF NOT EXISTS delivery_status  delivery_status_enum DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS shipment_id      UUID REFERENCES shipments(id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_shipment ON conversations(shipment_id) WHERE shipment_id IS NOT NULL;

-- ── Udvid institutions ────────────────────────────────────────

ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS shipping_billing_enabled    BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS shipping_credit_limit_dkk   DECIMAL(8,2) NOT NULL DEFAULT 500.00,
    ADD COLUMN IF NOT EXISTS shipping_current_balance_dkk DECIMAL(8,2) NOT NULL DEFAULT 0.00;

-- ── RLS Policies ──────────────────────────────────────────────

ALTER TABLE shipping_options       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipmondo_price_cache  ENABLE ROW LEVEL SECURITY;

-- shipping_options: anyone can read (listings are public), only owner can write
CREATE POLICY "shipping_options_public_read"
    ON shipping_options FOR SELECT USING (true);

CREATE POLICY "shipping_options_owner_write"
    ON shipping_options FOR ALL
    USING (
        listing_id IN (
            SELECT id FROM listings WHERE user_id = auth.uid()
        )
    );

-- shipmondo_price_cache: public read, no direct write (only via service role / cron)
CREATE POLICY "price_cache_public_read"
    ON shipmondo_price_cache FOR SELECT USING (true);

-- shipments: involved parties can read their own
CREATE POLICY "shipments_seller_read"
    ON shipments FOR SELECT
    USING (
        seller_institution_id IN (
            SELECT inst.id FROM institutions inst
            JOIN institution_members mem ON mem.institution_id = inst.id
            WHERE mem.email = auth.email()
            UNION
            SELECT id FROM institutions WHERE email = auth.email()
        )
    );

CREATE POLICY "shipments_buyer_read"
    ON shipments FOR SELECT
    USING (
        buyer_institution_id IN (
            SELECT inst.id FROM institutions inst
            JOIN institution_members mem ON mem.institution_id = inst.id
            WHERE mem.email = auth.email()
            UNION
            SELECT id FROM institutions WHERE email = auth.email()
        )
    );

-- shipping_invoices: only the institution itself can read
CREATE POLICY "shipping_invoices_institution_read"
    ON shipping_invoices FOR SELECT
    USING (
        institution_id IN (
            SELECT inst.id FROM institutions inst
            JOIN institution_members mem ON mem.institution_id = inst.id
            WHERE mem.email = auth.email()
            UNION
            SELECT id FROM institutions WHERE email = auth.email()
        )
    );

CREATE POLICY "shipping_invoice_lines_institution_read"
    ON shipping_invoice_lines FOR SELECT
    USING (
        shipping_invoice_id IN (
            SELECT si.id FROM shipping_invoices si
            WHERE si.institution_id IN (
                SELECT inst.id FROM institutions inst
                JOIN institution_members mem ON mem.institution_id = inst.id
                WHERE mem.email = auth.email()
                UNION
                SELECT id FROM institutions WHERE email = auth.email()
            )
        )
    );

-- ── updated_at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER shipping_options_updated_at
    BEFORE UPDATE ON shipping_options
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================
-- NED-MIGRATION (kør for at rulle tilbage)
-- =============================================================
-- ALTER TABLE conversations
--     DROP COLUMN IF EXISTS delivery_method,
--     DROP COLUMN IF EXISTS delivery_status,
--     DROP COLUMN IF EXISTS shipment_id;
--
-- ALTER TABLE institutions
--     DROP COLUMN IF EXISTS shipping_billing_enabled,
--     DROP COLUMN IF EXISTS shipping_credit_limit_dkk,
--     DROP COLUMN IF EXISTS shipping_current_balance_dkk;
--
-- DROP TABLE IF EXISTS shipping_invoice_lines;
-- DROP TABLE IF EXISTS shipping_invoices;
-- DROP TABLE IF EXISTS shipments;
-- DROP TABLE IF EXISTS shipmondo_price_cache;
-- DROP TABLE IF EXISTS shipping_options;
--
-- DROP TYPE IF EXISTS delivery_status_enum;
-- DROP TYPE IF EXISTS delivery_method;
-- DROP TYPE IF EXISTS invoice_status;
-- DROP TYPE IF EXISTS shipment_status;
-- DROP TYPE IF EXISTS shipping_service_type;
-- DROP TYPE IF EXISTS shipping_carrier;
-- DROP TYPE IF EXISTS shipping_size_category;
-- =============================================================
