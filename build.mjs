// Builds:  www/   -> Brian's app (bundled into the APK, and also served at /me/ on the website)
//          site/  -> website: family page at /, Brian's web version at /me/
// Test build with fake data (no Firebase):  node build.mjs --mock  -> test/
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const mock = process.argv.includes("--mock");
const mockPlugin = { name: "mock", setup(b) { b.onResolve({ filter: /\/data\.js$/ }, a => ({ path: resolve(a.resolveDir, a.path.replace("data.js", "data-mock.js")) })); } };
const opts = { bundle: true, minify: !mock, format: "iife", target: ["es2020", "chrome90", "safari15"], plugins: mock ? [mockPlugin] : [], logLevel: "warning" };

// fonts (bundled so the app looks right offline)
const fontDir = "node_modules/@fontsource/atkinson-hyperlegible/files";
mkdirSync("www/fonts", { recursive: true });
for (const w of [400, 700]) cpSync(`${fontDir}/atkinson-hyperlegible-latin-${w}-normal.woff2`, `www/fonts/ah-${w}.woff2`);
writeFileSync("www/fonts.css", [400, 700].map(w => `@font-face{font-family:"Atkinson Hyperlegible";font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/ah-${w}.woff2) format("woff2")}`).join("\n"));

const out = mock ? "test" : "site";
rmSync(out, { recursive: true, force: true });
await esbuild.build({ ...opts, entryPoints: ["src/brian.js"], outfile: mock ? "test/me/app.js" : "www/app.js" });
if (!mock) { mkdirSync(`${out}/me`, { recursive: true }); cpSync("www", `${out}/me`, { recursive: true }); }
else { for (const f of ["index.html", "style.css", "fonts.css", "fonts"]) cpSync(`www/${f}`, `test/me/${f}`, { recursive: true }); }
await esbuild.build({ ...opts, entryPoints: ["src/family.js"], outfile: `${out}/app.js` });
cpSync("family/index.html", `${out}/index.html`);
for (const f of ["style.css", "fonts.css", "fonts"]) cpSync(`www/${f}`, `${out}/${f}`, { recursive: true });
writeFileSync(`${out}/.nojekyll`, "");
// cache-busting: make browsers load the newest files after each update
const v = Date.now().toString(36);
for (const p of [`${out}/index.html`, `${out}/me/index.html`]) {
  if (!existsSync(p)) continue;
  writeFileSync(p, readFileSync(p, "utf8").replace(/(href|src)="(app\.js|style\.css|fonts\.css)"/g, `$1="$2?v=${v}"`));
}
console.log(`Built ${mock ? "test (mock data)" : "www/ and site/"}`);
