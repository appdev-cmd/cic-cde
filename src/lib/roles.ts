// Vai trò trong dự án CDE (ISO 19650) + quyền hạn cơ bản (RBAC).

export const PROJECT_ROLES = ['Author', 'Checker', 'Approver', 'Manager', 'Viewer'] as const;
export type ProjectRole = typeof PROJECT_ROLES[number];

export const ROLE_LABEL: Record<string, string> = {
  Author: 'Người soạn (Author)',
  Architect: 'Người soạn (Author)',
  Checker: 'Người kiểm (Checker)',
  Approver: 'Người phê duyệt (Approver)',
  Manager: 'Quản trị BIM (Manager)',
  Admin: 'Quản trị BIM (Manager)',
  Viewer: 'Người xem (Viewer)',
};

const norm = (role?: string) => {
  const r = (role || 'Author').trim();
  if (r === 'Architect') return 'Author';
  if (r === 'Admin') return 'Manager';
  return r;
};

export const roleLabel = (role?: string) => ROLE_LABEL[role || 'Author'] || ROLE_LABEL[norm(role)] || role || 'Author';

/** Được phê duyệt/từ chối tài liệu (kiểm tra Gate 1/2). */
export const canApprove = (role?: string) => ['Checker', 'Approver', 'Manager'].includes(norm(role));

/** Được xuất bản & lưu trữ (Gate 2 / Archive). */
export const canPublish = (role?: string) => ['Approver', 'Manager'].includes(norm(role));

/** Được tạo/sửa/tải tài liệu WIP. */
export const canEdit = (role?: string) => ['Author', 'Checker', 'Approver', 'Manager'].includes(norm(role));
