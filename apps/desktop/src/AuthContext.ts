import { createContext, useContext } from "react";
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
