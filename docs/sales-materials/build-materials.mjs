import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = __dirname;

const screenshot = (name) => `assets/screenshots/${name}.png`;

const featureModules = [
  ["CRM core", "Leads/customers, branches, contacts, activities, ownership, reassignment, and CSV import."],
  ["My Day", "Daily sales planning, completed-work visibility, voice notes, transcripts, suggested actions, insights, and end-of-day review."],
  ["Pipeline", "Configurable opportunity stages, owner splits, target tracking, and follow-up driven pipeline views."],
  ["Proposals", "Product-backed commercial summaries, GST line totals, proposal statuses, and external document or Canva links."],
  ["Orders", "Accepted proposal to booked order conversion with PO metadata and preserved commercial snapshots."],
  ["Production", "Order-line work items, editable production templates, stage status updates, notes, owners, and due dates."],
  ["Finance", "Invoice, payment, cost, gross margin, incentive, split, and approval data model with order-level summaries."],
  ["Reports", "Read-only dashboard and reports for billings, pipeline, collections, production, clients, and products."]
];

const productRows = [
  ["eLearning", "18%", "eLearning production", "Script, storyboard, development, voiceover, review, final delivery"],
  ["Video shoot", "18%", "Video shoot production", "Script, pre-production, shoot, edit, review, final delivery"],
  ["VR/AR", "18%", "VR/AR production", "Discovery, experience design, development, testing, review, final delivery"],
  ["Animation", "18%", "Animation production", "Script, storyboard, modeling and animation, voiceover, review, final delivery"],
  ["Other service", "18%", "No default template", "Flexible service category for unmapped work"]
];

const css = `
  :root {
    --blue-950: #08275d;
    --blue-850: #123f7b;
    --blue-700: #1d66d8;
    --blue-100: #eaf3ff;
    --gray-950: #111827;
    --gray-700: #374151;
    --gray-500: #6b7280;
    --gray-300: #d1d5db;
    --gray-100: #f3f6fa;
    --white: #ffffff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Roboto", "Segoe UI", Arial, sans-serif;
    color: var(--gray-950);
    background: var(--gray-100);
  }
  h1, h2, h3, p { margin: 0; }
  p { line-height: 1.5; }
  .eyebrow {
    color: var(--blue-700);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }
  .muted { color: var(--gray-500); }
  .small { font-size: 11px; }
  .tag {
    display: inline-flex;
    align-items: center;
    border: 1px solid #b6c7df;
    border-radius: 999px;
    padding: 5px 10px;
    color: var(--blue-950);
    background: #f8fbff;
    font-size: 12px;
    font-weight: 700;
  }
  .card {
    border: 1px solid #cdd8e8;
    border-radius: 8px;
    background: var(--white);
    box-shadow: 0 12px 28px rgb(8 39 93 / 0.08);
  }
  .screen {
    width: 100%;
    border: 1px solid #bfccdc;
    border-radius: 8px;
    box-shadow: 0 16px 34px rgb(8 39 93 / 0.16);
    object-fit: cover;
    background: white;
  }
  .bars { display: grid; gap: 11px; }
  .bar { display: grid; grid-template-columns: 150px 1fr 48px; gap: 10px; align-items: center; font-size: 12px; }
  .track { height: 12px; border-radius: 999px; background: #dbe5f2; overflow: hidden; }
  .fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--blue-950), var(--blue-700)); }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { color: var(--blue-950); text-align: left; background: #eaf1f9; }
  th, td { border-bottom: 1px solid #d8e1ee; padding: 9px 10px; vertical-align: top; }
  .flow {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 9px;
  }
  .step {
    min-height: 72px;
    border-radius: 8px;
    padding: 12px;
    background: white;
    border: 1px solid #cdd8e8;
  }
  .step b { display: block; color: var(--blue-950); margin-bottom: 6px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .kpi { padding: 16px; }
  .kpi strong { display: block; margin-top: 8px; color: var(--blue-950); font-size: 26px; }
`;

const deckCss = `
  @page { size: 13.333in 7.5in; margin: 0; }
  ${css}
  body { background: #ffffff; }
  .slide {
    width: 13.333in;
    height: 7.5in;
    padding: 0.46in 0.56in;
    page-break-after: always;
    position: relative;
    overflow: hidden;
    background: linear-gradient(180deg, #f7fbff 0%, #ffffff 50%, #eef3f8 100%);
  }
  .slide.dark {
    color: white;
    background: linear-gradient(135deg, #061f52 0%, #123f7b 58%, #5f718a 100%);
  }
  .slide h1 { font-size: 44px; line-height: 1.05; max-width: 8.4in; }
  .slide h2 { font-size: 30px; color: var(--blue-950); }
  .slide.dark h1, .slide.dark h2 { color: white; }
  .lead { max-width: 7.3in; margin-top: 18px; font-size: 18px; color: #dbeafe; }
  .deck-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 0.34in; align-items: center; margin-top: 0.3in; }
  .feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 0.35in; }
  .feature { padding: 15px; min-height: 122px; }
  .feature h3 { color: var(--blue-950); font-size: 17px; margin-bottom: 8px; }
  .feature p { font-size: 12px; color: var(--gray-700); }
  .big-number { font-size: 58px; font-weight: 800; color: white; }
  .number-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 0.38in; }
  .number-card { padding: 18px; border: 1px solid rgb(255 255 255 / 0.28); border-radius: 8px; background: rgb(255 255 255 / 0.11); }
  .caption { margin-top: 8px; color: #e6edf7; font-size: 13px; }
  .footer { position: absolute; left: 0.56in; right: 0.56in; bottom: 0.24in; display: flex; justify-content: space-between; color: #728096; font-size: 11px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 0.34in; }
  .quote { padding: 22px; color: var(--blue-950); font-size: 22px; line-height: 1.3; }
`;

const brochureCss = `
  @page { size: A4; margin: 0; }
  ${css}
  body { background: white; }
  .page {
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    padding: 12mm 15mm;
    page-break-after: always;
    background: linear-gradient(180deg, #f7fbff 0%, #ffffff 60%);
  }
  .page:last-child { page-break-after: auto; }
  .hero { display: grid; grid-template-columns: 1fr 78mm; gap: 11mm; align-items: center; }
  h1 { margin-top: 4mm; color: var(--blue-950); font-size: 30px; line-height: 1.08; }
  h2 { color: var(--blue-950); font-size: 19px; margin-bottom: 6px; }
  h3 { color: var(--blue-950); font-size: 13px; margin-bottom: 4px; }
  .lead2 { margin-top: 4mm; color: var(--gray-700); font-size: 12.5px; }
  .module-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 7mm; }
  .module { padding: 9px; min-height: 62px; }
  .module p { font-size: 10px; color: var(--gray-700); line-height: 1.35; }
  .section { margin-top: 7mm; }
  .benefits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 6px; }
  .benefit { padding: 9px; min-height: 66px; }
  .benefit b { color: var(--blue-950); }
  .benefit p { margin-top: 4px; font-size: 10px; line-height: 1.35; }
  .fineprint { margin-top: 5mm; color: var(--gray-500); font-size: 9px; }
  .page table { font-size: 10px; }
  .page th, .page td { padding: 6px 7px; }
`;

const guideCss = `
  @page { size: A4; margin: 12mm; }
  ${css}
  body { background: white; font-size: 12px; }
  .cover {
    min-height: 270mm;
    padding: 18mm 10mm;
    background: linear-gradient(145deg, #08275d 0%, #123f7b 56%, #68778a 100%);
    color: white;
    page-break-after: always;
  }
  .cover h1 { margin-top: 18mm; color: white; font-size: 42px; line-height: 1.08; max-width: 150mm; }
  .cover p { margin-top: 7mm; font-size: 16px; max-width: 150mm; color: #e8f2ff; }
  .guide-page { page-break-after: always; }
  h1 { color: var(--blue-950); font-size: 28px; margin-bottom: 10px; }
  h2 { color: var(--blue-950); font-size: 21px; margin: 18px 0 8px; }
  h3 { color: var(--blue-950); font-size: 15px; margin: 14px 0 6px; }
  ol, ul { margin-top: 6px; padding-left: 20px; }
  li { margin: 5px 0; line-height: 1.45; }
  .guide-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .howto { padding: 12px; }
  .howto h3 { margin-top: 0; }
  .shot { margin: 9px 0 13px; max-height: 330px; object-fit: contain; }
  .wide-shot { max-height: 520px; object-fit: contain; }
  .note { border-left: 4px solid var(--blue-700); background: #eef5ff; padding: 10px 12px; color: var(--gray-700); }
`;

function moduleCards() {
  return featureModules.map(([title, text]) => `<div class="feature card"><h3>${title}</h3><p>${text}</p></div>`).join("");
}

function productTable() {
  return `<table><thead><tr><th>Product/service</th><th>GST</th><th>Template</th><th>Default workflow</th></tr></thead><tbody>${productRows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function barChart(rows) {
  return `<div class="bars">${rows
    .map(([label, value, pct]) => `<div class="bar"><span>${label}</span><div class="track"><div class="fill" style="width:${pct}%"></div></div><b>${value}</b></div>`)
    .join("")}</div>`;
}

function footer(label) {
  return `<div class="footer"><span>eCRM sales materials</span><span>${label}</span></div>`;
}

function deckHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>eCRM Pitch Deck</title><style>${deckCss}</style></head><body>
    <section class="slide dark">
      <p class="eyebrow" style="color:#c9dcff">ARA Global eCRM</p>
      <h1>Lead-to-cash control for sales, delivery, finance, and management.</h1>
      <p class="lead">A single-company CRM workspace that moves work from lead intake through proposals, orders, production, finance tracking, and executive reporting.</p>
      <div class="number-row">
        <div class="number-card"><div class="big-number">8</div><p class="caption">Operational modules in one application</p></div>
        <div class="number-card"><div class="big-number">2</div><p class="caption">Simple MVP roles: Admin and Sales</p></div>
        <div class="number-card"><div class="big-number">5</div><p class="caption">Seeded product/service categories</p></div>
        <div class="number-card"><div class="big-number">4</div><p class="caption">Production workflow templates</p></div>
      </div>
      ${footer("1")}
    </section>
    <section class="slide">
      <h2>The operating problem</h2>
      <div class="two-col">
        <div class="card quote">Small teams lose margin and follow-up discipline when CRM, proposal documents, order handoff, production status, and payment tracking live in separate places.</div>
        <div class="card" style="padding:22px">
          <h3 style="color:var(--blue-950);font-size:20px;margin-bottom:12px">What breaks down</h3>
          ${barChart([["Lead and contact context", "Fragmented", 92], ["Proposal and quote history", "Manual", 82], ["Order-to-production handoff", "Unclear", 78], ["Collections and incentives", "Delayed", 70]])}
        </div>
      </div>
      ${footer("2")}
    </section>
    <section class="slide">
      <h2>One lifecycle, one source of operational truth</h2>
      <div class="flow" style="margin-top:0.55in">
        ${["Lead", "Opportunity", "Proposal", "Order", "Production", "Finance"].map((s, i) => `<div class="step"><b>${i + 1}. ${s}</b><span class="small muted">${["Customer, branch, contact, activity, owner", "Stage, value, product interest, follow-up", "Commercial summary, GST lines, document link", "Accepted proposal snapshots and PO context", "Line-item stages, owners, due dates, notes", "Invoices, payments, costs, incentives, reports"][i]}</span></div>`).join("")}
      </div>
      <img class="screen" style="height:3.55in;margin-top:0.36in;object-fit:cover;object-position:top" src="${screenshot("dashboard")}" />
      ${footer("3")}
    </section>
    <section class="slide">
      <h2>Feature coverage</h2>
      <div class="feature-grid">${moduleCards()}</div>
      ${footer("4")}
    </section>
    <section class="slide">
      <h2>Sales team workspace</h2>
      <div class="deck-grid">
        <div>
          <p class="eyebrow">Daily execution</p>
          <h1 style="font-size:34px;color:var(--blue-950)">Plan the day, capture call notes, and turn follow-ups into visible work.</h1>
          <p style="margin-top:14px;color:var(--gray-700);font-size:15px">My Day combines planned tasks, completed tasks that remain visible, overdue work, voice notes, transcript review, suggested actions, insights, and end-of-day planning.</p>
        </div>
        <img class="screen" style="height:4.95in;object-fit:cover;object-position:top" src="${screenshot("my-day")}" />
      </div>
      ${footer("5")}
    </section>
    <section class="slide">
      <h2>Proposal and order discipline</h2>
      <div class="deck-grid">
        <img class="screen" style="height:5.05in;object-fit:cover;object-position:top" src="${screenshot("proposal-detail")}" />
        <div>
          <p class="eyebrow">Commercial control</p>
          <h1 style="font-size:32px;color:var(--blue-950)">Keep the commercial record structured while leaving document design in Canva or external files.</h1>
          <p style="margin-top:14px;color:var(--gray-700);font-size:15px">The CRM tracks proposal status, line-item GST totals, accepted-proposal order booking, and links to proposal documents without pretending to be a document editor.</p>
        </div>
      </div>
      ${footer("6")}
    </section>
    <section class="slide">
      <h2>Production visibility after booking</h2>
      <div class="deck-grid">
        <div>
          <p class="eyebrow">Delivery control</p>
          <h1 style="font-size:32px;color:var(--blue-950)">Every booked line item can become a production work item with stage-level progress.</h1>
          <p style="margin-top:14px;color:var(--gray-700);font-size:15px">Templates are mapped by product/service and can be managed by Admin. Stage instances carry status, assignment, due dates, completion metadata, and notes.</p>
        </div>
        <img class="screen" style="height:5.05in;object-fit:cover;object-position:top" src="${screenshot("production")}" />
      </div>
      ${footer("7")}
    </section>
    <section class="slide">
      <h2>Default product and production model</h2>
      <div class="card" style="padding:18px;margin-top:0.35in">${productTable()}</div>
      <div style="margin-top:0.32in" class="kpi-grid">
        <div class="card kpi"><span class="eyebrow">Currency</span><strong>INR</strong><p class="small muted">Commercial fields use integer paise snapshots.</p></div>
        <div class="card kpi"><span class="eyebrow">Default GST</span><strong>18%</strong><p class="small muted">Stored as 1800 basis points.</p></div>
        <div class="card kpi"><span class="eyebrow">Incentive basis</span><strong>5%</strong><p class="small muted">Calculated on gross margin after approved costs.</p></div>
        <div class="card kpi"><span class="eyebrow">Visibility</span><strong>Company</strong><p class="small muted">Owner supports responsibility, not row-level hiding.</p></div>
      </div>
      ${footer("8")}
    </section>
    <section class="slide">
      <h2>Reporting and management view</h2>
      <div class="deck-grid">
        <img class="screen" style="height:5.05in;object-fit:cover;object-position:top" src="${screenshot("reports")}" />
        <div class="card" style="padding:20px">
          <h3 style="color:var(--blue-950);font-size:21px;margin-bottom:12px">Built-in reporting surfaces</h3>
          <ul style="margin:0;padding-left:20px;line-height:1.65;color:var(--gray-700)">
            <li>Open opportunities and pipeline value</li>
            <li>Booked value excluding GST</li>
            <li>Pending receivables and collected payments</li>
            <li>Top clients and top products/services</li>
            <li>Production pending and upcoming follow-ups</li>
          </ul>
        </div>
      </div>
      ${footer("9")}
    </section>
    <section class="slide dark">
      <p class="eyebrow" style="color:#c9dcff">Why it sells</p>
      <h1>eCRM gives a small sales organization operating discipline without enterprise CRM weight.</h1>
      <div class="number-row">
        <div class="number-card"><p class="caption"><b>Faster handoff</b><br>Accepted proposals become orders with preserved commercial snapshots.</p></div>
        <div class="number-card"><p class="caption"><b>Better follow-up</b><br>Sales work, notes, overdue items, and future planning stay visible.</p></div>
        <div class="number-card"><p class="caption"><b>Delivery clarity</b><br>Production stages show what is done, blocked, assigned, or due.</p></div>
        <div class="number-card"><p class="caption"><b>Management view</b><br>Dashboards and reports expose pipeline, billings, receivables, and production.</p></div>
      </div>
      ${footer("10")}
    </section>
  </body></html>`;
}

function brochureHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>eCRM Two-Page Brochure</title><style>${brochureCss}</style></head><body>
    <section class="page">
      <div class="hero">
        <div>
          <p class="eyebrow">ARA Global eCRM</p>
          <h1>Lead-to-cash CRM for a focused sales and delivery team.</h1>
          <p class="lead2">eCRM connects sales intake, opportunity tracking, commercial proposals, order booking, production status, finance visibility, and management reporting in one professional workspace.</p>
          <div style="display:flex;gap:6px;margin-top:8mm;flex-wrap:wrap">
            <span class="tag">Single-company CRM</span><span class="tag">Admin and Sales roles</span><span class="tag">INR and GST-ready</span><span class="tag">Laptop-first, web responsive</span>
          </div>
        </div>
        <img class="screen" style="height:80mm;object-fit:cover;object-position:top" src="${screenshot("dashboard")}" />
      </div>
      <div class="section">
        <h2>What the application covers</h2>
        <div class="module-grid">
          ${featureModules.map(([title, text]) => `<div class="module card"><h3>${title}</h3><p>${text}</p></div>`).join("")}
        </div>
      </div>
      <div class="section">
        <h2>Business benefits</h2>
        <div class="benefits">
          <div class="benefit card"><b>Cleaner sales execution</b><p>Separate manual lead entry, CSV import, opportunity management, proposal tracking, and daily planning keep work organized.</p></div>
          <div class="benefit card"><b>Less handoff ambiguity</b><p>Accepted proposals become booked orders with commercial snapshots before production work starts.</p></div>
          <div class="benefit card"><b>Better management visibility</b><p>Dashboards and reports summarize pipeline, billings, collections, top clients, products, and production progress.</p></div>
        </div>
      </div>
      <p class="fineprint">Generated from the local eCRM checkout, docs, Prisma schema, and runtime screenshots. Sample records shown are local seed/demo data.</p>
    </section>
    <section class="page">
      <h2>Workflow proof points</h2>
      <div class="flow" style="grid-template-columns:repeat(3,1fr);margin-top:5mm">
        <div class="step"><b>1. Capture demand</b><span class="small muted">Leads, branches, contacts, activities, owners, and CSV import.</span></div>
        <div class="step"><b>2. Manage pursuit</b><span class="small muted">Opportunity stage, value, product interest, owner splits, targets, and follow-ups.</span></div>
        <div class="step"><b>3. Propose</b><span class="small muted">Commercial summary, product/service lines, GST totals, status, and document links.</span></div>
        <div class="step"><b>4. Book order</b><span class="small muted">Accepted proposal to order with preserved totals and PO context.</span></div>
        <div class="step"><b>5. Deliver</b><span class="small muted">Production templates, work items, stages, notes, assignments, and due dates.</span></div>
        <div class="step"><b>6. Report</b><span class="small muted">Billings, collections, pipeline, top clients/products, production, and follow-ups.</span></div>
      </div>
      <div class="section" style="display:grid;grid-template-columns:1fr 1fr;gap:10mm">
        <div>
          <h2>Included catalog defaults</h2>
          ${productTable()}
        </div>
        <div>
          <h2>Screen evidence</h2>
          <img class="screen" style="height:58mm;object-fit:cover;object-position:top;margin-bottom:5mm" src="${screenshot("proposal-detail")}" />
          <img class="screen" style="height:58mm;object-fit:cover;object-position:top" src="${screenshot("production")}" />
        </div>
      </div>
      <div class="section">
        <h2>Good fit for</h2>
        <div class="benefits">
          <div class="benefit card"><b>Small B2B sales teams</b><p>Company-wide visibility and simple ownership without heavy territory permissions.</p></div>
          <div class="benefit card"><b>Service delivery businesses</b><p>Products/services map to delivery templates, making order handoff more predictable.</p></div>
          <div class="benefit card"><b>Founder-led operations</b><p>Admin users get catalog, production configuration, finance visibility, and reports in one place.</p></div>
        </div>
      </div>
      <p class="fineprint">Current MVP boundaries: proposals link to external documents; invoice PDF generation, native mobile apps, multi-tenant signup, and external accounting integrations are outside the current scope.</p>
    </section>
  </body></html>`;
}

function guideHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>eCRM User Guide</title><style>${guideCss}</style></head><body>
    <section class="cover">
      <p class="eyebrow" style="color:#c9dcff">User guide</p>
      <h1>eCRM Lead-to-Cash Workspace</h1>
      <p>Practical guide for Admin and Sales users covering sign-in, daily planning, leads, opportunities, proposals, orders, production, finance visibility, reports, and configuration.</p>
    </section>
    <section class="guide-page">
      <h1>1. Getting Started</h1>
      <p>eCRM is a single-company CRM. Admin and Sales users both see company-wide operating data. Ownership is used for responsibility, filtering, targets, and incentives; it is not used to hide records from other sales users.</p>
      <div class="note" style="margin-top:10px">Local seeded users: Admin is admin@example.com / Admin@12345. Sales is sales@example.com / Sales@12345.</div>
      <img class="screen shot wide-shot" src="${screenshot("login")}" />
      <h2>Main navigation</h2>
      <div class="guide-grid">
        <div class="howto card"><h3>Sales routes</h3><ul><li>Dashboard</li><li>My Day</li><li>Leads</li><li>Opportunities</li><li>Orders</li><li>Production</li><li>Reports</li></ul></div>
        <div class="howto card"><h3>Admin routes</h3><ul><li>Products</li><li>Production config</li><li>All Sales routes</li></ul></div>
      </div>
    </section>
    <section class="guide-page">
      <h1>2. Dashboard And Reports</h1>
      <p>The dashboard is the fastest way to see company-wide sales, billing, collection, production, and follow-up metrics.</p>
      <img class="screen shot wide-shot" src="${screenshot("dashboard")}" />
      <h2>Use the reports page</h2>
      <ol><li>Open <b>Reports</b> from the top navigation.</li><li>Review dashboard metrics at the top.</li><li>Scan top clients, products/services, top billings, collections, recent orders, open pipeline, production pending, and upcoming follow-ups.</li></ol>
      <img class="screen shot wide-shot" src="${screenshot("reports")}" />
    </section>
    <section class="guide-page">
      <h1>3. Plan Sales Work In My Day</h1>
      <p>My Day is a personal workspace for planning sales work without automatically changing CRM records.</p>
      <img class="screen shot wide-shot" src="${screenshot("my-day")}" />
      <div class="guide-grid">
        <div class="howto card"><h3>Create a task</h3><ol><li>Open <b>My Day</b>.</li><li>Select Today.</li><li>Use the task composer to enter the task, type, priority, due date, and optional linked record.</li><li>Save the task.</li></ol></div>
        <div class="howto card"><h3>Capture a voice note</h3><ol><li>Open My Day.</li><li>Use <b>Record voice note</b>.</li><li>Attach it to a task if needed.</li><li>Review playback, transcript, and suggested follow-up actions when available.</li></ol></div>
      </div>
      <h2>Use insights and end-of-day review</h2>
      <p>Insights suggest tomorrow planning, accounts needing attention, voice-note summaries, and unfinished work. End-of-day review helps move or close work intentionally.</p>
      <img class="screen shot wide-shot" src="${screenshot("my-day-insights")}" />
    </section>
    <section class="guide-page">
      <h1>4. Manage Leads And Customer Context</h1>
      <p>Leads and customers represent company-level account records. They can include branches, contacts, activities, notes, owner history, and reassignment.</p>
      <img class="screen shot wide-shot" src="${screenshot("leads")}" />
      <div class="guide-grid">
        <div class="howto card"><h3>Add one lead</h3><ol><li>Open <b>Leads</b>.</li><li>Choose <b>Add one lead</b>.</li><li>Enter account details, state, owner, source, industry, and notes.</li><li>Save the record.</li></ol></div>
        <div class="howto card"><h3>Import leads</h3><ol><li>Open <b>Leads</b>.</li><li>Choose <b>Import leads from CSV</b>.</li><li>Download or follow the fixed template.</li><li>Upload, review row-level errors, and import valid rows.</li></ol></div>
      </div>
      <img class="screen shot wide-shot" src="${screenshot("lead-detail")}" />
    </section>
    <section class="guide-page">
      <h1>5. Opportunities And Proposals</h1>
      <p>Opportunities track separate sales pursuits under a lead/customer. Proposals belong to opportunities and hold the commercial record.</p>
      <img class="screen shot wide-shot" src="${screenshot("opportunities")}" />
      <h2>Create and manage a proposal</h2>
      <ol><li>Open an opportunity.</li><li>Use the proposal area to create a new proposal.</li><li>Add commercial summary, assumptions, inclusions, exclusions, payment terms, delivery timeline, and line items.</li><li>Use product/service catalog items so GST defaults and snapshots are stored consistently.</li><li>Add proposal document links for external PDFs and optional Canva designs.</li><li>Move the proposal through status actions such as sent, accepted, rejected, expired, or withdrawn.</li></ol>
      <img class="screen shot wide-shot" src="${screenshot("proposal-detail")}" />
    </section>
    <section class="guide-page">
      <h1>6. Orders And Production</h1>
      <p>Orders are created from accepted proposals. The order stores source proposal context, customer, branch, owner, line items, GST totals, PO metadata, and production summaries.</p>
      <img class="screen shot wide-shot" src="${screenshot("orders")}" />
      <h2>Book an order from an accepted proposal</h2>
      <ol><li>Open the accepted proposal.</li><li>Choose <b>Book order</b> or open an existing order link if one has already been created.</li><li>Enter PO metadata and due dates as needed.</li><li>Confirm the order detail shows preserved commercial snapshots.</li></ol>
      <img class="screen shot wide-shot" src="${screenshot("order-detail")}" />
      <h2>Update production stages</h2>
      <ol><li>Open <b>Production</b>.</li><li>Open the inline stage controls or a production work item detail page.</li><li>Update stage status, owner, due date, notes, completion, or skipped reason.</li><li>Use the board to scan overall progress by customer and order.</li></ol>
      <img class="screen shot wide-shot" src="${screenshot("production-detail")}" />
    </section>
    <section class="guide-page">
      <h1>7. Products, Production Templates, And Finance Visibility</h1>
      <h2>Product and service catalog</h2>
      <p>Admin users manage the product/service catalog. Sales users use active catalog rows when creating proposal line items.</p>
      <img class="screen shot wide-shot" src="${screenshot("products")}" />
      <h2>Production configuration</h2>
      <p>Admin users can manage production templates, template stages, durations, required flags, active status, and product/service mappings.</p>
      <img class="screen shot wide-shot" src="${screenshot("production-config")}" />
      <h2>Finance visibility</h2>
      <p>Finance data is attached to orders. The model supports invoice records, payments, payment allocations, cost components, gross margin, incentives, split recipients, approval status, overrides, rejection, voiding, and payout metadata. Invoice PDF generation and external accounting sync are not part of the current MVP.</p>
    </section>
    <section class="guide-page">
      <h1>8. Roles, Rules, And Current Boundaries</h1>
      <div class="guide-grid">
        <div class="howto card"><h3>Admin can</h3><ul><li>View and edit company data.</li><li>Manage products and services.</li><li>Manage production templates and mappings.</li><li>Enter finance records and approve or override incentives.</li><li>Use reports and all operational routes.</li></ul></div>
        <div class="howto card"><h3>Sales can</h3><ul><li>View company-wide CRM, pipeline, proposal, order, payment, production, and report data.</li><li>Create and update normal sales records.</li><li>Plan My Day tasks and voice notes.</li><li>Create proposals and add document links where permitted.</li></ul></div>
      </div>
      <h2>Current MVP boundaries</h2>
      <ul><li>The app is single-company, not multi-tenant.</li><li>Proposal documents are external links or uploaded metadata; the CRM does not replace Canva.</li><li>Invoice PDF generation is out of scope.</li><li>Native mobile apps, Microsoft/Google login, email sync, and accounting integrations are out of scope.</li><li>Finance and Operations are workflow modules in the MVP, not separate user roles.</li></ul>
    </section>
  </body></html>`;
}

const outputs = [
  ["ecrm-pitch-deck", deckHtml(), { width: "13.333in", height: "7.5in", printBackground: true }],
  ["ecrm-two-page-brochure", brochureHtml(), { format: "A4", printBackground: true }],
  ["ecrm-user-guide", guideHtml(), { format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } }]
];

for (const [name, html] of outputs) {
  fs.writeFileSync(path.join(outDir, `${name}.html`), html, "utf8");
}

const browser = await chromium.launch({ headless: true });
for (const [name, , pdfOptions] of outputs) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(outDir, `${name}.html`)).href, { waitUntil: "networkidle" });
  await page.pdf({ path: path.join(outDir, `${name}.pdf`), ...pdfOptions });
  await page.close();
}
await browser.close();

console.log("Generated:");
for (const [name] of outputs) {
  console.log(`- ${path.join(outDir, `${name}.pdf`)}`);
}
