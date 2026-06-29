# Band Booking App — Structure & Naming Convention

## Full Hierarchy

```
Team
  -> Projects (each has a templateId)
       -> Sections
            -> Tasks
                 -> Comments (free-form, NOT template-driven)
                 -> Task Sections (TS)   ← defined by the project's Template
                      -> Task Modules (TM)
                           -> Task Labels (TL)
```

## Layer Definitions

- **Team** = a band/artist/client (e.g. "Keanan Eksteen")
- **Project** = a category within a team (e.g. "Bookings", "Admin"). Each Project stores a `templateId` that governs its tasks' detail panel structure.
- **Section** = a status/stage grouping within a project (e.g. Planning, Optioned, Confirmed, Archive) — fully drag-reorderable
- **Task** = an individual item/booking/job within a section
- **Comment** = a message in the per-task comment thread. Not template-driven — every task gets a Comments section regardless of template.
- **Task Section (TS)** = a top-level labeled group inside a task's detail panel, **defined by the project's template** (e.g. "Overview", "Advance Information")
- **Task Module (TM)** = a named sub-group within a TS, also defined by the template (e.g. "Schedule", "Travel"). A TM with `name: ''` renders in "flat mode" — fields appear directly under the TS with no TM heading.
- **Task Label (TL)** = an individual field within a TM, defined by the template (e.g. Capacity, Promoter). Has a field type and optional flags.

---

## Template System

### Concept
A Template defines the full TS → TM → TL structure for a Project's tasks. Structure is stored as data, not hardcoded in the UI. All detail panel rendering is dynamic — it loops over the assigned template's structure.

### Template Assignment
- At the **Project** level (`project.templateId`).
- All tasks within a project inherit their project's template structure.
- Different projects within the same team can use different templates.

### Storage
- Templates live in `_data.templates[]` in localStorage.
- Task field values are stored in `task.fieldValues` — a flat `{ [tlId]: value }` map keyed by TL id.
- Core task metadata (id, title, done, startDate, endDate, listNote) stays as named properties on the task object.
- Task reminder states are stored in `task.reminders` — a flat `{ [itemId]: boolean }` map keyed by the reminder item's id from `template.taskFeatures.reminders.items[]`.
- **Orphaned data**: if a TL is removed from a template, its value in `task.fieldValues` is preserved in storage but not rendered. No data is silently lost.
- `task.fieldValues` also stores values for custom fields added per-task (same flat keyed map).

### Per-Task Structure Overrides
Users can extend individual tasks without modifying the template. These additions are stored on the task object and are never reflected in other tasks:

| Property | Contents |
|----------|---------|
| `task.customSections[]` | Fully custom TSs with nested `modules[].fields[]` — same shape as template TSs |
| `task.customModules[]` | Custom TMs attached to a template TS: `{ id, name, defaultOpen, parentTsId, fields[] }` |
| `task.customFields[]` | Custom TLs attached to a template TM: `{ id, name, type, parentTmId, ...typeConfig }` |
| `task.labelOverrides{}` | Renamed labels for template-inherited ids: `{ [tsId\|tmId\|tlId]: 'new name' }` |

Rules:
- Template-inherited TS/TM/TL cannot be deleted from within a task (show warning to use the Template editor).
- All additions (customSections/Modules/Fields) can be deleted from within the task pane — only that task is affected.
- Any TS/TM/TL label (template-inherited or custom) can be renamed from within a task.
- Custom field values are stored in `task.fieldValues[fieldId]` alongside template field values.
- The `date` TL field supports single dates (stored as `{ startDate: ISO, endDate: null }`) and ranges (stored as `{ startDate: ISO, endDate: ISO }`). Legacy single-ISO-string values are read as single dates.

### Field Types
| Type | Renders as |
|------|-----------|
| `auto` | Read-only computed value (from `autoSource`: `'dateRange'`, `'teamName'`, or `'title'`) |
| `text` | Single-line editable (or readonly if `readonly: true`) |
| `textarea` | Multi-line editable text |
| `link` | URL field (+ add link / ✕ remove) |
| `dropdown` | Always-visible `<select>` with configurable options in `dropdownOptions[]` (Provided/Not Provided etc.) |
| `toggle` | Two-option pill toggle buttons; options in `toggleOptions[]` |
| `time-select` | Dropdown of 15-min time slots, blank first option |
| `time-select-na` | Same but N/A first option |
| `catering-select` | "After Soundcheck" first, then times |
| `show-length-select` | Fixed duration list (45/60/75/90 min, 2×45) |
| `show-time` | Composite: time dropdown with "Lineup" textarea toggle. Value stored as `{ time, isLineup, lineup }` object in fieldValues. |

### Field Flags
| Flag | Meaning |
|------|---------|
| `autoSource` | For `auto` type: `'dateRange'` \| `'teamName'` \| `'title'` |
| `readonly` | Display only, no edit mode |
| `mirrorOf: tlId` | Reads/writes `fieldValues[tlId]` instead of own id — ensures two displayed fields share one stored value |
| `syncOnCommit` | Re-renders the panel after commit (needed when this field has mirrors displayed elsewhere) |
| `hideLabel` | Renders an empty label span (preserves 110px alignment column for unlabeled fields) |
| `defaultValue` | Fallback shown when `fieldValues[tlId]` is absent |
| `toggleOptions` | `[{ value, label }, ...]` for toggle fields |

### Task Features (`template.taskFeatures`)
Optional per-template features that appear on every task using that template.

```js
taskFeatures: {
  reminders: {
    enabled: true,        // false = feature off, no checkboxes rendered
    items: [              // ordered list of reminder checkboxes
      { id: 'tr_bk_presskit',  name: 'Press Kit' },
      { id: 'tr_bk_techrider', name: 'Tech Rider' },
      { id: 'tr_bk_advance',   name: 'Advance' }
    ]
  }
}
```

- Rendered by `_renderChecklist()` in `detail.js` near the top of every task panel.
- Each item's checked state stored per-task in `task.reminders[itemId]`.
- Blank tasks (`task.blank = true`) never get reminders (no template = no features).
- New templates default to `reminders: { enabled: false, items: [] }`.
- Configured in the Template editor under **Task Features** (between Project Sections and Task Sections).

### Mirror Fields (in Band Booking template)
- **CAPACITY**: Overview TS and Advance TM "Overview" both write to `fieldValues['tl_bk_capacity']`. The Advance version has `mirrorOf: 'tl_bk_capacity'`.
- **EVENT WEBSITE**: Overview TS is editable, Advance TM "Overview" is read-only; both display `fieldValues['tl_bk_event_website']`. Advance has `mirrorOf: 'tl_bk_event_website'` + `readonly: true`.

---

## Built-in Template: "Band Booking"

Template id: `tmpl_band_booking`

### TS: Overview (`ts_bk_overview`) — flat (single unnamed TM)
| TL id | Label | Type |
|-------|-------|------|
| `tl_bk_date` | DATE | auto (dateRange) |
| `tl_bk_artist` | ARTIST | auto (teamName) |
| `tl_bk_location` | LOCATION / EVENT | auto (title) |
| `tl_bk_capacity` | CAPACITY | text, syncOnCommit |
| `tl_bk_event_website` | EVENT WEBSITE | text, syncOnCommit |
| `tl_bk_promoter` | PROMOTER | text |
| `tl_bk_deal` | DEAL | textarea |
| `tl_bk_costing` | COSTING | link |
| `tl_bk_contract` | CONTRACT | link |
| `tl_bk_backline` | BACKLINE | dropdown (Provided / Not Provided), default: not-provided |
| `tl_bk_accommodation` | ACCOMMODATION | dropdown (Provided / Not Provided), default: not-provided |

### TS: Advance Information (`ts_bk_advance`)

#### TM: Overview (`tm_bk_adv_overview`) — defaultOpen: true
| TL id | Label | Type | Notes |
|-------|-------|------|-------|
| `tl_bk_adv_date` | DATE | auto (dateRange) | |
| `tl_bk_adv_artist` | ARTIST | auto (teamName) | |
| `tl_bk_adv_location` | EVENT / LOCATION | auto (title) | |
| `tl_bk_address` | ADDRESS | textarea | |
| `tl_bk_adv_capacity` | CAPACITY | text | mirrorOf: tl_bk_capacity |
| `tl_bk_adv_event_website` | EVENT WEBSITE | text, readonly | mirrorOf: tl_bk_event_website |
| `tl_bk_dos_contact` | D.O.S. CONTACT | textarea | |
| `tl_bk_sound_lighting` | SOUND & LIGHTING | textarea | |
| `tl_bk_artist_contact` | ARTIST CONTACT | textarea | |
| `tl_bk_travel_party` | TRAVEL PARTY | textarea | |

#### TM: Travel (`tm_bk_travel`) — defaultOpen: false
| TL id | Label | Type |
|-------|-------|------|
| `tl_bk_travel_notes` | (none) | textarea, hideLabel |
| `tl_bk_travel_link` | LINK | link |

#### TM: Backline (`tm_bk_backline_adv`) — defaultOpen: false
| TL id | Label | Type |
|-------|-------|------|
| `tl_bk_backline_notes` | (none) | textarea, hideLabel |
| `tl_bk_backline_link` | LINK | link |

#### TM: Schedule (`tm_bk_schedule`) — defaultOpen: false
| TL id | Label | Type | Default |
|-------|-------|------|---------|
| `tl_bk_get_in` | GET IN | time-select | — |
| `tl_bk_sound_check` | SOUND CHECK | time-select | — |
| `tl_bk_catering` | CATERING | catering-select | After Soundcheck |
| `tl_bk_doors` | DOORS | time-select | — |
| `tl_bk_show_time` | SHOW TIME | show-time | — |
| `tl_bk_show_length` | SHOW LENGTH | show-length-select | 60 min |
| `tl_bk_sound_curfew` | SOUND CURFEW | time-select-na | N/A |
| `tl_bk_venue_curfew` | VENUE CURFEW | time-select-na | N/A |

#### TM: Dietary Requirements (`tm_bk_dietary`) — defaultOpen: false
| TL id | Label | Type |
|-------|-------|------|
| `tl_bk_dietary` | (none) | textarea, hideLabel |

#### TM: Accommodation (`tm_bk_accommodation_adv`) — defaultOpen: false
| TL id | Label | Type |
|-------|-------|------|
| `tl_bk_accommodation_notes` | (none) | textarea, hideLabel |

#### TM: Parking (`tm_bk_parking`) — defaultOpen: false
| TL id | Label | Type |
|-------|-------|------|
| `tl_bk_parking` | (none) | textarea, hideLabel |

---

## Drag-and-Drop
- **Teams**: reorderable in sidebar
- **Projects**: reorderable within their team (no cross-team)
- **Sections**: reorderable within their project (grip handle on section header)
- **Tasks**: reorderable within and between sections (cross-section drag updates section membership)

---

## Conventions

- Add a new TL to a template → edit `templates.js`, add to the appropriate TM's `fields[]`.
- Add a new TM to an existing TS → add a new module object to the TS's `modules[]` in `templates.js`.
- Add a new TS → add a new entry to `template.taskSections[]`.
- The detail panel renderer (`detail.js`) is fully dynamic — it loops over the template structure. No hardcoded field names in the renderer.
- Task field values are always accessed via `task.fieldValues[tlId]` (never named properties like `task.capacity`).
- Data layer writes go through `DataLayer.updateTaskField(taskId, tlId, value)` for TL fields, or `DataLayer.updateTask(taskId, changes)` for core metadata (title, done, startDate, endDate, etc.).
- Always bump the `?v=N` cache-busting version in `index.html` when changing JS or CSS files.
- Always update this file when structure changes.

---

## Comments

Comments live inside the task detail panel under a collapsible "Comments" section at the bottom. They are **not** part of the Template system — every task gets this section regardless of template.

- Stored as `task.comments[]`, each item: `{ id, sender, text, timestamp, attachments[] }`
  - `sender`: string — the sender's display name (not a boolean). `CURRENT_USER` senders appear on the right; others on the left.
  - `text`: plain text (URLs auto-linked on render)
  - `timestamp`: ISO 8601 datetime string
  - `attachments[]`: `{ id, name, type ('image'|'file'), dataUrl }` — base64 data URLs for now
- Written via `DataLayer.updateTask(taskId, { comments: [...] })`
- Collapse state keyed as `'comments_' + task.id` in `_sectionOpen`
- Default collapsed when task first opened
- **Phase 2**: replace `dataUrl` attachment storage with real file storage (e.g. Supabase Storage); replace `CURRENT_USER` constant with real account lookup

### CURRENT_USER constant
Located at the top of `detail.js`, clearly commented. Change this string to test left/right bubble assignment.  
Phase 2 swap point: replace `const CURRENT_USER = 'Jason'` with a lookup from the auth system.

### Comments UI
- WhatsApp-style bubble layout: current user on right (blue bubble), others on left (grey bubble)
- Each bubble shows: sender name, message text (URLs auto-linked), timestamp, and any attachments
- Images display inline; non-image files display as a download link
- Input: text area (Enter = send, Shift+Enter = newline) + 📎 attachment button + Send button
- Auto-expanding textarea (grows with content, max ~120px)

---

## Template Management Dashboard

Accessed via the ⚙ gear icon in the bottom-left of the sidebar.

- Clicking the gear shows a "Settings" screen in the main content area (replaces project view)
- Clicking any team or project in the sidebar exits the dashboard and returns to the project view
- The gear icon gets an `.active` class when the dashboard is shown

### Dashboard: Template list
- Lists all templates from `DataLayer.getTemplates()` with section count
- Edit button → opens inline editor for that template
- Delete button → always shows a clear confirmation dialog; if template is used by one or more projects, names them in the warning

### Dashboard: Template editor
- Creates or edits a template with full TS → TM → TL hierarchy
- Template name input
- TS cards: name, ↑↓ reorder, × remove, + Add Module
- TM cards (indented): name (blank = flat), ↑↓ reorder, × remove, + Add Field
- TL rows (indented): name input, type selector dropdown, ↑↓ reorder, × remove
  - For `toggle` type: expandable options editor (value + label pairs)
  - For `auto` type: autoSource selector (dateRange / teamName / title)
- Save → `DataLayer.addTemplate` (new) or `DataLayer.updateTemplate` (edit)

### New Project template picker
- When adding a project (+ button or team menu), a context menu always appears with all templates + a "Blank Project" option
- Choosing a template → project gets that template's `projectSections` as starting sections + `templateId` set
- Choosing "Blank Project" → `templateId: null`, zero starting sections; users build structure from scratch
- Migration guards preserve `null` explicitly (vs `undefined` = genuinely missing → gets default template)

---

## Task Creation: Template vs Blank Choice

When "New Task" or "New task after" is selected from any menu (`•••` on a section or a task):

- **Project HAS a template** (`templateId` is a string): a small modal appears with two choices:
  - **[Template Name]** → "With template fields" — creates a normal task; detail panel shows full TS/TM/TL structure
  - **Blank task** → "Title, notes, and comments only" — creates task with `blank: true`; detail panel shows notes textarea + comments, no template sections
- **Project has NO template** (`templateId === null`, i.e. a Blank Project): no modal — a blank task is created directly

### Blank task detail panel
A task with `blank: true` shows:
- Title, dates, section selector (standard top fields)
- A **Notes** textarea (`task.listNote`)
- **Comments** collapsible section (same as template tasks)
- No TS/TM/TL template sections

### Implementation
- `UIHelpers.openTaskTypeModal(templateName, onTemplate, onBlank)` — renders the choice overlay
- `task.blank: true` flag set on blank tasks (absent/false on template tasks)
- `detail.js`: checks `task.blank` before deciding to call `_renderTemplateSections` or `_renderBlankNotes`
- `getProjectTemplate(projectId)` returns `null` for `templateId === null` (no fallback to first template)

---

## News Feeds (Dashboard tab)

The **News** tab in the Dashboard is a curated RSS feed aggregator.

### Architecture
- **Feed library**: `feeds.js` — hardcoded `FEED_LIBRARY` array. `// MEGA_MASTER_ONLY` — editable via Dashboard UI in a future update. No user-facing edit flow yet.
- **RSS fetching**: `rssService.js` — `RssService.fetch(url)` resolves via two-stage CORS proxy:
  1. Primary: `https://api.rss2json.com/v1/api.json?rss_url=ENCODED_URL` (JSON, no XML parsing needed)
  2. Fallback: `https://corsproxy.io/?ENCODED_URL` + `DOMParser` XML parse
  - Results are cached in-memory for 5 minutes. `RssService.invalidateAll()` clears the cache.
- **UI**: `newsView.js` — `NewsView.render(el)` and `NewsView.cleanup()` (called from `Dashboard.clearTimers()`).

### Views
- **Discover** (default when no subscriptions): all feeds grouped by category with search filter and Follow/Unfollow per card.
- **My Feeds** (once ≥1 subscription): fetches all subscribed feeds in parallel, shows combined headline list. Toggle between Chronological and By Source views. Graceful per-feed error state.

### Subscriptions
- Stored in localStorage under `band_booking_news_subs` as a JSON array of feed IDs.
- Phase 2: move to user profile when accounts are added.

### Hover preview
- Hovering a headline (350ms delay) shows a fixed-position popover with the article excerpt. Implemented independently of `DetailPanel` (which is task/template-specific).

---

## File Organization

| File | Responsibility |
|------|---------------|
| `utils.js` | Date helpers, EventBus, generateId |
| `templates.js` | Template definitions (BAND_BOOKING_TEMPLATE, DEFAULT_TEMPLATES) |
| `data.js` | Data layer: localStorage read/write, CRUD for all entities, migration |
| `ui-helpers.js` | Menu, modal, saved indicator |
| `calendar.js` | Date picker widget |
| `sidebar.js` | Teams + projects sidebar, drag-and-drop |
| `listview.js` | Section/task list view, drag-and-drop |
| `boardview.js` | Board (Kanban) view |
| `detail.js` | Task detail panel — template-driven renderer + comments section. Houses `CURRENT_USER` constant. |
| `feeds.js` | Master RSS feed library (MEGA_MASTER_ONLY hardcoded data) |
| `rssService.js` | RSS fetch/cache utility — CORS proxy + fallback XML parse |
| `newsView.js` | News tab UI — Discover view, My Feeds view, headline list, hover popover |
| `dashboard.js` | Settings screen — template list, create/edit/delete templates, tabs: Templates / To Do / News |
| `app.js` | App init, event wiring, dashboard show/hide |
