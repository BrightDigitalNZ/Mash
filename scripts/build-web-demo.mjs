// Post-processes `expo export --platform web` output so the demo can be hosted under any
// path (a static host, an artifact viewer, a subfolder), not only at an origin's root.
//
//   EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir dist-demo
//   node scripts/build-web-demo.mjs dist-demo
//
// What it does:
//   1. expo-asset turns every asset URL into an origin-absolute "/assets/..." on web by
//      stripping the origin from an absolute URL. With `experiments.baseUrl: "."` the
//      bundle itself references "./assets/...", so we make the resolver keep that
//      leading "./" and the browser resolves assets relative to the page.
//   2. Expo Router mirrors navigation into the address bar (pushState/replaceState). On a
//      host that serves the page at one fixed path, a refresh at /lineup/x would 404 and
//      relative asset URLs would resolve against the wrong directory. Every history entry
//      is pinned to the page's own URL instead; Back and Forward still work.
//   3. Writes `artifact.html`: the page as a fragment (no doctype/html/head/body), which
//      is what an artifact viewer wraps in its own skeleton. index.html is left as is for
//      ordinary static hosts.

import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, 'index.html'))) {
  console.error('usage: node scripts/build-web-demo.mjs <export dir containing index.html>');
  process.exit(1);
}

// 1. Keep asset URLs page-relative.
const jsDir = path.join(dir, '_expo', 'static', 'js', 'web');
let patched = 0;
let history = 0;
for (const file of fs.readdirSync(jsDir)) {
  if (!file.endsWith('.js')) continue;
  const p = path.join(jsDir, file);
  const src = fs.readFileSync(p, 'utf8');
  const out = src.replace(/\.toString\(\)\.replace\(([A-Za-z_$][\w$]*)\.origin,''\)/g, (_, v) => {
    patched += 1;
    return `.toString().replace(${v}.origin+'/','./')`;
  });
  // 2. Pin the address bar. History entries are still created, so Back works, but every
  //    entry carries the page's own URL instead of the route path.
  const frozen = out.replace(
    /window\.history\.(pushState|replaceState)\(\{id:([A-Za-z_$][\w$]*)\},'',[A-Za-z_$][\w$]*\)/g,
    (_, fn, id) => {
      history += 1;
      return `window.history.${fn}({id:${id}},'',window.location.href)`;
    },
  );
  if (frozen !== src) fs.writeFileSync(p, frozen);
}
if (patched === 0) {
  console.error(
    'Did not find the expo-asset origin strip to patch; asset URLs may be origin-absolute.',
  );
  process.exit(2);
}

// 3. Artifact fragment.
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? 'Mash';
const style = /<style id="expo-reset">([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
const script = /<script src="([^"]+)" defer><\/script>/.exec(html)?.[1];
if (!script) {
  console.error('Could not find the bundle script tag in index.html');
  process.exit(3);
}
const fragment = `<title>${title}</title>
<meta name="description" content="Mash demo with sample data. Nothing here is real." />
<style>
${style.trim()}
  :root { padding: 0; }
  html, body { margin: 0; background: #FBF7F1; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; } }
  :root[data-theme="dark"] { color-scheme: dark; }
  #root { min-height: 100%; }
</style>
<div id="root"></div>
<script src="${script}" defer></script>
`;
fs.writeFileSync(path.join(dir, 'artifact.html'), fragment);

console.log(
  `patched ${patched} asset resolver(s), pinned ${history} history write(s); wrote ${path.join(dir, 'artifact.html')}`,
);
