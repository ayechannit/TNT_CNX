-- Performance indexes for MPOS.
--
-- The schema as inherited only has primary-key indexes. That's invisible at
-- today's row counts (dozens to hundreds of rows per table) but becomes the
-- single biggest cause of "the app got slow" as real transaction history
-- accumulates - every list/search does a sequential scan, and voucher code
-- generation (Sale/Purchase/Return/Transfer) counts rows in an ever-growing,
-- unindexed *NumberGenerator table on every single save, so it gets slower
-- every day regardless of how busy any given day is.
--
-- All statements are additive (CREATE INDEX IF NOT EXISTS) and safe to
-- re-run. Nothing here changes data or behavior, only query speed.

-- Voucher numbering: fixes the compounding-over-time issue described above.
CREATE INDEX IF NOT EXISTS idx_salenumgen_branch_date ON "SaleNumberGenerator" ("BranchId", "CreatedDate");
CREATE INDEX IF NOT EXISTS idx_purchasenumgen_branch_date ON "PurchaseNumberGenerator" ("BranchId", "CreatedDate");
CREATE INDEX IF NOT EXISTS idx_returnnumgen_branch_date ON "ReturnNumberGenerator" ("BranchId", "CreatedDate");
CREATE INDEX IF NOT EXISTS idx_transfernumgen_branch_date ON "TransferNumberGenerator" (branchid, "CreatedDate");

-- Header list filters (branch / status / date range / foreign keys).
CREATE INDEX IF NOT EXISTS idx_salehdr_branch ON "SaleHdr" ("BranchID");
CREATE INDEX IF NOT EXISTS idx_salehdr_date ON "SaleHdr" ("SaleDate");
CREATE INDEX IF NOT EXISTS idx_salehdr_status ON "SaleHdr" ("Status");
CREATE INDEX IF NOT EXISTS idx_salehdr_patient ON "SaleHdr" ("PatientID");

CREATE INDEX IF NOT EXISTS idx_purchasehdr_branch ON "PurchaseHdr" ("BranchID");
CREATE INDEX IF NOT EXISTS idx_purchasehdr_date ON "PurchaseHdr" ("PurchaseDate");
CREATE INDEX IF NOT EXISTS idx_purchasehdr_status ON "PurchaseHdr" ("Status");
CREATE INDEX IF NOT EXISTS idx_purchasehdr_supplier ON "PurchaseHdr" ("SupplierID");

CREATE INDEX IF NOT EXISTS idx_returnhdr_branch ON "ReturnHdr" ("BranchID");
CREATE INDEX IF NOT EXISTS idx_returnhdr_date ON "ReturnHdr" ("Date");
CREATE INDEX IF NOT EXISTS idx_returnhdr_status ON "ReturnHdr" ("Status");
CREATE INDEX IF NOT EXISTS idx_returnhdr_supplier ON "ReturnHdr" ("SupplierID");
CREATE INDEX IF NOT EXISTS idx_returnhdr_type ON "ReturnHdr" ("Type");

CREATE INDEX IF NOT EXISTS idx_transferhdr_from_branch ON "TransferHdr" ("FromBranchID");
CREATE INDEX IF NOT EXISTS idx_transferhdr_to_branch ON "TransferHdr" ("ToBranchID");
CREATE INDEX IF NOT EXISTS idx_transferhdr_date ON "TransferHdr" ("TransferDate");
CREATE INDEX IF NOT EXISTS idx_transferhdr_status ON "TransferHdr" ("TransferStatus");

CREATE INDEX IF NOT EXISTS idx_salereturnhdr_branch ON "SaleReturnHDR" ("BranchID");
CREATE INDEX IF NOT EXISTS idx_salereturnhdr_date ON "SaleReturnHDR" ("ReturnDate");
-- SaleReturnHDR links back to SaleHdr by code, not ID - see create() in saleReturnController.js.
CREATE INDEX IF NOT EXISTS idx_salereturnhdr_salecode ON "SaleReturnHDR" ("SaleCode");

CREATE INDEX IF NOT EXISTS idx_expense_branch ON "Expense" (branchid);
CREATE INDEX IF NOT EXISTS idx_expense_date ON "Expense" (expensedate);
CREATE INDEX IF NOT EXISTS idx_expense_type ON "Expense" (expensetypeid);

CREATE INDEX IF NOT EXISTS idx_adjustment_branch ON "Adjustment" ("BranchID");
CREATE INDEX IF NOT EXISTS idx_adjustment_stock ON "Adjustment" ("StockID");
CREATE INDEX IF NOT EXISTS idx_adjustment_date ON "Adjustment" ("AdjustmentDate");

-- Detail-table joins back to their header (every voucher view/edit/delete
-- hits these; without an index each is a full scan of the detail table).
CREATE INDEX IF NOT EXISTS idx_saledtl_hdr ON "SaleDtl" ("SaleHDRID");
CREATE INDEX IF NOT EXISTS idx_purchasedtl_hdr ON "PurchaseDtl" ("PurchaseHDRID");
CREATE INDEX IF NOT EXISTS idx_returndtl_hdr ON "ReturnDtl" ("ReturnHDRID");
CREATE INDEX IF NOT EXISTS idx_transferdtl_hdr ON "TransferDtl" ("TransferHdrID");
CREATE INDEX IF NOT EXISTS idx_salereturndtl_hdr ON "SaleReturnDtl" ("SaleReturnHdrID");

-- StockBalance: looked up/updated on every sale, purchase, transfer,
-- adjustment, and the barcode-print balance lookup. Composite because it's
-- always queried by both columns together.
CREATE INDEX IF NOT EXISTS idx_stockbalance_stock_branch ON "StockBalance" ("StockID", "BranchID");

-- Stock browsing/filtering.
CREATE INDEX IF NOT EXISTS idx_stockmaster_category ON "StockMaster" ("CategoryID");
CREATE INDEX IF NOT EXISTS idx_stockmaster_status ON "StockMaster" (status);

-- Trigram search support: a plain B-tree index can't help a leading-wildcard
-- ILIKE '%text%' query, which is what every search box in this app uses.
-- pg_trgm + a GIN index lets Postgres use an index for those instead of a
-- full table scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_stockmaster_name_trgm ON "StockMaster" USING gin ("StockName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_stockmaster_code_trgm ON "StockMaster" USING gin ("StockCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patientmaster_name_trgm ON "PatientMaster" USING gin ("PatientName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patientmaster_phone_trgm ON "PatientMaster" USING gin ("PhoneNo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patientmaster_member_trgm ON "PatientMaster" USING gin ("memberID" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_salehdr_code_trgm ON "SaleHdr" USING gin ("SaleCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_purchasehdr_code_trgm ON "PurchaseHdr" USING gin ("PurchaseCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_transferhdr_code_trgm ON "TransferHdr" USING gin ("TransferCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_returnhdr_code_trgm ON "ReturnHdr" USING gin ("ReturnCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliermaster_name_trgm ON "SupplierMaster" USING gin ("SupplierName" gin_trgm_ops);

-- Report-specific: Payment is joined by ~6 reports (cash receipts/payments,
-- debtor/creditor lists, cash flow summary) on code/tablename/paymentdate/
-- branchid and had no index at all beyond its PK.
CREATE INDEX IF NOT EXISTS idx_payment_code ON "Payment" (code);
CREATE INDEX IF NOT EXISTS idx_payment_tablename ON "Payment" (tablename);
CREATE INDEX IF NOT EXISTS idx_payment_date ON "Payment" (paymentdate);
CREATE INDEX IF NOT EXISTS idx_payment_branch ON "Payment" (branchid);

-- Report-specific: SaleDtl/PurchaseDtl/ReturnDtl.StockCode and
-- TransferDtl.FK_StockCode are stored as varchar but every report joins them
-- to StockMaster.StockID via an explicit ::int cast. A plain index on the
-- text column can't satisfy that comparison - it needs an expression index
-- on the cast itself. Used by every *_detail_report, *_summary_by_item,
-- monthly_*_by_item, refund_by_stock, and stock_balance_by_date.
CREATE INDEX IF NOT EXISTS idx_saledtl_stockcode_int ON "SaleDtl" ((("StockCode")::int));
CREATE INDEX IF NOT EXISTS idx_purchasedtl_stockcode_int ON "PurchaseDtl" ((("StockCode")::int));
CREATE INDEX IF NOT EXISTS idx_returndtl_stockcode_int ON "ReturnDtl" ((("StockCode")::int));
CREATE INDEX IF NOT EXISTS idx_transferdtl_fkstockcode_int ON "TransferDtl" ((("FK_StockCode")::int));
CREATE INDEX IF NOT EXISTS idx_salereturndtl_stockid ON "SaleReturnDtl" ("StockID");
