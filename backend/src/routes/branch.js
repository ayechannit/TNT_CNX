const { createCrudRouter } = require("../lib/genericCrud");

module.exports = createCrudRouter({
  table: '"Branch"',
  idColumn: "id",
  columns: ["branchno", "branchname", "status"],
  searchColumns: ["branchname", "branchno"],
  filterColumns: ["status"],
  defaultSort: "branchname",
});
