// partials/include.js
export async function injectHeader() {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  try {
    const res = await fetch('partials/header.html', { cache: 'no-store' });
    const html = await res.text();
    mount.innerHTML = html;

    // Highlight current page
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item[data-match]').forEach(a => {
      if (a.getAttribute('data-match') === path) a.classList.add('active');
    });

    // Theme toggle
    setupThemeToggle();

    // Burger logic
    setupBurger();
  } catch (e) {
    console.error('Header include failed:', e);
  }
}

function setupThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const isDark = localStorage.getItem('theme') === 'dark';
  document.body.classList.toggle('dark', isDark);
  toggle.checked = isDark;

  toggle.addEventListener('change', () => {
    const dark = toggle.checked;
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });
}

function setupBurger() {
  const burger = document.getElementById('burgerBtn');
  const menu = document.getElementById('mobileMenu');
  if (!burger || !menu) return;

  const openMenu = () => {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('open'));
    burger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', outsideClose, { capture: true });
    document.addEventListener('keydown', escClose);
  };
  const closeMenu = () => {
    menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    setTimeout(() => { menu.hidden = true; }, 200);
    document.removeEventListener('click', outsideClose, { capture: true });
    document.removeEventListener('keydown', escClose);
  };
  const toggleMenu = () => (menu.hidden ? openMenu() : closeMenu());

  const outsideClose = (e) => {
    if (!menu.contains(e.target) && e.target !== burger) closeMenu();
  };
  const escClose = (e) => { if (e.key === 'Escape') closeMenu(); };

  burger.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
}
