export interface DocumentItem {
  id: string;
  name: string;
  folder: '01_WIP' | '02_SHARED' | '03_PUBLISHED' | '04_ARCHIVE';
  subFolder?: string;
  status: 'S0 - WIP' | 'S1 - SHARED' | 'S2 - PUBLISHED' | 'S3 - ARCHIVED' | 'PENDING_APPROVAL';
  revision: string;
  version: string;
  modifiedDate: string;
  size: string;
  creator: string;
  classification: string;
  volume: string;
  fileType: 'pdf' | 'ifc' | 'dwg' | 'other';
  fileUrl?: string; // Can be a remote URL or a local blob URL
}

export interface ApprovalItem {
  id: string;
  type: string;
  deadline: string;
  requester: string;
  description: string;
  file: string;
  createdDate: string;
  documentId?: string; // Link to the document being approved
}

export interface ClashItem {
  id: string;
  elements: string;
  discipline: string;
  severity: 'Cao' | 'Trung bình' | 'Thấp';
  status: 'Chưa xử lý' | 'Đang xử lý' | 'Đã giải quyết';
  description: string;
}

export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  type: 'upload' | 'comment' | 'system' | 'approve' | 'clash';
}
