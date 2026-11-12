import { useState } from "react";

const groups = ["ISO 19650 & CDE", "Uniclass", "OmniClass", "LOD & LOIN", "openBIM"] as const;
type Group = (typeof groups)[number];
type Entry = {
  group: Group;
  title: string;
  description: string;
  keywords?: string;
  rows?: ReadonlyArray<readonly [code: string, description: string]>;
  sources: ReadonlyArray<readonly [title: string, url: string]>;
};

const ukGuide = "https://www.ukbimframework.org/wp-content/uploads/2021/02/Guidance-Part-C_Facilitating-the-common-data-environment-workflow-and-technical-solutions_Edition-1.pdf";
const entries: Entry[] = [
  {
    group: "ISO 19650 & CDE",
    title: "Các phần của ISO 19650",
    description: "Dùng bộ tiêu chuẩn để xác định cách tổ chức, kiểm soát và trao đổi thông tin BIM trong vòng đời tài sản.",
    rows: [
      ["ISO 19650-1:2018", "Khái niệm và nguyên tắc quản lý thông tin."],
      ["ISO 19650-2:2018", "Quy trình quản lý thông tin trong giai đoạn triển khai dự án."],
      ["ISO 19650-3:2020", "Quản lý thông tin trong giai đoạn vận hành tài sản."],
      ["ISO 19650-4:2022", "Quy trình và tiêu chí đánh giá khi trao đổi thông tin."],
      ["ISO 19650-5:2020", "Cách tiếp cận chú trọng an ninh đối với quản lý thông tin."],
      ["ISO 19650-6:2025", "Thông tin về sức khỏe và an toàn."],
    ],
    sources: [["Bộ ISO 19650 · ISO", "https://www.iso.org/sectors/building-construction/building-information-modelling"]],
  },
  {
    group: "ISO 19650 & CDE",
    title: "Trạng thái trong môi trường dữ liệu chung",
    description: "Trạng thái CDE cho biết hồ sơ đang ở đâu trong quy trình. Mã trạng thái sử dụng cho biết người nhận được phép dùng thông tin vào việc gì. Mã phiên bản nhận diện lần sửa đổi.",
    keywords: "common data environment suitability status revision mã hồ sơ container s0 s1 s2 s3 s4 s5 a1 p01 c01",
    rows: [
      ["WIP", "Thông tin đang thực hiện trong nhóm phụ trách."],
      ["Shared", "Thông tin đã được chia sẻ cho mục đích đã xác định, chẳng hạn phối hợp hoặc góp ý."],
      ["Published", "Thông tin đã qua các bước phê duyệt hoặc chấp thuận cần thiết để sử dụng theo mục đích phát hành."],
      ["Archive", "Hồ sơ lưu để truy xuất các phiên bản và quyết định trước đó."],
    ],
    sources: [["ISO 19650-1 · ISO", "https://www.iso.org/standard/68078.html"], ["Hướng dẫn quy trình CDE · IMI Framework", ukGuide]],
  },
  {
    group: "ISO 19650 & CDE",
    title: "EIR, BEP, MIDP và TIDP",
    description: "Đọc yêu cầu trao đổi trước, sau đó dùng kế hoạch thực hiện BIM và các kế hoạch giao nộp để xác định ai tạo thông tin gì, giao khi nào và kiểm tra theo tiêu chí nào.",
    rows: [
      ["EIR", "Yêu cầu trao đổi thông tin (Exchange Information Requirements)."],
      ["BEP", "Kế hoạch thực hiện BIM (BIM Execution Plan)."],
      ["TIDP", "Kế hoạch giao nộp thông tin của nhóm thực hiện công việc."],
      ["MIDP", "Kế hoạch giao nộp thông tin tổng thể, tổng hợp các TIDP."],
    ],
    sources: [["ISO 19650-2 · ISO", "https://www.iso.org/standard/68080.html"], ["Hướng dẫn quản lý thông tin · IMI Framework", "https://www.ukbimframework.org/resources/"]],
  },
  {
    group: "Uniclass",
    title: "Chọn bảng phân loại Uniclass",
    description: "Xác định đối tượng cần phân loại trước khi tra mã. Ví dụ, dùng bảng Ss cho hệ thống và bảng Pr cho sản phẩm lắp trong hệ thống đó. Ghi phiên bản bảng áp dụng trong tiêu chuẩn thông tin dự án.",
    rows: [
      ["Co", "Tổ hợp công trình (Complexes)."],
      ["En", "Công trình hoặc thực thể (Entities)."],
      ["SL", "Không gian và vị trí (Spaces/locations)."],
      ["EF", "Bộ phận và chức năng (Elements/functions)."],
      ["Ss", "Hệ thống (Systems)."],
      ["Pr", "Sản phẩm (Products)."],
      ["PM", "Thông tin quản lý dự án (Project management)."],
      ["Ss_50_30", "Hệ thống thu gom thoát nước trên mặt đất."],
    ],
    sources: [["Tra mã Uniclass · NBS", "https://uniclass.thenbs.com/"], ["Tải bảng và lịch sử cập nhật · NBS", "https://uniclass.thenbs.com/download"], ["Mã Ss_50_30 · NBS", "https://uniclass.thenbs.com/taxon/ss_50_30"]],
  },
  {
    group: "OmniClass",
    title: "Chọn bảng phân loại OmniClass",
    description: "OmniClass tổ chức thông tin xây dựng theo nhiều góc nhìn. Một cấu kiện có thể liên quan tới mã bộ phận công trình, kết quả công tác và sản phẩm trong các bảng tương ứng.",
    rows: [
      ["Table 11", "Công trình theo chức năng (Construction Entities by Function)."],
      ["Table 13", "Không gian theo chức năng (Spaces by Function)."],
      ["Table 21", "Bộ phận công trình (Elements)."],
      ["Table 22", "Kết quả công tác xây dựng (Work Results)."],
      ["Table 23", "Sản phẩm (Products)."],
      ["Table 49", "Thuộc tính (Properties)."],
    ],
    sources: [["Danh mục bảng OmniClass · CSI", "https://www.csiresources.org/standards/omniclass/standards-omniclass-about"], ["Truy cập dữ liệu mã chi tiết · CSI", "https://www.csiresources.org/thriveupgrade/standards/omniclass"]],
  },
  {
    group: "LOD & LOIN",
    title: "Bảng LOD theo BIMForum 2025",
    description: "Xác định LOD cho từng nhóm cấu kiện tại mốc giao nộp. Đối chiếu tiêu chí hình học của nhóm cấu kiện trong tài liệu gốc.",
    keywords: "level of development mức độ phát triển chi tiết shop drawing hiện trạng hoàn công as built",
    rows: [
      ["LOD 100", "Biểu diễn ý tưởng bằng ký hiệu hoặc thông tin khái quát."],
      ["LOD 200", "Hình học có thể nhận diện, với kích thước và vị trí gần đúng."],
      ["LOD 300", "Biểu diễn cấu kiện thiết kế với hình dạng, kích thước và vị trí có thể đo được."],
      ["LOD 350", "Thể hiện thêm giao diện với cấu kiện lân cận để phục vụ phối hợp."],
      ["LOD 400", "Chi tiết đủ cho chế tạo, lắp ráp và lắp đặt theo phạm vi yêu cầu."],
      ["LOD 500", "Biểu diễn hiện trạng hoặc hiện trạng sau thi công, có ghi độ chính xác."],
    ],
    sources: [["LOD Specification 2025, Part I · BIMForum", "https://bimforum.org/wp-content/uploads/2026/01/LOD-Spec-2025-Part-I-Official.pdf"]],
  },
  {
    group: "LOD & LOIN",
    title: "Mức nhu cầu thông tin (LOIN)",
    description: "Theo ISO 7817-1, mô tả lượng thông tin cần giao dựa trên mục đích, mốc giao, đối tượng và bên liên quan. Có thể quy định riêng hình học, thông tin chữ số và tài liệu đi kèm.",
    keywords: "level of information need geometry alphanumeric documentation thuộc tính tài liệu LOD",
    sources: [["ISO 7817-1:2024 · ISO", "https://www.iso.org/standard/82914.html"]],
  },
  {
    group: "openBIM",
    title: "IFC, BCF và IDS",
    description: "Chọn định dạng theo nội dung cần trao đổi trong quy trình phối hợp.",
    rows: [
      ["IFC", "Trao đổi dữ liệu mô hình công trình giữa các phần mềm."],
      ["BCF", "Trao đổi vấn đề phối hợp, góc nhìn và tham chiếu cấu kiện."],
      ["IDS", "Diễn đạt yêu cầu thông tin có thể kiểm tra tự động trên mô hình IFC."],
    ],
    sources: [["Tiêu chuẩn openBIM · buildingSMART", "https://www.buildingsmart.org/standards/"]],
  },
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
}

export default function BimLibrary() {
  const [group, setGroup] = useState<Group | "Tất cả">("Tất cả");
  const [search, setSearch] = useState("");
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
  const matches = (value: string) => {
    const text = normalize(value);
    return terms.every((term) => text.includes(term));
  };
  const results = entries.flatMap((entry) => {
    if (group !== "Tất cả" && group !== entry.group) return [];
    const summary = [entry.group, entry.title, entry.description, entry.keywords].join(" ");
    if (matches(summary)) return [entry];
    const rows = entry.rows?.filter((row) => matches(summary + " " + row.join(" ")));
    return rows?.length ? [{ ...entry, rows }] : [];
  });

  return (
    <div className="bim-library">
      <div className="project-page-heading">
        <div>
          <h1>Tri thức BIM</h1>
          <p>Tra thuật ngữ, bảng phân loại, mức độ phát triển mô hình và quy trình quản lý thông tin.</p>
        </div>
      </div>
      <label className="bim-library-search">
        Tìm theo từ khóa hoặc mã
        <input type="search" placeholder="ISO 19650-2, Ss_50_30, Table 23, LOD 350…" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </label>
      <nav className="cde-file-views" aria-label="Chủ đề tra cứu">
        {(["Tất cả", ...groups] as const).map((item) => (
          <button key={item} type="button" aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>
        ))}
      </nav>
      <p role="status">{results.length ? results.length + " mục phù hợp" : "Không tìm thấy mục phù hợp. Thử từ khóa hoặc chủ đề khác."}</p>
      <div className="bim-library-grid">
        {results.map((entry) => (
          <article className="cde-card" key={entry.title}>
            <h2>{entry.title}</h2>
            <p>{entry.description}</p>
            {entry.rows && (
              <div className="cde-table">
                <table aria-label={entry.title}>
                  <thead><tr><th scope="col">Mã hoặc thuật ngữ</th><th scope="col">Nội dung</th></tr></thead>
                  <tbody>{entry.rows.map(([code, description]) => (
                    <tr key={code}><th scope="row">{code}</th><td>{description}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <ul>{entry.sources.map(([title, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{title}</a></li>)}</ul>
          </article>
        ))}
      </div>
    </div>
  );
}
