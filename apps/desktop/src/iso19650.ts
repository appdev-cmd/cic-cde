export const iso19650Roles = {
  appointing_party: "Bên đặt hàng (Appointing party)",
  lead_appointed_party: "Bên thực hiện chính (Lead appointed party)",
  appointed_party: "Bên thực hiện (Appointed party)",
} as const;

export type Iso19650Role = keyof typeof iso19650Roles;
