// boardview.js — Kanban / Board view: one column per section
const BoardView = (() => {
  'use strict';

  function render() {
    const container = document.getElementById('board-view');
    container.innerHTML = '';
    const projectId = DataLayer.getActiveProjectId();
    if (!projectId) {
      container.innerHTML = '<div class="empty-state"><p>Select a project to get started.</p></div>';
      return;
    }
    const sections = DataLayer.getSections(projectId);
    if (!sections.length) {
      container.innerHTML = '<div class="empty-state"><p>No sections yet.</p></div>';
      return;
    }
    sections.forEach(section => {
      container.appendChild(_renderColumn(section));
    });
  }

  function _renderColumn(section) {
    const colorClass = 'color-' + (section.color || 'amber');
    const col = document.createElement('div');
    col.className = `board-column ${colorClass}`;

    // Header
    const header = document.createElement('div');
    header.className = 'board-col-header';

    const dot = document.createElement('span');
    dot.className = 'section-color-dot';

    const title = document.createElement('span');
    title.className = 'board-col-title';
    title.textContent = section.name;

    const count = document.createElement('span');
    count.className = 'board-col-count';
    count.textContent = section.tasks.length;

    header.appendChild(dot);
    header.appendChild(title);
    header.appendChild(count);
    col.appendChild(header);

    // Tasks
    const tasksEl = document.createElement('div');
    tasksEl.className = 'board-tasks';
    section.tasks.forEach(task => {
      tasksEl.appendChild(_renderCard(task, colorClass));
    });
    col.appendChild(tasksEl);

    return col;
  }

  function _renderCard(task, colorClass) {
    const card = document.createElement('div');
    card.className = `board-card ${colorClass}`;
    card.dataset.taskId = task.id;

    const titleEl = document.createElement('div');
    titleEl.className = 'board-card-title';
    titleEl.textContent = task.title || 'Untitled';
    if (task.done) titleEl.style.textDecoration = 'line-through';
    card.appendChild(titleEl);

    if (task.startDate || task.endDate) {
      const dateEl = document.createElement('div');
      dateEl.className = 'board-card-date';
      const start = task.startDate ? Utils.formatDateShort(task.startDate) : '';
      const end = task.endDate ? Utils.formatDateShort(task.endDate) : '';
      dateEl.textContent = start && end && start !== end ? `${start} – ${end}` : (start || end);
      card.appendChild(dateEl);
    }

    card.addEventListener('click', () => {
      const currentActive = DataLayer.getActiveTaskId();
      if (currentActive === task.id) {
        DataLayer.setActiveTaskId(null);
        Utils.EventBus.emit('task:selected', null);
      } else {
        DataLayer.setActiveTaskId(task.id);
        Utils.EventBus.emit('task:selected', task.id);
      }
    });

    return card;
  }

  return { render };
})();
