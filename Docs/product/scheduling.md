# Scheduling (4D/5D) — Product Contract

## 4D Scheduling

### Gantt Chart

- Work Breakdown Structure (WBS) with hierarchical task organization.
- Task attributes: name, start date, end date, duration, progress percentage.
- Dependency visualization between tasks.
- Critical path highlighting.

### BIM Linking

- Each task can link to one or more BIM element IDs.
- Selecting a task in the Gantt highlights linked elements in the BIM viewer.
- Visual simulation: show construction sequence by filtering elements per
  time period (planned).

### Current Prototype

The schedule tab displays a static Gantt chart with mock construction phases.
Tasks are linked to BIM fragment IDs via `selectedHighlightIds` state.

## 5D Cost Management (Planned)

### Quantity Takeoff

- Extract quantities from IFC property sets (area, volume, length, count).
- Map quantities to cost items via classification codes.

### Cost Tracking

- Budget vs actual cost comparison.
- Cost breakdown by discipline, building, and floor.
- Change order impact analysis.

## Data Flow

```text
ScheduleTab
  -> user selects task
  -> setSelectedHighlightIds(bimElementIds)
  -> setActiveTab('viewer')
  -> ViewerTab highlights elements
```
