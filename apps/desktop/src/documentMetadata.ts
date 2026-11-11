export type DisciplineCode = "" | "ARC" | "STR" | "MEP" | "OTHER";
export type DocumentDraft = { code: string; title: string; discipline: DisciplineCode };

export const emptyDocumentDraft: DocumentDraft = { code: "", title: "", discipline: "" };

const disciplineNames: Record<DisciplineCode, string> = {
  "": "",
  ARC: "kiến trúc",
  STR: "kết cấu",
  MEP: "cơ điện",
  OTHER: "",
};

const roleCodes: Record<string, DisciplineCode> = {
  A: "ARC", ARC: "ARC", ARCH: "ARC", S: "STR", STR: "STR", ST: "STR",
  M: "MEP", E: "MEP", P: "MEP", F: "MEP", W: "MEP", MEP: "MEP",
  HVAC: "MEP", ELV: "MEP", PLUM: "MEP", CTN: "MEP", FIRE: "MEP", PCCC: "MEP",
};

export function suggestFromName(fileName: string): DocumentDraft {
  const stem = fileName.replace(/\.ifc$/i, "").trim();
  const code = stem.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gi, "d")
    .toUpperCase().replace(/[^A-Z0-9_-]+/g, "-").replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "").slice(0, 64);
  const parts = stem.toUpperCase().split("-");
  const structured = parts.length >= 7 && /^\d+$/.test(parts.at(-1) ?? "");
  const explicit = structured ? roleCodes[parts.at(-2) ?? ""] : undefined;
  const tokens = stem.toUpperCase().split(/[^A-Z0-9]+/);
  const named = new Set(tokens.filter((token) => token.length > 1).map((token) => roleCodes[token]).filter(Boolean));
  const discipline = explicit || (named.size === 1 ? [...named][0] : "");
  const name = disciplineNames[discipline];
  const title = structured && name ? `Mô hình ${name} – ${parts[0]}` : stem.replace(/[_-]+/g, " ");
  return { code, title: title.slice(0, 200), discipline };
}

function decodeStepText(value: string) {
  return value.replace(/\\X2\\([0-9a-f]+)\\X0\\/gi, (match, hex: string) =>
    hex.length % 4 === 0 ? hex.replace(/.{4}/g, (unit) => String.fromCharCode(parseInt(unit, 16))) : match,
  ).replace(/''/g, "'").replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function readIfcDescription(file: File) {
  const header = await file.slice(0, 256 * 1024).text();
  const project = /#\d+\s*=\s*IFCPROJECT\s*\(\s*'(?:[^']|'')*'\s*,\s*(?:#\d+|\$|\*)\s*,\s*(\$|'(?:[^']|'')*')\s*,\s*(\$|'(?:[^']|'')*')/i.exec(header);
  const text = (value?: string) => value?.startsWith("'") ? decodeStepText(value.slice(1, -1)) : "";
  return { project: text(project?.[1]), description: text(project?.[2]) };
}
