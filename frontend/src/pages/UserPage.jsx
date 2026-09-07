import GenericEntityPage from "./GenericEntityPage";

export default function UserPage() {
  return (
    <GenericEntityPage
      entityPath="users"
      idField="UserID"
      title="Users"
      columns={[
        { key: "RealName", label: "Name" },
        { key: "UserName", label: "Username" },
        { key: "Active", label: "Active" },
      ]}
      fields={[
        { key: "RealName", label: "Real Name" },
        { key: "UserName", label: "Username" },
        { key: "Password", label: "Password", type: "password" },
        {
          key: "Active", label: "Active", type: "select",
          options: [{ value: "Y", label: "Yes" }, { value: "N", label: "No" }],
        },
      ]}
    />
  );
}
