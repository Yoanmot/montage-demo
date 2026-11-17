// Lancer une commande (git, python3, node) et attendre sa fin par son PID, dans son propre
// groupe de processus (tué par groupe au délai ou à l'arrêt du serveur).
import { spawn } from "node:child_process";

const enCours = new Set();

export function executer(commande, args, { cwd, env = process.env, delaiMs = 120000, entree } = {}) {
  return new Promise((resolve) => {
    let enfant;
    try {
      enfant = spawn(commande, args, { cwd, env, detached: true, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      resolve({ code: -1, sortie: "", erreurs: String(e.message || e), introuvable: true });
      return;
    }
    enCours.add(enfant);
    let sortie = "";
    let erreurs = "";
    let fini = false;
    const minuterie = setTimeout(() => tuer(enfant), delaiMs);
    enfant.stdout.setEncoding("utf8");
    enfant.stderr.setEncoding("utf8");
    enfant.stdout.on("data", (d) => { sortie += d; });
    enfant.stderr.on("data", (d) => { erreurs = (erreurs + d).slice(-20000); });
    enfant.stdin.on("error", () => {});
    if (entree) enfant.stdin.write(entree);
    enfant.stdin.end();
    const terminer = (code, introuvable = false) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuterie);
      enCours.delete(enfant);
      resolve({ code, sortie, erreurs, introuvable });
    };
    enfant.on("error", (e) => terminer(-1, e.code === "ENOENT"));
    enfant.on("close", (code) => terminer(code ?? -1));
  });
}

function tuer(enfant, signal = "SIGTERM") {
  try {
    process.kill(-enfant.pid, signal);
  } catch {
    try { enfant.kill(signal); } catch { /* déjà fini */ }
  }
}

export function toutTuer() {
  for (const e of enCours) tuer(e, "SIGTERM");
}

// Dernière ligne utile d'un outil du dépôt : « OK ... » ou « BLOQUE <CODE> ... » (contrat, section 4).
export function lireVerdict(sortie) {
  const lignes = String(sortie || "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lignes.length - 1; i >= 0; i--) {
    const l = lignes[i];
    if (/^OK\b/.test(l)) {
      const champs = {};
      for (const m of l.matchAll(/(\w+)=("[^"]*"|\S+)/g)) champs[m[1]] = m[2].replace(/^"|"$/g, "");
      return { ok: true, champs, ligne: l };
    }
    const b = /^BLOQUE\s+([A-Z0-9_]+)\s*(.*)$/.exec(l);
    if (b) return { ok: false, code: b[1], message: b[2].trim(), ligne: l };
  }
  return null;
}
