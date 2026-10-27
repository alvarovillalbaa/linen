#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Syntax and local references only: never import app/backend files or execute scripts.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ignored = new Set(['.git', '.next', '.vercel', '.turbo', '.cache', 'node_modules', 'dist', 'build', 'coverage', 'artifacts']);
const errors = [];
const counts = { parsed: 0, imports: 0, scriptPaths: 0, documents: 0, links: 0, anchors: 0 };
const relative = file => path.relative(root, file).split(path.sep).join('/') || '.';
const report = (file, message) => errors.push(`${relative(file)}: ${message}`);
const inside = file => file === root || file.startsWith(`${root}${path.sep}`);
const isFile = file => { try { return fs.statSync(file).isFile(); } catch { return false; } };

function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(file));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}
function parserOption() {
  let explicit = process.env.LINEN_TYPESCRIPT_PATH;
  for (let index = 2; index < process.argv.length; index++) {
    const argument = process.argv[index];
    if (argument === '--help') {
      process.stdout.write('Usage: node scripts/check.mjs [--typescript <existing TypeScript module or directory>]\nAn existing parser can also be selected with LINEN_TYPESCRIPT_PATH. No files, packages or services are changed.\n');
      process.exit(0);
    }
    if (argument === '--typescript') {
      explicit = process.argv[++index];
      if (!explicit || explicit.startsWith('--')) throw new Error('--typescript needs an existing module path.');
    } else if (argument.startsWith('--typescript=')) explicit = argument.slice('--typescript='.length);
    else throw new Error(`Unknown option: ${argument}`);
  }
  return explicit;
}
function loadParser() {
  try {
    const selected = parserOption();
    const ts = require(selected ? path.resolve(selected) : 'typescript');
    if (typeof ts.createSourceFile !== 'function' || typeof ts.resolveModuleName !== 'function') throw new Error('The selected module is not TypeScript.');
    return ts;
  } catch (error) {
    report(path.join(root, 'package.json'), `TypeScript parsing/import checks unavailable: ${error.message}. Use the project dependency or explicitly select an existing parser with LINEN_TYPESCRIPT_PATH/--typescript; this checker never installs one.`);
    return null;
  }
}
function compilerOptions(ts) {
  const file = path.join(root, 'tsconfig.json');
  if (!isFile(file)) { report(file, 'missing TypeScript configuration'); return {}; }
  const parsed = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, 'utf8'));
  if (parsed.error) report(file, ts.flattenDiagnosticMessageText(parsed.error.messageText, ' '));
  const converted = ts.convertCompilerOptionsFromJson(parsed.config?.compilerOptions ?? {}, root);
  for (const diagnostic of converted.errors) report(file, ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
  return converted.options;
}
function checkImport(ts, options, file, specifier, dependencies) {
  if (specifier.startsWith('.') || specifier.startsWith('@/')) {
    counts.imports++;
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
    const direct = specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null;
    const target = resolved ?? (direct && isFile(direct) ? direct : null);
    if (!target || !isFile(target)) report(file, `unresolved local import ${JSON.stringify(specifier)} (check its file and tsconfig paths)`);
    else if (!inside(path.resolve(target)) || !inside(fs.realpathSync(target))) report(file, `local import escapes this repository: ${JSON.stringify(specifier)}`);
    return;
  }
  if (specifier.startsWith('node:') || builtinModules.includes(specifier)) return;
  const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  if (!dependencies.has(name)) report(file, `imported package ${JSON.stringify(name)} is not declared in package.json`);
}
function checkSource(ts, options, files, dependencies) {
  for (const file of files.filter(file => /\.tsx?$/.test(file))) {
    const source = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    counts.parsed++;
    for (const diagnostic of ast.parseDiagnostics ?? []) {
      const position = ast.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      report(file, `${position.line + 1}:${position.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
    }
    const seen = new Set();
    function inspect(node) {
      let specifier;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length >= 1 && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) specifier = node.argument.literal.text;
      if (specifier !== undefined && !seen.has(specifier)) { seen.add(specifier); checkImport(ts, options, file, specifier, dependencies); }
      ts.forEachChild(node, inspect);
    }
    inspect(ast);
    for (const reference of ast.referencedFiles) {
      const target = path.relative(root, path.resolve(path.dirname(file), reference.fileName));
      // Next generates this type reference during builds; no local build is required.
      if (target.split(path.sep)[0] === '.next') continue;
      checkImport(ts, options, file, reference.fileName.startsWith('.') ? reference.fileName : `./${reference.fileName}`, dependencies);
    }
  }
}
function checkScriptPaths(scripts) {
  for (const [name, command] of Object.entries(scripts ?? {})) {
    if (typeof command !== 'string') { report(path.join(root, 'package.json'), `script ${name} is not text`); continue; }
    const tokens = command.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g) ?? [];
    for (const token of tokens) {
      const value = token.replace(/^(['"])(.*)\1$/, '$2');
      if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.includes('$') || value.includes('=') || value.startsWith('-')) continue;
      if (!/^(?:\.\.?\/|scripts\/|tests\/)/.test(value) && !/\.(?:[cm]?js|tsx?|json)$/.test(value)) continue;
      counts.scriptPaths++;
      const target = path.resolve(root, value);
      if (!inside(target)) { report(path.join(root, 'package.json'), `script ${name} references a path outside this repository`); continue; }
      try {
        const matches = /[*?[]/.test(value) ? [...fs.globSync(value, { cwd: root })].map(file => path.resolve(root, file)) : [target];
        if (!matches.some(isFile)) report(path.join(root, 'package.json'), `script ${name} has no local file matching ${JSON.stringify(value)}`);
      } catch { report(path.join(root, 'package.json'), `script ${name} has an invalid local path ${JSON.stringify(value)}`); }
    }
  }
}
function prose(source) {
  let fence = null;
  return source.split(/\r?\n/).map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker && (!fence || marker[0] === fence[0] && marker.length >= fence.length)) { fence = fence ? null : marker; return ''; }
    return fence ? '' : line;
  }).join('\n');
}
const headingCache = new Map();
function headings(file) {
  if (headingCache.has(file)) return headingCache.get(file);
  const source = prose(fs.readFileSync(file, 'utf8')), found = new Set();
  for (const match of source.matchAll(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = match[1].replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s/g, '-');
    let slug = base, suffix = 0;
    while (found.has(slug)) slug = `${base}-${++suffix}`;
    found.add(slug);
  }
  for (const match of source.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) found.add(match[1]);
  headingCache.set(file, found);
  return found;
}
function checkLink(file, value) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(value)) return;
  const [location, rawAnchor] = value.split('#', 2);
  let target, anchor;
  try { target = location ? path.resolve(path.dirname(file), decodeURIComponent(location.split('?', 1)[0])) : file; anchor = rawAnchor ? decodeURIComponent(rawAnchor) : ''; }
  catch { report(file, `invalid local link encoding: ${JSON.stringify(value)}`); return; }
  counts.links++;
  if (!inside(target)) { report(file, `document link escapes this repository: ${JSON.stringify(value)}`); return; }
  if (!fs.existsSync(target)) { report(file, `missing local document target: ${JSON.stringify(value)}`); return; }
  if (!inside(fs.realpathSync(target))) { report(file, `document link follows an outside symlink: ${JSON.stringify(value)}`); return; }
  const stat = fs.statSync(target);
  if (stat.isFile() && /\.md$/i.test(target)) {
    if (!stat.size) report(file, `linked Markdown file is empty: ${JSON.stringify(value)}`);
    if (anchor) { counts.anchors++; if (!headings(target).has(anchor)) report(file, `missing Markdown heading/id: ${JSON.stringify(value)}`); }
  }
}
function checkDocuments(files) {
  for (const file of files.filter(file => /\.md$/i.test(file))) {
    counts.documents++;
    // Conventional Markdown links/ATX anchors, not a full Markdown renderer.
    const source = prose(fs.readFileSync(file, 'utf8')).replace(/(`+)[\s\S]*?\1/g, '');
    for (const match of source.matchAll(/!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)\n]+))(?:\s+["'][^\n]*?["'])?\s*\)/g)) checkLink(file, match[1] ?? match[2]);
    for (const match of source.matchAll(/^\s{0,3}\[[^\]\n]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm)) checkLink(file, match[1] ?? match[2]);
  }
}

try {
  const files = walk(root), packageFile = path.join(root, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const dependencies = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies }));
  const ts = loadParser();
  if (ts) checkSource(ts, compilerOptions(ts), files, dependencies);
  checkScriptPaths(manifest.scripts);
  checkDocuments(files);
  for (const issue of errors) process.stderr.write(`${issue}\n`);
  process.stdout.write(`Linen static check: TypeScript ${ts?.version ?? 'unavailable'}; ${counts.parsed} TS/TSX files parsed; ${counts.imports} local imports; ${counts.scriptPaths} script paths; ${counts.documents} Markdown files, ${counts.links} local links, ${counts.anchors} anchors; ${errors.length} errors.\n`);
  process.stdout.write('Syntax and local references only. No semantic typecheck, dependency-presence verification, backend execution, tests, build, browser or provider checks.\n');
  process.exitCode = errors.length ? 1 : 0;
} catch (error) {
  process.stderr.write(`Linen static check could not finish: ${error.message}\n`);
  process.exitCode = 1;
}
