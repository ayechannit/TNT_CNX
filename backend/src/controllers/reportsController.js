const pool = require("../db/pool");

// Reporting layer ported from the ~45 legacy R_* stored procedures.
//
// A handful of the legacy procs were intentionally NOT ported 1:1:
//  - R_SaleVoucher, R_Slip, R_OpticSlip, R_PurchaseVoucher, R_ReturnVoucher,
//    R_ReturnSlip, R_Return, R_Purchase, R_SaleReturnVoucher, R_TransferSlip,
//    R_DebitVoucher - these are all "look up one existing voucher's data for
//    printing/reprint", which is already covered by the getById endpoints on
//    /api/sales, /api/purchases, /api/returns, /api/sale-returns, /api/transfers.
//  - R_Get_Profit / R_BalanceSheet - these just `SELECT * FROM` a cached temp
//    table (temp_profit / temp_balancesheet) that only R_Profit itself (for
//    temp_profit) populates as a side effect of being called; temp_balancesheet
//    has no known populating proc in this database at all (1 stale row, likely
//    populated manually once). Ported R_Profit's live computation as
//    `profit_report` instead, and added `balance_sheet_cashflow` as a live
//    equivalent of the balance sheet's intent (Payment totals grouped by
//    tablename for a date range) rather than reading frozen/orphaned data.
//  - R_StockUsage and R_TransferStock reference tables that do not exist in
//    this migrated schema at all (DailyTransactionHDR/DTL, BranchMaster,
//    StockUnit, BrandMaster, UnitMaster) - confirmed via information_schema.
//    They are legacy/broken in TNTV1_CNX itself, so left out.
//  - R_PurchaseLens folded into `purchase_summary_by_item` (same shape as
//    R_PurchaseStock, just pre-filtered to one category) - added an optional
//    categoryId filter instead of a separate report.

const ROW_LIMIT = 5000;

function need(query, name) {
  const v = query[name];
  if (v === undefined || v === null || v === "") throw Object.assign(new Error(`${name} is required`), { status: 400 });
  return v;
}
function opt(query, name, fallback = null) {
  const v = query[name];
  return v === undefined || v === "" ? fallback : v;
}

// Each report: { label, category, params: [{name,label,type,required}], build(query) => {text, values} }
const REPORTS = {
  // ---------- Sales ----------
  sales_report: {
    label: "Sale Report (Summary)",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT h."SaleDate", h."SaleCode", p."PatientName" AS "CustomerName",
                (COALESCE(p."Age",'') || '/' || COALESCE(p."PhoneNo",'')) AS "CustomerInfo", p."memberID",
                (h."TotalAmount" + h."Discount" + h."Tax") AS "TotalAmount", h."Discount",
                h."TotalAmount" AS "NetAmount", h."Paid" AS "Receive", h."LeftOver" AS "Balance", h."Note" AS "Remark"
         FROM "SaleHdr" h JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
         WHERE h."SaleDate"::date BETWEEN $1::date AND $2::date AND h."BranchID" = $3
         ORDER BY h."SaleDate" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  sales_detail_report: {
    label: "Sale Report (Item Detail)",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT h."SaleDate", h."SaleCode", p."PatientName" AS "CustomerName",
                (COALESCE(p."Age",'') || '/' || COALESCE(p."PhoneNo",'')) AS "CustomerInfo", p."memberID",
                s."StockCode", s."StockName", d."Qty", d."Price", d."Amount", h."Note" AS "Remark"
         FROM "SaleHdr" h JOIN "SaleDtl" d ON h."SaleID" = d."SaleHDRID"
         JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
         JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         WHERE h."SaleDate"::date BETWEEN $1::date AND $2::date AND h."BranchID" = $3
         ORDER BY h."SaleDate" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  sales_by_cashier: {
    label: "Sales By Item / Cashier",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }, { name: "cashierUserId", type: "text", required: false }],
    build(q) {
      const cashier = opt(q, "cashierUserId", "");
      return {
        text: `SELECT s."StockName", SUM(d."Qty") AS "Qty", d."Price", c."CategoryName", u."RealName",
                SUM(d."Amount") AS "Amount"
         FROM "SaleHdr" h JOIN "SaleDtl" d ON h."SaleID" = d."SaleHDRID"
         JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
         JOIN "UserMaster" u ON u."UserID" = h."CreateUser"::int
         WHERE h."SaleDate"::date BETWEEN $1::date AND $2::date AND h."BranchID" = $3
           AND ($4 = '' OR h."CreateUser" = $4)
         GROUP BY s."StockName", d."Price", c."CategoryName", u."RealName"
         ORDER BY s."StockName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId"), cashier],
      };
    },
  },
  monthly_sale_by_item: {
    label: "Monthly Sale By Item (Current Month)",
    category: "Sales",
    params: [{ name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT (s."StockCode" || ' - ' || s."StockName") AS "StockName", SUM(d."Qty") AS "Qty", d."Price", c."CategoryName"
         FROM "SaleHdr" h JOIN "SaleDtl" d ON h."SaleID" = d."SaleHDRID"
         JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
         WHERE date_trunc('month', h."SaleDate"::date) = date_trunc('month', now() - interval '1 day')
           AND h."BranchID" = $1
         GROUP BY s."StockName", d."Price", c."CategoryName", s."StockCode"
         ORDER BY s."StockName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId")],
      };
    },
  },
  cash_receipts_sale: {
    label: "Cash Receipts (Sales)",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT p.paymentdate AS "ReceiveDate", p.code AS "SaleVoucher", pm."PatientName" AS "CustomerName",
                (COALESCE(pm."Age",'') || '/' || COALESCE(pm."PhoneNo",'')) AS "CustomerInfo", pm."memberID",
                p.paidamount AS "Received"
         FROM "Payment" p JOIN "SaleHdr" h ON h."SaleCode" = p.code
         JOIN "PatientMaster" pm ON h."PatientID" = pm."PatientID"
         WHERE (p.tablename = 'SALE' OR p.tablename = 'DEBITPAID')
           AND p.paymentdate::date BETWEEN $1::date AND $2::date AND p.branchid = $3
         ORDER BY p.paymentdate LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  sale_debtors_by_customer: {
    label: "Sale Debtors By Customer",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }, { name: "search", type: "text", required: false }],
    build(q) {
      const search = opt(q, "search", "");
      return {
        text: `SELECT pm."PatientID", pm."PatientName", pm."PhoneNo",
                SUM(h."TotalAmount") AS "TotalAmount", SUM(COALESCE(h."Paid",0)) AS "TotalPaid",
                SUM(COALESCE(p.paidamount,0)) AS "LeftOver"
         FROM "SaleHdr" h JOIN "PatientMaster" pm ON h."PatientID" = pm."PatientID"
         LEFT JOIN "Payment" p ON h."SaleCode" = p.code AND p.tablename = 'SALEDEBIT'
         WHERE h."BranchID" = $1 AND h."SaleDate"::date BETWEEN $2::date AND $3::date
           AND ($4 = '' OR pm."PatientName" ILIKE '%' || $4 || '%' OR pm."PhoneNo" ILIKE '%' || $4 || '%')
         GROUP BY pm."PatientID", pm."PatientName", pm."PhoneNo"
         ORDER BY pm."PatientName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId"), need(q, "fromDate"), need(q, "toDate"), search],
      };
    },
  },
  sale_debtors_by_voucher: {
    label: "Sale Debtors By Voucher",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }, { name: "search", type: "text", required: false }],
    build(q) {
      const search = opt(q, "search", "");
      return {
        text: `SELECT h."SaleCode", h."SaleDate"::date AS "SaleDate",
                (pm."PatientName" || '/' || pm."PhoneNo") AS "PatientName",
                h."TotalAmount", h."Paid", p.paidamount AS "LeftOver"
         FROM "SaleHdr" h JOIN "PatientMaster" pm ON h."PatientID" = pm."PatientID"
         LEFT JOIN "Payment" p ON h."SaleCode" = p.code AND p.tablename = 'SALEDEBIT'
         WHERE h."BranchID" = $1 AND h."SaleDate"::date BETWEEN $2::date AND $3::date
           AND ($4 = '' OR h."SaleCode" ILIKE '%' || $4 || '%')
         ORDER BY h."SaleCode" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId"), need(q, "fromDate"), need(q, "toDate"), search],
      };
    },
  },
  sale_debit_receive: {
    label: "Sale Debit Payments Received",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT p.paymentdate, h."SaleCode", p.paidamount, h."TotalAmount", pm."PatientName", pm."PhoneNo", pm."Sex"
         FROM "Payment" p JOIN "SaleHdr" h ON p.code = h."SaleCode"
         JOIN "PatientMaster" pm ON h."PatientID" = pm."PatientID"
         WHERE p.tablename = 'DEBITPAID' AND h."Status" != 'Delete'
           AND p.paymentdate::date BETWEEN $1::date AND $2::date AND p.branchid = $3
         ORDER BY h."SaleCode" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  refund_service_sales: {
    label: "Service Sales (Category 2) Summary",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT s."StockName", SUM(d."Qty") AS "Qty", d."Price", SUM(d."Amount") AS "Amount"
         FROM "SaleDtl" d JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         JOIN "SaleHdr" h ON d."SaleHDRID" = h."SaleID"
         WHERE s."CategoryID" = 2 AND h."SaleDate"::date BETWEEN $1::date AND $2::date AND h."BranchID" = $3
         GROUP BY s."StockName", d."Price" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  refund_by_stock: {
    label: "Sales Of One Item By Date",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "stockId", type: "stock", required: true }],
    build(q) {
      return {
        text: `SELECT h."SaleDate", h."SaleCode", p."PatientName", s."StockName", d."Qty", d."Price", d."Amount"
         FROM "SaleDtl" d JOIN "SaleHdr" h ON d."SaleHDRID" = h."SaleID"
         JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
         JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         WHERE h."SaleDate"::date BETWEEN $1::date AND $2::date AND d."StockCode" = $3
         ORDER BY h."SaleDate" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), String(need(q, "stockId"))],
      };
    },
  },
  member_usage_count: {
    label: "Member Usage Count",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "search", type: "text", required: false }],
    build(q) {
      const search = opt(q, "search", "");
      return {
        text: `SELECT * FROM (
           SELECT p."PatientID", p."PatientName", p."memberID",
             (SELECT COUNT(*) FROM "OpticSale" o WHERE o.memberid = p."memberID" AND o.memberid <> ''
               AND o.createdate::date BETWEEN $1::date AND $2::date) AS "MCount"
           FROM "PatientMaster" p
           WHERE p."PatientName" ILIKE '%' || $3 || '%' OR p."memberID" ILIKE '%' || $3 || '%'
         ) a WHERE a."MCount" > 0 ORDER BY a."MCount" DESC LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), search],
      };
    },
  },
  member_usage_voucher: {
    label: "Member Usage Vouchers",
    category: "Sales",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "search", type: "text", required: false }],
    build(q) {
      const search = opt(q, "search", "");
      return {
        text: `SELECT s."SaleCode", p."PatientName", s."TotalAmount", s."Discount", o.memberid AS "MemberID",
                pm."PatientName" AS "MemberName"
         FROM "OpticSale" o
         JOIN "SaleHdr" s ON o.salehdrid = s."SaleID"
         JOIN "PatientMaster" p ON s."PatientID" = p."PatientID"
         LEFT JOIN "PatientMaster" pm ON o.memberid = pm."memberID"
         WHERE (s."SaleCode" ILIKE '%' || $1 || '%' OR o.memberid ILIKE '%' || $1 || '%' OR pm."PatientName" ILIKE '%' || $1 || '%')
           AND s."SaleDate"::date BETWEEN $2::date AND $3::date
         ORDER BY s."SaleDate" LIMIT ${ROW_LIMIT}`,
        values: [search, need(q, "fromDate"), need(q, "toDate")],
      };
    },
  },

  // ---------- Purchases ----------
  purchase_report: {
    label: "Purchase Report (Summary)",
    category: "Purchases",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT h."PurchaseDate", h."PurchaseCode", s."SupplierName", s."PhoneNo" AS "SupplierInfo",
                (h."TotalAmount" + h."Discount" + h."Tax") AS "TotalAmount", h."Discount",
                h."TotalAmount" AS "NetAmount", h."Paid" AS "Receive", h."LeftOver" AS "Balance", h."Note" AS "Remark"
         FROM "PurchaseHdr" h JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
         WHERE h."PurchaseDate"::date BETWEEN $1::date AND $2::date AND h."BranchID" = $3
         ORDER BY h."PurchaseDate" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  purchase_detail_report: {
    label: "Purchase Report (Item Detail)",
    category: "Purchases",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT h."PurchaseDate", h."PurchaseCode", s."SupplierName" AS "CustomerName", s."PhoneNo" AS "SupplierInfo",
                st."StockCode", st."StockName", d."Qty", d."Price", d."Amount", h."Note" AS "Remark"
         FROM "PurchaseHdr" h JOIN "PurchaseDtl" d ON h."PurchaseID" = d."PurchaseHDRID"
         JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
         JOIN "StockMaster" st ON d."StockCode"::int = st."StockID"
         WHERE h."PurchaseDate"::date BETWEEN $1::date AND $2::date AND h."BranchID" = $3
         ORDER BY h."PurchaseDate" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  purchase_summary_by_item: {
    label: "Purchase Summary By Item",
    category: "Purchases",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }, { name: "supplierId", type: "supplier", required: false }, { name: "categoryId", type: "category", required: false }],
    build(q) {
      const supplierId = opt(q, "supplierId", "");
      const categoryId = opt(q, "categoryId", "");
      return {
        text: `SELECT s."StockName", SUM(d."Qty") AS "Qty", d."Price", c."CategoryName", sup."SupplierName",
                SUM(d."Amount") AS "Amount"
         FROM "PurchaseHdr" h JOIN "PurchaseDtl" d ON h."PurchaseID" = d."PurchaseHDRID"
         JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
         JOIN "SupplierMaster" sup ON h."SupplierID" = sup."SupplierID"
         WHERE h."PurchaseDate"::date BETWEEN $1::date AND $2::date AND h."BranchID" = $3
           AND ($4 = '' OR h."SupplierID"::text = $4)
           AND ($5 = '' OR s."CategoryID"::text = $5)
         GROUP BY s."StockName", d."Price", c."CategoryName", sup."SupplierName"
         ORDER BY s."StockName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId"), supplierId, categoryId],
      };
    },
  },
  monthly_purchase_by_item: {
    label: "Monthly Purchase By Item (Current Month)",
    category: "Purchases",
    params: [{ name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT (s."StockCode" || '-' || s."StockName") AS "StockName", SUM(d."Qty") AS "Qty", d."Price", c."CategoryName"
         FROM "PurchaseHdr" h JOIN "PurchaseDtl" d ON h."PurchaseID" = d."PurchaseHDRID"
         JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
         WHERE date_trunc('month', h."PurchaseDate"::date) = date_trunc('month', now() - interval '1 day')
           AND h."BranchID" = $1
         GROUP BY s."StockCode", s."StockName", d."Price", c."CategoryName"
         ORDER BY s."StockName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId")],
      };
    },
  },
  cash_payments_purchase: {
    label: "Cash Payments (Purchases)",
    category: "Purchases",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT p.paymentdate AS "ReceiveDate", p.code AS "SaleVoucher", sm."SupplierName", sm."PhoneNo" AS "CustomerInfo", p.paidamount AS "Paid"
         FROM "Payment" p JOIN "PurchaseHdr" h ON h."PurchaseCode" = p.code
         JOIN "SupplierMaster" sm ON h."SupplierID" = sm."SupplierID"
         WHERE (p.tablename = 'PURCHASE' OR p.tablename = 'CREDITPAID')
           AND p.paymentdate::date BETWEEN $1::date AND $2::date AND p.branchid = $3
         ORDER BY p.paymentdate LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  purchase_creditors: {
    label: "Purchase Creditors (Unpaid)",
    category: "Purchases",
    params: [{ name: "branchId", type: "branch", required: true }, { name: "supplierId", type: "supplier", required: false }],
    build(q) {
      const supplierId = opt(q, "supplierId", "");
      return {
        text: `SELECT h."PurchaseCode", h."PurchaseDate", s."SupplierName", h."Discount", h."Tax", h."TotalAmount", h."Paid", h."LeftOver", h."Note"
         FROM "PurchaseHdr" h JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
         WHERE h."Status" = 'LEFTOVER' AND h."BranchID" = $1
           AND ($2 = '' OR h."SupplierID"::text = $2)
         ORDER BY h."PurchaseDate" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId"), supplierId],
      };
    },
  },

  // ---------- Returns ----------
  return_summary_by_item: {
    label: "Return / Damage Summary By Item",
    category: "Returns",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }, { name: "type", type: "select", options: ["RETURN", "DAMAGE"], required: true }, { name: "supplierId", type: "supplier", required: false }],
    build(q) {
      const supplierId = opt(q, "supplierId", "");
      return {
        text: `SELECT h."Date", s."StockCode", s."StockName", SUM(d."Qty") AS "Qty", d."Price", c."CategoryName", sm."SupplierName",
                h."Type", SUM(d."Amount") AS "Amount"
         FROM "ReturnHdr" h JOIN "ReturnDtl" d ON h."ReturnID" = d."ReturnHDRID"
         JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
         JOIN "SupplierMaster" sm ON h."SupplierID" = sm."SupplierID"
         WHERE ($5 = '' OR h."SupplierID"::text = $5)
           AND h."Date"::date BETWEEN $1::date AND $2::date AND h."Type" = $4 AND h."BranchID" = $3
         GROUP BY h."Date", s."StockCode", s."StockName", d."Price", c."CategoryName", sm."SupplierName", h."Type"
         ORDER BY h."Date" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId"), need(q, "type"), supplierId],
      };
    },
  },
  monthly_return_by_item: {
    label: "Monthly Return / Damage By Item (Current Month)",
    category: "Returns",
    params: [{ name: "branchId", type: "branch", required: true }, { name: "status", type: "select", options: ["PAID", "LEFTOVER"], required: true }],
    build(q) {
      return {
        text: `SELECT s."StockName", SUM(d."Qty") AS "Qty", d."Price", c."CategoryName", h."Status"
         FROM "ReturnHdr" h JOIN "ReturnDtl" d ON h."ReturnID" = d."ReturnHDRID"
         JOIN "StockMaster" s ON d."StockCode"::int = s."StockID"
         JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
         WHERE date_trunc('month', h."Date"::date) = date_trunc('month', now() - interval '1 day')
           AND h."Status" = $2 AND h."BranchID" = $1
         GROUP BY s."StockName", d."Price", c."CategoryName", h."Status"
         ORDER BY s."StockName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId"), need(q, "status")],
      };
    },
  },
  return_creditors: {
    label: "Return / Damage Creditors (Unpaid)",
    category: "Returns",
    params: [{ name: "branchId", type: "branch", required: true }, { name: "type", type: "select", options: ["RETURN", "DAMAGE"], required: true }, { name: "supplierId", type: "supplier", required: false }],
    build(q) {
      const supplierId = opt(q, "supplierId", "");
      return {
        text: `SELECT h."ReturnCode", h."Date", s."SupplierName", h."TotalAmount", h."Paid", h."LeftOver", h."Note", h."Type"
         FROM "ReturnHdr" h JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
         WHERE h."BranchID" = $1 AND h."Status" = 'LEFTOVER' AND h."Type" = $2
           AND ($3 = '' OR h."SupplierID"::text = $3)
         ORDER BY h."Date" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId"), need(q, "type"), supplierId],
      };
    },
  },
  sale_return_summary: {
    label: "Sale Return Summary By Item",
    category: "Returns",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }],
    build(q) {
      return {
        text: `SELECT s."StockName", c."CategoryName", SUM(d."Qty") AS "Qty", d."Price", SUM(d."Amount") AS "Amount",
                (SELECT SUM(paidamount) FROM "Payment" WHERE tablename = 'SALERETURN' AND paymentdate::date BETWEEN $1::date AND $2::date) AS "TotalPaid"
         FROM "SaleReturnDtl" d JOIN "StockMaster" s ON d."StockID" = s."StockID"
         JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
         WHERE d."CreateDate"::date BETWEEN $1::date AND $2::date
         GROUP BY s."StockName", c."CategoryName", d."Price" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate")],
      };
    },
  },
  sale_return_by_customer: {
    label: "Sale Return Detail By Customer",
    category: "Returns",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT s."StockName", SUM(d."Qty") AS "Qty", d."Price", c."CategoryName", pm."PatientName",
                SUM(d."Amount") AS "Amount"
         FROM "SaleReturnHDR" h JOIN "SaleReturnDtl" d ON h."SaleReturnHDRID" = d."SaleReturnHdrID"
         JOIN "StockMaster" s ON d."StockID" = s."StockID"
         JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
         JOIN "PatientMaster" pm ON h."PatientID" = pm."PatientID"
         WHERE h."ReturnDate"::date BETWEEN $1::date AND $2::date AND h."BranchID" = $3
         GROUP BY s."StockName", d."Price", c."CategoryName", pm."PatientName"
         ORDER BY s."StockName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },

  // ---------- Stock ----------
  stock_balance_by_date: {
    label: "Stock Balance As Of Date",
    category: "Stock",
    params: [{ name: "asOfDate", type: "date", required: true }, { name: "branchId", type: "branch", required: false }, { name: "stockCode", type: "text", required: false }],
    build(q) {
      const branchId = opt(q, "branchId", null);
      const stockCode = opt(q, "stockCode", null);
      return {
        text: `WITH movements AS (
           SELECT sm."StockID",
             COALESCE((SELECT SUM(pd."Qty") FROM "PurchaseDtl" pd JOIN "PurchaseHdr" ph ON pd."PurchaseHDRID" = ph."PurchaseID"
               WHERE pd."StockCode"::int = sm."StockID" AND ph."PurchaseDate"::date <= $1::date
                 AND ($2::int IS NULL OR ph."BranchID" = $2::int)), 0)
             +
             COALESCE((SELECT SUM(srd."Qty") FROM "SaleReturnDtl" srd JOIN "SaleReturnHDR" srh ON srd."SaleReturnHdrID" = srh."SaleReturnHDRID"
               WHERE srd."StockID" = sm."StockID" AND srh."ReturnDate"::date <= $1::date
                 AND ($2::int IS NULL OR srh."BranchID" = $2::int)), 0)
             +
             COALESCE((SELECT SUM(td."Qty") FROM "TransferDtl" td JOIN "TransferHdr" th ON td."TransferHdrID" = th."TransferID"
               WHERE td."FK_StockCode"::int = sm."StockID" AND th."TransferStatus" = 'Done' AND th."TransferDate"::date <= $1::date
                 AND th."ToBranchID" = $2::int), 0)
             -
             COALESCE((SELECT SUM(sd."Qty") FROM "SaleDtl" sd JOIN "SaleHdr" sh ON sd."SaleHDRID" = sh."SaleID"
               WHERE sd."StockCode"::int = sm."StockID" AND sh."SaleDate"::date <= $1::date
                 AND ($2::int IS NULL OR sh."BranchID" = $2::int)), 0)
             -
             COALESCE((SELECT SUM(rd."Qty") FROM "ReturnDtl" rd JOIN "ReturnHdr" rh ON rd."ReturnHDRID" = rh."ReturnID"
               WHERE rd."StockCode"::int = sm."StockID" AND rh."Date"::date <= $1::date
                 AND ($2::int IS NULL OR rh."BranchID" = $2::int)), 0)
             -
             COALESCE((SELECT SUM(td."Qty") FROM "TransferDtl" td JOIN "TransferHdr" th ON td."TransferHdrID" = th."TransferID"
               WHERE td."FK_StockCode"::int = sm."StockID" AND th."TransferStatus" = 'Done' AND th."TransferDate"::date <= $1::date
                 AND th."FromBranchID" = $2::int), 0)
             +
             COALESCE((SELECT SUM(a."AdjustedQty" - a."CurrentQty") FROM "Adjustment" a
               WHERE a."StockID" = sm."StockID" AND a."AdjustmentDate"::date <= $1::date
                 AND ($2::int IS NULL OR a."BranchID" = $2::int)), 0)
             AS "CalculatedBalance"
           FROM "StockMaster" sm
         )
         SELECT $1::date AS "BalanceAsOfDate",
           COALESCE((SELECT branchname FROM "Branch" WHERE id = $2::int), 'All Branches') AS "Branch",
           sm."StockID", sm."StockCode", sm."StockName", sm."StockType", sm."Barcode", cat."CategoryName",
           mov."CalculatedBalance" AS "StockBalance"
         FROM "StockMaster" sm JOIN movements mov ON sm."StockID" = mov."StockID"
         LEFT JOIN "CategoryMaster" cat ON sm."CategoryID" = cat."CategoryID"
         WHERE ($3::text IS NULL OR sm."StockCode" ILIKE '%' || $3 || '%' OR sm."StockName" ILIKE '%' || $3 || '%' OR sm."Barcode" = $3)
         ORDER BY sm."StockName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "asOfDate"), branchId, stockCode],
      };
    },
  },

  // ---------- Expenses / Profit ----------
  expense_report: {
    label: "Expense Report (Detail)",
    category: "Finance",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: false }],
    build(q) {
      const branchId = opt(q, "branchId", null);
      return {
        text: `SELECT e.expensedate AS "ExpenseDate", b.branchname AS "BranchName", et.expensetype AS "ExpenseType",
                e.description AS "Description", e.amount AS "Amount", e.createuser AS "CreatedBy"
         FROM "Expense" e LEFT JOIN "ExpenseType" et ON e.expensetypeid = et.expensetypeid
         LEFT JOIN "Branch" b ON e.branchid = b.id
         WHERE e.expensedate::date BETWEEN $1::date AND $2::date
           AND ($3::int IS NULL OR e.branchid = $3::int)
         ORDER BY e.expensedate LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), branchId],
      };
    },
  },
  expense_summary: {
    label: "Expense Summary By Type",
    category: "Finance",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT et.expensetype AS "ExpenseType", SUM(e.amount) AS "TotalExpense"
         FROM "Expense" e JOIN "ExpenseType" et ON e.expensetypeid = et.expensetypeid
         WHERE e.expensedate::date BETWEEN $1::date AND $2::date AND e.status != 'delete' AND e.branchid = $3
         GROUP BY et.expensetype LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  profit_report: {
    label: "Daily Profit Report",
    category: "Finance",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT d::date AS "SaleDate",
           COALESCE((SELECT SUM("TotalAmount") FROM "SaleHdr" WHERE "SaleDate"::date = d::date AND "BranchID" = $3), 0) AS "SaleTotal",
           COALESCE((SELECT SUM("ReturnBalance") FROM "SaleReturnHDR" WHERE "ReturnDate"::date = d::date AND "BranchID" = $3), 0) AS "SaleReturnTotal",
           COALESCE((SELECT SUM(dt."Amount") FROM "SaleHdr" h JOIN "SaleDtl" dt ON h."SaleID" = dt."SaleHDRID"
             JOIN "StockMaster" s ON dt."StockCode"::int = s."StockID"
             WHERE s."CategoryID" = 2 AND h."BranchID" = $3 AND h."SaleDate"::date = d::date), 0) AS "ServiceTotal",
           COALESCE((SELECT SUM("TotalAmount") FROM "PurchaseHdr" WHERE "PurchaseDate"::date = d::date AND "BranchID" = $3), 0) AS "PurchaseTotal",
           COALESCE((SELECT SUM("TotalAmount") FROM "ReturnHdr" WHERE "Type" = 'RETURN' AND "Date"::date = d::date AND "BranchID" = $3), 0) AS "ReturnTotal",
           COALESCE((SELECT SUM("TotalAmount") FROM "ReturnHdr" WHERE "Type" = 'DAMAGE' AND "Date"::date = d::date AND "BranchID" = $3), 0) AS "DamageTotal",
           COALESCE((SELECT SUM("TotalAmount") FROM "TransferHdr" WHERE "TransferDate"::date = d::date AND "ToBranchID" = $3 AND "TransferStatus" = 'Done'), 0) AS "TransferIn",
           COALESCE((SELECT SUM("TotalAmount") FROM "TransferHdr" WHERE "TransferDate"::date = d::date AND "FromBranchID" = $3), 0) AS "TransferOut",
           COALESCE((SELECT SUM(amount) FROM "Expense" WHERE status != 'delete' AND expensedate::date = d::date AND branchid = $3), 0) AS "ExpenseTotal"
         FROM generate_series($1::date, $2::date, interval '1 day') AS d
         ORDER BY d LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },
  balance_sheet_cashflow: {
    label: "Cash Flow Summary (Balance Sheet)",
    category: "Finance",
    params: [{ name: "fromDate", type: "date", required: true }, { name: "toDate", type: "date", required: true }, { name: "branchId", type: "branch", required: true }],
    build(q) {
      return {
        text: `SELECT tablename AS "Category", SUM(paidamount) AS "Total", COUNT(*) AS "Count"
         FROM "Payment"
         WHERE paymentdate::date BETWEEN $1::date AND $2::date AND branchid = $3
         GROUP BY tablename ORDER BY tablename LIMIT ${ROW_LIMIT}`,
        values: [need(q, "fromDate"), need(q, "toDate"), need(q, "branchId")],
      };
    },
  },

  // ---------- Transfers ----------
  transfer_report_detail: {
    label: "Transfer Report (Detail)",
    category: "Transfers",
    params: [
      { name: "branchId", type: "branch", required: true },
      { name: "reportType", type: "select", options: ["TransferIn", "TransferOut"], required: true },
      { name: "fromDate", type: "date", required: true },
      { name: "toDate", type: "date", required: true },
      { name: "status", type: "select", options: ["Open", "Done"], required: false },
      { name: "filterBranchId", type: "branch", required: false },
    ],
    build(q) {
      const reportType = need(q, "reportType");
      const status = opt(q, "status", null);
      const filterBranchId = opt(q, "filterBranchId", null);
      const isOut = reportType === "TransferOut";
      return {
        text: `SELECT th."TransferID", th."TransferCode", th."TransferDate", bf.branchname AS "FromBranch", bt.branchname AS "ToBranch",
                th."TransferStatus", th."TransferBy", sm."StockCode", sm."StockName", td."Qty", td."Price", td."Total",
                '${isOut ? "Transfer Out" : "Transfer In"}' AS "ReportType"
         FROM "TransferHdr" th JOIN "TransferDtl" td ON th."TransferID" = td."TransferHdrID"
         JOIN "Branch" bf ON th."FromBranchID" = bf.id JOIN "Branch" bt ON th."ToBranchID" = bt.id
         JOIN "StockMaster" sm ON td."FK_StockCode"::int = sm."StockID"
         WHERE th."${isOut ? "FromBranchID" : "ToBranchID"}" = $1
           AND th."TransferDate"::date BETWEEN $2::date AND $3::date
           AND ($4::text IS NULL OR th."TransferStatus" = $4)
           AND ($5::int IS NULL OR th."${isOut ? "ToBranchID" : "FromBranchID"}" = $5::int)
         ORDER BY th."TransferDate", th."TransferID" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId"), need(q, "fromDate"), need(q, "toDate"), status, filterBranchId],
      };
    },
  },
  transfer_report_summary: {
    label: "Transfer Report (Summary)",
    category: "Transfers",
    params: [
      { name: "branchId", type: "branch", required: true },
      { name: "reportType", type: "select", options: ["TransferIn", "TransferOut"], required: true },
      { name: "fromDate", type: "date", required: true },
      { name: "toDate", type: "date", required: true },
      { name: "status", type: "select", options: ["Open", "Done"], required: false },
      { name: "filterBranchId", type: "branch", required: false },
    ],
    build(q) {
      const reportType = need(q, "reportType");
      const status = opt(q, "status", null);
      const filterBranchId = opt(q, "filterBranchId", null);
      const isOut = reportType === "TransferOut";
      const otherBranchAlias = isOut ? "bt" : "bf";
      return {
        text: `SELECT ${otherBranchAlias}.branchname AS "BranchName", sm."StockCode", sm."StockName",
                SUM(td."Qty") AS "TotalQty", SUM(td."Total") AS "TotalAmount"
         FROM "TransferHdr" th JOIN "TransferDtl" td ON th."TransferID" = td."TransferHdrID"
         JOIN "StockMaster" sm ON td."FK_StockCode"::int = sm."StockID"
         JOIN "Branch" ${otherBranchAlias} ON th."${isOut ? "ToBranchID" : "FromBranchID"}" = ${otherBranchAlias}.id
         WHERE th."${isOut ? "FromBranchID" : "ToBranchID"}" = $1
           AND th."TransferDate"::date BETWEEN $2::date AND $3::date
           AND ($4::text IS NULL OR th."TransferStatus" = $4)
           AND ($5::int IS NULL OR th."${isOut ? "ToBranchID" : "FromBranchID"}" = $5::int)
         GROUP BY ${otherBranchAlias}.branchname, sm."StockCode", sm."StockName"
         ORDER BY ${otherBranchAlias}.branchname, sm."StockName" LIMIT ${ROW_LIMIT}`,
        values: [need(q, "branchId"), need(q, "fromDate"), need(q, "toDate"), status, filterBranchId],
      };
    },
  },
};

function list(req, res) {
  const data = Object.entries(REPORTS).map(([key, r]) => ({ key, label: r.label, category: r.category, params: r.params }));
  res.json({ data });
}

async function run(req, res, next) {
  const report = REPORTS[req.params.key];
  if (!report) return res.status(404).json({ error: "Unknown report" });
  try {
    const { text, values } = report.build(req.query);
    const { rows } = await pool.query(text, values);
    // Every report query ends in LIMIT ROW_LIMIT, so hitting exactly that
    // count means there may be more rows than shown - flag it rather than
    // silently presenting a partial result as complete.
    res.json({ data: rows, truncated: rows.length === ROW_LIMIT });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

module.exports = { list, run };
