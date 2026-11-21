// Tests du skill carrousel (pleine qualité des slides) : node --test skills/carrousel/tests/*.test.mjs
// Un vrai rendu (PowerShell, ffmpeg, sips, Chrome) ; sauté si un de ces outils manque.
// - une slide sort en PNG 1080 x 1350, sans transparence, dans les couleurs exactes de la DA ;
// - une photo HEIC d'iPhone (profil Display P3, image tournée) garde ses couleurs (converties en sRGB comme le
//   fait le Mac, pas lues comme du sRGB, plus ternes) et son sens ;
// - une photo JPEG/PNG en Display P3 est convertie de même par le navigateur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(ICI, "..", "scripts", "carrousel.ps1");
const P3 = "/System/Library/ColorSync/Profiles/Display P3.icc";
const SRGB = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EDGE = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";

const existe = (cmd) => spawnSync("/bin/sh", ["-c", `command -v ${cmd}`]).status === 0;
const manque = !existe("pwsh") ? "pwsh absent" : !existe("ffmpeg") ? "ffmpeg absent"
  : !fs.existsSync("/usr/bin/sips") || !fs.existsSync(P3) ? "pas un Mac (sips)"
  : !fs.existsSync(CHROME) && !fs.existsSync(EDGE) ? "navigateur absent" : false;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  assert.equal(r.status, 0, `${cmd} ${args.join(" ")}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

// Un pixel lu tel qu'il est écrit dans le fichier (ffmpeg n'applique aucun profil de couleur).
function pixel(f, x, y) {
  const r = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-i", f, "-vf", `crop=1:1:${x}:${y}`, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  assert.equal(r.status, 0, String(r.stderr));
  return [...r.stdout.subarray(0, 3)];
}
const proche = (a, b, tol) => a.every((v, k) => Math.abs(v - b[k]) <= tol);

// Une image unie en couleur c (valeurs Display P3), w x h, écrite en PNG 8 bits RVB.
function pngUni(f, w, h, c) {
  run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i",
    `color=c=0x${c.map((v) => v.toString(16).padStart(2, "0")).join("")}:s=${w}x${h}`, "-frames:v", "1", "-pix_fmt", "rgb24", f]);
}

// Un PNG avec l'orientation EXIF 6 : un bloc eXIf (TIFF, une entrée 0x0112 = 6) juste après l'en-tête IHDR.
function orientation6(png) {
  const tiff = Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0]);
  const type = Buffer.from("eXIf");
  const taille = Buffer.alloc(4); taille.writeUInt32BE(tiff.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([type, tiff])) >>> 0);
  const finIHDR = 8 + 8 + png.readUInt32BE(8) + 4;
  return Buffer.concat([png.subarray(0, finIHDR), taille, type, tiff, crc, png.subarray(finIHDR)]);
}

// Un HEIC comme ceux de l'iPhone : la couleur dite par un bloc « nclx » (primaires Display P3, codes 12/13/6) et
// non par un profil ICC (sips écrit un profil, que ffmpeg savait déjà garder). Le bloc colr garde sa taille
// (complété de zéros) : aucun décalage dans le fichier.
function commeIphone(heic) {
  const i = heic.indexOf("colrprof");
  assert.ok(i > 4, "bloc colr du HEIC introuvable");
  const debut = i - 4, taille = heic.readUInt32BE(debut);
  const bloc = Buffer.alloc(taille);
  bloc.writeUInt32BE(taille, 0); bloc.write("colrnclx", 4, "latin1");
  bloc.writeUInt16BE(12, 12); bloc.writeUInt16BE(13, 14); bloc.writeUInt16BE(6, 16); bloc.writeUInt8(0x80, 18);
  return Buffer.concat([heic.subarray(0, debut), bloc, heic.subarray(debut + taille)]);
}

test("slides pleine qualité : PNG 1080x1350, couleurs exactes ; photo HEIC P3 tournée et photo P3 gardent couleurs et sens",
  { skip: manque, timeout: 240000 }, () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "carrousel-qualite-"));
    try {
      const A = [60, 160, 90], B = [200, 120, 60];   // deux couleurs P3 dans le gamut sRGB
      // Mire vue droite : 400 x 500 (4:5), haut en A, bas en B. Stockée couchée (500 x 400) avec l'orientation 6
      // (« tourner de 90° à droite pour l'afficher »), comme un iPhone tenu en portrait.
      const haut = path.join(d, "haut.png"), bas = path.join(d, "bas.png"), droite = path.join(d, "droite.png");
      pngUni(haut, 400, 250, A); pngUni(bas, 400, 250, B);
      run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", haut, "-i", bas, "-filter_complex", "vstack", "-frames:v", "1", droite]);
      const couchee = path.join(d, "couchee.png");
      run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", droite, "-vf", "transpose=2", "-frames:v", "1", couchee]);
      // L'orientation 6 en EXIF, puis le profil P3, puis HEIC (sips écrit la rotation dans le HEIC).
      const exif = path.join(d, "couchee-exif.png");
      fs.writeFileSync(exif, orientation6(fs.readFileSync(couchee)));
      const p3png = path.join(d, "photo-p3.png");
      run("/usr/bin/sips", ["-e", P3, exif, "--out", p3png]);
      const heic = path.join(d, "IMG_0001.HEIC");
      run("/usr/bin/sips", ["-s", "format", "heic", p3png, "--out", heic]);
      fs.writeFileSync(heic, commeIphone(fs.readFileSync(heic)));
      assert.match(run("ffprobe", ["-v", "error", "-show_entries", "stream=color_primaries", "-of", "csv=p=0", heic]), /smpte432/);
      // Une photo PNG P3 droite (sans rotation) pour le chemin « JPEG/PNG copiés tels quels ».
      const p3droite = path.join(d, "droite-p3.png");
      run("/usr/bin/sips", ["-e", P3, droite, "--out", p3droite]);

      // Les couleurs attendues : A et B convertis de P3 en sRGB par le Mac.
      const attendu = (c) => {
        const u = path.join(d, `u-${c.join("-")}.png`), t = path.join(d, `t-${c.join("-")}.png`), s = path.join(d, `s-${c.join("-")}.png`);
        pngUni(u, 8, 8, c);
        run("/usr/bin/sips", ["-e", P3, u, "--out", t]);
        run("/usr/bin/sips", ["-m", SRGB, t, "--out", s]);
        return pixel(s, 4, 4);
      };
      const eA = attendu(A), eB = attendu(B);
      assert.ok(!proche(eA, A, 6), `la mire doit distinguer P3 et sRGB (A ${A} -> ${eA})`);

      const c = path.join(d, "carrousel");
      fs.mkdirSync(c);
      fs.writeFileSync(path.join(c, "carrousel.json"), JSON.stringify({ style: "etiquettes", format: "4:5", pied: false, slides: [
        { photo: heic, titre: "Essai", position: "centre" },
        { photo: p3droite, titre: "Essai", position: "centre" },
        { fond: "noir", style: "texte", titre: "Essai *orange*", texte: "Texte fin." },
      ] }));
      const env = { ...process.env, STUDIO_RACINE: d };
      run("pwsh", ["-NoProfile", "-File", SCRIPT, "rendre", c], { env, timeout: 200000 });

      for (const n of ["01", "02", "03"]) {
        const f = path.join(c, `slide-${n}.png`);
        const info = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,pix_fmt", "-of", "csv=p=0", f]).trim();
        assert.equal(info, "png,1080,1350,rgb24", `slide ${n} : ${info}`);
      }
      // HEIC : sens (haut A, bas B) et couleurs converties, pas les valeurs P3 brutes.
      const s1 = path.join(c, "slide-01.png");
      for (const [x, y, e, nom] of [[40, 200, eA, "haut gauche"], [1040, 200, eA, "haut droit"], [40, 1150, eB, "bas gauche"], [1040, 1150, eB, "bas droit"]]) {
        const p = pixel(s1, x, y);
        assert.ok(proche(p, e, 4), `HEIC ${nom} : ${p} au lieu de ${e}`);
      }
      assert.ok(fs.existsSync(path.join(c, "_rendu", "photo-01.png")), "la photo HEIC convertie en PNG sans perte");
      // PNG P3 copié tel quel : le navigateur applique son profil.
      const s2 = path.join(c, "slide-02.png");
      assert.ok(proche(pixel(s2, 40, 200), eA, 4), `PNG P3 haut : ${pixel(s2, 40, 200)} au lieu de ${eA}`);
      assert.ok(proche(pixel(s2, 40, 1150), eB, 4), `PNG P3 bas : ${pixel(s2, 40, 1150)} au lieu de ${eB}`);
      // Fond de la DA exact (#111111).
      assert.deepEqual(pixel(path.join(c, "slide-03.png"), 5, 5), [17, 17, 17]);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });
