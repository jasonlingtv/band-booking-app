// newsView.js — News Feeds tab: feed discovery and source-card headline grid
const NewsView = (() => {
  'use strict';

  const STORAGE_KEY = 'band_booking_news_subs';
  const FAVICON_SVC = 'https://www.google.com/s2/favicons?domain=';

  let _subs           = new Set();
  let _view           = 'discover'; // 'discover' | 'myfeeds'
  let _searchQuery    = '';
  let _wrap           = null;
  let _gen            = 0;
  let _hoverShowTimer = null;
  let _hoverHideTimer = null;
  let _hoverPopover   = null;

  // ── Subscription persistence ───────────────────────────────────────────────

  function _loadSubs() {
    try { _subs = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch (_) { _subs = new Set(); }
  }

  function _saveSubs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([..._subs]));
  }

  // ── Feed helpers ───────────────────────────────────────────────────────────

  function _getAllFeeds() {
    const all = [];
    FEED_LIBRARY.forEach(cat => cat.feeds.forEach(f => all.push({ ...f, category: cat.category })));
    return all;
  }

  function _getSubscribedFeeds() {
    return _getAllFeeds().filter(f => _subs.has(f.id));
  }

  function _faviconUrl(domain) {
    return FAVICON_SVC + encodeURIComponent(domain) + '&sz=64';
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function render(el) {
    _loadSubs();
    _hidePopover();
    if (_subs.size === 0) _view = 'discover';
    _wrap = document.createElement('div');
    _wrap.className = 'dash-wrap news-wrap';
    _gen++;
    _build(_wrap, _gen);
    el.appendChild(_wrap);
  }

  function cleanup() {
    clearTimeout(_hoverShowTimer); _hoverShowTimer = null;
    clearTimeout(_hoverHideTimer); _hoverHideTimer = null;
    _hidePopover();
  }

  function _rerender() {
    if (!_wrap || !_wrap.parentNode) return;
    _hidePopover();
    if (_subs.size === 0) _view = 'discover';
    _wrap.innerHTML = '';
    _gen++;
    _build(_wrap, _gen);
  }

  function _build(wrap, gen) {
    if (_view === 'myfeeds') {
      _renderMyFeeds(wrap, gen);
    } else {
      _renderDiscover(wrap);
    }
  }

  // ── Discover view ──────────────────────────────────────────────────────────

  function _renderDiscover(wrap) {
    const header = document.createElement('div');
    header.className = 'dash-header';

    const title = document.createElement('h2');
    title.className = 'dash-title';
    title.textContent = 'Discover News Feeds';
    header.appendChild(title);

    if (_subs.size > 0) {
      const myBtn = document.createElement('button');
      myBtn.className = 'dash-btn-primary';
      myBtn.textContent = 'My Feeds (' + _subs.size + ')';
      myBtn.addEventListener('click', () => { _view = 'myfeeds'; _rerender(); });
      header.appendChild(myBtn);
    }
    wrap.appendChild(header);

    const searchRow = document.createElement('div');
    searchRow.className = 'news-search-row';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'news-search-input';
    searchInput.placeholder = 'Filter by feed name or category...';
    searchInput.value = _searchQuery;
    searchInput.addEventListener('input', () => {
      _searchQuery = searchInput.value;
      wrap.querySelectorAll('.news-cat-section, .news-search-empty').forEach(n => n.remove());
      _renderCategories(wrap, _searchQuery);
    });
    searchRow.appendChild(searchInput);
    wrap.appendChild(searchRow);

    _renderCategories(wrap, _searchQuery);
  }

  function _renderCategories(wrap, query) {
    const q = (query || '').toLowerCase();
    let rendered = 0;
    FEED_LIBRARY.forEach(cat => {
      const feeds = cat.feeds.filter(f =>
        !q || f.name.toLowerCase().includes(q) || cat.category.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      );
      if (!feeds.length) return;
      rendered++;

      const section = document.createElement('div');
      section.className = 'news-cat-section';

      const catLabel = document.createElement('div');
      catLabel.className = 'news-cat-title';
      catLabel.textContent = cat.category;
      section.appendChild(catLabel);

      const grid = document.createElement('div');
      grid.className = 'news-feed-grid';
      feeds.forEach(feed => grid.appendChild(_makeDiscoverCard(feed)));
      section.appendChild(grid);
      wrap.appendChild(section);
    });

    if (q && rendered === 0) {
      const empty = document.createElement('p');
      empty.className = 'dash-empty news-search-empty';
      empty.textContent = 'No feeds match your search.';
      wrap.appendChild(empty);
    }
  }

  function _makeDiscoverCard(feed) {
    const card = document.createElement('div');
    card.className = 'news-feed-card' + (_subs.has(feed.id) ? ' following' : '');

    const info = document.createElement('div');
    info.className = 'news-feed-info';

    const name = document.createElement('div');
    name.className = 'news-feed-name';
    name.textContent = feed.name;
    info.appendChild(name);

    const site = document.createElement('div');
    site.className = 'news-feed-site';
    site.textContent = feed.site;
    info.appendChild(site);

    const desc = document.createElement('div');
    desc.className = 'news-feed-desc';
    desc.textContent = feed.description;
    info.appendChild(desc);

    card.appendChild(info);

    const followBtn = document.createElement('button');
    followBtn.className = 'news-follow-btn' + (_subs.has(feed.id) ? ' following' : '');
    followBtn.textContent = _subs.has(feed.id) ? 'Following ✓' : '+ Follow';
    followBtn.addEventListener('click', () => {
      if (_subs.has(feed.id)) {
        _subs.delete(feed.id);
        _saveSubs();
        followBtn.className = 'news-follow-btn';
        followBtn.textContent = '+ Follow';
        card.classList.remove('following');
      } else {
        _subs.add(feed.id);
        _saveSubs();
        followBtn.className = 'news-follow-btn following';
        followBtn.textContent = 'Following ✓';
        card.classList.add('following');
      }
    });
    card.appendChild(followBtn);

    return card;
  }

  // ── My Feeds view ──────────────────────────────────────────────────────────

  function _renderMyFeeds(wrap, gen) {
    const subscribedFeeds = _getSubscribedFeeds();

    const header = document.createElement('div');
    header.className = 'dash-header';

    const title = document.createElement('h2');
    title.className = 'dash-title';
    title.textContent = 'My Feeds';
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'news-header-actions';

    const manageBtn = document.createElement('button');
    manageBtn.className = 'dash-btn-secondary';
    manageBtn.textContent = 'Manage Feeds';
    manageBtn.addEventListener('click', () => { _view = 'discover'; _searchQuery = ''; _rerender(); });
    actions.appendChild(manageBtn);

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'news-refresh-btn';
    refreshBtn.textContent = '↺ Refresh';
    refreshBtn.addEventListener('click', () => { RssService.invalidateAll(); _rerender(); });
    actions.appendChild(refreshBtn);

    header.appendChild(actions);
    wrap.appendChild(header);

    const loadingEl = document.createElement('div');
    loadingEl.className = 'news-loading';
    loadingEl.textContent = 'Loading feeds…';
    wrap.appendChild(loadingEl);

    Promise.all(
      subscribedFeeds.map(feed => RssService.fetch(feed.url).then(result => ({ feed, result })))
    ).then(results => {
      if (_gen !== gen) return;
      loadingEl.remove();

      const successCount = results.filter(r => !r.result.error).length;
      const totalItems   = results.reduce((n, r) => n + (r.result.items || []).length, 0);
      const oldestFetch  = results.reduce((m, r) => (r.result.fetchedAt || Infinity) < m ? r.result.fetchedAt : m, Infinity);
      const minsSince    = Number.isFinite(oldestFetch) ? Math.floor((Date.now() - oldestFetch) / 60000) : 0;
      const updatedText  = minsSince === 0 ? 'just now' : minsSince + 'm ago';

      const statusBar = document.createElement('div');
      statusBar.className = 'news-status-bar';
      statusBar.textContent = totalItems + ' headlines from ' + successCount + '/' + results.length + ' feeds — updated ' + updatedText;
      wrap.appendChild(statusBar);

      _renderSourceGrid(wrap, results);
    });
  }

  // ── Source card grid ───────────────────────────────────────────────────────

  function _renderSourceGrid(wrap, results) {
    const errorFeeds = results.filter(r => r.result.error);
    if (errorFeeds.length) {
      const err = document.createElement('div');
      err.className = 'news-feed-error news-feed-error--banner';
      err.textContent = 'Could not load: ' + errorFeeds.map(r => r.feed.name).join(', ') + ' — try refreshing';
      wrap.appendChild(err);
    }

    const grid = document.createElement('div');
    grid.className = 'news-source-grid';
    results.forEach(({ feed, result }) => grid.appendChild(_makeSourceCard(feed, result)));
    wrap.appendChild(grid);
  }

  function _makeSourceCard(feed, result) {
    const card = document.createElement('div');
    card.className = 'news-source-card';

    // Card header: favicon + name + visit site link
    const hdr = document.createElement('div');
    hdr.className = 'news-source-card-header';

    const favicon = document.createElement('img');
    favicon.className = 'news-source-favicon';
    favicon.src = _faviconUrl(feed.site);
    favicon.width = 16; favicon.height = 16;
    favicon.alt = '';
    favicon.addEventListener('error', function() { this.style.display = 'none'; });
    hdr.appendChild(favicon);

    const nameEl = document.createElement('span');
    nameEl.className = 'news-source-card-name';
    nameEl.textContent = feed.name;
    hdr.appendChild(nameEl);

    const siteLink = document.createElement('a');
    siteLink.className = 'news-source-card-site';
    siteLink.href = 'https://' + feed.site;
    siteLink.target = '_blank';
    siteLink.rel = 'noopener noreferrer';
    siteLink.textContent = '↗';
    siteLink.title = 'Visit ' + feed.site;
    siteLink.addEventListener('click', e => e.stopPropagation());
    hdr.appendChild(siteLink);

    card.appendChild(hdr);

    // Scrollable articles container
    const articles = document.createElement('div');
    articles.className = 'news-source-card-articles';

    if (result.error) {
      articles.appendChild(_makeErrorEl('Could not load — try refreshing'));
    } else if (!result.items.length) {
      articles.appendChild(_makeErrorEl('No articles available'));
    } else {
      result.items.slice(0, 12).forEach(item => articles.appendChild(_makeArticleRow(item, feed)));
    }

    card.appendChild(articles);
    return card;
  }

  function _makeArticleRow(item, feed) {
    const row = document.createElement('div');
    row.className = 'news-article-row';
    row.addEventListener('click', () => { if (item.link) window.open(item.link, '_blank', 'noopener,noreferrer'); });

    // Thumbnail — article image with favicon fallback
    const thumb = document.createElement('img');
    thumb.className = 'news-article-thumb';
    thumb.alt = '';
    if (item.thumbnail) {
      thumb.src = item.thumbnail;
      thumb.addEventListener('error', function() {
        this.src = _faviconUrl(feed.site);
        this.classList.add('news-article-thumb--favicon');
      });
    } else {
      thumb.src = _faviconUrl(feed.site);
      thumb.classList.add('news-article-thumb--favicon');
    }
    row.appendChild(thumb);

    // Article body
    const body = document.createElement('div');
    body.className = 'news-article-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'news-article-title';
    titleEl.textContent = item.title || '(No title)';
    body.appendChild(titleEl);

    if (item.pubDate) {
      const meta = document.createElement('div');
      meta.className = 'news-article-meta';
      meta.textContent = RssService.timeAgo(item.pubDate);
      body.appendChild(meta);
    }

    if (item.description) {
      const excerpt = document.createElement('div');
      excerpt.className = 'news-article-excerpt';
      excerpt.textContent = item.description;
      body.appendChild(excerpt);
    }

    row.appendChild(body);

    // Hover popover showing full excerpt
    if (item.description) {
      row.addEventListener('mouseenter', () => {
        clearTimeout(_hoverHideTimer); _hoverHideTimer = null;
        clearTimeout(_hoverShowTimer);
        _hoverShowTimer = setTimeout(() => _showPopover(row, item.description), 350);
      });
      row.addEventListener('mouseleave', () => {
        clearTimeout(_hoverShowTimer); _hoverShowTimer = null;
        _hoverHideTimer = setTimeout(() => _hidePopover(), 250);
      });
    }

    return row;
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────

  function _makeErrorEl(text) {
    const el = document.createElement('div');
    el.className = 'news-feed-error';
    el.style.padding = '12px';
    el.textContent = text;
    return el;
  }

  // ── Hover popover ──────────────────────────────────────────────────────────

  function _showPopover(row, text) {
    _hidePopover();
    const pop = document.createElement('div');
    pop.className = 'news-headline-popover';
    pop.textContent = text;
    pop.addEventListener('mouseenter', () => { clearTimeout(_hoverHideTimer); _hoverHideTimer = null; });
    pop.addEventListener('mouseleave', () => { _hoverHideTimer = setTimeout(() => _hidePopover(), 250); });
    document.body.appendChild(pop);
    _hoverPopover = pop;

    const rect = row.getBoundingClientRect();
    pop.style.top = rect.top + 'px';
    if (rect.right + 12 + 280 <= window.innerWidth) {
      pop.style.left  = (rect.right + 12) + 'px';
      pop.style.right = 'auto';
    } else {
      pop.style.right = (window.innerWidth - rect.left + 12) + 'px';
      pop.style.left  = 'auto';
    }
  }

  function _hidePopover() {
    if (_hoverPopover) { _hoverPopover.remove(); _hoverPopover = null; }
  }

  return { render, cleanup };
})();
