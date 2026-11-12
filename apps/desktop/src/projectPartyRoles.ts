export const projectPartyRoles = {
  owner: "Chủ đầu tư",
  design_consultant: "Tư vấn thiết kế",
  bim_consultant: "Tư vấn BIM",
  verification_consultant: "Tư vấn thẩm tra",
  supervision_consultant: "Tư vấn giám sát",
  construction_contractor: "Nhà thầu thi công",
  other: "Khác",
} as const;

export const legacyIso19650Roles = {
  appointing_party: "Bên đặt hàng (Appointing party)",
  lead_appointed_party: "Bên thực hiện chính (Lead appointed party)",
  appointed_party: "Bên thực hiện (Appointed party)",
} as const;

type LegacyRole = keyof typeof legacyIso19650Roles;
export type ProjectPartyRole = keyof typeof projectPartyRoles | LegacyRole;

export function legacyIso19650RoleLabel(role?: ProjectPartyRole | null) {
  return role && Object.hasOwn(legacyIso19650Roles, role)
    ? legacyIso19650Roles[role as LegacyRole]
    : undefined;
}

export function projectPartyRoleLabel(role?: ProjectPartyRole | null) {
  return (role && Object.hasOwn(projectPartyRoles, role)
    ? projectPartyRoles[role as keyof typeof projectPartyRoles]
    : legacyIso19650RoleLabel(role)) ?? "Chưa xác định";
}
