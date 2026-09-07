import GenericEntityPage from "./GenericEntityPage";

export default function BranchPage() {
  return (
    <GenericEntityPage
      entityPath="branches"
      idField="id"
      title="Branches"
      columns={[
        { key: "branchname", label: "Name" },
        { key: "branchno", label: "Branch No" },
        { key: "status", label: "Status" },
      ]}
      fields={[
        { key: "branchname", label: "Branch Name" },
        { key: "branchno", label: "Branch No" },
        {
          // The legacy app checks Branch.status = 'Y' (see old Stock.cs Save_Data), not 'active'/'inactive'.
          key: "status", label: "Status", type: "select",
          options: [{ value: "Y", label: "Active" }, { value: "N", label: "Inactive" }],
        },
      ]}
    />
  );
}
