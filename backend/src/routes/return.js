const express = require("express");
const { list, getById, create, remove } = require("../controllers/returnController");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();

router.get("/", list);
router.get("/:id", getById);
router.post("/", create);
router.delete("/:id", requirePermission("Delete"), remove);

module.exports = router;
