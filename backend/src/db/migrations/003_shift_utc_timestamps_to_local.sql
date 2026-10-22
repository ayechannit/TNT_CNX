-- One-time fix: shift web-app timestamps from UTC to Thailand time (UTC+7).
--
-- Until this fix the web app stamped "timestamp without time zone" columns
-- with now() / JS toISOString(), and the Supabase session runs in UTC - so
-- every save time since the web app went live (2026-09-10) was stored 7 hours
-- behind. Legacy rows (before 2026-09) were written in local time and are
-- left alone. Date-only values (time exactly 00:00, e.g. a payment dated by
-- the sale date) are left alone too. CategoryMaster's audit dates are text
-- columns (not shown anywhere) and are not touched.
--
-- HOW TO RUN (once, by hand, in the Supabase SQL editor):
--   1. Deploy the backend fix first.
--   2. Replace DEPLOY_UTC below with the UTC time the new backend went live,
--      e.g. '2026-10-23 02:00'. Rows saved before that are UTC (always below
--      it); rows saved after it are already local time (always at least 7
--      hours above it), so the two never overlap.
--   3. Run the whole script. It prints how many rows each column shifted.
--   Running it twice would shift the same rows twice - don't.

DO $$
DECLARE
  from_ts   constant timestamp := '2026-09-01 00:00';
  deploy_ts constant timestamp := 'DEPLOY_UTC';  -- <-- fill in
  target    record;
  n         bigint;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('SaleHdr',       'CreateDate'), ('SaleHdr',       'UpdateDate'),
      ('SaleDtl',       'CreateDate'), ('SaleDtl',       'UpdateDate'),
      ('PurchaseHdr',   'CreateDate'), ('PurchaseHdr',   'UpdateDate'),
      ('PurchaseDtl',   'CreateDate'), ('PurchaseDtl',   'UpdateDate'),
      ('ReturnHdr',     'CreateDate'), ('ReturnHdr',     'UpdateDate'),
      ('ReturnDtl',     'CreateDate'), ('ReturnDtl',     'UpdateDate'),
      ('SaleReturnHDR', 'ReturnDate'),
      ('SaleReturnHDR', 'CreateDate'), ('SaleReturnHDR', 'UpdateDate'),
      ('SaleReturnDtl', 'CreateDate'), ('SaleReturnDtl', 'UpdateDate'),
      ('TransferHdr',   'CreateDate'), ('TransferHdr',   'UpdateDate'),
      ('Adjustment',    'AdjustmentDate'),
      ('Adjustment',    'CreateDate'), ('Adjustment',    'UpdateDate'),
      ('StockMaster',   'CreateDate'), ('StockMaster',   'UpdateDate'),
      ('Payment',       'paymentdate'), ('Payment',      'createdate'),
      ('Expense',       'createdate'), ('Expense',       'updatedate'),
      ('Expense',       'LastModifiedDate'),
      ('ExpenseType',   'createdate'), ('ExpenseType',   'updatedate'),
      ('UserRole',      'createdate')
    ) AS t(tbl, col)
  LOOP
    EXECUTE format(
      'UPDATE %I SET %I = %I + interval ''7 hours''
        WHERE %I >= $1 AND %I < $2 AND %I::time <> ''00:00''',
      target.tbl, target.col, target.col, target.col, target.col, target.col)
      USING from_ts, deploy_ts;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '%.%: % rows', target.tbl, target.col, n;
  END LOOP;
END $$;
