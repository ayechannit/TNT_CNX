const { createCrudRouter } = require("../lib/genericCrud");

// Maps to PatientMaster in the legacy schema - exposed as "customers" in the
// new app since this business doesn't use "patient" terminology.
module.exports = createCrudRouter({
  table: '"PatientMaster"',
  idColumn: "PatientID",
  columns: ["PatientName", "Age", "PhoneNo", "memberID"],
  searchColumns: ["PatientName", "PhoneNo", "memberID"],
  defaultSort: "PatientName",
});
