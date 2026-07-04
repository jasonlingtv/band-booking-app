// detail.js — Task detail panel (template-driven)
const DetailPanel = (() => {
  'use strict';

  // Collapse state for TS and TM sections, keyed by ts.id / tm.id.
  // Initialized from template's defaultOpen on first encounter.
  const _sectionOpen = {};

  // True while any field is actively being edited — blocks arrow-key navigation.
  let _editingActive = false;

  // Timer used to delay link popover hide on mouseleave.
  let _linkPopoverTimer = null;

  // Active TL drag state for cross-TM drag-and-drop.
  let _tlDragState = null;

  // Tracks which task is currently open so accordion resets only on task change.
  let _accordionTaskId = null;

  // Comment panel refresh callbacks — set by renderers, called after a message is sent.
  let _refreshInlineComments = null;
  let _refreshPaneComments = null;

  // ── Current user identity ────────────────────────────────────────────────
  // Controls which comment bubbles appear on the right (sender === CURRENT_USER).
  // Phase 2: replace with a real account lookup (e.g. Supabase auth.user().email).
  const CURRENT_USER = 'Jason';

  const _PRIO = {
    urgent_important:     { label: 'Urgent, do immediately', cls: 'prio-pill--urg-imp' },
    important_not_urgent: { label: 'Important, do soon',     cls: 'prio-pill--imp-nur' },
    urgent_not_important: { label: 'Must be done',           cls: 'prio-pill--urg-nim' },
    quick_info:           { label: 'Quick information',      cls: 'prio-pill--quick'   }
  };

  // ── Time option helpers ───────────────────────────────────────────────────

  function _timeOptions(firstOption) {
    const opts = firstOption !== undefined ? [firstOption] : [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        opts.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
      }
    }
    return opts;
  }

  // ── Scroll-preserving full re-render (for mirror-field sync) ─────────────

  function _syncPanel(taskId) {
    const el = document.getElementById('detail-inner');
    const top = el ? el.scrollTop : 0;
    render(taskId);
    if (el) el.scrollTop = top;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function render(taskId) {
    _editingActive = false;
    const isNewTask = taskId !== _accordionTaskId;
    if (isNewTask) {
      _accordionTaskId = taskId;
      const pane = document.getElementById('comment-pane');
      if (pane) {
        document.getElementById('app').classList.remove('comment-pane-open');
        _refreshPaneComments = null;
        pane.innerHTML = '';
        delete pane.dataset.taskId;
      }
      const bottom = document.getElementById('detail-bottom');
      if (bottom) bottom.style.display = '';
    }
    const panel = document.getElementById('detail-panel');
    const content = document.getElementById('detail-content');
    content.innerHTML = '';
    const bottom = document.getElementById('detail-bottom');
    if (bottom) bottom.innerHTML = '';

    const task = DataLayer.getTask(taskId);
    if (!task) { panel.classList.add('hidden'); return; }

    panel.classList.remove('hidden');
    _setupTlDragGlobal(content);

    const team     = DataLayer.getTaskTeam(taskId);
    const section  = DataLayer.getTaskSection(taskId);
    const project  = section ? DataLayer.getSectionProject(section.id) : null;
    const sections = project ? DataLayer.getSections(project.id) : [];
    const template = (!task.blank && project) ? DataLayer.getProjectTemplate(project.id) : null;

    // Explicit render order — do not reorder these calls
    _renderTitle(content, task, team);                           // 1. title
    _renderDates(content, task);                                 // 2. dates
    _renderSectionSelector(content, task, section, sections);    // 3. section pills
    _renderChecklist(content, task, template);                   // 4. checkpoints
    if (template && template.taskFeatures && template.taskFeatures.taskReminders && template.taskFeatures.taskReminders.enabled) {
      _renderTaskReminderField(content, task);                   // 5. task reminder
    }

    if (task.blank) {
      const blankCtx = { template: null, taskId: task.id, onModified: () => _syncPanel(task.id) };
      _renderBlankNotes(content, task);
      const blankSections = (task.customSections || []).slice();
      if (task.tsOrders && task.tsOrders.length) {
        blankSections.sort((a, b) => {
          const ai = task.tsOrders.indexOf(a.id), bi = task.tsOrders.indexOf(b.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1; if (bi === -1) return -1;
          return ai - bi;
        });
      }
      for (const cs of blankSections) {
        _renderCustomSection(content, cs, task, team, blankCtx);
      }
      _renderBlankAddControls(content, task, blankCtx);
      if (blankSections.length > 0) _setupTsReorder(content, task.id, blankCtx);
    } else if (template) {
      const editCtx = { template, taskId: task.id, onModified: () => _syncPanel(task.id) };
      _renderTemplateSections(content, task, team, template, editCtx, isNewTask);
    }

    _renderCommentSection(bottom || content, task);
    _markCommentsRead(taskId);
  }

  function hide() {
    document.getElementById('detail-panel').classList.add('hidden');
    // Close comment pane so it doesn't orphan after panel closes
    document.getElementById('app').classList.remove('comment-pane-open');
    _refreshPaneComments = null;
    const pane = document.getElementById('comment-pane');
    if (pane) { pane.innerHTML = ''; delete pane.dataset.taskId; }
    const bottom = document.getElementById('detail-bottom');
    if (bottom) bottom.style.display = '';
  }

  // ── Comment read tracking (localStorage, no re-render) ───────────────────
  const _READ_KEY = 'band_booking_read';

  function _markCommentsRead(taskId) {
    try {
      const stored = JSON.parse(localStorage.getItem(_READ_KEY) || '{}');
      stored[taskId] = new Date().toISOString();
      localStorage.setItem(_READ_KEY, JSON.stringify(stored));
    } catch (e) {}
  }

  function getCommentReadTime(taskId) {
    try {
      const stored = JSON.parse(localStorage.getItem(_READ_KEY) || '{}');
      return stored[taskId] || null;
    } catch (e) { return null; }
  }

  // ── Title ─────────────────────────────────────────────────────────────────

  function _renderTitle(container, task, team) {
    const input = document.createElement('textarea');
    input.className = 'detail-title-input';
    input.rows = 2;
    input.placeholder = 'DD.MM.YYYY – Venue name | Venue name, Country';
    input.value = task.title || '';

    let _lastSaved = task.title || '';

    function _commit() {
      const raw = input.value.trim();
      const changes = Utils.taskTitleChanges(raw);
      if (changes.title !== raw) input.value = changes.title;
      DataLayer.updateTask(task.id, changes);
      _lastSaved = changes.title;
      UIHelpers.showSaved();
      Utils.EventBus.emit('task:updated', task.id);
      ListView.render();
      if (document.getElementById('board-view') && !document.getElementById('board-view').classList.contains('hidden')) {
        BoardView.render();
      }
    }

    input.addEventListener('blur', _commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = _lastSaved; input.blur(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    });

    container.appendChild(input);
    requestAnimationFrame(() => {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    });
  }

  // ── Date Range ────────────────────────────────────────────────────────────

  function _renderDates(container, task) {
    const wrapper = document.createElement('div');
    wrapper.className = 'detail-dates';
    wrapper.id = 'detail-dates-' + task.id;

    function _buildPills() {
      wrapper.innerHTML = '';
      const t = DataLayer.getTask(task.id);
      if (!t) return;

      const startBtn = document.createElement('button');
      startBtn.className = 'date-pill calendar-trigger' + (t.startDate ? ' has-date' : ' empty');
      startBtn.innerHTML = `<span class="pill-icon">📅</span> ${t.startDate ? Utils.formatDate(t.startDate) : 'Start date'}`;
      startBtn.addEventListener('click', () => {
        Calendar.open(startBtn, {
          startDate: t.startDate, endDate: t.endDate,
          onSelect: ({ startDate, endDate }) => {
            DataLayer.updateTask(task.id, {
              startDate: startDate ? startDate.toISOString() : null,
              endDate:   endDate   ? endDate.toISOString()   : null
            });
            UIHelpers.showSaved();
            _syncPanel(task.id);
            ListView.render();
          }
        });
      });
      wrapper.appendChild(startBtn);

      if (t.startDate || t.endDate) {
        const arrow = document.createElement('span');
        arrow.className = 'date-arrow';
        arrow.textContent = '→';
        wrapper.appendChild(arrow);

        const endBtn = document.createElement('button');
        endBtn.className = 'date-pill calendar-trigger' + (t.endDate ? ' has-date' : ' empty');
        endBtn.innerHTML = `<span class="pill-icon">📅</span> ${t.endDate ? Utils.formatDate(t.endDate) : 'End date'}`;
        endBtn.addEventListener('click', () => {
          Calendar.open(endBtn, {
            startDate: t.startDate, endDate: t.endDate,
            onSelect: ({ startDate, endDate }) => {
              DataLayer.updateTask(task.id, {
                startDate: startDate ? startDate.toISOString() : null,
                endDate:   endDate   ? endDate.toISOString()   : null
              });
              UIHelpers.showSaved();
              _syncPanel(task.id);
              ListView.render();
            }
          });
        });
        wrapper.appendChild(endBtn);
      }
    }

    _buildPills();
    container.appendChild(wrapper);
  }

  // ── Section Selector ──────────────────────────────────────────────────────

  function _renderSectionSelector(container, task, currentSection, sections) {
    const wrapper = document.createElement('div');
    wrapper.className = 'detail-section-selector';

    const label = document.createElement('label');
    label.textContent = 'Section:';
    wrapper.appendChild(label);

    sections.forEach(sec => {
      const pill = document.createElement('button');
      pill.className = `section-pill color-${sec.color}` + (currentSection && sec.id === currentSection.id ? ' active' : '');
      pill.textContent = sec.name;
      pill.addEventListener('click', () => {
        if (currentSection && sec.id === currentSection.id) return;
        DataLayer.moveTaskToSection(task.id, sec.id);
        UIHelpers.showSaved();
        ListView.render();
        if (document.getElementById('board-view') && !document.getElementById('board-view').classList.contains('hidden')) {
          BoardView.render();
        }
        render(task.id);
      });
      wrapper.appendChild(pill);
    });

    container.appendChild(wrapper);
  }

  // ── Checklist ─────────────────────────────────────────────────────────────

  function _renderChecklist(container, task, template) {
    const rem = template && template.taskFeatures && template.taskFeatures.reminders;
    if (!rem || !rem.enabled || !rem.items || rem.items.length === 0) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'detail-checklist';

    rem.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'checklist-item';

      const chk = document.createElement('div');
      const isChecked = !!(task.reminders && task.reminders[item.id]);
      chk.className = 'checklist-checkbox' + (isChecked ? ' checked' : '');

      const lbl = document.createElement('span');
      lbl.className = 'checklist-label';
      lbl.textContent = item.name;

      row.appendChild(chk);
      row.appendChild(lbl);
      row.addEventListener('click', () => {
        const t = DataLayer.getTask(task.id);
        const current = !!(t && t.reminders && t.reminders[item.id]);
        const newReminders = Object.assign({}, t ? t.reminders : {}, { [item.id]: !current });
        DataLayer.updateTask(task.id, { reminders: newReminders });
        UIHelpers.showSaved();
        chk.classList.toggle('checked', !current);
      });

      wrapper.appendChild(row);
    });

    container.appendChild(wrapper);
  }

  // ── Template-driven section rendering ─────────────────────────────────────

  function _renderTemplateSections(container, task, team, template, editCtx, isNewTask) {
    const templateEntries = template.taskSections.map(ts => ({ ts, isCustom: false }));
    const customEntries   = (task.customSections || []).map(cs => ({ ts: cs, isCustom: true }));
    const allEntries = [...templateEntries, ...customEntries];

    if (task.tsOrders && task.tsOrders.length) {
      allEntries.sort((a, b) => {
        const ai = task.tsOrders.indexOf(a.ts.id), bi = task.tsOrders.indexOf(b.ts.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1; if (bi === -1) return -1;
        return ai - bi;
      });
    }

    // Accordion: on first open of a task, default first TS open, rest closed
    if (isNewTask) {
      allEntries.forEach(({ ts }, idx) => { _sectionOpen[ts.id] = idx === 0; });
    }

    for (const { ts, isCustom } of allEntries) {
      if (isCustom) {
        _renderCustomSection(container, ts, task, team, editCtx);
      } else {
        _renderTS(container, ts, task, team, editCtx, false);
      }
    }

    // Accordion: when a TS is opened, collapse all sibling TSs
    const tsGroups = Array.from(container.querySelectorAll(':scope > .detail-section-group'));
    if (tsGroups.length > 1) {
      tsGroups.forEach(group => {
        const heading = group.querySelector(':scope > .detail-section-heading');
        if (!heading) return;
        heading.addEventListener('click', () => {
          if (group.classList.contains('collapsed')) return; // just collapsed — nothing to accordion
          tsGroups.forEach(other => {
            if (other === group) return;
            other.classList.add('collapsed');
            const ch = other.querySelector(':scope > .detail-section-heading .section-chevron');
            if (ch) ch.classList.remove('open');
            const key = other.dataset.tsId;
            if (key) _sectionOpen[key] = false;
          });
        });
      });
    }

    if (allEntries.length > 1) _setupTsReorder(container, task.id, editCtx);
  }

  function _renderTS(container, ts, task, team, editCtx, isCustom) {
    const displayName = _getItemLabel(ts.id, task, ts.name);
    const onRenameTs = (newName) => {
      if (isCustom) {
        const t = DataLayer.getTask(editCtx.taskId);
        if (!t) return;
        DataLayer.updateTask(editCtx.taskId, {
          customSections: (t.customSections || []).map(s => s.id === ts.id ? { ...s, name: newName } : s)
        });
      } else {
        _taskRenameLabel(editCtx.taskId, ts.id, newName);
      }
      UIHelpers.showSaved();
    };
    const group = _addSectionGroup(container, displayName, ts.id, ts.defaultOpen, onRenameTs);
    group.dataset.tsId = ts.id;

    // TS drag handle (inserted before chevron in heading)
    const tsHeading = group.querySelector(':scope > .detail-section-heading');
    const tsHandle = document.createElement('span');
    tsHandle.className = 'detail-ts-drag-handle';
    tsHandle.textContent = '⠿';
    tsHandle.title = 'Drag to reorder section';
    tsHandle.addEventListener('click', e => e.stopPropagation());
    tsHeading.insertBefore(tsHandle, tsHeading.firstChild);

    const tmGroupRefs = {};

    // ── Flat TM: render its fields directly into the section group ────────
    const flatTm = ts.modules.find(m => m.name === '');
    if (flatTm) {
      group.dataset.flatTmId = flatTm.id;
      const fp = task.fieldPlacements || {};
      const flatTemplateFields = (flatTm.fields || []).filter(f => { const p = fp[f.id]; return !p || p.parentTmId === flatTm.id; });
      const adoptedFlatFields = (editCtx.template ? editCtx.template.taskSections : []).flatMap(ots =>
        ots.modules.flatMap(otm => otm.id === flatTm.id ? [] :
          (otm.fields || []).filter(f => { const p = fp[f.id]; return p && p.parentTmId === flatTm.id; }).map(f => ({ f, custom: false }))
        )
      );
      const flatCustomFields = (task.customFields || []).filter(cf => { const p = fp[cf.id]; return (p ? p.parentTmId : cf.parentTmId) === flatTm.id; });
      const flatAllFields = [
        ...flatTemplateFields.map(f => ({ f, custom: false })),
        ...adoptedFlatFields,
        ...flatCustomFields.map(f => ({ f, custom: true }))
      ];
      const flatTlOrder = task.tlOrders && task.tlOrders[flatTm.id];
      if (flatTlOrder && flatTlOrder.length) {
        flatAllFields.sort((a, b) => {
          const ai = flatTlOrder.indexOf(a.f.id), bi = flatTlOrder.indexOf(b.f.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1; if (bi === -1) return -1;
          return ai - bi;
        });
      }
      for (const { f, custom } of flatAllFields) {
        _renderField(group, f, task, team, editCtx, ts.id, flatTm.id, custom);
      }
    }

    // ── Named TMs (template + custom), sorted by task-level tmOrders ─────
    const templateNamedMods = ts.modules.filter(m => m.name !== '');
    const customMods = (task.customModules || []).filter(cm => cm.parentTsId === ts.id);
    const allNamedMods = [...templateNamedMods, ...customMods];

    const savedOrder = task.tmOrders && task.tmOrders[ts.id];
    if (savedOrder && savedOrder.length) {
      allNamedMods.sort((a, b) => {
        const ai = savedOrder.indexOf(a.id), bi = savedOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }

    allNamedMods.forEach(tm => {
      const isCustomMod = customMods.some(cm => cm.id === tm.id);
      const tmDisplayName = _getItemLabel(tm.id, task, tm.name);
      const onRenameTm = (newName) => {
        _taskRenameLabel(editCtx.taskId, tm.id, newName);
        UIHelpers.showSaved();
      };
      const tmGroup = _addModuleGroup(group, tmDisplayName, tm.id, isCustomMod ? (tm.defaultOpen !== false) : tm.defaultOpen, onRenameTm);
      tmGroupRefs[tm.id] = tmGroup;

      // Drag handle for TM reordering
      const tmHeading = tmGroup.querySelector(':scope > .detail-module-heading');
      const handle = document.createElement('span');
      handle.className = 'detail-tm-drag-handle';
      handle.textContent = '⠿';
      handle.title = 'Drag to reorder';
      tmHeading.insertBefore(handle, tmHeading.firstChild);

      const tmRight = document.createElement('span');
      tmRight.className = 'detail-heading-right';
      if (isCustomMod) {
        tmRight.appendChild(_makeInlineDeleteBtn(() => _taskDeleteCustomModule(editCtx, tm.id)));
      } else {
        tmRight.appendChild(_makeInlineDeleteBtn(() => {
          alert('This module comes from the template and can only be removed via the Template editor.');
        }));
      }
      tmHeading.appendChild(tmRight);

      const fp2 = task.fieldPlacements || {};
      const tmTemplateFields = isCustomMod
        ? (tm.fields || [])
        : (tm.fields || []).filter(f => { const p = fp2[f.id]; return !p || p.parentTmId === tm.id; });
      const adoptedTmFields = isCustomMod ? [] : (editCtx.template ? editCtx.template.taskSections : []).flatMap(ots =>
        ots.modules.flatMap(otm => otm.id === tm.id ? [] :
          (otm.fields || []).filter(f => { const p = fp2[f.id]; return p && p.parentTmId === tm.id; }).map(f => ({ f, custom: false }))
        )
      );
      const tmCustomFields = isCustomMod ? [] : (task.customFields || []).filter(cf => { const p = fp2[cf.id]; return (p ? p.parentTmId : cf.parentTmId) === tm.id; });
      const tmAllFields = [
        ...tmTemplateFields.map(f => ({ f, custom: isCustomMod })),
        ...adoptedTmFields,
        ...tmCustomFields.map(f => ({ f, custom: true }))
      ];
      const tmTlOrder = task.tlOrders && task.tlOrders[tm.id];
      if (tmTlOrder && tmTlOrder.length) {
        tmAllFields.sort((a, b) => {
          const ai = tmTlOrder.indexOf(a.f.id), bi = tmTlOrder.indexOf(b.f.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1; if (bi === -1) return -1;
          return ai - bi;
        });
      }
      for (const { f, custom } of tmAllFields) {
        _renderField(tmGroup, f, task, team, editCtx, ts.id, tm.id, custom);
      }
    });

    // Enable TM drag-and-drop if multiple named modules
    if (allNamedMods.length > 1) {
      _setupTmReorder(group, ts.id, editCtx);
    }

    // ── TS heading right controls (Expand All + Delete) ───────────────────
    const heading = group.querySelector(':scope > .detail-section-heading');
    const headingRight = document.createElement('span');
    headingRight.className = 'detail-heading-right';
    heading.appendChild(headingRight);

    if (allNamedMods.length > 0) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'tm-expand-all-btn';
      headingRight.appendChild(expandBtn);

      function isModuleOpen(tm) {
        return _sectionOpen[tm.id] !== undefined ? _sectionOpen[tm.id] : (tm.defaultOpen || false);
      }
      function updateExpandLabel() {
        expandBtn.textContent = allNamedMods.every(isModuleOpen) ? 'Close All' : 'Expand All';
      }
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shouldOpen = !allNamedMods.every(isModuleOpen);
        allNamedMods.forEach(tm => {
          _sectionOpen[tm.id] = shouldOpen;
          const el = tmGroupRefs[tm.id];
          if (el) {
            el.classList.toggle('collapsed', !shouldOpen);
            const ch = el.querySelector(':scope > .detail-module-heading .section-chevron');
            if (ch) ch.classList.toggle('open', shouldOpen);
          }
        });
        updateExpandLabel();
      });
      allNamedMods.forEach(tm => {
        const el = tmGroupRefs[tm.id];
        if (el) {
          const h = el.querySelector(':scope > .detail-module-heading');
          if (h) h.addEventListener('click', updateExpandLabel);
        }
      });
      updateExpandLabel();
    }

    headingRight.appendChild(_makeInlineDeleteBtn(() => {
      if (isCustom) {
        _taskDeleteCustomSection(editCtx, ts.id);
      } else {
        alert('This section comes from the template and can only be removed via the Template editor.');
      }
    }));

    // ── Per-TS add controls ───────────────────────────────────────────────
    _appendTsAddControls(group, ts.id, isCustom, editCtx, flatTm);
  }

  // ── Custom section (task-specific TS) ────────────────────────────────────

  function _renderCustomSection(container, cs, task, team, editCtx) {
    if (!cs.modules) cs.modules = [];
    if (!cs.modules.some(m => m.name === '')) {
      cs.modules.unshift({ id: Utils.generateId(), name: '', defaultOpen: true, fields: [] });
    }
    const flatTm   = cs.modules.find(m => m.name === '');
    const namedMods = cs.modules.filter(m => m.name !== '');
    const tmGroupRefs = {};

    const onRenameCs = (newName) => {
      const t = DataLayer.getTask(editCtx.taskId);
      if (!t) return;
      DataLayer.updateTask(editCtx.taskId, {
        customSections: (t.customSections || []).map(s => s.id === cs.id ? { ...s, name: newName } : s)
      });
      UIHelpers.showSaved();
    };
    const group = _addSectionGroup(container, cs.name || 'Section', cs.id, cs.defaultOpen !== false, onRenameCs);
    group.dataset.tsId = cs.id;

    // TS drag handle
    const csTsHeading = group.querySelector(':scope > .detail-section-heading');
    const csTsHandle = document.createElement('span');
    csTsHandle.className = 'detail-ts-drag-handle';
    csTsHandle.textContent = '⠿';
    csTsHandle.title = 'Drag to reorder section';
    csTsHandle.addEventListener('click', e => e.stopPropagation());
    csTsHeading.insertBefore(csTsHandle, csTsHeading.firstChild);

    // Flat fields — sorted by tlOrders
    group.dataset.flatTmId = flatTm.id;
    const adoptedCsFlatFields = (task.customFields || []).filter(cf => cf.parentTmId === flatTm.id);
    const csAllFlatFields = [...(flatTm.fields || []), ...adoptedCsFlatFields];
    const csFlatTlOrder = task.tlOrders && task.tlOrders[flatTm.id];
    if (csFlatTlOrder && csFlatTlOrder.length) {
      csAllFlatFields.sort((a, b) => {
        const ai = csFlatTlOrder.indexOf(a.id), bi = csFlatTlOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1; if (bi === -1) return -1;
        return ai - bi;
      });
    }
    for (const field of csAllFlatFields) {
      _renderField(group, field, task, team, editCtx, cs.id, flatTm.id, true);
    }

    // Named modules
    namedMods.forEach(cm => {
      const onRenameCm = (newName) => {
        const t = DataLayer.getTask(editCtx.taskId);
        if (!t) return;
        DataLayer.updateTask(editCtx.taskId, {
          customSections: (t.customSections || []).map(s => s.id !== cs.id ? s : {
            ...s, modules: (s.modules || []).map(m => m.id === cm.id ? { ...m, name: newName } : m)
          })
        });
        UIHelpers.showSaved();
      };
      const cmGroup = _addModuleGroup(group, cm.name, cm.id, cm.defaultOpen !== false, onRenameCm);
      tmGroupRefs[cm.id] = cmGroup;

      const cmHeading = cmGroup.querySelector(':scope > .detail-module-heading');
      const cmRight = document.createElement('span');
      cmRight.className = 'detail-heading-right';
      cmRight.appendChild(_makeInlineDeleteBtn(() => {
        if (!window.confirm('Remove this module from this task?')) return;
        const t = DataLayer.getTask(editCtx.taskId);
        if (!t) return;
        DataLayer.updateTask(editCtx.taskId, {
          customSections: (t.customSections || []).map(s => s.id !== cs.id ? s : {
            ...s, modules: (s.modules || []).filter(m => m.id !== cm.id)
          })
        });
        UIHelpers.showSaved(); editCtx.onModified();
      }));
      cmHeading.appendChild(cmRight);

      const adoptedCmFields = (task.customFields || []).filter(cf => cf.parentTmId === cm.id);
      const cmAllFields = [...(cm.fields || []), ...adoptedCmFields];
      const cmTlOrder = task.tlOrders && task.tlOrders[cm.id];
      if (cmTlOrder && cmTlOrder.length) {
        cmAllFields.sort((a, b) => {
          const ai = cmTlOrder.indexOf(a.id), bi = cmTlOrder.indexOf(b.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1; if (bi === -1) return -1;
          return ai - bi;
        });
      }
      for (const field of cmAllFields) {
        _renderField(cmGroup, field, task, team, editCtx, cs.id, cm.id, true);
      }
    });

    _appendTsAddControls(group, cs.id, true, editCtx, flatTm);

    const heading = group.querySelector(':scope > .detail-section-heading');
    const headingRight = document.createElement('span');
    headingRight.className = 'detail-heading-right';
    if (namedMods.length > 0) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'tm-expand-all-btn';
      headingRight.appendChild(expandBtn);
      function isOpen(m) { return _sectionOpen[m.id] !== undefined ? _sectionOpen[m.id] : (m.defaultOpen !== false); }
      function updateLabel() { expandBtn.textContent = namedMods.every(isOpen) ? 'Close All' : 'Expand All'; }
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shouldOpen = !namedMods.every(isOpen);
        namedMods.forEach(m => {
          _sectionOpen[m.id] = shouldOpen;
          const el = tmGroupRefs[m.id];
          if (el) { el.classList.toggle('collapsed', !shouldOpen); const ch = el.querySelector('.section-chevron'); if (ch) ch.classList.toggle('open', shouldOpen); }
        });
        updateLabel();
      });
      updateLabel();
    }
    headingRight.appendChild(_makeInlineDeleteBtn(() => _taskDeleteCustomSection(editCtx, cs.id)));
    heading.appendChild(headingRight);
  }

  // ── TM drag-and-drop reordering ───────────────────────────────────────────

  function _setupTmReorder(tsGroup, tsId, editCtx) {
    let dragEl = null;

    tsGroup.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.detail-tm-drag-handle');
      if (!handle) return;
      const modGroup = handle.closest('.detail-module-group');
      if (!modGroup) return;
      modGroup.setAttribute('draggable', 'true');
      dragEl = modGroup;
    });

    tsGroup.addEventListener('dragstart', (e) => {
      if (!dragEl) return;
      dragEl.classList.add('tm-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    tsGroup.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragEl) return;
      const target = e.target.closest('.detail-module-group');
      if (!target || target === dragEl) return;
      const rect = target.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      if (after) { target.after(dragEl); } else { target.before(dragEl); }
    });

    tsGroup.addEventListener('dragend', () => {
      if (!dragEl) return;
      dragEl.classList.remove('tm-dragging');
      dragEl.removeAttribute('draggable');

      const newOrder = Array.from(
        tsGroup.querySelectorAll(':scope > .detail-module-group')
      ).map(el => el.dataset.tmId).filter(Boolean);

      const t = DataLayer.getTask(editCtx.taskId);
      if (t) {
        const tmOrders = Object.assign({}, t.tmOrders || {});
        tmOrders[tsId] = newOrder;
        DataLayer.updateTask(editCtx.taskId, { tmOrders });
        UIHelpers.showSaved();
      }
      dragEl = null;
    });
  }

  // ── TS drag-and-drop reordering ───────────────────────────────────────────

  function _setupTsReorder(container, taskId, editCtx) {
    let dragEl = null;

    container.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.detail-ts-drag-handle');
      if (!handle) return;
      const sectionGroup = handle.closest('.detail-section-group');
      if (!sectionGroup || sectionGroup.parentElement !== container) return;
      sectionGroup.setAttribute('draggable', 'true');
      dragEl = sectionGroup;
    });

    container.addEventListener('dragstart', (e) => {
      if (!dragEl) return;
      dragEl.classList.add('ts-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragEl) return;
      const target = e.target.closest('.detail-section-group');
      if (!target || target === dragEl || target.parentElement !== container) return;
      const rect = target.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      if (after) { target.after(dragEl); } else { target.before(dragEl); }
    });

    container.addEventListener('dragend', () => {
      if (!dragEl) return;
      dragEl.classList.remove('ts-dragging');
      dragEl.removeAttribute('draggable');

      const newOrder = Array.from(
        container.querySelectorAll(':scope > .detail-section-group')
      ).map(el => el.dataset.tsId).filter(Boolean);

      const t = DataLayer.getTask(taskId);
      if (t) {
        DataLayer.updateTask(taskId, { tsOrders: newOrder });
        UIHelpers.showSaved();
      }
      dragEl = null;
    });
  }

  // ── TL drag-and-drop (global, supports cross-TM / cross-TS moves) ─────────

  function _setupTlDragGlobal(container) {
    if (container._tlDragReady) return;
    container._tlDragReady = true;

    function clearDropUI() {
      container.querySelectorAll('.tl-drop-before,.tl-drop-after').forEach(el => el.classList.remove('tl-drop-before','tl-drop-after'));
      container.querySelectorAll('.tl-drop-target').forEach(el => el.classList.remove('tl-drop-target'));
    }

    container.addEventListener('mousedown', (e) => {
      const field = e.target.closest('.detail-field');
      if (!field) return;
      // Don't initiate drag from value area or any interactive element
      if (e.target.closest('.detail-field-value')) return;
      if (e.target.closest('.detail-field-delete-btn')) return;
      if (e.target.closest('.detail-rename-btn')) return;
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a') return;
      const parentEl = field.parentElement;
      const taskId = DataLayer.getActiveTaskId();
      if (!taskId) return;
      field.setAttribute('draggable', 'true');
      _tlDragState = {
        el: field,
        sourceTmId: parentEl.dataset.tmId || parentEl.dataset.flatTmId,
        sourceParent: parentEl,
        taskId
      };
    });

    container.addEventListener('dragstart', (e) => {
      if (!_tlDragState || e.target !== _tlDragState.el) return;
      _tlDragState.el.classList.add('tl-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragover', (e) => {
      if (!_tlDragState) return;
      e.preventDefault();
      clearDropUI();
      const tgtField = e.target.closest('.detail-field');
      if (tgtField && tgtField !== _tlDragState.el) {
        const r = tgtField.getBoundingClientRect();
        tgtField.classList.add(e.clientY > r.top + r.height / 2 ? 'tl-drop-after' : 'tl-drop-before');
        return;
      }
      const tmGroup = e.target.closest('.detail-module-group');
      if (tmGroup) { tmGroup.classList.add('tl-drop-target'); return; }
      const tsGroup = e.target.closest('.detail-section-group');
      if (tsGroup) tsGroup.classList.add('tl-drop-target');
    });

    container.addEventListener('dragleave', (e) => {
      if (_tlDragState && !container.contains(e.relatedTarget)) clearDropUI();
    });

    container.addEventListener('dragend', () => {
      if (!_tlDragState) return;
      clearDropUI();
      _tlDragState.el.classList.remove('tl-dragging');
      _tlDragState.el.removeAttribute('draggable');
      _tlDragState = null;
    });

    container.addEventListener('drop', (e) => {
      if (!_tlDragState) return;
      e.preventDefault();
      clearDropUI();

      const { el, sourceTmId, sourceParent, taskId } = _tlDragState;
      _tlDragState = null;
      const tlId = el.dataset.tlId;

      const tgtField = e.target.closest('.detail-field');
      let targetParent = null;

      if (tgtField && tgtField !== el) {
        const r = tgtField.getBoundingClientRect();
        if (e.clientY > r.top + r.height / 2) tgtField.after(el); else tgtField.before(el);
        targetParent = tgtField.parentElement;
      } else {
        const tmGroup = e.target.closest('.detail-module-group');
        const tsGroup = !tmGroup && e.target.closest('.detail-section-group');
        if (tmGroup) {
          targetParent = tmGroup;
        } else if (tsGroup) {
          const lastTm = [...tsGroup.querySelectorAll(':scope > .detail-module-group')].pop();
          targetParent = lastTm || tsGroup;
        }
        if (!targetParent) { el.removeAttribute('draggable'); return; }
        const sentinel = targetParent.querySelector(':scope > .detail-inline-add-btn') ||
                         targetParent.querySelector(':scope > .detail-ts-controls');
        if (sentinel) targetParent.insertBefore(el, sentinel); else targetParent.appendChild(el);
      }

      el.removeAttribute('draggable');
      el.classList.remove('tl-dragging');

      const newTmId = targetParent.dataset.tmId || targetParent.dataset.flatTmId;

      if (!newTmId || !sourceTmId) return;

      if (newTmId === sourceTmId) {
        // Same-TM reorder
        const newOrder = [...targetParent.querySelectorAll(':scope > .detail-field')].map(x => x.dataset.tlId).filter(Boolean);
        const t = DataLayer.getTask(taskId);
        if (t) { DataLayer.updateTask(taskId, { tlOrders: { ...(t.tlOrders || {}), [newTmId]: newOrder } }); UIHelpers.showSaved(); }
      } else {
        _moveTlBetweenTms(tlId, sourceTmId, newTmId, taskId, () => _syncPanel(taskId), targetParent, sourceParent);
      }
    });
  }

  // ── Move a TL from one TM to another, persisting via task data ────────────

  function _moveTlBetweenTms(tlId, sourceTmId, targetTmId, taskId, onModified, targetParent, sourceParent) {
    const t = DataLayer.getTask(taskId);
    if (!t) return;

    const targetOrder = [...targetParent.querySelectorAll(':scope > .detail-field')].map(x => x.dataset.tlId).filter(Boolean);
    const sourceOrder = [...sourceParent.querySelectorAll(':scope > .detail-field')].map(x => x.dataset.tlId).filter(Boolean);
    const updates = { tlOrders: { ...(t.tlOrders || {}), [sourceTmId]: sourceOrder, [targetTmId]: targetOrder } };

    // Case 1: task.customFields
    if ((t.customFields || []).some(f => f.id === tlId)) {
      updates.customFields = t.customFields.map(f => f.id === tlId ? { ...f, parentTmId: targetTmId } : f);
      DataLayer.updateTask(taskId, updates); UIHelpers.showSaved(); onModified(); return;
    }

    // Case 2: field inside a task.customModule
    const srcCm = (t.customModules || []).find(m => (m.fields || []).some(f => f.id === tlId));
    if (srcCm) {
      const fObj = srcCm.fields.find(f => f.id === tlId);
      const tgtCm = (t.customModules || []).find(m => m.id === targetTmId);
      if (tgtCm) {
        updates.customModules = t.customModules.map(m => {
          if (m.id === srcCm.id) return { ...m, fields: m.fields.filter(f => f.id !== tlId) };
          if (m.id === targetTmId) return { ...m, fields: [...(m.fields || []), fObj] };
          return m;
        });
      } else {
        updates.customModules = t.customModules.map(m => m.id === srcCm.id ? { ...m, fields: m.fields.filter(f => f.id !== tlId) } : m);
        updates.customFields = [...(t.customFields || []), { ...fObj, parentTmId: targetTmId }];
      }
      DataLayer.updateTask(taskId, updates); UIHelpers.showSaved(); onModified(); return;
    }

    // Case 3: field inside a task.customSection module
    let foundInCs = null;
    for (const cs of (t.customSections || [])) {
      for (const m of (cs.modules || [])) {
        const f = (m.fields || []).find(f => f.id === tlId);
        if (f) { foundInCs = { cs, m, f }; break; }
      }
      if (foundInCs) break;
    }
    if (foundInCs) {
      const { cs, m: srcMod, f: fObj } = foundInCs;
      const tgtModInSameCs = (cs.modules || []).find(m => m.id === targetTmId);
      if (tgtModInSameCs) {
        updates.customSections = (t.customSections || []).map(s => s.id !== cs.id ? s : {
          ...s, modules: (s.modules || []).map(m => {
            if (m.id === srcMod.id) return { ...m, fields: (m.fields || []).filter(f => f.id !== tlId) };
            if (m.id === targetTmId) return { ...m, fields: [...(m.fields || []), fObj] };
            return m;
          })
        });
      } else {
        updates.customSections = (t.customSections || []).map(s => s.id !== cs.id ? s : {
          ...s, modules: (s.modules || []).map(m => m.id === srcMod.id ? { ...m, fields: (m.fields || []).filter(f => f.id !== tlId) } : m)
        });
        updates.customFields = [...(t.customFields || []), { ...fObj, parentTmId: targetTmId }];
      }
      DataLayer.updateTask(taskId, updates); UIHelpers.showSaved(); onModified(); return;
    }

    // Case 4: template field — record override in task.fieldPlacements
    updates.fieldPlacements = { ...(t.fieldPlacements || {}), [tlId]: { parentTmId: targetTmId } };
    DataLayer.updateTask(taskId, updates); UIHelpers.showSaved(); onModified();
  }

  // ── Per-TS add controls ───────────────────────────────────────────────────

  function _appendTsAddControls(group, tsId, isCustom, editCtx, flatTm) {
    const bar = document.createElement('div');
    bar.className = 'detail-ts-controls';

    const addSectionBtn = document.createElement('button');
    addSectionBtn.className = 'detail-ts-ctrl-btn';
    addSectionBtn.textContent = '+ Add Section';
    addSectionBtn.addEventListener('click', () => _taskAddTS(editCtx, tsId));
    bar.appendChild(addSectionBtn);

    const addModuleBtn = document.createElement('button');
    addModuleBtn.className = 'detail-ts-ctrl-btn';
    addModuleBtn.textContent = '+ Add Module';
    addModuleBtn.addEventListener('click', () => _taskAddCustomModule(editCtx, tsId));
    bar.appendChild(addModuleBtn);

    const addFieldBtn = document.createElement('button');
    addFieldBtn.className = 'detail-ts-ctrl-btn';
    addFieldBtn.textContent = '+ Add Field';
    addFieldBtn.addEventListener('click', (e) => {
      if (isCustom) {
        if (flatTm) {
          _taskAddFieldToCustomTm(editCtx, tsId, flatTm.id, e.currentTarget);
        } else {
          _taskAddFieldAtTSLevel(editCtx, tsId, e.currentTarget);
        }
      } else {
        _taskAddFieldAtTSLevel(editCtx, tsId, e.currentTarget);
      }
    });
    bar.appendChild(addFieldBtn);

    group.appendChild(bar);
  }

  // ── Custom module (task-specific TM attached to a template TS) ────────────

  function _renderCustomModule(container, cm, task, team, editCtx, parentTsId, tmGroupRefs) {
    const onRenameCm = (newName) => {
      const t = DataLayer.getTask(editCtx.taskId);
      if (!t) return;
      DataLayer.updateTask(editCtx.taskId, {
        customModules: (t.customModules || []).map(m => m.id === cm.id ? { ...m, name: newName } : m)
      });
      UIHelpers.showSaved();
    };
    const cmGroup = _addModuleGroup(container, cm.name || 'Module', cm.id, cm.defaultOpen !== false, onRenameCm);
    if (tmGroupRefs) tmGroupRefs[cm.id] = cmGroup;

    const cmHeading = cmGroup.querySelector(':scope > .detail-module-heading');
    const cmRight = document.createElement('span');
    cmRight.className = 'detail-heading-right';
    cmRight.appendChild(_makeInlineDeleteBtn(() => _taskDeleteCustomModule(editCtx, cm.id)));
    cmHeading.appendChild(cmRight);

    (cm.fields || []).forEach(field => {
      _renderField(cmGroup, field, task, team, editCtx, parentTsId, cm.id, true);
    });
  }

  // ── Field dispatch ────────────────────────────────────────────────────────
  // isCustomField: true = from task.customFields/customModules/customSections; false = from template

  function _renderField(parent, field, task, team, editCtx, tsId, tmId, isCustomField) {
    const storageId = field.mirrorOf || field.id;
    const displayLabel = isCustomField ? field.name : _getItemLabel(field.id, task, field.name);

    const onRenameLabel = field.hideLabel ? null : (newName) => {
      if (isCustomField) {
        _renameCustomField(editCtx.taskId, field.id, newName);
      } else {
        _taskRenameLabel(editCtx.taskId, field.id, newName);
      }
      UIHelpers.showSaved();
    };

    let row = null;

    switch (field.type) {

      case 'auto':
        row = _makeReadonlyField(parent, {
          label: displayLabel,
          getValue: () => _autoValue(field.autoSource, task, team)
        });
        break;

      case 'text':
        if (field.readonly) {
          row = _makeReadonlyField(parent, {
            label: displayLabel,
            getValue: () => _fv(task, storageId) || '—'
          });
        } else {
          row = _makeField(parent, {
            label: field.hideLabel ? '' : displayLabel,
            tlId: storageId, type: 'text', taskId: task.id,
            onCommit: field.syncOnCommit ? () => _syncPanel(task.id) : null,
            onRenameLabel
          });
        }
        break;

      case 'textarea':
        row = _makeField(parent, {
          label: field.hideLabel ? '' : displayLabel,
          tlId: storageId, type: 'textarea', taskId: task.id, onRenameLabel
        });
        break;

      case 'link':
        row = _makeLinkField(parent, { label: displayLabel, tlId: storageId, taskId: task.id, onRenameLabel });
        break;

      case 'dropdown':
        row = _makeDropdownField(parent, {
          label: displayLabel, tlId: storageId,
          options: field.dropdownOptions || [], taskId: task.id,
          defaultValue: field.defaultValue, onRenameLabel
        });
        break;

      case 'toggle':
        row = _makeToggle(parent, {
          label: displayLabel, tlId: storageId,
          options: field.toggleOptions || [], taskId: task.id,
          defaultValue: field.defaultValue, onRenameLabel
        });
        break;

      case 'time-select':
        row = _makeField(parent, {
          label: displayLabel, tlId: storageId, type: 'select',
          selectOptions: _timeOptions(''), taskId: task.id, onRenameLabel
        });
        break;

      case 'time-select-na':
        row = _makeField(parent, {
          label: displayLabel, tlId: storageId, type: 'select',
          selectOptions: _timeOptions('N/A'), taskId: task.id,
          defaultValue: field.defaultValue, onRenameLabel
        });
        break;

      case 'catering-select':
        row = _makeField(parent, {
          label: displayLabel, tlId: storageId, type: 'select',
          selectOptions: _timeOptions('After Soundcheck'), taskId: task.id,
          defaultValue: field.defaultValue, onRenameLabel
        });
        break;

      case 'show-length-select':
        row = _makeField(parent, {
          label: displayLabel, tlId: storageId, type: 'select',
          selectOptions: ['45 min', '60 min', '75 min', '90 min', '2 x 45 min'],
          taskId: task.id, defaultValue: field.defaultValue, onRenameLabel
        });
        break;

      case 'show-time':
        row = _makeShowTimeField(parent, task.id, storageId);
        break;

      case 'date':
        row = _makeDateField(parent, { label: displayLabel, tlId: storageId, taskId: task.id, onRenameLabel });
        break;
    }

    if (row && field.id) {
      row.dataset.tlId = field.id;
      const tlHandle = document.createElement('span');
      tlHandle.className = 'detail-tl-drag-handle';
      tlHandle.textContent = '⠿';
      tlHandle.title = 'Drag to reorder field';
      row.insertBefore(tlHandle, row.firstChild);
    }

    if (row) {
      row.classList.add('detail-field--editable');
      const delBtn = _makeInlineDeleteBtn(() => {
        if (isCustomField) {
          _deleteCustomField(editCtx, field.id);
        } else {
          alert('This field comes from the template and can only be removed via the Template editor.');
        }
      });
      delBtn.classList.add('detail-field-delete-btn');
      row.appendChild(delBtn);
    }

    return row;
  }

  function _autoValue(autoSource, task, team) {
    const t = DataLayer.getTask(task.id);
    switch (autoSource) {
      case 'dateRange': {
        if (!t || !t.startDate) return '—';
        const start = Utils.formatDate(t.startDate);
        const end   = t.endDate && t.endDate !== t.startDate ? Utils.formatDate(t.endDate) : '';
        return end ? `${start} – ${end}` : start;
      }
      case 'teamName': return team ? team.name : '—';
      case 'title':    return t ? (t.title || '—') : '—';
      default:         return '—';
    }
  }

  // Read a field value from task.fieldValues
  function _fv(task, tlId) {
    const t = DataLayer.getTask(task.id);
    if (!t || !t.fieldValues) return '';
    return t.fieldValues[tlId] !== undefined && t.fieldValues[tlId] !== null
      ? t.fieldValues[tlId] : '';
  }

  // ── Generic Editable Field ────────────────────────────────────────────────

  function _makeField(parent, { label, tlId, type, selectOptions, readonly, taskId, onCommit, defaultValue, onRenameLabel }) {
    const row = document.createElement('div');
    row.className = 'detail-field';

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'detail-field-value' + (readonly ? ' readonly' : '');

    function getValue() {
      const t = DataLayer.getTask(taskId);
      if (!t) return defaultValue || '';
      const stored = t.fieldValues ? t.fieldValues[tlId] : undefined;
      return (stored !== undefined && stored !== null && stored !== '') ? stored : (defaultValue || '');
    }

    function showRead() {
      _editingActive = false;
      valueWrapper.innerHTML = '';
      if (type === 'select') {
        // Render select directly so one click opens the dropdown
        showEdit();
        return;
      }
      const val = getValue();
      const span = document.createElement('span');
      span.className = 'detail-field-text' + (val ? '' : ' placeholder');
      if (type === 'textarea' && val) {
        span.style.whiteSpace = 'pre-wrap';
        _renderTextWithLinks(span, val);
      } else {
        span.textContent = val || (readonly ? '—' : '+ add');
      }
      valueWrapper.appendChild(span);
    }

    function showEdit() {
      if (readonly) return;
      _editingActive = true;
      valueWrapper.innerHTML = '';
      const val = getValue();
      let input;

      if (type === 'select') {
        input = document.createElement('select');
        input.className = 'detail-field-select';
        (selectOptions || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt || '—';
          if (opt === val) o.selected = true;
          input.appendChild(o);
        });
        input.addEventListener('change', () => {
          DataLayer.updateTaskField(taskId, tlId, input.value);
          UIHelpers.showSaved();
          if (onCommit) onCommit();
          // Keep select visible — no showRead() round-trip
        });
        input.addEventListener('focus', () => { _editingActive = true; });
        input.addEventListener('blur', () => { _editingActive = false; });
        valueWrapper.appendChild(input);
        return;

      } else if (type === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'detail-field-textarea';
        input.rows = 3;
        input.value = val;
        input.addEventListener('input', () => {
          input.style.height = 'auto';
          input.style.height = input.scrollHeight + 'px';
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { committed = true; input.blur(); showRead(); }
        });
      } else {
        input = document.createElement('input');
        input.className = 'detail-field-input';
        input.type = 'text';
        input.value = val;
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { committed = true; input.blur(); showRead(); }
        });
      }

      let committed = false;
      function commit() {
        if (committed) return;
        committed = true;
        _editingActive = false;
        const newVal = input.value.trim();
        DataLayer.updateTaskField(taskId, tlId, newVal);
        if (newVal) UIHelpers.showSaved();
        if (document.activeElement === input) input.blur();
        showRead();
        if (onCommit) onCommit();
      }

      input.addEventListener('blur', () => {
        setTimeout(() => { if (!committed) commit(); }, 100);
      });

      valueWrapper.appendChild(input);
      setTimeout(() => {
        input.focus();
        if (type === 'textarea') {
          input.style.height = 'auto';
          input.style.height = input.scrollHeight + 'px';
        }
      }, 0);
    }

    if (!readonly) {
      valueWrapper.addEventListener('click', () => {
        if (valueWrapper.querySelector('input, textarea, select')) return;
        showEdit();
      });
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-field-label';
    if (label) {
      if (onRenameLabel) {
        labelEl.appendChild(_makeRenameableLabel(label, onRenameLabel));
      } else {
        labelEl.textContent = label;
      }
    }
    row.appendChild(labelEl);
    row.appendChild(valueWrapper);
    parent.appendChild(row);
    showRead();

    return row;
  }

  // ── Dropdown Field ────────────────────────────────────────────────────────

  function _makeDropdownField(parent, { label, tlId, options, taskId, defaultValue, onRenameLabel }) {
    const row = document.createElement('div');
    row.className = 'detail-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-field-label';
    if (onRenameLabel) {
      labelEl.appendChild(_makeRenameableLabel(label, onRenameLabel));
    } else {
      labelEl.textContent = label;
    }

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'detail-field-value';

    const sel = document.createElement('select');
    sel.className = 'detail-field-select detail-dropdown-field';

    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    });

    function getStoredValue() {
      const t = DataLayer.getTask(taskId);
      if (!t) return defaultValue || '';
      const stored = t.fieldValues ? t.fieldValues[tlId] : undefined;
      return (stored !== undefined && stored !== null && stored !== '') ? stored : (defaultValue || '');
    }

    sel.value = getStoredValue();
    sel.addEventListener('change', () => {
      DataLayer.updateTaskField(taskId, tlId, sel.value);
      UIHelpers.showSaved();
    });
    sel.addEventListener('focus', () => { _editingActive = true; });
    sel.addEventListener('blur', () => { _editingActive = false; });

    valueWrapper.appendChild(sel);
    row.appendChild(labelEl);
    row.appendChild(valueWrapper);
    parent.appendChild(row);
    return row;
  }

  // ── Toggle Field ──────────────────────────────────────────────────────────

  function _makeToggle(parent, { label, tlId, options, taskId, defaultValue, onRenameLabel }) {
    const row = document.createElement('div');
    row.className = 'detail-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-field-label';
    if (onRenameLabel) {
      labelEl.appendChild(_makeRenameableLabel(label, onRenameLabel));
    } else {
      labelEl.textContent = label;
    }

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'detail-field-value readonly';

    function refresh() {
      valueWrapper.innerHTML = '';
      const t = DataLayer.getTask(taskId);
      const stored = t && t.fieldValues ? t.fieldValues[tlId] : undefined;
      const current = stored !== undefined ? stored : (defaultValue || (options[0] ? options[0].value : ''));
      const toggleEl = document.createElement('div');
      toggleEl.className = 'detail-toggle';
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'detail-toggle-btn' + (current === opt.value ? ' active' : '');
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
          DataLayer.updateTaskField(taskId, tlId, opt.value);
          UIHelpers.showSaved();
          refresh();
        });
        toggleEl.appendChild(btn);
      });
      valueWrapper.appendChild(toggleEl);
    }

    row.appendChild(labelEl);
    row.appendChild(valueWrapper);
    parent.appendChild(row);
    refresh();
    return row;
  }

  // ── Link Field ────────────────────────────────────────────────────────────

  function _makeLinkField(parent, { label, tlId, taskId, onRenameLabel }) {
    const row = document.createElement('div');
    row.className = 'detail-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-field-label';
    if (onRenameLabel) {
      labelEl.appendChild(_makeRenameableLabel(label, onRenameLabel));
    } else {
      labelEl.textContent = label;
    }

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'detail-field-value readonly';

    function refresh() {
      valueWrapper.innerHTML = '';
      const t = DataLayer.getTask(taskId);
      const link = t && t.fieldValues ? (t.fieldValues[tlId] || null) : null;
      if (link) {
        const item = document.createElement('div');
        item.className = 'detail-link-item';
        const a = document.createElement('a');
        a.href = link; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = link.replace(/^https?:\/\//, '').slice(0, 38) + (link.length > 42 ? '…' : '');
        a.className = 'detail-field-link';
        a.addEventListener('mouseenter', () => {
          clearTimeout(_linkPopoverTimer);
          _linkPopoverTimer = setTimeout(() => {
            _showLinkPopover(a, link, {
              onEdit: () => {
                const newUrl = window.prompt('Enter URL:', link);
                if (newUrl && newUrl.trim()) {
                  let finalUrl = newUrl.trim();
                  if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
                  DataLayer.updateTaskField(taskId, tlId, finalUrl);
                  UIHelpers.showSaved(); refresh();
                }
              },
              onRemove: () => { DataLayer.updateTaskField(taskId, tlId, null); UIHelpers.showSaved(); refresh(); }
            });
          }, 300);
        });
        a.addEventListener('mouseleave', () => {
          _linkPopoverTimer = setTimeout(() => {
            const pop = document.querySelector('.detail-link-popover');
            if (pop) pop.remove();
          }, 250);
        });
        item.appendChild(a);

        const preview = _getDocPreview(link);
        if (preview) {
          const previewBtn = document.createElement('button');
          previewBtn.className = 'detail-link-preview-btn';
          previewBtn.title = 'Preview document';
          previewBtn.textContent = '👁';
          previewBtn.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            _openDocPreview(link, preview, link.replace(/^https?:\/\//, '').slice(0, 70));
          });
          item.appendChild(previewBtn);
        }

        valueWrapper.appendChild(item);
      } else {
        const addBtn = document.createElement('span');
        addBtn.className = 'detail-link-add';
        addBtn.textContent = '+ add link';
        addBtn.addEventListener('click', () => {
          const url = window.prompt('Enter URL:');
          if (url && url.trim()) {
            let finalUrl = url.trim();
            if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
            DataLayer.updateTaskField(taskId, tlId, finalUrl);
            UIHelpers.showSaved();
            refresh();
          }
        });
        valueWrapper.appendChild(addBtn);
      }
    }

    row.appendChild(labelEl);
    row.appendChild(valueWrapper);
    parent.appendChild(row);
    refresh();
    return row;
  }

  // ── Read-only display field ───────────────────────────────────────────────

  function _makeReadonlyField(parent, { label, getValue }) {
    const row = document.createElement('div');
    row.className = 'detail-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-field-label';
    labelEl.textContent = label;

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'detail-field-value readonly';

    const span = document.createElement('span');
    span.className = 'detail-field-text';
    span.textContent = getValue() || '—';
    valueWrapper.appendChild(span);

    row.appendChild(labelEl);
    row.appendChild(valueWrapper);
    parent.appendChild(row);
    return row;
  }

  // ── Date field (supports single date or start→end range) ─────────────────

  function _makeDateField(parent, { label, tlId, taskId, onRenameLabel }) {
    const row = document.createElement('div');
    row.className = 'detail-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-field-label';
    if (label) {
      if (onRenameLabel) {
        labelEl.appendChild(_makeRenameableLabel(label, onRenameLabel));
      } else {
        labelEl.textContent = label;
      }
    }

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'detail-field-value';

    function getStoredDates() {
      const t = DataLayer.getTask(taskId);
      if (!t || !t.fieldValues) return { startDate: null, endDate: null };
      const v = t.fieldValues[tlId];
      if (!v) return { startDate: null, endDate: null };
      if (typeof v === 'string') return { startDate: v, endDate: null };
      return { startDate: v.startDate || null, endDate: v.endDate || null };
    }

    function formatDisplay(startDate, endDate) {
      if (!startDate) return '';
      const s = Utils.formatDate(startDate);
      const e = endDate ? Utils.formatDate(endDate) : '';
      return e && e !== s ? `${s} → ${e}` : s;
    }

    function refresh() {
      valueWrapper.innerHTML = '';
      const { startDate, endDate } = getStoredDates();
      const hasDate = !!startDate;

      const btn = document.createElement('button');
      btn.className = 'detail-date-field-btn' + (hasDate ? ' has-date' : ' empty');
      btn.textContent = hasDate ? formatDisplay(startDate, endDate) : '+ pick date';
      btn.addEventListener('click', () => {
        Calendar.open(btn, {
          startDate: startDate || null,
          endDate: endDate || null,
          onSelect: ({ startDate: sd, endDate: ed }) => {
            if (!sd) {
              DataLayer.updateTaskField(taskId, tlId, null);
            } else if (ed && ed.toISOString() !== sd.toISOString()) {
              DataLayer.updateTaskField(taskId, tlId, { startDate: sd.toISOString(), endDate: ed.toISOString() });
            } else {
              DataLayer.updateTaskField(taskId, tlId, { startDate: sd.toISOString(), endDate: null });
            }
            UIHelpers.showSaved();
            refresh();
          }
        });
      });
      valueWrapper.appendChild(btn);

      if (hasDate) {
        const clearBtn = document.createElement('span');
        clearBtn.className = 'detail-link-remove';
        clearBtn.textContent = '✕ clear';
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          DataLayer.updateTaskField(taskId, tlId, null);
          UIHelpers.showSaved();
          refresh();
        });
        valueWrapper.appendChild(clearBtn);
      }
    }

    row.appendChild(labelEl);
    row.appendChild(valueWrapper);
    parent.appendChild(row);
    refresh();
    return row;
  }

  // ── Show Time field (composite: time select + Lineup textarea toggle) ─────

  function _makeShowTimeField(parent, taskId, tlId) {
    const row = document.createElement('div');
    row.className = 'detail-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-field-label';
    labelEl.textContent = 'SHOW TIME';

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'detail-field-value readonly';

    function getVal() {
      const t = DataLayer.getTask(taskId);
      const raw = t && t.fieldValues ? t.fieldValues[tlId] : null;
      if (!raw) return { time: '', isLineup: false, lineup: '' };
      if (typeof raw === 'string') return { time: raw, isLineup: false, lineup: '' };
      return raw;
    }

    function saveVal(v) {
      DataLayer.updateTaskField(taskId, tlId, v);
      UIHelpers.showSaved();
    }

    function refresh() {
      valueWrapper.innerHTML = '';
      const v = getVal();

      if (v.isLineup) {
        const ta = document.createElement('textarea');
        ta.className = 'detail-field-textarea';
        ta.rows = 3;
        ta.placeholder = 'One act per line…';
        ta.value = v.lineup || '';
        ta.addEventListener('input', () => {
          ta.style.height = 'auto';
          ta.style.height = ta.scrollHeight + 'px';
        });
        let committed = false;
        function commit() {
          if (committed) return;
          committed = true;
          _editingActive = false;
          saveVal({ ...getVal(), lineup: ta.value });
        }
        ta.addEventListener('focus', () => { _editingActive = true; });
        ta.addEventListener('blur', () => {
          _editingActive = false;
          setTimeout(() => { if (!committed) commit(); }, 100);
        });
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { committed = true; _editingActive = false; refresh(); }
          // Enter inserts a newline naturally; blur saves
        });
        valueWrapper.appendChild(ta);
        setTimeout(() => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }, 0);
      } else {
        const sel = document.createElement('select');
        sel.className = 'detail-field-select';
        const blankOpt = document.createElement('option');
        blankOpt.value = ''; blankOpt.textContent = '—';
        sel.appendChild(blankOpt);
        const lineupOpt = document.createElement('option');
        lineupOpt.value = '__lineup__'; lineupOpt.textContent = 'Lineup';
        sel.appendChild(lineupOpt);
        _timeOptions('').filter(o => o).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          if (opt === v.time) o.selected = true;
          sel.appendChild(o);
        });
        if (!v.time) sel.value = '';
        sel.addEventListener('change', () => {
          if (sel.value === '__lineup__') {
            saveVal({ time: '', isLineup: true, lineup: '' });
          } else {
            saveVal({ time: sel.value, isLineup: false, lineup: '' });
          }
          refresh();
        });
        valueWrapper.appendChild(sel);
      }
    }

    row.appendChild(labelEl);
    row.appendChild(valueWrapper);
    parent.appendChild(row);
    refresh();
    return row;
  }

  // ── Section / Module group builders ──────────────────────────────────────

  // ── Blank task notes ──────────────────────────────────────────────────────

  function _renderBlankNotes(container, task) {
    const wrap = document.createElement('div');
    wrap.className = 'blank-notes-wrap';

    const label = document.createElement('div');
    label.className = 'blank-notes-label';
    label.textContent = 'Notes';
    wrap.appendChild(label);

    const ta = document.createElement('textarea');
    ta.className = 'blank-notes-textarea';
    ta.placeholder = 'Add notes…';
    ta.value = task.listNote || '';
    ta.rows = 5;

    let _debounce = null;
    ta.addEventListener('focus', () => { _editingActive = true; });
    ta.addEventListener('blur', () => {
      _editingActive = false;
      clearTimeout(_debounce);
      DataLayer.updateTask(task.id, { listNote: ta.value });
      UIHelpers.showSaved();
    });
    ta.addEventListener('input', () => {
      clearTimeout(_debounce);
      _debounce = setTimeout(() => DataLayer.updateTask(task.id, { listNote: ta.value }), 400);
    });

    wrap.appendChild(ta);
    container.appendChild(wrap);
  }

  // ── Blank task add controls ───────────────────────────────────────────────

  function _renderBlankAddControls(container, task, editCtx) {
    const bar = document.createElement('div');
    bar.className = 'detail-ts-controls detail-ts-controls--blank';

    const addSectionBtn = document.createElement('button');
    addSectionBtn.className = 'detail-ts-ctrl-btn';
    addSectionBtn.textContent = '+ Add Section';
    addSectionBtn.addEventListener('click', () => _taskAddTS(editCtx, null));
    bar.appendChild(addSectionBtn);

    const addModuleBtn = document.createElement('button');
    addModuleBtn.className = 'detail-ts-ctrl-btn';
    addModuleBtn.textContent = '+ Add Module';
    addModuleBtn.addEventListener('click', () => {
      const t = DataLayer.getTask(editCtx.taskId);
      const sections = (t && t.customSections) || [];
      if (!sections.length) {
        alert('Add a section first, then add modules inside it.');
        return;
      }
      const lastSection = sections[sections.length - 1];
      _taskAddCustomModule(editCtx, lastSection.id);
    });
    bar.appendChild(addModuleBtn);

    const addFieldBtn = document.createElement('button');
    addFieldBtn.className = 'detail-ts-ctrl-btn';
    addFieldBtn.textContent = '+ Add Field';
    addFieldBtn.addEventListener('click', (e) => {
      const t = DataLayer.getTask(editCtx.taskId);
      const sections = (t && t.customSections) || [];
      if (!sections.length) {
        alert('Add a section first, then add fields inside it.');
        return;
      }
      const lastSection = sections[sections.length - 1];
      const flatTm = (lastSection.modules || []).find(m => m.name === '');
      if (flatTm) {
        _taskAddFieldToCustomTm(editCtx, lastSection.id, flatTm.id, e.currentTarget);
      } else {
        _taskAddFieldAtTSLevel(editCtx, lastSection.id, e.currentTarget);
      }
    });
    bar.appendChild(addFieldBtn);

    container.appendChild(bar);
  }

  // ── Sub-Tasks section ─────────────────────────────────────────────────────

  // ── Shared comment bubble builder ──────────────────────────────────────────
  function _makeCommentBubble(c, onAcknowledge) {
    const isMine = c.sender === CURRENT_USER;
    const wrap = document.createElement('div');
    wrap.className = 'comment-bubble-wrap' + (isMine ? ' mine' : '');
    const bubble = document.createElement('div');
    bubble.className = 'comment-bubble' + (isMine ? ' mine' : '');
    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    const senderSpan = document.createElement('span');
    senderSpan.className = 'comment-sender';
    senderSpan.textContent = c.sender;
    const tsSpan = document.createElement('span');
    tsSpan.className = 'comment-ts';
    if (c.timestamp) {
      const d = new Date(c.timestamp);
      tsSpan.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    meta.appendChild(senderSpan);
    meta.appendChild(tsSpan);
    bubble.appendChild(meta);
    if (c.text) {
      const body = document.createElement('div');
      body.className = 'comment-body';
      _renderTextWithLinks(body, c.text);
      bubble.appendChild(body);
    }
    (c.attachments || []).forEach(att => {
      if (att.type === 'image') {
        const img = document.createElement('img');
        img.src = att.dataUrl; img.className = 'comment-img'; img.alt = att.name;
        bubble.appendChild(img);
      } else {
        const link = document.createElement('a');
        link.href = att.dataUrl; link.download = att.name;
        link.className = 'comment-file-link'; link.textContent = '📄 ' + att.name;
        bubble.appendChild(link);
      }
    });
    // Thumbs-up button for comments from others
    if (!isMine) {
      const thumbsUps = c.thumbsUps || [];
      const iAcked = thumbsUps.includes(CURRENT_USER);
      const ackRow = document.createElement('div');
      ackRow.className = 'comment-ack-row';
      const ackBtn = document.createElement('button');
      ackBtn.className = 'comment-ack-btn' + (iAcked ? ' acked' : '');
      ackBtn.textContent = iAcked ? '👍 ' + thumbsUps.length : '👍';
      ackBtn.title = iAcked ? 'Acknowledged' : 'Acknowledge';
      if (!iAcked && onAcknowledge) {
        ackBtn.addEventListener('click', () => onAcknowledge(c.id));
      } else {
        ackBtn.disabled = true;
      }
      ackRow.appendChild(ackBtn);
      bubble.appendChild(ackRow);
    }
    wrap.appendChild(bubble);
    return wrap;
  }

  // ── Shared comment input area factory ──────────────────────────────────────
  function _makeCommentInputArea(taskId, onSent) {
    const inputWrap = document.createElement('div');
    inputWrap.className = 'comment-input-wrap';

    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '*/*'; fileInput.multiple = true;
    fileInput.style.display = 'none';
    inputWrap.appendChild(fileInput);

    const pendingPreview = document.createElement('div');
    pendingPreview.className = 'comment-pending-preview';
    inputWrap.appendChild(pendingPreview);

    const inputRow = document.createElement('div');
    inputRow.className = 'comment-input-row';
    inputWrap.appendChild(inputRow);

    const attachBtn = document.createElement('button');
    attachBtn.className = 'comment-attach-btn';
    attachBtn.textContent = '📎';
    attachBtn.title = 'Attach file or image';
    inputRow.appendChild(attachBtn);

    const textarea = document.createElement('textarea');
    textarea.className = 'comment-input';
    textarea.placeholder = 'Write a comment…';
    textarea.rows = 1;
    inputRow.appendChild(textarea);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'comment-send-btn';
    sendBtn.textContent = 'Send';
    inputRow.appendChild(sendBtn);

    let _pending = [];

    function _renderPending() {
      pendingPreview.innerHTML = '';
      _pending.forEach((att, i) => {
        const item = document.createElement('div');
        item.className = 'comment-pending-item';
        if (att.type === 'image') {
          const img = document.createElement('img');
          img.src = att.dataUrl; img.className = 'comment-pending-thumb';
          item.appendChild(img);
        }
        const name = document.createElement('span');
        name.className = 'comment-pending-name'; name.textContent = att.name;
        item.appendChild(name);
        const rm = document.createElement('button');
        rm.className = 'comment-pending-rm'; rm.textContent = '✕';
        rm.addEventListener('click', () => { _pending.splice(i, 1); _renderPending(); });
        item.appendChild(rm);
        pendingPreview.appendChild(item);
      });
    }

    function _send() {
      const text = textarea.value.trim();
      if (!text && !_pending.length) return;
      const t = DataLayer.getTask(taskId);
      if (!t) return;
      const comment = {
        id: Utils.generateId(), sender: CURRENT_USER, text,
        timestamp: new Date().toISOString(), attachments: _pending.slice(),
        thumbsUps: []
      };
      DataLayer.updateTask(taskId, { comments: [...(t.comments || []), comment] });
      textarea.value = ''; textarea.style.height = '';
      _pending = []; _renderPending();
      onSent();
    }

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); }
    });
    textarea.addEventListener('focus', () => { _editingActive = true; });
    textarea.addEventListener('blur', () => { setTimeout(() => { _editingActive = false; }, 100); });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    sendBtn.addEventListener('click', _send);
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      let remaining = files.length;
      if (!remaining) return;
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          _pending.push({
            id: Utils.generateId(), name: file.name,
            type: file.type.startsWith('image/') ? 'image' : 'file',
            dataUrl: ev.target.result
          });
          if (--remaining === 0) _renderPending();
        };
        reader.readAsDataURL(file);
      });
      fileInput.value = '';
    });

    return inputWrap;
  }

  function _renderCommentSection(container, task) {
    const section = document.createElement('div');
    section.className = 'comment-section';
    container.appendChild(section);

    const countLink = document.createElement('button');
    countLink.className = 'comment-count-link';
    countLink.addEventListener('click', () => _openCommentPane(task));
    section.appendChild(countLink);

    function updateCount() {
      const t = DataLayer.getTask(task.id);
      const n = t ? (t.comments || []).length : 0;
      countLink.textContent = n === 0 ? 'No comments yet' : n === 1 ? '1 Comment' : `${n} Comments`;
    }

    _refreshInlineComments = updateCount;

    section.appendChild(_makeCommentInputArea(task.id, () => {
      updateCount();
      if (_refreshPaneComments) _refreshPaneComments();
    }));

    updateCount();
  }

  function _renderTaskReminderField(container, task) {
    const wrap = document.createElement('div');
    wrap.className = 'detail-task-reminder';

    function refreshDisplay() {
      wrap.innerHTML = '';
      wrap.classList.remove('detail-task-reminder--editing');
      const t = DataLayer.getTask(task.id);
      const last = t && t.lastReminderByPanel;
      if (last) {
        const sent = document.createElement('span');
        sent.className = 'detail-reminder-sent';
        sent.textContent = last.text;
        wrap.appendChild(sent);
      } else {
        const ph = document.createElement('span');
        ph.className = 'detail-reminder-placeholder';
        ph.textContent = '+ add reminder';
        wrap.appendChild(ph);
      }
      wrap.addEventListener('click', startEdit, { once: true });
    }

    function startEdit() {
      if (wrap.querySelector('input')) return;
      wrap.innerHTML = '';
      wrap.classList.add('detail-task-reminder--editing');

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'detail-reminder-input';
      input.placeholder = 'Add a reminder…';
      wrap.appendChild(input);

      const strip = document.createElement('div');
      strip.className = 'prio-strip';
      strip.style.display = 'none';
      [
        { id: 'urgent_important',     label: 'Urgent',     cls: 'urgent-important'     },
        { id: 'important_not_urgent', label: 'Important',  cls: 'important-not-urgent' },
        { id: 'urgent_not_important', label: 'Must do',    cls: 'urgent-not-important' },
        { id: 'quick_info',           label: 'Info',       cls: 'quick-info'           }
      ].forEach(({ id, label, cls }) => {
        const btn = document.createElement('button');
        btn.className = 'prio-dot-btn prio-dot-btn--' + cls;
        btn.textContent = label;
        btn.title = _PRIO[id].label;
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => commitNote(id));
        strip.appendChild(btn);
      });
      wrap.appendChild(strip);

      let committed = false;

      function commitNote(priority) {
        if (committed) return;
        committed = true;
        strip.style.display = 'none';
        const text = input.value.trim();
        if (text) {
          const t = DataLayer.getTask(task.id);
          const notes = t && t.listNotes ? [...t.listNotes] : [];
          const noteId = Utils.generateId();
          notes.push({ id: noteId, text, timestamp: new Date().toISOString(), done: false, source: 'panel', priority: priority || null });
          DataLayer.updateTask(task.id, { listNotes: notes, lastReminderByPanel: { noteId, text } });
          Utils.EventBus.emit('todo:updated');
        }
        refreshDisplay();
      }

      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); commitNote(null); }
        if (ev.key === 'Escape') { committed = true; refreshDisplay(); }
      });
      input.addEventListener('focus', () => { strip.style.display = 'flex'; _editingActive = true; });
      input.addEventListener('blur', () => {
        setTimeout(() => { strip.style.display = 'none'; _editingActive = false; }, 200);
        setTimeout(() => commitNote(null), 250);
      });
      setTimeout(() => input.focus(), 0);
    }

    refreshDisplay();
    container.appendChild(wrap);
  }

  function _acknowledgeComment(taskId, commentId) {
    const t = DataLayer.getTask(taskId);
    if (!t) return;
    const updatedComments = (t.comments || []).map(c => {
      if (c.id !== commentId) return c;
      const tu = [...(c.thumbsUps || [])];
      if (!tu.includes(CURRENT_USER)) tu.push(CURRENT_USER);
      return Object.assign({}, c, { thumbsUps: tu });
    });
    DataLayer.updateTask(taskId, { comments: updatedComments });
    if (_refreshPaneComments) _refreshPaneComments();
    Utils.EventBus.emit('todo:updated');
    Utils.EventBus.emit('listview:refresh');
  }

  function _openCommentPane(task) {
    const pane = document.getElementById('comment-pane');
    if (!pane) return;

    pane.innerHTML = '';
    pane.dataset.taskId = task.id;

    const hdr = document.createElement('div');
    hdr.className = 'comment-pane-header';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'comment-pane-close';
    closeBtn.textContent = '‹';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => {
      document.getElementById('app').classList.remove('comment-pane-open');
      _refreshPaneComments = null;
      const detailBottom = document.getElementById('detail-bottom');
      if (detailBottom) detailBottom.style.display = '';
    });
    hdr.appendChild(closeBtn);
    const title = document.createElement('span');
    title.textContent = 'Comments';
    hdr.appendChild(title);
    pane.appendChild(hdr);

    const thread = document.createElement('div');
    thread.className = 'comment-pane-thread';
    pane.appendChild(thread);

    function renderPane() {
      thread.innerHTML = '';
      const t = DataLayer.getTask(task.id);
      const ack = (commentId) => _acknowledgeComment(task.id, commentId);
      (t ? (t.comments || []) : []).forEach(c => thread.appendChild(_makeCommentBubble(c, ack)));
      thread.scrollTop = thread.scrollHeight;
    }

    _refreshPaneComments = renderPane;

    pane.appendChild(_makeCommentInputArea(task.id, () => {
      renderPane();
      if (_refreshInlineComments) _refreshInlineComments();
    }));

    renderPane();

    // Hide inline comment section — all comments are now in the pane
    const detailBottom = document.getElementById('detail-bottom');
    if (detailBottom) detailBottom.style.display = 'none';

    document.getElementById('app').classList.add('comment-pane-open');
  }

  function openCommentPane(taskId) {
    const task = DataLayer.getTask(taskId);
    if (task) _openCommentPane(task);
  }

  function getCurrentUser() { return CURRENT_USER; }

  // ── Per-task structure helpers ────────────────────────────────────────────

  function _makeInlineDeleteBtn(onClick) {
    const btn = document.createElement('button');
    btn.className = 'detail-inline-delete-btn';
    btn.textContent = '✕';
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  function _getItemLabel(id, task, fallback) {
    const t = typeof task === 'string' ? DataLayer.getTask(task) : DataLayer.getTask(task.id);
    if (t && t.labelOverrides && t.labelOverrides[id]) return t.labelOverrides[id];
    return fallback;
  }

  function _taskRenameLabel(taskId, itemId, newName) {
    const t = DataLayer.getTask(taskId);
    if (!t) return;
    DataLayer.updateTask(taskId, { labelOverrides: Object.assign({}, t.labelOverrides || {}, { [itemId]: newName }) });
  }

  function _taskAddTS(editCtx, afterTsId = null) {
    const name = window.prompt('Section name:');
    if (!name || !name.trim()) return;
    const t = DataLayer.getTask(editCtx.taskId);
    if (!t) return;
    const newSection = {
      id: Utils.generateId(), name: name.trim(), defaultOpen: true,
      modules: [{ id: Utils.generateId(), name: '', defaultOpen: true, fields: [] }]
    };
    let customSections = [...(t.customSections || [])];
    if (afterTsId) {
      const idx = customSections.findIndex(s => s.id === afterTsId);
      if (idx >= 0) {
        customSections.splice(idx + 1, 0, newSection);
      } else {
        customSections.push(newSection); // afterTsId is a template TS — append after all template TSs
      }
    } else {
      customSections.push(newSection);
    }
    DataLayer.updateTask(editCtx.taskId, { customSections });
    UIHelpers.showSaved();
    editCtx.onModified();
  }

  function _taskDeleteCustomSection(editCtx, sectionId) {
    if (!window.confirm('Remove this section from this task?')) return;
    const t = DataLayer.getTask(editCtx.taskId);
    if (!t) return;
    DataLayer.updateTask(editCtx.taskId, { customSections: (t.customSections || []).filter(s => s.id !== sectionId) });
    UIHelpers.showSaved();
    editCtx.onModified();
  }

  function _taskAddCustomModule(editCtx, parentTsId) {
    const name = window.prompt('Module name:');
    if (!name || !name.trim()) return;
    const t = DataLayer.getTask(editCtx.taskId);
    if (!t) return;
    const newMod = { id: Utils.generateId(), name: name.trim(), defaultOpen: true, parentTsId, fields: [] };
    DataLayer.updateTask(editCtx.taskId, { customModules: [...(t.customModules || []), newMod] });
    UIHelpers.showSaved();
    editCtx.onModified();
  }

  function _taskDeleteCustomModule(editCtx, moduleId) {
    if (!window.confirm('Remove this module from this task?')) return;
    const t = DataLayer.getTask(editCtx.taskId);
    if (!t) return;
    DataLayer.updateTask(editCtx.taskId, { customModules: (t.customModules || []).filter(m => m.id !== moduleId) });
    UIHelpers.showSaved();
    editCtx.onModified();
  }

  function _taskAddCustomField(editCtx, parentTmId, anchorEl) {
    _showFieldTypePicker(anchorEl, (type, cfg = {}) => {
      const name = window.prompt('Field name:');
      if (!name || !name.trim()) return;
      const t = DataLayer.getTask(editCtx.taskId);
      if (!t) return;
      const newField = { id: Utils.generateId(), name: name.trim(), type, ...cfg, parentTmId };
      DataLayer.updateTask(editCtx.taskId, { customFields: [...(t.customFields || []), newField] });
      UIHelpers.showSaved();
      editCtx.onModified();
    });
  }

  function _taskAddFieldAtTSLevel(editCtx, parentTsId, anchorEl) {
    _showFieldTypePicker(anchorEl, (type, cfg = {}) => {
      const name = window.prompt('Field name:');
      if (!name || !name.trim()) return;
      const t = DataLayer.getTask(editCtx.taskId);
      if (!t) return;
      const existing = (t.customModules || []).find(m => m.parentTsId === parentTsId && m.name === '');
      const newField = { id: Utils.generateId(), name: name.trim(), type, ...cfg };
      if (existing) {
        DataLayer.updateTask(editCtx.taskId, {
          customModules: (t.customModules || []).map(m =>
            m.id === existing.id ? { ...m, fields: [...(m.fields || []), newField] } : m
          )
        });
      } else {
        const newMod = { id: Utils.generateId(), name: '', defaultOpen: true, parentTsId, fields: [newField] };
        DataLayer.updateTask(editCtx.taskId, { customModules: [...(t.customModules || []), newMod] });
      }
      UIHelpers.showSaved();
      editCtx.onModified();
    });
  }

  function _taskAddFieldToCustomTm(editCtx, sectionId, moduleId, anchorEl) {
    _showFieldTypePicker(anchorEl, (type, cfg = {}) => {
      const name = window.prompt('Field name:');
      if (!name || !name.trim()) return;
      const t = DataLayer.getTask(editCtx.taskId);
      if (!t) return;
      const newField = { id: Utils.generateId(), name: name.trim(), type, ...cfg };
      DataLayer.updateTask(editCtx.taskId, {
        customSections: (t.customSections || []).map(s => s.id !== sectionId ? s : {
          ...s, modules: (s.modules || []).map(m => m.id !== moduleId ? m : {
            ...m, fields: [...(m.fields || []), newField]
          })
        })
      });
      UIHelpers.showSaved();
      editCtx.onModified();
    });
  }

  function _taskAddFieldToCustomModule(editCtx, moduleId, anchorEl) {
    _showFieldTypePicker(anchorEl, (type, cfg = {}) => {
      const name = window.prompt('Field name:');
      if (!name || !name.trim()) return;
      const t = DataLayer.getTask(editCtx.taskId);
      if (!t) return;
      const newField = { id: Utils.generateId(), name: name.trim(), type, ...cfg };
      DataLayer.updateTask(editCtx.taskId, {
        customModules: (t.customModules || []).map(m => m.id !== moduleId ? m : {
          ...m, fields: [...(m.fields || []), newField]
        })
      });
      UIHelpers.showSaved();
      editCtx.onModified();
    });
  }

  function _deleteCustomField(editCtx, fieldId) {
    if (!window.confirm('Remove this field from this task?')) return;
    const t = DataLayer.getTask(editCtx.taskId);
    if (!t) return;

    if ((t.customFields || []).some(f => f.id === fieldId)) {
      DataLayer.updateTask(editCtx.taskId, { customFields: t.customFields.filter(f => f.id !== fieldId) });
      UIHelpers.showSaved(); editCtx.onModified(); return;
    }
    if ((t.customModules || []).some(m => (m.fields || []).some(f => f.id === fieldId))) {
      DataLayer.updateTask(editCtx.taskId, {
        customModules: t.customModules.map(m => ({
          ...m, fields: (m.fields || []).filter(f => f.id !== fieldId)
        }))
      });
      UIHelpers.showSaved(); editCtx.onModified(); return;
    }
    DataLayer.updateTask(editCtx.taskId, {
      customSections: (t.customSections || []).map(s => ({
        ...s, modules: (s.modules || []).map(m => ({ ...m, fields: (m.fields || []).filter(f => f.id !== fieldId) }))
      }))
    });
    UIHelpers.showSaved();
    editCtx.onModified();
  }

  function _renameCustomField(taskId, fieldId, newName) {
    const t = DataLayer.getTask(taskId);
    if (!t) return;
    if ((t.customFields || []).some(f => f.id === fieldId)) {
      DataLayer.updateTask(taskId, { customFields: t.customFields.map(f => f.id === fieldId ? { ...f, name: newName } : f) });
      return;
    }
    if ((t.customModules || []).some(m => (m.fields || []).some(f => f.id === fieldId))) {
      DataLayer.updateTask(taskId, {
        customModules: t.customModules.map(m => ({ ...m, fields: (m.fields || []).map(f => f.id === fieldId ? { ...f, name: newName } : f) }))
      });
      return;
    }
    DataLayer.updateTask(taskId, {
      customSections: (t.customSections || []).map(s => ({
        ...s, modules: (s.modules || []).map(m => ({ ...m, fields: (m.fields || []).map(f => f.id === fieldId ? { ...f, name: newName } : f) }))
      }))
    });
  }

  function _makeRenameableLabel(label, onRename) {
    const wrap = document.createElement('span');
    wrap.className = 'detail-label-wrap';
    const text = document.createElement('span');
    text.className = 'detail-label-text';
    text.textContent = label;
    const editBtn = document.createElement('button');
    editBtn.className = 'detail-rename-btn';
    editBtn.textContent = '✎';
    editBtn.title = 'Rename';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.className = 'detail-rename-input';
      input.type = 'text';
      input.value = text.textContent;
      wrap.innerHTML = '';
      wrap.appendChild(input);
      input.focus(); input.select();
      let done = false;
      function finish() {
        if (done) return; done = true;
        const val = input.value.trim() || label;
        text.textContent = val;
        onRename(val);
        wrap.innerHTML = '';
        wrap.appendChild(text);
        wrap.appendChild(editBtn);
      }
      input.addEventListener('blur', finish);
      input.addEventListener('click', (ev) => ev.stopPropagation());
      input.addEventListener('keydown', (kev) => {
        if (kev.key === 'Enter') { kev.preventDefault(); finish(); }
        if (kev.key === 'Escape') { done = true; wrap.innerHTML = ''; wrap.appendChild(text); wrap.appendChild(editBtn); }
      });
    });
    wrap.appendChild(text);
    wrap.appendChild(editBtn);
    return wrap;
  }

  function _renderTextWithLinks(el, text) {
    const URL_RE = /(https?:\/\/[^\s<>"]+)/g;
    let lastIndex = 0; let match;
    while ((match = URL_RE.exec(text)) !== null) {
      if (match.index > lastIndex) el.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      const url = match[1];
      const a = document.createElement('a');
      a.href = url; a.textContent = url;
      a.target = '_blank'; a.rel = 'noopener'; a.className = 'detail-field-link';
      a.addEventListener('mouseenter', () => {
        clearTimeout(_linkPopoverTimer);
        _linkPopoverTimer = setTimeout(() => _showLinkPopover(a, url, {}), 300);
      });
      a.addEventListener('mouseleave', () => {
        _linkPopoverTimer = setTimeout(() => { const p = document.querySelector('.detail-link-popover'); if (p) p.remove(); }, 250);
      });
      el.appendChild(a);
      lastIndex = match.index + url.length;
    }
    if (lastIndex < text.length) el.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  function _showFieldTypePicker(anchorEl, onPick) {
    const existing = document.querySelector('.detail-type-picker');
    if (existing) existing.remove();

    const TYPES = [
      { value: 'text',     label: 'Text (single line)' },
      { value: 'textarea', label: 'Text (multi-line)' },
      { value: 'link',     label: 'Link' },
      { value: 'date',     label: 'Date' },
      { value: 'toggle',   label: 'Toggle' },
      { value: 'dropdown', label: 'Dropdown' },
    ];

    const picker = document.createElement('div');
    picker.className = 'detail-type-picker';
    const lbl = document.createElement('div');
    lbl.className = 'detail-type-picker-label';
    lbl.textContent = 'Field type:';
    picker.appendChild(lbl);

    TYPES.forEach(ft => {
      const btn = document.createElement('button');
      btn.className = 'detail-type-picker-item';
      btn.textContent = ft.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.removeEventListener('click', dismiss, true);
        if (ft.value === 'toggle') {
          _showToggleOptionsStep(picker, (toggleOptions) => {
            picker.remove();
            onPick('toggle', { toggleOptions });
          }, () => {
            picker.remove();
          });
        } else {
          picker.remove();
          onPick(ft.value);
        }
      });
      picker.appendChild(btn);
    });

    document.body.appendChild(picker);

    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      picker.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;`;
    } else {
      picker.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);';
    }

    function dismiss(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', dismiss, true); }
    }
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  function _showToggleOptionsStep(picker, onConfirm, onCancel) {
    picker.innerHTML = '';

    const lbl = document.createElement('div');
    lbl.className = 'detail-type-picker-label';
    lbl.textContent = 'Toggle options:';
    picker.appendChild(lbl);

    const optList = document.createElement('div');
    optList.className = 'detail-toggle-opts-list';
    picker.appendChild(optList);

    const opts = ['No', 'Yes'];

    function renderOpts() {
      optList.innerHTML = '';
      opts.forEach((opt, i) => {
        const row = document.createElement('div');
        row.className = 'detail-toggle-opt-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'detail-toggle-opt-input';
        input.value = opt;
        input.addEventListener('input', () => { opts[i] = input.value; });

        const rmBtn = document.createElement('button');
        rmBtn.className = 'detail-toggle-opt-rm';
        rmBtn.textContent = '✕';
        rmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.splice(i, 1);
          renderOpts();
        });

        row.appendChild(input);
        row.appendChild(rmBtn);
        optList.appendChild(row);
      });
    }
    renderOpts();

    const addBtn = document.createElement('button');
    addBtn.className = 'detail-type-picker-item';
    addBtn.textContent = '+ Add option';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.push('');
      renderOpts();
      const inputs = optList.querySelectorAll('.detail-toggle-opt-input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    picker.appendChild(addBtn);

    const actions = document.createElement('div');
    actions.className = 'detail-toggle-opts-actions';
    picker.appendChild(actions);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'detail-type-picker-item';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); onCancel(); });
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'detail-type-picker-confirm';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const valid = opts.map(o => o.trim()).filter(Boolean);
      if (!valid.length) { alert('Add at least one option.'); return; }
      onConfirm(valid);
    });
    actions.appendChild(confirmBtn);
  }

  // ── Document / PDF inline preview ────────────────────────────────────────

  function _getDocPreview(url) {
    if (!url) return null;

    const gdoc = url.match(/docs\.google\.com\/document\/d\/([^\/?\s#]+)/);
    if (gdoc) return { embedUrl: 'https://docs.google.com/document/d/' + gdoc[1] + '/preview', type: 'gdoc' };

    const gsheet = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/?\s#]+)/);
    if (gsheet) return { embedUrl: 'https://docs.google.com/spreadsheets/d/' + gsheet[1] + '/preview?usp=sharing', type: 'gsheet' };

    const gdrive = url.match(/drive\.google\.com\/file\/d\/([^\/?\s#]+)/);
    if (gdrive) return { embedUrl: 'https://drive.google.com/file/d/' + gdrive[1] + '/preview', type: 'gdrive' };

    if (/dropbox\.com\/s\//.test(url)) {
      return { embedUrl: url.split('?')[0] + '?raw=1', type: 'dropbox' };
    }

    if (/onedrive\.live\.com\//.test(url) || /1drv\.ms\//.test(url)) {
      return { embedUrl: url, type: 'onedrive' };
    }

    if (/\.pdf(\?|#|$)/i.test(url) || /\/pdf\//i.test(url)) {
      return { embedUrl: url, type: 'pdf' };
    }

    return null;
  }

  function _openDocPreview(url, previewInfo, label) {
    const existing = document.getElementById('doc-preview-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'doc-preview-overlay';
    overlay.className = 'doc-preview-overlay';

    const modal = document.createElement('div');
    modal.className = 'doc-preview-modal';
    modal.addEventListener('click', e => e.stopPropagation());

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'doc-preview-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'doc-preview-title';
    const display = label || url;
    titleEl.textContent = display.length > 70 ? display.slice(0, 70) + '…' : display;
    titleEl.title = url;
    hdr.appendChild(titleEl);

    const hdrActions = document.createElement('div');
    hdrActions.className = 'doc-preview-header-actions';

    const openBtn = document.createElement('a');
    openBtn.className = 'doc-preview-open-btn';
    openBtn.href = url; openBtn.target = '_blank'; openBtn.rel = 'noopener';
    openBtn.textContent = '↗ Open in browser';
    hdrActions.appendChild(openBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'doc-preview-close';
    closeBtn.textContent = '✕';
    hdr.appendChild(hdrActions);
    modal.appendChild(hdr);

    // Body
    const body = document.createElement('div');
    body.className = 'doc-preview-body';

    const iframe = document.createElement('iframe');
    iframe.className = 'doc-preview-frame';
    iframe.src = previewInfo.embedUrl;
    iframe.setAttribute('allowfullscreen', '');

    const fallback = document.createElement('div');
    fallback.className = 'doc-preview-fallback';
    fallback.style.display = 'none';
    const fallbackMsg = document.createElement('p');
    fallbackMsg.textContent = 'This document requires access permissions — click to open in your browser instead.';
    const fallbackLink = document.createElement('a');
    fallbackLink.href = url; fallbackLink.target = '_blank'; fallbackLink.rel = 'noopener';
    fallbackLink.textContent = 'Open externally →';
    fallback.appendChild(fallbackMsg);
    fallback.appendChild(fallbackLink);

    iframe.addEventListener('error', () => { iframe.style.display = 'none'; fallback.style.display = ''; });

    body.appendChild(iframe);
    body.appendChild(fallback);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
    }
    function handleKey(e) { if (e.key === 'Escape') close(); }
    closeBtn.addEventListener('click', close);
    hdrActions.appendChild(closeBtn);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', handleKey);
  }

  function _showLinkPopover(anchorEl, url, { onEdit, onRemove }) {
    clearTimeout(_linkPopoverTimer);
    const existing = document.querySelector('.detail-link-popover');
    if (existing) existing.remove();

    const pop = document.createElement('div');
    pop.className = 'detail-link-popover';

    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'detail-link-popover-url';
    urlDisplay.textContent = url.length > 50 ? url.slice(0, 50) + '…' : url;
    pop.appendChild(urlDisplay);

    const actions = document.createElement('div');
    actions.className = 'detail-link-popover-actions';

    const openBtn = document.createElement('a');
    openBtn.className = 'detail-link-popover-btn';
    openBtn.href = url; openBtn.target = '_blank'; openBtn.rel = 'noopener';
    openBtn.textContent = '↗ Open';
    actions.appendChild(openBtn);

    if (onEdit) {
      const editBtn = document.createElement('button');
      editBtn.className = 'detail-link-popover-btn';
      editBtn.textContent = '✎ Edit';
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); pop.remove(); onEdit(); });
      actions.appendChild(editBtn);
    }
    if (onRemove) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'detail-link-popover-btn detail-link-popover-btn--danger';
      removeBtn.textContent = '✕ Remove';
      removeBtn.addEventListener('click', (e) => { e.stopPropagation(); pop.remove(); onRemove(); });
      actions.appendChild(removeBtn);
    }
    pop.appendChild(actions);
    document.body.appendChild(pop);

    const rect = anchorEl.getBoundingClientRect();
    pop.style.cssText = `position:fixed;top:${rect.bottom + 5}px;left:${Math.max(4, rect.left)}px;`;

    pop.addEventListener('mouseenter', () => clearTimeout(_linkPopoverTimer));
    pop.addEventListener('mouseleave', () => {
      _linkPopoverTimer = setTimeout(() => pop.remove(), 250);
    });

    setTimeout(() => {
      function dismiss(e) { if (!pop.contains(e.target) && e.target !== anchorEl) { pop.remove(); document.removeEventListener('click', dismiss, true); } }
      document.addEventListener('click', dismiss, true);
    }, 0);
  }

  function _addSectionGroup(container, title, key, defaultOpen, onRename) {
    const group = document.createElement('div');
    group.className = 'detail-section-group';

    const isOpen = key
      ? (_sectionOpen[key] !== undefined ? _sectionOpen[key] : (defaultOpen !== undefined ? defaultOpen : true))
      : true;
    if (!isOpen) group.classList.add('collapsed');

    const heading = document.createElement('div');
    heading.className = 'detail-section-heading';

    const chevron = document.createElement('span');
    chevron.className = 'section-chevron' + (isOpen ? ' open' : '');
    chevron.textContent = '›';
    heading.appendChild(chevron);

    if (onRename) {
      heading.appendChild(_makeRenameableHeading(title, onRename, 'detail-section-heading-title'));
    } else {
      const titleSpan = document.createElement('span');
      titleSpan.textContent = title;
      heading.appendChild(titleSpan);
    }

    heading.addEventListener('click', () => {
      const collapsed = group.classList.toggle('collapsed');
      chevron.classList.toggle('open', !collapsed);
      if (key) _sectionOpen[key] = !collapsed;
    });

    group.appendChild(heading);
    container.appendChild(group);
    return group;
  }

  function _addModuleGroup(container, title, key, defaultOpen, onRename) {
    const group = document.createElement('div');
    group.className = 'detail-module-group';
    if (key) group.dataset.tmId = key;

    const isOpen = key
      ? (_sectionOpen[key] !== undefined ? _sectionOpen[key] : (defaultOpen !== undefined ? defaultOpen : false))
      : true;
    if (!isOpen) group.classList.add('collapsed');

    const heading = document.createElement('div');
    heading.className = 'detail-module-heading';

    const chevron = document.createElement('span');
    chevron.className = 'section-chevron' + (isOpen ? ' open' : '');
    chevron.textContent = '›';
    heading.appendChild(chevron);

    if (onRename) {
      heading.appendChild(_makeRenameableHeading(title, onRename, 'detail-module-heading-title'));
    } else {
      const titleSpan = document.createElement('span');
      titleSpan.textContent = title;
      heading.appendChild(titleSpan);
    }

    heading.addEventListener('click', () => {
      const collapsed = group.classList.toggle('collapsed');
      chevron.classList.toggle('open', !collapsed);
      if (key) _sectionOpen[key] = !collapsed;
    });

    group.appendChild(heading);
    container.appendChild(group);
    return group;
  }

  function _makeRenameableHeading(title, onRename, cls) {
    const wrap = document.createElement('span');
    wrap.className = cls || '';
    const text = document.createElement('span');
    text.className = 'detail-heading-title-text';
    text.textContent = title;
    const editBtn = document.createElement('button');
    editBtn.className = 'detail-rename-btn detail-rename-btn--heading';
    editBtn.textContent = '✎';
    editBtn.title = 'Rename';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.className = 'detail-rename-input';
      input.type = 'text';
      input.value = text.textContent;
      wrap.innerHTML = '';
      wrap.appendChild(input);
      input.focus(); input.select();
      let done = false;
      function finish() {
        if (done) return; done = true;
        const val = input.value.trim() || title;
        text.textContent = val;
        onRename(val);
        wrap.innerHTML = '';
        wrap.appendChild(text);
        wrap.appendChild(editBtn);
      }
      input.addEventListener('blur', finish);
      input.addEventListener('click', (ev) => ev.stopPropagation());
      input.addEventListener('keydown', (kev) => {
        if (kev.key === 'Enter') { kev.preventDefault(); finish(); }
        if (kev.key === 'Escape') { done = true; wrap.innerHTML = ''; wrap.appendChild(text); wrap.appendChild(editBtn); }
      });
    });
    wrap.appendChild(text);
    wrap.appendChild(editBtn);
    return wrap;
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────

  function _navigateTask(direction) {
    const activeId = DataLayer.getActiveTaskId();
    if (!activeId) return;
    const projectId = DataLayer.getActiveProjectId();
    if (!projectId) return;
    const tasks = DataLayer.getSections(projectId).flatMap(s => s.tasks);
    const idx = tasks.findIndex(t => t.id === activeId);
    if (idx === -1) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= tasks.length) return;
    DataLayer.setActiveTaskId(tasks[nextIdx].id);
    Utils.EventBus.emit('task:selected', tasks[nextIdx].id);
    ListView.render();
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const panel = document.getElementById('detail-panel');
      if (!panel || panel.classList.contains('hidden')) return;
      if (!DataLayer.getActiveTaskId()) return;
      if (_editingActive) return;
      const active = document.activeElement;
      if (active && active.offsetParent !== null) {
        const tag = active.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (active.isContentEditable) return;
      }
      e.preventDefault();
      _navigateTask(e.key === 'ArrowDown' ? 1 : -1);
    });
  }

  return { render, hide, init, getCommentReadTime, getCurrentUser, openCommentPane };
})();
