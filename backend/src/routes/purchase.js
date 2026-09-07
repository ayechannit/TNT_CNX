const express = require("express");
const { list, getById, create, update, markPaid, remove } = require("../controllers/purchaseController");

const router = express.Router();

router.get("/", list);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.post("/:id/mark-paid", markPaid);
router.delete("/:id", remove);

module.exports = router;
