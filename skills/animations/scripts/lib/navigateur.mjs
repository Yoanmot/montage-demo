// navigateur.mjs : ouvre une page HTML dans le Chrome de HyperFrames (le même que celui du rendu) et y exécute une
// fonction, par le protocole DevTools (WebSocket de Node 24), sans dépendance.
// Sert au contrôle des captions (meme-ligne.mjs) : la page est mesurée image par image avec ses vraies polices.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

let _chrome = null;
export function cheminChrome() {
  if (_chrome) return _chrome;
  const out = execFileSync('npx', ['--yes', 'hyperframes@0.7.55', 'browser', 'path'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  _chrome = out.trim().split('\n').filter((l) => l.trim().startsWith('/')).pop();
  if (!_chrome || !fs.existsSync(_chrome)) throw new Error(`NAVIGATEUR_INTROUVABLE : « npx hyperframes@0.7.55 browser path » n'a pas donné de Chrome (${out.trim()})`);
  return _chrome;
}

// Ouvre fichierHtml, attend fonction(arg) (texte d'une fonction asynchrone exécutée dans la page), renvoie sa valeur.
export async function dansLaPage(fichierHtml, fonction, arg, { largeur = 1080, hauteur = 1920, delai = 120000 } = {}) {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'captions-'));
  const chrome = spawn(cheminChrome(), ['--headless', '--remote-debugging-port=0', `--user-data-dir=${profil}`,
    '--allow-file-access-from-files', '--hide-scrollbars', '--mute-audio', '--no-first-run', `--window-size=${largeur},${hauteur}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  // Fermeture garantie (2026-11-14 : un chrome-headless-shell restait ouvert quand le script était interrompu) :
  // Chrome tourne dans son propre groupe de processus, tué en entier (processus de rendu et GPU compris) à la fin normale,
  // sur une erreur (finally), sur Ctrl+C, SIGTERM ou SIGHUP, et à la sortie de Node.
  let ferme = false;
  const fin = () => {
    if (ferme) return; ferme = true;
    try { process.kill(-chrome.pid, 'SIGKILL'); } catch {}
    try { chrome.kill('SIGKILL'); } catch {}
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch {}
  };
  const SIGNAUX = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  const surSignal = (sig) => { fin(); process.exit(sig === 'SIGINT' ? 130 : 143); };
  for (const sig of SIGNAUX) process.on(sig, surSignal);
  process.on('exit', fin);
  try {
    const wsNav = await new Promise((ok, ko) => {
      let buf = '';
      const t = setTimeout(() => ko(new Error('NAVIGATEUR_MUET : Chrome n\'a pas ouvert son port de contrôle')), 20000);
      chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); ok(m[1]); } });
      chrome.on('exit', (c) => ko(new Error(`NAVIGATEUR_ARRÊTÉ (code ${c})`)));
    });
    const port = new URL(wsNav).port;
    const cible = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = cible.find((c) => c.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = () => ko(new Error('NAVIGATEUR : connexion refusée')); });
    let id = 0;
    const attente = new Map(), evts = [];
    ws.onmessage = (m) => {
      const j = JSON.parse(m.data);
      if (j.id && attente.has(j.id)) { const [ok, ko] = attente.get(j.id); attente.delete(j.id); j.error ? ko(new Error(j.error.message)) : ok(j.result); }
      else if (j.method) evts.push(j);
    };
    const envoi = (method, params = {}) => new Promise((ok, ko) => { const k = ++id; attente.set(k, [ok, ko]); ws.send(JSON.stringify({ id: k, method, params })); });
    await envoi('Page.enable');
    await envoi('Runtime.enable');
    await envoi('Emulation.setDeviceMetricsOverride', { width: largeur, height: hauteur, deviceScaleFactor: 1, mobile: false });
    await envoi('Page.navigate', { url: pathToFileURL(path.resolve(fichierHtml)).href });
    const t0 = Date.now();
    while (!evts.some((e) => e.method === 'Page.loadEventFired')) {
      if (Date.now() - t0 > 30000) throw new Error('NAVIGATEUR : la page ne finit pas de charger');
      await new Promise((r) => setTimeout(r, 50));
    }
    const r = await Promise.race([
      envoi('Runtime.evaluate', { expression: `(${fonction})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true }),
      new Promise((_, ko) => setTimeout(() => ko(new Error('NAVIGATEUR : mesure trop longue')), delai)),
    ]);
    ws.close();
    if (r.exceptionDetails) throw new Error(`erreur dans la page : ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  } finally {
    fin();
    for (const sig of SIGNAUX) process.off(sig, surSignal);
    process.off('exit', fin);
  }
}
