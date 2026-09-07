const { createCrudRouter } = require("../lib/genericCrud");

module.exports = createCrudRouter({
  table: '"ExpenseType"',
  idColumn: "expensetypeid",
  columns: ["expensetype", "status"],
  searchColumns: ["expensetype"],
  filterColumns: ["status"],
  defaultSort: "expensetype",
  auditColumns: { createUser: "createuser", createDate: "createdate", updateUser: "updateuser", updateDate: "updatedate" },
});
