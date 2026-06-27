// data.js — Data layer. ALL localStorage access is here. UI modules never touch localStorage directly.
// To swap in a real backend later: rewrite this file only.
// Requires: utils.js, templates.js (loaded before this file)
const DataLayer = (() => {
  'use strict';

  const STORAGE_KEY = 'band_booking_v1';

  // ── Default constructors ──────────────────────────────────────────────────

  function _makeTask(overrides) {
    return Object.assign({
      id: Utils.generateId(),
      title: '',
      done: false,
      startDate: null,
      endDate: null,
      // List-view note column (not template-driven)
      listNote: '',
      // Template-driven reminder checkbox states keyed by item id
      reminders: {},
      // All TS/TM/TL field values keyed by TL id (template or custom fields share this store)
      fieldValues: {},
      // Per-task comments (not template-driven — every task gets this)
      comments: [],
      // Per-task structure additions (never affect the template)
      customSections: [],   // fully custom TSs with nested modules/fields
      customModules: [],    // custom TMs attached to template TSs: { id, name, defaultOpen, parentTsId, fields[] }
      customFields: [],     // custom TLs attached to template TMs: { id, name, type, parentTmId, ...cfg }
      labelOverrides: {},   // renamed labels for template-inherited ids: { [id]: 'new name' }
      tmOrders: {},         // { [tsId]: [tmId, ...] } — task-level TM order overrides (never touch template)
      tsOrders: [],         // [tsId, ...] — task-level TS order overrides (template + custom sections)
      tlOrders: {}          // { [tmId]: [tlId, ...] } — task-level TL order overrides per module
    }, overrides || {});
  }

  function _makeSection(name, color) {
    return { id: Utils.generateId(), name, color, collapsed: false, tasks: [] };
  }

  function _makeProject(name, sectionsSpec, templateId) {
    const tid = templateId !== undefined ? templateId
      : (_data && _data.templates && _data.templates.length > 0
          ? _data.templates[0].id
          : 'tmpl_band_booking');
    const project = { id: Utils.generateId(), name, sections: [], templateId: tid };
    if (sectionsSpec === true) {
      project.sections = [
        _makeSection('Planning', 'amber'),
        _makeSection('Optioned', 'blue'),
        _makeSection('Confirmed', 'green')
      ];
    } else if (Array.isArray(sectionsSpec)) {
      project.sections = sectionsSpec.map(ps => _makeSection(ps.name, 'amber'));
    }
    // else false/null/undefined → no sections
    return project;
  }

  function _makeTeam(name) {
    return {
      id: Utils.generateId(),
      name,
      collapsed: false,
      projects: [_makeProject('Bookings', true), _makeProject('Admin', true)]
    };
  }

  function _defaultData() {
    return { teams: [], activeProjectId: null, activeTaskId: null, activeView: 'list', templates: [], hiddenDefaultTemplates: [], defaultTemplatesVisible: true };
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  let _data = null;

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      _data = raw ? JSON.parse(raw) : _defaultData();
    } catch (e) {
      console.error('[DataLayer] Load failed:', e);
      _data = _defaultData();
    }
    // Always enforce name-first column order
    if (_data.listColumnOrder) {
      const rest = _data.listColumnOrder.filter(k => k !== 'name');
      _data.listColumnOrder = ['name', ...rest];
    }
    _migrateData();
    return _data;
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
    } catch (e) {
      console.error('[DataLayer] Save failed:', e);
    }
  }

  // ── Migration ─────────────────────────────────────────────────────────────
  // Converts tasks from the old named-field format to fieldValues keyed by TL id.
  // Also seeds default templates and sets project templateIds.
  // Safe to run multiple times — idempotent per entity.

  function _migrateData() {
    let dirty = false;

    // 1. Seed default templates if none exist
    if (!_data.templates || !_data.templates.length) {
      _data.templates = DEFAULT_TEMPLATES.map(t => JSON.parse(JSON.stringify(t)));
      dirty = true;
    }

    const defaultTemplateId = _data.templates[0].id;

    // 2. Ensure all projects have a templateId (but preserve explicit null = blank project)
    for (const team of _data.teams) {
      for (const project of team.projects) {
        if (project.templateId === undefined) {
          project.templateId = defaultTemplateId;
          dirty = true;
        }
      }
    }

    // 3. Migrate tasks: move old named fields into fieldValues
    // Maps old task property names → Band Booking TL ids
    const LEGACY_MAP = {
      capacity:            'tl_bk_capacity',
      eventWebsite:        'tl_bk_event_website',
      promoter:            'tl_bk_promoter',
      deal:                'tl_bk_deal',
      costingLink:         'tl_bk_costing',
      contractLink:        'tl_bk_contract',
      backlineStatus:      'tl_bk_backline',
      accommodationStatus: 'tl_bk_accommodation',
      address:             'tl_bk_address',
      dosContact:          'tl_bk_dos_contact',
      soundLighting:       'tl_bk_sound_lighting',
      artistContact:       'tl_bk_artist_contact',
      travelParty:         'tl_bk_travel_party',
      travelNotes:         'tl_bk_travel_notes',
      travelLink:          'tl_bk_travel_link',
      backlineAdvNotes:    'tl_bk_backline_notes',
      backlineAdvLink:     'tl_bk_backline_link',
      getIn:               'tl_bk_get_in',
      soundCheck:          'tl_bk_sound_check',
      catering:            'tl_bk_catering',
      doors:               'tl_bk_doors',
      showLength:          'tl_bk_show_length',
      soundCurfew:         'tl_bk_sound_curfew',
      venueCurfew:         'tl_bk_venue_curfew',
      dietary:             'tl_bk_dietary',
      accommodationNotes:  'tl_bk_accommodation_notes',
      parking:             'tl_bk_parking',
    };

    for (const team of _data.teams) {
      for (const project of team.projects) {
        for (const section of project.sections) {
          for (const task of section.tasks) {
            // Ensure fieldValues exists
            if (!task.fieldValues) { task.fieldValues = {}; dirty = true; }
            // Ensure comments exists (migrated from subTasks)
            if (!task.comments) { task.comments = []; dirty = true; }
            if (task.subTasks !== undefined) { delete task.subTasks; dirty = true; }
            if (!task.tmOrders) { task.tmOrders = {}; dirty = true; }

            // Move scalar legacy fields
            for (const [oldKey, tlId] of Object.entries(LEGACY_MAP)) {
              if (Object.prototype.hasOwnProperty.call(task, oldKey)) {
                const v = task[oldKey];
                // Preserve non-empty/non-null values; still delete the key either way
                if (v !== null && v !== undefined && v !== '') {
                  task.fieldValues[tlId] = v;
                }
                delete task[oldKey];
                dirty = true;
              }
            }

            // Special: show-time composite (was three separate fields)
            const hasShowFields = ['showTime', 'showTimeIsLineup', 'showTimeLineup'].some(
              k => Object.prototype.hasOwnProperty.call(task, k)
            );
            if (hasShowFields) {
              task.fieldValues['tl_bk_show_time'] = {
                time:     task.showTime      || '',
                isLineup: !!task.showTimeIsLineup,
                lineup:   task.showTimeLineup || ''
              };
              delete task.showTime;
              delete task.showTimeIsLineup;
              delete task.showTimeLineup;
              dirty = true;
            }
          }
        }
      }
    }

    // 4. Migrate Band Booking backline/accommodation from toggle → dropdown
    const TOGGLE_TO_DROPDOWN = new Set(['tl_bk_backline', 'tl_bk_accommodation']);
    for (const tmpl of _data.templates) {
      if (tmpl.id !== 'tmpl_band_booking') continue;
      for (const ts of (tmpl.taskSections || [])) {
        for (const tm of (ts.modules || [])) {
          for (const field of (tm.fields || [])) {
            if (TOGGLE_TO_DROPDOWN.has(field.id) && field.type === 'toggle') {
              field.type = 'dropdown';
              field.dropdownOptions = field.toggleOptions || [
                { value: 'not-provided', label: 'Not Provided' },
                { value: 'provided', label: 'Provided' }
              ];
              delete field.toggleOptions;
              dirty = true;
            }
          }
        }
      }
    }

    // 5. Fix Band Booking backline/accommodation dropdown order: not-provided must come first
    for (const tmpl of _data.templates) {
      if (tmpl.id !== 'tmpl_band_booking') continue;
      for (const ts of (tmpl.taskSections || [])) {
        for (const tm of (ts.modules || [])) {
          for (const field of (tm.fields || [])) {
            if (TOGGLE_TO_DROPDOWN.has(field.id) && field.type === 'dropdown' &&
                field.dropdownOptions && field.dropdownOptions.length >= 2 &&
                field.dropdownOptions[0].value === 'provided') {
              field.dropdownOptions.reverse();
              dirty = true;
            }
          }
        }
      }
    }

    // 6. Add taskFeatures.reminders to Band Booking template if missing
    for (const tmpl of _data.templates) {
      if (tmpl.id !== 'tmpl_band_booking') continue;
      if (!tmpl.taskFeatures || !tmpl.taskFeatures.reminders) {
        tmpl.taskFeatures = {
          reminders: {
            enabled: true,
            items: [
              { id: 'tr_bk_presskit',  name: 'Press Kit' },
              { id: 'tr_bk_techrider', name: 'Tech Rider' },
              { id: 'tr_bk_advance',   name: 'Advance' }
            ]
          }
        };
        dirty = true;
      }
    }

    // 7. Migrate task.pressKit/techRider/advanceCheck → task.reminders[id]
    for (const team of _data.teams) {
      for (const project of team.projects) {
        for (const section of project.sections) {
          for (const task of section.tasks) {
            if (!task.reminders) { task.reminders = {}; dirty = true; }
            const legacyMap = [
              ['pressKit',    'tr_bk_presskit'],
              ['techRider',   'tr_bk_techrider'],
              ['advanceCheck','tr_bk_advance']
            ];
            for (const [oldKey, newId] of legacyMap) {
              if (Object.prototype.hasOwnProperty.call(task, oldKey)) {
                if (task[oldKey]) task.reminders[newId] = true;
                delete task[oldKey];
                dirty = true;
              }
            }
          }
        }
      }
    }

    // 9. Update Band Booking backline/accommodation to 4-option dropdown (—, N/A, Not Provided, Provided)
    const FOUR_OPTS = [
      { value: '',             label: '—' },
      { value: 'na',           label: 'N/A' },
      { value: 'not-provided', label: 'Not Provided' },
      { value: 'provided',     label: 'Provided' }
    ];
    for (const tmpl of _data.templates) {
      if (tmpl.id !== 'tmpl_band_booking') continue;
      for (const ts of (tmpl.taskSections || [])) {
        for (const tm of (ts.modules || [])) {
          for (const field of (tm.fields || [])) {
            if (TOGGLE_TO_DROPDOWN.has(field.id) && field.type === 'dropdown') {
              if (!(field.dropdownOptions || []).some(o => o.value === 'na')) {
                field.dropdownOptions = FOUR_OPTS;
                field.defaultValue = '';
                dirty = true;
              }
            }
          }
        }
      }
    }

    // 8. Ensure per-task structure fields exist on all tasks
    for (const team of _data.teams) {
      for (const project of team.projects) {
        for (const section of project.sections) {
          for (const task of section.tasks) {
            if (!task.customSections)  { task.customSections  = []; dirty = true; }
            if (!task.customModules)   { task.customModules   = []; dirty = true; }
            if (!task.customFields)    { task.customFields    = []; dirty = true; }
            if (!task.labelOverrides)  { task.labelOverrides  = {}; dirty = true; }
            if (!task.tsOrders)        { task.tsOrders        = []; dirty = true; }
            if (!task.tlOrders)        { task.tlOrders        = {}; dirty = true; }
          }
        }
      }
    }

    // 10. Ensure hiddenDefaultTemplates exists
    if (!_data.hiddenDefaultTemplates) { _data.hiddenDefaultTemplates = []; dirty = true; }
    // 11. Ensure defaultTemplatesVisible exists
    if (_data.defaultTemplatesVisible === undefined) { _data.defaultTemplatesVisible = true; dirty = true; }

    if (dirty) saveData();
  }

  // ── Internal lookups ──────────────────────────────────────────────────────

  function _findTeam(id) {
    return _data.teams.find(t => t.id === id) || null;
  }

  function _findProject(id) {
    for (const team of _data.teams) {
      const p = team.projects.find(p => p.id === id);
      if (p) return { project: p, team };
    }
    return null;
  }

  function _findSection(id) {
    for (const team of _data.teams) {
      for (const project of team.projects) {
        const s = project.sections.find(s => s.id === id);
        if (s) return { section: s, project, team };
      }
    }
    return null;
  }

  function _findTask(id) {
    for (const team of _data.teams) {
      for (const project of team.projects) {
        for (const section of project.sections) {
          const t = section.tasks.find(t => t.id === id);
          if (t) return { task: t, section, project, team };
        }
      }
    }
    return null;
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  function getTemplates() { return _data.templates || []; }

  function getTemplate(id) {
    return (_data.templates || []).find(t => t.id === id) || null;
  }

  function getProjectTemplate(projectId) {
    const found = _findProject(projectId);
    if (!found) return null;
    if (found.project.templateId === null) return null; // explicitly blank project
    return getTemplate(found.project.templateId) || getTemplates()[0] || null;
  }

  function addTemplate(tmpl) {
    if (!_data.templates) _data.templates = [];
    _data.templates.push(tmpl);
    saveData();
    return tmpl;
  }

  function updateTemplate(id, changes) {
    const t = getTemplate(id);
    if (t) { Object.assign(t, changes); saveData(); }
    return t;
  }

  function deleteTemplate(id) {
    if (!_data.templates) return;
    _data.templates = _data.templates.filter(t => t.id !== id);
    saveData();
  }

  function isDefaultTemplate(id) {
    if (DEFAULT_TEMPLATES.some(t => t.id === id)) return true;
    const tmpl = getTemplate(id);
    return tmpl ? !!tmpl.isDefault : false;
  }

  function getDefaultTemplatesVisible() {
    return _data.defaultTemplatesVisible !== false;
  }

  function setDefaultTemplatesVisible(val) {
    _data.defaultTemplatesVisible = !!val;
    saveData();
  }

  function getHiddenDefaultTemplates() {
    return _data.hiddenDefaultTemplates || [];
  }

  function hideDefaultTemplate(id) {
    if (!_data.hiddenDefaultTemplates) _data.hiddenDefaultTemplates = [];
    if (!_data.hiddenDefaultTemplates.includes(id)) {
      _data.hiddenDefaultTemplates.push(id);
      saveData();
    }
  }

  function restoreDefaultTemplate(id) {
    if (!_data.hiddenDefaultTemplates) return;
    _data.hiddenDefaultTemplates = _data.hiddenDefaultTemplates.filter(i => i !== id);
    saveData();
  }

  function customiseDefaultTemplate(id) {
    const tmpl = getTemplate(id);
    if (!tmpl) return null;
    const copy = JSON.parse(JSON.stringify(tmpl));
    copy.id = Utils.generateId();
    copy.name = tmpl.name + ' (custom)';
    if (!_data.templates) _data.templates = [];
    _data.templates.push(copy);
    saveData();
    return copy;
  }

  function duplicateTemplate(id) {
    const tmpl = getTemplate(id);
    if (!tmpl) return null;
    const copy = JSON.parse(JSON.stringify(tmpl));
    copy.id = Utils.generateId();
    copy.name = tmpl.name + ' (copy)';
    if (!_data.templates) _data.templates = [];
    _data.templates.push(copy);
    saveData();
    return copy;
  }

  // ── Teams ─────────────────────────────────────────────────────────────────

  function getTeams() { return _data.teams; }

  function getTeam(id) { return _findTeam(id); }

  function addTeam(name) {
    const team = _makeTeam(name);
    _data.teams.push(team);
    saveData();
    return team;
  }

  function updateTeam(id, changes) {
    const team = _findTeam(id);
    if (team) { Object.assign(team, changes); saveData(); }
    return team;
  }

  function deleteTeam(id) {
    const idx = _data.teams.findIndex(t => t.id === id);
    if (idx < 0) return;
    const team = _data.teams[idx];
    if (team.projects.some(p => p.id === _data.activeProjectId)) {
      _data.activeProjectId = null;
      _data.activeTaskId = null;
    }
    _data.teams.splice(idx, 1);
    saveData();
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  function getProject(id) {
    const found = _findProject(id);
    return found ? found.project : null;
  }

  function getProjectTeam(projectId) {
    const found = _findProject(projectId);
    return found ? found.team : null;
  }

  function addProject(teamId, name, templateId) {
    const team = _findTeam(teamId);
    if (!team) return null;

    if (templateId === null) {
      const project = _makeProject(name, false, null);
      const defaultSection = _makeSection('Tasks', 'amber');
      defaultSection.tasks.push(_makeTask({ blank: true }));
      project.sections.push(defaultSection);
      team.projects.push(project);
      saveData();
      return project;
    }

    const tid = templateId || (_data.templates && _data.templates.length > 0
      ? _data.templates[0].id : 'tmpl_band_booking');
    const template = getTemplate(tid);
    const sectionsSpec = (template && template.projectSections && template.projectSections.length)
      ? template.projectSections
      : true; // fallback: hardcoded Planning/Optioned/Confirmed
    const project = _makeProject(name, sectionsSpec, tid);
    team.projects.push(project);
    saveData();
    return project;
  }

  function updateProject(id, changes) {
    const found = _findProject(id);
    if (found) { Object.assign(found.project, changes); saveData(); }
    return found ? found.project : null;
  }

  function deleteProject(id) {
    const found = _findProject(id);
    if (!found) return;
    if (_data.activeProjectId === id) {
      _data.activeProjectId = null;
      _data.activeTaskId = null;
    }
    const projects = found.team.projects;
    projects.splice(projects.findIndex(p => p.id === id), 1);
    saveData();
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  function getSections(projectId) {
    const project = getProject(projectId);
    return project ? project.sections : [];
  }

  function getSection(id) {
    const found = _findSection(id);
    return found ? found.section : null;
  }

  function getSectionProject(sectionId) {
    const found = _findSection(sectionId);
    return found ? found.project : null;
  }

  function addSection(projectId, name, color) {
    const project = getProject(projectId);
    if (!project) return null;
    const section = _makeSection(name, color || 'amber');
    project.sections.push(section);
    saveData();
    return section;
  }

  function updateSection(id, changes) {
    const found = _findSection(id);
    if (found) { Object.assign(found.section, changes); saveData(); }
    return found ? found.section : null;
  }

  function deleteSection(id) {
    const found = _findSection(id);
    if (!found) return;
    if (found.section.tasks.some(t => t.id === _data.activeTaskId)) {
      _data.activeTaskId = null;
    }
    const sections = found.project.sections;
    sections.splice(sections.findIndex(s => s.id === id), 1);
    saveData();
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  function getTask(id) {
    const found = _findTask(id);
    return found ? found.task : null;
  }

  function getTaskSection(taskId) {
    const found = _findTask(taskId);
    return found ? found.section : null;
  }

  function getTaskTeam(taskId) {
    const found = _findTask(taskId);
    return found ? found.team : null;
  }

  function addTask(sectionId, overrides) {
    const section = getSection(sectionId);
    if (!section) return null;
    const task = _makeTask(overrides);
    section.tasks.push(task);
    saveData();
    return task;
  }

  function addTaskAfter(afterTaskId, sectionId, overrides) {
    const section = getSection(sectionId);
    if (!section) return null;
    const task = _makeTask(overrides);
    const idx = section.tasks.findIndex(t => t.id === afterTaskId);
    section.tasks.splice(idx >= 0 ? idx + 1 : section.tasks.length, 0, task);
    saveData();
    return task;
  }

  function updateTask(id, changes) {
    const found = _findTask(id);
    if (found) { Object.assign(found.task, changes); saveData(); }
    return found ? found.task : null;
  }

  // Write a single TL field value into task.fieldValues[fieldId]
  function updateTaskField(taskId, fieldId, value) {
    const found = _findTask(taskId);
    if (!found) return null;
    if (!found.task.fieldValues) found.task.fieldValues = {};
    found.task.fieldValues[fieldId] = value;
    saveData();
    return found.task;
  }

  function deleteTask(id) {
    const found = _findTask(id);
    if (!found) return;
    if (_data.activeTaskId === id) _data.activeTaskId = null;
    const tasks = found.section.tasks;
    tasks.splice(tasks.findIndex(t => t.id === id), 1);
    saveData();
  }

  function duplicateTask(id) {
    const found = _findTask(id);
    if (!found) return null;
    const orig = found.task;
    const copy = _makeTask(Object.assign({}, orig, {
      id: Utils.generateId(),
      fieldValues: Object.assign({}, orig.fieldValues),
      comments: (orig.comments || []).map(c => Object.assign({}, c, { attachments: (c.attachments || []).slice() })),
      tmOrders: Object.assign({}, orig.tmOrders || {}),
      tsOrders: (orig.tsOrders || []).slice(),
      tlOrders: Object.assign({}, orig.tlOrders || {})
    }));
    const tasks = found.section.tasks;
    tasks.splice(tasks.findIndex(t => t.id === id) + 1, 0, copy);
    saveData();
    return copy;
  }

  function moveTaskToSection(taskId, targetSectionId) {
    const found = _findTask(taskId);
    if (!found) return;
    const srcTasks = found.section.tasks;
    const [task] = srcTasks.splice(srcTasks.findIndex(t => t.id === taskId), 1);
    const targetSection = getSection(targetSectionId);
    if (targetSection) { targetSection.tasks.push(task); saveData(); }
  }

  function reorderTeams(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const [item] = _data.teams.splice(fromIdx, 1);
    _data.teams.splice(toIdx, 0, item);
    saveData();
  }

  function reorderProjects(teamId, fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const team = _findTeam(teamId);
    if (!team) return;
    const [item] = team.projects.splice(fromIdx, 1);
    team.projects.splice(toIdx, 0, item);
    saveData();
  }

  function reorderSections(projectId, fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const project = getProject(projectId);
    if (!project) return;
    const [item] = project.sections.splice(fromIdx, 1);
    project.sections.splice(toIdx, 0, item);
    saveData();
  }

  function moveTaskToPosition(taskId, targetSectionId, targetIdx) {
    const found = _findTask(taskId);
    if (!found) return;
    const isSameSection = found.section.id === targetSectionId;
    const srcTasks = found.section.tasks;
    const srcIdx = srcTasks.findIndex(t => t.id === taskId);
    const [task] = srcTasks.splice(srcIdx, 1);
    const targetSection = isSameSection ? found.section : getSection(targetSectionId);
    if (!targetSection) return;
    let adj = targetIdx;
    if (isSameSection && srcIdx < targetIdx) adj--;
    targetSection.tasks.splice(Math.max(0, Math.min(adj, targetSection.tasks.length)), 0, task);
    saveData();
  }

  // ── UI State ──────────────────────────────────────────────────────────────

  function getActiveProjectId() { return _data.activeProjectId; }
  function setActiveProjectId(id) {
    _data.activeProjectId = id;
    _data.activeTaskId = null;
    saveData();
  }

  function getActiveTaskId() { return _data.activeTaskId; }
  function setActiveTaskId(id) { _data.activeTaskId = id; saveData(); }

  function getActiveView() { return _data.activeView || 'list'; }
  function setActiveView(view) { _data.activeView = view; saveData(); }

  function getListColumnOrder() {
    const stored = _data.listColumnOrder || ['name', 'date', 'notes'];
    const rest = stored.filter(k => k !== 'name');
    return ['name', ...rest];
  }
  function setListColumnOrder(order) {
    const rest = order.filter(k => k !== 'name');
    _data.listColumnOrder = ['name', ...rest];
    saveData();
  }

  // ── Export / Import ───────────────────────────────────────────────────────

  function exportData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { alert('No data to export.'); return; }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `band-booking-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') throw new Error('Not a valid backup object');
      localStorage.setItem(STORAGE_KEY, jsonString);
      window.location.reload();
    } catch (e) {
      alert('Import failed — invalid backup file.\n\n' + e.message);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    loadData, saveData,
    exportData, importData,
    getTemplates, getTemplate, getProjectTemplate, addTemplate, updateTemplate, deleteTemplate,
    isDefaultTemplate, getDefaultTemplatesVisible, setDefaultTemplatesVisible,
    getHiddenDefaultTemplates, hideDefaultTemplate, restoreDefaultTemplate,
    customiseDefaultTemplate, duplicateTemplate,
    getTeams, getTeam, addTeam, updateTeam, deleteTeam,
    getProject, getProjectTeam, addProject, updateProject, deleteProject,
    getSections, getSection, getSectionProject, addSection, updateSection, deleteSection,
    getTask, getTaskSection, getTaskTeam,
    addTask, addTaskAfter, updateTask, updateTaskField, deleteTask, duplicateTask,
    moveTaskToSection, moveTaskToPosition,
    reorderTeams, reorderProjects, reorderSections,
    getActiveProjectId, setActiveProjectId,
    getActiveTaskId, setActiveTaskId,
    getActiveView, setActiveView,
    getListColumnOrder, setListColumnOrder
  };
})();
