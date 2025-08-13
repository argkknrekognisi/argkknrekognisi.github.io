// partials/include.js
export async function injectHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;

  // Build header + drawer using the classes you've already styled
  host.innerHTML = `
    <div class="headerbar" role="banner">
      <div class="left">
        <button id="burger" class="icon-btn" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">☰</button>
        <a href="./index.html" class="brand" aria-current="page">Rain Gauge</a>
      </div>
      <div class="right theme-toggle">
        <span>Theme</span>
        <label class="switch" aria-label="Toggle dark mode">
          <input id="themeToggle" type="checkbox" />
          <span class="thumb"></span>
        </label>
      </div>
    </div>

    <!-- Drawer -->
    <div class="drawer-overlay" id="drawerOverlay" hidden></div>
    <aside class="drawer" id="drawer" aria-hidden="true" tabindex="-1">
      <h3 style="margin:0 0 10px 0;">Navigation</h3>
      <ul class="nav-list" role="list">
        <li><a href="./index.html"  data-match="index.html">Dashboard</a></li>
        <li><a href="./daily.html"  data-match="daily.html">Daily totals</a></li>
        <li><a href="./about.html"  data-match="about.html">About us</a></li>
        <li><a href="https://instagram.com" target="_blank" rel="noopener">Instagram</a></li>
        <li><a href="https://tiktok.com"    target="_blank" rel="noopener">TikTok</a></li>
      </ul>
      <div style="height:10px"></div>
      <div class="theme-toggle" style="justify-content:space-between">
        <span>Dark mode</span>
        <label class="switch">
          <input id="themeToggleDrawer" type="checkbox" />
          <span class="thumb"></span>
        </label>
      </div>
    </aside>
  `;

  const drawer        = document.getElementById('drawer');
  const overlay       = document.getElementById('drawerOverlay');
  const burger        = document.getElementById('burger');
  const toggleHeader  = document.getElementById('themeToggle');
  const toggleDrawer  = document.getElementById('themeToggleDrawer');

  // ------- Theme: init from storage or prefers-color-scheme -------
  const preferredDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme'); // 'dark' | 'light' | null
  const isDark = (savedTheme ? savedTheme === 'dark' : preferredDark);
  document.body.classList.toggle('dark', isDark);
  toggleHeader.checked = isDark;
  toggleDrawer.checked = isDark;

  const setTheme = (dark) => {
    document.body.classList.toggle('dark', dark);
    toggleHeader.checked = dark;
    toggleDrawer.checked = dark;
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  };
  toggleHeader.addEventListener('change', () => setTheme(toggleHeader.checked));
  toggleDrawer.addEventListener('change', () => setTheme(toggleDrawer.checked));

  // ------- Active nav highlight -------
  (function setActive() {
    const path = location.pathname.split('/').pop() || 'index.html';
    host.querySelectorAll('.nav-list a[data-match]').forEach(a => {
      const active = path === a.getAttribute('data-match');
      if (active) a.style.background = 'hsl(0 0% 100% / .08)'; // subtle
      if (active && a.closest('.drawer')) a.setAttribute('aria-current', 'page');
    });
  })();

  // ------- Drawer open/close with a11y -------
  const openDrawer = () => {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.hidden = false;
    overlay.classList.add('show');
    burger.setAttribute('aria-expanded', 'true');
    // focus management
    drawer.focus();
    // prevent body scroll (optional, comment if undesired)
    document.body.style.overflow = 'hidden';
  };
  const closeDrawer = () => {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('show');
    overlay.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    burger.focus();
  };

  burger.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });
  // Close when clicking a nav item
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));

  // ------- Basic focus trap inside drawer -------
  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = drawer.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}
