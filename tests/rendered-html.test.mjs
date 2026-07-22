import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Harunihon learning home", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>하루니혼 Lite \| 매일 10분 일본어<\/title>/);
  assert.match(html, /오늘의 학습/);
  assert.match(html, /오늘의 코스/);
  assert.match(html, /오늘의 한 문장/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the installable app assets", async () => {
  const root = new URL("../public/", import.meta.url);
  await Promise.all([
    access(new URL("manifest.webmanifest", root)),
    access(new URL("sw.js", root)),
    access(new URL("icon-192.png", root)),
    access(new URL("icon-512.png", root)),
    access(new URL("apple-touch-icon.png", root)),
    access(new URL("privacy.html", root)),
    access(new URL("og.png", root)),
  ]);
  const manifest = JSON.parse(await readFile(new URL("manifest.webmanifest", root), "utf8"));
  assert.equal(manifest.name, "하루니혼 Lite");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);
});

test("keeps learning state on the device", async () => {
  const app = await readFile(new URL("../app/HaruApp.tsx", import.meta.url), "utf8");
  assert.match(app, /localStorage\.setItem/);
  assert.match(app, /speechSynthesis/);
  assert.match(app, /serviceWorker\.register/);
  assert.match(app, /rateWord/);
  assert.match(app, /addMistake/);
});
