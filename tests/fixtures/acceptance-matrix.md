# G0 Fixture acceptance matrix

Current fixtures are generated project data, not customer drawings or production models.

| Fixture | Expected result | Status |
| --- | --- | --- |
| riverside-demo.ifc | IFC4, metre, 399 represented products, seven storeys, unique GlobalIds | Automated worker tests pass |
| import-smoke.ifc | IFC4, two represented products, no spatial container; display Unassigned | HTTP import and SQLite persistence verified |
| Vietnamese display filename | Worker JSON-RPC remains valid UTF-8 on Windows | Regression test added |
| Invalid file extension | Reject without interpreting as IFC | Automated worker test passes |
| Overlap / separated / touching columns | 1 / 0 / 0 measured intersections | Parameterized geometry tests pass |
| Riverside ducts versus beams | 42 intersections overall, 6 on L05 | Worker, UI and MCP verified |
| Nested placements and opening | Correct geometry, mapping and coordinates | Pending |
| Millimetres and large coordinates | Consistent conversion and render origin | Pending |
| IFC2x3 and production federation | Actual project samples required | Pending |

The six finding rows in the UI are UX examples, not calculated clashes. The four discipline model entries in the demo are groups split from one generated IFC for presentation. They do not yet demonstrate federation of four independent IFC exports.
