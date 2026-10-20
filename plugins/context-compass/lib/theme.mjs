// Colours from the Agentic Labs dark tokens, with nearest xterm-256 fallbacks.
const HEX = { f: '#f1f5f9', m: '#90a1b9', s: '#62748e', x: '#45556c', a: '#51a2ff', b: '#2b7fff', v: '#8e51ff', o: '#ff6900', c: '#00b8db', y: '#ffba00', g: '#05df72' };
const C256 = { f: 255, m: 103, s: 60, x: 238, a: 75, b: 33, v: 99, o: 202, c: 38, y: 214, g: 42 };
const SEL_HEX = '#132e5d';
const SEL_256 = 17;
const KEY_HEX = '#1d293d';
const KEY_256 = 236;

const UNI = { full: '●', stale: '△', image: '■', summ: '○', helper: '◆', skill: '✦', hook: '»', times: '×', open: '▾', closed: '▸', bar: '━', half: '╸', mark: '┃', block: '█', rule: '─', sq: '■', dot: '·', down: '↓', back: '‹', ell: '…', cursor: '█', dash: '–', approx: '≈', updown: '↑↓' };
const ASCII = { full: '*', stale: '!', image: '#', summ: 'o', helper: '+', skill: '&', hook: '%', times: 'x', open: 'v', closed: '>', bar: '=', half: '-', mark: '|', block: '#', rule: '-', sq: '#', dot: '.', down: 'v', back: '<', ell: '~', cursor: '_', dash: '-', approx: '~', updown: 'jk' };

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(';');

export function makeTheme(env = process.env, { isTTY = true, color, ascii, links } = {}) {
  const useLinks = links != null ? links : isTTY && env.CTX_LINKS !== '0';
  let mode;
  if (color === false || env.NO_COLOR != null) mode = 'none';
  else if (color === true || isTTY || env.FORCE_COLOR) mode = /truecolor|24bit/i.test(env.COLORTERM || '') ? 'true' : '256';
  else mode = 'none';
  const loc = env.LC_ALL || env.LC_CTYPE || env.LANG || '';
  const useAscii = ascii != null ? ascii : env.CTX_ASCII === '1' || (loc !== '' && !/utf-?8/i.test(loc));
  const g = useAscii ? ASCII : UNI;

  const fg = (k) => mode === 'true' ? `\x1b[38;2;${rgb(HEX[k])}m` : mode === '256' ? `\x1b[38;5;${C256[k]}m` : '';
  const bg = (h, n) => mode === 'true' ? `\x1b[48;2;${rgb(h)}m` : mode === '256' ? `\x1b[48;5;${n}m` : '';
  const reset = mode === 'none' ? '' : '\x1b[0m';

  // segs: [[text, colourKey, flags?]], flags: 'k' = key cap background, 'b' = bold
  function paint(segs, { sel = false } = {}) {
    const base = sel ? bg(SEL_HEX, SEL_256) : '';
    let out = base;
    for (const [t0, k, fl, url] of segs) {
      if (!t0) continue;
      // OSC 8 hyperlink: terminals that support it make the text clickable, others ignore it.
      const t = url && useLinks ? `\x1b]8;;${url}\x1b\\${t0}\x1b]8;;\x1b\\` : t0;
      let pre = k ? fg(k) : (mode === 'none' ? '' : fg('f'));
      if (fl && fl.includes('k')) pre += bg(KEY_HEX, KEY_256);
      if (fl && fl.includes('b') && mode !== 'none') pre += '\x1b[1m';
      out += pre + t + (fl ? reset + base : '');
    }
    return out + reset;
  }
  return { mode, ascii: useAscii, links: useLinks, g, paint };
}
