-- Repair StockBalance rows that missed stock movements.
--
-- Purchases, sales, returns and transfers used to change stock with a bare
-- UPDATE "StockBalance" ... WHERE StockID/BranchID. When a stock had no row
-- for that branch yet (e.g. a newly created item), the UPDATE matched nothing
-- and the movement was silently lost - so Stock Adjustment's "current stock"
-- (read from StockBalance) disagreed with the "Stock Balance As Of Date"
-- report (which sums the movements). The backend now creates the row
-- (lib/stockBalance.js).
--
-- This sets every stock+branch balance that disagrees with its movement total
-- to that total - the same formula the report uses - creating missing rows.
-- Safe to re-run: once balances match, it changes nothing.
-- Run by hand in the Supabase SQL editor, after the backend fix is deployed.

BEGIN;

CREATE TEMP TABLE calc ON COMMIT DROP AS
SELECT sm."StockID", b.id AS "BranchID",
    COALESCE((SELECT SUM(pd."Qty") FROM "PurchaseDtl" pd JOIN "PurchaseHdr" ph ON pd."PurchaseHDRID" = ph."PurchaseID"
      WHERE pd."StockCode"::int = sm."StockID" AND ph."BranchID" = b.id), 0)
  + COALESCE((SELECT SUM(srd."Qty") FROM "SaleReturnDtl" srd JOIN "SaleReturnHDR" srh ON srd."SaleReturnHdrID" = srh."SaleReturnHDRID"
      WHERE srd."StockID" = sm."StockID" AND srh."BranchID" = b.id), 0)
  + COALESCE((SELECT SUM(td."Qty") FROM "TransferDtl" td JOIN "TransferHdr" th ON td."TransferHdrID" = th."TransferID"
      WHERE td."FK_StockCode"::int = sm."StockID" AND th."TransferStatus" = 'Done' AND th."ToBranchID" = b.id), 0)
  - COALESCE((SELECT SUM(sd."Qty") FROM "SaleDtl" sd JOIN "SaleHdr" sh ON sd."SaleHDRID" = sh."SaleID"
      WHERE sd."StockCode"::int = sm."StockID" AND sh."BranchID" = b.id), 0)
  - COALESCE((SELECT SUM(rd."Qty") FROM "ReturnDtl" rd JOIN "ReturnHdr" rh ON rd."ReturnHDRID" = rh."ReturnID"
      WHERE rd."StockCode"::int = sm."StockID" AND rh."BranchID" = b.id), 0)
  - COALESCE((SELECT SUM(td."Qty") FROM "TransferDtl" td JOIN "TransferHdr" th ON td."TransferHdrID" = th."TransferID"
      WHERE td."FK_StockCode"::int = sm."StockID" AND th."FromBranchID" = b.id), 0)  -- leaves the source when created (Open)
  + COALESCE((SELECT SUM(a."AdjustedQty" - a."CurrentQty") FROM "Adjustment" a
      WHERE a."StockID" = sm."StockID" AND a."BranchID" = b.id), 0)
  AS "Qty"
FROM "StockMaster" sm CROSS JOIN "Branch" b;

UPDATE "StockBalance" sb SET "Qty" = c."Qty"
FROM calc c
WHERE sb."StockID" = c."StockID" AND sb."BranchID" = c."BranchID" AND sb."Qty" <> c."Qty";

INSERT INTO "StockBalance" ("StockID", "Qty", "BranchID")
SELECT c."StockID", c."Qty", c."BranchID" FROM calc c
WHERE c."Qty" <> 0
  AND NOT EXISTS (SELECT 1 FROM "StockBalance" sb WHERE sb."StockID" = c."StockID" AND sb."BranchID" = c."BranchID");

COMMIT;
