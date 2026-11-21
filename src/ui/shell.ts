// Shell: a menu (☰) that switches between the two screens. The active screen is kept in the
// URL hash (#sushi or #split), so a reload or a shared link opens the same screen.
import { STRINGS } from '../strings/th.ts';
import './app.ts'; // sushi screen: renders into #app on import
import './split/split-app.ts'; // split-bill screen: renders into #split-root on import

type Screen = 'sushi' | 'split';

const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu');
const shellTitle = document.getElementById('shell-title');
const sushiScreen = document.getElementById('sushi-screen');
const splitScreen = document.getElementById('split-screen');
if (!menuBtn || !menu || !shellTitle || !sushiScreen || !splitScreen) throw new Error('Missing shell elements');

const labels: Record<Screen, string> = { sushi: STRINGS.MENU_SUSHI, split: STRINGS.MENU_SPLIT };

for (const button of menu.querySelectorAll<HTMLButtonElement>('[data-screen]')) {
  const screen = button.dataset['screen'] === 'split' ? 'split' : 'sushi';
  button.textContent = labels[screen];
}
menuBtn.setAttribute('aria-label', STRINGS.MENU_OPEN);

function currentScreen(): Screen {
  return window.location.hash === '#split' ? 'split' : 'sushi';
}

function show(screen: Screen): void {
  sushiScreen!.hidden = screen !== 'sushi';
  splitScreen!.hidden = screen !== 'split';
  shellTitle!.textContent = labels[screen];
  for (const button of menu!.querySelectorAll<HTMLButtonElement>('[data-screen]')) {
    button.setAttribute('aria-current', String(button.dataset['screen'] === screen));
  }
  if (screen === 'split') document.title = STRINGS.BILL_TITLE;
  closeMenu();
}

function openMenu(): void {
  menu!.hidden = false;
  menuBtn!.setAttribute('aria-expanded', 'true');
  menuBtn!.setAttribute('aria-label', STRINGS.MENU_CLOSE);
}

function closeMenu(): void {
  menu!.hidden = true;
  menuBtn!.setAttribute('aria-expanded', 'false');
  menuBtn!.setAttribute('aria-label', STRINGS.MENU_OPEN);
}

menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));

menu.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest<HTMLElement>('[data-screen]');
  if (!button) return;
  const screen: Screen = button.dataset['screen'] === 'split' ? 'split' : 'sushi';
  window.location.hash = screen === 'split' ? 'split' : 'sushi';
});

window.addEventListener('hashchange', () => show(currentScreen()));

show(currentScreen());
