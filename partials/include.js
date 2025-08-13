export async function injectHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;

  host.innerHTML = `
    <div class="headerbar">
      <div class="left">
        <div id="burger" class="icon-btn" title="Menu">☰</div>
        <div class="brand">ARG Live</div>
      </div>
      <div class="right theme-toggle">
        <span>Theme</span>
        <label class="switch">
          <input id="themeToggle" type="checkbox" />
          <span class="thumb"></span>
        </label>
      </div>
    </div>

    <!-- Drawer -->
    <div class="drawer-overlay" id="drawerOverlay"></div>
    <aside class="drawer" id="drawer">
      <h3 style="margin:0 0 10px 0;">Navigation</h3>
      <ul class="nav-list">
        <li><a href="./index.html">Dashboard</a></li>
        <li><a href="./daily.html">Daily totals</a></li>
        <li><a href="./about.html">About us</a></li>
        <li><a href="https://instagram.com" target="_blank" rel="noopener">Instagram</a></li>
        <li><a href="https://tiktok.com" target="_blank" rel="noopener">TikTok</a></li>
      </ul>
    </aside>
  `;

  // theme init
  const saved = localStorage.getItem('theme') || 'light';
  document.body.classList.toggle('dark', saved === 'dark');
  const toggle = document.getElementById('themeToggle');
  toggle.checked = (saved === 'dark');

  toggle.addEventListener('change', () => {
    const dark = toggle.checked;
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });

  // drawer actions
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const burger = document.getElementById('burger');
  const open = () => { drawer.classList.add('open'); overlay.classList.add('show'); };
  const close = () => { drawer.classList.remove('open'); overlay.classList.remove('show'); };

  burger.addEventListener('click', open);
  overlay.addEventListener('click', close);
}
