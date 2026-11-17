// Project-local skill installer. Copies SKILL.md files only; refuses overwrite, symlinks and path escape.
// Copying is NOT proof that a host loads or activates the skills.
import fs from 'node:fs';
import path from 'node:path';

export const HOSTS = {claude: '.claude/skills', cursor: '.cursor/skills', codex: '.agents/skills', gemini: '.gemini/skills', copilot: '.github/skills', opencode: '.opencode/skills'};

export function installSkills({host, target, root}) {
  if (!Object.hasOwn(HOSTS, host)) throw new Error('Unsupported host. Allowed: ' + Object.keys(HOSTS).join(', '));
  const source = path.join(root, 'skills');
  const realTarget = fs.realpathSync(target);
  if (!fs.statSync(realTarget).isDirectory()) throw new Error('Target is not a directory');
  const output = path.resolve(realTarget, HOSTS[host]);
  if (!output.startsWith(realTarget + path.sep)) throw new Error('Target escaped root');
  const names = fs.readdirSync(source).sort().filter(n => { const s = path.join(source, n); const st = fs.lstatSync(s); return st.isDirectory() && !st.isSymbolicLink() && fs.existsSync(path.join(s, 'SKILL.md')); });
  let dir = realTarget;
  for (const part of HOSTS[host].split('/')) { dir = path.join(dir, part); if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Error('Symlink in destination skill path'); }
  for (const n of names) { if (fs.existsSync(path.join(output, n)) || isLink(path.join(output, n))) throw new Error('Skill destination exists: ' + n); }
  fs.mkdirSync(output, {recursive: true});
  for (const n of names) { const dest = path.join(output, n); fs.mkdirSync(dest); fs.copyFileSync(path.join(source, n, 'SKILL.md'), path.join(dest, 'SKILL.md')); }
  return {host, skillsInstalled: names.length, destination: output, nativeHostActivation: 'NOT_TESTED', scope: 'PROJECT_LOCAL_ONLY'};
}
function isLink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }
