// « Télécharger la vidéo » (19/11) : la vidéo montée la plus récente est copiée dans Téléchargements, pour la
// poster soi-même (AirDrop vers l'iPhone, appli Instagram). La copie porte la marque « téléchargé » de macOS
// (kMDItemWhereFroms) : le rangement ignore ces fichiers, elle ne revient donc jamais dans « À ranger » même
// quand Téléchargements est le dossier des arrivées. Puis le Finder la montre, sélectionnée.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { estMonte } from "./stades.mjs";
import { executer } from "./commandes.mjs";

// plistlib.dumps(["Studio"], fmt=FMT_BINARY) : la provenance, comme un navigateur l'écrit.
const PROVENANCE = "62706c6973743030a1015653747564696f080a0000000000000101000000000000000200000000000000000000000000000011";

export function videoMontee(config, slug) {
  const dir = path.join(config.media, slug, "face");
  let noms = [];
  try { noms = fs.readdirSync(dir).filter(estMonte); } catch { return null; }
  const avec = noms.map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t);
  return avec.length ? path.join(dir, avec[0].n) : null;
}

function nomLibre(dossier, base) {
  let nom = `${base}.mp4`;
  for (let i = 2; fs.existsSync(path.join(dossier, nom)); i += 1) nom = `${base}-${i}.mp4`;
  return nom;
}

export async function telechargerVideo(config, slug, { montrer = true } = {}) {
  const source = videoMontee(config, slug);
  if (!source) return null;
  const dossier = path.join(config.maison || os.homedir(), "Downloads");
  fs.mkdirSync(dossier, { recursive: true });
  const nom = nomLibre(dossier, slug);
  const cible = path.join(dossier, nom);
  const partiel = path.join(dossier, `.${nom}.partiel`);
  await fs.promises.copyFile(source, partiel, fs.constants.COPYFILE_FICLONE);
  // Marque posée avant que le fichier porte son vrai nom : le rangement ne le voit jamais sans elle.
  const x = await executer("xattr", ["-wx", "com.apple.metadata:kMDItemWhereFroms", PROVENANCE, partiel], { delaiMs: 15000 });
  if (x.code !== 0) { fs.rmSync(partiel, { force: true }); throw new Error("provenance impossible à poser"); }
  fs.renameSync(partiel, cible);
  if (montrer) await executer("open", ["-R", cible], { delaiMs: 15000 });
  return { nom, chemin: cible };
}
