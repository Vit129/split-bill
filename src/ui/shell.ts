// Shell: two tabs (sushi on the left, split bill on the right). Click only, no swipe.
// The active screen lives in the URL hash (#sushi or #split), so reload and links keep it.
import { STRINGS } from '../strings/th.ts';
import { APP_VERSION } from '../config/version.ts';

type Screen = 'sushi' | 'split';

const versionEl = document.getElementById('app-version');
if (versionEl) versionEl.textContent = `v${APP_VERSION}`;

const labels: Record<Screen, string> = { sushi: STRINGS.MENU_SUSHI, split: STRINGS.MENU_SPLIT };
const sushiScreen = document.getElementById('sushi-screen');
const splitScreen = document.getElementById('split-screen');
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab[data-screen]'));
if (!sushiScreen || !splitScreen || tabs.length !== 2) throw new Error('Missing shell elements');

for (const tab of tabs) tab.textContent = labels[tab.dataset['screen'] === 'split' ? 'split' : 'sushi'];

function currentScreen(): Screen {
  return window.location.hash.startsWith('#split') ? 'split' : 'sushi';
}

function show(screen: Screen): void {
  sushiScreen!.hidden = screen !== 'sushi';
  splitScreen!.hidden = screen !== 'split';
  for (const tab of tabs) {
    const selected = tab.dataset['screen'] === screen;
    tab.setAttribute('aria-selected', String(selected));
    tab.classList.toggle('is-active', selected);
  }
  if (screen === 'split') document.title = STRINGS.BILL_TITLE;
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    window.location.hash = tab.dataset['screen'] === 'split' ? 'split' : 'sushi';
  });
}

window.addEventListener('hashchange', () => show(currentScreen()));
show(currentScreen());

// Load each screen separately. A failure in one screen is logged and does not stop the tabs.
for (const load of [() => import('./app.ts'), () => import('./split/split-app.ts')]) {
  load().catch((err: unknown) => console.error('Screen failed to start:', err));
}
