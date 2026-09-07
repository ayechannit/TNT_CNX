const { createCrudRouter } = require("../lib/genericCrud");

module.exports = createCrudRouter({
  table: '"CategoryMaster"',
  idColumn: "CategoryID",
  columns: ["CategoryName", "TypeName"],
  searchColumns: ["CategoryName"],
  defaultSort: "CategoryName",
  auditColumns: { createUser: "CreateUser", createDate: "CreateDate", updateUser: "UpdateUser", updateDate: "UpdateDate" },
});
