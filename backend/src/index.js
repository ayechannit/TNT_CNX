require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const requireAuth = require("./middleware/requireAuth");
const authRoutes = require("./routes/auth");
const stockRoutes = require("./routes/stock");
const categoryRoutes = require("./routes/category");
const supplierRoutes = require("./routes/supplier");
const customerRoutes = require("./routes/customer");
const branchRoutes = require("./routes/branch");
const expenseTypeRoutes = require("./routes/expenseType");
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

app.use("/api/stock", stockRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/expense-types", expenseTypeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/user-roles", userRoleRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/stock-adjustments", stockAdjustmentRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/sale-returns", saleReturnRoutes);
app.use("/api/reports", reportsRoutes);

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
