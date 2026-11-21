// Price expressions such as "599+49" or "140*2". A small recursive-descent parser:
// no eval, no Function(). Returns baht (2 decimals) or null when the text is not a valid sum.
const MAX_LEN = 60;

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: '+' | '-' | '*' | '/' } | { kind: 'paren'; value: '(' | ')' };

function tokenize(text: string): Token[] | null {
  const src = text.replace(/,/g, '').replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/');
  if (src.length === 0 || src.length > MAX_LEN) return null;
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src.charAt(i);
    if (/[0-9.]/.test(ch)) {
      const m = /^\d*\.?\d+|^\d+\./.exec(src.slice(i));
      if (!m) return null;
      tokens.push({ kind: 'num', value: Number(m[0]) });
      i += m[0].length;
    } else if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
    } else if (ch === '(' || ch === ')') {
      tokens.push({ kind: 'paren', value: ch });
      i += 1;
    } else {
      return null;
    }
  }
  return tokens;
}

export function evaluateExpression(text: string): number | null {
  const tokens = tokenize(text);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];

  function factor(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.kind === 'num') { pos += 1; return t.value; }
    if (t.kind === 'op' && t.value === '-') {
      pos += 1;
      const inner = factor();
      return inner === null ? null : -inner;
    }
    if (t.kind === 'paren' && t.value === '(') {
      pos += 1;
      const inner = expr();
      const close = peek();
      if (inner === null || !close || close.kind !== 'paren' || close.value !== ')') return null;
      pos += 1;
      return inner;
    }
    return null;
  }

  function term(): number | null {
    let left = factor();
    while (left !== null) {
      const t = peek();
      if (!t || t.kind !== 'op' || (t.value !== '*' && t.value !== '/')) break;
      pos += 1;
      const right = factor();
      if (right === null) return null;
      if (t.value === '/' && right === 0) return null;
      left = t.value === '*' ? left * right : left / right;
    }
    return left;
  }

  function expr(): number | null {
    let left = term();
    while (left !== null) {
      const t = peek();
      if (!t || t.kind !== 'op' || (t.value !== '+' && t.value !== '-')) break;
      pos += 1;
      const right = term();
      if (right === null) return null;
      left = t.value === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = expr();
  if (result === null || pos !== tokens.length || !Number.isFinite(result) || result < 0) return null;
  return Math.round(result * 100) / 100;
}
