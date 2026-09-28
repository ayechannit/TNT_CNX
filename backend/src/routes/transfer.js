const express = require("express");
const { list, getById, create, receive, remove } = require("../controllers/transferController");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();

router.get("/", list);
router.get("/:id", getById);
router.post("/", create);
router.post("/:id/receive", receive);
router.delete("/:id", requirePermission("Delete"), remove);

module.exports = router;
