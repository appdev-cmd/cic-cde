import JSZip from 'jszip';

/**
 * BCF (BIM Collaboration Format) 2.1 export/import — chạy hoàn toàn client-side.
 * File .bcfzip là một zip gồm:
 *   bcf.version
 *   {topic-guid}/markup.bcf      (XML: Topic + Comments)
 *   {topic-guid}/viewpoint.bcfv  (XML: Components/Selection — cấu kiện liên kết)
 * Tương thích trao đổi với Revit, Navisworks, Solibri, BIMcollab.
 */

export interface BcfIssue {
  id: string;
  title: string;
  description: string;
  status: 'Open' | 'Resolved' | 'Closed';
  priority: 'High' | 'Medium' | 'Low';
  assignedTo: string;
  linkedElementGuid?: string;
  linkedElementExpressId?: number;
  createdDate: string;
}

const PRIORITY_TO_BCF: Record<BcfIssue['priority'], string> = {
  High: 'High',
  Medium: 'Normal',
  Low: 'Low',
};

const BCF_TO_PRIORITY: Record<string, BcfIssue['priority']> = {
  high: 'High',
  critical: 'High',
  normal: 'Medium',
  medium: 'Medium',
  low: 'Low',
  minor: 'Low',
};

const escapeXml = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const guid = (): string =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const toIsoDate = (d: string): string => {
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

function buildMarkup(issue: BcfIssue, topicGuid: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Markup>
  <Topic Guid="${escapeXml(topicGuid)}" TopicType="Clash" TopicStatus="${escapeXml(issue.status)}">
    <Title>${escapeXml(issue.title)}</Title>
    <Priority>${escapeXml(PRIORITY_TO_BCF[issue.priority])}</Priority>
    <CreationDate>${toIsoDate(issue.createdDate)}</CreationDate>
    <AssignedTo>${escapeXml(issue.assignedTo)}</AssignedTo>
    <Description>${escapeXml(issue.description)}</Description>
  </Topic>
  <Comment Guid="${guid()}">
    <Date>${toIsoDate(issue.createdDate)}</Date>
    <Author>${escapeXml(issue.assignedTo)}</Author>
    <Comment>${escapeXml(issue.description)}</Comment>
  </Comment>
</Markup>`;
}

function buildViewpoint(issue: BcfIssue): string | null {
  if (!issue.linkedElementGuid) return null;
  return `<?xml version="1.0" encoding="UTF-8"?>
<VisualizationInfo Guid="${guid()}">
  <Components>
    <Selection>
      <Component IfcGuid="${escapeXml(issue.linkedElementGuid)}" />
    </Selection>
  </Components>
</VisualizationInfo>`;
}

/** Xuất danh sách BCF issues thành file .bcfzip và kích hoạt tải về. */
export async function exportBcf(issues: BcfIssue[], projectName = 'CDE-CIC'): Promise<void> {
  const zip = new JSZip();
  zip.file('bcf.version', `<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1"><DetailedVersion>2.1</DetailedVersion></Version>`);

  for (const issue of issues) {
    const topicGuid = /^[0-9a-f-]{36}$/i.test(issue.id) ? issue.id : guid();
    const folder = zip.folder(topicGuid)!;
    folder.file('markup.bcf', buildMarkup(issue, topicGuid));
    const vp = buildViewpoint(issue);
    if (vp) folder.file('viewpoint.bcfv', vp);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}_${new Date().toISOString().split('T')[0]}.bcfzip`;
  a.click();
  URL.revokeObjectURL(url);
}

function textOf(parent: Element | Document, tag: string): string {
  const el = parent.querySelector(tag);
  return el?.textContent?.trim() ?? '';
}

/** Nhập file .bcfzip (từ Revit/Navisworks/BIMcollab) thành danh sách BcfIssue. */
export async function importBcf(file: File): Promise<BcfIssue[]> {
  const zip = await JSZip.loadAsync(file);
  const issues: BcfIssue[] = [];
  const parser = new DOMParser();

  // Mỗi thư mục topic chứa một markup.bcf
  const markupPaths = Object.keys(zip.files).filter((p) => p.toLowerCase().endsWith('markup.bcf'));

  for (const path of markupPaths) {
    const xml = await zip.files[path].async('string');
    const doc = parser.parseFromString(xml, 'application/xml');
    const topic = doc.querySelector('Topic');
    if (!topic) continue;

    const topicGuid = topic.getAttribute('Guid') || guid();
    const statusRaw = (topic.getAttribute('TopicStatus') || 'Open').toLowerCase();
    const status: BcfIssue['status'] =
      statusRaw.includes('clos') ? 'Closed' : statusRaw.includes('resolv') ? 'Resolved' : 'Open';
    const priorityRaw = textOf(topic, 'Priority').toLowerCase();

    // Tìm IfcGuid trong viewpoint cùng thư mục (nếu có)
    let linkedGuid: string | undefined;
    const folder = path.substring(0, path.toLowerCase().lastIndexOf('markup.bcf'));
    const vpPath = Object.keys(zip.files).find(
      (p) => p.startsWith(folder) && p.toLowerCase().endsWith('.bcfv')
    );
    if (vpPath) {
      const vpXml = await zip.files[vpPath].async('string');
      const vpDoc = parser.parseFromString(vpXml, 'application/xml');
      const comp = vpDoc.querySelector('Component');
      linkedGuid = comp?.getAttribute('IfcGuid') || undefined;
    }

    issues.push({
      id: topicGuid,
      title: textOf(topic, 'Title') || 'Sự vụ không tên',
      description: textOf(topic, 'Description') || textOf(doc, 'Comment'),
      status,
      priority: BCF_TO_PRIORITY[priorityRaw] || 'Medium',
      assignedTo: textOf(topic, 'AssignedTo') || 'Chưa giao',
      linkedElementGuid: linkedGuid,
      createdDate: (textOf(topic, 'CreationDate') || new Date().toISOString()).split('T')[0],
    });
  }

  return issues;
}
