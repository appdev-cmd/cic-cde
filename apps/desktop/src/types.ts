export type Discipline = "STR" | "HVAC" | "PLUM" | "ARC";
export interface BimModel {
  id: string;
  name: string;
  discipline: string;
  schema: string;
  count: number;
  status: string;
  synthetic?: boolean;
  hash?: string;
  geometryAssets?: GeometryAsset[];
  renderOrigin?: [number, number, number];
  transform?: {
    translation: [number, number, number];
    rotationZDegrees: number;
    revision: number;
  };
}
export interface GeometryAsset {
  id: string;
  file: string;
  bytes: number;
  sha256: string;
}
export interface GeometryRef {
  assetId?: string;
  assetIndex?: number;
  vertexOffset: number;
  vertexCount: number;
  indexOffset: number;
  indexCount: number;
}
export interface BimElement {
  id: string;
  globalId: string;
  name: string;
  ifcClass: string;
  modelId: string;
  discipline: Discipline;
  storey: string;
  color: string;
  vertices?: number[];
  indices?: number[];
  geometry?: GeometryRef;
  triangleCount?: number;
  properties: Record<string, string>;
}
export interface Finding {
  id: string;
  title: string;
  a: string;
  b: string;
  storey: string;
  severity: string;
  status: string;
  rule: string;
  demo: boolean;
  distance?: number;
  measurementKind?: string;
  pointA?: [number, number, number];
  pointB?: [number, number, number];
}
export interface CheckRun {
  runId: string;
  sourceHash: string;
  engineVersion: string;
  findings: Finding[];
  coverage: {
    expected: number;
    generated: number;
    complete: boolean;
    groupA: number;
    groupB: number;
    unmeasuredCollisionPairs: number;
  };
}
export interface Workspace {
  models: BimModel[];
  elements: BimElement[];
  findings: Finding[];
  synthetic: boolean;
}
export type ViewMode = "solid" | "xray" | "wireframe";
export interface ViewerApi {
  cancelLoad(): void;
  fit(): void;
  top(): void;
  capture(): void;
}

export type IssueState = "Open" | "InProgress" | "Review" | "Closed";

export interface CoordinationIssue {
  state: IssueState;
  assignee: string;
  revision: number;
  id: number;
  runId: string;
  finding: Finding;
  snapshots: {
    modelId: string;
    sourceHash: string;
    transform: NonNullable<BimModel["transform"]>;
  }[];
  comments: { id: number; body: string; createdAt: string }[];
}
