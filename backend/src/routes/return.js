const express = require("express");
const { list, getById, create, remove } = require("../controllers/returnController");

const router = express.Router();

router.get("/", list);
router.get("/:id", getById);
router.post("/", create);
router.delete("/:id", remove);

module.exports = router;
