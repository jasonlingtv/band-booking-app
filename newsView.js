// newsView.js — News Feeds tab: feed discovery and source-card headline grid
const NewsView = (() => {
  'use strict';

  const STORAGE_KEY        = 'band_booking_news_subs';
  const CUSTOM_STORAGE_KEY = 'band_booking_news_custom_subs';
  const FAVICON_SVC        = 'https://www.google.com/s2/favicons?domain=';
  const FEEDLY_SEARCH      = 'https://cloud.feedly.com/v3/search/feeds?count=20&query=';
  const SUGGESTED_IDS      = ['billboard', 'nme', 'techcrunch', 'daily-maverick'];

  let _subs           = new Set();
  let _customSubs     = []; // [{id, name, url, site, description}]
  let _view           = 'discover'; // 'discover' | 'myfeeds'
  let _wrap           = null;
  let _gen            = 0;
  let _hoverShowTimer = null;
  let _hoverHideTimer = null;
  let _hoverPopover   = null;

  // Feedly search state — persisted across rerenders
  let _feedlyQuery    = '';
  let _feedlyResults  = null; // null = inactive, [] = no results, [...] = results
  let _feedlyError    = false;
  let _feedlyDebounce = null;

  // ── Subscription persistence ───────────────────────────────────────────────

  function _loadSubs() {
    try { _subs = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch (_) { _subs = new Set(); }
    try { _customSubs = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) || '[]'); }
    catch (_) { _customSubs = []; }
  }

  function _saveSubs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([..._subs]));
  }

  function _saveCustomSubs() {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(_customSubs));
  }

  function _hasAnySubs() {
    return _subs.size > 0 || _customSubs.length > 0;
  }

  // ── Feed helpers ───────────────────────────────────────────────────────────

  function _getAllFeeds() {
    const all = [];
    FEED_LIBRARY.forEach(cat => cat.feeds.forEach(f => all.push({ ...f, category: cat.category })));
    return all;
  }

  function _getSubscribedFeeds() {
    const curated = _getAllFeeds().filter(f => _subs.has(f.id));
    return [...curated, ..._customSubs];
  }

  function _getFeedByUrl(url) {
    if (!url) return null;
    const norm = url.replace(/\/$/, '');
    return _getAllFeeds().find(f => f.url.replace(/\/$/, '') === norm) || null;
  }

  function _isFollowedById(id) {
    return _subs.has(id) || _customSubs.some(f => f.id === id);
  }

  function _isFollowedByUrl(url) {
    const curated = _getFeedByUrl(url);
    if (curated) return _subs.has(curated.id);
    return _customSubs.some(f => f.url === url);
  }

  function _followById(id) {
    _subs.add(id);
    _saveSubs();
  }

  function _unfollowById(id) {
    _subs.delete(id);
    _saveSubs();
  }

  function _followByUrl(feedObj) {
    const curated = _getFeedByUrl(feedObj.url);
    if (curated) {
      _subs.add(curated.id);
      _saveSubs();
    } else if (!_customSubs.some(f => f.url === feedObj.url)) {
      _customSubs.push({ id: feedObj.url, ...feedObj });
      _saveCustomSubs();
    }
  }

  function _unfollowByUrl(url) {
    const curated = _getFeedByUrl(url);
    if (curated) {
      _subs.delete(curated.id);
      _saveSubs();
    } else {
      _customSubs = _customSubs.filter(f => f.url !== url);
      _saveCustomSubs();
    }
  }

  function _faviconUrl(domain) {
    return FAVICON_SVC + encodeURIComponent(domain) + '&sz=64';
  }

  function _formatSubs(n) {
    if (!n) return '';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return String(n);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function render(el) {
    _loadSubs();
    _hidePopover();
    if (!_hasAnySubs()) _view = 'discover';
    _wrap = document.createElement('div');
    _wrap.className = 'dash-wrap news-wrap';
    _gen++;
    _build(_wrap, _gen);
    el.appendChild(_wrap);
  }

  function cleanup() {
    clearTimeout(_hoverShowTimer);  _hoverShowTimer = null;
    clearTimeout(_hoverHideTimer);  _hoverHideTimer = null;
    clearTimeout(_feedlyDebounce);  _feedlyDebounce = null;
    _hidePopover();
  }

  function _rerender() {
    if (!_wrap || !_wrap.parentNode) return;
    _hidePopover();
    if (!_hasAnySubs()) _view = 'discover';
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

  // ── Empty state ────────────────────────────────────────────────────────────

  function _renderEmptyState(wrap) {
    const state = document.createElement('div');
    state.className = 'news-empty-state';

    const icon = document.createElement('div');
    icon.className = 'news-empty-icon';
    icon.innerHTML = '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" stroke-width="2.5"/><line x1="14" y1="18" x2="34" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="24" x2="34" y2="24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="30" x2="26" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    state.appendChild(icon);

    const heading = document.createElement('h3');
    heading.className = 'news-empty-heading';
    heading.textContent = 'Your news feed is empty';
    state.appendChild(heading);

    const sub = document.createElement('p');
    sub.className = 'news-empty-sub';
    sub.textContent = 'Follow sources you care about to see their latest stories here.';
    state.appendChild(sub);

    const cta = document.createElement('button');
    cta.className = 'dash-btn-primary news-empty-cta';
    cta.textContent = 'Browse Sources →';
    cta.addEventListener('click', () => {
      const searchEl = wrap.querySelector('.news-feedly-input');
      if (searchEl) {
        searchEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => searchEl.focus(), 250);
      }
    });
    state.appendChild(cta);
    wrap.appendChild(state);

    // Suggested teasers
    const suggestLabel = document.createElement('div');
    suggestLabel.className = 'news-suggested-label';
    suggestLabel.textContent = 'Suggested sources to get you started';
    wrap.appendChild(suggestLabel);

    const grid = document.createElement('div');
    grid.className = 'news-feed-grid news-suggested-grid';
    const allFeeds = _getAllFeeds();
    SUGGESTED_IDS
      .map(id => allFeeds.find(f => f.id === id))
      .filter(Boolean)
      .forEach(feed => grid.appendChild(_makeSuggestedCard(feed)));
    wrap.appendChild(grid);
  }

  function _makeSuggestedCard(feed) {
    const card = document.createElement('div');
    card.className = 'news-feed-card news-suggested-card';

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

    const btn = document.createElement('button');
    btn.className = 'news-follow-btn';
    btn.textContent = '+ Follow';
    btn.addEventListener('click', () => {
      _followById(feed.id);
      _view = 'myfeeds';
      _rerender();
    });
    card.appendChild(btn);
    return card;
  }

  // ── Discover view ──────────────────────────────────────────────────────────

  function _renderDiscover(wrap) {
    const header = document.createElement('div');
    header.className = 'dash-header';
    const title = document.createElement('h2');
    title.className = 'dash-title';
    title.textContent = 'Discover News Feeds';
    header.appendChild(title);
    if (_hasAnySubs()) {
      const myBtn = document.createElement('button');
      myBtn.className = 'dash-btn-primary';
      myBtn.textContent = 'My Feeds (' + (_subs.size + _customSubs.length) + ')';
      myBtn.addEventListener('click', () => { _view = 'myfeeds'; _rerender(); });
      header.appendChild(myBtn);
    }
    wrap.appendChild(header);

    if (!_hasAnySubs()) _renderEmptyState(wrap);

    // Feedly search bar
    const searchRow = document.createElement('div');
    searchRow.className = 'news-search-row';
    const searchWrap = document.createElement('div');
    searchWrap.className = 'news-search-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'news-search-input news-feedly-input';
    input.placeholder = 'Search for any topic, publication or website…';
    input.value = _feedlyQuery;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'news-search-clear';
    clearBtn.textContent = '✕';
    clearBtn.title = 'Clear search';
    clearBtn.style.display = _feedlyQuery ? '' : 'none';

    searchWrap.appendChild(input);
    searchWrap.appendChild(clearBtn);
    searchRow.appendChild(searchWrap);
    wrap.appendChild(searchRow);

    // Results container (above categories) and categories container
    const resultsEl = document.createElement('div');
    resultsEl.className = 'news-search-results';
    resultsEl.style.display = _feedlyResults !== null ? '' : 'none';

    const categoriesEl = document.createElement('div');
    categoriesEl.style.display = _feedlyResults !== null ? 'none' : '';

    // Wire clear button
    clearBtn.addEventListener('click', () => {
      _feedlyQuery = '';
      _feedlyResults = null;
      _feedlyError = false;
      input.value = '';
      clearBtn.style.display = 'none';
      resultsEl.innerHTML = '';
      resultsEl.style.display = 'none';
      categoriesEl.style.display = '';
    });

    // Wire search input
    input.addEventListener('input', () => {
      const q = input.value.trim();
      _feedlyQuery = q;
      clearBtn.style.display = q ? '' : 'none';
      clearTimeout(_feedlyDebounce);
      if (!q) {
        _feedlyResults = null;
        _feedlyError = false;
        resultsEl.innerHTML = '';
        resultsEl.style.display = 'none';
        categoriesEl.style.display = '';
        return;
      }
      resultsEl.innerHTML = '<div class="news-search-loading">Searching…</div>';
      resultsEl.style.display = '';
      categoriesEl.style.display = 'none';
      _feedlyDebounce = setTimeout(() => _runFeedlySearch(q, resultsEl), 500);
    });

    // Re-populate results if a search was active before rerender
    if (_feedlyResults !== null) {
      _renderFeedlyResults(resultsEl, _feedlyResults, _feedlyError);
    }

    wrap.appendChild(resultsEl);

    _renderCategories(categoriesEl);
    wrap.appendChild(categoriesEl);
  }

  // ── Feedly search ──────────────────────────────────────────────────────────

  async function _runFeedlySearch(query, container) {
    try {
      const res = await window.fetch(FEEDLY_SEARCH + encodeURIComponent(query));
      if (!res.ok) throw new Error('non-ok');
      const data = await res.json();
      _feedlyResults = data.results || [];
      _feedlyError = false;
      _renderFeedlyResults(container, _feedlyResults, false);
    } catch (_) {
      _feedlyResults = [];
      _feedlyError = true;
      _renderFeedlyResults(container, [], true);
    }
  }

  function _renderFeedlyResults(container, results, isError) {
    container.innerHTML = '';
    if (isError) {
      const msg = document.createElement('p');
      msg.className = 'dash-empty';
      msg.textContent = 'Feed search is unavailable right now. Browse the curated library below.';
      // Show categories again when search fails
      const catEl = container.nextElementSibling;
      if (catEl) catEl.style.display = '';
      container.appendChild(msg);
      return;
    }
    if (!results.length) {
      const msg = document.createElement('p');
      msg.className = 'dash-empty';
      msg.textContent = 'No feeds found. Try a different search term.';
      container.appendChild(msg);
      return;
    }
    const label = document.createElement('div');
    label.className = 'news-cat-title';
    label.textContent = results.length + ' feed' + (results.length === 1 ? '' : 's') + ' found';
    container.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'news-feed-grid';
    results.forEach(r => {
      const url = r.feedId ? r.feedId.replace(/^feed\//, '') : (r.website || '');
      if (!url) return;
      let site = '';
      try { site = new URL(r.website || ('https://' + url)).hostname.replace(/^www\./, ''); } catch (_) { site = url; }
      const subsText = _formatSubs(r.subscribers);
      grid.appendChild(_makeSearchResultCard({
        url,
        name: r.title || site,
        site,
        description: r.description || '',
        subsText,
      }));
    });
    container.appendChild(grid);
  }

  function _makeSearchResultCard(feedObj) {
    const followed = _isFollowedByUrl(feedObj.url);
    const card = document.createElement('div');
    card.className = 'news-feed-card' + (followed ? ' following' : '');

    const info = document.createElement('div');
    info.className = 'news-feed-info';
    const name = document.createElement('div');
    name.className = 'news-feed-name';
    name.textContent = feedObj.name;
    info.appendChild(name);
    const site = document.createElement('div');
    site.className = 'news-feed-site';
    site.textContent = feedObj.site + (feedObj.subsText ? ' · ' + feedObj.subsText + ' followers' : '');
    info.appendChild(site);
    if (feedObj.description) {
      const desc = document.createElement('div');
      desc.className = 'news-feed-desc';
      desc.textContent = feedObj.description;
      info.appendChild(desc);
    }
    card.appendChild(info);

    const btn = document.createElement('button');
    btn.className = 'news-follow-btn' + (followed ? ' following' : '');
    btn.textContent = followed ? 'Following ✓' : '+ Follow';
    btn.addEventListener('click', () => {
      if (_isFollowedByUrl(feedObj.url)) {
        _unfollowByUrl(feedObj.url);
        btn.className = 'news-follow-btn';
        btn.textContent = '+ Follow';
        card.classList.remove('following');
      } else {
        _followByUrl(feedObj);
        btn.className = 'news-follow-btn following';
        btn.textContent = 'Following ✓';
        card.classList.add('following');
      }
    });
    card.appendChild(btn);
    return card;
  }

  // ── Curated categories ─────────────────────────────────────────────────────

  function _renderCategories(wrap) {
    FEED_LIBRARY.forEach(cat => {
      const section = document.createElement('div');
      section.className = 'news-cat-section';
      const catLabel = document.createElement('div');
      catLabel.className = 'news-cat-title';
      catLabel.textContent = cat.category;
      section.appendChild(catLabel);
      const grid = document.createElement('div');
      grid.className = 'news-feed-grid';
      cat.feeds.forEach(feed => grid.appendChild(_makeDiscoverCard(feed)));
      section.appendChild(grid);
      wrap.appendChild(section);
    });
  }

  function _makeDiscoverCard(feed) {
    const followed = _isFollowedById(feed.id);
    const card = document.createElement('div');
    card.className = 'news-feed-card' + (followed ? ' following' : '');

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

    const btn = document.createElement('button');
    btn.className = 'news-follow-btn' + (followed ? ' following' : '');
    btn.textContent = followed ? 'Following ✓' : '+ Follow';
    btn.addEventListener('click', () => {
      if (_isFollowedById(feed.id)) {
        _unfollowById(feed.id);
        btn.className = 'news-follow-btn';
        btn.textContent = '+ Follow';
        card.classList.remove('following');
      } else {
        _followById(feed.id);
        btn.className = 'news-follow-btn following';
        btn.textContent = 'Following ✓';
        card.classList.add('following');
      }
    });
    card.appendChild(btn);
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
    manageBtn.addEventListener('click', () => { _view = 'discover'; _rerender(); });
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
