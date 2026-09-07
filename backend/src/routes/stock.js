const express = require("express");
const { search, getByBarcode, getById, create, update } = require("../controllers/stockController");

const router = express.Router();

router.get("/", search);
router.get("/barcode/:barcode", getByBarcode);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);

module.exports = router;
