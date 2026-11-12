import { useEffect, useState } from "react";
import { call } from "./bridge";

export const bepStages = ["WIP", "Shared", "Review", "Approved", "Published"] as const;
export type BepStage = (typeof bepStages)[number];
export type Suitability = { code: string; label: string };
type Rules = {
  reference: string;
  workingPrefix: string;
  sharedPrefix: string;
  publishedPrefix: string;
  workingSuffix: string;
  digits: number;
  statuses: Record<BepStage, Suitability[]>;
};
export type BepSettings = { version: number; rules: Rules };

const stageLabels: Record<BepStage, string> = {
  WIP: "Đang thực hiện (WIP)",
  Shared: "Chia sẻ",
  Review: "Trình xem xét",
  Approved: "Phê duyệt",
  Published: "Phát hành",
};

const example: Rules = {
  reference: "",
  workingPrefix: "P",
  sharedPrefix: "P",
  publishedPrefix: "C",
  workingSuffix: ".01",
  digits: 2,
  statuses: {
    WIP: [{ code: "S0", label: "Bản làm việc nội bộ" }],
    Shared: [{ code: "S1", label: "Dùng để phối hợp" }, { code: "S2", label: "Dùng để tham khảo" }, { code: "S3", label: "Dùng để xem xét và góp ý" }],
    Review: [{ code: "S4", label: "Trình xem xét để cho phép phát hành" }],
    Approved: [{ code: "S5", label: "Trình xem xét để chấp thuận" }],
    Published: [{ code: "A1", label: "Được phép sử dụng theo mốc đã chấp thuận" }],
  },
};

function formatOptions(options: Suitability[]) {
  return options.map(({ code, label }) => code + " | " + label).join("\n");
}

export default function ProjectBepSettings({ settings, onSave }: {
  settings: BepSettings | null;
  onSave(settings: BepSettings): void;
}) {
  const [rules, setRules] = useState(settings?.rules ?? example);
  const [statusText, setStatusText] = useState(() => Object.fromEntries(
    bepStages.map((stage) => [stage, formatOptions(rules.statuses[stage])]),
  ));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const number = "1".padStart(rules.digits, "0");

  useEffect(() => {
    const current = settings?.rules ?? example;
    setRules(current);
    setStatusText(Object.fromEntries(bepStages.map((stage) => [stage, formatOptions(current.statuses[stage])])));
  }, [settings]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const statuses = Object.fromEntries(bepStages.map((stage) => [
        stage,
        statusText[stage].split("\n").filter((line) => line.trim()).map((line) => {
          const [code, ...label] = line.split("|");
          return { code: code.trim().toUpperCase(), label: label.join("|").trim() };
        }),
      ]));
      const saved = await call<BepSettings>("bep.save", {
        expectedVersion: settings?.version ?? 0,
        rules: { ...rules, reference: rules.reference.trim(), statuses },
      });
      onSave(saved);
      setMessage("Đã lưu cấu hình BEP.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="cde-card cde-bep">
      <summary>Cấu hình BEP {settings ? "· lần " + settings.version : "· Chưa áp dụng"}</summary>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving}>
          <label>Tham chiếu BEP hoặc tiêu chuẩn thông tin dự án
            <input required maxLength={160} value={rules.reference} placeholder="Số hiệu và phiên bản tài liệu"
              onChange={(event) => setRules({ ...rules, reference: event.target.value })} />
          </label>
          <h3>Quy tắc mã phiên bản</h3>
          <div className="cde-bep-grid">
            {([["workingPrefix", "Tiền tố bản làm việc"], ["sharedPrefix", "Tiền tố bản chia sẻ và trình duyệt"], ["publishedPrefix", "Tiền tố bản phát hành"]] as const)
              .map(([field, label]) => (
                <label key={field}>{label}
                  <input required pattern="[A-Z]{1,8}" maxLength={8} value={rules[field]}
                    onChange={(event) => setRules({ ...rules, [field]: event.target.value.toUpperCase() })} />
                </label>
              ))}
            <label>Số chữ số tối thiểu
              <select value={rules.digits} onChange={(event) => setRules({ ...rules, digits: Number(event.target.value) })}>
                {[2, 3, 4, 5, 6].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>Hậu tố bản làm việc (tùy chọn)
              <input pattern="[.][0-9]{1,4}" maxLength={5} value={rules.workingSuffix}
                onChange={(event) => setRules({ ...rules, workingSuffix: event.target.value })} />
            </label>
          </div>
          <p>Ví dụ bản đầu tiên: <strong>{rules.workingPrefix + number + rules.workingSuffix}</strong> → <strong>{rules.sharedPrefix + number}</strong> → <strong>{rules.publishedPrefix + number}</strong>.</p>
          <p>Số bản phát hành chạy riêng. Khi trả về WIP, hệ thống cấp số sơ bộ mới. Quy tắc được lưu cùng hồ sơ IFC mới đăng ký.</p>
          <p>Thay đổi này chỉ áp dụng cho hồ sơ đăng ký sau khi lưu. Hồ sơ đã có giữ quy tắc và lịch sử của mình; mã Rxx cũ không được đổi lại. Ví dụ phía trên minh họa định dạng, không phải số sẽ được cấp tiếp theo.</p>
          <h3>Mã trạng thái sử dụng</h3>
          <p>Mỗi dòng ghi một mã và mục đích sử dụng, cách nhau bằng dấu <code>|</code>. Bước WIP dùng một mã mặc định.</p>
          {!settings && <p>Biểu mẫu đang hiển thị mã minh họa. Đối chiếu với BEP của dự án trước khi lưu.</p>}
          <div className="cde-bep-grid">
            {bepStages.map((stage) => (
              <label key={stage}>{stageLabels[stage]}
                <textarea required rows={3} value={statusText[stage]}
                  onChange={(event) => setStatusText({ ...statusText, [stage]: event.target.value })} />
              </label>
            ))}
          </div>
          <button className="button primary" type="submit">{saving ? "Đang lưu…" : "Lưu và áp dụng cho hồ sơ mới"}</button>
        </fieldset>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
