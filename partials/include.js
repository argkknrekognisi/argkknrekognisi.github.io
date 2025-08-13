// partials/include.js
export async function injectHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;

  host.innerHTML = `
    <div class="headerbar" role="banner">
      <div class="left">
        <button id="burger" class="icon-btn" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">☰</button>
        <a href="./index.html" class="brand">Rain Gauge</a>
      </div>
      <div class="right theme-toggle">
        <span>Theme</span>
        <label class="switch" aria-label="Toggle dark mode">
          <input id="themeToggle" type="checkbox" />
          <span class="thumb"></span>
        </label>
      </div>
    </div>

    <div class="drawer-overlay" id="drawerOverlay" hidden></div>
    <aside class="drawer" id="drawer" aria-hidden="true" tabindex="-1">
      <h3 style="margin:0 0 10px 0;">Navigation</h3>
      <ul class="nav-list" role="list">
        <li><a href="./index.html" data-match="index.html">Dashboard</a></li>
        <li><a href="./daily.html" data-match="daily.html">Daily totals</a></li>
        <li><a href="./about.html" data-match="about.html">About us</a></li>
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

  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const burger = document.getElementById('burger');
  const toggleHeader = document.getElementById('themeToggle');
  const toggleDrawer = document.getElementById('themeToggleDrawer');

  // Theme init (storage or prefers-color-scheme)
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

  // Active item
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-list a[data-match]').forEach(a=>{
    if (a.getAttribute('data-match') === path) a.style.background = 'hsl(0 0% 100% / .08)';
  });

  // Drawer controls
  const open = () => {
    drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false');
    overlay.hidden=false; overlay.classList.add('show');
    burger.setAttribute('aria-expanded','true');
    document.body.style.overflow='hidden';
    drawer.focus();
  };
  const close = () => {
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true');
    overlay.classList.remove('show'); overlay.hidden=true;
    burger.setAttribute('aria-expanded','false');
    document.body.style.overflow='';
    burger.focus();
  };

  burger.addEventListener('click', open);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', e=>{ if (e.key==='Escape' && drawer.classList.contains('open')) close(); });
  drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click', close));

  // Focus trap
  drawer.addEventListener('keydown', (e)=>{
    if (e.key !== 'Tab') return;
    const f = drawer.querySelectorAll('a,button,input,[tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first=f[0], last=f[f.length-1];
    if (e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  });
}
