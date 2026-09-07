const express = require("express");
const { getRoles, setRoles } = require("../controllers/userRoleController");

const router = express.Router();

router.get("/:userId", getRoles);
router.put("/:userId", setRoles);

module.exports = router;
