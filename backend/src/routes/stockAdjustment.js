const express = require("express");
const { list, getBalance, create } = require("../controllers/stockAdjustmentController");

const router = express.Router();

router.get("/", list);
router.get("/balance/:stockId", getBalance);
router.post("/", create);

module.exports = router;
