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

test("unknown micronutrients remain absent instead of being silently zeroed", async () => {
  const server = await read("server.js");
  const client = await read("public/app.js");
  assert.match(server, /omit a field if a reasonable estimate is not available/);
  assert.match(client, /Not estimated/);
  assert.match(client, /values returned for logged meals/);
});
