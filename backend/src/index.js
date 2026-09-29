require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const requireAuth = require("./middleware/requireAuth");
const requireScreen = require("./middleware/requireScreen");
const { requireScreenForWrites } = requireScreen;
const authRoutes = require("./routes/auth");
const stockRoutes = require("./routes/stock");
const categoryRoutes = require("./routes/category");
const supplierRoutes = require("./routes/supplier");
const customerRoutes = require("./routes/customer");
const branchRoutes = require("./routes/branch");
const expenseTypeRoutes = require("./routes/expenseType");
const expenseRoutes = require("./routes/expense");
const userRoutes = require("./routes/user");
const userRoleRoutes = require("./routes/userRole");
const saleRoutes = require("./routes/sale");
const purchaseRoutes = require("./routes/purchase");
const stockAdjustmentRoutes = require("./routes/stockAdjustment");
const transferRoutes = require("./routes/transfer");
const returnRoutes = require("./routes/return");
const saleReturnRoutes = require("./routes/saleReturn");
const reportsRoutes = require("./routes/reports");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "disconnected", message: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api", requireAuth);

// Shared lookups (read by many screens regardless of menu access): reads stay
// open to any authenticated user - gating them would break the transaction
// screens - but create/edit/delete needs the lookup's own screen permission.
// Customer creation stays open because the Sale screen adds customers inline.
app.use("/api/stock", stockRoutes);
app.use("/api/categories", requireScreenForWrites(["FrmCategory"]), categoryRoutes);
app.use("/api/suppliers", requireScreenForWrites(["FrmSupplier"]), supplierRoutes);
app.use("/api/customers", requireScreenForWrites(["FrmCustomer"], ["POST"]), customerRoutes);
app.use("/api/branches", requireScreenForWrites(["FrmBranch"]), branchRoutes);
app.use("/api/expense-types", requireScreenForWrites(["FrmExpenseType"]), expenseTypeRoutes);

// Screen/management routes - gated to users who hold the screen's permission
// (or unrestricted users). Mirrors the frontend nav gating.
app.use("/api/expenses", requireScreen(["FrmExpense"]), expenseRoutes);
app.use("/api/users", requireScreen(["FrmUser"]), userRoutes);
app.use("/api/user-roles", requireScreen(["FrmUserRole"]), userRoleRoutes);
app.use("/api/sales", requireScreen(["FrmSale", "FrmSaleList"]), saleRoutes);
app.use("/api/purchases", requireScreen(["FrmPurchase", "FrmPurchaseList"]), purchaseRoutes);
app.use("/api/stock-adjustments", requireScreen(["FrmStockAdjust"]), stockAdjustmentRoutes);
app.use("/api/transfers", requireScreen(["FrmTransfer", "FrmTransferList"]), transferRoutes);
app.use("/api/returns", requireScreen(["FrmReturn", "FrmReturnList"]), returnRoutes);
app.use("/api/sale-returns", requireScreen(["FrmSaleReturn", "FrmSaleReturnList"]), saleReturnRoutes);
app.use("/api/reports", requireScreen(["FrmReport", "FrmSaleReport", "FrmPurchaseReport"]), reportsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Vercel imports this file as a serverless function and calls the exported
// app directly as a request handler - it never runs this file as the main
// module, so app.listen() only happens for local `npm run dev`/`node src/index.js`.
if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`MPOS backend listening on port ${port}`);
  });
}

module.exports = app;
