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
  suitabilityCode?: string; // ISO 19650 suitability code (S0,S1,S2,S3,S4,D1..D4,A1..,B1..,CR)
  dbId?: string; // Supabase uuid (khác với id=mã ISO 19650)
  fragUrl?: string; // URL file .frag (ThatOpen Fragments) để nạp nhanh
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
