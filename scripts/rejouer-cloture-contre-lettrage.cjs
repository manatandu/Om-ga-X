#!/usr/bin/env node
'use strict';
/**
 * PREUVE, SUR VRAIE BASE, DE LA MARQUE DES EXERCICES OUVERTS (ligne
 * lettrage-verrou, relecture du 2026-10-29, BLOQUANT 1). Une CLÔTURE
 * sérialisable fige son image et lit une ligne non lettrée ; un LETTRAGE en
 * lecture validée se valide pendant ce temps ; la clôture écrit son exercice.
 * Sans la marque (`marquerLesExercicesOuverts`), elle se valide sur sa lecture
 * périmée et reporterait la ligne ouverte en N+1 ; avec elle, elle tombe en
 * 40001, que `avecRetrySerialisable` rejoue. Base JETABLE qui porte déjà un
 * exercice 2026 ouvert avec une ligne non lettrée (après
 * `rejouer-lettrage-concurrent.cjs`, par exemple).
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-cloture-contre-lettrage.cjs
 */
const { PrismaClient, Prisma } = require(require('node:path').join(__dirname, '..', 'node_modules', '@prisma', 'client'));
const url = process.env.DATABASE_URL;
const a = new PrismaClient({ datasources: { db: { url } } });
const b = new PrismaClient({ datasources: { db: { url } } });
async function essai(avecMarque) {
  const ex = await a.exercice.findFirst({ where: { statut: 'OUVERT', dateDebut: { gte: new Date('2026-01-01'), lt: new Date('2026-01-02') } } });
  const ligne = await a.ligneEcriture.findFirst({ where: { lettrageId: null, ecriture: { exerciceId: ex.id } } });
  let lettreVue = 'nonlu', issue;
  let relacher; const lu = new Promise((r) => (relacher = r)); let fin; const ecrit = new Promise((r) => (fin = r));
  const cloture = a.$transaction(async (tx) => {
    const l = await tx.$queryRaw`SELECT "lettrageId" FROM "lignes_ecriture" WHERE id = ${ligne.id}`;
    lettreVue = l[0].lettrageId; relacher(); await ecrit;
    await tx.$executeRaw`UPDATE "exercices" SET "statut" = "statut" WHERE id = ${ex.id}`;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then(() => 'validée', (e) => (/40001|P2034|serializ/i.test(String(e.code) + e.message) ? 'conflit 40001' : 'erreur ' + e.message));
  await lu;
  await b.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE "lignes_ecriture" SET "lettre" = 'ZZ' WHERE id = ${ligne.id}`;
    if (avecMarque) await tx.$executeRaw`UPDATE "exercices" SET "statut" = "statut" WHERE "tenantId" = ${ex.tenantId} AND "statut" = 'OUVERT'::"StatutExercice"`;
  });
  fin(); issue = await cloture;
  await b.ligneEcriture.update({ where: { id: ligne.id }, data: { lettre: null } });
  console.log(`${avecMarque ? 'avec la marque  ' : 'sans la marque  '} · la clôture lisait lettrageId=${lettreVue} · issue : ${issue}`);
}
if (!url || /neon\.tech|\.run\.app/i.test(url)) { console.error('DATABASE_URL doit pointer une base JETABLE.'); process.exit(2); }
let echec = false;
const essaiVerifie = async (m, attendu) => { const avant = console.log; let ligne = ''; console.log = (x) => { ligne = x; avant(x); }; await essai(m); console.log = avant; if (!ligne.includes(attendu)) echec = true; };
(async () => { await essaiVerifie(false, 'validée'); await essaiVerifie(true, 'conflit 40001'); await a.$disconnect(); await b.$disconnect(); console.log(echec ? 'PREUVE ROUGE' : 'PREUVE VERTE'); process.exit(echec ? 1 : 0); })();
