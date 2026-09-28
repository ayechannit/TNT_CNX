-- Unique voucher codes for MPOS.
--
-- Voucher codes (Sale/Purchase/Return/Transfer) are generated per branch+date
-- by counting rows in a *NumberGenerator table inside the save transaction.
-- The application now takes a transaction-scoped advisory lock per branch+date
-- so two concurrent saves can't read the same count and mint the same code,
-- and because the count is derived inside the transaction a rolled-back save
-- frees its number instead of leaving a gap.
--
-- These unique indexes are the database-level backstop: even if a code were
-- ever generated twice (a bug, a manual insert, a future code path that skips
-- the lock), the second COMMIT fails instead of silently storing a duplicate.
-- The branch number is embedded in every code, so codes are globally unique
-- and a single-column unique index is correct.
--
-- Safe to run once existing data is duplicate-free (verified before adding).
-- IF NOT EXISTS makes it re-runnable.

CREATE UNIQUE INDEX IF NOT EXISTS uq_salehdr_salecode ON "SaleHdr" ("SaleCode");
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchasehdr_purchasecode ON "PurchaseHdr" ("PurchaseCode");
CREATE UNIQUE INDEX IF NOT EXISTS uq_returnhdr_returncode ON "ReturnHdr" ("ReturnCode");
CREATE UNIQUE INDEX IF NOT EXISTS uq_transferhdr_transfercode ON "TransferHdr" ("TransferCode");
