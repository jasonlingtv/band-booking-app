// dashboard.js — Template management dashboard (Settings screen)
const Dashboard = (() => {
  'use strict';

  let _draft = null;      // deep clone of template being edited; null when on list view
  let _editingId = null;  // id of template being edited; null for a new template
  let _dashTab = 'templates'; // 'templates' | 'todo'
  let _todoTimer = null;

  function _clearTodoTimer() {
    if (_todoTimer) { clearInterval(_todoTimer); _todoTimer = null; }
  }

  function clearTimers() { _clearTodoTimer(); }

  const FIELD_TYPES = [
    { value: 'text',               label: 'Text (single line)' },
    { value: 'textarea',           label: 'Text (multi-line)' },
    { value: 'link',               label: 'Link' },
    { value: 'date',               label: 'Date picker' },
    { value: 'dropdown',           label: 'Dropdown' },
    { value: 'toggle',             label: 'Toggle (pill buttons)' },
    { value: 'auto',               label: 'Auto (computed, read-only)' },
    { value: 'time-select',        label: 'Time select' },
    { value: 'time-select-na',     label: 'Time select (N/A option)' },
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

  function render() {
    _clearTodoTimer();
    const el = document.getElementById('dashboard-view');
    el.innerHTML = '';
    if (_draft !== null) {
      _renderEditor(el);
      return;
    }
    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'dash-tab-bar';
    [['templates', 'Templates'], ['todo', 'To Do']].forEach(([id, label]) => {
      const btn = document.createElement('button');
      btn.className = 'dash-tab-btn' + (_dashTab === id ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => { _dashTab = id; render(); });
      tabBar.appendChild(btn);
    });
    el.appendChild(tabBar);

    if (_dashTab === 'todo') {
      _renderTodo(el);
    } else {
      _renderList(el);
    }
  }

  // ── List view ─────────────────────────────────────────────────────────────

  function _renderList(el) {
    const wrap = document.createElement('div');
    wrap.className = 'dash-wrap';

    const header = document.createElement('div');
    header.className = 'dash-header';

    const title = document.createElement('h2');
    title.className = 'dash-title';
    title.textContent = 'Templates';

    const createBtn = document.createElement('button');
    createBtn.className = 'dash-btn-primary';
    createBtn.textContent = '+ Create New Template';
    createBtn.addEventListener('click', () => {
      _editingId = null;
      _draft = _newDraft();
      render();
    });

    header.appendChild(title);
    header.appendChild(createBtn);
    wrap.appendChild(header);

    const templates = DataLayer.getTemplates();
    const list = document.createElement('div');
    list.className = 'dash-template-list';

    if (!templates.length) {
      const empty = document.createElement('p');
      empty.className = 'dash-empty';
      empty.textContent = 'No templates yet.';
      list.appendChild(empty);
    } else {
      templates.forEach(tmpl => {
        list.appendChild(_renderTemplateRow(tmpl));
      });
    }

    wrap.appendChild(list);
    el.appendChild(wrap);
  }

  function _renderTemplateRow(tmpl) {
    const row = document.createElement('div');
    row.className = 'dash-template-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'dash-template-name';
    nameEl.textContent = tmpl.name || '(Unnamed)';

    const psCount = (tmpl.projectSections || []).length;
    const tsCount = (tmpl.taskSections || []).length;
    const meta = document.createElement('span');
    meta.className = 'dash-template-meta';
    meta.textContent = `${psCount} project section${psCount !== 1 ? 's' : ''} · ${tsCount} task section${tsCount !== 1 ? 's' : ''}`;

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

    const delBtn = document.createElement('button');
    delBtn.className = 'dash-btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => _confirmDelete(tmpl.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(nameEl);
    row.appendChild(meta);
    row.appendChild(actions);
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

  // ── Editor ────────────────────────────────────────────────────────────────

  function _newDraft() {
    return {
      id: Utils.generateId(),
      name: '',
      projectSections: [],
      taskFeatures: { reminders: { enabled: false, items: [] } },
      taskSections: [
        {
          id: Utils.generateId(),
          name: 'Overview',
          modules: [
            { id: Utils.generateId(), name: '', defaultOpen: true, fields: [] }
          ]
        }
      ]
    };
  }

  function _renderEditor(el) {
    const wrap = document.createElement('div');
    wrap.className = 'dash-wrap';

    // Back link
    const backBtn = document.createElement('button');
    backBtn.className = 'dash-back-btn';
    backBtn.textContent = '← Back to Templates';
    backBtn.addEventListener('click', () => { _draft = null; _editingId = null; render(); });
    wrap.appendChild(backBtn);

    // Heading
    const heading = document.createElement('h2');
    heading.className = 'dash-title';
    heading.textContent = _editingId ? 'Edit Template' : 'New Template';
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
    nameInput.addEventListener('input', () => { _draft.name = nameInput.value; });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    wrap.appendChild(nameRow);

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
        _draft.projectSections.push({ id: Utils.generateId(), name: '' });
        rerenderPs();
        setTimeout(() => {
          const inputs = psList.querySelectorAll('.editor-ps-name');
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 10);
      }, 'editor-add-btn--sm');
      psList.appendChild(psAddBtn);
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
    tsHint.textContent = 'Fields shown inside each task\'s detail panel (TS → TM → TL structure).';
    wrap.appendChild(tsHint);

    // TS list container
    const tsList = document.createElement('div');
    tsList.className = 'editor-ts-list';
    wrap.appendChild(tsList);

    function rerenderTs() {
      tsList.innerHTML = '';
      _draft.taskSections.forEach((ts, idx) => {
        tsList.appendChild(_buildTS(ts, idx, rerenderTs));
      });
      const addBtn = _addBtn('+ Add Task Section', () => {
        _draft.taskSections.push({
          id: Utils.generateId(),
          name: 'New Section',
          modules: [{ id: Utils.generateId(), name: '', defaultOpen: true, fields: [] }]
        });
        rerenderTs();
      });
      tsList.appendChild(addBtn);
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

    el.appendChild(wrap);
    // Focus template name if empty (new template)
    if (!_draft.name) setTimeout(() => nameInput.focus(), 0);
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
    nameInput.addEventListener('input', () => { ps.name = nameInput.value; });

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
    nameInput.placeholder = 'Section name (e.g. Overview, Advance Information)';
    nameInput.addEventListener('input', () => { ts.name = nameInput.value; });

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
      const addBtn = _addBtn('+ Add Module', () => {
        ts.modules.push({ id: Utils.generateId(), name: '', defaultOpen: false, fields: [] });
        rerenderTm();
      }, 'editor-add-btn--sm');
      tmList.appendChild(addBtn);
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
    nameInput.placeholder = 'Module name — leave blank for flat (no heading)';
    nameInput.addEventListener('input', () => { tm.name = nameInput.value; });

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
      const addBtn = _addBtn('+ Add Field', () => {
        tm.fields.push({ id: Utils.generateId(), name: '', type: 'text' });
        rerenderTl();
      }, 'editor-add-btn--xs');
      tlList.appendChild(addBtn);
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
    nameInput.placeholder = 'Field label (e.g. CAPACITY)';
    nameInput.addEventListener('input', () => { field.name = nameInput.value; });

    const typeSelect = document.createElement('select');
    typeSelect.className = 'editor-tl-type';
    FIELD_TYPES.forEach(ft => {
      const opt = document.createElement('option');
      opt.value = ft.value;
      opt.textContent = ft.label;
      if (ft.value === (field.type || 'text')) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      field.type = typeSelect.value;
      if (field.type !== 'toggle')   delete field.toggleOptions;
      if (field.type !== 'dropdown') delete field.dropdownOptions;
      if (field.type !== 'auto')     delete field.autoSource;
      rerender();
    });

    const ctrls = _controls(
      tlIdx,
      tm.fields.length,
      () => { tm.fields.splice(tlIdx - 1, 0, tm.fields.splice(tlIdx, 1)[0]); rerender(); },
      () => { tm.fields.splice(tlIdx + 1, 0, tm.fields.splice(tlIdx, 1)[0]); rerender(); },
      () => { tm.fields.splice(tlIdx, 1); rerender(); },
      () => { tm.fields.splice(tlIdx + 1, 0, _cloneField(field)); rerender(); }
    );

    main.appendChild(nameInput);
    main.appendChild(typeSelect);
    main.appendChild(ctrls);
    row.appendChild(main);

    if (field.type === 'toggle')   row.appendChild(_buildToggleOpts(field, rerender));
    if (field.type === 'dropdown') row.appendChild(_buildDropdownOpts(field, rerender));
    if (field.type === 'auto')     row.appendChild(_buildAutoSource(field));

    return row;
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

      const valIn = _miniInput(opt.value, 'value (stored)', v => { opt.value = v; });
      const lblIn = _miniInput(opt.label, 'label (displayed)', v => { opt.label = v; });
      const rm = _removeBtn(() => { field.toggleOptions.splice(i, 1); rerender(); });

      optRow.appendChild(valIn);
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
      const valIn  = _miniInput(opt.value, 'value (stored)', v => { opt.value = v; });
      const lblIn  = _miniInput(opt.label, 'label (displayed)', v => { opt.label = v; });
      const rm     = _removeBtn(() => { field.dropdownOptions.splice(i, 1); rerender(); });
      optRow.appendChild(valIn);
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

  function _miniInput(val, placeholder, onChange) {
    const input = document.createElement('input');
    input.className = 'editor-mini-input';
    input.type = 'text';
    input.value = val;
    input.placeholder = placeholder;
    input.addEventListener('input', () => onChange(input.value));
    return input;
  }

  // ── Task Features builder ─────────────────────────────────────────────────

  function _buildTaskFeatures(rerender) {
    if (!_draft.taskFeatures) _draft.taskFeatures = {};
    if (!_draft.taskFeatures.reminders) _draft.taskFeatures.reminders = { enabled: false, items: [] };
    const rem = _draft.taskFeatures.reminders;

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
    lbl.textContent = 'Task Reminders';

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
          nameInput.addEventListener('input', () => { item.name = nameInput.value; });

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
          rem.items.push({ id: Utils.generateId(), name: '' });
          rerenderItems();
          setTimeout(() => {
            const inputs = itemsList.querySelectorAll('.editor-ps-name');
            if (inputs.length) inputs[inputs.length - 1].focus();
          }, 10);
        }, 'editor-add-btn--sm');
        itemsList.appendChild(addBtn);
      }

      rerenderItems();
      block.appendChild(itemsList);
    }

    return block;
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
    const wrap = document.createElement('div');
    wrap.className = 'dash-wrap';

    // Gather all tasks with notes across all teams/projects
    function _collectItems() {
      const items = [];
      DataLayer.getTeams().forEach(team => {
        (team.projects || []).forEach(project => {
          (project.sections || []).forEach(section => {
            (section.tasks || []).forEach(task => {
              if (task.listNote && task.listNote.trim()) {
                items.push({ task, team, project });
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

    function _toggleDone(taskId, currentDone) {
      DataLayer.updateTask(taskId, { noteDone: !currentDone });
      _clearTodoTimer();
      render();
    }

    const allItems = _collectItems();
    const active = allItems
      .filter(i => !i.task.noteDone)
      .sort((a, b) => {
        const ta = a.task.listNoteTimestamp || '0';
        const tb = b.task.listNoteTimestamp || '0';
        return ta < tb ? -1 : ta > tb ? 1 : 0; // oldest first
      });
    const completed = allItems.filter(i => i.task.noteDone);

    // ── Active items ─────────────────────────────────────────────────────
    const activeHeader = document.createElement('div');
    activeHeader.className = 'todo-section-header';
    activeHeader.textContent = active.length === 0 ? 'To Do — All clear!' : `To Do (${active.length})`;
    wrap.appendChild(activeHeader);

    if (active.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'dash-empty';
      empty.textContent = 'No pending notes.';
      wrap.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'todo-list';
      active.forEach(({ task, team, project }) => {
        list.appendChild(_makeTodoItem(task, team, project, false));
      });
      wrap.appendChild(list);
    }

    // ── Completed items ──────────────────────────────────────────────────
    if (completed.length > 0) {
      const compHeader = document.createElement('div');
      compHeader.className = 'todo-section-header todo-section-header--completed';
      compHeader.textContent = `Completed (${completed.length})`;
      wrap.appendChild(compHeader);
      const compList = document.createElement('div');
      compList.className = 'todo-list';
      completed.forEach(({ task, team, project }) => {
        compList.appendChild(_makeTodoItem(task, team, project, true));
      });
      wrap.appendChild(compList);
    }

    el.appendChild(wrap);

    // Live-updating age timer
    const ageEls = wrap.querySelectorAll('.todo-age');
    if (ageEls.length > 0) {
      _todoTimer = setInterval(() => {
        ageEls.forEach(el => {
          const ts = el.dataset.ts;
          if (ts) el.textContent = _humanAge(ts);
        });
      }, 30000); // update every 30s
    }

    function _makeTodoItem(task, team, project, isDone) {
      const item = document.createElement('div');
      item.className = 'todo-item' + (isDone ? ' done' : '');

      // Checkbox
      const chk = document.createElement('div');
      chk.className = 'todo-checkbox' + (isDone ? ' checked' : '');
      chk.addEventListener('click', (e) => { e.stopPropagation(); _toggleDone(task.id, isDone); });
      item.appendChild(chk);

      // Text content
      const body = document.createElement('div');
      body.className = 'todo-body';

      const noteText = document.createElement('div');
      noteText.className = 'todo-note';
      noteText.textContent = task.listNote;
      body.appendChild(noteText);

      const meta = document.createElement('div');
      meta.className = 'todo-meta';

      const taskName = document.createElement('span');
      taskName.className = 'todo-task-name';
      taskName.textContent = task.title || '(Untitled)';
      meta.appendChild(taskName);

      const sep = document.createElement('span');
      sep.className = 'todo-sep';
      sep.textContent = '·';
      meta.appendChild(sep);

      const proj = document.createElement('span');
      proj.className = 'todo-project';
      proj.textContent = team.name + ' / ' + project.name;
      meta.appendChild(proj);

      body.appendChild(meta);

      const age = document.createElement('span');
      age.className = 'todo-age';
      age.dataset.ts = task.listNoteTimestamp || '';
      age.textContent = task.listNoteTimestamp ? _humanAge(task.listNoteTimestamp) : '';
      body.appendChild(age);

      item.appendChild(body);

      // Click to navigate (not on checkbox)
      item.addEventListener('click', (e) => {
        if (e.target.closest('.todo-checkbox')) return;
        _navigate(task.id, project.id);
      });

      return item;
    }
  }

  return { render, clearTimers };
})();
