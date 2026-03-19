(function () {
  var MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function updateIcon() {
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = isDark() ? SUN : MOON;
  }

  updateIcon();

  document.addEventListener('DOMContentLoaded', function () {
    updateIcon();

    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var dark = !isDark();
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('rmp-docs-theme', dark ? 'dark' : 'light');
        updateIcon();
      });
    }

    buildTOC();
    if (typeof hljs !== 'undefined') hljs.highlightAll();
  });

  function buildTOC() {
    var list = document.getElementById('toc-list');
    var tocEl = document.querySelector('.toc');
    if (!list || !tocEl) return;

    var headings = document.querySelectorAll('main h2[id]');
    if (headings.length === 0) {
      tocEl.style.display = 'none';
      document.querySelector('.content').style.marginRight = '0';
      return;
    }

    headings.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      var text = '';
      for (var i = 0; i < h.childNodes.length; i++) {
        var n = h.childNodes[i];
        if (n.nodeType === 3) text += n.textContent;
        else if (!n.classList || !n.classList.contains('anchor')) text += n.textContent;
      }
      a.textContent = text.trim();
      a.addEventListener('click', function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + h.id);
      });
      li.appendChild(a);
      list.appendChild(li);
    });

    var tocLinks = list.querySelectorAll('a');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          tocLinks.forEach(function (a) { a.classList.remove('active'); });
          var link = list.querySelector('a[href="#' + entry.target.id + '"]');
          if (link) link.classList.add('active');
        }
      });
    }, { rootMargin: '-60px 0px -75% 0px' });

    headings.forEach(function (h) { observer.observe(h); });
  }
})();
