import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import JSZip from 'jszip';

// 1. Mock browser globals for headless Node.js environment
// This is critical because Three.js and ThatOpen components originally target the browser
if (typeof global.window === 'undefined') {
  const noop = () => ({});
  (global as any).window = global;
  (global as any).self = global;
  (global as any).document = {
    createElement: () => ({
      getContext: () => ({
        fillStyle: '',
        fillRect: noop,
        drawImage: noop,
        getImageData: () => ({ data: [] }),
        putImageData: noop,
        createImageData: () => ({}),
      }),
      style: {},
      width: 100,
      height: 100,
    }),
    createElementNS: () => ({}),
    addEventListener: noop,
    removeEventListener: noop,
  };
  try {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'node' },
      writable: true,
      configurable: true
    });
  } catch (e) {
    // navigator đã được Node.js định nghĩa sẵn và không cho ghi đè trực tiếp
  }
}

// Import Three.js and ThatOpen components AFTER mocking browser globals
import * as OBC from '@thatopen/components';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pollingInterval = parseInt(process.env.POLLING_INTERVAL || '5000', 10);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('LỖI: Chưa cấu hình SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong tệp .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Giải nén tệp .ifczip/.zip tương tự như phía Frontend
const extractIfcBuffer = async (buffer: Uint8Array, name = ''): Promise<Uint8Array> => {
  const isZip = /\.(ifczip|zip)$/i.test(name) || (buffer[0] === 0x50 && buffer[1] === 0x4b); // Chữ ký 'PK'
  if (!isZip) return buffer;
  
  console.log(`[ZIP] Đang giải nén tệp tin: ${name}...`);
  const zip = await JSZip.loadAsync(buffer);
  const entry = Object.keys(zip.files).find(p => /\.ifc$/i.test(p) && !zip.files[p].dir);
  if (!entry) throw new Error('Không tìm thấy tệp .ifc bên trong file nén.');
  
  const extracted = await zip.files[entry].async('uint8array');
  console.log(`[ZIP] Đã giải nén thành công: ${entry} (${(extracted.length / 1024 / 1024).toFixed(2)} MB)`);
  return extracted;
};

// Hàm phụ trợ để làm sạch chuỗi
const cleanString = (val: any): string => {
  if (val === null || val === undefined) return '';
  const v = typeof val === 'object' && 'value' in val ? val.value : val;
  return String(v ?? '').trim();
};

// Hàm chuyển đổi chính chạy Headless
const convertIfc = async (ifcBuffer: Uint8Array, modelName: string) => {
  console.log(`[CONVERTER] Đang khởi tạo ThatOpen Components Headless...`);
  const components = new OBC.Components();
  
  // Khởi tạo FragmentsManager
  const fragments = components.get(OBC.FragmentsManager);
  
  // Khởi tạo IfcLoader và cấu hình WASM
  const ifcLoader = components.get(OBC.IfcLoader);
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      // Dùng CDN unpkg cho môi trường headless độc lập
      path: 'https://unpkg.com/web-ifc@0.0.77/',
      absolute: true
    }
  });

  console.log(`[CONVERTER] Đang nạp và phân tích cú pháp IFC (web-ifc)...`);
  const model = await ifcLoader.load(ifcBuffer, true, modelName, {
    instanceCallback: (importer: any) => {
      importer.addAllAttributes();
      importer.addAllRelations();
    }
  });

  console.log(`[CONVERTER] Đang đóng gói tệp tin Fragments (.frag)...`);
  const fragBuffer = await model.getBuffer(false);
  // Đổi thành byteLength vì getBuffer trả về ArrayBuffer, không có thuộc tính .length
  console.log(`[CONVERTER] Đã tạo thành công tệp .frag (${(fragBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  console.log(`[CONVERTER] Đang trích xuất thuộc tính cấu kiện hình học...`);
  const localIds = Array.from(await model.getLocalIds()) as number[];
  const elementsData: any[] = [];
  
  // Chia lô (Batch) để tránh ngốn bộ nhớ RAM khi trích xuất khối lượng lớn
  const BATCH = 3000;
  for (let i = 0; i < localIds.length; i += BATCH) {
    const batchIds = localIds.slice(i, i + BATCH);
    const itemsData = await model.getItemsData(batchIds);
    
    for (const item of itemsData) {
      if (!item) continue;
      const anyItem = item as any; // Cast sang any để tránh lỗi kiểm tra kiểu dữ liệu của ThatOpen
      const id = anyItem._localId ? anyItem._localId.value : null;
      if (id === null) continue;
      
      const guid = anyItem._guid ? anyItem._guid.value : 'N/A';
      const category = cleanString(anyItem._category) || 'IFC ELEMENT';
      
      // Xây dựng tên hiển thị
      let name = '';
      if (anyItem.Name) {
        name = typeof anyItem.Name === 'object' && 'value' in anyItem.Name ? anyItem.Name.value : anyItem.Name;
      }
      name = name ? String(name) : `${category} [ID: ${id}]`;

      const props: any = {
        expressID: id,
        expressId: id,
        Name: name,
        ObjectType: anyItem.ObjectType ? (anyItem.ObjectType.value !== undefined ? anyItem.ObjectType.value : anyItem.ObjectType) : category,
        GlobalId: guid,
        GUID: guid,
        type: category
      };

      // Đưa toàn bộ các thuộc tính khác vào đối tượng JSON
      for (const key in anyItem) {
        if (!['_category', '_localId', '_guid', 'Name', 'ObjectType'].includes(key) && anyItem[key] !== null) {
          const val = anyItem[key];
          props[key] = val && val.value !== undefined ? val.value : val;
        }
      }

      elementsData.push({
        express_id: id,
        global_id: guid,
        name: name,
        category: category,
        properties: props
      });
    }
    
    // Giải phóng CPU giữa các lô
    await new Promise(r => setTimeout(r, 5));
  }

  console.log(`[CONVERTER] Đã trích xuất xong ${elementsData.length} cấu kiện.`);
  
  // Hủy giải phóng các component để tránh rò rỉ bộ nhớ (Memory leak)
  components.dispose();

  return { fragBuffer, elementsData };
};

// Vòng lặp quét tệp cần xử lý
const pollAndProcess = async () => {
  try {
    // 1. Tìm các tài liệu IFC chưa được chuyển đổi (frag_url là null hoặc rỗng)
    // Để an toàn, chúng ta quét tệp có file_type = 'ifc' và frag_url IS NULL
    const { data: docs, error } = await supabase
      .from('documents')
      .select('*')
      .eq('file_type', 'ifc')
      .or('frag_url.is.null,frag_url.eq.failed') // Quét tệp chưa làm hoặc đã làm bị lỗi trước đó
      .limit(1); // Xử lý tuần tự từng tệp một để không quá tải RAM

    if (error) {
      console.error('[DATABASE] Lỗi truy vấn bảng documents:', error.message);
      return;
    }

    if (!docs || docs.length === 0) {
      // Không có tệp nào cần xử lý
      return;
    }

    const doc = docs[0];
    const projectId = doc.project_id;
    const documentId = doc.id;
    const code = doc.code;
    const fileUrl = doc.file_url;

    if (!fileUrl) {
      console.warn(`[WARNING] Tài liệu [${code}] không có file_url. Bỏ qua.`);
      return;
    }

    console.log(`\n============================================================`);
    console.log(`[START] Bắt đầu xử lý tài liệu: ${doc.name} (${code})`);
    console.log(`[START] Dự án ID: ${projectId} | Tài liệu ID: ${documentId}`);
    
    // 2. Cập nhật trạng thái sang "processing" để khóa tệp, tránh worker khác tranh chấp
    await supabase
      .from('documents')
      .update({ frag_url: 'processing' })
      .eq('id', documentId);

    console.log(`[DATABASE] Đã khóa tài liệu (frag_url = 'processing')`);

    try {
      // 3. Tải file IFC từ Storage
      // Trích xuất path tương đối của file từ public URL
      // URL mẫu: http://.../storage/v1/object/public/cde-files/projects/PROJECT_ID/file.ifc
      const marker = '/storage/v1/object/public/cde-files/';
      const idx = fileUrl.indexOf(marker);
      if (idx === -1) {
        throw new Error(`Public URL không hợp lệ hoặc không thuộc bucket cde-files: ${fileUrl}`);
      }
      const storagePath = decodeURIComponent(fileUrl.slice(idx + marker.length));

      console.log(`[STORAGE] Đang tải tệp tin từ Storage: ${storagePath}...`);
      const { data: fileData, error: dlError } = await supabase.storage
        .from('cde-files')
        .download(storagePath);

      if (dlError || !fileData) {
        throw new Error(`Không thể tải tệp từ Storage: ${dlError?.message || 'Không có dữ liệu'}`);
      }

      console.log(`[STORAGE] Đã tải xong tệp tin gốc (${(fileData.size / 1024 / 1024).toFixed(2)} MB)`);

      // 4. Đọc buffer dữ liệu
      const arrayBuffer = await fileData.arrayBuffer();
      let buffer: any = new Uint8Array(arrayBuffer);
      
      // Tự động giải nén nếu là file .ifczip/.zip
      buffer = await extractIfcBuffer(buffer, doc.name);

      // 5. Chạy chuyển đổi
      const { fragBuffer, elementsData } = await convertIfc(buffer, doc.name);

      // 6. Upload file .frag kết quả lên Storage
      const fragStoragePath = `frags/${projectId}/${code}.frag`;
      console.log(`[STORAGE] Đang upload tệp tin .frag lên Storage: ${fragStoragePath}...`);
      
      const { error: upError } = await supabase.storage
        .from('cde-files')
        .upload(fragStoragePath, fragBuffer, {
          contentType: 'application/octet-stream',
          upsert: true
        });

      if (upError) {
        throw new Error(`Lỗi upload tệp .frag lên Storage: ${upError.message}`);
      }

      // Lấy public URL của file .frag vừa upload
      const { data: { publicUrl: fragUrl } } = supabase.storage
        .from('cde-files')
        .getPublicUrl(fragStoragePath);

      console.log(`[STORAGE] Đã upload tệp .frag thành công. Public URL: ${fragUrl}`);

      // 7. Ghi thông tin cấu kiện và thuộc tính (Properties) vào CSDL (Phương án B)
      console.log(`[DATABASE] Đang lưu ${elementsData.length} cấu kiện vào bảng elements...`);
      
      // Xóa các cấu kiện cũ của tài liệu này trước (nếu có - trường hợp chạy lại)
      await supabase
        .from('elements')
        .delete()
        .eq('document_id', documentId);

      // Chèn hàng loạt (Batch Insert) cấu kiện theo các gói nhỏ để tránh lỗi quá tải query
      const DB_BATCH = 1000;
      for (let k = 0; k < elementsData.length; k += DB_BATCH) {
        const batch = elementsData.slice(k, k + DB_BATCH).map(el => ({
          project_id: projectId,
          document_id: documentId,
          express_id: el.express_id,
          global_id: el.global_id,
          name: el.name,
          category: el.category,
          properties: el.properties
        }));

        const { error: insError } = await supabase
          .from('elements')
          .insert(batch);

        if (insError) {
          throw new Error(`Lỗi insert batch cấu kiện (vị trí ${k}): ${insError.message}`);
        }
        console.log(`[DATABASE] Đã chèn cấu kiện: ${Math.min(k + DB_BATCH, elementsData.length)} / ${elementsData.length}`);
      }

      // 8. Cập nhật hoàn tất thông tin tài liệu trong DB
      const { error: finalError } = await supabase
        .from('documents')
        .update({
          frag_url: fragUrl,
          // Đổi sang trạng thái SHARED theo đúng phân kỳ tài liệu khi có mô hình 3D sẵn sàng
          status: doc.status === 'S0 - WIP' ? 'S0 - WIP' : 'S1 - SHARED'
        })
        .eq('id', documentId);

      if (finalError) {
        throw new Error(`Lỗi cập nhật hoàn tất tài liệu: ${finalError.message}`);
      }

      console.log(`[SUCCESS] Hoàn thành chuyển đổi hoàn tất cho tài liệu: ${doc.name}`);
      console.log(`============================================================\n`);

    } catch (processError: any) {
      console.error(`[ERROR] Lỗi trong quá trình xử lý tệp:`, processError);
      
      // Ghi nhận lỗi vào trường frag_url để hiển thị trạng thái lỗi trên Frontend
      // Đồng thời giúp worker bỏ qua không quét lại tệp lỗi này liên tục
      const errMsg = `failed: ${processError.message || processError}`;
      await supabase
        .from('documents')
        .update({ frag_url: errMsg.slice(0, 200) }) // Giới hạn độ dài text lưu trữ
        .eq('id', documentId);
        
      console.log(`[DATABASE] Đã ghi nhận lỗi chuyển đổi cho tài liệu.`);
      console.log(`============================================================\n`);
    }

  } catch (err) {
    console.error('[SYSTEM] Lỗi hệ thống ngoài dự kiến:', err);
  }
};

// Chạy vòng lặp quét liên tục
const startWorker = async () => {
  console.log(`============================================================`);
  console.log(`   CDE CIC CONVERTER WORKER ĐANG KHỞI CHẠY (PHƯƠNG ÁN B) `);
  console.log(`   Địa chỉ kết nối Supabase: ${supabaseUrl}`);
  console.log(`   Chu kỳ quét: ${pollingInterval} ms`);
  console.log(`============================================================\n`);

  // Chạy lượt quét đầu tiên ngay lập tức
  await pollAndProcess();

  // Thiết lập hẹn giờ quét định kỳ
  setInterval(async () => {
    await pollAndProcess();
  }, pollingInterval);
};

startWorker();
