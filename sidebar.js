// sidebar.js — Sidebar: teams, projects, collapse/expand, menus
const Sidebar = (() => {
  'use strict';

  // ── Drag state ────────────────────────────────────────────────────────────

  let _dragType = null;    // 'team' | 'project'
  let _dragId = null;
  let _dragTeamId = null;
  let _dropBeforeId = null;

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

  function _computeToIdx(fromIdx, beforeIdx, total) {
    if (beforeIdx < 0) return total - 1; // append
    return fromIdx < beforeIdx ? beforeIdx - 1 : beforeIdx;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // ── Template-aware project creation ──────────────────────────────────────

  function _addProjectFlow(teamId, triggerBtn) {
    const name = UIHelpers.promptRename('New Project', 'project');
    if (!name) return;
    const templates = DataLayer.getTemplates();

    const items = templates.map(t => ({
      label: t.name,
      action: () => {
        const project = DataLayer.addProject(teamId, name, t.id);
        DataLayer.setActiveProjectId(project.id);
        Utils.EventBus.emit('project:changed');
        render();
      }
    }));

    if (items.length) items.push('divider');
    items.push({
      label: 'Blank Project',
      action: () => {
        const project = DataLayer.addProject(teamId, name, null);
        DataLayer.setActiveProjectId(project.id);
        Utils.EventBus.emit('project:changed');
        render();
      }
    });

    setTimeout(() => UIHelpers.openMenu(triggerBtn, items), 0);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    const el = document.getElementById('teams-list');

    // Update gear icon active state
    const isDash = !document.getElementById('dashboard-view').classList.contains('hidden');
    const gearBtn = document.getElementById('dashboard-btn');
    if (gearBtn) gearBtn.classList.toggle('active', isDash);

    // Attach container-level drag handlers for TEAM reordering once
    if (!el.dataset.dragInit) {
      el.dataset.dragInit = '1';

      el.addEventListener('dragover', (e) => {
        if (_dragType !== 'team') return;
        e.preventDefault();
        const items = Array.from(el.querySelectorAll(':scope > .team-item:not(.dragging)'));
        const beforeEl = _getInsertBefore(e, items);
        _dropBeforeId = beforeEl ? beforeEl.dataset.teamId : null;
        _showIndicator(el, beforeEl);
      });

      el.addEventListener('dragleave', (e) => {
        if (_dragType !== 'team') return;
        if (!el.contains(e.relatedTarget)) _hideIndicator();
      });

      el.addEventListener('drop', (e) => {
        if (_dragType !== 'team') return;
        e.preventDefault();
        _hideIndicator();
        const teams = DataLayer.getTeams();
        const fromIdx = teams.findIndex(t => t.id === _dragId);
        const beforeIdx = _dropBeforeId ? teams.findIndex(t => t.id === _dropBeforeId) : -1;
        const toIdx = _computeToIdx(fromIdx, beforeIdx, teams.length);
        _dropBeforeId = null;
        if (fromIdx !== toIdx && toIdx >= 0) {
          DataLayer.reorderTeams(fromIdx, toIdx);
          render();
        }
      });
    }

    el.innerHTML = '';
    const activeProjectId = DataLayer.getActiveProjectId();
    DataLayer.getTeams().forEach(team => {
      el.appendChild(_renderTeam(team, activeProjectId));
    });
  }

  function _renderTeam(team, activeProjectId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'team-item';
    wrapper.draggable = true;
    wrapper.dataset.teamId = team.id;

    wrapper.addEventListener('dragstart', (e) => {
      _dragType = 'team';
      _dragId = team.id;
      _dragTeamId = null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', team.id);
      setTimeout(() => wrapper.classList.add('dragging'), 0);
    });

    wrapper.addEventListener('dragend', () => {
      wrapper.classList.remove('dragging');
      _dragType = null;
      _dragId = null;
      _hideIndicator();
    });

    // Header
    const header = document.createElement('div');
    header.className = 'team-header';
    header.addEventListener('click', (e) => {
      if (e.target.closest('.team-menu-btn') || e.target.closest('.team-add-btn')) return;
      DataLayer.updateTeam(team.id, { collapsed: !team.collapsed });
      render();
    });

    const chevron = document.createElement('span');
    chevron.className = 'team-chevron' + (team.collapsed ? '' : ' open');
    chevron.textContent = '›';

    const nameEl = document.createElement('span');
    nameEl.className = 'team-name';
    nameEl.textContent = team.name;

    const addBtn = document.createElement('button');
    addBtn.className = 'team-add-btn';
    addBtn.title = 'Add project';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _addProjectFlow(team.id, addBtn);
    });

    const menuBtn = document.createElement('button');
    menuBtn.className = 'team-menu-btn';
    menuBtn.title = 'Team options';
    menuBtn.textContent = '•••';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      UIHelpers.openMenu(menuBtn, [
        { label: 'Rename team', action: () => {
          const name = UIHelpers.promptRename(team.name, 'team');
          if (name) { DataLayer.updateTeam(team.id, { name }); render(); }
        }},
        { label: 'Add project', action: () => { _addProjectFlow(team.id, menuBtn); } },
        'divider',
        { label: 'Delete team', danger: true, action: () => {
          if (confirm(`Delete team "${team.name}" and all its projects?`)) {
            DataLayer.deleteTeam(team.id);
            Utils.EventBus.emit('project:changed');
            render();
          }
        }}
      ]);
    });

    header.appendChild(chevron);
    header.appendChild(nameEl);
    header.appendChild(addBtn);
    header.appendChild(menuBtn);
    wrapper.appendChild(header);

    // Projects
    if (!team.collapsed) {
      const projectsEl = document.createElement('div');
      projectsEl.className = 'team-projects';

      // Container-level drag handlers for PROJECT reordering within this team
      projectsEl.addEventListener('dragover', (e) => {
        if (_dragType !== 'project' || _dragTeamId !== team.id) return;
        e.preventDefault();
        const items = Array.from(projectsEl.querySelectorAll('.project-item:not(.dragging)'));
        const beforeEl = _getInsertBefore(e, items);
        _dropBeforeId = beforeEl ? beforeEl.dataset.projectId : null;
        _showIndicator(projectsEl, beforeEl);
      });

      projectsEl.addEventListener('dragleave', (e) => {
        if (_dragType !== 'project' || _dragTeamId !== team.id) return;
        if (!projectsEl.contains(e.relatedTarget)) _hideIndicator();
      });

      projectsEl.addEventListener('drop', (e) => {
        if (_dragType !== 'project' || _dragTeamId !== team.id) return;
        e.preventDefault();
        _hideIndicator();
        const projects = team.projects;
        const fromIdx = projects.findIndex(p => p.id === _dragId);
        const beforeIdx = _dropBeforeId ? projects.findIndex(p => p.id === _dropBeforeId) : -1;
        const toIdx = _computeToIdx(fromIdx, beforeIdx, projects.length);
        _dropBeforeId = null;
        if (fromIdx !== toIdx && toIdx >= 0) {
          DataLayer.reorderProjects(team.id, fromIdx, toIdx);
          render();
        }
      });

      team.projects.forEach(project => {
        projectsEl.appendChild(_renderProject(project, team, activeProjectId));
      });
      wrapper.appendChild(projectsEl);
    }

    return wrapper;
  }

  function _renderProject(project, team, activeProjectId) {
    const el = document.createElement('div');
    el.className = 'project-item' + (project.id === activeProjectId ? ' active' : '');
    el.draggable = true;
    el.dataset.projectId = project.id;

    el.addEventListener('dragstart', (e) => {
      _dragType = 'project';
      _dragId = project.id;
      _dragTeamId = team.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', project.id);
      e.stopPropagation(); // prevent team dragstart from firing
      setTimeout(() => el.classList.add('dragging'), 0);
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      _dragType = null;
      _dragId = null;
      _dragTeamId = null;
      _hideIndicator();
    });

    const icon = document.createElement('span');
    icon.className = 'project-icon';
    icon.textContent = '📋';

    const name = document.createElement('span');
    name.className = 'project-name';
    name.textContent = project.name;

    const menuBtn = document.createElement('button');
    menuBtn.className = 'project-menu-btn';
    menuBtn.title = 'Project options';
    menuBtn.textContent = '•••';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      UIHelpers.openMenu(menuBtn, [
        { label: 'Rename project', action: () => {
          const n = UIHelpers.promptRename(project.name, 'project');
          if (n) { DataLayer.updateProject(project.id, { name: n }); render(); }
        }},
        'divider',
        { label: 'Delete project', danger: true, action: () => {
          if (confirm(`Delete project "${project.name}"?`)) {
            DataLayer.deleteProject(project.id);
            Utils.EventBus.emit('project:changed');
            render();
          }
        }}
      ]);
    });

    el.appendChild(icon);
    el.appendChild(name);
    el.appendChild(menuBtn);

    el.addEventListener('click', (e) => {
      if (e.target.closest('.project-menu-btn')) return;
      DataLayer.setActiveProjectId(project.id);
      Utils.EventBus.emit('project:changed');
      render();
    });

    return el;
  }

  return { render };
})();
