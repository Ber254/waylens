// DEV ONLY: fake backend to try the UI without a Firebase project or Gemini Nano.
// Enabled with ?mock=1 in dev, or VITE_ENABLE_MOCK=true. Not used by the real app path.
export async function prepareOnDevice({ onProgress }) {
  for (const p of [0.3, 0.7, 1]) { await new Promise((r) => setTimeout(r, 80)); onProgress?.(p); }
  return true;
}
export async function run({ task, lang, privacy, question }) {
  await new Promise((r) => setTimeout(r, 150));
  const offline = !navigator.onLine;
  if (privacy || offline) {
    return { text: `[mock ${task}] Answered locally. ${question ?? ''}`.trim(), source: 'on_device' };
  }
  return { text: `[mock ${task}] Answered by the cloud (${lang}). ${question ?? ''}`.trim(), source: 'in_cloud' };
}
