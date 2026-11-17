import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAudit} from '../packages/core/audit.mjs';
import {verify} from '../packages/core/index.mjs';
import {renderMarkdown, renderHTML} from '../packages/reporting/index.mjs';

const r = runAudit({skipTests: true});
test('audit report is sealed and verifies', () => assert(verify(r)));
test('audit has no failed checks', () => assert.equal(r.totals.failed, 0, JSON.stringify(r.sections.flatMap(s => s.table.rows.filter(x => x[1] === 'FAIL')))));
test('audit covers all nine sections', () => assert.deepEqual(r.sections.map(s => s.id), ['tests', 'accuracy', 'leakage', 'hostile', 'integrity', 'safety', 'performance', 'package', 'notrun']));
test('audit lists what was not run and its honest limits', () => { assert(r.sections.find(s => s.id === 'notrun').table.rows.length >= 5); assert(r.limits.length >= 4); });
test('audit renders to Markdown and HTML', () => { assert(renderMarkdown(r).includes('Honest limits')); assert(renderHTML(r).includes('Independent audit report')); });
test('audit statement does not claim certification', () => assert(/not a certification/i.test(r.statement)));
test('audit records gold corpus precision and recall', () => { assert.equal(r.goldCorpus.precision, 1); assert.equal(r.goldCorpus.recall, 1); });
