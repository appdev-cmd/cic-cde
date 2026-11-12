import { createContext, useContext, type ReactNode } from "react";
import type { Iso19650Role } from "./iso19650";
export type WorkspaceControls = { account: ReactNode; members?: ReactNode };
export type CdeUser = {
  username: string;
  organization: string;
  role: string;
  siteAdmin?: boolean;
  projectId?: string;
  projectName?: string;
  isoRole?: Iso19650Role | null;
};
export const UserContext = createContext<CdeUser | null>(null);
export const useCdeUser = () => useContext(UserContext);
