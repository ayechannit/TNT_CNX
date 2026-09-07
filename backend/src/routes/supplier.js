const { createCrudRouter } = require("../lib/genericCrud");

module.exports = createCrudRouter({
  table: '"SupplierMaster"',
  idColumn: "SupplierID",
  columns: ["SupplierName", "PhoneNo", "LeftOver", "UniqueCode"],
  searchColumns: ["SupplierName", "PhoneNo"],
  defaultSort: "SupplierName",
});
