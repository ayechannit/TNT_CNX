const express = require("express");
const { list, create, update, remove } = require("../controllers/expenseController");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();

router.get("/", list);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", requirePermission("Delete"), remove);

module.exports = router;
