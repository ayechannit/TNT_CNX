const express = require("express");
const { list, getById, create, update, markPaid, undoPaid, markDelivered, remove } = require("../controllers/saleController");

const router = express.Router();

router.get("/", list);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.post("/:id/mark-paid", markPaid);
router.post("/:id/undo-paid", undoPaid);
router.post("/:id/mark-delivered", markDelivered);
router.delete("/:id", remove);

module.exports = router;
