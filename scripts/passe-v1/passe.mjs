#!/usr/bin/env node
/**
 * PASSE DE LA VERSION 1 · les trois dossiers types du plan
 * (docs/plan-version-1.md, § 2) tenus sur deux exercices complets, clôtures
 * comprises, par l'API du serveur compilé, sur une base PostgreSQL JETABLE.
 *
 * Chaque contrôle compare un montant LU à un montant ATTENDU calculé à la main
 * (README.md) et dit « concorde » ou « écart » (attendu, lu, différence). Le
 * banc ne s'arrête jamais au premier écart · un geste refusé est consigné avec
 * son statut et son corps, et le scénario continue avec ce qu'il peut.
 *
 * Usage · OMEGAX_API=http://localhost:8745 node scripts/passe-v1/passe.mjs [sortie.json]
 * PASSE_SCENARIOS=projet,association,sarl ne joue que les scénarios nommés.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { BASE, Registre } from './lib.mjs';
import { scenarioProjet } from './scenario-projet.mjs';
import { scenarioAssociation } from './scenario-association.mjs';
import { scenarioSarl } from './scenario-sarl.mjs';
import { scenarioCloisonnement } from './scenario-cloisonnement.mjs';

const SCENARIOS = { association: scenarioAssociation, projet: scenarioProjet, sarl: scenarioSarl, cloisonnement: scenarioCloisonnement };
const choisis = (process.env.PASSE_SCENARIOS ?? 'association,projet,sarl,cloisonnement').split(',').map((s) => s.trim()).filter(Boolean);

const registre = new Registre();
const sante = await fetch(`${BASE}/health`).then((r) => r.json()).catch((e) => ({ erreur: e.message }));
console.log(`Passe V1 · serveur ${BASE} · santé ${JSON.stringify(sante)}`);

for (const nom of choisis) {
  // Un scénario hors de la table se charge par son fichier,
  // `scenario-<nom>.mjs`, qui exporte sa fonction par défaut · ajouter un
  // scénario ne touche plus ce lanceur (simulation du logiciel complet).
  let fn = SCENARIOS[nom];
  if (!fn) {
    try {
      fn = (await import(`./scenario-${nom}.mjs`)).default;
    } catch (e) {
      registre.scenario = nom;
      registre.note(`Scénario ${nom} introuvable ou illisible · ${e.message}`);
    }
  }
  if (!fn) {
    console.log(`Scénario inconnu · ${nom}`);
    continue;
  }
  console.log(`\n=== Scénario ${nom} ===`);
  const debut = Date.now();
  try {
    await fn(registre);
  } catch (e) {
    registre.scenario = nom;
    registre.note(`Scénario ${nom} interrompu · ${e.stack ?? e.message}`);
  }
  console.log(`=== ${nom} · ${Math.round((Date.now() - debut) / 1000)} s ===`);
}

const bilan = registre.bilan();
console.log('\n=== BILAN ===');
console.log(`Contrôles · ${bilan.nombreControles} · concordances ${bilan.concordances} · écarts ${bilan.nombreEcarts} · erreurs HTTP ${bilan.nombreErreursHttp} · notes ${bilan.notes.length}`);
for (const s of choisis) {
  const c = bilan.controles.filter((x) => x.scenario.toLowerCase().startsWith(s.slice(0, 4)));
  const e = c.filter((x) => x.verdict !== 'concorde');
  const h = bilan.erreursHttp.filter((x) => x.scenario.toLowerCase().startsWith(s.slice(0, 4)));
  console.log(`  ${s} · ${c.length} contrôles, ${e.length} écarts, ${h.length} erreurs HTTP`);
}
if (bilan.nombreEcarts) {
  console.log('\nÉcarts ·');
  for (const e of bilan.ecarts) console.log(`  [${e.scenario}] ${e.libelle} · attendu ${JSON.stringify(e.attendu)}, lu ${JSON.stringify(e.lu)}${e.difference !== null ? `, différence ${e.difference}` : ''}`);
}
if (bilan.nombreErreursHttp) {
  console.log('\nErreurs HTTP ·');
  for (const e of bilan.erreursHttp) console.log(`  [${e.scenario}] ${e.geste} · ${e.methode} ${e.chemin} · ${e.statut} · ${JSON.stringify(e.corps).slice(0, 400)}`);
}
const sortie = process.argv[2];
if (sortie) {
  mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, JSON.stringify(bilan, null, 2));
  console.log(`\nBilan écrit · ${sortie}`);
}
