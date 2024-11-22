export type AddWorkspaceMemberRequest = {
  workspace_id: string;
  email: string;
  role: "Admin" | "Read";
};
