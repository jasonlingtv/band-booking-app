// templates.js — Built-in template definitions.
// Loaded before data.js so migration can reference DEFAULT_TEMPLATES.
// Each template defines the full TS → TM → TL structure for a project's task detail panels.

// ── Field type reference ──────────────────────────────────────────────────────
// 'auto'              → read-only, computed from task metadata via autoSource
// 'text'              → single-line editable (or readonly) text
// 'textarea'          → multi-line editable text
// 'link'              → URL field (+ add link / remove)
// 'toggle'            → two-option pill toggle; options in toggleOptions[]
// 'time-select'       → dropdown of 15-min time slots, blank first option
// 'time-select-na'    → same but N/A first option
// 'catering-select'   → "After Soundcheck" first option, then times
// 'show-length-select'→ fixed duration list
// 'show-time'         → composite: time select with Lineup textarea toggle
//
// Field flags:
//   autoSource        → 'dateRange' | 'teamName' | 'title'  (for auto fields)
//   readonly          → true = display only, no edit
//   mirrorOf          → tlId of the source field; reads/writes that fieldValues key instead of own id
//   syncOnCommit      → true = re-render panel after commit (for fields with mirrors)
//   hideLabel         → true = render empty label span (preserves 110px alignment column)
//   defaultValue      → fallback shown when fieldValues key is absent
//   toggleOptions     → [{ value, label }, ...]  (for toggle fields)

const BAND_BOOKING_TEMPLATE = {
  id: 'tmpl_band_booking',
  name: 'Band Booking',
  projectSections: [
    { id: 'ps_bk_planning',  name: 'Planning' },
    { id: 'ps_bk_optioned',  name: 'Optioned' },
    { id: 'ps_bk_confirmed', name: 'Confirmed' },
    { id: 'ps_bk_archive',   name: 'Archive' }
  ],
  taskFeatures: {
    reminders: {
      enabled: true,
      items: [
        { id: 'tr_bk_presskit',  name: 'Press Kit' },
        { id: 'tr_bk_techrider', name: 'Tech Rider' },
        { id: 'tr_bk_advance',   name: 'Advance' }
      ]
    },
    taskReminders: { enabled: true }
  },
  taskSections: [

    // ── TS: Overview ─────────────────────────────────────────────────────────
    {
      id: 'ts_bk_overview',
      name: 'Overview',
      defaultOpen: true,
      modules: [
        {
          id: 'tm_bk_overview',
          name: '',         // empty name = flat mode (no TM heading rendered)
          defaultOpen: true,
          fields: [
            { id: 'tl_bk_date',          name: 'DATE',             type: 'auto',     autoSource: 'dateRange', readonly: true },
            { id: 'tl_bk_artist',        name: 'ARTIST',           type: 'auto',     autoSource: 'teamName',  readonly: true },
            { id: 'tl_bk_location',      name: 'LOCATION / EVENT', type: 'auto',     autoSource: 'title',     readonly: true },
            { id: 'tl_bk_capacity',      name: 'CAPACITY',         type: 'text',     syncOnCommit: true },
            { id: 'tl_bk_event_website', name: 'EVENT WEBSITE',    type: 'text',     syncOnCommit: true },
            { id: 'tl_bk_promoter',      name: 'PROMOTER',         type: 'text' },
            { id: 'tl_bk_deal',          name: 'DEAL',             type: 'textarea' },
            { id: 'tl_bk_costing',       name: 'COSTING',          type: 'link' },
            { id: 'tl_bk_contract',      name: 'CONTRACT',         type: 'link' },
            {
              id: 'tl_bk_backline', name: 'BACKLINE', type: 'dropdown',
              defaultValue: '',
              dropdownOptions: [
                { value: '',             label: '—' },
                { value: 'na',           label: 'N/A' },
                { value: 'not-provided', label: 'Not Provided' },
                { value: 'provided',     label: 'Provided' }
              ]
            },
            {
              id: 'tl_bk_accommodation', name: 'ACCOMMODATION', type: 'dropdown',
              defaultValue: '',
              dropdownOptions: [
                { value: '',             label: '—' },
                { value: 'na',           label: 'N/A' },
                { value: 'not-provided', label: 'Not Provided' },
                { value: 'provided',     label: 'Provided' }
              ]
            },
          ]
        }
      ]
    },

    // ── TS: Advance Information ───────────────────────────────────────────────
    {
      id: 'ts_bk_advance',
      name: 'Advance Information',
      defaultOpen: false,
      modules: [

        // TM: Overview (named, has heading)
        {
          id: 'tm_bk_adv_overview',
          name: 'Overview',
          defaultOpen: true,
          fields: [
            { id: 'tl_bk_adv_date',      name: 'DATE',             type: 'auto',    autoSource: 'dateRange', readonly: true },
            { id: 'tl_bk_adv_artist',    name: 'ARTIST',           type: 'auto',    autoSource: 'teamName',  readonly: true },
            { id: 'tl_bk_adv_location',  name: 'EVENT / LOCATION', type: 'auto',    autoSource: 'title',     readonly: true },
            { id: 'tl_bk_address',       name: 'ADDRESS',          type: 'textarea' },
            // Editable mirror of Overview CAPACITY — reads/writes same fieldValues key
            { id: 'tl_bk_adv_capacity',  name: 'CAPACITY',         type: 'text',    mirrorOf: 'tl_bk_capacity',     syncOnCommit: true },
            // Read-only mirror of Overview EVENT WEBSITE
            { id: 'tl_bk_adv_event_website', name: 'EVENT WEBSITE', type: 'text',   mirrorOf: 'tl_bk_event_website', readonly: true },
            { id: 'tl_bk_dos_contact',   name: 'D.O.S. CONTACT',   type: 'textarea' },
            { id: 'tl_bk_sound_lighting',name: 'SOUND & LIGHTING',  type: 'textarea' },
            { id: 'tl_bk_artist_contact',name: 'ARTIST CONTACT',    type: 'textarea' },
            { id: 'tl_bk_travel_party',  name: 'TRAVEL PARTY',      type: 'textarea' },
          ]
        },

        // TM: Travel
        {
          id: 'tm_bk_travel',
          name: 'Travel',
          defaultOpen: false,
          fields: [
            { id: 'tl_bk_travel_notes', name: '', type: 'textarea', hideLabel: true },
            { id: 'tl_bk_travel_link',  name: 'LINK', type: 'link' },
          ]
        },

        // TM: Backline
        {
          id: 'tm_bk_backline_adv',
          name: 'Backline',
          defaultOpen: false,
          fields: [
            { id: 'tl_bk_backline_notes', name: '', type: 'textarea', hideLabel: true },
            { id: 'tl_bk_backline_link',  name: 'LINK', type: 'link' },
          ]
        },

        // TM: Schedule
        {
          id: 'tm_bk_schedule',
          name: 'Schedule',
          defaultOpen: false,
          fields: [
            { id: 'tl_bk_get_in',       name: 'GET IN',       type: 'time-select' },
            { id: 'tl_bk_sound_check',  name: 'SOUND CHECK',  type: 'time-select' },
            { id: 'tl_bk_catering',     name: 'CATERING',     type: 'catering-select',   defaultValue: 'After Soundcheck' },
            { id: 'tl_bk_doors',        name: 'DOORS',        type: 'time-select' },
            { id: 'tl_bk_show_time',    name: 'SHOW TIME',    type: 'show-time' },
            { id: 'tl_bk_show_length',  name: 'SHOW LENGTH',  type: 'show-length-select', defaultValue: '60 min' },
            { id: 'tl_bk_sound_curfew', name: 'SOUND CURFEW', type: 'time-select-na',     defaultValue: 'N/A' },
            { id: 'tl_bk_venue_curfew', name: 'VENUE CURFEW', type: 'time-select-na',     defaultValue: 'N/A' },
          ]
        },

        // TM: Dietary Requirements
        {
          id: 'tm_bk_dietary',
          name: 'Dietary Requirements',
          defaultOpen: false,
          fields: [
            { id: 'tl_bk_dietary', name: '', type: 'textarea', hideLabel: true },
          ]
        },

        // TM: Accommodation
        {
          id: 'tm_bk_accommodation_adv',
          name: 'Accommodation',
          defaultOpen: false,
          fields: [
            { id: 'tl_bk_accommodation_notes', name: '', type: 'textarea', hideLabel: true },
          ]
        },

        // TM: Parking
        {
          id: 'tm_bk_parking',
          name: 'Parking',
          defaultOpen: false,
          fields: [
            { id: 'tl_bk_parking', name: '', type: 'textarea', hideLabel: true },
          ]
        },

      ]
    }
  ]
};

const DEFAULT_TEMPLATES = [BAND_BOOKING_TEMPLATE];
