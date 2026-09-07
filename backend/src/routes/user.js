const { createCrudRouter } = require("../lib/genericCrud");

module.exports = createCrudRouter({
  table: '"UserMaster"',
  idColumn: "UserID",
  columns: ["RealName", "UserName", "Password", "Active"],
  searchColumns: ["RealName", "UserName"],
  defaultSort: "RealName",
});
