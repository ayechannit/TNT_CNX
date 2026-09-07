import GenericEntityPage from "./GenericEntityPage";

export default function SupplierPage() {
  return (
    <GenericEntityPage
      entityPath="suppliers"
      idField="SupplierID"
      title="Suppliers"
      columns={[
        { key: "SupplierName", label: "Name" },
        { key: "PhoneNo", label: "Phone" },
        { key: "LeftOver", label: "Leftover" },
      ]}
      fields={[
        { key: "SupplierName", label: "Supplier Name" },
        { key: "PhoneNo", label: "Phone No" },
        { key: "LeftOver", label: "Leftover", type: "number" },
        { key: "UniqueCode", label: "Unique Code" },
      ]}
    />
  );
}
