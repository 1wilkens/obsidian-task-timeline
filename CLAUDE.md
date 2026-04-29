# Task Timeline

A DataviewJS-based task view for Obsidian, inspired by the Taskido plugin. Embedded in a note via:

```dataviewjs
await dv.view("_tasks/view/view")
```

## Files

- `view/view.js` — DataviewJS script; collects, filters, and renders tasks
- `view/view.css` — styles for the view

## Goals

Provide a focused, visually clean daily task overview that surfaces only meaningful tasks — those with scheduling metadata, living in a designated inbox file, or in daily notes. Plain checklist items with no metadata are intentionally excluded.

Tasks are grouped into three buckets (To Do, Overdue, Unplanned) and sorted by effective date. A quick-add bar appends new tasks to today's daily note.

## Configuration

Passed via `input` when embedding the view:

| Key | Default | Description |
|-----|---------|-------------|
| `pages` | `""` (whole vault) | Dataview pages scope — folder/tag string or `dv.pages(...)` expression |
| `folder` | auto-detected | Daily notes folder |
| `format` | `YYYY-MM-DD` | Daily notes filename format |
| `inbox` | `""` | Path to inbox file whose tasks are always shown |
| `taskSection` | `"Tasks"` | Heading used when creating tasks in a new daily note |
| `color` | `"on"` | Coloring mode: `"on"` (full), `"warning"` (overdue only), `"off"` (none) |
| `show_completed` | `false` | When `true`, show tasks completed today rendered as done in today's section |

## Design

- Icons are inline Lucide SVGs (`stroke="currentColor"`) — no imports required
- All emoji in regex patterns use the `u` flag to handle surrogate pairs correctly
- Overdue tasks highlight the due-date badge and exclamation mark in `--text-error`
