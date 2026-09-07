const express = require("express");
const { list, run } = require("../controllers/reportsController");

const router = express.Router();

router.get("/", list);
router.get("/:key", run);

module.exports = router;
