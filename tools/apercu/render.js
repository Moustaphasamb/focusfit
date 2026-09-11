/* Reconstruit les écrans de FocusFIT avec Satori (moteur flexbox) + resvg :
   mêmes polices, mêmes couleurs (lues dans css/variables.css) et mêmes valeurs
   que celles calculées par l'application dans jsdom. */
const fs = require('fs');
const path = require('path');
const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');

/* ── Jetons de couleur réellement lus dans la feuille de styles ── */
function tokens(cssPath, theme) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const block = theme === 'light'
    ? css.slice(css.indexOf('[data-theme="light"]'))
    : css.slice(css.indexOf(':root'), css.indexOf('[data-theme="light"]'));
  const t = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8}|[\d.]+px|[\d.]+)/g)) t[m[1]] = m[2];
  return t;
}
const ROOT = path.resolve(__dirname, '..', '..');
const DARK = tokens(path.join(ROOT, 'css', 'variables.css'), 'dark');
const LIGHT = { ...DARK, ...tokens(path.join(ROOT, 'css', 'variables.css'), 'light') };  // le thème clair ne redéfinit que les couleurs

/* ── Polices réelles de l'application (npm @fontsource) ── */
const font = (pkg, file, name, weight) => ({ name, weight, style: 'normal',
  data: fs.readFileSync(path.join(ROOT, 'node_modules', '@fontsource', pkg, 'files', file)) });
const FONTS = [
  font('barlow', 'barlow-latin-400-normal.woff', 'Barlow', 400),
  font('barlow', 'barlow-latin-500-normal.woff', 'Barlow', 500),
  font('barlow', 'barlow-latin-600-normal.woff', 'Barlow', 600),
  font('barlow', 'barlow-latin-700-normal.woff', 'Barlow', 700),
  font('barlow-condensed', 'barlow-condensed-latin-700-normal.woff', 'Barlow Condensed', 700),
  font('barlow-condensed', 'barlow-condensed-latin-800-normal.woff', 'Barlow Condensed', 800),
  font('barlow-condensed', 'barlow-condensed-latin-900-normal.woff', 'Barlow Condensed', 900),
  font('jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff', 'JetBrains Mono', 400),
  font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff', 'JetBrains Mono', 500)
];

/* ── Icônes : SVG réellement extraits d'index.html, colorisés ── */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const svgIcons = {};
for (const m of html.matchAll(/<button type="button" class="nav-item[^"]*"[^>]*data-page="(\w+)"[^>]*>\s*(<svg[\s\S]*?<\/svg>)/g)) {
  svgIcons[m[1]] = m[2].replace(/\s+/g, ' ').trim();
}
const heroArt = html.match(/<div class="hero-art"[\s\S]*?(<svg[\s\S]*?<\/svg>)/)[1];
const dataUri = (svg, color) => {
  let out = svg.replace(/currentColor/g, color);
  if (!/xmlns=/.test(out)) out = out.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return 'data:image/svg+xml;base64,' + Buffer.from(out).toString('base64');
};
const ICONS = Object.fromEntries(Object.entries(svgIcons).map(([k, v]) => [k, v]));
const sunIcon = html.match(/<svg id="theme-icon"[\s\S]*?<\/svg>/)[0];

/* Emojis et dingbats (⏱ ⚡ ☀ ✓ 💧 🔥) sont absents des polices embarquées :
   les mêmes symboles sont donc dessinés en SVG, comme le fait l'application. */
const GLYPHS = {
  sun: sunIcon,
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 12.5H11l-1 9.5L19.5 11H13z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  droplet: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c3.4 4.2 6.5 7.7 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 10.2 8.6 6.7 12 2.5z"/></svg>'
};
const glyph = (name, size, color) => img(dataUri(GLYPHS[name], color), { width: size, height: size });

/* ── Petits constructeurs ── */
const el = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });
const text = (content, style) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: content } });
const img = (src, style) => ({ type: 'img', props: { src, style: { display: 'flex', ...style }, width: style.width, height: style.height } });

/* ── Écran : Tableau de bord ── */
function dashboard(t, data) {
  const NAV = [
    ['profile', 'Profil'], ['dashboard', 'Tableau de bord'], ['planning', 'Planning'], ['programs', 'Programmes'],
    ['nutrition', 'Nutrition'], ['progress', 'Progression'], ['goals', 'Objectifs'], ['history', 'Historique']
  ];
  const navItem = ([key, label]) => {
    const active = key === 'dashboard';
    return el('div', {
      alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px',
      background: active ? 'rgba(0,229,255,0.1)' : 'transparent',
      color: active ? t.acc : t.text2, fontSize: '13px', fontWeight: 500,
      border: active ? `1px solid rgba(0,229,255,0.25)` : '1px solid transparent'
    }, [
      img(dataUri(ICONS[key], active ? t.acc : t.text3), { width: '18px', height: '18px' }),
      text(label, {})
    ]);
  };
  const navSection = label => text(label, {
    fontSize: '10px', color: t.text3, letterSpacing: '2px', textTransform: 'uppercase',
    fontWeight: 700, padding: '18px 12px 8px'
  });

  const sidebar = el('div', {
    width: '230px', flexShrink: 0, flexDirection: 'column', background: t.s1,
    borderRight: `1px solid ${t.border}`, padding: '22px 14px'
  }, [
    el('div', { flexDirection: 'column', padding: '0 8px 6px' }, [
      el('div', { alignItems: 'center', gap: '9px' }, [
        glyph('bolt', '23px', t.acc),
        text('FOCUS', { fontFamily: 'Barlow Condensed', fontSize: '24px', fontWeight: 900, color: t.text, letterSpacing: '1px' })
      ]),
      text('Track · Build · Perform', { fontSize: '9px', color: t.text3, letterSpacing: '1.6px', marginTop: '2px', textTransform: 'uppercase' })
    ]),
    navSection('Principal'),
    ...NAV.slice(0, 4).map(navItem),
    navSection('Suivi'),
    ...NAV.slice(4).map(navItem),
    el('div', { marginTop: 'auto', padding: '14px 12px 0', borderTop: `1px solid ${t.border}`, fontSize: '10px', color: t.text3, letterSpacing: '1px' },
      [text('v6.0 • PWA Ready', {})])
  ]);

  const topbar = el('div', {
    height: '62px', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', borderBottom: `1px solid ${t.border}`, flexShrink: 0
  }, [
    text('Tableau de bord', { fontFamily: 'Barlow Condensed', fontSize: '20px', fontWeight: 700, color: t.text, letterSpacing: '1.5px', textTransform: 'uppercase' }),
    el('div', { alignItems: 'center', gap: '10px' }, [
      el('div', { alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.s2 },
        [glyph('sun', '16px', t.text2)]),
      el('div', { alignItems: 'center', gap: '7px', padding: '9px 14px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.s2 },
        [glyph('clock', '15px', t.text2), text('Timer', { fontSize: '12px', fontWeight: 600, color: t.text2 })])
    ])
  ]);

  const hero = el('div', {
    alignItems: 'center', justifyContent: 'space-between', padding: '30px 36px', borderRadius: t.r,
    border: `1px solid rgba(0,229,255,0.18)`, overflow: 'hidden',
    backgroundImage: 'radial-gradient(ellipse at 10% 70%, rgba(0,229,255,0.16) 0%, transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(105,255,71,0.07) 0%, transparent 45%), linear-gradient(135deg, #030c18 0%, #071525 50%, #040e1c 100%)'
  }, [
    el('div', { flexDirection: 'column' }, [
      el('div', { alignItems: 'center', gap: '8px' }, [
        el('div', { width: '24px', height: '2px', borderRadius: '1px', background: t.acc }, []),
        text(data.greffon.replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''), { fontSize: '11px', color: t.acc, letterSpacing: '3px', fontWeight: 700, textTransform: 'uppercase' })
      ]),
      text('Forge ton corps.', { fontFamily: 'Barlow Condensed', fontSize: '38px', fontWeight: 900, color: '#fff', letterSpacing: '1px', lineHeight: 1.05, marginTop: '14px' }),
      text('Bats tes records.', { fontFamily: 'Barlow Condensed', fontSize: '38px', fontWeight: 900, color: '#fff', letterSpacing: '1px', lineHeight: 1.05 }),
      text('FocusFIT — Chaque séance te rapproche de ton objectif.', { fontSize: '12px', color: t.text3, marginTop: '10px', letterSpacing: '0.5px' }),
      el('div', { alignItems: 'center', gap: '9px', marginTop: '20px', padding: '12px 20px', borderRadius: '8px', background: t.acc, alignSelf: 'flex-start' },
        [glyph('bolt', '15px', '#000'), text('Lancer la séance', { fontSize: '13px', fontWeight: 700, color: '#000', letterSpacing: '1.5px', textTransform: 'uppercase' })])
    ]),
    img(dataUri(heroArt, t.acc), { width: '150px', height: '160px', opacity: 0.75, flexShrink: 0 })
  ]);

  const statCard = k => {
    const accent = { acc: t.acc, acc3: t.acc3, acc4: t.acc4, acc5: t.acc5 }[k.accent];
    return el('div', {
      flex: '1 1 0', flexDirection: 'column', background: t.s1, border: `1px solid ${t.border}`,
      borderRadius: t.r, overflow: 'hidden'
    }, [
      el('div', { height: '2px', background: accent, flexShrink: 0 }, []),
      el('div', { flexDirection: 'column', padding: '18px 20px 20px' }, [
        text(k.label, { fontSize: '11px', color: t.text3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }),
        text(k.value, { fontFamily: 'Barlow Condensed', fontSize: '38px', fontWeight: 800, color: accent, lineHeight: 1.1, marginTop: '8px' }),
        text(k.sub, { fontSize: '12px', color: t.text3, marginTop: '4px' })
      ])
    ]);
  };

  const card = (title, extra, body, style = {}) => el('div', {
    flex: '1 1 0', flexDirection: 'column', background: t.s1, border: `1px solid ${t.border}`,
    borderRadius: t.r, padding: '22px', ...style
  }, [
    el('div', { alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }, [
      text(title, { fontFamily: 'Barlow Condensed', fontSize: '15px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: t.text2 }),
      extra || text('', {})
    ]),
    ...body
  ]);

  const checkRow = (exo, index) => el('div', {
    alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: t['r-sm'],
    border: `1px solid ${exo.done ? 'rgba(105,255,71,0.35)' : t.border}`,
    background: exo.done ? 'rgba(105,255,71,0.07)' : t.s2, marginBottom: '10px'
  }, [
    el('div', {
      width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
      alignItems: 'center', justifyContent: 'center',
      border: `2px solid ${exo.done ? t.acc3 : t.border2}`, background: exo.done ? t.acc3 : 'transparent'
    }, [exo.done ? glyph('check', '13px', '#000') : text('', {})]),
    el('div', { flexDirection: 'column', flex: '1 1 0' }, [
      text(exo.name, { fontSize: '14px', fontWeight: 500, color: exo.done ? t.text3 : t.text, textDecoration: exo.done ? 'line-through' : 'none' }),
      text(exo.detail, { fontSize: '11px', color: t.text3, fontFamily: 'JetBrains Mono', marginTop: '3px' })
    ]),
    glyph('clock', '15px', t.acc)
  ]);

  const todayCard = card('Séance du jour',
    el('div', { alignItems: 'center', gap: '10px' }, [
      text(data.today.count, { fontSize: '11px', color: t.text3 }),
      text(data.today.day, { fontSize: '11px', color: t.text3 }),
      el('div', { padding: '5px 10px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.s2 },
        [text('Reset', { fontSize: '10px', color: t.text2, letterSpacing: '1px', textTransform: 'uppercase' })])
    ]),
    [el('div', { flexDirection: 'column' }, data.today.exos.map(checkRow))]);

  const cups = Array.from({ length: data.water.total }, (_, i) => el('div', {
    width: '44px', height: '44px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
    border: `2px solid ${i < data.water.filled ? t.acc : t.border2}`,
    background: i < data.water.filled ? t.acc : t.s2
  }, [i < data.water.filled ? glyph('droplet', '20px', 'rgba(0,0,0,0.45)') : text('', {})]));

  const waterCard = card('Hydratation',
    el('div', { padding: '5px 10px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.s2 },
      [text('Reset', { fontSize: '10px', color: t.text2, letterSpacing: '1px', textTransform: 'uppercase' })]),
    [
      el('div', { flexWrap: 'wrap', gap: '10px' }, cups),
      text('1 verre = 250 ml • Objectif : 2 L/jour', { fontSize: '12px', color: t.text3, marginTop: '16px', width: '100%', justifyContent: 'center' })
    ]);

  const maxVol = Math.max(...data.volume.weeks.map(w => w.value)) || 1;
  const bars = data.volume.weeks.map((wk, i) => el('div', { flexDirection: 'column', alignItems: 'center', flex: '1 1 0', gap: '8px' }, [
    el('div', { width: '100%', height: `${Math.round(wk.value / maxVol * 150)}px`, borderRadius: '5px 5px 0 0',
      background: i === data.volume.weeks.length - 1 ? t.acc : 'rgba(0,229,255,0.28)', alignSelf: 'flex-end' }, []),
    text(wk.label, { fontSize: '10px', color: t.text3, fontFamily: 'JetBrains Mono' })
  ]));
  const volumeCard = card('Volume soulevé (8 sem.)',
    text(data.volume.badge, { fontSize: '12px', color: t.text3, fontFamily: 'JetBrains Mono' }),
    [el('div', { alignItems: 'flex-end', gap: '10px', height: '170px', padding: '16px 18px', background: t.s2, borderRadius: t['r-sm'], marginTop: '12px' }, bars)]);

  const calCells = data.calendar.map(c => {
    const style = {
      width: '30px', height: '30px', flexShrink: 0, borderRadius: '3px',
      marginRight: '16px', marginBottom: '10px',
      background: c.active ? t.acc3 : t.s3
    };
    if (c.future) style.opacity = 0.22;
    if (c.today) style.border = `2px solid ${t.acc}`;
    return el('div', style, []);
  });
  const calColumns = el('div', { flexWrap: 'wrap', width: '322px', flexShrink: 0 }, calCells);

  const activityCard = card('Activité (5 dernières semaines)',
    text(data.streakLabel.replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''), { fontSize: '12px', color: t.acc4, fontWeight: 600, letterSpacing: '1px' }),
    [
      el('div', { marginBottom: '8px', width: '322px' }, ['L','M','M','J','V','S','D'].map(d =>
        text(d, { fontSize: '10px', color: t.text3, width: '46px', flexShrink: 0, justifyContent: 'center' }))),
      el('div', { alignItems: 'flex-start' }, calColumns)
    ]);

  const content = el('div', { flexDirection: 'column', padding: '26px 28px', gap: '20px', flex: '1 1 0' }, [
    hero,
    el('div', { gap: '16px' }, data.kpis.map(statCard)),
    el('div', { gap: '16px' }, [todayCard, waterCard]),
    el('div', { gap: '16px' }, [volumeCard, activityCard])
  ]);

  return el('div', {
    width: '1440px', height: '1180px', background: t.bg, fontFamily: 'Barlow', color: t.text
  }, [sidebar, el('div', { flexDirection: 'column', flex: '1 1 0' }, [topbar, content])]);
}


/* ── Écran : mobile (390 × 844) ── */
function phone(t, data) {
  const NAV = [
    ['profile', 'Profil'], ['dashboard', 'Tableau de bord'], ['planning', 'Planning'], ['programs', 'Programmes'],
    ['nutrition', 'Nutrition'], ['progress', 'Progression'], ['goals', 'Objectifs'], ['history', 'Historique']
  ];
  const navRow = ([key, label]) => el('div', {
    alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px',
    background: key === 'dashboard' ? 'rgba(0,229,255,0.1)' : 'transparent',
    color: key === 'dashboard' ? t.acc : t.text2, fontSize: '14px', fontWeight: 500
  }, [img(dataUri(ICONS[key], key === 'dashboard' ? t.acc : t.text3), { width: '19px', height: '19px' }), text(label, {})]);

  const drawer = el('div', { flexDirection: 'column', width: '230px', flexShrink: 0, background: t.s1, borderRight: `1px solid ${t.border}`, padding: '22px 14px' }, [
    el('div', { alignItems: 'center', gap: '9px', padding: '0 8px 6px' }, [glyph('bolt', '23px', t.acc),
      text('FOCUS', { fontFamily: 'Barlow Condensed', fontSize: '24px', fontWeight: 900, color: t.text, letterSpacing: '1px' })]),
    text('Principal', { fontSize: '10px', color: t.text3, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, padding: '18px 12px 8px' }),
    ...NAV.slice(0, 4).map(navRow),
    text('Suivi', { fontSize: '10px', color: t.text3, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, padding: '18px 12px 8px' }),
    ...NAV.slice(4).map(navRow),
    el('div', { marginTop: 'auto', padding: '14px 12px 0', borderTop: `1px solid ${t.border}` }, [text('v6.0 • PWA Ready', { fontSize: '10px', color: t.text3, letterSpacing: '1px' })])
  ]);

  const topbar = el('div', { height: '56px', alignItems: 'center', gap: '12px', padding: '0 16px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }, [
    el('div', { alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.s2 }, [glyph('menu', '16px', t.text2)]),
    text('Tableau de bord', { fontFamily: 'Barlow Condensed', fontSize: '17px', fontWeight: 700, color: t.text, letterSpacing: '1.2px', textTransform: 'uppercase' }),
    el('div', { marginLeft: 'auto', alignItems: 'center', gap: '8px' }, [
      el('div', { alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.s2 }, [glyph('sun', '15px', t.text2)]),
      el('div', { alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.s2 }, [glyph('clock', '14px', t.text2), text('Timer', { fontSize: '11px', fontWeight: 600, color: t.text2 })])
    ])
  ]);

  const hero = el('div', { flexDirection: 'column', padding: '22px', borderRadius: t.r, border: '1px solid rgba(0,229,255,0.18)',
    backgroundImage: 'radial-gradient(ellipse at 10% 70%, rgba(0,229,255,0.16) 0%, transparent 50%), linear-gradient(135deg, #030c18 0%, #071525 50%, #040e1c 100%)' }, [
    el('div', { alignItems: 'center', gap: '8px' }, [el('div', { width: '20px', height: '2px', background: t.acc, borderRadius: '1px' }, []),
      text(data.greffon.replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''), { fontSize: '10px', color: t.acc, letterSpacing: '2.4px', fontWeight: 700, textTransform: 'uppercase' })]),
    text('Forge ton corps.', { fontFamily: 'Barlow Condensed', fontSize: '30px', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginTop: '12px' }),
    text('Bats tes records.', { fontFamily: 'Barlow Condensed', fontSize: '30px', fontWeight: 900, color: '#fff', lineHeight: 1.1 }),
    el('div', { alignItems: 'center', justifyContent: 'center', gap: '9px', marginTop: '18px', padding: '13px 20px', borderRadius: '8px', background: t.acc },
      [glyph('bolt', '15px', '#000'), text('Lancer la séance', { fontSize: '13px', fontWeight: 700, color: '#000', letterSpacing: '1.4px', textTransform: 'uppercase' })])
  ]);

  const kpi = (k) => {
    const accent = { acc: t.acc, acc3: t.acc3, acc4: t.acc4, acc5: t.acc5 }[k.accent];
    return el('div', { flexDirection: 'column', width: '166px', background: t.s1, border: `1px solid ${t.border}`, borderRadius: t.r, overflow: 'hidden', marginBottom: '12px', marginRight: '12px' }, [
      el('div', { height: '2px', background: accent, flexShrink: 0 }, []),
      el('div', { flexDirection: 'column', padding: '14px 16px 16px' }, [
        text(k.label, { fontSize: '10px', color: t.text3, letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 600 }),
        text(k.value, { fontFamily: 'Barlow Condensed', fontSize: '32px', fontWeight: 800, color: accent, lineHeight: 1.1, marginTop: '6px' }),
        text(k.sub, { fontSize: '11px', color: t.text3, marginTop: '2px' })
      ])
    ]);
  };

  const checkRow = (exo) => el('div', { alignItems: 'center', gap: '11px', padding: '11px 13px', borderRadius: t['r-sm'],
    border: `1px solid ${exo.done ? 'rgba(105,255,71,0.35)' : t.border}`, background: exo.done ? 'rgba(105,255,71,0.07)' : t.s2, marginBottom: '9px' }, [
    el('div', { width: '19px', height: '19px', borderRadius: '5px', flexShrink: 0, alignItems: 'center', justifyContent: 'center',
      border: `2px solid ${exo.done ? t.acc3 : t.border2}`, background: exo.done ? t.acc3 : 'transparent' }, [exo.done ? glyph('check', '12px', '#000') : text('', {})]),
    el('div', { flexDirection: 'column', flex: '1 1 0' }, [
      text(exo.name, { fontSize: '13px', fontWeight: 500, color: exo.done ? t.text3 : t.text }),
      text(exo.detail, { fontSize: '10px', color: t.text3, fontFamily: 'JetBrains Mono', marginTop: '2px' })]),
    glyph('clock', '14px', t.acc)
  ]);

  const card = (title, extra, body) => el('div', { flexDirection: 'column', background: t.s1, border: `1px solid ${t.border}`, borderRadius: t.r, padding: '18px', marginBottom: '12px' }, [
    el('div', { alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }, [
      text(title, { fontFamily: 'Barlow Condensed', fontSize: '14px', fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: t.text2 }), extra]),
    ...body
  ]);

  const cups = el('div', { flexWrap: 'wrap' }, Array.from({ length: 8 }, (_, i) => el('div', {
    width: '36px', height: '36px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', marginRight: '9px',
    border: `2px solid ${i < data.water.filled ? t.acc : t.border2}`, background: i < data.water.filled ? t.acc : t.s2
  }, [i < data.water.filled ? glyph('droplet', '17px', 'rgba(0,0,0,0.45)') : text('', {})])));

  const content = el('div', { flexDirection: 'column', padding: '16px' }, [
    hero,
    el('div', { flexWrap: 'wrap', marginTop: '16px', width: '356px' }, data.kpis.map(kpi)),
    card('Séance du jour', text(`${data.today.count} · ${data.today.day}`, { fontSize: '11px', color: t.text3 }), [el('div', { flexDirection: 'column' }, data.today.exos.map(checkRow))]),
    card('Hydratation', text('Reset', { fontSize: '10px', color: t.text2, letterSpacing: '1px', textTransform: 'uppercase', padding: '5px 9px', border: `1px solid ${t.border}`, borderRadius: '6px', background: t.s2 }), [
      cups, text('1 verre = 250 ml • Objectif : 2 L/jour', { fontSize: '11px', color: t.text3, marginTop: '12px', width: '100%', justifyContent: 'center' })
    ])
  ]);

  return el('div', { width: '850px', height: '1050px', background: t.bg, fontFamily: 'Barlow', color: t.text, alignItems: 'center' }, [
    el('div', { width: '390px', flexDirection: 'column', background: t.bg, border: `1px solid ${t.border2}`, borderRadius: '26px', overflow: 'hidden', flexShrink: 0 }, [topbar, content]),
    el('div', { flexDirection: 'column', marginLeft: '36px', width: '230px', background: t.s1, borderRadius: t.r, border: `1px solid ${t.border}`, padding: '16px 10px' }, [
      text('Menu ouvert (bouton d\u2019en-tête)', { fontSize: '10px', color: t.text3, letterSpacing: '1.4px', textTransform: 'uppercase', padding: '0 8px 10px' }),
      ...NAV.slice(0, 4).map(navRow), ...NAV.slice(4).map(navRow)
    ])
  ]);
}

/* ── Écran : récapitulatif de fin de séance (A17) ── */
function timerDone() {
  const t = DARK;
  return el('div', {
    width: '760px', height: '600px', background: '#06090d', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Barlow', padding: '40px'
  }, [
    el('div', {
      width: '420px', flexDirection: 'column', alignItems: 'center', background: '#0d1117',
      border: '1px solid #1e2a38', borderRadius: '20px', padding: '48px 24px', gap: '18px'
    }, [
      el('div', {
        width: '76px', height: '76px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
        background: '#00e5ff', boxShadow: '0 0 0 10px rgba(0,229,255,0.12)'
      }, [glyph('check', '38px', '#000')]),
      text('Séance terminée !', { fontFamily: 'Barlow Condensed', fontSize: '28px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#fff' }),
      el('div', { gap: '28px', justifyContent: 'center' }, [
        ['42:18', 'Durée'], ['2', 'Exercices'], ['9,6 t', 'Volume soulevé']
      ].map(([v, l]) => el('div', { flexDirection: 'column', alignItems: 'center', gap: '4px' }, [
        text(v, { fontFamily: 'Barlow Condensed', fontSize: '26px', fontWeight: 800, color: '#fff' }),
        text(l, { fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' })
      ]))),
      text('12 séries enregistrées — retrouvez le détail dans l\u2019historique.', { fontSize: '12px', color: 'rgba(255,255,255,0.65)', width: '280px', justifyContent: 'center', lineHeight: 1.6 }),
      el('div', { padding: '12px 20px', borderRadius: '8px', background: t.acc }, [
        text('Fermer le récapitulatif', { fontSize: '13px', fontWeight: 700, color: '#000', letterSpacing: '1.5px', textTransform: 'uppercase' })
      ])
    ])
  ]);
}

/* ── Écran : sauvegarde des données (Profil) ── */
function dataSection(t) {
  const btn = (label, bg, color, border) => el('div', {
    padding: '11px 18px', borderRadius: t['r-sm'], background: bg, color,
    border: border ? `1px solid ${border}` : '1px solid transparent'
  }, [text(label, { fontSize: '12px', fontWeight: 700, letterSpacing: '1.3px', textTransform: 'uppercase', color })]);
  return el('div', {
    width: '860px', fontFamily: 'Barlow', background: t.bg, padding: '40px', flexDirection: 'column'
  }, [
    el('div', { flexDirection: 'column', background: t.s1, border: `1px solid ${t.border}`, borderRadius: t.r, padding: '22px' }, [
      text('Sauvegarde des données', { fontFamily: 'Barlow Condensed', fontSize: '15px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: t.text2, marginBottom: '16px' }),
      text('Vos données restent dans ce navigateur, sur cet appareil. Exportez régulièrement un fichier de sauvegarde : vider les données du navigateur effacerait définitivement votre historique.',
        { fontSize: '13px', color: t.text2, lineHeight: 1.6, marginBottom: '16px' }),
      el('div', { gap: '10px', flexWrap: 'wrap' }, [
        btn('⬇ Exporter (JSON)', t.acc, '#000'),
        btn('⬆ Importer', 'transparent', t.text2, t.border2),
        btn('Tout effacer', 'transparent', t.acc2, 'rgba(255,82,82,0.4)')
      ]),
      text('✓ Sauvegarde importée : 24 séance(s), 132 charge(s), 13 pesée(s).', { fontSize: '12px', color: t.acc3, fontWeight: 600, marginTop: '14px', letterSpacing: '.3px' })
    ])
  ]);
}

const OUT = path.resolve(__dirname, '..', '..', 'docs', 'apercus');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
  const shots = [
    ['apercu-tableau-de-bord.png', dashboard(DARK, data), 1440, 1180],
    ['apercu-tableau-de-bord-clair.png', dashboard(LIGHT, data), 1440, 1180],
    ['apercu-mobile.png', phone(DARK, data), 850, 1050],
    ['apercu-fin-de-seance.png', timerDone(), 760, 600],
    ['apercu-sauvegarde.png', dataSection(DARK), 860, 300],
  ];
  for (const [file, node, width, height] of shots) {
    const svg = await satori(node, { width, height, fonts: FONTS });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: width * 2 } }).render().asPng();
    fs.writeFileSync(path.join(OUT, file), png);
    console.log(file, '→', (png.length / 1024).toFixed(0), 'Ko', `(${width * 2}px de large)`);
  }
})().catch(e => { console.error('ERREUR:', e.message.slice(0, 400)); process.exit(1); });
