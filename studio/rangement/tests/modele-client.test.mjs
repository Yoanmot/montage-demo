// Modèle du regard sur les vignettes par client (19/11/2026) : la config d'abord, puis le fichier du client, puis
// sonnet (clé absente) ou rien (null). STUDIO_CLIENT est posé avant l'import : le module lit son client une fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.STUDIO_CLIENT = 'yoan';
const { lireConfig } = await import('../lib/commun.mjs');

test('lireConfig chez Yoan : opus pour le rangement et les sessions quand la config ne fixe rien', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-rangement-yoan-'));
  try {
    const f = path.join(d, 'studio.config.json');
    fs.writeFileSync(f, JSON.stringify({ depot_hoc: d, claude: { binaire: 'claude', modele: null, modele_rangement: null } }));
    assert.equal(lireConfig(f).claude.modeleRangement, 'opus');
    assert.equal(lireConfig(f).claude.modele, 'opus');
    fs.writeFileSync(f, JSON.stringify({ depot_hoc: d }));
    assert.equal(lireConfig(f).claude.modeleRangement, 'opus');
    fs.writeFileSync(f, JSON.stringify({ depot_hoc: d, claude: { modele_rangement: 'haiku' } }));
    assert.equal(lireConfig(f).claude.modeleRangement, 'haiku', 'la config fixe : elle gagne');
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});
