import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("server keeps Gemini key server-side and exposes a health endpoint", async () => {
  const server = await read("server.js");
  assert.match(server, /process\.env\.GEMINI_API_KEY/);
  assert.match(server, /app\.get\("\/health"/);
  assert.match(server, /app\.post\("\/api\/analyze"/);
  assert.doesNotMatch(await read("public/app.js"), /AIza[0-9A-Za-z_-]{20,}/);
});

test("analysis flow requires review before a meal is saved", async () => {
  const page = await read("public/index.html");
  const client = await read("public/app.js");
  assert.match(page, /id="review-panel"[^>]*hidden/);
  assert.match(client, /function fillReview\(/);
  assert.match(client, /function saveMeal\(/);
  assert.match(client, /Analyze with Gemini/);
});

test("Render config names the production secrets without committing values", async () => {
  const config = await read("render.yaml");
  assert.match(config, /key: GEMINI_API_KEY\s+sync: false/);
  assert.match(config, /key: APP_PASSWORD\s+sync: false/);
  assert.match(config, /key: SESSION_SECRET\s+generateValue: true/);
});

test("all requested macro, mineral and vitamin keys are covered in API and UI", async () => {
  const server = await read("server.js");
  const client = await read("public/app.js");
  const required = [
    "omega6G", "phosphorusMg", "chlorideMg", "iodineMcg", "copperMcg", "manganeseMg",
    "seleniumMcg", "fluorideMg", "chromiumMcg", "molybdenumMcg", "vitaminAMcg", "vitaminEMg",
    "vitaminKMcg", "vitaminB1Mg", "vitaminB2Mg", "vitaminB3Mg", "vitaminB5Mg", "vitaminB6Mg",
    "vitaminB7Mcg", "folateMcg"
  ];
  for (const key of required) {
    assert.ok(server.includes(key), "server missing " + key);
    assert.ok(client.includes(key), "client missing " + key);
  }
  assert.match(client, /id="target-fields"/);
});

test("transient Gemini outages are retried and use backup models", async () => {
  const server = await read("server.js");
  assert.match(server, /function generateWithFallback/);
  assert.match(server, /gemini-3\.8-flash/);
  assert.match(server, /gemini-3\.5-flash-lite/);
  assert.match(server, /Gemini is temporarily busy/);
});

test("meal input and photo selection can trigger background analysis without auto-saving", async () => {
  const client = await read("public/app.js");
  const page = await read("public/index.html");
  assert.match(client, /function scheduleAutoAnalysis/);
  assert.match(client, /scheduleAutoAnalysis\(1800\)/);
  assert.match(client, /reader\.readAsDataURL\(file\)/);
  assert.match(page, /nothing is saved until you confirm/i);
});

test("unknown micronutrients remain absent instead of being silently zeroed", async () => {
  const server = await read("server.js");
  const client = await read("public/app.js");
  const page = await read("public/index.html");
  assert.match(server, /omit a field if a reasonable estimate is not available/);
  assert.match(client, /Not estimated/);
  assert.match(page, /values returned for logged meals/);
});
