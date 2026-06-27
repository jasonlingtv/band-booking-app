// listview.js — List view: sections and task rows
const ListView = (() => {
  'use strict';

  let _pendingEditId = null;
  let _dragKey = null; // column key currently being dragged (column header reorder)

  // ── Row/section drag state ────────────────────────────────────────────────

  let _rowDragType = null;    // 'section' | 'task'
  let _rowDragId = null;
  let _rowDropSectionId = null;
  let _rowDropBeforeId = null;

  const _indicator = document.createElement('div');
  _indicator.className = 'drag-drop-indicator';

  function _showIndicator(parent, beforeEl) {
    if (beforeEl) parent.insertBefore(_indicator, beforeEl);
    else parent.appendChild(_indicator);
  }

  function _hideIndicator() {
    if (_indicator.parentNode) _indicator.parentNode.removeChild(_indicator);
  }

  function _getInsertBefore(e, items) {
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) return item;
    }
    return null;
  }

  // ── Date helpers ──────────────────────────────────────────────────────────

  function _fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${Utils.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function _fmtDateRange(startIso, endIso) {
    if (!startIso && !endIso) return '';
    if (!endIso || startIso === endIso) return startIso ? _fmtDate(startIso) : '';
    const s = new Date(startIso), e = new Date(endIso);
    if (Utils.isSameDay(s, e)) return _fmtDate(startIso);
    const sy = s.getFullYear(), ey = e.getFullYear();
    const sm = s.getMonth(), em = e.getMonth();
    if (sy === ey && sm === em) {
      return `${s.getDate()}–${e.getDate()} ${Utils.MONTHS[sm]} ${sy}`;
    }
    if (sy === ey) {
      return `${s.getDate()} ${Utils.MONTHS[sm]} – ${e.getDate()} ${Utils.MONTHS[em]} ${sy}`;
    }
    return `${_fmtDate(startIso)} – ${_fmtDate(endIso)}`;
  }

  // ── Column header with drag-and-drop reordering ───────────────────────────

  function _renderColHeader(colOrder) {
    const header = document.createElement('div');
    header.className = 'list-col-header';

    const colLabels = { name: 'Task name', date: 'Date', notes: 'Task Reminder' };

    colOrder.forEach(key => {
      const cell = document.createElement('div');
      cell.className = `col-h col-h-${key}`;
      cell.dataset.colKey = key;

      // 'name' is locked to first position — not draggable
      if (key !== 'name') {
        cell.draggable = true;
        cell.title = 'Drag to reorder';

        const handle = document.createElement('span');
        handle.className = 'col-drag-handle';
        handle.textContent = '⠿';
        cell.appendChild(handle);

        cell.addEventListener('dragstart', (e) => {
          _dragKey = key;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', key);
          setTimeout(() => cell.classList.add('dragging'), 0);
        });

        cell.addEventListener('dragend', () => {
          cell.classList.remove('dragging');
          _dragKey = null;
        });

        cell.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (_dragKey && _dragKey !== key) cell.classList.add('drag-over');
        });

        cell.addEventListener('dragleave', () => {
          cell.classList.remove('drag-over');
        });

        cell.addEventListener('drop', (e) => {
          e.preventDefault();
          cell.classList.remove('drag-over');
          // only reorder non-name columns among themselves
          if (_dragKey && _dragKey !== key && _dragKey !== 'name') {
            const newOrder = colOrder.slice();
            const fromIdx = newOrder.indexOf(_dragKey);
            const toIdx = newOrder.indexOf(key);
            newOrder.splice(fromIdx, 1);
            newOrder.splice(toIdx, 0, _dragKey);
            DataLayer.setListColumnOrder(newOrder);
            render();
          }
        });
      }

      cell.appendChild(document.createTextNode(colLabels[key]));
      header.appendChild(cell);
    });

    const spacer = document.createElement('div');
    spacer.className = 'col-h-spacer';
    header.appendChild(spacer);

    return header;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function render() {
    const container = document.getElementById('list-view');

    // Attach container-level drag handlers once
    if (!container.dataset.dragInit) {
      container.dataset.dragInit = '1';

      container.addEventListener('dragover', (e) => {
        if (!_rowDragType) return;
        e.preventDefault();

        if (_rowDragType === 'section') {
          const blocks = Array.from(container.querySelectorAll('.section-block:not(.dragging)'));
          const beforeEl = _getInsertBefore(e, blocks);
          _rowDropBeforeId = beforeEl ? beforeEl.dataset.sectionId : null;
          _showIndicator(container, beforeEl);
        } else if (_rowDragType === 'task') {
          const sectionBlock = e.target.closest('.section-block');
          if (!sectionBlock) return;
          _rowDropSectionId = sectionBlock.dataset.sectionId;
          const tasksEl = sectionBlock.querySelector('.section-tasks');
          if (!tasksEl) {
            // Collapsed section — drop at end
            _rowDropBeforeId = null;
            _showIndicator(sectionBlock, null);
            return;
          }
          const rows = Array.from(tasksEl.querySelectorAll('.task-row:not(.dragging)'));
          // Hovering over section header → drop at top of section
          if (e.target.closest('.section-header')) {
            _rowDropBeforeId = rows[0] ? rows[0].dataset.taskId : null;
            _showIndicator(tasksEl, rows[0] || null);
            return;
          }
          const beforeEl = _getInsertBefore(e, rows);
          _rowDropBeforeId = beforeEl ? beforeEl.dataset.taskId : null;
          _showIndicator(tasksEl, beforeEl);
        }
      });

      container.addEventListener('dragleave', (e) => {
        if (!_rowDragType) return;
        if (!container.contains(e.relatedTarget)) _hideIndicator();
      });

      container.addEventListener('drop', (e) => {
        if (!_rowDragType) return;
        e.preventDefault();
        _hideIndicator();

        if (_rowDragType === 'section') {
          const projectId = DataLayer.getActiveProjectId();
          const sections = DataLayer.getSections(projectId);
          const fromIdx = sections.findIndex(s => s.id === _rowDragId);
          const beforeIdx = _rowDropBeforeId
            ? sections.findIndex(s => s.id === _rowDropBeforeId) : -1;
          const toIdx = beforeIdx < 0
            ? sections.length - 1
            : (fromIdx < beforeIdx ? beforeIdx - 1 : beforeIdx);
          _rowDropBeforeId = null;
          if (fromIdx !== toIdx && toIdx >= 0) {
            DataLayer.reorderSections(projectId, fromIdx, toIdx);
            render();
          }
        } else if (_rowDragType === 'task') {
          const targetSectionId = _rowDropSectionId;
          _rowDropSectionId = null;
          if (!targetSectionId) { _rowDropBeforeId = null; return; }
          const targetSection = DataLayer.getSection(targetSectionId);
          if (!targetSection) { _rowDropBeforeId = null; return; }
          let targetIdx;
          if (_rowDropBeforeId === null) {
            targetIdx = targetSection.tasks.length;
          } else {
            targetIdx = targetSection.tasks.findIndex(t => t.id === _rowDropBeforeId);
            if (targetIdx < 0) targetIdx = targetSection.tasks.length;
          }
          _rowDropBeforeId = null;
          DataLayer.moveTaskToPosition(_rowDragId, targetSectionId, targetIdx);
          render();
          if (DataLayer.getActiveTaskId() === _rowDragId) {
            Utils.EventBus.emit('task:updated', _rowDragId);
          }
        }

        _rowDragType = null;
        _rowDragId = null;
      });
    }

    container.innerHTML = '';
    const projectId = DataLayer.getActiveProjectId();
    if (!projectId) {
      container.innerHTML = '<div class="empty-state"><p>Select a project to get started.</p></div>';
      return;
    }
    const sections = DataLayer.getSections(projectId);
    if (!sections.length) {
      container.innerHTML = '<div class="empty-state"><p>No sections yet. Add one using the section menu.</p></div>';
      return;
    }

    const colOrder = DataLayer.getListColumnOrder();
    container.appendChild(_renderColHeader(colOrder));
    sections.forEach(section => {
      container.appendChild(_renderSection(section, colOrder));
    });
  }

  function _sectionColorClass(color) {
    return 'color-' + (color || 'amber');
  }

  function _renderSection(section, colOrder) {
    const colorClass = _sectionColorClass(section.color);
    const block = document.createElement('div');
    block.className = `section-block ${colorClass}`;
    block.dataset.sectionId = section.id;

    // Header
    const header = document.createElement('div');
    header.className = 'section-header';
    header.draggable = true;

    header.addEventListener('dragstart', (e) => {
      _rowDragType = 'section';
      _rowDragId = section.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', section.id);
      setTimeout(() => block.classList.add('dragging'), 0);
    });

    header.addEventListener('dragend', () => {
      block.classList.remove('dragging');
      _rowDragType = null;
      _rowDragId = null;
      _hideIndicator();
    });

    header.addEventListener('click', (e) => {
      if (e.target.closest('.section-menu-btn') || e.target.closest('.section-drag-handle')) return;
      DataLayer.updateSection(section.id, { collapsed: !section.collapsed });
      render();
    });

    const dragHandle = document.createElement('span');
    dragHandle.className = 'section-drag-handle';
    dragHandle.textContent = '⠿';
    dragHandle.title = 'Drag to reorder';

    const chevron = document.createElement('span');
    chevron.className = 'section-chevron' + (section.collapsed ? '' : ' open');
    chevron.textContent = '›';

    const nameEl = document.createElement('span');
    nameEl.className = 'section-name';
    nameEl.textContent = section.name;

    const count = document.createElement('span');
    count.className = 'section-count';
    count.textContent = `(${section.tasks.length})`;

    const menuBtn = document.createElement('button');
    menuBtn.className = 'section-menu-btn';
    menuBtn.title = 'Section options';
    menuBtn.textContent = '•••';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _openSectionMenu(menuBtn, section);
    });

    header.appendChild(dragHandle);
    header.appendChild(chevron);
    header.appendChild(nameEl);
    header.appendChild(count);
    header.appendChild(menuBtn);
    block.appendChild(header);

    if (!section.collapsed) {
      const tasksEl = document.createElement('div');
      tasksEl.className = 'section-tasks';
      section.tasks.forEach(task => {
        tasksEl.appendChild(_renderTaskRow(task, section, colorClass, colOrder));
      });
      block.appendChild(tasksEl);
    }

    return block;
  }

  // ── Column cell factories ─────────────────────────────────────────────────

  function _makeNameCol(task) {
    const col = document.createElement('div');
    col.className = 'task-col-name';

    if (_pendingEditId === task.id) {
      const input = document.createElement('input');
      input.className = 'task-title-input';
      input.type = 'text';
      input.value = task.title;
      input.placeholder = 'Task title…';
      let committed = false;

      function commit() {
        if (committed) return;
        committed = true;
        const raw = input.value.trim();
        if (!raw) {
          DataLayer.deleteTask(task.id);
        } else {
          DataLayer.updateTask(task.id, Utils.taskTitleChanges(raw));
        }
        _pendingEditId = null;
        render();
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') {
          committed = true;
          DataLayer.deleteTask(task.id);
          _pendingEditId = null;
          render();
        }
      });
      input.addEventListener('blur', commit);
      col.appendChild(input);
      setTimeout(() => input.focus(), 0);
    } else {
      const span = document.createElement('span');
      span.className = 'task-title' + (task.done ? ' done' : '') + (!task.title ? ' placeholder' : '');
      span.textContent = task.title || 'Untitled';
      col.appendChild(span);
    }

    return col;
  }

  function _makeDateCol(task) {
    const col = document.createElement('div');
    col.className = 'task-col-date';
    if (task.startDate || task.endDate) {
      col.textContent = _fmtDateRange(task.startDate, task.endDate);
    }
    return col;
  }

  function _makeNotesCol(task) {
    const col = document.createElement('div');
    col.className = 'task-col-notes';

    function refreshDisplay() {
      col.innerHTML = '';
      const t = DataLayer.getTask(task.id);
      const last = t && t.lastReminderByColumn;
      const span = document.createElement('span');
      if (last) {
        span.className = 'task-note-text task-note-sent';
        span.textContent = last.text;
      } else {
        span.className = 'task-note-text placeholder';
        span.textContent = 'Add a reminder…';
      }
      col.appendChild(span);
    }

    col.addEventListener('click', (e) => {
      e.stopPropagation();
      if (col.querySelector('input')) return;
      col.innerHTML = '';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'task-notes-input';
      input.value = '';
      input.placeholder = 'Add a reminder…';
      let committed = false;

      function commitNote() {
        if (committed) return;
        committed = true;
        const text = input.value.trim();
        if (text) {
          const t = DataLayer.getTask(task.id);
          const notes = t && t.listNotes ? [...t.listNotes] : [];
          const noteId = Utils.generateId();
          notes.push({ id: noteId, text, timestamp: new Date().toISOString(), done: false, source: 'column' });
          DataLayer.updateTask(task.id, { listNotes: notes, lastReminderByColumn: { noteId, text } });
          UIHelpers.showSaved();
        }
        refreshDisplay();
      }

      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); commitNote(); }
        if (ev.key === 'Escape') { committed = true; refreshDisplay(); }
      });
      input.addEventListener('blur', () => setTimeout(commitNote, 100));
      col.appendChild(input);
      setTimeout(() => input.focus(), 0);
    });

    refreshDisplay();
    return col;
  }

  // ── Task row ──────────────────────────────────────────────────────────────

  function _renderTaskRow(task, section, colorClass, colOrder) {
    const activeTaskId = DataLayer.getActiveTaskId();
    const row = document.createElement('div');
    row.className = `task-row${task.id === activeTaskId ? ' active' : ''}`;
    row.dataset.taskId = task.id;
    row.draggable = true;

    row.addEventListener('dragstart', (e) => {
      _rowDragType = 'task';
      _rowDragId = task.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      e.stopPropagation(); // don't trigger section drag
      setTimeout(() => row.classList.add('dragging'), 0);
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      _rowDragType = null;
      _rowDragId = null;
      _hideIndicator();
    });

    // Left border accent (absolute, outside flex flow)
    const border = document.createElement('div');
    border.className = 'task-row-left-border';
    row.appendChild(border);

    // Checkbox
    const chk = document.createElement('div');
    chk.className = 'task-checkbox' + (task.done ? ' checked' : '');
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      DataLayer.updateTask(task.id, { done: !task.done });
      render();
      if (DataLayer.getActiveTaskId() === task.id) {
        Utils.EventBus.emit('task:updated', task.id);
      }
    });
    row.appendChild(chk);

    // Columns in persisted order
    colOrder.forEach(key => {
      if (key === 'name') row.appendChild(_makeNameCol(task));
      else if (key === 'date') row.appendChild(_makeDateCol(task));
      else if (key === 'notes') row.appendChild(_makeNotesCol(task));
    });

    // Unread comment pulse
    const taskComments = task.comments || [];
    if (taskComments.length > 0) {
      const lastRead = DetailPanel.getCommentReadTime(task.id);
      const hasUnread = taskComments.some(c => c.sender !== 'Jason' && (!lastRead || c.timestamp > lastRead));
      if (hasUnread) {
        const pulse = document.createElement('div');
        pulse.className = 'comment-unread-pulse';
        pulse.title = 'Unread comment';
        row.appendChild(pulse);
      }
    }

    // Menu button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'task-menu-btn';
    menuBtn.title = 'Task options';
    menuBtn.textContent = '•••';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _openTaskMenu(menuBtn, task, section);
    });
    row.appendChild(menuBtn);

    // Row click → open/close detail panel (not when clicking notes or menu)
    row.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox') ||
          e.target.closest('.task-menu-btn') ||
          e.target.closest('.task-title-input') ||
          e.target.closest('.task-col-notes')) return;
      const currentActive = DataLayer.getActiveTaskId();
      if (currentActive === task.id) {
        DataLayer.setActiveTaskId(null);
        Utils.EventBus.emit('task:selected', null);
      } else {
        DataLayer.setActiveTaskId(task.id);
        Utils.EventBus.emit('task:selected', task.id);
      }
      render();
    });

    return row;
  }

  // ── Menus ─────────────────────────────────────────────────────────────────

  function _openSectionMenu(btn, section) {
    const projectId = DataLayer.getActiveProjectId();
    UIHelpers.openMenu(btn, [
      { label: 'New Task', action: () => _addTask(section.id) },
      { label: 'New Section', action: () => {
        const name = window.prompt('Section name:');
        if (name && name.trim()) {
          DataLayer.addSection(projectId, name.trim(), 'amber');
          render();
        }
      }},
      'divider',
      { label: 'Rename', action: () => {
        const name = UIHelpers.promptRename(section.name, 'section');
        if (name) { DataLayer.updateSection(section.id, { name }); render(); }
      }},
      { label: 'Delete', danger: true, action: () => {
        if (confirm(`Delete section "${section.name}" and all its tasks?`)) {
          DataLayer.deleteSection(section.id);
          Utils.EventBus.emit('task:selected', null);
          render();
        }
      }}
    ]);
  }

  function _openTaskMenu(btn, task, section) {
    const projectId = DataLayer.getActiveProjectId();
    UIHelpers.openMenu(btn, [
      { label: 'New task after', action: () => {
        const projectId = DataLayer.getActiveProjectId();
        const template = DataLayer.getProjectTemplate(projectId);
        if (template) {
          UIHelpers.openTaskTypeModal(
            template.name,
            () => { const t = DataLayer.addTaskAfter(task.id, section.id); _pendingEditId = t.id; render(); },
            () => { const t = DataLayer.addTaskAfter(task.id, section.id, { blank: true }); _pendingEditId = t.id; render(); }
          );
        } else {
          const t = DataLayer.addTaskAfter(task.id, section.id);
          _pendingEditId = t.id;
          render();
        }
      }},
      { label: 'Duplicate', action: () => {
        DataLayer.duplicateTask(task.id);
        render();
      }},
      'divider',
      { label: 'New section after', action: () => {
        const name = window.prompt('Section name:');
        if (name && name.trim()) {
          DataLayer.addSection(projectId, name.trim(), 'amber');
          render();
        }
      }},
      'divider',
      { label: 'Rename task', action: () => {
        const name = UIHelpers.promptRename(task.title, 'task');
        if (name) {
          DataLayer.updateTask(task.id, Utils.taskTitleChanges(name));
          if (DataLayer.getActiveTaskId() === task.id) {
            Utils.EventBus.emit('task:updated', task.id);
          }
          render();
        }
      }},
      { label: 'Delete task', danger: true, action: () => {
        if (DataLayer.getActiveTaskId() === task.id) {
          DataLayer.setActiveTaskId(null);
          Utils.EventBus.emit('task:selected', null);
        }
        DataLayer.deleteTask(task.id);
        render();
      }}
    ]);
  }

  function _addTask(sectionId) {
    DataLayer.updateSection(sectionId, { collapsed: false });
    const projectId = DataLayer.getActiveProjectId();
    const template = DataLayer.getProjectTemplate(projectId);
    if (template) {
      UIHelpers.openTaskTypeModal(
        template.name,
        () => { const t = DataLayer.addTask(sectionId); _pendingEditId = t.id; render(); },
        () => { const t = DataLayer.addTask(sectionId, { blank: true }); _pendingEditId = t.id; render(); }
      );
    } else {
      const t = DataLayer.addTask(sectionId);
      _pendingEditId = t.id;
      render();
    }
  }

  return { render };
})();
