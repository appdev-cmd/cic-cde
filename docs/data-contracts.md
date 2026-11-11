# Dữ liệu và giao thức QA BIM

Mô hình dữ liệu tách nguồn IFC, phiên bản nhập, bằng chứng kiểm tra và hồ sơ xử lý. Rust core là nơi xác thực và ghi dữ liệu; các adapter không được tạo phiên bản nghiệp vụ riêng.

## Thực thể chính

| Thực thể | Nội dung và ràng buộc |
| --- | --- |
| Project | ID, tên, đơn vị hiển thị, project frame, schema version |
| Model | Logical model ID, bộ môn, tên; giữ nguyên qua các lần thay IFC |
| ModelVersion | Model ID, IFC hash, schema, import version, trạng thái, coverage |
| TransformRevision | Model version, matrix model-to-project, nguồn, revision |
| Element | Internal ID, model version, STEP ID, GlobalId nullable, class, name, spatial parent |
| Property | Element, property path, typed value, unit và provenance |
| SelectionSetRevision | Filter AST hoặc danh sách element refs, revision và scope |
| RuleDefinition | Logical rule ID, type, metadata và version schema |
| RuleRevision | Bộ lọc A/B, dung sai, exclusions, severity, digest bất biến |
| CheckRun | Snapshot đầu vào, engine version, coverage, thời điểm, trạng thái |
| Finding | Quan sát bất biến trong một CheckRun, evidence và measures |
| Conflict | Vấn đề kỹ thuật được đối chiếu qua các CheckRun |
| FindingMatch | Finding, conflict, confidence, phương pháp và quyết định duyệt |
| Issue | Hồ sơ xử lý độc lập: title, status, assignee, priority, revision |
| IssueConflict | Liên kết nhiều issue với conflict khi nghiệp vụ cho phép |
| Viewpoint | Camera, clips, visibility, selection, màu, frame revision, ảnh |
| Job | Loại công việc, snapshot, progress, trạng thái và artifact refs |
| AuditEntry | Actor, source UI/AI/MCP, command, diff summary, correlation ID |

Element ref tối thiểu gồm modelVersionId và elementId. GlobalId giúp trao đổi/đối chiếu, nhưng không được giả định luôn tồn tại hoặc duy nhất. STEP ID chỉ có ý nghĩa trong một file version.

Property giữ kiểu string/number/bool/enum/ref, unit và null/missing riêng biệt. Không gom toàn bộ thành chuỗi rồi so sánh bằng văn bản. Tầng/hệ thống không tìm thấy được ghi unknown, không tự gán theo tên file.

## Nhóm bảng SQLite

```text
projects, models, model_versions, transform_revisions
elements, spatial_nodes, element_relationships, properties
selection_sets, selection_set_revisions
rule_definitions, rule_revisions, rule_sets, rule_set_members
check_runs, check_run_models, findings, finding_elements
conflicts, finding_matches, conflict_decisions
issues, issue_conflicts, issue_comments, viewpoints, attachments
jobs, job_artifacts, command_receipts, audit_entries
ai_sessions, ai_runs, ai_tool_calls
```

Index đầu tiên: model version + STEP ID; model version + GlobalId không unique; class/tầng/hệ thống; check run + rule; conflict + finding; issue status/assignee. Chỉ index các property thường truy vấn theo benchmark; không tạo index cho mọi tên thuộc tính.

Project có schema_version. Import staging không được xuất hiện như model ready. FK và transaction bảo vệ việc liên kết issue/finding. Deletes là thao tác có chính sách giữ lịch sử; xóa cache khác với xóa bằng chứng hoặc model version.

## Truy vấn và SelectionSet

Một Filter AST dùng chung cho UI, check và AI. Toán tử đầu tiên: and/or/not, eq, in, contains, exists và so sánh số với unit. Field được whitelist; không chấp nhận raw SQL hoặc Python từ agent.

```json
{
  "scope": {"modelVersionIds": ["mv-hvac-01"]},
  "where": {
    "op": "and",
    "args": [
      {"field": "ifcClass", "op": "in", "value": ["IfcDuctSegment"]},
      {"field": "storeyId", "op": "eq", "value": "storey-l05"}
    ]
  },
  "select": ["elementId", "globalId", "name", "ifcClass"],
  "page": {"limit": 100, "cursor": null}
}
```

IDs trong ví dụ là ký hiệu minh họa; implementation dùng ID hợp lệ có kiểu. Cursor gắn snapshot/query digest, không dùng lại sau khi đổi scope. Bên gọi đặt limit nhưng core áp giới hạn trên và response byte budget.

## Application API

Commands thay đổi trạng thái; queries đọc dữ liệu; events thông báo thay đổi. Dùng handler có kiểu cho từng operation, registry chỉ cung cấp mô tả và dispatch, không chuyển mọi thứ thành JSON không kiểm soát trong domain.

Envelope ngoài cùng có schemaVersion, requestId, projectId, sessionId, expectedRevision và idempotencyKey khi phù hợp. Actor và scopes do adapter xác thực gắn vào, không tin giá trị actor do client tự gửi.

```json
{
  "schemaVersion": 1,
  "requestId": "req-001",
  "projectId": "project-a",
  "sessionId": "session-a",
  "operation": "checks.run",
  "idempotencyKey": "request-from-client-001",
  "payload": {
    "ruleRevisionId": "rule-hvac-str-r1",
    "modelVersionIds": ["mv-hvac-01", "mv-str-01"],
    "transformRevisionIds": ["tr-hvac-01", "tr-str-01"]
  }
}
```

Lời gọi checks.run trả accepted + jobId, không chặn đến khi tính xong. Idempotency key gắn operation, actor, project và input digest; retry cùng key/khác payload là lỗi. command_receipts giúp phục hồi khi response mất sau commit.

Lỗi có code như INVALID_INPUT, REVISION_CONFLICT, MODEL_NOT_READY, UNSUPPORTED_SCHEMA, INCOMPLETE_GEOMETRY, WORKER_UNAVAILABLE, RESOURCE_LIMIT, VIEWER_NOT_AVAILABLE và PERMISSION_DENIED. Không đưa traceback thô hoặc secrets vào message cho AI.

## Core và worker

Giao tiếp JSON-RPC có schema phiên bản trên stdin/stdout; stdout chỉ chứa protocol frames, stderr chứa log có giới hạn. Mỗi frame có size cap. Binary geometry và danh sách lớn đi qua artifact files có hash, không nhét vào JSON RPC.

Handshake gồm protocolVersion, buildId, IfcOpenShell version, platform và capabilities như import_ifc, export_glb, clash_intersection, bcf_xml_2_1. Chỉ bật tính năng sau khi capability tương thích và đã qua test.

Worker operations đầu tiên:

```text
worker.hello
model.open / model.release
model.extract_metadata
geometry.build_cache
checks.execute
bcf.import / bcf.export
worker.cancel
```

model handle là tài nguyên tạm của worker, không lưu như ID bền vững. Khởi động worker lại phải mở lại model. Yêu cầu chứa snapshot refs và artifact refs, không chứa đường dẫn tùy ý từ agent.

Supervisor đọc stdout/stderr bất đồng bộ, giới hạn queue và xử lý backpressure. Worker control reader nhận cancel độc lập với job; kiểm tra cancellation flag giữa batches. Nếu native call không trả lại quyền điều khiển sau grace period, core kill worker và cây tiến trình đã sở hữu qua Windows Job Object. Worker mất handle, job được ghi cancelled/interrupted, output chưa commit vẫn ở staging để cleanup.

Timeout chia thành startup, heartbeat liveness, job deadline và cancellation grace. Một native call lâu không phát progress không tự được coi là deadlock chỉ vì phần trăm chưa tăng.

## Truyền dữ liệu sang Viewer

Commands nhỏ dùng Tauri invoke. Progress và stream dùng Channel có typed payload; events nhỏ cho project/model/issue changed. Geometry đi qua bounded binary response/channel hoặc asset protocol chỉ cho cache IDs đã đăng ký.

Không dùng base64 cho mesh; không emit event JSON chứa toàn bộ vertex buffer. Custom asset handler resolve ID sang đường dẫn canonical trong cache được phép, xử lý traversal/symlink escape và kiểm tra session ownership.

Desired ViewState do core giữ; renderer báo applied revision hoặc lỗi. Command view.select chỉ được coi là đã áp dụng khi có acknowledgement của đúng view/session. Nếu WebView đang đóng hoặc device lost, trả lỗi rõ, không báo thành công giả.

## Geometry cache

```text
cache/<cache-key>/
  manifest.json
  elements.map.jsonl
  chunks/
    000001.glb
    000002.glb
  diagnostics.json
```

Cache key gồm IFC snapshot hash, engine build, importer/exporter version, geometry settings và coordinate policy. Transform nằm ngoài cache chỉ khi toàn pipeline dùng model-local geometry và chứng minh có thể áp transform ở runtime; nếu bake transform thì đưa transform revision vào key.

Manifest ghi cacheSchemaVersion, source hash, units, axes, render origin policy, bbox, chunks, geometry counts và mapping digest. Mapping phải xác định element cho node/primitive/instance và cả batch ranges nếu có merge. Instancing không được làm mất selection identity.

Display tessellation tolerance khác check tolerance. Clash không được chạy trên mesh đã decimate cho hiển thị mà không ghi rõ phương pháp và độ chính xác.

## Trạng thái công việc

```text
queued → running → succeeded
             ├──→ succeeded_with_warnings
             ├──→ failed
             ├──→ cancelling → cancelled
             └──→ interrupted
```

Job success khác check pass. CheckRun có thể hoàn thành và tìm thấy nhiều lỗi. Coverage được lưu độc lập: số cấu kiện scope, hình học tạo được, skip/error, cặp đã xét và phần bị giới hạn.

Run limitReached, incomplete hoặc cancelled không được dùng để tự kết luận hết va chạm. Query kết quả có nextCursor và total khi biết; không dùng số trả về của một page làm tổng.

## Đối chiếu qua phiên bản

1. Đối chiếu Model logic và GlobalId duy nhất trong các version liên quan.
2. Xác nhận rule semantics, scope và transform revisions tương thích.
3. Với GUID thay đổi, dùng class, quan hệ, thuộc tính và vị trí làm ứng viên; lưu confidence, không ép match một-một khi mơ hồ.
4. Đối chiếu conflict có thể có nhiều vùng giao cắt trên cùng cặp đối tượng; pair key không đủ để nhận diện mọi trường hợp.
5. Gom nhóm mới không làm mất conflict/issue identity.

Conflict không xuất hiện ở lần chạy mới chỉ được đề xuất fixed khi run hoàn tất, coverage đủ, hai phía liên quan đã được kiểm lại và rule/scope tương thích. Model bị bỏ khỏi federation, import lỗi, GUID mơ hồ hoặc rule đổi chuyển needs_review. Việc đóng issue thuộc workflow riêng; một issue còn conflict active không tự đóng.

## BCF và khả năng trao đổi

Issue giữ UUID nội bộ và BCF topic GUID mapping. Lưu cả model/source refs vì GlobalId có thể trùng giữa file. Viewpoint export đổi camera, hướng và clipping planes về đúng frame; ảnh chụp là bằng chứng phụ, không thay tọa độ và component refs.

MVP kiểm round-trip BCF XML 2.1 với ít nhất hai phần mềm đích khi sẵn có. Có báo cáo trường không biểu diễn được; không tuyên bố toàn bộ trạng thái nội bộ đều được BCF giữ nguyên. IfcOpenShell có thư viện BCF, nhưng phải pin và kiểm phiên bản được đóng gói. [IfcOpenShell BCF](https://docs.ifcopenshell.org/bcf.html).
