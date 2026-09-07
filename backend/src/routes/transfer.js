const express = require("express");
const { list, getById, create, receive, remove } = require("../controllers/transferController");

const router = express.Router();

router.get("/", list);
router.get("/:id", getById);
router.post("/", create);
router.post("/:id/receive", receive);
router.delete("/:id", remove);

module.exports = router;
