import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource } from 'firebase/ai';
import { systemInstruction, TASKS } from './prompts.js';

const env = import.meta.env;
// VITE_CLOUD_MODEL may be a comma-separated list: models are tried in order when one is overloaded.
const CLOUD_MODELS = (env.VITE_CLOUD_MODEL || 'gemini-3.7-flash,gemini-3.5-flash-lite').split(',').map((m) => m.trim()).filter(Boolean);

// Chrome's built-in Prompt API (Gemini Nano) currently supports en / es / ja output.
const OUTPUT_LANG = { en: 'en', es: 'es' };

let ai;
const models = new Map(); // `${mode}:${lang}` -> GenerativeModel

function initFirebase() {
  if (ai) return ai;
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  // Firebase AI Logic requires App Check. A debug token is accepted for judging:
  // open the console, copy the printed token into Firebase console > App Check > Manage debug tokens.
  if (env.VITE_APPCHECK_DEBUG === 'true') self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY || 'unused-with-debug-token'),
    isTokenAutoRefreshEnabled: true,
  });
  ai = getAI(app, { backend: new GoogleAIBackend() });
  return ai;
}

/** privacy = true -> ONLY_ON_DEVICE (nothing ever leaves the phone). Otherwise on-device first, cloud fallback. */
function getModel(privacy, lang, cloudModel = CLOUD_MODELS[0]) {
  const key = `${privacy ? 'private' : 'auto'}:${lang}:${cloudModel}`;
  if (!models.has(key)) {
    models.set(
      key,
      getGenerativeModel(initFirebase(), {
        mode: privacy ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.PREFER_ON_DEVICE,
        onDeviceParams: {
          createOptions: {
            expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
            expectedOutputs: [{ type: 'text', languages: [OUTPUT_LANG[lang] ?? 'en'] }],
          },
        },
        inCloudParams: { model: cloudModel, systemInstruction: systemInstruction(lang) },
      }),
    );
  }
  return models.get(key);
}

/** Starts the Gemini Nano download (needs a user gesture in Chrome). Safe to call when unsupported. */
export async function prepareOnDevice({ privacy, lang, onProgress }) {
  try {
    await getModel(privacy, lang).initializeDeviceModel?.(onProgress);
    return true;
  } catch (e) {
    console.warn('On-device model not ready:', e);
    return false;
  }
}

/**
 * @param {{task:'describe'|'read'|'ask', imageBase64:string, lang:string, privacy:boolean, question?:string}} p
 * @returns {Promise<{text:string, source:'on_device'|'in_cloud'}>}
 */
export async function run({ task, imageBase64, lang, privacy, question }) {
  // On-device models ignore inCloudParams.systemInstruction, so the rules are also prepended to the prompt.
  const prompt = `${systemInstruction(lang)}\n\n${TASKS[task](lang, question)}`;
  const parts = [prompt, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }];
  // Errors that justify trying again or switching to the next model in VITE_CLOUD_MODEL.
  const fallbackWorthy = (e) => /\b(404|429|500|503)\b|high demand|overloaded|unavailable|timeout|no longer available|quota/i.test(String(e?.message ?? e));
  const attempts = [];
  let lastError;
  const retries = CLOUD_MODELS.length === 1 ? 2 : 1; // a single model gets one retry; a list is its own retry
  for (const cloudModel of CLOUD_MODELS) {
    for (let n = 0; n < retries; n++) {
      try {
        // 25 s per attempt: a blind user must never wait in silence.
        const result = await getModel(privacy, lang, cloudModel).generateContent(parts, { timeout: 25000 });
        const text = result.response.text().trim();
        const source = result.response.inferenceSource === InferenceSource.ON_DEVICE ? 'on_device' : 'in_cloud';
        return { text, source };
      } catch (e) {
        lastError = e;
        attempts.push(`${cloudModel}: ${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 90)}`);
        if (!fallbackWorthy(e)) break;
        if (retries > 1 && n === 0) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (!fallbackWorthy(lastError)) break;
  }
  lastError.attempts = attempts;
  throw lastError;
}
