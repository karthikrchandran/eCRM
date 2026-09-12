import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = __dirname;
const previewDir = path.join(outDir, 'assets', 'previews');

const screenshot = (name) => `assets/screenshots/${name}.png`;
const graphic = (name) => `assets/graphics/${name}.png`;

const lifecycle = [
  ['01', 'Lead', 'Customer context', '#22c7ee'],
  ['02', 'Opportunity', 'Pursuit and value', '#4f8df7'],
  ['03', 'Proposal', 'Terms and GST', '#8b72ff'],
  ['04', 'Order', 'Booked snapshot', '#f2b84b'],
  ['05', 'Production', 'Delivery stages', '#ff7a6f'],
  ['06', 'Finance', 'Margin and cash', '#36d399'],
  ['07', 'Reports', 'Operating view', '#22c7ee']
];

const featureModules = [
  ['CRM', 'CRM core', 'Leads/customers, branches, contacts, activities, ownership, reassignment, and CSV import.', '#22c7ee'],
  ['DAY', 'My Day', 'Daily sales planning, voice notes, transcripts, suggested actions, insights, and end-of-day review.', '#4f8df7'],
  ['PIPE', 'Pipeline', 'Configurable opportunity stages, owner splits, target tracking, and follow-up driven views.', '#8b72ff'],
  ['PROP', 'Proposals', 'Commercial summaries, GST line totals, statuses, and external document or Canva links.', '#f2b84b'],
  ['ORD', 'Orders', 'Accepted-proposal conversion with PO metadata and preserved commercial snapshots.', '#ff7a6f'],
  ['PROD', 'Production', 'Order-line work items, templates, stage updates, notes, owners, and due dates.', '#e96b90'],
  ['FIN', 'Finance', 'Invoice, payment, cost, gross-margin, incentive, split, and approval records.', '#36d399'],
  ['RPT', 'Reports', 'Read-only views for billings, pipeline, collections, production, clients, and products.', '#22c7ee']
];

const productRows = [
  ['eLearning', '18%', 'eLearning production', 'Script → storyboard → development → voiceover → review → delivery'],
  ['Video shoot', '18%', 'Video shoot production', 'Script → pre-production → shoot → edit → review → delivery'],
  ['VR/AR', '18%', 'VR/AR production', 'Discovery → experience design → development → testing → review → delivery'],
  ['Animation', '18%', 'Animation production', 'Script → storyboard → modeling → animation → voiceover → review → delivery'],
  ['Other service', '18%', 'No default template', 'Flexible service category for unmapped work']
];

const css = `
  :root {
    --navy: #061f52;
    --ink: #08275d;
    --brand: #175ec5;
    --blue: #2f7df4;
    --cyan: #22c7ee;
    --mint: #36d399;
    --amber: #f2b84b;
    --violet: #8b72ff;
    --coral: #ff7a6f;
    --slate: #42526b;
    --muted: #697892;
    --line: #ccdaec;
    --pale: #edf5ff;
    --paper: #ffffff;
    --canvas: #f4f8fd;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: Aptos, 'Segoe UI', Arial, sans-serif;
    color: var(--ink);
    background: var(--canvas);
  }
  h1, h2, h3, p, figure { margin: 0; }
  p { line-height: 1.48; }
  .brand-lockup { display: inline-flex; align-items: center; gap: 9px; font-weight: 800; letter-spacing: -.02em; }
  .brand-dot { width: 12px; height: 12px; border-radius: 4px; background: linear-gradient(135deg, var(--cyan), var(--violet)); box-shadow: 0 0 0 5px rgb(34 199 238 / .12); }
  .eyebrow { color: var(--blue); font-size: 11px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
  .muted { color: var(--muted); }
  .small { font-size: 11px; }
  .tag-row { display: flex; flex-wrap: wrap; gap: 7px; }
  .tag { display: inline-flex; align-items: center; border: 1px solid #b9ccec; border-radius: 999px; padding: 6px 11px; color: var(--ink); background: rgb(255 255 255 / .84); font-size: 11px; font-weight: 750; }
  .card { border: 1px solid var(--line); border-radius: 14px; background: rgb(255 255 255 / .94); box-shadow: 0 16px 38px rgb(8 39 93 / .09); }
  .grid-surface {
    background-color: #f7fbff;
    background-image: linear-gradient(rgb(23 94 197 / .045) 1px, transparent 1px), linear-gradient(90deg, rgb(23 94 197 / .045) 1px, transparent 1px);
    background-size: 28px 28px;
  }
  .screen-frame { position: relative; padding: 9px; border: 1px solid #bfd0e8; border-radius: 14px; background: white; box-shadow: 0 20px 44px rgb(8 39 93 / .15); }
  .screen-top { display: flex; align-items: center; gap: 5px; height: 16px; padding-left: 2px; }
  .screen-top i { width: 6px; height: 6px; border-radius: 50%; background: #d2ddec; }
  .screen-top i:first-child { background: #ff7a6f; }
  .screen-top i:nth-child(2) { background: #f2b84b; }
  .screen-top i:nth-child(3) { background: #36d399; }
  .screen { display: block; width: 100%; border-radius: 8px; object-fit: cover; object-position: top; background: white; }
  .screen-caption { display: flex; justify-content: space-between; gap: 10px; margin-top: 7px; color: var(--muted); font-size: 9px; }
  .screen-caption b { color: var(--ink); }
  .lifecycle { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; position: relative; }
  .lifecycle::before { content: ''; position: absolute; left: 5%; right: 5%; top: 18px; height: 2px; background: linear-gradient(90deg, var(--cyan), var(--blue), var(--violet), var(--amber), var(--coral), var(--mint), var(--cyan)); opacity: .7; }
  .life-step { position: relative; z-index: 1; text-align: center; }
  .life-num { display: grid; place-items: center; width: 36px; height: 36px; margin: 0 auto 8px; border-radius: 12px; color: var(--ink); font-size: 10px; font-weight: 900; background: white; border: 2px solid var(--accent); box-shadow: 0 8px 20px rgb(8 39 93 / .12); }
  .life-step b { display: block; font-size: 12px; color: var(--ink); }
  .life-step span { display: block; margin-top: 3px; color: var(--muted); font-size: 9px; line-height: 1.25; }
  .module-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .module-card { position: relative; min-height: 112px; padding: 14px; overflow: hidden; }
  .module-card::after { content: ''; position: absolute; inset: auto -28px -35px auto; width: 88px; height: 88px; border-radius: 50%; background: var(--accent); opacity: .09; }
  .glyph { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; color: var(--ink); background: color-mix(in srgb, var(--accent) 16%, white); border: 1px solid color-mix(in srgb, var(--accent) 45%, white); font-size: 9px; font-weight: 900; letter-spacing: .05em; }
  .module-card h3 { margin-top: 10px; font-size: 15px; }
  .module-card p { margin-top: 5px; font-size: 10.5px; color: var(--slate); line-height: 1.35; }
  .outcome-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .outcome { padding: 14px; border-top: 4px solid var(--accent); }
  .outcome b { display: block; font-size: 15px; color: var(--ink); }
  .outcome p { margin-top: 6px; font-size: 11px; color: var(--slate); }
  .path-list { display: grid; gap: 8px; }
  .path-item { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: white; }
  .path-item .dot { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 11px; color: white; background: var(--accent); font-size: 11px; font-weight: 900; }
  .path-item b { font-size: 12px; }
  .path-item p { margin-top: 2px; color: var(--muted); font-size: 9.5px; }
  .metric-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .metric { padding: 13px; border: 1px solid rgb(255 255 255 / .24); border-radius: 14px; background: rgb(255 255 255 / .105); backdrop-filter: blur(12px); }
  .metric strong { display: block; color: white; font-size: 31px; line-height: 1; }
  .metric span { display: block; margin-top: 7px; color: #dceaff; font-size: 10.5px; line-height: 1.25; }
  .role-map { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .role { padding: 14px; }
  .role h3 { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  .role h3::before { content: ''; width: 10px; height: 10px; border-radius: 3px; background: var(--accent); }
  .role ul { margin: 8px 0 0; padding-left: 17px; }
  .role li { margin: 4px 0; font-size: 10.5px; color: var(--slate); }
  .quote-block { position: relative; padding: 20px; color: var(--ink); font-size: 22px; line-height: 1.25; overflow: hidden; }
  .quote-block::before { content: '“'; position: absolute; right: 14px; top: -25px; color: var(--pale); font-size: 150px; font-family: Georgia, serif; z-index: 0; }
  .quote-block > * { position: relative; z-index: 1; }
  .compare { display: grid; grid-template-columns: 1fr 40px 1fr; gap: 12px; align-items: stretch; }
  .compare-panel { padding: 16px; }
  .compare-panel h3 { font-size: 17px; }
  .compare-panel ul { margin: 10px 0 0; padding-left: 18px; }
  .compare-panel li { margin: 7px 0; color: var(--slate); font-size: 11px; }
  .compare-arrow { display: grid; place-items: center; color: var(--blue); font-size: 29px; font-weight: 900; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { color: var(--ink); text-align: left; background: #e8f2ff; }
  th, td { border-bottom: 1px solid #d7e2f0; padding: 7px 8px; vertical-align: top; }
  .callout { border-left: 4px solid var(--accent, var(--blue)); border-radius: 0 10px 10px 0; background: color-mix(in srgb, var(--accent, var(--blue)) 8%, white); padding: 10px 12px; color: var(--slate); }
  .callout b { color: var(--ink); }
`;

const deckCss = `
  @page { size: 13.333in 7.5in; margin: 0; }
  ${css}
  body { background: white; }
  .slide { width: 13.333in; height: 7.5in; padding: .44in .56in; page-break-after: always; position: relative; overflow: hidden; background: linear-gradient(180deg, #f8fbff 0%, #fff 58%, #eef5fc 100%); }
  .slide:last-child { page-break-after: auto; }
  .slide.dark { color: white; background: linear-gradient(135deg, #051b47, #0a3577 62%, #244c7a); }
  .slide h1 { font-size: 42px; line-height: 1.03; letter-spacing: -.035em; }
  .slide h2 { color: var(--ink); font-size: 28px; line-height: 1.1; letter-spacing: -.025em; }
  .slide.dark h1, .slide.dark h2 { color: white; }
  .slide-lead { margin-top: 14px; max-width: 7in; color: #dfeeff; font-size: 17px; }
  .slide-kicker { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .footer { position: absolute; left: .56in; right: .56in; bottom: .2in; display: flex; justify-content: space-between; color: #74849a; font-size: 9px; }
  .dark .footer { color: #a9bfdd; }
  .deck-cover { padding: 0; }
  .cover-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cover-shade { position: absolute; inset: 0; background: linear-gradient(90deg, #041a45 0%, #07275e 38%, rgb(6 31 82 / .55) 63%, rgb(6 31 82 / .08) 100%); }
  .cover-copy { position: absolute; left: .58in; top: .48in; width: 6.2in; color: white; }
  .cover-copy h1 { margin-top: .58in; max-width: 5.8in; font-size: 48px; }
  .cover-metrics { position: absolute; left: .58in; right: .58in; bottom: .55in; }
  .deck-grid { display: grid; grid-template-columns: 1.08fr .92fr; gap: .3in; align-items: center; margin-top: .25in; }
  .deck-grid.reverse { grid-template-columns: .92fr 1.08fr; }
  .hero-panel { position: relative; height: 4.65in; border-radius: 20px; overflow: hidden; box-shadow: 0 24px 50px rgb(8 39 93 / .18); }
  .hero-panel img { width: 100%; height: 100%; object-fit: cover; }
  .hero-panel::after { content: ''; position: absolute; inset: 0; border: 1px solid rgb(255 255 255 / .8); border-radius: inherit; pointer-events: none; }
  .deck-screen .screen { height: 4.55in; }
  .deck-lifecycle-screen .screen { height: 3.62in; }
  .deck-screen.tall .screen { height: 4.82in; }
  .deck-lifecycle { margin-top: .32in; padding: 18px 16px 14px; }
  .deck-modules { margin-top: .27in; }
  .proof-stack { display: grid; gap: 9px; }
  .proof { display: grid; grid-template-columns: 7px 1fr; gap: 12px; padding: 13px; }
  .proof i { border-radius: 999px; background: var(--accent); }
  .proof b { display: block; font-size: 14px; }
  .proof p { margin-top: 4px; color: var(--slate); font-size: 10.5px; }
  .ring-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 11px; margin-top: .24in; }
  .ring-card { padding: 12px; text-align: center; }
  .ring { display: grid; place-items: center; width: 74px; height: 74px; margin: 0 auto 9px; border-radius: 50%; background: conic-gradient(var(--accent) var(--sweep), #deebf7 0); position: relative; }
  .ring::after { content: ''; position: absolute; width: 56px; height: 56px; border-radius: 50%; background: white; }
  .ring b { position: relative; z-index: 1; font-size: 17px; }
  .ring-card span { font-size: 10px; color: var(--muted); }
  .closing-art { position: absolute; right: -1in; top: 0; width: 8.2in; height: 7.5in; object-fit: cover; opacity: .52; }
  .closing-shade { position: absolute; inset: 0; background: linear-gradient(90deg, #041b49 0%, #07265b 48%, rgb(7 38 91 / .45) 82%, transparent); }
`;

const brochureCss = `
  @page { size: A4; margin: 0; }
  ${css}
  body { background: white; }
  .page { width: 210mm; height: 297mm; overflow: hidden; padding: 12mm 14mm; page-break-after: always; position: relative; background: linear-gradient(180deg, #f8fbff, white 62%); }
  .page:last-child { page-break-after: auto; }
  .page h1 { color: var(--ink); font-size: 29px; line-height: 1.04; letter-spacing: -.035em; }
  .page h2 { color: var(--ink); font-size: 18px; margin-bottom: 6px; }
  .page h3 { color: var(--ink); font-size: 12px; }
  .brochure-hero { display: grid; grid-template-columns: .9fr 1.1fr; gap: 8mm; align-items: center; }
  .brochure-art { height: 79mm; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 36px rgb(8 39 93 / .16); }
  .brochure-art img { width: 100%; height: 100%; object-fit: cover; }
  .brochure-lead { margin-top: 4mm; color: var(--slate); font-size: 11.5px; }
  .brochure-section { margin-top: 7mm; }
  .page .lifecycle { gap: 4px; }
  .page .life-num { width: 29px; height: 29px; border-radius: 9px; }
  .page .lifecycle::before { top: 14px; }
  .page .life-step b { font-size: 9px; }
  .page .life-step span { font-size: 7px; }
  .page .outcome { min-height: 55px; padding: 9px; }
  .page .outcome b { font-size: 12px; }
  .page .outcome p { font-size: 8.5px; line-height: 1.3; }
  .screen-montage { display: grid; grid-template-columns: 1.15fr .85fr; gap: 6px; }
  .screen-montage .screen-frame:first-child { grid-row: span 2; }
  .screen-montage .screen-frame:first-child .screen { height: 65mm; }
  .screen-montage .screen-frame:not(:first-child) .screen { height: 29mm; }
  .page .module-grid { grid-template-columns: repeat(4, 1fr); gap: 5px; }
  .page .module-card { min-height: 58px; padding: 8px; border-radius: 10px; }
  .page .glyph { width: 26px; height: 26px; border-radius: 8px; font-size: 7px; }
  .page .module-card h3 { margin-top: 6px; font-size: 10px; }
  .page .module-card p { display: none; }
  .page .role { padding: 10px; }
  .page .role h3 { font-size: 12px; }
  .page .role li { font-size: 8.5px; margin: 3px 0; }
  .brochure-transform { height: 58mm; border-radius: 16px; overflow: hidden; }
  .brochure-transform img { width: 100%; height: 100%; object-fit: cover; }
  .fit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .fit { padding: 9px; min-height: 58px; }
  .fit b { font-size: 11px; }
  .fit p { margin-top: 4px; color: var(--slate); font-size: 8.5px; line-height: 1.3; }
  .fineprint { color: var(--muted); font-size: 7.5px; line-height: 1.35; }
`;

const guideCss = `
  @page { size: A4; margin: 11mm 12mm; }
  ${css}
  body { background: white; color: #102a53; font-size: 10.5px; }
  .guide-page { width: 186mm; page-break-after: always; min-height: 275mm; position: relative; }
  .guide-page:last-child { page-break-after: auto; }
  .guide-cover { min-height: 275mm; overflow: hidden; border-radius: 0; color: white; background: var(--navy); }
  .guide-cover-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .guide-cover-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(4 25 67 / .72), rgb(4 25 67 / .96) 70%); }
  .guide-cover-copy { position: absolute; inset: 18mm 14mm; display: flex; flex-direction: column; justify-content: space-between; }
  .guide-cover h1 { margin-top: 16mm; color: white; font-size: 39px; line-height: 1.04; letter-spacing: -.035em; max-width: 145mm; }
  .guide-cover .lead { margin-top: 7mm; max-width: 145mm; color: #dfedff; font-size: 14px; }
  .guide-cover .lifecycle::before { background: linear-gradient(90deg, var(--cyan), var(--blue), var(--violet), var(--amber), var(--coral), var(--mint), var(--cyan)); }
  .guide-cover .life-num { background: rgb(255 255 255 / .12); color: white; }
  .guide-cover .life-step b { color: white; }
  .guide-cover .life-step span { color: #bfd3ef; }
  .chapter-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; padding-bottom: 9px; border-bottom: 1px solid #dce6f2; }
  .chapter-num { display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 38px; border-radius: 12px; color: white; background: linear-gradient(135deg, var(--brand), var(--violet)); font-size: 12px; font-weight: 900; }
  .guide-page h1 { color: var(--ink); font-size: 25px; line-height: 1.08; letter-spacing: -.025em; }
  .guide-page.guide-cover h1 { color: white; }
  .guide-page h2 { color: var(--ink); font-size: 17px; margin: 13px 0 6px; }
  .guide-page h3 { color: var(--ink); font-size: 12.5px; margin: 0 0 5px; }
  .guide-page ol, .guide-page ul { margin: 5px 0 0; padding-left: 17px; }
  .guide-page li { margin: 3.5px 0; line-height: 1.4; }
  .guide-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .howto { padding: 10px; border-top: 3px solid var(--accent, var(--blue)); }
  .howto .mini-label { color: var(--accent, var(--blue)); font-size: 8px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
  .guide-shot { margin-top: 8px; }
  .guide-shot .screen { max-height: 92mm; object-fit: contain; }
  .guide-shot.short .screen { max-height: 66mm; }
  .guide-shot.tall .screen { max-height: 120mm; }
  .guide-shot .screen-caption { font-size: 8px; }
  .contents-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10mm; }
  .contents-card { display: grid; grid-template-columns: 30px 1fr; gap: 9px; align-items: center; padding: 10px; }
  .contents-card .chapter-num { width: 30px; height: 30px; border-radius: 9px; font-size: 9px; }
  .contents-card b { display: block; font-size: 12px; }
  .contents-card span { display: block; margin-top: 2px; color: var(--muted); font-size: 9px; }
  .route-band { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
  .route { padding: 5px 8px; border-radius: 8px; color: var(--ink); background: #edf5ff; border: 1px solid #ccddf3; font-size: 8.5px; font-weight: 750; }
  .guide-footer { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; border-top: 1px solid #dce6f2; padding-top: 5px; color: var(--muted); font-size: 7.5px; }
`;

function brandLockup(light = false) {
  return `<div class='brand-lockup' style='color:${light ? '#fff' : 'var(--ink)'}'><span class='brand-dot'></span><span>ARA Global eCRM</span></div>`;
}

function lifecycleRail({ compact = false } = {}) {
  return `<div class='lifecycle ${compact ? 'compact' : ''}'>${lifecycle.map(([num, title, note, accent]) => `
    <div class='life-step' style='--accent:${accent}'><span class='life-num'>${num}</span><b>${title}</b><span>${note}</span></div>
  `).join('')}</div>`;
}

function moduleCards() {
  return `<div class='module-grid'>${featureModules.map(([glyph, title, text, accent]) => `
    <div class='module-card card' style='--accent:${accent}'><span class='glyph'>${glyph}</span><h3>${title}</h3><p>${text}</p></div>
  `).join('')}</div>`;
}

function screenFrame(name, title, caption, extra = '') {
  return `<figure class='screen-frame ${extra}'><div class='screen-top'><i></i><i></i><i></i></div><img class='screen' src='${screenshot(name)}' alt='${title}'><figcaption class='screen-caption'><b>${title}</b><span>${caption}</span></figcaption></figure>`;
}

function outcomeCards() {
  return `<div class='outcome-grid'>
    <div class='outcome card' style='--accent:var(--cyan)'><b>Cleaner execution</b><p>Daily work, calls, notes, follow-ups, and account context stay connected.</p></div>
    <div class='outcome card' style='--accent:var(--amber)'><b>Controlled handoffs</b><p>Accepted commercial terms carry into orders before delivery work begins.</p></div>
    <div class='outcome card' style='--accent:var(--mint)'><b>Visible economics</b><p>Billings, collections, costs, margin, incentives, and progress share one view.</p></div>
  </div>`;
}

function roleMap() {
  return `<div class='role-map'>
    <div class='role card' style='--accent:var(--violet)'><h3>Admin</h3><ul><li>All commercial and operational routes</li><li>Catalog and production configuration</li><li>Finance records and incentive controls</li><li>Company-wide reporting</li></ul></div>
    <div class='role card' style='--accent:var(--cyan)'><h3>Sales</h3><ul><li>Company-wide CRM and pipeline context</li><li>My Day planning and voice notes</li><li>Opportunities, proposals, and orders</li><li>Production, payment, and report visibility</li></ul></div>
  </div>`;
}

function productTable() {
  return `<table><thead><tr><th>Product/service</th><th>GST</th><th>Template</th><th>Default workflow</th></tr></thead><tbody>${productRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function proofStack(rows) {
  return `<div class='proof-stack'>${rows.map(([title, text, accent]) => `<div class='proof card' style='--accent:${accent}'><i></i><div><b>${title}</b><p>${text}</p></div></div>`).join('')}</div>`;
}

function pathList(rows) {
  return `<div class='path-list'>${rows.map(([num, title, text, accent]) => `<div class='path-item'><span class='dot' style='--accent:${accent}'>${num}</span><div><b>${title}</b><p>${text}</p></div></div>`).join('')}</div>`;
}

function deckFooter(page) {
  return `<div class='footer'><span>ARA Global eCRM · Product overview</span><span>${String(page).padStart(2, '0')}</span></div>`;
}

function guideHead(num, title, eyebrow) {
  return `<div class='chapter-head'><div><p class='eyebrow'>${eyebrow}</p><h1>${title}</h1></div><span class='chapter-num'>${num}</span></div>`;
}

function guideFooter(page, label) {
  return `<div class='guide-footer'><span>ARA Global eCRM · User guide</span><span>${label} · ${page}</span></div>`;
}

function deckHtml() {
  return `<!doctype html><html><head><meta charset='utf-8'><title>eCRM Pitch Deck</title><style>${deckCss}</style></head><body>
    <section class='slide dark deck-cover' id='deck-cover'>
      <img class='cover-art' src='${graphic('ecrm-lead-to-cash-hero-v2')}' alt='Abstract connected lead-to-cash workflow'>
      <div class='cover-shade'></div>
      <div class='cover-copy'>
        ${brandLockup(true)}
        <p class='eyebrow' style='color:#a8dfff;margin-top:.42in'>Connected lead-to-cash operations</p>
        <h1>Run sales, delivery, and cash flow as one operating rhythm.</h1>
        <p class='slide-lead'>eCRM connects daily selling, commercial control, order handoff, production progress, finance visibility, and management reporting in one focused workspace.</p>
      </div>
      <div class='cover-metrics metric-strip'>
        <div class='metric'><strong>8</strong><span>Connected operational modules</span></div>
        <div class='metric'><strong>2</strong><span>Simple roles: Admin and Sales</span></div>
        <div class='metric'><strong>5</strong><span>Seeded service categories</span></div>
        <div class='metric'><strong>4</strong><span>Production workflow templates</span></div>
      </div>
    </section>
    <section class='slide grid-surface' id='deck-problem'>
      <div class='slide-kicker'><div><p class='eyebrow'>The operating problem</p><h2>Fragmented handoffs hide work, delay cash, and blur ownership.</h2></div>${brandLockup()}</div>
      <div class='deck-grid'>
        <div class='hero-panel'><img src='${graphic('ecrm-connected-work-v2')}' alt='Fragmented work becoming a connected system'></div>
        <div class='compare' style='grid-template-columns:1fr'>
          <div class='compare-panel card' style='border-top:4px solid var(--coral)'><h3>When work is scattered</h3><ul><li>Lead context and follow-ups drift apart</li><li>Proposal history becomes manual</li><li>Booked terms are re-keyed for delivery</li><li>Collections and margin appear too late</li></ul></div>
          <div class='compare-arrow' style='transform:rotate(90deg)'>→</div>
          <div class='compare-panel card' style='border-top:4px solid var(--mint)'><h3>When the lifecycle is connected</h3><ul><li>One customer context follows every pursuit</li><li>Commercial snapshots survive handoff</li><li>Production work stays stage-visible</li><li>Management sees pipeline to cash</li></ul></div>
        </div>
      </div>
      ${deckFooter(2)}
    </section>
    <section class='slide grid-surface' id='deck-lifecycle'>
      <div class='slide-kicker'><div><p class='eyebrow'>The operating model</p><h2>One lifecycle. Seven visible control points.</h2></div>${brandLockup()}</div>
      <div class='deck-lifecycle card'>${lifecycleRail()}</div>
      <div style='margin-top:.2in'>${screenFrame('dashboard', 'Management dashboard', 'Live local seed/demo data', 'deck-screen deck-lifecycle-screen')}</div>
      ${deckFooter(3)}
    </section>
    <section class='slide' id='deck-capabilities'>
      <div class='slide-kicker'><div><p class='eyebrow'>Capability system</p><h2>Eight modules built around the same operating context.</h2></div>${brandLockup()}</div>
      <div class='deck-modules'>${moduleCards()}</div>
      <div class='callout' style='--accent:var(--cyan);margin-top:13px'><b>Design principle:</b> ownership supports responsibility, filtering, targets, and incentives; it does not hide company records from other Sales users.</div>
      ${deckFooter(4)}
    </section>
    <section class='slide grid-surface' id='deck-my-day'>
      <div class='slide-kicker'><div><p class='eyebrow'>Daily sales execution</p><h2>Turn a day of activity into deliberate, visible work.</h2></div>${brandLockup()}</div>
      <div class='deck-grid reverse'>
        ${pathList([
          ['01', 'Plan', 'Prioritize today, upcoming, overdue, and follow-up work.', '#2f7df4'],
          ['02', 'Capture', 'Record tasks, call notes, voice notes, and linked account context.', '#8b72ff'],
          ['03', 'Interpret', 'Review transcript-driven suggestions and attention signals.', '#f2b84b'],
          ['04', 'Close the loop', 'Complete, carry forward, or intentionally re-plan unfinished work.', '#36d399']
        ])}
        ${screenFrame('my-day', 'My Day workspace', 'Personal planning without silent CRM mutations', 'deck-screen tall')}
      </div>
      ${deckFooter(5)}
    </section>
    <section class='slide' id='deck-commercial'>
      <div class='slide-kicker'><div><p class='eyebrow'>Commercial control</p><h2>Keep the record structured—from pursuit to booked order.</h2></div>${brandLockup()}</div>
      <div class='deck-grid'>
        ${screenFrame('proposal-detail', 'Proposal detail', 'Terms, lines, GST, status, and document links', 'deck-screen tall')}
        ${proofStack([
          ['Proposal', 'Capture assumptions, inclusions, exclusions, payment terms, timeline, and catalog-backed line items.', '#8b72ff'],
          ['Acceptance', 'Use explicit status actions so the commercial state remains visible and auditable.', '#f2b84b'],
          ['Order', 'Book once from the accepted proposal and preserve totals, customer, owner, lines, and PO context.', '#36d399']
        ])}
      </div>
      ${deckFooter(6)}
    </section>
    <section class='slide grid-surface' id='deck-production'>
      <div class='slide-kicker'><div><p class='eyebrow'>Delivery control</p><h2>Make post-sale progress as visible as the pipeline.</h2></div>${brandLockup()}</div>
      <div class='deck-grid reverse'>
        ${proofStack([
          ['Template-driven start', 'Products and services map to reusable production templates.', '#22c7ee'],
          ['Stage-level ownership', 'Each work item carries status, assignment, due date, notes, and completion data.', '#8b72ff'],
          ['Order-line traceability', 'Delivery work remains connected to its customer, order, and commercial snapshot.', '#ff7a6f'],
          ['Management scan', 'The board highlights what is active, complete, skipped, blocked, assigned, or due.', '#36d399']
        ])}
        ${screenFrame('production', 'Production board', 'Work organized by booked order and service line', 'deck-screen tall')}
      </div>
      ${deckFooter(7)}
    </section>
    <section class='slide' id='deck-model'>
      <div class='slide-kicker'><div><p class='eyebrow'>Commercial foundation</p><h2>Seeded for INR, GST, service delivery, and margin visibility.</h2></div>${brandLockup()}</div>
      <div class='card' style='padding:14px;margin-top:.19in'>${productTable()}</div>
      <div class='ring-grid'>
        <div class='ring-card card' style='--accent:var(--blue);--sweep:100%'><div class='ring'><b>INR</b></div><span>Integer-paise commercial snapshots</span></div>
        <div class='ring-card card' style='--accent:var(--violet);--sweep:65%'><div class='ring'><b>18%</b></div><span>Default GST stored as basis points</span></div>
        <div class='ring-card card' style='--accent:var(--mint);--sweep:45%'><div class='ring'><b>5%</b></div><span>Default incentive on gross margin</span></div>
        <div class='ring-card card' style='--accent:var(--amber);--sweep:82%'><div class='ring'><b>All</b></div><span>Company-wide operating visibility</span></div>
      </div>
      ${deckFooter(8)}
    </section>
    <section class='slide grid-surface' id='deck-reporting'>
      <div class='slide-kicker'><div><p class='eyebrow'>Management visibility</p><h2>Read the business from demand through delivery and cash.</h2></div>${brandLockup()}</div>
      <div class='deck-grid'>
        ${screenFrame('reports', 'Reports workspace', 'Read-only company-wide operating view', 'deck-screen tall')}
        ${proofStack([
          ['Demand', 'Open opportunities, pipeline value, top clients, and product interest.', '#22c7ee'],
          ['Revenue', 'Booked value excluding GST, recent orders, billings, and collections.', '#8b72ff'],
          ['Execution', 'Production pending, upcoming follow-ups, and delivery context.', '#ff7a6f'],
          ['Economics', 'Order-level invoice, payment, cost, gross-margin, and incentive records.', '#36d399']
        ])}
      </div>
      ${deckFooter(9)}
    </section>
    <section class='slide dark' id='deck-close'>
      <img class='closing-art' src='${graphic('ecrm-lead-to-cash-hero-v2')}' alt='Connected lead-to-cash workflow'>
      <div class='closing-shade'></div>
      <div style='position:relative;z-index:2;width:7.1in'>
        ${brandLockup(true)}
        <p class='eyebrow' style='color:#a8dfff;margin-top:.62in'>Focused operating discipline</p>
        <h1 style='margin-top:12px'>Give a growing sales and delivery team one place to run the work.</h1>
        <p class='slide-lead'>A practical fit for small B2B sales teams, service-delivery businesses, and founder-led operations that need connected execution without enterprise CRM weight.</p>
        <div style='margin-top:.38in'>${outcomeCards()}</div>
      </div>
      ${deckFooter(10)}
    </section>
  </body></html>`;
}

function brochureHtml() {
  return `<!doctype html><html><head><meta charset='utf-8'><title>eCRM Two-Page Brochure</title><style>${brochureCss}</style></head><body>
    <section class='page grid-surface' id='brochure-page-1'>
      <div class='brochure-hero'>
        <div>
          ${brandLockup()}
          <p class='eyebrow' style='margin-top:9mm'>Connected lead-to-cash operations</p>
          <h1 style='margin-top:3mm'>Run sales, delivery, and cash flow in one focused workspace.</h1>
          <p class='brochure-lead'>eCRM connects daily selling, opportunities, proposals, orders, production progress, finance visibility, and management reporting without enterprise CRM weight.</p>
          <div class='tag-row' style='margin-top:6mm'><span class='tag'>Admin + Sales</span><span class='tag'>INR + GST ready</span><span class='tag'>Service delivery</span></div>
        </div>
        <div class='brochure-art'><img src='${graphic('ecrm-lead-to-cash-hero-v2')}' alt='Connected lead-to-cash workflow'></div>
      </div>
      <div class='brochure-section'>
        <h2>One lifecycle, seven control points</h2>
        <div class='card' style='padding:9px'>${lifecycleRail({ compact: true })}</div>
      </div>
      <div class='brochure-section'>
        <h2>What changes operationally</h2>
        ${outcomeCards()}
      </div>
      <div class='brochure-section'>
        <h2>Product proof</h2>
        <div class='screen-montage'>
          ${screenFrame('dashboard', 'Dashboard', 'Pipeline to cash')}
          ${screenFrame('my-day', 'My Day', 'Daily execution')}
          ${screenFrame('production', 'Production', 'Delivery status')}
        </div>
      </div>
      <p class='fineprint' style='position:absolute;left:14mm;right:14mm;bottom:8mm'>Product claims and screens are generated from the current local eCRM checkout. Sample records shown are local seed/demo data.</p>
    </section>
    <section class='page' id='brochure-page-2'>
      <div style='display:flex;justify-content:space-between;align-items:center'>${brandLockup()}<span class='eyebrow'>Capability proof</span></div>
      <div class='brochure-section brochure-transform'><img src='${graphic('ecrm-connected-work-v2')}' alt='Scattered work becoming a connected operating system'></div>
      <div class='brochure-section'>
        <h2>Eight connected capabilities</h2>
        ${moduleCards()}
      </div>
      <div class='brochure-section' style='display:grid;grid-template-columns:.9fr 1.1fr;gap:7mm'>
        <div><h2>Role fit</h2>${roleMap()}</div>
        <div><h2>Included catalog defaults</h2>${productTable()}</div>
      </div>
      <div class='brochure-section'>
        <h2>Good fit for</h2>
        <div class='fit-grid'>
          <div class='fit card'><b>Small B2B sales teams</b><p>Shared account visibility, clear ownership, follow-up discipline, and a focused operating model.</p></div>
          <div class='fit card'><b>Service-delivery businesses</b><p>Commercial lines map to delivery templates so post-sale handoff becomes repeatable.</p></div>
          <div class='fit card'><b>Founder-led operations</b><p>Sales, delivery, finance visibility, configuration, and reporting stay in one place.</p></div>
        </div>
      </div>
      <div class='callout fineprint' style='--accent:var(--amber);position:absolute;left:14mm;right:14mm;bottom:8mm'><b>Current MVP boundaries:</b> proposal documents remain external; invoice PDF generation, native mobile apps, multi-tenant signup, email sync, and external accounting integrations are outside the current scope.</div>
    </section>
  </body></html>`;
}

function guideHtml() {
  const chapters = [
    ['01', 'Getting started', 'Roles, sign-in, and navigation'],
    ['02', 'Dashboard and reports', 'Read the company operating picture'],
    ['03', 'My Day', 'Plan, capture, interpret, and close'],
    ['04', 'Leads and customers', 'Build durable account context'],
    ['05', 'Opportunities and proposals', 'Manage pursuit and commercial terms'],
    ['06', 'Orders and production', 'Hand off accepted work to delivery'],
    ['07', 'Catalog, templates, and finance', 'Admin configuration and economics'],
    ['08', 'Roles and boundaries', 'Know what the MVP does today']
  ];
  return `<!doctype html><html><head><meta charset='utf-8'><title>eCRM User Guide</title><style>${guideCss}</style></head><body>
    <section class='guide-page guide-cover' id='guide-cover'>
      <img class='guide-cover-art' src='${graphic('ecrm-lead-to-cash-hero-v2')}' alt='Connected lead-to-cash workflow'>
      <div class='guide-cover-shade'></div>
      <div class='guide-cover-copy'>
        <div>
          ${brandLockup(true)}
          <p class='eyebrow' style='color:#a8dfff;margin-top:18mm'>Visual user guide · Admin and Sales</p>
          <h1>Operate the complete lead-to-cash workspace with confidence.</h1>
          <p class='lead'>A practical, screen-led guide to daily planning, customer context, opportunities, proposals, orders, production, finance visibility, reports, and configuration.</p>
        </div>
        <div><div class='card' style='padding:13px;background:rgb(255 255 255 / .09);border-color:rgb(255 255 255 / .2)'>${lifecycleRail({ compact: true })}</div><p class='small' style='margin-top:8mm;color:#bcd0eb'>Edition 2 · Generated from the current local application and runtime screenshots</p></div>
      </div>
    </section>
    <section class='guide-page' id='guide-contents'>
      ${guideHead('→', 'How to use this guide', 'Orientation')}
      <p style='margin-top:9px'>Follow the lifecycle for end-to-end work, or jump directly to the chapter that matches your task. Each screen is current local product evidence; sample records are seed/demo data.</p>
      <div class='contents-grid'>${chapters.map(([num, title, note]) => `<div class='contents-card card'><span class='chapter-num'>${num}</span><div><b>${title}</b><span>${note}</span></div></div>`).join('')}</div>
      <h2 style='margin-top:13mm'>Role map</h2>
      ${roleMap()}
      <div class='callout' style='--accent:var(--violet);margin-top:9px'><b>No separate Manager role:</b> managers who need configuration and financial controls use Admin; managers who only need commercial execution can use Sales.</div>
      ${guideFooter(2, 'Orientation')}
    </section>
    <section class='guide-page' id='guide-started'>
      ${guideHead('01', 'Getting started', 'Sign in · roles · navigation')}
      <p style='margin-top:8px'>eCRM is a single-company CRM. Admin and Sales users see company-wide operating data. Ownership is used for responsibility, filtering, targets, and incentives—not to hide records from other Sales users.</p>
      <div class='callout' style='--accent:var(--amber);margin-top:8px'><b>Local development/demo access only:</b> Use the Admin or Sales account assigned for the current environment. Credentials are environment-specific and are not published in this guide.</div>
      ${screenFrame('login', 'Sign-in screen', 'Use an assigned local demo account', 'guide-shot short')}
      <h2>Main navigation</h2>
      <div class='guide-grid'>
        <div class='howto card' style='--accent:var(--cyan)'><span class='mini-label'>Sales workspace</span><h3>Commercial routes</h3><div class='route-band'><span class='route'>Dashboard</span><span class='route'>My Day</span><span class='route'>Leads</span><span class='route'>Opportunities</span><span class='route'>Orders</span><span class='route'>Production</span><span class='route'>Reports</span></div></div>
        <div class='howto card' style='--accent:var(--violet)'><span class='mini-label'>Admin workspace</span><h3>Configuration routes</h3><div class='route-band'><span class='route'>Products</span><span class='route'>Production config</span><span class='route'>All Sales routes</span></div></div>
      </div>
      ${guideFooter(3, 'Getting started')}
    </section>
    <section class='guide-page' id='guide-dashboard'>
      ${guideHead('02', 'Dashboard and reports', 'Read the operating picture')}
      <div class='guide-grid' style='margin-top:8px'>
        <div class='howto card' style='--accent:var(--blue)'><span class='mini-label'>Dashboard</span><h3>Start with the live pulse</h3><p>Review open opportunities, pipeline value, booked value, pending receivables, collected payments, production pending, and upcoming follow-ups.</p></div>
        <div class='howto card' style='--accent:var(--mint)'><span class='mini-label'>Reports</span><h3>Scan the operating detail</h3><p>Compare top clients and products, recent orders, open pipeline, collections, production pending, and scheduled follow-ups.</p></div>
      </div>
      ${screenFrame('dashboard', 'Dashboard', 'Company-wide live metrics', 'guide-shot short')}
      <h2>Use the Reports workspace</h2>
      <ol><li>Open <b>Reports</b> from the top navigation.</li><li>Review the shared KPI band at the top.</li><li>Scan demand, revenue, cash, delivery, and follow-up sections for exceptions.</li><li>Open the underlying customer, order, or opportunity when action is needed.</li></ol>
      ${screenFrame('reports', 'Reports', 'Read-only operating detail', 'guide-shot short')}
      ${guideFooter(4, 'Dashboard and reports')}
    </section>
    <section class='guide-page' id='guide-my-day'>
      ${guideHead('03', 'Plan sales work in My Day', 'Personal execution')}
      <div style='margin-top:8px' class='card'>${lifecycleRail({ compact: true })}</div>
      ${screenFrame('my-day', 'My Day workspace', 'Today, upcoming, overdue, and completed work', 'guide-shot short')}
      <div class='guide-grid'>
        <div class='howto card' style='--accent:var(--blue)'><span class='mini-label'>Create a task</span><ol><li>Open <b>My Day</b> and select Today.</li><li>Enter the task, type, priority, due date, and optional linked record.</li><li>Save and verify it appears in the intended time band.</li></ol></div>
        <div class='howto card' style='--accent:var(--violet)'><span class='mini-label'>Capture a voice note</span><ol><li>Select <b>Record voice note</b>.</li><li>Attach it to a task when useful.</li><li>Review playback, transcript, and suggested follow-up actions when available.</li></ol></div>
      </div>
      <h2>Close the day intentionally</h2>
      <p>Use insights to review accounts needing attention, voice-note summaries, tomorrow planning, and unfinished work. Complete, carry forward, or re-plan rather than letting work disappear.</p>
      ${screenFrame('my-day-insights', 'My Day insights', 'Suggested attention and end-of-day review', 'guide-shot short')}
      ${guideFooter(5, 'My Day')}
    </section>
    <section class='guide-page' id='guide-leads'>
      ${guideHead('04', 'Manage leads and customer context', 'CRM foundation')}
      <p style='margin-top:8px'>Leads and customers are company-level account records with branches, contacts, activities, notes, owner history, and reassignment.</p>
      ${screenFrame('leads', 'Lead and customer list', 'Searchable account context', 'guide-shot short')}
      <div class='guide-grid'>
        <div class='howto card' style='--accent:var(--cyan)'><span class='mini-label'>Add one lead</span><ol><li>Open <b>Leads</b>.</li><li>Choose <b>Add one lead</b>.</li><li>Enter account details, state, owner, source, industry, and notes.</li><li>Save the record.</li></ol></div>
        <div class='howto card' style='--accent:var(--amber)'><span class='mini-label'>Import a CSV</span><ol><li>Choose <b>Import leads from CSV</b>.</li><li>Follow the fixed template.</li><li>Upload and review row-level errors.</li><li>Import valid rows.</li></ol></div>
      </div>
      ${screenFrame('lead-detail', 'Customer 360', 'Branches, contacts, activity, ownership, and pursuits', 'guide-shot short')}
      ${guideFooter(6, 'Leads and customers')}
    </section>
    <section class='guide-page' id='guide-opportunities'>
      ${guideHead('05', 'Opportunities and proposals', 'Pursuit · commercial control')}
      <p style='margin-top:8px'>Opportunities track separate pursuits under a lead/customer. Proposals belong to opportunities and hold the structured commercial record.</p>
      ${screenFrame('opportunities', 'Opportunity pipeline', 'Stage, value, product interest, owner, and follow-up', 'guide-shot short')}
      <div class='guide-grid'>
        <div class='howto card' style='--accent:var(--violet)'><span class='mini-label'>Create the proposal</span><ol><li>Open an opportunity.</li><li>Create a proposal from its proposal area.</li><li>Add commercial summary, assumptions, inclusions, exclusions, payment terms, and timeline.</li></ol></div>
        <div class='howto card' style='--accent:var(--amber)'><span class='mini-label'>Control the record</span><ol><li>Add catalog-backed line items.</li><li>Attach external PDF or optional Canva links.</li><li>Move through sent, accepted, rejected, expired, or withdrawn states.</li></ol></div>
      </div>
      ${screenFrame('proposal-detail', 'Proposal detail', 'Terms, GST snapshots, status, and document links', 'guide-shot short')}
      ${guideFooter(7, 'Opportunities and proposals')}
    </section>
    <section class='guide-page' id='guide-orders'>
      ${guideHead('06', 'Orders and production', 'Book · hand off · deliver')}
      <p style='margin-top:8px'>Orders are created from accepted proposals and preserve customer, owner, line items, GST totals, PO metadata, and source-proposal context.</p>
      ${screenFrame('orders', 'Booked orders', 'Accepted work ready for delivery control', 'guide-shot short')}
      <div class='guide-grid'>
        <div class='howto card' style='--accent:var(--amber)'><span class='mini-label'>Book the order</span><ol><li>Open the accepted proposal.</li><li>Choose <b>Book order</b> or open the existing order link.</li><li>Enter PO metadata and due dates.</li><li>Verify the commercial snapshot.</li></ol></div>
        <div class='howto card' style='--accent:var(--coral)'><span class='mini-label'>Run production</span><ol><li>Open <b>Production</b>.</li><li>Open stage controls or a work-item detail.</li><li>Update status, owner, due date, notes, completion, or skipped reason.</li><li>Scan progress by customer and order.</li></ol></div>
      </div>
      <div class='guide-grid'>${screenFrame('order-detail', 'Order detail', 'Commercial and finance snapshot', 'guide-shot short')}${screenFrame('production-detail', 'Production detail', 'Stage-level delivery progress', 'guide-shot short')}</div>
      ${guideFooter(8, 'Orders and production')}
    </section>
    <section class='guide-page' id='guide-configuration'>
      ${guideHead('07', 'Catalog, production templates, and finance', 'Admin configuration')}
      <div class='guide-grid' style='margin-top:8px'>
        <div>${screenFrame('products', 'Product/service catalog', 'Active catalog rows and defaults', 'guide-shot short')}<div class='callout' style='--accent:var(--cyan);margin-top:7px'><b>Sales:</b> use active catalog rows when building proposal lines so GST and commercial snapshots stay consistent.</div></div>
        <div>${screenFrame('production-config', 'Production configuration', 'Templates, stages, durations, and mappings', 'guide-shot short')}<div class='callout' style='--accent:var(--violet);margin-top:7px'><b>Admin:</b> manage template stages, duration, required flags, active state, and product/service mappings.</div></div>
      </div>
      <h2>Finance visibility on orders</h2>
      <p>The order model supports invoice records, payments and allocations, cost components, gross margin, incentives, split recipients, approval status, overrides, rejection, voiding, and payout metadata.</p>
      <div class='card' style='padding:10px;margin-top:8px'>${productTable()}</div>
      <div class='callout' style='--accent:var(--amber);margin-top:8px'><b>Boundary:</b> invoice PDF generation and external accounting synchronization are not part of the current MVP.</div>
      ${guideFooter(9, 'Catalog and finance')}
    </section>
    <section class='guide-page' id='guide-boundaries'>
      ${guideHead('08', 'Roles, rules, and current boundaries', 'Know the product today')}
      <p style='margin-top:8px'>Use this page as the operating contract for the current MVP.</p>
      <h2>Role permissions</h2>
      ${roleMap()}
      <h2>Current product boundaries</h2>
      <div class='path-list'>
        <div class='path-item'><span class='dot' style='--accent:var(--blue)'>01</span><div><b>Single-company workspace</b><p>This build is not a browser-selectable multi-tenant CRM.</p></div></div>
        <div class='path-item'><span class='dot' style='--accent:var(--violet)'>02</span><div><b>External proposal documents</b><p>eCRM links document metadata and optional Canva designs; it does not replace a document editor.</p></div></div>
        <div class='path-item'><span class='dot' style='--accent:var(--amber)'>03</span><div><b>Finance workflow, not accounting sync</b><p>Invoice, payment, cost, margin, and incentive records are supported; invoice PDF and accounting integrations are outside scope.</p></div></div>
        <div class='path-item'><span class='dot' style='--accent:var(--coral)'>04</span><div><b>Web application</b><p>Native mobile apps, Microsoft/Google login, and email sync are outside the current MVP.</p></div></div>
        <div class='path-item'><span class='dot' style='--accent:var(--mint)'>05</span><div><b>Two application roles</b><p>Finance and Operations are workflow modules—not separate user roles.</p></div></div>
      </div>
      <h2>The operating promise</h2>
      <div class='quote-block card'><p>Every handoff stays visible: who owns it, what was agreed, what is due, what has been delivered, and what has been collected.</p></div>
      <div style='margin-top:12px'>${outcomeCards()}</div>
      ${guideFooter(10, 'Roles and boundaries')}
    </section>
  </body></html>`;
}

const outputs = [
  ['ecrm-pitch-deck', deckHtml(), { width: '13.333in', height: '7.5in', printBackground: true }],
  ['ecrm-two-page-brochure', brochureHtml(), { format: 'A4', printBackground: true }],
  ['ecrm-user-guide', guideHtml(), { format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } }]
];

function normalizeHtml(html) {
  return `${html.split('\n').map((line) => line.trimEnd()).join('\n').trimEnd()}\n`;
}

for (const [name, html] of outputs) {
  fs.writeFileSync(path.join(outDir, `${name}.html`), normalizeHtml(html), 'utf8');
}

fs.mkdirSync(previewDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const [name, , pdfOptions] of outputs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(outDir, `${name}.html`)).href, { waitUntil: 'networkidle' });
  await page.pdf({ path: path.join(outDir, `${name}.pdf`), ...pdfOptions });
  await page.close();
}

const previews = [
  ['ecrm-user-guide', '#guide-cover', 'guide-cover.png'],
  ['ecrm-user-guide', '#guide-dashboard', 'guide-dashboard.png'],
  ['ecrm-user-guide', '#guide-orders', 'guide-orders-production.png'],
  ['ecrm-pitch-deck', '#deck-cover', 'deck-cover.png'],
  ['ecrm-pitch-deck', '#deck-lifecycle', 'deck-lifecycle.png'],
  ['ecrm-pitch-deck', '#deck-commercial', 'deck-proposal.png'],
  ['ecrm-two-page-brochure', '#brochure-page-1', 'brochure-page-1.png'],
  ['ecrm-two-page-brochure', '#brochure-page-2', 'brochure-page-2.png']
];

for (const [name, selector, filename] of previews) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(outDir, `${name}.html`)).href, { waitUntil: 'networkidle' });
  await page.locator(selector).screenshot({ path: path.join(previewDir, filename), animations: 'disabled' });
  await page.close();
}

await browser.close();

console.log('Generated:');
for (const [name] of outputs) {
  console.log(`- ${path.join(outDir, `${name}.html`)}`);
  console.log(`- ${path.join(outDir, `${name}.pdf`)}`);
}
console.log(`- ${previews.length} preview images in ${previewDir}`);
