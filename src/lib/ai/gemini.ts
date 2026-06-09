import { GoogleGenAI } from '@google/genai';

/**
 * Lớp bọc Gemini cho Trợ lý AI của CDE CIC.
 *
 * LƯU Ý BẢO MẬT: Ở giai đoạn MVP, key Gemini được gọi trực tiếp từ trình duyệt
 * (VITE_GEMINI_API_KEY). Điều này làm lộ key phía client — chấp nhận được cho
 * prototype/pilot với dev key. Khi có backend (Milestone 2), phải chuyển lời gọi
 * Gemini qua proxy server-side (Supabase Edge Function) và bỏ key khỏi client.
 */

const MODEL = 'gemini-2.5-flash';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let client: GoogleGenAI | null = null;

/** True nếu đã cấu hình key Gemini. */
export function isAiConfigured(): boolean {
  return Boolean(apiKey && apiKey !== 'your-gemini-api-key');
}

function getClient(): GoogleGenAI | null {
  if (!isAiConfigured()) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey: apiKey as string });
  }
  return client;
}

const SYSTEM_PROMPT = `Bạn là Trợ lý AI của nền tảng CDE CIC — môi trường dữ liệu chung (Common Data Environment) cho ngành xây dựng Việt Nam.
Chuyên môn của bạn:
- Tiêu chuẩn ISO 19650 (quản lý thông tin BIM, quy tắc đặt tên tệp, trạng thái WIP/Shared/Published/Archived, suitability codes).
- Tiêu chuẩn Việt Nam (TCVN) về thiết kế, kết cấu, động đất (TCVN 9386), phòng cháy.
- Mô hình BIM/IFC, phối hợp đa bộ môn, phát hiện xung đột (clash detection), định dạng BCF.
- Quản lý dự án: tiến độ 4D, chi phí 5D, phân tích giá trị thu được (EVA/EVM).
- Định mức, đơn giá xây dựng theo quy định Bộ Xây dựng.
Quy tắc trả lời:
- Trả lời bằng tiếng Việt, chính xác, súc tích, có cấu trúc rõ ràng.
- Khi không chắc chắn, nói rõ và đề xuất cách kiểm chứng. Không bịa số liệu.
- Ưu tiên thông tin thực tế áp dụng được cho kỹ sư/quản lý dự án tại Việt Nam.`;

export interface ChatTurn {
  sender: 'user' | 'ai';
  text: string;
}

/**
 * Hỏi đáp với trợ lý AI. `context` là thông tin bối cảnh dự án (tùy chọn) để
 * AI trả lời sát thực tế (ví dụ: chỉ số ngân sách, tỷ lệ phê duyệt).
 */
export async function askAssistant(
  history: ChatTurn[],
  latestQuestion: string,
  context?: string
): Promise<string> {
  const ai = getClient();
  if (!ai) {
    return fallbackAnswer(latestQuestion);
  }

  // Dựng nội dung hội thoại theo định dạng contents của Gemini.
  const contents = [
    ...history.map((t) => ({
      role: t.sender === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: t.text }],
    })),
    { role: 'user' as const, parts: [{ text: latestQuestion }] },
  ];

  const systemInstruction = context
    ? `${SYSTEM_PROMPT}\n\nBối cảnh dự án hiện tại:\n${context}`
    : SYSTEM_PROMPT;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction },
    });
    return response.text?.trim() || 'Xin lỗi, tôi chưa tạo được phản hồi. Vui lòng thử lại.';
  } catch (err) {
    console.error('Gemini askAssistant error:', err);
    return `Không kết nối được tới dịch vụ AI (${(err as Error).message}). ${fallbackAnswer(latestQuestion)}`;
  }
}

/**
 * Phân tích một cấu kiện BIM đang được chọn trong viewer.
 * `properties` là object thuộc tính cấu kiện (tên, loại IFC, GUID, Pset...).
 */
export async function analyzeElement(properties: Record<string, any>): Promise<string> {
  const ai = getClient();
  const name = properties.Name ?? 'Cấu kiện';
  const type = properties.type ?? properties.ObjectType ?? 'IFC ELEMENT';

  if (!ai) {
    return `Trợ lý AI chưa được cấu hình (thiếu VITE_GEMINI_API_KEY). Cấu kiện đang chọn: ${name} (${type}).`;
  }

  // Lọc bớt thuộc tính rỗng để prompt gọn.
  const propText = Object.entries(properties)
    .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !k.startsWith('_'))
    .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');

  const question = `Phân tích cấu kiện BIM sau và đưa ra nhận xét kỹ thuật ngắn gọn (vai trò trong công trình, lưu ý về phối hợp/xung đột tiềm ẩn, tiêu chuẩn liên quan nếu có):\n${propText}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: question }] }],
      config: { systemInstruction: SYSTEM_PROMPT },
    });
    return response.text?.trim() || 'Không tạo được phân tích cho cấu kiện này.';
  } catch (err) {
    console.error('Gemini analyzeElement error:', err);
    return `Không kết nối được tới dịch vụ AI (${(err as Error).message}).`;
  }
}

/**
 * Câu trả lời dự phòng khi chưa cấu hình key hoặc lỗi mạng — giữ trải nghiệm
 * không gãy. Đây là phiên bản rút gọn của logic keyword cũ.
 */
function fallbackAnswer(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('19650') || q.includes('đặt tên') || q.includes('naming')) {
    return 'Theo ISO 19650, tên file gồm 7 trường phân tách bằng "-": [Dự án]-[Đơn vị]-[Phân khu]-[Cao trình]-[Loại]-[Bộ môn]-[Số thứ tự]. Ví dụ: PRJ-ARC-Z01-ZZ-M3-A-0001.';
  }
  if (q.includes('9386') || q.includes('động đất') || q.includes('tcvn')) {
    return 'TCVN 9386:2012 quy định thiết kế công trình chịu động đất, bao gồm xác định gia tốc nền thiết kế và hệ số ứng xử kết cấu q theo cấp dẻo.';
  }
  if (q.includes('eva') || q.includes('chi phí') || q.includes('tiến độ') || q.includes('ngân sách')) {
    return 'Phân tích EVA dựa trên BAC (ngân sách hoàn thành), AC (chi phí thực tế), EV (giá trị thu được). So sánh CPI=EV/AC và SPI=EV/PV để đánh giá sức khỏe dự án.';
  }
  return '(Chế độ ngoại tuyến — chưa cấu hình AI) Vui lòng đặt VITE_GEMINI_API_KEY trong .env để bật trợ lý AI đầy đủ.';
}
