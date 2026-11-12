import { clashPresets, type ClashClass } from "./clashChecks";

export default function ClashCheckGuide({ classA, classB, checking, onPreset }: {
  classA: ClashClass;
  classB: ClashClass;
  checking: boolean;
  onPreset(classA: ClashClass, classB: ClashClass): void;
}) {
  return (
    <div className="clash-guide">
      <div className="clash-presets" role="group" aria-label="Gợi ý phép kiểm tra">
        <strong>Gợi ý phép kiểm tra</strong>
        {clashPresets.map((preset) => (
          <button key={preset.label} type="button" className="button secondary tiny"
            aria-pressed={classA === preset.classA && classB === preset.classB}
            disabled={checking} onClick={() => onPreset(preset.classA, preset.classB)}>
            {preset.label}
          </button>
        ))}
      </div>
      <details>
        <summary>Hướng dẫn kiểm tra va chạm</summary>
        <ol>
          <li>Kiểm tra mô hình đã đúng phiên bản, vị trí và cao độ trong khung nhìn 3D.</li>
          <li>Chọn cặp lớp IFC, rồi chọn mô hình tương ứng cho nhóm A và B. Dùng số đối tượng xem trước để kiểm tra nhanh phạm vi.</li>
          <li>Chọn một tầng để thử trước. Nhập ngưỡng giao cắt theo BEP hoặc ma trận va chạm của dự án. Ngưỡng này đo phần giao cắt, còn khoảng hở lắp đặt cần phép kiểm riêng.</li>
          <li>Sau khi chạy, kiểm tra độ bao phủ trước khi kết luận. Mở va chạm trong 3D, tạo vấn đề phối hợp khi cần xử lý và chạy lại sau khi cập nhật IFC.</li>
        </ol>
      </details>
    </div>
  );
}
