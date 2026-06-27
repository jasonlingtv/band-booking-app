// app.js — Main entry point. Initializes modules and wires up events.
(function () {
  'use strict';

  let _dashboardActive = false;

  function init() {
    DataLayer.loadData();
    UIHelpers.init();
    Calendar.init();
    DetailPanel.init();

    // If no teams exist, create a sample one to get started
    if (!DataLayer.getTeams().length) {
      const team = DataLayer.addTeam('My Band');
      DataLayer.setActiveProjectId(team.projects[0].id);
    }

    // Sidebar
    Sidebar.render();

    // Project title + view
    _renderProjectTitle();
    _renderCurrentView();

    // View tab buttons
    document.querySelectorAll('.view-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        DataLayer.setActiveView(view);
        document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        _renderCurrentView();
      });
    });

    // Restore active view tab
    const activeView = DataLayer.getActiveView();
    document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view === activeView));

    // Add team button
    document.getElementById('add-team-btn').addEventListener('click', () => {
      const name = window.prompt('Team name (band name):');
      if (name && name.trim()) {
        DataLayer.addTeam(name.trim());
        Sidebar.render();
      }
    });

    // Export / Import
    document.getElementById('export-btn').addEventListener('click', () => DataLayer.exportData());
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!window.confirm(`Import backup "${file.name}"?\n\nThis will REPLACE all current data and reload the app. This cannot be undone.`)) {
        e.target.value = ''; return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => DataLayer.importData(ev.target.result);
      reader.readAsText(file);
      e.target.value = '';
    });

    // Gear / Dashboard button
    document.getElementById('dashboard-btn').addEventListener('click', () => {
      if (_dashboardActive) {
        _hideDashboard();
      } else {
        _showDashboard();
      }
    });

    // Detail panel close button
    document.getElementById('detail-close').addEventListener('click', () => {
      DataLayer.setActiveTaskId(null);
      DetailPanel.hide();
      ListView.render();
      if (DataLayer.getActiveView() === 'board') BoardView.render();
    });

    // Click outside detail panel to close
    document.getElementById('main-content').addEventListener('click', (e) => {
      const activeTaskId = DataLayer.getActiveTaskId();
      if (!activeTaskId) return;
      if (e.target.closest('.task-row') || e.target.closest('.board-card')) return;
      if (e.target.closest('#dashboard-view')) return;
      DataLayer.setActiveTaskId(null);
      DetailPanel.hide();
      ListView.render();
      if (DataLayer.getActiveView() === 'board') BoardView.render();
    });

    // EventBus listeners
    Utils.EventBus.on('project:changed', () => {
      // Always exit dashboard when a project is selected
      _dashboardActive = false;
      document.getElementById('dashboard-view').classList.add('hidden');
      document.getElementById('view-tabs').classList.remove('hidden');

      _renderProjectTitle();
      _renderCurrentView();
      // Close detail if open
      DataLayer.setActiveTaskId(null);
      DetailPanel.hide();
      Sidebar.render();
    });

    Utils.EventBus.on('task:selected', (taskId) => {
      if (taskId) {
        DetailPanel.render(taskId);
      } else {
        DetailPanel.hide();
      }
    });

    Utils.EventBus.on('task:updated', (taskId) => {
      if (DataLayer.getActiveTaskId() === taskId) {
        DetailPanel.render(taskId);
      }
    });

    Utils.EventBus.on('todo:navigate', ({ taskId, projectId }) => {
      _hideDashboard();
      DataLayer.setActiveProjectId(projectId);
      _renderProjectTitle();
      _renderCurrentView();
      Sidebar.render();
      DataLayer.setActiveTaskId(taskId);
      DetailPanel.render(taskId);
    });

    // Restore detail panel if a task was active
    const activeTaskId = DataLayer.getActiveTaskId();
    if (activeTaskId && DataLayer.getTask(activeTaskId)) {
      DetailPanel.render(activeTaskId);
    }
  }

  function _showDashboard() {
    _dashboardActive = true;
    DataLayer.setActiveTaskId(null);
    DetailPanel.hide();

    document.getElementById('project-title').textContent = 'Settings';
    document.getElementById('view-tabs').classList.add('hidden');
    document.getElementById('list-view').classList.add('hidden');
    document.getElementById('board-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');

    Dashboard.render();
    Sidebar.render(); // update gear icon active state
  }

  function _hideDashboard() {
    Dashboard.clearTimers();
    _dashboardActive = false;
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('view-tabs').classList.remove('hidden');
    _renderProjectTitle();
    _renderCurrentView();
    Sidebar.render();
  }

  function _renderProjectTitle() {
    const el = document.getElementById('project-title');
    const projectId = DataLayer.getActiveProjectId();
    if (!projectId) { el.textContent = ''; return; }
    const project = DataLayer.getProject(projectId);
    const team = DataLayer.getProjectTeam(projectId);
    if (project && team) {
      el.textContent = `${team.name} / ${project.name}`;
    } else {
      el.textContent = project ? project.name : '';
    }
  }

  function _renderCurrentView() {
    const view = DataLayer.getActiveView();
    const listEl = document.getElementById('list-view');
    const boardEl = document.getElementById('board-view');
    if (view === 'board') {
      listEl.classList.add('hidden');
      boardEl.classList.remove('hidden');
      BoardView.render();
    } else {
      boardEl.classList.add('hidden');
      listEl.classList.remove('hidden');
      ListView.render();
    }
  }

  // Boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
