import GenericEntityPage from "./GenericEntityPage";

export default function CategoryPage() {
  return (
    <GenericEntityPage
      entityPath="categories"
      idField="CategoryID"
      title="Categories"
      columns={[{ key: "CategoryName", label: "Name" }]}
      fields={[{ key: "CategoryName", label: "Category Name" }]}
    />
  );
}
