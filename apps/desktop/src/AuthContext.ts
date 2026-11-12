import { createContext, useContext, type ReactNode } from "react";
import type { ProjectPartyRole } from "./projectPartyRoles";
export type WorkspaceControls = { account: ReactNode; members?: ReactNode };
export type CdeUser = {
  username: string;
  organization: string;
  role: string;
  siteAdmin?: boolean;
  projectId?: string;
  projectName?: string;
  isoRole?: ProjectPartyRole | null;
};
export const UserContext = createContext<CdeUser | null>(null);
export const useCdeUser = () => useContext(UserContext);
