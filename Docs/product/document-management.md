# Document Management — Product Contract

## Standard

ISO 19650-1:2018, ISO 19650-2:2018.

## Document Naming Convention

Format: `[Project]-[Originator]-[Volume]-[Level]-[Type]-[Discipline]-[Number]`

| Field | Description | Example |
| --- | --- | --- |
| Project | Project code | PRJ |
| Originator | Team/company code | ARC, STR, MEP |
| Volume | Zone/building | Z01, Z02, Z00 |
| Level | Floor/storey | ZZ (all), 01, B1 |
| Type | Document type | M3 (model), DR (drawing) |
| Discipline | Engineering discipline | A (arch), S (struct), M (mep) |
| Number | Sequential number | 0001 |

## Status Workflow

```text
S0 (WIP) -> S1 (SHARED) -> S2 (PUBLISHED) -> S3 (ARCHIVED)
```

| Status | Visibility | Editable | Use |
| --- | --- | --- | --- |
| S0 - WIP | Originator team only | Yes | Active development |
| S1 - SHARED | All project participants | Limited | Coordination review |
| S2 - PUBLISHED | All + external stakeholders | No (new revision required) | Construction use |
| S3 - ARCHIVED | All (read-only) | No | Historical record |

## Revision Scheme

- **Preliminary revisions**: P01, P02, P03... (pre-publication).
- **Construction revisions**: C01, C02, C03... (post-publication).
- **Version**: V1, V2, V3... (internal version within a revision).

## Classification

Using Uniclass 2015 codes where applicable:

| Code | Description |
| --- | --- |
| EF_20_10 | Structural frame elements |
| EF_55_20 | Coordinated models |
| EF_60_40 | Plumbing systems |

## Folder Structure

```text
00_TEMPLATES/     Templates and standards
01_WIP/           Work in progress
02_SHARED/        Shared for coordination
03_PUBLISHED/     Approved for construction
04_ARCHIVED/      Historical records
```

## File Types Supported

| Extension | Type | Viewer |
| --- | --- | --- |
| .ifc | BIM model | ThatOpen BIM Viewer |
| .pdf | Document | Browser native |
| .dwg | CAD drawing | External viewer (planned) |
| .xlsx | Spreadsheet | External viewer (planned) |
| .docx | Word document | External viewer (planned) |
