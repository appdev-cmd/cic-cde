# Cấu trúc dự án QA BIM

Monorepo chứa ba phần nguồn Rust, TypeScript và Python. Cây dưới đây là cấu trúc đích; hiện chỉ có bộ tài liệu thiết kế và evidence nghiên cứu, chưa scaffold các package ứng dụng.

## Cây thư mục đích

```text
qa-bim/
  README.md
  Cargo.toml                         # Rust workspace
  rust-toolchain.toml
  package.json                       # Workspace tasks
  pnpm-workspace.yaml
  pnpm-lock.yaml
  apps/
    desktop/
      package.json
      vite.config.ts
      src/
        app/                         # Bootstrap, routes, providers
        shell/                       # Navigation và workspace layout
        features/
          projects/
          models/
          checks/
          issues/
          data/
          assistant/
          automation/
        bridge/                      # Typed Tauri client và events
        state/                       # UI state, không chứa toàn bộ model
        styles/                      # Tokens, theme, typography
      src-tauri/
        Cargo.toml
        tauri.conf.json
        capabilities/
        binaries/                    # Build artifacts, không commit binary
        src/
          main.rs
          lib.rs
          commands.rs                # Adapter mỏng vào application API
          lifecycle.rs
          asset_protocol.rs
          viewer_dispatch.rs
  crates/
    contracts/                       # DTO, IDs, error và protocol envelope
    domain/                          # Entities, invariants, filter AST
    application/                     # Use cases, registry, service ports
    infrastructure/
      src/
        persistence/                 # SQLx repositories và migrations
        files/                       # Model store, cache, staging
        worker/                      # Supervisor và worker RPC
        local_ipc/                   # Named pipe và session discovery
        diagnostics/
      migrations/
    ai/
      src/
        runtime/                     # Tool loop, budgets, cancellation
        providers/                   # Adapter, không phụ thuộc trong domain
        context/                     # Context builder và source references
    mcp/
      src/
        main.rs                      # Binary qa-bim-mcp
        server.rs
        tools.rs
        resources.rs
        desktop_client.rs
  packages/
    contracts/                       # Generated TS types, JSON Schemas
    ui/                              # Shared presentation components
    viewer/
      src/
        adapter.ts
        scene/
        picking/
        section/
        overlays/
        loaders/
        resources/                   # GPU lifecycle, budget, eviction
  workers/
    bim/
      pyproject.toml
      uv.lock
      src/qabim_worker/
        __main__.py
        protocol/
        import_ifc/
        metadata/
        geometry/
        checks/
        bcf/
        artifacts/
      tests/
      packaging/
  schemas/
    application/
    worker/
    geometry-cache/
    rules/
  rulesets/
    examples/                        # Bộ mẫu có version và mô tả semantics
  tests/
    contracts/
    integration/
    desktop/
    benchmarks/
    fixtures/
      manifest.json                  # Provenance và checksum
      synthetic/                     # IFC nhỏ có đáp án, được phép chia sẻ
  scripts/
    generate-contracts/
    build-worker/
    package-windows/
    verify-release/
  docs/
    architecture.md
    data-contracts.md
    ai-mcp.md
    implementation-plan.md
    project-structure.md
    decisions/                       # ADR khi triển khai và chốt kết quả G1
    research/
      product-reference.md
      evidence/
  .github/workflows/                  # Nếu chọn GitHub làm CI
```

## Chiều phụ thuộc

```text
contracts ← domain ← application
                    ↑         ↑
             infrastructure   ai
                    ↑         ↑
                 desktop host

mcp binary → contracts + local IPC client
React UI → generated contracts + presentation/viewer packages
Python worker → worker protocol + IfcOpenShell
```

Application định nghĩa ports cho repositories, jobs, worker và view dispatch. Infrastructure triển khai các ports. Desktop host ghép các implementation và khởi động hệ thống. AI nhận quyền gọi registry qua interface; không phụ thuộc ngược từ domain sang AI.

Contracts không chứa DB models hoặc vendor SDK types. MCP bridge có thể dùng chung infrastructure IPC submodule, nhưng không khởi tạo repositories hoặc worker supervisor riêng.

## Giữ quy mô vừa đủ

Crate boundaries thể hiện ranh giới ownership; chưa tách thành dịch vụ mạng. Các module check, issue, query có thể nằm trong application/domain trước. Chỉ tách thêm crate khi có nhu cầu tái sử dụng hoặc build boundary rõ ràng.

Không tạo nhiều generic repository/command framework trước khi có hai use case thực. Mẫu đầu tiên là ImportModel và SearchElements; từ đó rút ra abstractions tối thiểu.

## Quy ước công việc

- Tên code/API dùng tiếng Anh; UI tiếng Việt và tiếng Anh đi qua localization keys.
- UUID nội bộ serialize dạng string; IFC GlobalId giữ nguyên dạng gốc.
- Rust public interfaces dùng Result với AppError có code, message và details có kiểu.
- TypeScript strict; generated contracts không sửa tay.
- Python DTO validate qua schema/Pydantic; không truyền object IfcOpenShell qua RPC.
- Lockfile Rust, pnpm và uv được commit sau khi chốt dependencies.
- Dữ liệu dự án thật, IFC độc quyền, secrets, build outputs và cache không commit vào source repo.
- Mỗi thay đổi schema/protocol đi cùng migration, compatibility note và contract fixture.

## Công việc đầu tiên khi scaffold

1. Tạo Rust workspace và React app, sau đó thêm Tauri host.
2. Tạo contracts version 1 và một lệnh health không phụ thuộc IFC.
3. Tạo worker handshake, đóng gói và gọi từ desktop host.
4. Tạo project DB và một use case import nhỏ.
5. Thêm qa-bim-mcp với project.get gọi vào desktop qua named pipe.
6. Hoàn thành một vertical slice trước khi tạo toàn bộ feature folders.
