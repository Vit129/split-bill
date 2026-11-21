// Runner menu for `npm start`. Arrow keys in a terminal; a number (1-5) otherwise.
// Non-interactive: `npm start 2` or START_CHOICE=2 runs an option without asking.
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const OPTIONS = [
  { label: 'Dev server (http://localhost:5173)', steps: [['npm', ['run', 'dev']]] },
  { label: 'Unit tests + typecheck', steps: [['npm', ['test']], ['npm', ['run', 'typecheck']]] },
  { label: 'Browser tests (Playwright, every screen size)', steps: [['npm', ['run', 'test:web']]] },
  { label: 'Build static app into dist/ (tests + typecheck first)', steps: [['npm', ['run', 'build']]] },
  { label: 'Preview the built app (http://localhost:4173)', steps: [['npm', ['run', 'build']], ['npm', ['run', 'preview']]] },
  { label: 'Release: patch / minor / major / skip (asks which)', steps: [['node', ['scripts/release.js']]] },
];

function runStep([command, args]) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))));
    child.on('error', reject);
  });
}

async function runOption(option) {
  console.log(`\n▶ ${option.label}\n`);
  for (const step of option.steps) await runStep(step);
}

function printMenu(selected) {
  console.log('\n🍣 Kaiten Sushi Calc');
  OPTIONS.forEach((o, i) => {
    if (selected === undefined) console.log(`  ${i + 1}) ${o.label}`);
    else console.log(`${i === selected ? '❯' : ' '} ${o.label}`);
  });
}

// Arrow keys (raw mode) when run in a terminal.
function selectWithArrows() {
  let selected = 0;
  const draw = () => {
    console.clear();
    printMenu(selected);
    console.log('\n(↑/↓ to move, Enter to run)');
  };
  draw();
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    const onData = (key) => {
      if (key === '\u0003') {
        process.stdin.setRawMode(false);
        process.exit(0);
      }
      if (key === '\r') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        resolve(selected);
      } else if (key === '\u001b[A') {
        selected = (selected - 1 + OPTIONS.length) % OPTIONS.length;
        draw();
      } else if (key === '\u001b[B') {
        selected = (selected + 1) % OPTIONS.length;
        draw();
      }
    };
    process.stdin.on('data', onData);
  });
}

// Numbered prompt when there is no terminal (pipes, CI, agents).
function selectWithNumber() {
  printMenu(undefined);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    rl.question(`\nEnter choice (1-${OPTIONS.length}): `, (answer) => {
      rl.close();
      const n = Number.parseInt(answer, 10);
      if (n >= 1 && n <= OPTIONS.length) resolve(n - 1);
      else reject(new Error(`Invalid choice: ${answer}`));
    });
  });
}

async function main() {
  const given = process.argv[2] ?? process.env['START_CHOICE'];
  let index;
  if (given !== undefined) {
    const n = Number.parseInt(given, 10);
    if (!(n >= 1 && n <= OPTIONS.length)) throw new Error(`Invalid choice: ${given}`);
    index = n - 1;
  } else {
    index = process.stdin.isTTY ? await selectWithArrows() : await selectWithNumber();
  }
  await runOption(OPTIONS[index]);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
