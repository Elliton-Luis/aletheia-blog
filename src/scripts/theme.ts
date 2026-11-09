const root = document.documentElement;
const toggle = document.querySelector<HTMLButtonElement>('#theme-toggle');
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const media = window.matchMedia('(prefers-color-scheme: dark)');

function getSavedTheme(): 'light' | 'dark' | null {
  try {
    const saved = localStorage.getItem('aletheia-theme');
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

let savedTheme = getSavedTheme();

function syncTheme() {
  const dark = savedTheme ? savedTheme === 'dark' : media.matches;
  if (savedTheme) root.dataset.theme = savedTheme;
  else delete root.dataset.theme;

  toggle?.setAttribute('aria-pressed', String(dark));
  toggle?.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
  themeColor?.setAttribute('content', dark ? '#1d211e' : '#f4efe3');
}

syncTheme();
media.addEventListener('change', () => {
  if (!savedTheme) syncTheme();
});

toggle?.addEventListener('click', () => {
  const currentDark = savedTheme ? savedTheme === 'dark' : media.matches;
  savedTheme = currentDark ? 'light' : 'dark';
  root.dataset.theme = savedTheme;
  try {
    localStorage.setItem('aletheia-theme', savedTheme);
  } catch {
    // O tema continua alternável mesmo quando o armazenamento local está indisponível.
  }
  syncTheme();
});

// Fecha o dropdown de navegação ao clicar fora dele
document.addEventListener('click', (event) => {
  const dropdown = document.querySelector<HTMLDetailsElement>('#nav-dropdown');
  if (dropdown?.open && !dropdown.contains(event.target as Node)) {
    dropdown.open = false;
  }
});
