let rate = 1;
export const setRate = (r) => { rate = r; };

export function speak(text, lang) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'es' ? 'es-ES' : 'en-US';
  u.rate = rate;
  speechSynthesis.speak(u);
}
export const stopSpeaking = () => 'speechSynthesis' in window && speechSynthesis.cancel();

/** Chrome's SpeechRecognition streams audio to a Google service, so callers must not use it in Private mode. */
export function listen(lang) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return Promise.reject(new Error('Voice input is not supported in this browser.'));
  return new Promise((resolve, reject) => {
    const r = new SR();
    r.lang = lang === 'es' ? 'es-ES' : 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => resolve(e.results[0][0].transcript);
    r.onerror = (e) => reject(new Error(e.error || 'Voice input failed.'));
    r.onnomatch = () => reject(new Error('I did not catch that.'));
    r.start();
  });
}
