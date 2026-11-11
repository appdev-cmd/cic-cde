import { createContext, useContext, type ReactNode } from "react";
export type WorkspaceControls = { project?: ReactNode; account: ReactNode };
export type CdeUser = {
  username: string;
  organization: string;
  role: string;
  siteAdmin?: boolean;
  projectId?: string;
  projectName?: string;
};
export const UserContext = createContext<CdeUser | null>(null);
export const useCdeUser = () => useContext(UserContext);
