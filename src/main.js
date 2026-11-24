import { speak, stopSpeaking, setRate, listen } from './speech.js';
import { classifyError } from './errors.js';

const $ = (id) => document.getElementById(id);
const useMock =
  import.meta.env.VITE_ENABLE_MOCK === 'true' || (import.meta.env.DEV && new URLSearchParams(location.search).has('mock'));
const backend = await (useMock ? import('./mock-ai.js') : import('./ai.js'));

const T = {
  en: {
    ready: 'Ready. Say or press Describe, Read, or Ask.',
    camErr: 'I could not open the camera. Please allow camera access and try again.',
    thinking: 'Looking…',
    onDevice: 'Answered on your device.',
    cloud: 'Answered in the cloud.',
    err: 'Sorry, something went wrong. Try again.',
    privNA: 'Private mode needs the on-device model, which is not available on this device yet. Switch to Automatic in Settings to use the cloud.',
    nothing: 'There is nothing to repeat yet.',
    askPrompt: 'Type your question, or press Speak question.',
    listening: 'Listening…',
    voicePriv: 'Voice input uses an online service, so it is off in Private mode. Please type your question.',
    downloading: (p) => `Preparing on-device AI, ${p} percent.`,
    noLocal: 'On-device AI is not available here. WayLens will use the cloud.',
    errors: {
      timeout: 'The AI took too long to answer. Try again in a moment.',
      quota: 'The AI usage limit was reached. Wait a minute and try again.',
      overloaded: 'The AI service is busy right now. Try again in a moment.',
      modelNotFound: 'The configured AI model is not available. The app needs a different model.',
      appCheck: 'The app could not verify itself with the server. The app setup needs checking.',
      blocked: 'The AI declined to describe this image. Try pointing the camera elsewhere.',
      network: 'I could not reach the server. Check your connection.',
      offline: 'You are offline and the on-device AI is not available. Reconnect and try again.',
      camera: 'There is a camera problem. Check camera permission.',
      privateUnavailable: 'Private mode needs the on-device model, which is not available on this device yet. Switch to Automatic in Settings to use the cloud.',
      unknown: 'Sorry, something went wrong. Try again.',
    },
  },
  es: {
    ready: 'Listo. Pulsa Describir, Leer o Preguntar.',
    camErr: 'No pude abrir la cámara. Permite el acceso a la cámara e inténtalo de nuevo.',
    thinking: 'Mirando…',
    onDevice: 'Respondido en tu dispositivo.',
    cloud: 'Respondido en la nube.',
    err: 'Lo siento, algo falló. Inténtalo de nuevo.',
    privNA: 'El modo privado necesita el modelo del dispositivo, que aún no está disponible. Cambia a Automático en Ajustes para usar la nube.',
    nothing: 'Todavía no hay nada que repetir.',
    askPrompt: 'Escribe tu pregunta o pulsa Hablar pregunta.',
    listening: 'Escuchando…',
    voicePriv: 'La voz usa un servicio en línea, por eso está desactivada en modo privado. Escribe tu pregunta.',
    downloading: (p) => `Preparando la IA del dispositivo, ${p} por ciento.`,
    noLocal: 'La IA del dispositivo no está disponible aquí. WayLens usará la nube.',
    errors: {
      timeout: 'La IA tardó demasiado en responder. Inténtalo de nuevo en un momento.',
      quota: 'Se alcanzó el límite de uso de la IA. Espera un minuto e inténtalo de nuevo.',
      overloaded: 'El servicio de IA está ocupado ahora. Inténtalo de nuevo en un momento.',
      modelNotFound: 'El modelo de IA configurado no está disponible. La app necesita otro modelo.',
      appCheck: 'La app no pudo verificarse con el servidor. Hay que revisar la configuración.',
      blocked: 'La IA no quiso describir esta imagen. Apunta la cámara a otro lugar.',
      network: 'No pude conectar con el servidor. Revisa tu conexión.',
      offline: 'Estás sin conexión y la IA del dispositivo no está disponible. Reconecta e inténtalo de nuevo.',
      camera: 'Hay un problema con la cámara. Revisa el permiso de la cámara.',
      privateUnavailable: 'El modo privado necesita el modelo del dispositivo, que aún no está disponible. Cambia a Automático en Ajustes para usar la nube.',
      unknown: 'Lo siento, algo falló. Inténtalo de nuevo.',
    },
  },
};

const state = { lang: 'en', privacy: false, last: '', stream: null, busy: false };
const t = (k, ...a) => (typeof T[state.lang][k] === 'function' ? T[state.lang][k](...a) : T[state.lang][k]);
const say = (msg, { speakIt = true } = {}) => { $('status').textContent = msg; if (speakIt) speak(msg, state.lang); };
const buzz = (ms = 30) => navigator.vibrate?.(ms);

function setNet() {
  const n = $('net');
  n.textContent = navigator.onLine ? 'online' : 'offline';
  n.className = 'badge ' + (navigator.onLine ? 'on' : 'off');
}
addEventListener('online', setNet); addEventListener('offline', setNet); setNet();

function captureFrame() {
  const v = $('cam');
  const scale = Math.min(1, 1024 / (v.videoWidth || 1024));
  const c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}

async function startCamera() {
  state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  const v = $('cam'); v.srcObject = state.stream; await v.play();
}

async function act(task, question) {
  if (state.busy) return;
  state.busy = true; buzz();
  const btns = document.querySelectorAll('#actions button'); btns.forEach((b) => b.setAttribute('aria-busy', 'true'));
  say(t('thinking'));
  try {
    const { text, source } = await backend.run({ task, imageBase64: captureFrame(), lang: state.lang, privacy: state.privacy, question });
    state.last = text;
    $('result').textContent = text;
    $('src').textContent = source === 'on_device' ? 'on device' : 'cloud';
    $('src').className = 'badge ' + (source === 'on_device' ? 'on' : '');
    const where = source === 'on_device' ? t('onDevice') : t('cloud');
    $('status').textContent = where;
    speak($('announce-src').checked ? `${text} ${where}` : text, state.lang);
    $('result').focus({ preventScroll: true });
  } catch (e) {
    console.error(e);
    const { key, detail } = classifyError(e, { privacy: state.privacy });
    const msg = T[state.lang].errors[key];
    speak(msg, state.lang);
    $('status').textContent = `${msg} [${detail}]`; // always visible, in yellow
  } finally {
    state.busy = false; btns.forEach((b) => b.removeAttribute('aria-busy'));
  }
}

async function prepare() {
  const ok = await backend.prepareOnDevice({
    privacy: state.privacy, lang: state.lang,
    onProgress: (p) => say(t('downloading', Math.round(p * 100)), { speakIt: false }),
  });
  return ok;
}

$('btn-start').addEventListener('click', async () => {
  try { await startCamera(); } catch (e) { const { key, detail } = classifyError(e); say(T[state.lang].errors[key === 'unknown' ? 'camera' : key]); $('status').textContent += ` [${detail}]`; return; }
  $('start').hidden = true; $('app').hidden = false;
  say(t('thinking'), { speakIt: false });
  const ok = await prepare();
  say(ok ? t('ready') : t('noLocal'));
  $('btn-describe').focus();
});

$('btn-describe').addEventListener('click', () => act('describe'));
$('btn-read').addEventListener('click', () => act('read'));
$('btn-ask').addEventListener('click', () => { $('ask-form').hidden = false; $('ask-input').focus(); say(t('askPrompt')); });
$('btn-ask-cancel').addEventListener('click', () => { $('ask-form').hidden = true; $('btn-ask').focus(); });
$('ask-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('ask-input').value.trim(); if (!q) return;
  $('ask-form').hidden = true; $('ask-input').value = ''; act('ask', q);
});
$('btn-voice').addEventListener('click', async () => {
  if (state.privacy) return say(t('voicePriv'));
  say(t('listening'));
  try { $('ask-input').value = await listen(state.lang); $('ask-form').requestSubmit(); } catch (e) { say(String(e.message)); }
});
$('btn-repeat').addEventListener('click', () => (state.last ? speak(state.last, state.lang) : say(t('nothing'))));
$('btn-stop').addEventListener('click', () => stopSpeaking());

$('lang').addEventListener('change', (e) => { state.lang = e.target.value; document.documentElement.lang = state.lang; });
$('mode').addEventListener('change', async (e) => { state.privacy = e.target.value === 'private'; await prepare(); });
$('rate').addEventListener('input', (e) => { setRate(+e.target.value); $('rate-out').textContent = (+e.target.value).toFixed(1); });

addEventListener('keydown', (e) => {
  if (!$('start').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.key === 'Escape') { stopSpeaking(); if (!$('ask-form').hidden) $('btn-ask-cancel').click(); return; }
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === 'd') $('btn-describe').click(); else if (k === 'r') $('btn-read').click();
  else if (k === 'a') { e.preventDefault(); $('btn-ask').click(); } else if (k === 'p') $('btn-repeat').click();
});
