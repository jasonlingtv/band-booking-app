// dashboard.js — Template management dashboard (Settings screen)
const Dashboard = (() => {
  'use strict';

  let _draft = null;        // deep clone of template being edited; null when on list view
  let _editingId = null;    // id of template being edited; null for a new template
  let _isNewDefault = false; // true when creating a new default template
  let _dashTab = 'templates'; // 'templates' | 'todo' (Overview) | 'news' | 'socials'
  let _todoTimer = null;
  let _hoverShowTimer = null;
  let _hoverHideTimer = null;
  let _mouseInPanel = false;
  let _previewTaskId = null;     // task id being previewed on hover (To Do tab)
  let _previewTemplateId = null; // template id being previewed on hover (Templates tab)
  let _previewEl = null;         // live-preview column el (editor mode)
  let _refreshEditorPreview = null; // fn that rebuilds _previewEl from _draft
  let _pendingNewIds = new Set(); // IDs of items just added, not yet confirmed by typing
  let _demoState = {}; // Temp state for interactive demo preview; resets when editor closes
  let _activeTemplateRow = null; // Template row currently showing the blue left-border accent
  let _completedExpanded = false;
  let _todoDragId = null;
  let _notifOutsideHandler = null;  // click-outside handler for notif/todo preview
  let _activeTodoItemEl = null;     // currently highlighted todo item element
  let _activeNotifItemEl = null;    // currently highlighted notification item element
  const _TODO_ORDER_KEY = 'band_booking_todo_order';

  function _getTodoOrder() {
    try { return JSON.parse(localStorage.getItem(_TODO_ORDER_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function _saveTodoOrder(ids) { localStorage.setItem(_TODO_ORDER_KEY, JSON.stringify(ids)); }

  function _clearTodoTimer() {
    if (_todoTimer) { clearInterval(_todoTimer); _todoTimer = null; }
  }

  function _cleanupPanelHoverListeners() {
    const panel = document.getElementById('detail-panel');
    if (panel && panel._dashTodoEnter) {
      panel.removeEventListener('mouseenter', panel._dashTodoEnter);
      panel.removeEventListener('mouseleave', panel._dashTodoLeave);
      delete panel._dashTodoEnter;
      delete panel._dashTodoLeave;
    }
    const pane = document.getElementById('comment-pane');
    if (pane && pane._dashTodoEnter) {
      pane.removeEventListener('mouseenter', pane._dashTodoEnter);
      pane.removeEventListener('mouseleave', pane._dashTodoLeave);
      delete pane._dashTodoEnter;
      delete pane._dashTodoLeave;
    }
    _mouseInPanel = false;
  }

  function _setupPanelHoverListeners() {
    _cleanupPanelHoverListeners();
    const _onEnter = () => { clearTimeout(_hoverHideTimer); _hoverHideTimer = null; _mouseInPanel = true; };
    const _onLeave = () => {
      _mouseInPanel = false;
      _hoverHideTimer = setTimeout(() => {
        if (_previewTaskId !== null || _previewTemplateId !== null) {
          _previewTaskId = null;
          _previewTemplateId = null;
          document.getElementById('app').classList.remove('notif-preview-open');
          DetailPanel.hide();
        }
        if (_activeTemplateRow) {
          _activeTemplateRow.classList.remove('dash-template-row--active');
          _activeTemplateRow = null;
        }
      }, 350);
    };
    const panel = document.getElementById('detail-panel');
    if (panel) {
      panel._dashTodoEnter = _onEnter;
      panel._dashTodoLeave = _onLeave;
      panel.addEventListener('mouseenter', panel._dashTodoEnter);
      panel.addEventListener('mouseleave', panel._dashTodoLeave);
    }
    const pane = document.getElementById('comment-pane');
    if (pane) {
      pane._dashTodoEnter = _onEnter;
      pane._dashTodoLeave = _onLeave;
      pane.addEventListener('mouseenter', pane._dashTodoEnter);
      pane.addEventListener('mouseleave', pane._dashTodoLeave);
    }
  }

  function _clearActiveTodo() {
    if (_activeTodoItemEl) { _activeTodoItemEl.classList.remove('active'); _activeTodoItemEl = null; }
  }
  function _clearActiveNotif() {
    if (_activeNotifItemEl) { _activeNotifItemEl.classList.remove('active'); _activeNotifItemEl = null; }
  }

  function _detachNotifOutsideHandler() {
    if (_notifOutsideHandler) {
      document.removeEventListener('click', _notifOutsideHandler, true);
      _notifOutsideHandler = null;
    }
  }

  function _attachNotifOutsideHandler() {
    _detachNotifOutsideHandler();
    _notifOutsideHandler = (e) => {
      // Clean up if panel already closed (e.g. via close button)
      if (!document.getElementById('app').classList.contains('detail-panel-open')) {
        _clearActiveTodo();
        _clearActiveNotif();
        _detachNotifOutsideHandler();
        return;
      }
      const notifColEl = document.querySelector('.overview-col--notif');
      const todoColEl  = document.querySelector('.overview-col--todo');
      const calColEl   = typeof OverviewCalendar !== 'undefined' ? OverviewCalendar.getEl() : null;
      const panel = document.getElementById('detail-panel');
      const pane  = document.getElementById('comment-pane');
      if (notifColEl && notifColEl.contains(e.target)) return;
      if (todoColEl  && todoColEl.contains(e.target))  return;
      if (calColEl   && calColEl.contains(e.target))   return;
      if (panel && panel.contains(e.target)) return;
      if (pane  && pane.contains(e.target))  return;
      _previewTaskId = null;
      _clearActiveTodo();
      _clearActiveNotif();
      document.getElementById('app').classList.remove('notif-preview-open');
      document.getElementById('app').classList.remove('todo-panel-open');
      _detachNotifOutsideHandler();
      DetailPanel.hide();
    };
    // defer so this opening click doesn't immediately re-fire the handler
    setTimeout(() => document.addEventListener('click', _notifOutsideHandler, true), 0);
  }

  function clearTimers() {
    _clearTodoTimer();
    clearTimeout(_hoverShowTimer); _hoverShowTimer = null;
    clearTimeout(_hoverHideTimer); _hoverHideTimer = null;
    _detachNotifOutsideHandler();
    _clearActiveTodo();
    _clearActiveNotif();
    const _appEl = document.getElementById('app');
    if (_appEl) { _appEl.classList.remove('todo-panel-open'); _appEl.classList.remove('notif-preview-open'); _appEl.classList.remove('cal-expanded'); }
    if (typeof OverviewCalendar !== 'undefined') OverviewCalendar.cleanup();
    _cleanupPanelHoverListeners();
    if (_previewTaskId !== null || _previewTemplateId !== null) {
      _previewTaskId = null;
      _previewTemplateId = null;
      DetailPanel.hide();
    }
    _previewEl = null;
    _refreshEditorPreview = null;
    _isNewDefault = false;
    _pendingNewIds = new Set();
    _demoState = {};
    _activeTemplateRow = null;
    if (typeof NewsView !== 'undefined') NewsView.cleanup();
    if (typeof SocialsView !== 'undefined') SocialsView.cleanup();
  }

  const FIELD_TYPES = [
    { value: 'text',               label: 'Text (single line)' },
    { value: 'textarea',           label: 'Text (multi-line)' },
    { value: 'link',               label: 'Link' },
    { value: 'date',               label: 'Date picker' },
    { value: 'dropdown',           label: 'Dropdown' },
    { value: 'toggle',             label: 'Toggle (pill buttons)' },
    { value: 'auto',               label: 'Auto Task Name (read-only)' },
    { value: 'time-select',        label: 'Time Selector' },
    { value: 'time-select-na',     label: 'Time Selector (N/A)' },
    { value: 'catering-select',    label: 'Catering time' },
    { value: 'show-length-select', label: 'Show length' },
    { value: 'show-time',          label: 'Show time (composite)' },
  ];

  const AUTO_SOURCES = [
    { value: 'dateRange', label: 'Date range' },
    { value: 'teamName',  label: 'Team / Artist name' },
    { value: 'title',     label: 'Task title' },
  ];

  // ── Public entry point ────────────────────────────────────────────────────

  function render(opts) {
    const keepPanel = opts && opts.keepPanel;
    if (keepPanel) {
      // Data-driven re-render (todo:updated) — preserve the open panel
      _clearTodoTimer();
      clearTimeout(_hoverShowTimer); _hoverShowTimer = null;
      clearTimeout(_hoverHideTimer); _hoverHideTimer = null;
      _cleanupPanelHoverListeners();
      _previewEl = null; _refreshEditorPreview = null;
      _isNewDefault = false; _pendingNewIds = new Set(); _demoState = {};
      if (typeof NewsView !== 'undefined') NewsView.cleanup();
      if (typeof SocialsView !== 'undefined') SocialsView.cleanup();
      if (typeof OverviewCalendar !== 'undefined') OverviewCalendar.cleanup();
    } else {
      clearTimers();
    }
    const el = document.getElementById('dashboard-view');
    el.innerHTML = '';
    if (_draft !== null) {
      _renderEditor(el);
      return;
    }
    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'dash-tab-bar';
    [['templates', 'Templates'], ['todo', 'Overview'], ['news', 'News'], ['socials', 'My Socials']].forEach(([id, label]) => {
      const btn = document.createElement('button');
      btn.className = 'dash-tab-btn' + (_dashTab === id ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => { _dashTab = id; render(); });
      tabBar.appendChild(btn);
    });
    el.appendChild(tabBar);

    if (_dashTab === 'todo') {
      _renderTodo(el);
    } else if (_dashTab === 'news') {
      NewsView.render(el);
    } else if (_dashTab === 'socials') {
      SocialsView.render(el);
    } else {
      _renderList(el);
    }
  }

  // ── List view ─────────────────────────────────────────────────────────────

  function _renderList(el) {
    _previewEl = null;
    _refreshEditorPreview = null;
    _setupPanelHoverListeners();

    const wrap = document.createElement('div');
    wrap.className = 'dash-wrap dash-template-list-wrap';

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'dash-header';
    const title = document.createElement('h2');
    title.className = 'dash-title';
    title.textContent = 'Templates';

    const headerBtns = document.createElement('div');
    headerBtns.style.cssText = 'display:flex;gap:8px;align-items:center;';

    const createBtn = document.createElement('button');
    createBtn.className = 'dash-btn-primary';
    createBtn.textContent = '+ Create New Template';
    createBtn.addEventListener('click', () => {
      _isNewDefault = false;
      _editingId = null;
      _draft = _newDraft();
      render();
    });

    // MEGA_MASTER_ONLY — hide this button for all other user roles when auth is implemented
    const createDefaultBtn = document.createElement('button');
    createDefaultBtn.className = 'dash-btn-secondary';
    createDefaultBtn.textContent = '+ Create New Default Template';
    createDefaultBtn.addEventListener('click', () => {
      _isNewDefault = true;
      _editingId = null;
      _draft = _newDraft();
      render();
    });

    headerBtns.appendChild(createBtn);
    headerBtns.appendChild(createDefaultBtn);
    header.appendChild(title);
    header.appendChild(headerBtns);
    wrap.appendChild(header);

    const allTemplates = DataLayer.getTemplates();
    const defaultTemplates = allTemplates.filter(t => DataLayer.isDefaultTemplate(t.id));
    const myTemplates = allTemplates.filter(t => !DataLayer.isDefaultTemplate(t.id));

    // ── Default Templates ────────────────────────────────────────────────────
    const defSection = document.createElement('div');
    defSection.className = 'dash-template-section';

    const defTitleRow = document.createElement('div');
    defTitleRow.className = 'dash-template-section-title';

    const defTitleText = document.createElement('span');
    defTitleText.textContent = 'Default Templates';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'dash-section-toggle-btn';
    toggleBtn.textContent = DataLayer.getDefaultTemplatesVisible() ? 'Hide' : 'Show';

    defTitleRow.appendChild(defTitleText);
    defTitleRow.appendChild(toggleBtn);
    defSection.appendChild(defTitleRow);

    const defContent = document.createElement('div');
    defContent.style.display = DataLayer.getDefaultTemplatesVisible() ? '' : 'none';

    toggleBtn.addEventListener('click', () => {
      const newVal = !DataLayer.getDefaultTemplatesVisible();
      DataLayer.setDefaultTemplatesVisible(newVal);
      toggleBtn.textContent = newVal ? 'Hide' : 'Show';
      defContent.style.display = newVal ? '' : 'none';
    });

    if (defaultTemplates.length > 0) {
      const defList = document.createElement('div');
      defList.className = 'dash-template-list';
      defaultTemplates.forEach(tmpl => defList.appendChild(_renderDefaultTemplateRow(tmpl)));
      defContent.appendChild(defList);
    } else {
      const empty = document.createElement('p');
      empty.className = 'dash-empty';
      empty.textContent = 'No default templates.';
      defContent.appendChild(empty);
    }

    defSection.appendChild(defContent);
    wrap.appendChild(defSection);

    // ── My Templates ─────────────────────────────────────────────────────────
    const mySection = document.createElement('div');
    mySection.className = 'dash-template-section';

    const myTitle = document.createElement('div');
    myTitle.className = 'dash-template-section-title';
    myTitle.textContent = 'My Templates';
    mySection.appendChild(myTitle);

    if (myTemplates.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'dash-empty';
      empty.textContent = 'No custom templates yet. Use "Customise" on a default template, or create a new one above.';
      mySection.appendChild(empty);
    } else {
      const myList = document.createElement('div');
      myList.className = 'dash-template-list';
      myTemplates.forEach(tmpl => myList.appendChild(_renderMyTemplateRow(tmpl)));
      mySection.appendChild(myList);
    }

    wrap.appendChild(mySection);
    el.appendChild(wrap);
  }

  // ── Template row hover ────────────────────────────────────────────────────

  function _addTemplateRowHover(row, tmpl) {
    row.addEventListener('mouseenter', () => {
      if (_activeTemplateRow && _activeTemplateRow !== row) {
        _activeTemplateRow.classList.remove('dash-template-row--active');
      }
      _activeTemplateRow = row;
      row.classList.add('dash-template-row--active');
      clearTimeout(_hoverHideTimer);
      _hoverHideTimer = null;
      clearTimeout(_hoverShowTimer);
      _hoverShowTimer = setTimeout(() => {
        _previewTemplateId = tmpl.id;
        _renderTemplatePreviewInPanel(tmpl);
      }, 350);
    });
    row.addEventListener('mouseleave', () => {
      clearTimeout(_hoverShowTimer);
      _hoverShowTimer = null;
      _hoverHideTimer = setTimeout(() => {
        if (!_mouseInPanel && (_previewTaskId !== null || _previewTemplateId !== null)) {
          _previewTaskId = null;
          _previewTemplateId = null;
          DetailPanel.hide();
        }
        if (!_mouseInPanel && _activeTemplateRow === row) {
          row.classList.remove('dash-template-row--active');
          _activeTemplateRow = null;
        }
      }, 350);
    });
  }

  function _renderDefaultTemplateRow(tmpl) {
    const row = document.createElement('div');
    row.className = 'dash-template-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'dash-template-name';
    nameEl.textContent = tmpl.name || '(Unnamed)';

    const tsCount = (tmpl.taskSections || []).length;
    const meta = document.createElement('span');
    meta.className = 'dash-template-meta';
    meta.textContent = `${tsCount} task section${tsCount !== 1 ? 's' : ''}`;

    const actions = document.createElement('div');
    actions.className = 'dash-template-actions';

    const customBtn = document.createElement('button');
    customBtn.className = 'dash-btn-secondary';
    customBtn.textContent = 'Customise';
    customBtn.addEventListener('click', () => { DataLayer.customiseDefaultTemplate(tmpl.id); render(); });

    // MEGA_MASTER_ONLY — hide this button for all other user roles when auth is implemented
    const masterEditBtn = document.createElement('button');
    masterEditBtn.className = 'dash-btn-secondary';
    masterEditBtn.textContent = 'Master Edit';
    masterEditBtn.addEventListener('click', () => {
      _editingId = tmpl.id;
      _draft = JSON.parse(JSON.stringify(tmpl));
      render();
    });

    actions.appendChild(customBtn);
    actions.appendChild(masterEditBtn);
    row.appendChild(nameEl);
    row.appendChild(meta);
    row.appendChild(actions);

    _addTemplateRowHover(row, tmpl);
    return row;
  }

  function _renderMyTemplateRow(tmpl) {
    const row = document.createElement('div');
    row.className = 'dash-template-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'dash-template-name';
    nameEl.textContent = tmpl.name || '(Unnamed)';

    const tsCount = (tmpl.taskSections || []).length;
    const meta = document.createElement('span');
    meta.className = 'dash-template-meta';
    meta.textContent = `${tsCount} task section${tsCount !== 1 ? 's' : ''}`;

    const actions = document.createElement('div');
    actions.className = 'dash-template-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'dash-btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      _editingId = tmpl.id;
      _draft = JSON.parse(JSON.stringify(tmpl));
      render();
    });

    const dupBtn = document.createElement('button');
    dupBtn.className = 'dash-btn-secondary';
    dupBtn.textContent = 'Duplicate';
    dupBtn.addEventListener('click', () => { DataLayer.duplicateTemplate(tmpl.id); render(); });

    const delBtn = document.createElement('button');
    delBtn.className = 'dash-btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => _confirmDelete(tmpl.id));

    actions.appendChild(editBtn);
    actions.appendChild(dupBtn);
    actions.appendChild(delBtn);
    row.appendChild(nameEl);
    row.appendChild(meta);
    row.appendChild(actions);

    _addTemplateRowHover(row, tmpl);
    return row;
  }

  function _confirmDelete(id) {
    const tmpl = DataLayer.getTemplate(id);
    if (!tmpl) return;
    const usedBy = DataLayer.getTeams()
      .flatMap(t => t.projects)
      .filter(p => p.templateId === id);

    let msg = `Delete template "${tmpl.name}"?\n\nThis cannot be undone.`;
    if (usedBy.length > 0) {
      const names = usedBy.map(p => p.name).join(', ');
      msg += `\n\nThis template is currently used by ${usedBy.length} project(s): ${names}. Those projects will need to be reassigned to a different template afterward.`;
    }
    if (confirm(msg)) {
      DataLayer.deleteTemplate(id);
      render();
    }
  }

  // ── Template preview panel ────────────────────────────────────────────────

  function _renderTemplatePreviewInPanel(template, isEditMode) {
    const panel = document.getElementById('detail-panel');
    const content = document.getElementById('detail-content');
    const bottom = document.getElementById('detail-bottom');
    if (!panel || !content) return;

    content.innerHTML = '';
    if (bottom) {
      bottom.innerHTML = '';
      if (isEditMode) {
        bottom.style.display = '';
        const panelActions = document.createElement('div');
        panelActions.className = 'editor-actions editor-actions--panel';
        const pSave = document.createElement('button');
        pSave.className = 'dash-btn-primary';
        pSave.textContent = 'Save Template';
        pSave.addEventListener('click', _save);
        const pCancel = document.createElement('button');
        pCancel.className = 'dash-btn-secondary';
        pCancel.textContent = 'Cancel';
        pCancel.addEventListener('click', () => { _draft = null; _editingId = null; render(); });
        panelActions.appendChild(pSave);
        panelActions.appendChild(pCancel);
        bottom.appendChild(panelActions);
      } else {
        bottom.style.display = 'none';
      }
    }
    panel.classList.remove('hidden');

    const badge = document.createElement('div');
    badge.className = 'tmpl-preview-badge' + (isEditMode ? ' tmpl-preview-badge--edit' : ' tmpl-preview-badge--preview');
    badge.textContent = template.name || 'Template Preview';
    content.appendChild(badge);

    _buildTemplatePreviewContent(content, template);
  }

  function _termLabel(text) {
    const el = document.createElement('div');
    el.className = 'tmpl-terminology-label';
    el.textContent = text;
    return el;
  }

  function _buildTemplatePreviewContent(container, template) {
    if (!template) return;
    const tf = template.taskFeatures || {};

    // ── Build all elements first ────────────────────────────────────────────

    // 1. Demo task title
    const titleEl = document.createElement('div');
    titleEl.className = 'editor-preview-task-title';
    titleEl.textContent = 'Demo Task';

    // 2. Sample date
    const datesEl = document.createElement('div');
    datesEl.className = 'detail-dates';
    const datePill = document.createElement('div');
    datePill.className = 'date-pill has-date';
    const dateIcon = document.createElement('span');
    dateIcon.className = 'pill-icon';
    dateIcon.textContent = '📅';
    datePill.appendChild(dateIcon);
    datePill.appendChild(document.createTextNode(' 15 Aug 2026'));
    datesEl.appendChild(datePill);

    // 3. Task checkpoints (optional)
    let checklistEl = null;
    if (tf.reminders && tf.reminders.enabled && (tf.reminders.items || []).length > 0) {
      checklistEl = document.createElement('div');
      checklistEl.className = 'detail-checklist';
      (tf.reminders.items || []).forEach(item => {
        const ci = document.createElement('div');
        ci.className = 'checklist-item';
        const chk = document.createElement('div');
        const isChecked = !!_demoState['_check_' + item.id];
        chk.className = 'checklist-checkbox' + (isChecked ? ' checked' : '');
        const lbl = document.createElement('span');
        lbl.className = 'checklist-label';
        lbl.textContent = item.name || 'Checkpoint';
        ci.appendChild(chk);
        ci.appendChild(lbl);
        ci.addEventListener('click', () => {
          const nowChecked = !_demoState['_check_' + item.id];
          _demoState['_check_' + item.id] = nowChecked;
          chk.classList.toggle('checked', nowChecked);
        });
        checklistEl.appendChild(ci);
      });
    }

    // 4. Project section pills
    const psSelectorEl = document.createElement('div');
    psSelectorEl.className = 'detail-section-selector';
    const psLabelEl = document.createElement('label');
    psLabelEl.textContent = 'Section:';
    psSelectorEl.appendChild(psLabelEl);
    const psItems = (template.projectSections || []).filter(ps => ps.name);
    if (psItems.length) {
      let activePsIdx = _demoState._activeSection !== undefined ? _demoState._activeSection : 0;
      psItems.forEach((ps, i) => {
        const p = document.createElement('button');
        p.className = 'section-pill' + (i === activePsIdx ? ' active color-blue' : '');
        p.textContent = ps.name;
        p.addEventListener('click', () => {
          activePsIdx = i;
          _demoState._activeSection = i;
          psSelectorEl.querySelectorAll('.section-pill').forEach((pill, pi) => {
            pill.classList.toggle('active', pi === i);
            pill.classList.toggle('color-blue', pi === i);
          });
        });
        psSelectorEl.appendChild(p);
      });
    } else {
      ['e.g. Planning', 'e.g. Confirmed'].forEach((text, i) => {
        const p = document.createElement('button');
        p.className = 'section-pill' + (i === 0 ? ' active color-blue' : '');
        p.style.opacity = '0.4';
        p.textContent = text;
        psSelectorEl.appendChild(p);
      });
    }

    // 5. Task reminder (optional)
    let reminderEl = null;
    if (tf.taskReminders && tf.taskReminders.enabled) {
      reminderEl = document.createElement('div');
      reminderEl.className = 'detail-task-reminder';
      const reminderInp = document.createElement('input');
      reminderInp.type = 'text';
      reminderInp.className = 'demo-preview-reminder-input';
      reminderInp.placeholder = '+ add reminder';
      reminderInp.value = _demoState._reminder || '';
      reminderInp.addEventListener('input', () => { _demoState._reminder = reminderInp.value; });
      reminderEl.appendChild(reminderInp);
    }

    // ── Append in guaranteed order ─────────────────────────────────────────
    container.appendChild(titleEl);                              // 1. title
    container.appendChild(datesEl);                              // 2. dates
    container.appendChild(psSelectorEl);                         // 3. section pills
    if (checklistEl) container.appendChild(checklistEl);         // 4. checkpoints
    if (reminderEl) container.appendChild(reminderEl);           // 5. task reminder

    // 6. Task sections (always last)
    (template.taskSections || []).forEach((ts, tsIdx) => {
      const group = document.createElement('div');
      group.className = 'detail-section-group';
      if (tsIdx > 0) group.classList.add('collapsed');

      const heading = document.createElement('div');
      heading.className = 'detail-section-heading';
      const chev = document.createElement('span');
      chev.className = 'section-chevron' + (tsIdx === 0 ? ' open' : '');
      chev.textContent = '▶';
      const headTitle = document.createElement('span');
      headTitle.textContent = ' ' + (ts.name || 'Section');
      heading.appendChild(chev);
      heading.appendChild(headTitle);
      heading.addEventListener('click', () => {
        const collapsed = group.classList.toggle('collapsed');
        chev.classList.toggle('open', !collapsed);
      });
      group.appendChild(heading);

      (ts.modules || []).forEach(tm => {
        if (tm.name) {
          const modGroup = document.createElement('div');
          modGroup.className = 'detail-module-group' + (tm.defaultOpen ? '' : ' collapsed');
          const modHd = document.createElement('div');
          modHd.className = 'detail-module-heading';
          const modChev = document.createElement('span');
          modChev.className = 'section-chevron' + (tm.defaultOpen ? ' open' : '');
          modChev.textContent = '▶';
          const modTitle = document.createElement('span');
          modTitle.className = 'detail-module-heading-title';
          modTitle.textContent = ' ' + tm.name;
          modHd.appendChild(modChev);
          modHd.appendChild(modTitle);
          modHd.addEventListener('click', () => {
            const collapsed = modGroup.classList.toggle('collapsed');
            modChev.classList.toggle('open', !collapsed);
          });
          modGroup.appendChild(modHd);
          (tm.fields || []).forEach(field => { const fe = _buildPreviewField(field); if (fe) modGroup.appendChild(fe); });
          group.appendChild(modGroup);
        } else {
          (tm.fields || []).forEach(field => { const fe = _buildPreviewField(field); if (fe) group.appendChild(fe); });
        }
      });

      container.appendChild(group);
    });
  }

  function _buildPreviewField(field) {
    if (!field.name) return null;

    const row = document.createElement('div');
    row.className = 'detail-field';

    const label = document.createElement('div');
    label.className = 'detail-field-label';
    label.textContent = field.hideLabel ? '' : field.name;
    row.appendChild(label);

    const value = document.createElement('div');
    value.className = 'detail-field-value';

    if (!field.type) {
      row.appendChild(value);
      return row;
    }

    if (field.type === 'toggle') {
      const opts = (field.toggleOptions && field.toggleOptions.length)
        ? field.toggleOptions
        : [{ label: 'No' }, { label: 'Yes' }];
      const tEl = document.createElement('div');
      tEl.className = 'detail-toggle';
      let activeIdx = _demoState[field.id] !== undefined ? _demoState[field.id] : 0;
      opts.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'detail-toggle-btn' + (i === activeIdx ? ' active' : '');
        btn.textContent = opt.label || '—';
        btn.addEventListener('click', () => {
          activeIdx = i;
          _demoState[field.id] = i;
          tEl.querySelectorAll('.detail-toggle-btn').forEach((b, bi) => b.classList.toggle('active', bi === i));
        });
        tEl.appendChild(btn);
      });
      value.appendChild(tEl);
    } else if (field.type === 'dropdown') {
      const opts = (field.dropdownOptions && field.dropdownOptions.length)
        ? field.dropdownOptions
        : [{ label: 'Option 1', value: 'option-1' }, { label: 'Option 2', value: 'option-2' }, { label: 'Option 3', value: 'option-3' }];
      const sel = document.createElement('select');
      sel.className = 'demo-preview-select';
      const def = document.createElement('option');
      def.value = ''; def.textContent = '— select —';
      sel.appendChild(def);
      opts.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value || opt.label;
        o.textContent = opt.label;
        sel.appendChild(o);
      });
      if (_demoState[field.id]) sel.value = _demoState[field.id];
      sel.addEventListener('change', () => { _demoState[field.id] = sel.value; });
      value.appendChild(sel);
    } else if (field.type === 'time-select' || field.type === 'time-select-na') {
      const sel = document.createElement('select');
      sel.className = 'demo-preview-select';
      const def = document.createElement('option');
      def.value = ''; def.textContent = '— time —';
      sel.appendChild(def);
      if (field.type === 'time-select-na') {
        const na = document.createElement('option');
        na.value = 'N/A'; na.textContent = 'N/A';
        sel.appendChild(na);
      }
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
          const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          const o = document.createElement('option');
          o.value = t; o.textContent = t;
          sel.appendChild(o);
        }
      }
      if (_demoState[field.id]) sel.value = _demoState[field.id];
      sel.addEventListener('change', () => { _demoState[field.id] = sel.value; });
      value.appendChild(sel);
    } else if (field.type === 'date') {
      const inp = document.createElement('input');
      inp.type = 'date';
      inp.className = 'demo-preview-date';
      if (_demoState[field.id]) inp.value = _demoState[field.id];
      inp.addEventListener('change', () => { _demoState[field.id] = inp.value; });
      value.appendChild(inp);
    } else if (field.type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.className = 'demo-preview-textarea';
      ta.rows = 3;
      ta.placeholder = 'Some text\nText underneath\nText text underneath text';
      ta.value = _demoState[field.id] !== undefined ? _demoState[field.id] : '';
      ta.addEventListener('input', () => { _demoState[field.id] = ta.value; });
      value.appendChild(ta);
    } else if (field.type === 'link') {
      const linkWrap = document.createElement('span');
      if (_demoState[field.id]) {
        const a = document.createElement('a');
        a.href = '#'; a.className = 'demo-preview-link';
        a.textContent = _demoState[field.id];
        a.addEventListener('click', e => e.preventDefault());
        linkWrap.appendChild(a);
      } else {
        const addBtn = document.createElement('button');
        addBtn.className = 'demo-preview-link-add';
        addBtn.textContent = '+ add link';
        addBtn.addEventListener('click', () => {
          const url = window.prompt('Link URL:');
          if (url && url.trim()) { _demoState[field.id] = url.trim(); if (_refreshEditorPreview) _refreshEditorPreview(); }
        });
        linkWrap.appendChild(addBtn);
      }
      value.appendChild(linkWrap);
    } else if (field.type === 'auto') {
      const autoEl = document.createElement('span');
      autoEl.className = 'detail-field-text';
      autoEl.style.color = 'var(--text-secondary)';
      autoEl.style.fontStyle = 'italic';
      autoEl.textContent = 'Demo Task';
      value.appendChild(autoEl);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'demo-preview-input';
      inp.placeholder = 'Anne Smith';
      inp.value = _demoState[field.id] !== undefined ? _demoState[field.id] : '';
      inp.addEventListener('input', () => { _demoState[field.id] = inp.value; });
      value.appendChild(inp);
    }

    row.appendChild(value);
    return row;
  }
  function _placeholderForType(type, field) {
    switch (type) {
      case 'text':           return 'Anne Smith';
      case 'textarea':       return 'Some text\nText underneath\nText text underneath text';
      case 'link':           return '+ add link';
      case 'date':           return '15 Aug 2026';
      case 'time-select':    return '20:00';
      case 'time-select-na': return '20:00';
      case 'auto':           return 'Auto-filled from task';
      case 'catering-select':    return 'e.g. Dinner for 4';
      case 'show-length-select': return 'e.g. 90 min';
      case 'show-time':          return 'e.g. 20:00';
      case 'dropdown': {
        const opts = field && field.dropdownOptions;
        return (opts && opts.length) ? `e.g. ${opts[0].label}` : 'e.g. Option 1';
      }
      default: return '—';
    }
  }

  // ── Editor ────────────────────────────────────────────────────────────────

  function _newDraft() {
    return {
      id: Utils.generateId(),
      name: '',
      projectSections: [],
      taskFeatures: { reminders: { enabled: false, items: [] }, taskReminders: { enabled: false } },
      taskSections: [
        {
          id: Utils.generateId(),
          name: '',
          modules: [
            { id: Utils.generateId(), name: '', defaultOpen: true, fields: [] }
          ]
        }
      ]
    };
  }

  function _renderEditor(el) {
    // Full-width form; live preview uses the standard #detail-panel
    const wrap = document.createElement('div');
    wrap.className = 'dash-wrap';
    el.appendChild(wrap);

    _previewEl = null;
    _previewTemplateId = 'editor'; // ensures clearTimers() hides the panel on back/save/cancel

    let _editorInitialized = false;
    const topActions = document.createElement('div');
    topActions.className = 'editor-actions editor-actions--top';
    topActions.style.display = 'none';

    _refreshEditorPreview = function() {
      _renderTemplatePreviewInPanel(_draft, true);
      if (_editorInitialized) topActions.style.display = '';
    };
    _refreshEditorPreview();

    // Back link
    const backBtn = document.createElement('button');
    backBtn.className = 'dash-back-btn';
    backBtn.textContent = '← Back to Templates';
    backBtn.addEventListener('click', () => { _draft = null; _editingId = null; render(); });
    wrap.appendChild(backBtn);

    // Heading
    const heading = document.createElement('h2');
    heading.className = 'dash-title';
    heading.textContent = _editingId ? 'Edit Template' : (_isNewDefault ? 'New Default Template' : 'New Template');
    heading.style.marginBottom = '20px';
    wrap.appendChild(heading);

    // Template name
    const nameRow = document.createElement('div');
    nameRow.className = 'editor-name-row';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'editor-field-label';
    nameLabel.textContent = 'Template name';
    const nameInput = document.createElement('input');
    nameInput.className = 'editor-name-input';
    nameInput.type = 'text';
    nameInput.value = _draft.name;
    nameInput.placeholder = 'e.g. Band Booking, Corporate Event…';
    nameInput.addEventListener('input', () => {
      _draft.name = nameInput.value;
      if (_refreshEditorPreview) _refreshEditorPreview();
    });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    wrap.appendChild(nameRow);

    const topSaveBtn = document.createElement('button');
    topSaveBtn.className = 'dash-btn-primary';
    topSaveBtn.textContent = 'Save Template';
    topSaveBtn.addEventListener('click', _save);
    const topCancelBtn = document.createElement('button');
    topCancelBtn.className = 'dash-btn-secondary';
    topCancelBtn.textContent = 'Cancel';
    topCancelBtn.addEventListener('click', () => { _draft = null; _editingId = null; render(); });
    topActions.appendChild(topSaveBtn);
    topActions.appendChild(topCancelBtn);
    wrap.appendChild(topActions);

    // ── Project Sections ───────────────────────────────────────────────────

    const psHeader = document.createElement('div');
    psHeader.className = 'editor-section-label';
    psHeader.textContent = 'Project Sections';
    wrap.appendChild(psHeader);

    const psHint = document.createElement('p');
    psHint.className = 'editor-section-hint';
    psHint.textContent = 'Starting sections (columns) for new projects using this template. Users can rename, add or remove sections afterward.';
    wrap.appendChild(psHint);

    if (!_draft.projectSections) _draft.projectSections = [];
    const psList = document.createElement('div');
    psList.className = 'editor-ps-list';
    wrap.appendChild(psList);

    function rerenderPs() {
      psList.innerHTML = '';
      _draft.projectSections.forEach((ps, idx) => {
        psList.appendChild(_buildPS(ps, idx, rerenderPs));
      });
      const psAddBtn = _addBtn('+ Add Section', () => {
        const newPs = { id: Utils.generateId(), name: '' };
        _draft.projectSections.push(newPs);
        rerenderPs();
        setTimeout(() => {
          const inputs = psList.querySelectorAll('.editor-ps-name');
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 10);
      }, 'editor-add-btn--sm');
      psList.appendChild(psAddBtn);
      if (_refreshEditorPreview) _refreshEditorPreview();
    }
    rerenderPs();

    // ── Task Features ──────────────────────────────────────────────────────

    const tfHeader = document.createElement('div');
    tfHeader.className = 'editor-section-label';
    tfHeader.style.marginTop = '28px';
    tfHeader.textContent = 'Task Features';
    wrap.appendChild(tfHeader);

    const tfHint = document.createElement('p');
    tfHint.className = 'editor-section-hint';
    tfHint.textContent = 'Optional features that appear on every task using this template.';
    wrap.appendChild(tfHint);

    const tfContainer = document.createElement('div');
    tfContainer.className = 'editor-tf-block';
    wrap.appendChild(tfContainer);

    function rerenderTF() {
      tfContainer.innerHTML = '';
      tfContainer.appendChild(_buildTaskFeatures(rerenderTF));
      if (_refreshEditorPreview) _refreshEditorPreview();
    }
    rerenderTF();

    // ── Task Sections ──────────────────────────────────────────────────────

    const tsHeader = document.createElement('div');
    tsHeader.className = 'editor-section-label';
    tsHeader.style.marginTop = '28px';
    tsHeader.textContent = 'Task Sections';
    wrap.appendChild(tsHeader);

    const tsHint = document.createElement('p');
    tsHint.className = 'editor-section-hint';
    tsHint.textContent = 'Fields shown inside each task\'s detail panel. Each Task Section groups Task Modules, which contain Task Labels (the individual fields).';
    wrap.appendChild(tsHint);

    const tsList = document.createElement('div');
    tsList.className = 'editor-ts-list';
    wrap.appendChild(tsList);

    function rerenderTs() {
      tsList.innerHTML = '';
      _draft.taskSections.forEach((ts, idx) => {
        tsList.appendChild(_buildTS(ts, idx, rerenderTs));
      });
      const addBtn = _addBtn('+ Add Task Section', () => {
        const newTs = { id: Utils.generateId(), name: '', modules: [{ id: Utils.generateId(), name: '', defaultOpen: true, fields: [] }] };
        _draft.taskSections.push(newTs);
        rerenderTs();
        setTimeout(() => { const ins = tsList.querySelectorAll('.editor-ts-name'); if (ins.length) ins[ins.length - 1].focus(); }, 10);
      });
      tsList.appendChild(addBtn);
      if (_refreshEditorPreview) _refreshEditorPreview();
    }
    rerenderTs();

    // Save / Cancel actions
    const actions = document.createElement('div');
    actions.className = 'editor-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'dash-btn-primary';
    saveBtn.textContent = 'Save Template';
    saveBtn.addEventListener('click', _save);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dash-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { _draft = null; _editingId = null; render(); });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    wrap.appendChild(actions);

    // Focus template name if empty (new template)
    if (!_draft.name) setTimeout(() => nameInput.focus(), 0);
    setTimeout(() => { _editorInitialized = true; }, 0);
  }

  // ── Deep-clone helpers (new IDs at every level) ───────────────────────────

  function _cloneField(field) {
    const f = Object.assign({}, field, { id: Utils.generateId(), name: field.name + ' (copy)' });
    if (f.toggleOptions)   f.toggleOptions   = f.toggleOptions.map(o => Object.assign({}, o));
    if (f.dropdownOptions) f.dropdownOptions = f.dropdownOptions.map(o => Object.assign({}, o));
    return f;
  }

  function _cloneTM(tm) {
    return Object.assign({}, tm, {
      id: Utils.generateId(),
      name: tm.name ? tm.name + ' (copy)' : '',
      fields: (tm.fields || []).map(_cloneField)
    });
  }

  function _cloneTS(ts) {
    return Object.assign({}, ts, {
      id: Utils.generateId(),
      name: ts.name + ' (copy)',
      modules: (ts.modules || []).map(_cloneTM)
    });
  }

  // ── PS builder ────────────────────────────────────────────────────────────

  function _buildPS(ps, idx, rerender) {
    const row = document.createElement('div');
    row.className = 'editor-ps-row';

    const nameInput = document.createElement('input');
    nameInput.className = 'editor-ps-name';
    nameInput.type = 'text';
    nameInput.value = ps.name;
    nameInput.placeholder = 'Section name (e.g. To Do, In Progress, Done)';
    nameInput.addEventListener('input', () => {
      ps.name = nameInput.value;
      if (_refreshEditorPreview) _refreshEditorPreview();
    });
    _applyDeleteOnBlur(nameInput, () => { _draft.projectSections.splice(idx, 1); rerender(); });

    const ctrls = _controls(
      idx,
      _draft.projectSections.length,
      () => { _draft.projectSections.splice(idx - 1, 0, _draft.projectSections.splice(idx, 1)[0]); rerender(); },
      () => { _draft.projectSections.splice(idx + 1, 0, _draft.projectSections.splice(idx, 1)[0]); rerender(); },
      () => { _draft.projectSections.splice(idx, 1); rerender(); }
    );

    row.appendChild(nameInput);
    row.appendChild(ctrls);
    return row;
  }

  // ── TS builder ────────────────────────────────────────────────────────────

  function _buildTS(ts, tsIdx, rerender) {
    const card = document.createElement('div');
    card.className = 'editor-ts-card';

    const header = document.createElement('div');
    header.className = 'editor-ts-header';

    const nameInput = document.createElement('input');
    nameInput.className = 'editor-ts-name';
    nameInput.type = 'text';
    nameInput.value = ts.name;
    nameInput.placeholder = 'Task Section name';
    nameInput.addEventListener('input', () => {
      ts.name = nameInput.value;
      if (_refreshEditorPreview) _refreshEditorPreview();
    });
    _applyDeleteOnBlur(nameInput, () => { _draft.taskSections.splice(tsIdx, 1); rerender(); });

    const ctrls = _controls(
      tsIdx,
      _draft.taskSections.length,
      () => { _draft.taskSections.splice(tsIdx - 1, 0, _draft.taskSections.splice(tsIdx, 1)[0]); rerender(); },
      () => { _draft.taskSections.splice(tsIdx + 1, 0, _draft.taskSections.splice(tsIdx, 1)[0]); rerender(); },
      () => { if (confirm('Remove this section and all its modules and fields?')) { _draft.taskSections.splice(tsIdx, 1); rerender(); } },
      () => { _draft.taskSections.splice(tsIdx + 1, 0, _cloneTS(ts)); rerender(); }
    );

    header.appendChild(nameInput);
    header.appendChild(ctrls);
    card.appendChild(header);

    // TM list
    const tmList = document.createElement('div');
    tmList.className = 'editor-tm-list';
    card.appendChild(tmList);

    function rerenderTm() {
      tmList.innerHTML = '';
      ts.modules.forEach((tm, tmIdx) => {
        tmList.appendChild(_buildTM(tm, tmIdx, ts, rerenderTm));
      });
      const addBtn = _addBtn('+ Add Task Module', () => {
        const newTm = { id: Utils.generateId(), name: '', defaultOpen: false, fields: [] };
        ts.modules.push(newTm);
        rerenderTm();
        setTimeout(() => { const ins = tmList.querySelectorAll('.editor-tm-name'); if (ins.length) ins[ins.length - 1].focus(); }, 10);
      }, 'editor-add-btn--sm');
      tmList.appendChild(addBtn);
      if (_refreshEditorPreview) _refreshEditorPreview();
    }
    rerenderTm();

    return card;
  }

  // ── TM builder ────────────────────────────────────────────────────────────

  function _buildTM(tm, tmIdx, ts, rerender) {
    const card = document.createElement('div');
    card.className = 'editor-tm-card';

    const header = document.createElement('div');
    header.className = 'editor-tm-header';

    const nameInput = document.createElement('input');
    nameInput.className = 'editor-tm-name';
    nameInput.type = 'text';
    nameInput.value = tm.name;
    nameInput.placeholder = 'Task Module name — leave blank for flat (no heading)';
    nameInput.addEventListener('input', () => {
      tm.name = nameInput.value;
      if (_refreshEditorPreview) _refreshEditorPreview();
    });
    _applyDeleteOnBlur(nameInput, () => { ts.modules.splice(tmIdx, 1); rerender(); });

    const ctrls = _controls(
      tmIdx,
      ts.modules.length,
      () => { ts.modules.splice(tmIdx - 1, 0, ts.modules.splice(tmIdx, 1)[0]); rerender(); },
      () => { ts.modules.splice(tmIdx + 1, 0, ts.modules.splice(tmIdx, 1)[0]); rerender(); },
      () => { if (confirm('Remove this module and all its fields?')) { ts.modules.splice(tmIdx, 1); rerender(); } },
      () => { ts.modules.splice(tmIdx + 1, 0, _cloneTM(tm)); rerender(); }
    );

    header.appendChild(nameInput);
    header.appendChild(ctrls);
    card.appendChild(header);

    // TL list
    const tlList = document.createElement('div');
    tlList.className = 'editor-tl-list';
    card.appendChild(tlList);

    function rerenderTl() {
      tlList.innerHTML = '';
      tm.fields.forEach((field, tlIdx) => {
        tlList.appendChild(_buildTL(field, tlIdx, tm, rerenderTl));
      });
      const addBtn = _addBtn('+ Add Task Label', () => {
        const newField = { id: Utils.generateId(), name: '', type: null };
        tm.fields.push(newField);
        rerenderTl();
        setTimeout(() => { const ins = tlList.querySelectorAll('.editor-tl-name'); if (ins.length) ins[ins.length - 1].focus(); }, 10);
      }, 'editor-add-btn--xs');
      tlList.appendChild(addBtn);
      if (_refreshEditorPreview) _refreshEditorPreview();
    }
    rerenderTl();

    return card;
  }

  // ── TL builder ────────────────────────────────────────────────────────────

  function _buildTL(field, tlIdx, tm, rerender) {
    const row = document.createElement('div');
    row.className = 'editor-tl-row';

    const main = document.createElement('div');
    main.className = 'editor-tl-main';

    const nameInput = document.createElement('input');
    nameInput.className = 'editor-tl-name';
    nameInput.type = 'text';
    nameInput.value = field.name;
    nameInput.placeholder = 'Task Label name (e.g. CAPACITY)';
    nameInput.addEventListener('input', () => {
      field.name = nameInput.value;
      if (_refreshEditorPreview) _refreshEditorPreview();
    });
    _applyDeleteOnBlur(nameInput, () => { tm.fields.splice(tlIdx, 1); rerender(); });
    nameInput.addEventListener('blur', () => {
      if (nameInput.value.trim() && !field.type) rerender();
    });

    main.appendChild(nameInput);

    if (field.name.trim()) {
      const typeSelectWrap = _buildTypeSelect(field, rerender);
      const ctrls = _controls(
        tlIdx,
        tm.fields.length,
        () => { tm.fields.splice(tlIdx - 1, 0, tm.fields.splice(tlIdx, 1)[0]); rerender(); },
        () => { tm.fields.splice(tlIdx + 1, 0, tm.fields.splice(tlIdx, 1)[0]); rerender(); },
        () => { tm.fields.splice(tlIdx, 1); rerender(); },
        () => { tm.fields.splice(tlIdx + 1, 0, _cloneField(field)); rerender(); }
      );
      main.appendChild(typeSelectWrap);
      main.appendChild(ctrls);
    }

    row.appendChild(main);

    if (field.name.trim()) {
      if (field.type === 'toggle')   row.appendChild(_buildToggleOpts(field, rerender));
      if (field.type === 'dropdown') row.appendChild(_buildDropdownOpts(field, rerender));
      if (field.type === 'auto')     row.appendChild(_buildAutoSource(field));
    }

    return row;
  }

  function _buildTypeSelect(field, rerender) {
    const currentFt = field.type ? (FIELD_TYPES.find(ft => ft.value === field.type) || null) : null;
    const wrap = document.createElement('div');
    wrap.className = 'editor-tl-type-wrap';

    const btn = document.createElement('button');
    btn.className = 'editor-tl-type-btn';
    btn.type = 'button';
    if (currentFt) {
      btn.textContent = currentFt.label;
    } else {
      btn.textContent = 'Choose label format';
      btn.style.color = 'var(--text-secondary)';
    }

    const panel = document.createElement('div');
    panel.className = 'editor-tl-type-panel hidden';

    const list = document.createElement('div');
    list.className = 'editor-tl-type-list';

    const preview = document.createElement('div');
    preview.className = 'editor-tl-type-preview';

    FIELD_TYPES.forEach(ft => {
      const item = document.createElement('div');
      item.className = 'editor-tl-type-item' + (ft.value === field.type ? ' selected' : '');
      item.textContent = ft.label;

      item.addEventListener('mouseenter', () => {
        preview.innerHTML = '';
        _buildTypePreviewContent(ft.value, field).forEach(el => preview.appendChild(el));
      });

      item.addEventListener('mousedown', e => e.preventDefault());

      item.addEventListener('click', () => {
        field.type = ft.value;
        if (field.type !== 'toggle')   delete field.toggleOptions;
        if (field.type !== 'dropdown') delete field.dropdownOptions;
        if (field.type !== 'auto')     delete field.autoSource;
        btn.textContent = ft.label;
        btn.style.color = '';
        panel.classList.add('hidden');
        panelOpen = false;
        if (outsideHandler) { document.removeEventListener('mousedown', outsideHandler, true); outsideHandler = null; }
        rerender();
      });

      list.appendChild(item);
    });

    panel.appendChild(list);
    panel.appendChild(preview);
    wrap.appendChild(btn);
    wrap.appendChild(panel);

    let panelOpen = false;
    let outsideHandler = null;

    btn.addEventListener('click', () => {
      if (panelOpen) {
        panel.classList.add('hidden');
        panelOpen = false;
        if (outsideHandler) { document.removeEventListener('mousedown', outsideHandler, true); outsideHandler = null; }
      } else {
        panelOpen = true;
        panel.classList.remove('hidden');
        preview.innerHTML = '';
        if (field.type) {
          _buildTypePreviewContent(field.type, field).forEach(el => preview.appendChild(el));
        }
        outsideHandler = (e) => {
          if (!wrap.contains(e.target)) {
            panel.classList.add('hidden');
            panelOpen = false;
            document.removeEventListener('mousedown', outsideHandler, true);
            outsideHandler = null;
          }
        };
        setTimeout(() => document.addEventListener('mousedown', outsideHandler, true), 0);
      }
    });

    return wrap;
  }
  // ── TL builder ────────────────────────────────────────────────────────────

  function _buildTL(field, tlIdx, tm, rerender) {
    const row = document.createElement('div');
    row.className = 'editor-tl-row';

    const main = document.createElement('div');
    main.className = 'editor-tl-main';

    const nameInput = document.createElement('input');
    nameInput.className = 'editor-tl-name';
    nameInput.type = 'text';
    nameInput.value = field.name;
    nameInput.placeholder = 'Task Label name (e.g. CAPACITY)';
    nameInput.addEventListener('input', () => {
      field.name = nameInput.value;
      if (_refreshEditorPreview) _refreshEditorPreview();
    });
    _applyDeleteOnBlur(nameInput, () => { tm.fields.splice(tlIdx, 1); rerender(); });

    const typeSelectWrap = _buildTypeSelect(field, rerender);

    const ctrls = _controls(
      tlIdx,
      tm.fields.length,
      () => { tm.fields.splice(tlIdx - 1, 0, tm.fields.splice(tlIdx, 1)[0]); rerender(); },
      () => { tm.fields.splice(tlIdx + 1, 0, tm.fields.splice(tlIdx, 1)[0]); rerender(); },
      () => { tm.fields.splice(tlIdx, 1); rerender(); },
      () => { tm.fields.splice(tlIdx + 1, 0, _cloneField(field)); rerender(); }
    );

    main.appendChild(nameInput);
    main.appendChild(typeSelectWrap);
    main.appendChild(ctrls);
    row.appendChild(main);

    if (field.type === 'toggle')   row.appendChild(_buildToggleOpts(field, rerender));
    if (field.type === 'dropdown') row.appendChild(_buildDropdownOpts(field, rerender));
    if (field.type === 'auto')     row.appendChild(_buildAutoSource(field));

    return row;
  }

  function _buildTypeSelect(field, rerender) {
    const currentFt = FIELD_TYPES.find(ft => ft.value === (field.type || 'text')) || FIELD_TYPES[0];
    const wrap = document.createElement('div');
    wrap.className = 'editor-tl-type-wrap';

    const btn = document.createElement('button');
    btn.className = 'editor-tl-type-btn';
    btn.type = 'button';
    btn.textContent = currentFt.label;

    const panel = document.createElement('div');
    panel.className = 'editor-tl-type-panel hidden';

    const list = document.createElement('div');
    list.className = 'editor-tl-type-list';

    const preview = document.createElement('div');
    preview.className = 'editor-tl-type-preview';

    FIELD_TYPES.forEach(ft => {
      const item = document.createElement('div');
      item.className = 'editor-tl-type-item' + (ft.value === (field.type || 'text') ? ' selected' : '');
      item.textContent = ft.label;

      item.addEventListener('mouseenter', () => {
        preview.innerHTML = '';
        _buildTypePreviewContent(ft.value, field).forEach(el => preview.appendChild(el));
      });

      item.addEventListener('mousedown', e => e.preventDefault());

      item.addEventListener('click', () => {
        field.type = ft.value;
        if (field.type !== 'toggle')   delete field.toggleOptions;
        if (field.type !== 'dropdown') delete field.dropdownOptions;
        if (field.type !== 'auto')     delete field.autoSource;
        btn.textContent = ft.label;
        panel.classList.add('hidden');
        panelOpen = false;
        if (outsideHandler) { document.removeEventListener('mousedown', outsideHandler, true); outsideHandler = null; }
        rerender();
      });

      list.appendChild(item);
    });

    panel.appendChild(list);
    panel.appendChild(preview);
    wrap.appendChild(btn);
    wrap.appendChild(panel);

    let panelOpen = false;
    let outsideHandler = null;

    btn.addEventListener('click', () => {
      if (panelOpen) {
        panel.classList.add('hidden');
        panelOpen = false;
        if (outsideHandler) { document.removeEventListener('mousedown', outsideHandler, true); outsideHandler = null; }
      } else {
        panelOpen = true;
        panel.classList.remove('hidden');
        preview.innerHTML = '';
        _buildTypePreviewContent(field.type || 'text', field).forEach(el => preview.appendChild(el));
        outsideHandler = (e) => {
          if (!wrap.contains(e.target)) {
            panel.classList.add('hidden');
            panelOpen = false;
            document.removeEventListener('mousedown', outsideHandler, true);
            outsideHandler = null;
          }
        };
        setTimeout(() => document.addEventListener('mousedown', outsideHandler, true), 0);
      }
    });

    return wrap;
  }

  function _buildTypePreviewContent(type, field) {
    const els = [];
    switch (type) {
      case 'text': {
        const s = document.createElement('span');
        s.className = 'detail-field-text placeholder';
        s.textContent = 'Anne Smith';
        els.push(s); break;
      }
      case 'textarea': {
        const s = document.createElement('span');
        s.className = 'detail-field-text placeholder';
        ['Some text', 'Text underneath', 'Text text underneath text'].forEach((line, i) => {
          if (i > 0) s.appendChild(document.createElement('br'));
          s.appendChild(document.createTextNode(line));
        });
        els.push(s); break;
      }
      case 'toggle': {
        const opts = (field.toggleOptions && field.toggleOptions.length) ? field.toggleOptions : [{ label: 'No' }, { label: 'Yes' }];
        const tEl = document.createElement('div');
        tEl.className = 'detail-toggle';
        tEl.style.pointerEvents = 'none';
        opts.forEach((opt, i) => {
          const b = document.createElement('button');
          b.className = 'detail-toggle-btn' + (i === 0 ? ' active' : '');
          b.textContent = opt.label || '—';
          tEl.appendChild(b);
        });
        els.push(tEl); break;
      }
      case 'dropdown': {
        const opts = (field.dropdownOptions && field.dropdownOptions.length) ? field.dropdownOptions
          : [{ label: 'Option 1' }, { label: 'Option 2' }, { label: 'Option 3' }, { label: 'Option 4' }, { label: 'Option 5' }];
        const dl = document.createElement('div');
        dl.className = 'preview-dropdown-list';
        dl.style.pointerEvents = 'none';
        opts.slice(0, 5).forEach((opt, i) => {
          const item = document.createElement('div');
          item.className = 'preview-dd-item' + (i === 0 ? ' selected' : '');
          item.textContent = opt.label || `Option ${i + 1}`;
          dl.appendChild(item);
        });
        els.push(dl); break;
      }
      case 'link': {
        const s = document.createElement('span');
        s.className = 'detail-field-text';
        s.style.color = 'var(--accent-blue)';
        s.style.textDecoration = 'underline';
        s.textContent = 'www.yourlink.com';
        els.push(s); break;
      }
      case 'date': {
        const s = document.createElement('span');
        s.className = 'detail-field-text placeholder';
        s.textContent = '15 Aug 2026';
        els.push(s); break;
      }
      case 'time-select':
      case 'time-select-na':
      case 'show-time': {
        const s = document.createElement('span');
        s.className = 'detail-field-text placeholder';
        s.textContent = '20:00';
        els.push(s); break;
      }
      case 'auto': {
        const s = document.createElement('span');
        s.className = 'detail-field-text placeholder';
        s.style.fontStyle = 'italic';
        s.textContent = 'Demo Task';
        const desc = document.createElement('p');
        desc.style.cssText = 'margin:8px 0 0;font-size:11px;color:var(--text-secondary);line-height:1.4;';
        desc.textContent = 'Automatically displays the task name. Read-only.';
        els.push(s); els.push(desc); break;
      }
      default: {
        const s = document.createElement('span');
        s.className = 'detail-field-text placeholder';
        s.textContent = '—';
        els.push(s); break;
      }
    }
    return els;
  }

  function _buildToggleOpts(field, rerender) {
    if (!field.toggleOptions || !field.toggleOptions.length) {
      field.toggleOptions = [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }];
    }
    const wrap = document.createElement('div');
    wrap.className = 'editor-sub-opts';

    const lbl = document.createElement('span');
    lbl.className = 'editor-sub-label';
    lbl.textContent = 'Toggle options';
    wrap.appendChild(lbl);

    field.toggleOptions.forEach((opt, i) => {
      const optRow = document.createElement('div');
      optRow.className = 'editor-opt-row';
      const lblIn = _miniInput(opt.label, 'Option label', v => {
        opt.label = v;
        opt.value = v.toLowerCase().trim() || opt.value;
        if (_refreshEditorPreview) _refreshEditorPreview();
      }, () => { field.toggleOptions.splice(i, 1); rerender(); });
      const rm = _removeBtn(() => { field.toggleOptions.splice(i, 1); rerender(); });
      optRow.appendChild(lblIn);
      optRow.appendChild(rm);
      wrap.appendChild(optRow);
    });

    const addOpt = _addBtn('+ Add option', () => {
      field.toggleOptions.push({ value: '', label: '' });
      rerender();
    }, 'editor-add-btn--xs');
    wrap.appendChild(addOpt);
    return wrap;
  }

  function _buildDropdownOpts(field, rerender) {
    if (!field.dropdownOptions || !field.dropdownOptions.length) {
      field.dropdownOptions = [{ value: 'option-1', label: 'Option 1' }, { value: 'option-2', label: 'Option 2' }];
    }
    const wrap = document.createElement('div');
    wrap.className = 'editor-sub-opts';

    const lbl = document.createElement('span');
    lbl.className = 'editor-sub-label';
    lbl.textContent = 'Dropdown options';
    wrap.appendChild(lbl);

    field.dropdownOptions.forEach((opt, i) => {
      const optRow = document.createElement('div');
      optRow.className = 'editor-opt-row';
      const lblIn = _miniInput(opt.label, 'Option label', v => {
        opt.label = v;
        opt.value = v.toLowerCase().trim() || opt.value;
        if (_refreshEditorPreview) _refreshEditorPreview();
      }, () => { field.dropdownOptions.splice(i, 1); rerender(); });
      const rm = _removeBtn(() => { field.dropdownOptions.splice(i, 1); rerender(); });
      optRow.appendChild(lblIn);
      optRow.appendChild(rm);
      wrap.appendChild(optRow);
    });

    const addOpt = _addBtn('+ Add option', () => {
      field.dropdownOptions.push({ value: '', label: '' });
      rerender();
    }, 'editor-add-btn--xs');
    wrap.appendChild(addOpt);
    return wrap;
  }

  function _buildAutoSource(field) {
    if (!field.autoSource) field.autoSource = 'title';
    const wrap = document.createElement('div');
    wrap.className = 'editor-sub-opts';

    const lbl = document.createElement('span');
    lbl.className = 'editor-sub-label';
    lbl.textContent = 'Auto source';

    const sel = document.createElement('select');
    sel.className = 'editor-tl-type';
    AUTO_SOURCES.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src.value;
      opt.textContent = src.label;
      if (src.value === field.autoSource) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { field.autoSource = sel.value; });

    wrap.appendChild(lbl);
    wrap.appendChild(sel);
    return wrap;
  }

  // ── Shared UI helpers ─────────────────────────────────────────────────────

  function _controls(idx, total, onUp, onDown, onRemove, onDuplicate) {
    const wrap = document.createElement('div');
    wrap.className = 'editor-controls';
    if (idx > 0) wrap.appendChild(_iconBtn('↑', onUp, 'editor-reorder-btn'));
    if (idx < total - 1) wrap.appendChild(_iconBtn('↓', onDown, 'editor-reorder-btn'));
    if (onDuplicate) {
      const dupBtn = _iconBtn('⎘', onDuplicate, 'editor-duplicate-btn');
      dupBtn.title = 'Duplicate';
      wrap.appendChild(dupBtn);
    }
    wrap.appendChild(_removeBtn(onRemove));
    return wrap;
  }

  function _iconBtn(text, onClick, cls) {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function _removeBtn(onClick) {
    return _iconBtn('✕', onClick, 'editor-remove-btn');
  }

  function _addBtn(text, onClick, extraCls) {
    const btn = document.createElement('button');
    btn.className = 'editor-add-btn' + (extraCls ? ' ' + extraCls : '');
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // Shared: Enter commits (blurs), empty blur = delete
  function _applyDeleteOnBlur(input, onDelete) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
    input.addEventListener('blur', () => {
      if (!input.value.trim()) onDelete();
    });
  }

  function _miniInput(val, placeholder, onChange, onDelete) {
    const input = document.createElement('input');
    input.className = 'editor-mini-input';
    input.type = 'text';
    input.value = val;
    input.placeholder = placeholder;
    input.addEventListener('input', () => onChange(input.value));
    if (onDelete) _applyDeleteOnBlur(input, onDelete);
    return input;
  }

  // ── Task Features builder ─────────────────────────────────────────────────

  function _buildTaskFeatures(rerender) {
    if (!_draft.taskFeatures) _draft.taskFeatures = {};
    if (!_draft.taskFeatures.reminders) _draft.taskFeatures.reminders = { enabled: false, items: [] };
    if (!_draft.taskFeatures.taskReminders) _draft.taskFeatures.taskReminders = { enabled: false };
    const rem = _draft.taskFeatures.reminders;
    const tr = _draft.taskFeatures.taskReminders;

    const container = document.createElement('div');

    // ── Task Checkpoints ─────────────────────────────────────────────────────
    const block = document.createElement('div');
    block.className = 'editor-tf-feature';

    const toggleRow = document.createElement('div');
    toggleRow.className = 'editor-tf-toggle-row';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'tf-reminders-toggle';
    chk.checked = !!rem.enabled;
    chk.addEventListener('change', () => { rem.enabled = chk.checked; rerender(); });

    const lbl = document.createElement('label');
    lbl.htmlFor = 'tf-reminders-toggle';
    lbl.className = 'editor-tf-label';
    lbl.textContent = 'Task Checkpoints';

    const desc = document.createElement('span');
    desc.className = 'editor-tf-desc';
    desc.textContent = 'Named checkboxes shown at the top of every task (e.g. Press Kit, Tech Rider)';

    toggleRow.appendChild(chk);
    toggleRow.appendChild(lbl);
    toggleRow.appendChild(desc);
    block.appendChild(toggleRow);

    if (rem.enabled) {
      const itemsList = document.createElement('div');
      itemsList.className = 'editor-tf-items';

      function rerenderItems() {
        itemsList.innerHTML = '';
        (rem.items || []).forEach((item, idx) => {
          const itemRow = document.createElement('div');
          itemRow.className = 'editor-tf-item-row';

          const nameInput = document.createElement('input');
          nameInput.className = 'editor-ps-name';
          nameInput.type = 'text';
          nameInput.value = item.name;
          nameInput.placeholder = 'Reminder name (e.g. Press Kit)';
          nameInput.addEventListener('input', () => {
            item.name = nameInput.value;
            if (_refreshEditorPreview) _refreshEditorPreview();
          });
          _applyDeleteOnBlur(nameInput, () => { rem.items.splice(idx, 1); rerenderItems(); });

          const ctrls = _controls(
            idx, rem.items.length,
            () => { rem.items.splice(idx - 1, 0, rem.items.splice(idx, 1)[0]); rerenderItems(); },
            () => { rem.items.splice(idx + 1, 0, rem.items.splice(idx, 1)[0]); rerenderItems(); },
            () => { rem.items.splice(idx, 1); rerenderItems(); }
          );

          itemRow.appendChild(nameInput);
          itemRow.appendChild(ctrls);
          itemsList.appendChild(itemRow);
        });

        const addBtn = _addBtn('+ Add Reminder', () => {
          if (!rem.items) rem.items = [];
          const newItem = { id: Utils.generateId(), name: '' };
          rem.items.push(newItem);
          rerenderItems();
          setTimeout(() => {
            const inputs = itemsList.querySelectorAll('.editor-ps-name');
            if (inputs.length) inputs[inputs.length - 1].focus();
          }, 10);
        }, 'editor-add-btn--sm');
        itemsList.appendChild(addBtn);
        if (_refreshEditorPreview) _refreshEditorPreview();
      }

      rerenderItems();
      block.appendChild(itemsList);
    }

    container.appendChild(block);

    // ── Task Reminders ───────────────────────────────────────────────────────
    const trBlock = document.createElement('div');
    trBlock.className = 'editor-tf-feature';
    trBlock.style.marginTop = '8px';

    const trToggleRow = document.createElement('div');
    trToggleRow.className = 'editor-tf-toggle-row';

    const trChk = document.createElement('input');
    trChk.type = 'checkbox';
    trChk.id = 'tf-task-reminders-toggle';
    trChk.checked = !!tr.enabled;
    trChk.addEventListener('change', () => { tr.enabled = trChk.checked; rerender(); });

    const trLbl = document.createElement('label');
    trLbl.htmlFor = 'tf-task-reminders-toggle';
    trLbl.className = 'editor-tf-label';
    trLbl.textContent = 'Task Reminders';

    const trDesc = document.createElement('span');
    trDesc.className = 'editor-tf-desc';
    trDesc.textContent = 'Text input field for sending reminders to the To Do dashboard';

    trToggleRow.appendChild(trChk);
    trToggleRow.appendChild(trLbl);
    trToggleRow.appendChild(trDesc);
    trBlock.appendChild(trToggleRow);
    container.appendChild(trBlock);

    return container;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function _save() {
    if (!_draft.name.trim()) {
      alert('Please enter a template name.');
      return;
    }
    if (!_draft.taskSections.length) {
      alert('Please add at least one Task Section.');
      return;
    }

    const tmpl = JSON.parse(JSON.stringify(_draft));
    tmpl.name = tmpl.name.trim();

    if (_isNewDefault) { tmpl.isDefault = true; }
    _isNewDefault = false;

    if (_editingId) {
      DataLayer.updateTemplate(_editingId, tmpl);
    } else {
      DataLayer.addTemplate(tmpl);
    }

    UIHelpers.showSaved();
    _draft = null;
    _editingId = null;
    render();
  }

  // ── To Do list ────────────────────────────────────────────────────────────

  function _renderTodo(el) {
    const _currentUser = DetailPanel.getCurrentUser();

    // ── Two-column layout ─────────────────────────────────────────────────────
    const cols = document.createElement('div');
    cols.className = 'overview-columns';

    const todoCol = document.createElement('div');
    todoCol.className = 'overview-col overview-col--todo';
    const _todoColHdr = document.createElement('div');
    _todoColHdr.className = 'overview-col-header';
    _todoColHdr.textContent = 'TO DO';
    todoCol.appendChild(_todoColHdr);
    cols.appendChild(todoCol);

    // If mouse enters To Do column while notification preview is open, reset everything

    const notifCol = document.createElement('div');
    notifCol.className = 'overview-col overview-col--notif';
    const _notifColHdr = document.createElement('div');
    _notifColHdr.className = 'overview-col-header';
    _notifColHdr.textContent = 'UNREAD NOTIFICATIONS';
    notifCol.appendChild(_notifColHdr);
    cols.appendChild(notifCol);

    // Calendar column (third)
    OverviewCalendar.render(cols, {
      onOpenTask: (taskId) => {
        OverviewCalendar.collapseIfExpanded();
        _previewTaskId = taskId;
        _clearActiveTodo();
        _clearActiveNotif();
        const _appEl2 = document.getElementById('app');
        _appEl2.classList.remove('notif-preview-open');
        _appEl2.classList.add('todo-panel-open');
        DetailPanel.render(taskId);
        _attachNotifOutsideHandler();
      }
    });

    // alias: all existing wrap.appendChild(...) targets the To Do column
    const wrap = todoCol;

    // Gather all tasks with notes across all teams/projects
    function _collectItems() {
      const items = [];
      DataLayer.getTeams().forEach(team => {
        (team.projects || []).forEach(project => {
          (project.sections || []).forEach(section => {
            (section.tasks || []).forEach(task => {
              (task.listNotes || []).forEach(note => {
                if (note.text && note.text.trim()) {
                  items.push({ note, task, team, project });
                }
              });
              // Legacy: single listNote (migration)
              if ((!task.listNotes || task.listNotes.length === 0) && task.listNote && task.listNote.trim()) {
                items.push({ note: { id: 'legacy-' + task.id, text: task.listNote, timestamp: task.listNoteTimestamp, done: task.noteDone || false }, task, team, project });
              }
            });
          });
        });
      });
      return items;
    }

    function _humanAge(isoTs) {
      if (!isoTs) return '';
      const diff = Math.max(0, Date.now() - new Date(isoTs).getTime());
      const totalMins = Math.floor(diff / 60000);
      const days = Math.floor(totalMins / 1440);
      const hours = Math.floor((totalMins % 1440) / 60);
      const mins = totalMins % 60;
      const parts = [];
      if (days > 0) parts.push(days + 'd');
      if (hours > 0) parts.push(hours + 'h');
      if (mins > 0 || parts.length === 0) parts.push(mins + 'm');
      return parts.join(' ') + ' ago';
    }

    function _navigate(taskId, projectId) {
      Utils.EventBus.emit('todo:navigate', { taskId, projectId });
    }

    function _toggleDone(noteId, taskId, currentDone) {
      const t = DataLayer.getTask(taskId);
      if (!t) return;
      const changes = {};
      if (t.listNotes) {
        changes.listNotes = t.listNotes.map(n => n.id === noteId ? { ...n, done: !currentDone } : n);
        if (!currentDone) {
          const note = t.listNotes.find(n => n.id === noteId);
          if (note && note.source === 'column' && t.lastReminderByColumn && t.lastReminderByColumn.noteId === noteId) {
            changes.lastReminderByColumn = null;
          } else if (note && note.source === 'panel' && t.lastReminderByPanel && t.lastReminderByPanel.noteId === noteId) {
            changes.lastReminderByPanel = null;
          }
        }
      } else {
        changes.noteDone = !currentDone;
      }
      DataLayer.updateTask(taskId, changes);
      _clearTodoTimer();
      render();
    }

    const _PRIO_RANK = { urgent_important: 0, important_not_urgent: 1, urgent_not_important: 2, quick_info: 3 };

    const allItems = _collectItems();
    const savedOrder = _getTodoOrder();
    const active = allItems
      .filter(i => !i.note.done)
      .sort((a, b) => {
        const pa = _PRIO_RANK[a.note.priority] ?? 4;
        const pb = _PRIO_RANK[b.note.priority] ?? 4;
        if (pa !== pb) return pa - pb;
        const ai = savedOrder.indexOf(a.note.id);
        const bi = savedOrder.indexOf(b.note.id);
        if (ai === -1 && bi === -1) {
          const ta = a.note.timestamp || '0', tb = b.note.timestamp || '0';
          return ta < tb ? -1 : ta > tb ? 1 : 0;
        }
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    const completed = allItems.filter(i => i.note.done);

    // ── Priority sections ─────────────────────────────────────────────────
    const _PRIO_SECTIONS = [
      { id: 'urgent_important',     label: 'Urgent',    color: '#ef4444' },
      { id: 'important_not_urgent', label: 'Important', color: '#3b82f6' },
      { id: 'urgent_not_important', label: 'Must do',   color: '#22c55e' },
      { id: 'quick_info',           label: 'Info',      color: '#9ca3af' },
    ];

    function _makePrioSection(sectionId, label, color, sectionItems) {
      const hdr = document.createElement('div');
      hdr.className = 'todo-prio-header';
      const dot = document.createElement('span');
      dot.className = 'todo-prio-dot';
      dot.style.background = color;
      hdr.appendChild(dot);
      const lbl = document.createElement('span');
      lbl.textContent = label;
      hdr.appendChild(lbl);
      if (sectionItems.length > 0) {
        const cnt = document.createElement('span');
        cnt.className = 'todo-prio-count';
        cnt.textContent = String(sectionItems.length);
        hdr.appendChild(cnt);
      }
      wrap.appendChild(hdr);

      const list = document.createElement('div');
      list.className = 'todo-list todo-prio-list';
      const dropIndicator = document.createElement('div');
      dropIndicator.className = 'todo-drop-indicator';
      dropIndicator.style.display = 'none';

      if (sectionItems.length === 0) {
        const ph = document.createElement('div');
        ph.className = 'todo-prio-drop-ph';
        ph.textContent = 'Drop here to assign';
        list.appendChild(ph);
      } else {
        sectionItems.forEach(item => list.appendChild(_makeTodoItem(item, false)));
      }

      list.addEventListener('dragover', (e) => {
        if (!_todoDragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rows = Array.from(list.querySelectorAll('.todo-item:not(.dragging)'));
        let insertBefore = null;
        for (const row of rows) {
          const rect = row.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) { insertBefore = row; break; }
        }
        if (insertBefore) list.insertBefore(dropIndicator, insertBefore);
        else list.appendChild(dropIndicator);
        dropIndicator.style.display = '';
      });
      list.addEventListener('dragleave', (e) => {
        if (!list.contains(e.relatedTarget)) dropIndicator.style.display = 'none';
      });
      list.addEventListener('drop', (e) => {
        e.preventDefault();
        dropIndicator.style.display = 'none';
        if (!_todoDragId) return;

        const draggedItem = active.find(i => i.note.id === _todoDragId);
        if (!draggedItem) { _todoDragId = null; return; }

        // Update priority if section changed
        if ((draggedItem.note.priority || null) !== (sectionId || null)) {
          const t = DataLayer.getTask(draggedItem.task.id);
          if (t) {
            DataLayer.updateTask(t.id, {
              listNotes: (t.listNotes || []).map(n =>
                n.id === _todoDragId ? Object.assign({}, n, { priority: sectionId || null }) : n
              )
            });
          }
        }

        // Recompute order with dragged item at drop position
        const rows = Array.from(list.querySelectorAll('.todo-item:not(.dragging)'));
        let insertBeforeId = null;
        for (const row of rows) {
          const rect = row.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) { insertBeforeId = row.dataset.noteId; break; }
        }
        const newOrder = _getTodoOrder().filter(id => id !== _todoDragId);
        if (insertBeforeId) {
          const idx = newOrder.indexOf(insertBeforeId);
          newOrder.splice(idx === -1 ? newOrder.length : idx, 0, _todoDragId);
        } else {
          const lastId = sectionItems.length > 0 ? sectionItems[sectionItems.length - 1].note.id : null;
          const idx = lastId ? newOrder.indexOf(lastId) : -1;
          newOrder.splice(idx === -1 ? newOrder.length : idx + 1, 0, _todoDragId);
        }
        _saveTodoOrder(newOrder);
        _todoDragId = null;
        _clearTodoTimer();
        render();
      });

      wrap.appendChild(list);
    }

    if (active.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'dash-empty';
      empty.textContent = 'All clear — no pending reminders.';
      wrap.appendChild(empty);
    } else {
      _PRIO_SECTIONS.forEach(({ id, label, color }) =>
        _makePrioSection(id, label, color, active.filter(i => i.note.priority === id))
      );
      const noPrio = active.filter(i => !i.note.priority);
      if (noPrio.length > 0) _makePrioSection(null, 'No priority', '#d1d5db', noPrio);
    }

    // ── Completed items (collapsed by default) ───────────────────────────
    if (completed.length > 0) {
      const compHeader = document.createElement('div');
      compHeader.className = 'todo-section-header todo-section-header--completed todo-section-toggle';
      const arrow = document.createElement('span');
      arrow.className = 'todo-toggle-arrow';
      arrow.textContent = _completedExpanded ? '▾' : '▸';
      const compLabel = document.createElement('span');
      compLabel.textContent = `Completed (${completed.length})`;
      compHeader.appendChild(arrow);
      compHeader.appendChild(compLabel);
      wrap.appendChild(compHeader);
      const compList = document.createElement('div');
      compList.className = 'todo-list';
      compList.style.display = _completedExpanded ? '' : 'none';
      completed.forEach(item => compList.appendChild(_makeTodoItem(item, true)));
      wrap.appendChild(compList);
      compHeader.addEventListener('click', () => {
        _completedExpanded = !_completedExpanded;
        arrow.textContent = _completedExpanded ? '▾' : '▸';
        compList.style.display = _completedExpanded ? '' : 'none';
      });
    }

    el.appendChild(cols);

    // ── Notifications column ──────────────────────────────────────────────────
    const _notifs = [];
    DataLayer.getTeams().forEach(team => {
      (team.projects || []).forEach(project => {
        (project.sections || []).forEach(section => {
          (section.tasks || []).forEach(task => {
            (task.comments || []).forEach(comment => {
              if (comment.sender !== _currentUser && !(comment.thumbsUps || []).includes(_currentUser)) {
                _notifs.push({ comment, task, team, project });
              }
            });
          });
        });
      });
    });
    _notifs.sort((a, b) => (b.comment.timestamp || '') > (a.comment.timestamp || '') ? 1 : -1);

    // Auto-advance panel when current task's notification was just acked away
    if (document.getElementById('app').classList.contains('notif-preview-open') && _previewTaskId !== null) {
      const stillInList = _notifs.some(n => n.task.id === _previewTaskId);
      if (!stillInList) {
        if (_notifs.length > 0) {
          const _next = _notifs[0];
          _previewTaskId = _next.task.id;
          DetailPanel.render(_next.task.id);
          setTimeout(() => DetailPanel.openCommentPane(_next.task.id), 50);
        } else {
          _previewTaskId = null;
          document.getElementById('app').classList.remove('notif-preview-open');
          DetailPanel.hide();
        }
      }
    }

    if (!_notifs.length) {
      const _ne = document.createElement('p');
      _ne.className = 'dash-empty';
      _ne.textContent = 'No unread notifications.';
      notifCol.appendChild(_ne);
    } else {
      _notifs.forEach(({ comment, task, team, project }) => {
        const item = document.createElement('div');
        item.className = 'notif-item';

        const _nt = document.createElement('div');
        _nt.className = 'notif-task-title';
        _nt.textContent = task.title || '(Untitled)';
        item.appendChild(_nt);

        const _np = document.createElement('div');
        _np.className = 'notif-project';
        _np.textContent = team.name + ' / ' + project.name;
        item.appendChild(_np);

        const _nc = document.createElement('div');
        _nc.className = 'notif-comment-text';
        _nc.textContent = comment.text;
        item.appendChild(_nc);

        const _nf = document.createElement('div');
        _nf.className = 'notif-footer';

        const _ns = document.createElement('span');
        _ns.className = 'notif-sender';
        _ns.textContent = comment.sender;
        _nf.appendChild(_ns);

        const _na = document.createElement('span');
        _na.className = 'notif-age';
        _na.dataset.ts = comment.timestamp || '';
        _na.textContent = comment.timestamp ? _humanAge(comment.timestamp) : '';
        _nf.appendChild(_na);
        item.appendChild(_nf);

        // Nudge for notifications older than 1 day
        const _tsMs = comment.timestamp ? Date.parse(comment.timestamp) : 0;
        if (_tsMs && (Date.now() - _tsMs) > 24 * 60 * 60 * 1000) {
          const _nudge = document.createElement('div');
          _nudge.className = 'notif-nudge';
          _nudge.textContent = 'You have a notification waiting — give a thumbs up in the comments to acknowledge you read it.';
          item.appendChild(_nudge);
        }

        item.addEventListener('click', () => {
          const appEl = document.getElementById('app');
          if (appEl.classList.contains('notif-preview-open')) {
            if (_previewTaskId === task.id) {
              // Same card — toggle close
              _previewTaskId = null;
              _clearActiveTodo();
              _clearActiveNotif();
              appEl.classList.remove('notif-preview-open');
              appEl.classList.remove('todo-panel-open');
              _detachNotifOutsideHandler();
              DetailPanel.hide();
            } else {
              // Different card — switch
              _previewTaskId = task.id;
              _clearActiveTodo();
              _clearActiveNotif();
              item.classList.add('active');
              _activeNotifItemEl = item;
              DetailPanel.render(task.id, { keepCommentPane: true });
              DetailPanel.openCommentPane(task.id);
            }
          } else {
            _previewTaskId = task.id;
            _clearActiveTodo();
            _clearActiveNotif();
            item.classList.add('active');
            _activeNotifItemEl = item;
            if (typeof OverviewCalendar !== 'undefined') OverviewCalendar.collapseIfExpanded();
            appEl.classList.remove('todo-panel-open');
            appEl.classList.add('notif-preview-open');
            DetailPanel.render(task.id);
            DetailPanel.openCommentPane(task.id);
            _attachNotifOutsideHandler();
          }
        });

        // Re-apply highlight after keepPanel re-renders
        if (task.id === _previewTaskId && document.getElementById('app').classList.contains('notif-preview-open')) {
          item.classList.add('active');
          _activeNotifItemEl = item;
        }

        notifCol.appendChild(item);
      });
    }

    // Live-updating age timer (covers both To Do ages and notification ages)
    const ageEls = cols.querySelectorAll('.todo-age, .notif-age');
    if (ageEls.length > 0) {
      _todoTimer = setInterval(() => {
        ageEls.forEach(el => {
          const ts = el.dataset.ts;
          if (ts) el.textContent = _humanAge(ts);
        });
      }, 30000); // update every 30s
    }

    function _makeTodoItem({ note, task, team, project }, isDone) {
      const item = document.createElement('div');
      item.className = 'todo-item' + (isDone ? ' done' : '');
      item.dataset.noteId = note.id;
      if (note.priority) item.dataset.priority = note.priority;

      // Drag handle (active items only)
      if (!isDone) {
        const handle = document.createElement('span');
        handle.className = 'todo-drag-handle';
        handle.textContent = '⠿';
        handle.title = 'Drag to reorder';
        item.appendChild(handle);
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
          _todoDragId = note.id;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', note.id);
          setTimeout(() => item.classList.add('dragging'), 0);
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          _todoDragId = null;
        });
      }

      // Text content
      const body = document.createElement('div');
      body.className = 'todo-body';

      const titleEl = document.createElement('div');
      titleEl.className = 'todo-task-name';
      titleEl.textContent = task.title || '(Untitled)';
      body.appendChild(titleEl);

      const projEl = document.createElement('div');
      projEl.className = 'todo-project';
      projEl.textContent = team.name + ' / ' + project.name;
      body.appendChild(projEl);

      const noteText = document.createElement('div');
      noteText.className = 'todo-note';
      noteText.textContent = note.text;
      body.appendChild(noteText);

      const footer = document.createElement('div');
      footer.className = 'todo-footer';

      const attribution = document.createElement('span');
      attribution.className = 'todo-attribution';
      const noteSender = note.sender || _currentUser;
      attribution.textContent = noteSender === _currentUser ? 'Reminder from you' : 'Reminder from ' + noteSender;
      footer.appendChild(attribution);

      const age = document.createElement('span');
      age.className = 'todo-age';
      age.dataset.ts = note.timestamp || '';
      age.textContent = note.timestamp ? _humanAge(note.timestamp) : '';
      footer.appendChild(age);

      // Checkmark button — right side of footer (mirrors thumbs-up on notification cards)
      const chk = document.createElement('button');
      chk.className = 'todo-check-btn' + (isDone ? ' checked' : '');
      chk.textContent = '✓';
      chk.title = isDone ? 'Mark as not done' : 'Mark as done';
      chk.addEventListener('click', (e) => { e.stopPropagation(); _toggleDone(note.id, task.id, isDone); });
      footer.appendChild(chk);

      body.appendChild(footer);
      item.appendChild(body);

      // Click to open/toggle task panel (not on checkmark or drag handle)
      item.addEventListener('click', (e) => {
        if (e.target.closest('.todo-check-btn') || e.target.closest('.todo-drag-handle')) return;
        const appEl = document.getElementById('app');
        const notifOpen = appEl.classList.contains('notif-preview-open');
        if (_previewTaskId === task.id && !notifOpen) {
          // Same todo already showing — toggle close
          _previewTaskId = null;
          _clearActiveTodo();
          _detachNotifOutsideHandler();
          appEl.classList.remove('todo-panel-open');
          DetailPanel.hide();
        } else {
          // Open this todo; collapse notif/cal if open
          _previewTaskId = task.id;
          _clearActiveNotif();
          _clearActiveTodo();
          if (typeof OverviewCalendar !== 'undefined') OverviewCalendar.collapseIfExpanded();
          appEl.classList.remove('notif-preview-open');
          appEl.classList.add('todo-panel-open');
          item.classList.add('active');
          _activeTodoItemEl = item;
          DetailPanel.render(task.id);
          _attachNotifOutsideHandler();
        }
      });

      // Re-apply highlight after keepPanel re-renders
      if (task.id === _previewTaskId && !document.getElementById('app').classList.contains('notif-preview-open')) {
        item.classList.add('active');
        _activeTodoItemEl = item;
      }

      return item;
    }
  }

  function _autoSave() {
    if (_draft === null) return;
    if (!_draft.name || !_draft.name.trim()) _draft.name = 'Untitled Template';
    const tmpl = JSON.parse(JSON.stringify(_draft));
    tmpl.name = tmpl.name.trim();
    if (_isNewDefault) { tmpl.isDefault = true; }
    _isNewDefault = false;
    if (_editingId) {
      DataLayer.updateTemplate(_editingId, tmpl);
    } else {
      DataLayer.addTemplate(tmpl);
    }
    _draft = null;
    _editingId = null;
  }

  return { render, clearTimers, autoSave: _autoSave };
})();
