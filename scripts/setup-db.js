import pg from 'pg';
const { Client } = pg;

const config = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.shiqfawlgeintqsibqmk',
  password: 'VBu0X4sXFksn9du5',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
};

const DEFAULT_DOCUMENTS = [
  {
    id: 'PRJ-ARC-Z01-ZZ-M3-A-0001',
    name: 'Mặt bằng Tầng 1 - Cập nhật MEP',
    folder: '02_SHARED',
    sub_folder: 'Bản vẽ thiết kế',
    status: 'S1 - SHARED',
    revision: 'P02.01',
    version: 'V3',
    modified_date: '2026-06-08T09:30:00Z',
    size: '1.4 MB',
    creator: 'ARC Studio',
    classification: 'EF_20_10',
    volume: 'Z01 - Zone 1',
    file_type: 'pdf',
    file_url: null
  },
  {
    id: 'PRJ-STR-Z01-ZZ-M3-S-0023',
    name: 'Chi tiết cấu tạo cột C1',
    folder: '01_WIP',
    sub_folder: 'Bản vẽ thiết kế',
    status: 'S0 - WIP',
    revision: 'P01',
    version: 'V1',
    modified_date: '2026-06-07T02:15:00Z',
    size: '2.1 MB',
    creator: 'STR Studio',
    classification: 'EF_20_10',
    volume: 'Z01 - Zone 1',
    file_type: 'pdf',
    file_url: null
  },
  {
    id: 'PRJ-ALL-Z00-ZZ-M3-W-0001',
    name: 'Mô hình Liên kết Kiến trúc - Kết cấu',
    folder: '02_SHARED',
    sub_folder: 'Mô hình phối hợp',
    status: 'S1 - SHARED',
    revision: 'P02',
    version: 'V2',
    modified_date: '2026-06-06T04:20:00Z',
    size: '3.5 MB',
    creator: 'BIM Team',
    classification: 'EF_55_20',
    volume: 'Z00 - All Zones',
    file_type: 'ifc',
    file_url: 'https://thatopen.github.io/engine_ui-components/resources/small.ifc'
  },
  {
    id: 'PRJ-MEP-Z01-ZZ-M3-M-0005',
    name: 'Sơ đồ nguyên lý cấp thoát nước Tầng 2',
    folder: '01_WIP',
    sub_folder: 'Bản vẽ thiết kế',
    status: 'S0 - WIP',
    revision: 'P01',
    version: 'V1',
    modified_date: '2026-06-05T03:45:00Z',
    size: '3.2 MB',
    creator: 'MEP Studio',
    classification: 'EF_60_40',
    volume: 'Z01 - Zone 1',
    file_type: 'dwg',
    file_url: null
  },
  {
    id: 'PRJ-ARC-Z02-ZZ-M3-A-0002',
    name: 'Phối cảnh tổng thể khối tháp chính',
    folder: '03_PUBLISHED',
    sub_folder: 'Bản vẽ thiết kế',
    status: 'S2 - PUBLISHED',
    revision: 'C01',
    version: 'V5',
    modified_date: '2026-06-04T09:45:00Z',
    size: '18.4 MB',
    creator: 'ARC Studio',
    classification: 'EF_20_10',
    volume: 'Z02 - Zone 2',
    file_type: 'pdf',
    file_url: null
  },
  {
    id: 'BAN-VE-TANG-3-FINAL',
    name: 'Mặt bằng kết cấu sàn tầng 3 (Legacy)',
    folder: '01_WIP',
    sub_folder: 'Bản vẽ thiết kế',
    status: 'S0 - WIP',
    revision: 'P01',
    version: 'V1',
    modified_date: '2026-06-03T08:15:00Z',
    size: '4.8 MB',
    creator: 'STR Studio',
    classification: 'EF_20_10',
    volume: 'Z01 - Zone 1',
    file_type: 'pdf',
    file_url: null
  }
];

const DEFAULT_APPROVALS = [
  { id: 'RFI-0042', type: 'Vật liệu Sàn', deadline: 'Hôm nay', requester: 'KTS. Lê Minh Hoàng', description: 'Đề xuất thay đổi kết cấu hoàn thiện lớp bê tông đá mài granito sảnh chính.', file: 'RFI-0042-Slab-Material.pdf', created_date: '2026-06-06T00:00:00Z' },
  { id: 'SUB-018', type: 'Bản vẽ Cốp pha', deadline: '24/06/2026', requester: 'KS. Nguyễn Văn Hải', description: 'Trình duyệt bản vẽ biện pháp thi công cốp pha tầng điển hình khối B.', file: 'SUB-018-Formwork-Rev2.dwg', created_date: '2026-06-07T00:00:00Z' },
  { id: 'RFI-0043', type: 'Kích thước Dầm', deadline: '26/06/2026', requester: 'KS. Trần Thu Thảo', description: 'Yêu cầu làm rõ xung đột kích thước dầm phụ trục D-7 với đường ống cứu hỏa.', file: 'RFI-0043-Beam-Dim.pdf', created_date: '2026-06-07T00:00:00Z' },
  { id: 'SUB-019', type: 'Cơ điện (MEP) Phòng Cháy', deadline: '28/06/2026', requester: 'KS. Vũ Quốc Huy', description: 'Hồ sơ thiết bị bơm phòng cháy chữa cháy phòng kỹ thuật tầng hầm.', file: 'SUB-019-MEP-Pumps.pdf', created_date: '2026-06-08T00:00:00Z' },
  { id: 'RFI-0044', type: 'Định vị Cọc khoan nhồi', deadline: '30/06/2026', requester: 'KS. Đỗ Hải Nam', description: 'Báo cáo siêu âm và thí nghiệm nén tĩnh cọc thử khối tháp chính.', file: 'RFI-0044-Pile-Testing.pdf', created_date: '2026-06-08T00:00:00Z' }
];

const DEFAULT_CLASHES = [
  { id: 'CL-01', elements: 'Dầm trục 3-C với Ống gió tầng 2', discipline: 'ST-MEP', severity: 'Cao', status: 'Chưa xử lý', description: 'Ống cấp khí tươi chính xuyên qua dầm kết cấu trục C phụ tải.' },
  { id: 'CL-02', elements: 'Cột bê tông tầng 1 với Cáp cứu hỏa', discipline: 'ST-MEP', severity: 'Cao', status: 'Chưa xử lý', description: 'Đường cáp động lực phòng cháy đi xuyên qua khối thép chờ cột sảnh.' },
  { id: 'CL-03', elements: 'Ống nước thải thoát sàn với Khung trần thạch cao', discipline: 'MEP-ARCH', severity: 'Trung bình', status: 'Chưa xử lý', description: 'Độ dốc đường ống thoát nước sảnh chính chạm mặt xương trần giật cấp.' },
  { id: 'CL-04', elements: 'Cửa thoát hiểm khối B với Vách bê tông', discipline: 'AR-ST', severity: 'Trung bình', status: 'Chưa xử lý', description: 'Vị trí trích ô chờ cửa lệch 150mm so với bản vẽ dầm chuyển vách.' },
  { id: 'CL-05', elements: 'Thang máng cáp điện vs Ống sprinkler hành lang', discipline: 'MEP-MEP', severity: 'Thấp', status: 'Chưa xử lý', description: 'Khoảng cách lắp đặt giữa máng điện động lực và ống chữa cháy chưa đạt 150mm.' }
];

const DEFAULT_ACTIVITIES = [
  { id: 'act-1', user: 'Nguyen Van A', action: 'đã tải lên', target: 'STR-PLAN-L02-v3.pdf', time: '10 phút trước', type: 'upload' },
  { id: 'act-2', user: 'Le Thi B', action: 'đã bình luận về', target: 'MEP-CLASH-045', time: '1 giờ trước', type: 'comment' },
  { id: 'act-3', user: 'Hệ thống', action: 'đã cập nhật trạng thái', target: 'mô hình liên kết', time: 'Hôm qua, 14:30', type: 'system' }
];

async function setup() {
  const client = new Client(config);
  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!');

    // 1. Create tables
    console.log('Creating tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        folder TEXT NOT NULL,
        sub_folder TEXT NOT NULL,
        status TEXT NOT NULL,
        revision TEXT NOT NULL,
        version TEXT NOT NULL,
        modified_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        size TEXT NOT NULL,
        creator TEXT NOT NULL,
        classification TEXT NOT NULL,
        volume TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_url TEXT
      );

      CREATE TABLE IF NOT EXISTS public.approvals (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        deadline TEXT NOT NULL,
        requester TEXT NOT NULL,
        description TEXT NOT NULL,
        file TEXT NOT NULL,
        created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.clashes (
        id TEXT PRIMARY KEY,
        elements TEXT NOT NULL,
        discipline TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.activities (
        id TEXT PRIMARY KEY,
        "user" TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        time TEXT NOT NULL,
        type TEXT NOT NULL
      );
    `);
    console.log('Tables created or already exist.');

    // 2. Enable RLS and setup policies
    console.log('Setting up Row Level Security (RLS) and policies...');
    await client.query(`
      ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.clashes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Allow anon read all" ON public.documents;
      DROP POLICY IF EXISTS "Allow anon insert all" ON public.documents;
      DROP POLICY IF EXISTS "Allow anon update all" ON public.documents;
      DROP POLICY IF EXISTS "Allow anon delete all" ON public.documents;

      DROP POLICY IF EXISTS "Allow anon read all" ON public.approvals;
      DROP POLICY IF EXISTS "Allow anon insert all" ON public.approvals;
      DROP POLICY IF EXISTS "Allow anon update all" ON public.approvals;
      DROP POLICY IF EXISTS "Allow anon delete all" ON public.approvals;

      DROP POLICY IF EXISTS "Allow anon read all" ON public.clashes;
      DROP POLICY IF EXISTS "Allow anon insert all" ON public.clashes;
      DROP POLICY IF EXISTS "Allow anon update all" ON public.clashes;
      DROP POLICY IF EXISTS "Allow anon delete all" ON public.clashes;

      DROP POLICY IF EXISTS "Allow anon read all" ON public.activities;
      DROP POLICY IF EXISTS "Allow anon insert all" ON public.activities;
      DROP POLICY IF EXISTS "Allow anon update all" ON public.activities;
      DROP POLICY IF EXISTS "Allow anon delete all" ON public.activities;

      CREATE POLICY "Allow anon read all" ON public.documents FOR SELECT USING (true);
      CREATE POLICY "Allow anon insert all" ON public.documents FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow anon update all" ON public.documents FOR UPDATE USING (true);
      CREATE POLICY "Allow anon delete all" ON public.documents FOR DELETE USING (true);

      CREATE POLICY "Allow anon read all" ON public.approvals FOR SELECT USING (true);
      CREATE POLICY "Allow anon insert all" ON public.approvals FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow anon update all" ON public.approvals FOR UPDATE USING (true);
      CREATE POLICY "Allow anon delete all" ON public.approvals FOR DELETE USING (true);

      CREATE POLICY "Allow anon read all" ON public.clashes FOR SELECT USING (true);
      CREATE POLICY "Allow anon insert all" ON public.clashes FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow anon update all" ON public.clashes FOR UPDATE USING (true);
      CREATE POLICY "Allow anon delete all" ON public.clashes FOR DELETE USING (true);

      CREATE POLICY "Allow anon read all" ON public.activities FOR SELECT USING (true);
      CREATE POLICY "Allow anon insert all" ON public.activities FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow anon update all" ON public.activities FOR UPDATE USING (true);
      CREATE POLICY "Allow anon delete all" ON public.activities FOR DELETE USING (true);
    `);
    console.log('RLS and policies configured successfully.');

    // 3. Seed data if tables are empty
    console.log('Seeding data if tables are empty...');
    
    // Seed Documents
    const docsCount = await client.query('SELECT COUNT(*) FROM public.documents');
    if (parseInt(docsCount.rows[0].count) === 0) {
      console.log('Seeding documents...');
      for (const doc of DEFAULT_DOCUMENTS) {
        await client.query(
          `INSERT INTO public.documents (id, name, folder, sub_folder, status, revision, version, modified_date, size, creator, classification, volume, file_type, file_url) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [doc.id, doc.name, doc.folder, doc.sub_folder, doc.status, doc.revision, doc.version, doc.modified_date, doc.size, doc.creator, doc.classification, doc.volume, doc.file_type, doc.file_url]
        );
      }
    }

    // Seed Approvals
    const appCount = await client.query('SELECT COUNT(*) FROM public.approvals');
    if (parseInt(appCount.rows[0].count) === 0) {
      console.log('Seeding approvals...');
      for (const app of DEFAULT_APPROVALS) {
        await client.query(
          `INSERT INTO public.approvals (id, type, deadline, requester, description, file, created_date) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [app.id, app.type, app.deadline, app.requester, app.description, app.file, app.created_date]
        );
      }
    }

    // Seed Clashes
    const clashCount = await client.query('SELECT COUNT(*) FROM public.clashes');
    if (parseInt(clashCount.rows[0].count) === 0) {
      console.log('Seeding clashes...');
      for (const clash of DEFAULT_CLASHES) {
        await client.query(
          `INSERT INTO public.clashes (id, elements, discipline, severity, status, description) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [clash.id, clash.elements, clash.discipline, clash.severity, clash.status, clash.description]
        );
      }
    }

    // Seed Activities
    const actCount = await client.query('SELECT COUNT(*) FROM public.activities');
    if (parseInt(actCount.rows[0].count) === 0) {
      console.log('Seeding activities...');
      for (const act of DEFAULT_ACTIVITIES) {
        await client.query(
          `INSERT INTO public.activities (id, "user", action, target, time, type) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [act.id, act.user, act.action, act.target, act.time, act.type]
        );
      }
    }

    console.log('Database setup and seeding completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await client.end();
  }
}

setup();
