const express = require("express");
const { list, getById, create, update, markPaid, remove } = require("../controllers/purchaseController");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();

router.get("/", list);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.post("/:id/mark-paid", markPaid);
router.delete("/:id", requirePermission("Delete"), remove);

module.exports = router;
