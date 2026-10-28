import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { GoogleGenAI, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_COOKIE = "mynutri_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "blob:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"], styleSrcAttr: ["'unsafe-inline'"]
    }
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
app.use(express.json({ limit: "9mb", strict: true }));

function securityConfigured() {
  return APP_PASSWORD.length > 0 && SESSION_SECRET.length >= 32;
}

function fixedTimeEqual(a, b) {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

function isAuthenticated(req) {
  if (!securityConfigured()) return !isProduction;
  const token = readCookie(req, SESSION_COOKIE);
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!fixedTimeEqual(sign(payload), signature)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(session.expiresAt) && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function issueSession(res) {
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + SESSION_TTL_MS })).toString("base64url");
  const token = payload + "." + sign(payload);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS
  });
}

function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/"
  });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again in 15 minutes." }
});

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many analyses in a short time. Please wait a little before trying again." }
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "mynutri-ai" });
});

app.post("/api/login", loginLimiter, (req, res) => {
  if (!securityConfigured()) {
    return res.status(503).json({ error: "App setup is incomplete. Configure APP_PASSWORD and SESSION_SECRET in the hosting environment." });
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!fixedTimeEqual(password, APP_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect password. Please check it and try again." });
  }
  issueSession(res);
  return res.json({ ok: true });
});

app.get("/api/logout", (_req, res) => {
  clearSession(res);
  res.redirect("/login");
});

app.use("/api", (req, res, next) => {
  if (req.path === "/login") return next();
  if (isProduction && !securityConfigured()) {
    return res.status(503).json({ error: "App setup is incomplete. Configure APP_PASSWORD and SESSION_SECRET in the hosting environment." });
  }
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
  return next();
});

app.use("/api", (req, res, next) => {
  if (req.method === "POST" && req.path === "/analyze") return analyzeLimiter(req, res, next);
  return next();
});

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash"
  });
});

const nutritionProperties = {
  caloriesKcal: { type: Type.NUMBER, description: "Estimated energy for the whole described portion in kcal." },
  proteinG: { type: Type.NUMBER, description: "Protein in grams." },
  carbsG: { type: Type.NUMBER, description: "Total carbohydrates in grams." },
  fatG: { type: Type.NUMBER, description: "Total fat in grams." },
  fiberG: { type: Type.NUMBER, description: "Dietary fibre in grams, omit if uncertain." },
  sugarG: { type: Type.NUMBER, description: "Total sugars in grams, omit if uncertain." },
  omega3G: { type: Type.NUMBER, description: "Omega-3 fatty acids in grams, omit if uncertain." },
  omega6G: { type: Type.NUMBER, description: "Omega-6 fatty acids in grams, omit if uncertain." },
  sodiumMg: { type: Type.NUMBER, description: "Sodium in milligrams, depends on salt and recipe." },
  calciumMg: { type: Type.NUMBER, description: "Calcium in milligrams." },
  phosphorusMg: { type: Type.NUMBER, description: "Phosphorus in milligrams." },
  magnesiumMg: { type: Type.NUMBER, description: "Magnesium in milligrams." },
  potassiumMg: { type: Type.NUMBER, description: "Potassium in milligrams." },
  chlorideMg: { type: Type.NUMBER, description: "Chloride in milligrams; omit if not reasonably estimable." },
  zincMg: { type: Type.NUMBER, description: "Zinc in milligrams." },
  ironMg: { type: Type.NUMBER, description: "Iron in milligrams." },
  iodineMcg: { type: Type.NUMBER, description: "Iodine in micrograms; commonly uncertain in foods." },
  copperMcg: { type: Type.NUMBER, description: "Copper in micrograms." },
  manganeseMg: { type: Type.NUMBER, description: "Manganese in milligrams." },
  seleniumMcg: { type: Type.NUMBER, description: "Selenium in micrograms." },
  fluorideMg: { type: Type.NUMBER, description: "Fluoride in milligrams; omit when not known." },
  chromiumMcg: { type: Type.NUMBER, description: "Chromium in micrograms; omit when not known." },
  molybdenumMcg: { type: Type.NUMBER, description: "Molybdenum in micrograms; omit when not known." },
  vitaminAMcg: { type: Type.NUMBER, description: "Vitamin A activity in micrograms RAE where possible." },
  vitaminDIu: { type: Type.NUMBER, description: "Vitamin D in IU." },
  vitaminEMg: { type: Type.NUMBER, description: "Vitamin E in milligrams." },
  vitaminKMcg: { type: Type.NUMBER, description: "Vitamin K in micrograms." },
  vitaminCMg: { type: Type.NUMBER, description: "Vitamin C in milligrams." },
  vitaminB1Mg: { type: Type.NUMBER, description: "Vitamin B1 (thiamine) in milligrams." },
  vitaminB2Mg: { type: Type.NUMBER, description: "Vitamin B2 (riboflavin) in milligrams." },
  vitaminB3Mg: { type: Type.NUMBER, description: "Vitamin B3 (niacin) in milligrams." },
  vitaminB5Mg: { type: Type.NUMBER, description: "Vitamin B5 (pantothenic acid) in milligrams." },
  vitaminB6Mg: { type: Type.NUMBER, description: "Vitamin B6 in milligrams." },
  vitaminB7Mcg: { type: Type.NUMBER, description: "Biotin (vitamin B7) in micrograms." },
  folateMcg: { type: Type.NUMBER, description: "Folate (vitamin B9) in micrograms." },
  vitaminB12Mcg: { type: Type.NUMBER, description: "Vitamin B12 in micrograms." }
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    isFoodRecognized: { type: Type.BOOLEAN, description: "True only if a food or drink can be reasonably identified." },
    foodName: { type: Type.STRING, description: "Short, user-friendly name for the meal." },
    servingDescription: { type: Type.STRING, description: "The portion size used for the estimate." },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          amount: { type: Type.STRING }
        },
        required: ["name", "amount"]
      }
    },
    nutrition: {
      type: Type.OBJECT,
      properties: nutritionProperties,
      required: ["caloriesKcal", "proteinG", "carbsG", "fatG"]
    },
    confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
    notes: { type: Type.STRING, description: "Main uncertainty and estimate caveat." },
    assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
    missingDetails: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["isFoodRecognized", "foodName", "servingDescription", "items", "nutrition", "confidence", "notes", "assumptions", "missingDetails"]
};


function statusCodeFrom(error) {
  const direct = Number(error?.status || error?.statusCode || error?.response?.status);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = String(error?.message || "").match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : 0;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithFallback(client, contents) {
  const configured = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const models = [...new Set([configured, "gemini-3.8-flash", "gemini-3.5-flash-lite"])];
  let lastError = null;

  for (let index = 0; index < models.length; index += 1) {
    const attempts = index === 0 ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await generateWithFallback(client, [{ role: "user", parts }]);
    const parsed = JSON.parse(response.text);
    return res.json(validateAnalysis(parsed));
  } catch (error) {
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const status = statusCodeFrom(error);
    console.error("Gemini analysis failed:", status || "unknown error", String(error?.message || "request failed").slice(0, 240));
    if (status === 429) {
      return res.status(429).json({ error: "Gemini rate limit reached. Wait a little and try again." });
    }
    if (status === 401 || status === 403) {
      return res.status(502).json({ error: "Gemini rejected the configured API key. Check GEMINI_API_KEY in Render Environment settings." });
    }
    if (status === 404) {
      return res.status(502).json({ error: "Gemini could not find an available model for this API key. Check GEMINI_MODEL in Render Environment settings." });
    }
    if ([408, 500, 502, 503, 504].includes(status) || /UNAVAILABLE|high demand|overload|temporarily unavailable/i.test(String(error?.message || ""))) {
      return res.status(503).json({ error: "Gemini is temporarily busy. The app retried and tried backup models, but none responded. Please try again shortly; nothing has been saved." });
    }
    return res.status(502).json({ error: "Gemini analysis failed after retrying backup models. Check the portion and Render logs, then try again." });
  }
});

app.get("/index.html", (req, res) => {
  if (isProduction && !securityConfigured()) {
    return res.status(503).sendFile(path.join(publicDir, "setup.html"));
  }
  if (!isAuthenticated(req)) return res.redirect("/login");
  return res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/login", (req, res) => {
  if (isProduction && !securityConfigured()) {
    return res.status(503).sendFile(path.join(publicDir, "setup.html"));
  }
  if (isAuthenticated(req)) return res.redirect("/");
  return res.sendFile(path.join(publicDir, "login.html"));
});

app.get("/", (req, res) => {
  if (isProduction && !securityConfigured()) {
    return res.status(503).sendFile(path.join(publicDir, "setup.html"));
  }
  if (!isAuthenticated(req)) return res.redirect("/login");
  return res.sendFile(path.join(publicDir, "index.html"));
});

app.use(express.static(publicDir, { index: false, dotfiles: "deny", fallthrough: true }));

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request too large. Use a smaller image or shorter description." });
  }
  console.error("Request failed:", String(err?.message || "unknown error").slice(0, 200));
  return res.status(400).json({ error: "The request could not be processed. Please try again." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("MyNutri AI listening on port " + PORT);
});
