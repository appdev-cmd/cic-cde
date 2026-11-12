import type { Finding, IssueState } from "./types";

export const issueLabels: Record<IssueState, string> = {
  Open: "Mới",
  InProgress: "Đang xử lý",
  Review: "Chờ kiểm lại",
  Closed: "Đã đóng",
};

const classes: Record<string, string> = {
  IfcDuctSegment: "Ống gió",
  IfcBeam: "Dầm",
  IfcPipeSegment: "Đường ống",
  IfcCableCarrierSegment: "Máng cáp",
  IfcWall: "Tường",
  IfcWallStandardCase: "Tường",
  IfcSlab: "Sàn",
  IfcColumn: "Cột",
};

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export function findingTitle(finding: Finding) {
  const [a, b] = finding.rule.split("×").map((value) => classes[value.trim()]);
  return a && b ? `${a} × ${b}` : finding.title;
}

export function findingDistance(finding: Finding) {
  return finding.distance === undefined ? undefined : `${number.format(finding.distance * 1000)} mm`;
}

export const issueCode = (id: number) => `ISS-${String(id).padStart(3, "0")}`;
