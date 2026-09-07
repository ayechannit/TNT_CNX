import GenericEntityPage from "./GenericEntityPage";

export default function ExpenseTypePage() {
  return (
    <GenericEntityPage
      entityPath="expense-types"
      idField="expensetypeid"
      title="Expense Types"
      columns={[
        { key: "expensetype", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      fields={[
        { key: "expensetype", label: "Expense Type" },
        {
          key: "status", label: "Status", type: "select",
          options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }],
        },
      ]}
    />
  );
}
