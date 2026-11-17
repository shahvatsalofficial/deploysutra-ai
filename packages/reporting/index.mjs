// Report rendering: Markdown + self-contained, accessible HTML (light/dark, print, no JS, no external assets).
// Gate colours are deliberately never green: red BLOCKED, amber HUMAN_REVIEW_REQUIRED, grey UNKNOWN.
import fs from 'node:fs';
import path from 'node:path';
import {verify, VERSION} from '../core/index.mjs';

const esc = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const mdc = s => String(s ?? '').replace(/[\r\n]+/g, ' ').replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('`', "'").replaceAll('<', '&lt;');
const val = v => (typeof v === 'string' ? v : JSON.stringify(v));
const loc = x => `${x.source}${x.line ? ':' + x.line : ''}${x.lineConfidence === 'parent' ? ' (nearest parent)' : ''}`;
const KINDS = {OFFLINE_STATIC_K8S: 'Kubernetes desired-state review', IMPORTED_TOFU_PLAN_ACTIONS_ONLY: 'Imported OpenTofu/Terraform plan summary', SELF_AUDIT: 'Independent self-audit'};
const GATE_NOTE = {BLOCKED: 'Do not proceed until every reason below is resolved or consciously accepted by a human operator.', HUMAN_REVIEW_REQUIRED: 'Static checks found nothing that blocks under this profile. A human must still decide; this is NOT an approval to deploy.'};

function table(head, rows) {
  if (!rows.length) return '_None._\n\n';
  return `| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${rows.map(r => `| ${r.map(mdc).join(' | ')} |`).join('\n')}\n\n`;
}

// ---- Markdown ------------------------------------------------------------------------------------------------
export function renderMarkdown(r) {
  if (!verify(r)) throw new Error('Report integrity failed');
  let out = `# DeploySutra AI - ${KINDS[r.scope] || r.scope}\n\n`;
  if (r.scope === 'SELF_AUDIT') return mdAudit(r, out);
  out += `**Gate:** ${r.gate} (NEVER an authorization to deploy)  \n${GATE_NOTE[r.gate]}\n\n`;
  if (r.gateReasons?.length) out += '## Why\n\n' + r.gateReasons.map(x => `- ${mdc(x)}`).join('\n') + '\n\n';
  if (r.scope === 'IMPORTED_TOFU_PLAN_ACTIONS_ONLY') {
    out += `**Changes summarised:** ${r.changeCount}${r.truncated ? ` of ${r.totalChangesInInput} (TRUNCATED)` : ''}  \n**Destructive or replacement candidates:** ${r.dangerousChangeCount}  \n**On data-bearing resource types (name heuristic):** ${r.dataBearingDestructiveCount}\n\n`;
    out += '## Actions\n\n' + table(['create', 'update', 'delete', 'replace', 'read', 'no-op'], [[r.counts.create, r.counts.update, r.counts.delete, r.counts.replace, r.counts.read, r.counts.no_op]]);
    out += '## By resource type\n\n' + table(['Type', 'create', 'update', 'delete', 'replace'], Object.entries(r.byType).map(([t, c]) => [t, c.create, c.update, c.delete, c.replace]));
    if (r.ignoredSensitiveSections.length) out += `Sections present in the input and deliberately discarded: ${r.ignoredSensitiveSections.map(x => '`' + x + '`').join(', ')}\n\n`;
  } else {
    out += `**Profile:** ${r.profile.name} (${r.profile.selection}; blocks on ${r.profile.blockOn.join(', ')})  \n**Resources:** ${r.resourceCounts.before} before, ${r.resourceCounts.after} after (${r.resourceCounts.added} added, ${r.resourceCounts.removed} removed, ${r.resourceCounts.changed} changed)  \n**Source before:** ${mdc(r.source.before?.path)} (sha256 ${r.source.before?.sha256?.slice(0, 12)}…)  \n**Source after:** ${mdc(r.source.after?.path)} (sha256 ${r.source.after?.sha256?.slice(0, 12)}…)\n\n`;
    out += '## Findings\n\n' + table(['Rule', 'Severity', 'Status', 'Resource', 'Message', 'Where'], r.policyFindings.map(f => [f.id, f.severity, f.status, f.resource, f.message, loc(f)]));
    out += '## Changes (desired state)\n\n' + table(['Resource', 'What', 'Change', 'Before', 'After', 'Where'], r.diffs.map(d => [d.resource, d.label === d.path ? d.path : `${d.label} (${d.path})`, d.change, val(d.before), val(d.after), loc(d)]));
    out += '## Blast-radius questions\n\n' + (r.blastRadius.map(x => `- ${mdc(x)}`).join('\n') || '- No changed tracked fields') + '\n\n';
    out += '## BlastMap (edges derived only from supplied manifests)\n\n' + table(['From', 'Relation', 'To', 'Certainty'], r.blastMap.edges.map(e => [e.from, e.relation, e.to, e.certainty]));
    if (r.impactedByChange.length) out += '### Directly connected to changed resources\n\n' + table(['Changed', 'Connected', 'How'], r.impactedByChange.map(x => [x.changed, x.affected, x.relation]));
    out += '## Rollback prerequisites\n\n' + r.rollback.checks.map(x => `- [ ] ${mdc(x.description)}: **${x.status}**`).join('\n') + `\n\n> ${r.rollback.reason}\n\n`;
  }
  out += '## Verification boundaries\n\n' + table(['Check', 'State'], Object.entries(r.checks));
  out += '## Limitations\n\n' + r.limitations.map(x => `- ${mdc(x)}`).join('\n') + '\n\n';
  return out + `Report SHA-256 (unkeyed, tamper evidence only): \`${r.integrity.digest}\`  \nTool: deploysutra-ai ${VERSION} by Vatsal Shah\n`;
}

function mdAudit(r, head) {
  let out = head + `**Overall:** ${r.overall}  \n**Checks:** ${r.totals.passed} passed, ${r.totals.failed} failed, ${r.totals.notRun} not run of ${r.totals.checks}  \n**Generated:** ${r.generatedAt}\n\n> ${mdc(r.statement)}\n\n`;
  for (const s of r.sections) {
    out += `## ${s.title}\n\n**Status:** ${s.status}\n\n${mdc(s.summary)}\n\n`;
    if (s.table) out += table(s.table.columns, s.table.rows);
    if (s.bullets?.length) out += s.bullets.map(b => `- ${mdc(b)}`).join('\n') + '\n\n';
  }
  out += '## Environment\n\n' + table(['Key', 'Value'], Object.entries(r.environment).map(([k, v]) => [k, String(v)]));
  out += '## Reproduce\n\n' + r.reproduce.map(c => '```bash\n' + c + '\n```').join('\n\n') + '\n\n';
  out += '## Honest limits\n\n' + r.limits.map(x => `- ${mdc(x)}`).join('\n') + '\n\n';
  return out + `Report SHA-256 (unkeyed, tamper evidence only): \`${r.integrity.digest}\`\n`;
}

// ---- HTML ----------------------------------------------------------------------------------------------------
export const CSS = `:root{--bg:#f4f7fa;--card:#fff;--ink:#0d1b2a;--mute:#4a5d6e;--line:#d6e0e8;--brand:#0f766e;--navy:#0a2540;--code:#edf2f6;--bad:#a4161a;--badbg:#fde8e8;--warn:#7a4b00;--warnbg:#fff1d6;--grey:#475467;--greybg:#eceff3;--info:#17508f;--infobg:#e3eefb;--pass:#1d5d3b;--passbg:#e4f3ea}
@media(prefers-color-scheme:dark){:root{--bg:#0a121a;--card:#111c27;--ink:#e7eef5;--mute:#a1b3c4;--line:#26394b;--brand:#4fd1c1;--navy:#06101a;--code:#182634;--bad:#ff9a9a;--badbg:#3b1416;--warn:#f5c26b;--warnbg:#33260c;--grey:#b6c2cf;--greybg:#1e2a36;--info:#8fbcf5;--infobg:#112843;--pass:#7fddab;--passbg:#0f2e1f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--brand)}.skip{position:absolute;left:-999px}.skip:focus{left:8px;top:8px;background:var(--card);padding:.5rem 1rem;z-index:9}
header.top{background:linear-gradient(135deg,var(--navy),#0f766e);color:#fff;padding:2rem 1rem}header.top .in,main,footer .in{max-width:1120px;margin:0 auto;padding:0 1rem}
header.top h1{margin:.2rem 0;font-size:clamp(1.5rem,4vw,2.1rem)}header.top p{margin:.2rem 0;opacity:.92}.eyebrow{font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
main{padding-top:1.25rem;padding-bottom:3rem}section.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.1rem 1.4rem;margin:1.1rem 0}
h2{margin:.1rem 0 .7rem;font-size:1.2rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem}.stat{background:var(--code);border-radius:12px;padding:.7rem 1rem}.stat b{display:block;font-size:1.55rem;line-height:1.2}.stat span{color:var(--mute);font-size:.84rem}
.badge{display:inline-block;border-radius:999px;padding:.08rem .65rem;font-size:.76rem;font-weight:700;border:1px solid;white-space:nowrap}
.b-bad{background:var(--badbg);color:var(--bad);border-color:var(--bad)}.b-warn{background:var(--warnbg);color:var(--warn);border-color:var(--warn)}.b-grey{background:var(--greybg);color:var(--grey);border-color:var(--grey)}.b-info{background:var(--infobg);color:var(--info);border-color:var(--info)}.b-pass{background:var(--passbg);color:var(--pass);border-color:var(--pass)}
.banner{border-radius:12px;padding:1rem 1.2rem;margin:1rem 0;border:2px solid}.banner.bad{background:var(--badbg);color:var(--bad);border-color:var(--bad)}.banner.warn{background:var(--warnbg);color:var(--warn);border-color:var(--warn)}.banner.grey{background:var(--greybg);color:var(--grey);border-color:var(--grey)}.banner b{font-size:1.15rem}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:.6rem 0}table{border-collapse:collapse;width:100%;font-size:.88rem}caption{text-align:left;padding:.5rem .8rem;font-weight:650;color:var(--mute)}
th,td{padding:.45rem .7rem;text-align:left;vertical-align:top;border-top:1px solid var(--line)}th{background:var(--code);font-size:.76rem;text-transform:uppercase;letter-spacing:.04em}
code,pre{font:.86em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);border-radius:6px}code{padding:.05rem .3rem;overflow-wrap:anywhere}pre{padding:.8rem;overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere}
ul{padding-left:1.2rem}.mute{color:var(--mute)}footer{border-top:1px solid var(--line);padding:1.4rem 0;color:var(--mute);font-size:.84rem}:focus-visible{outline:3px solid var(--brand);outline-offset:2px}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
@media print{body{background:#fff;color:#000}header.top{background:#fff;color:#000;border-bottom:2px solid #000}section.card{break-inside:avoid}.skip{display:none}}`;

const badge = (t, c) => `<span class="badge b-${c}">${esc(t)}</span>`;
const sevBadge = s => badge(s, s === 'HIGH' ? 'bad' : s === 'MEDIUM' ? 'warn' : 'grey');
const stateBadge = s => badge(s, /^(PASS|VERIFIED_STATIC|EXECUTED_VERIFIED)$/.test(s) ? 'pass' : /^(FAIL|FAILED|MISSING|BLOCKED)$/.test(s) ? 'bad' : /^(NOT_RUN|NOT_TESTED|NOT_VERIFIED|DECLARED_NOT_VERIFIED|PARTIAL_TRUNCATED)$/.test(s) ? 'warn' : 'grey');
function ht(caption, head, rows, empty = 'None.') {
  if (!rows.length) return `<p class="mute">${esc(empty)}</p>`;
  return `<div class="tw" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${esc(caption)}</caption><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const sec = (id, title, body) => `<section class="card" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${esc(title)}</h2>${body}</section>`;
const stat = (v, l) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
const shell = (title, sub, body, r) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>${esc(title)} · DeploySutra AI</title><style>${CSS}</style></head><body><a class="skip" href="#main">Skip to report</a><header class="top"><div class="in"><div class="eyebrow">DeploySutra AI · offline static analysis · no cluster was contacted</div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div></header><main id="main">${body}</main><footer><div class="in">deploysutra-ai ${esc(VERSION)} · created by Vatsal Shah · Apache-2.0 · integrity SHA-256 <code>${esc(r.integrity.digest)}</code> (tamper evidence, not a signature) · this report is advisory and never an approval to deploy</div></footer></body></html>`;

function gateBanner(r) {
  const cls = r.gate === 'BLOCKED' ? 'bad' : r.gate === 'HUMAN_REVIEW_REQUIRED' ? 'warn' : 'grey';
  return `<div class="banner ${cls}" role="status"><b>${esc(r.gate)}</b><br>${esc(GATE_NOTE[r.gate] || 'Unknown gate state.')}${r.gateReasons?.length ? `<ul>${r.gateReasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
}

export function renderHTML(r) {
  if (!verify(r)) throw new Error('Report integrity failed');
  if (r.scope === 'SELF_AUDIT') return htmlAudit(r);
  const limits = sec('limits', 'Limitations', `<ul>${r.limitations.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  const checks = sec('checks', 'Verification boundaries', ht('What was and was not checked', ['Check', 'State'], Object.entries(r.checks).map(([k, v]) => [`<code>${esc(k)}</code>`, stateBadge(v)])));
  if (r.scope === 'IMPORTED_TOFU_PLAN_ACTIONS_ONLY') {
    const body = gateBanner(r) + sec('summary', 'Summary', `<div class="grid">${stat(r.changeCount, 'changes summarised')}${stat(r.dangerousChangeCount, 'destructive / replace')}${stat(r.dataBearingDestructiveCount, 'on data-bearing types')}${stat(r.counts.create + '/' + r.counts.update + '/' + r.counts.delete, 'create / update / delete')}</div>${r.truncated ? `<p>${badge('TRUNCATED', 'warn')} Only the first ${r.changeCount} of ${r.totalChangesInInput} changes were summarised.</p>` : ''}`)
      + sec('types', 'By resource type', ht('Actions per resource type (values and addresses discarded)', ['Type', 'create', 'update', 'delete', 'replace'], Object.entries(r.byType).map(([t, c]) => [`<code>${esc(t)}</code>`, c.create, c.update, c.delete, c.replace]))
        + (r.ignoredSensitiveSections.length ? `<p class="mute">Sections present in the input and deliberately discarded: ${r.ignoredSensitiveSections.map(x => `<code>${esc(x)}</code>`).join(', ')}</p>` : '')) + checks + limits;
    return shell('Imported plan summary', 'Resource types and actions only. No provider state, addresses or values are retained.', body, r);
  }
  const count = s => r.policyFindings.filter(f => f.severity === s).length;
  const body = gateBanner(r)
    + sec('summary', 'Summary', `<div class="grid">${stat(r.profile.name, `profile (${r.profile.selection})`)}${stat(r.policyFindings.length, 'findings')}${stat(count('HIGH'), 'HIGH')}${stat(count('MEDIUM'), 'MEDIUM')}${stat(r.diffs.length, 'changes')}${stat(`${r.resourceCounts.added}+ ${r.resourceCounts.removed}-`, 'resources added / removed')}</div><p class="mute">Before: <code>${esc(r.source.before?.path)}</code> · After: <code>${esc(r.source.after?.path)}</code> · profile blocks on ${esc(r.profile.blockOn.join(', '))}</p>`)
    + sec('findings', 'Findings', ht('Static policy findings (rule IDs are stable)', ['Rule', 'Severity', 'Status', 'Resource', 'What', 'Where', 'Fix'], r.policyFindings.map(f => [`<code>${esc(f.id)}</code>`, sevBadge(f.severity), badge(f.status, f.status === 'new' ? 'info' : 'grey'), esc(f.resource), esc(f.message), `<code>${esc(loc(f))}</code>`, esc(f.requirement)]), 'No findings under the supported rules.'))
    + sec('changes', 'Changes (desired state, not live drift)', ht('Semantic diff of the two snapshots; sensitive values are redacted', ['Resource', 'What', 'Change', 'Before', 'After', 'Where'], r.diffs.map(d => [esc(d.resource), esc(d.label === d.path ? d.path : `${d.label} (${d.path})`), badge(d.change, 'info'), `<code>${esc(val(d.before))}</code>`, `<code>${esc(val(d.after))}</code>`, `<code>${esc(loc(d))}</code>`]), 'No differences in supported fields.'))
    + sec('blast', 'Blast radius', `<p class="mute">Questions to answer before release, and edges derived only from the manifests you supplied. Anything else is UNKNOWN.</p><ul>${r.blastRadius.map(x => `<li>${esc(x)}</li>`).join('') || '<li>No changed tracked fields.</li>'}</ul>` + ht('BlastMap edges', ['From', 'Relation', 'To', 'Certainty'], r.blastMap.edges.map(e => [esc(e.from), esc(e.relation), esc(e.to), badge(e.certainty, /UNKNOWN|not-supplied/.test(e.certainty) ? 'grey' : 'info')]), 'No dependency edges found in the supplied manifests.'))
    + sec('rollback', 'Rollback prerequisites', ht('Declarations are never treated as verification', ['Prerequisite', 'State'], r.rollback.checks.map(c => [esc(c.description), stateBadge(c.status)])) + `<p class="mute">${esc(r.rollback.reason)}</p>`)
    + checks + limits;
  return shell('Deployment readiness review', r.identity ? `${r.identity.kind}/${r.identity.namespace}/${r.identity.name}` : `${r.resourceCounts.after} resources compared`, body, r);
}

function htmlAudit(r) {
  const cls = r.overall === 'PASS' ? 'pass' : r.overall === 'FAIL' ? 'bad' : 'warn';
  const body = `<div class="banner ${cls === 'pass' ? 'grey' : cls}" role="status"><b>Overall: ${esc(r.overall)}</b><br>${esc(r.statement)}</div>`
    + sec('totals', 'Totals', `<div class="grid">${stat(r.totals.checks, 'checks')}${stat(r.totals.passed, 'passed')}${stat(r.totals.failed, 'failed')}${stat(r.totals.notRun, 'not run')}</div><p class="mute">Generated ${esc(r.generatedAt)} · measured on this machine at run time.</p>`)
    + r.sections.map(s => sec(s.id, `${s.title}`, `<p>${stateBadge(s.status)} ${esc(s.summary)}</p>` + (s.table ? ht(s.title, s.table.columns, s.table.rows.map(row => row.map((c, i) => (/^(PASS|FAIL|NOT_RUN)$/.test(c) ? stateBadge(c) : esc(c))))) : '') + (s.bullets?.length ? `<ul>${s.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''))).join('')
    + sec('env', 'Environment', ht('Where this ran', ['Key', 'Value'], Object.entries(r.environment).map(([k, v]) => [esc(k), `<code>${esc(String(v))}</code>`])))
    + sec('repro', 'Reproduce it yourself', r.reproduce.map(c => `<pre><code>${esc(c)}</code></pre>`).join(''))
    + sec('limits', 'Honest limits', `<ul>${r.limits.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  return shell('Independent audit report', 'Everything below was measured when you ran it, not written by hand.', body, r);
}

/** Write the report set. Existing files are overwritten only inside the chosen directory. */
export function saveReports(r, dir) {
  if (!verify(r)) throw new Error('Invalid integrity checksum');
  fs.mkdirSync(dir, {recursive: true});
  const base = path.resolve(dir);
  const put = (n, t) => fs.writeFileSync(path.join(base, n), t, {mode: 0o600});
  const stem = r.scope === 'SELF_AUDIT' ? 'audit-report' : 'deploy-readiness';
  put(`${stem}.json`, JSON.stringify(r, null, 2) + '\n'); put(`${stem}.md`, renderMarkdown(r)); put(`${stem}.html`, renderHTML(r));
  if (r.scope === 'OFFLINE_STATIC_K8S') {
    put('environment-diff.json', JSON.stringify(r.diffs, null, 2) + '\n');
    put('policy-findings.json', JSON.stringify(r.policyFindings, null, 2) + '\n');
    put('blast-radius.md', '# Change blast radius questions\n\n' + (r.blastRadius.map(x => `- ${mdc(x)}`).join('\n') || '- No changed tracked fields') + '\n');
    put('rollback-checklist.md', '# Rollback evidence prerequisites\n\n' + r.rollback.checks.map(x => `- [ ] ${mdc(x.description)}: ${x.status}`).join('\n') + '\n');
  }
  return base;
}
