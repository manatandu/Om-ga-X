#!/usr/bin/env node
'use strict';
/**
 * PREUVE, SUR VRAIE BASE, DES LIGNES LIBRES (ligne lettrage-verrou, relecture
 * du 2026-10-29, M3). Supprimer, modifier ou réimputer une écriture jugeait son
 * lettrage HORS de sa transaction · un lettrage validé entre ce contrôle et le
 * retrait des lignes laissait un groupe amputé de sa ligne, solde stocké faux.
 * Le script force l'entrelacement · la transaction du geste (sérialisable,
 * comme l'était `avecRetrySerialisable`, retirée le 2026-10-30) prend son image, un lettrage en lecture
 * validée pose `lettre` sur une ligne de l'écriture et se valide, puis le geste
 * appelle les fonctions COMPILÉES de `lignes-libres`. Attendu · le geste tombe
 * (409 nommé, ou 40001 que la reprise rejoue sur une image qui voit le
 * lettrage, puis 409), et la ligne lettrée est toujours là. Base JETABLE qui
 * porte des écritures non lettrées (après `rejouer-lettrage-concurrent.cjs`).
 *
 *   npm run build && DATABASE_URL=postgresql://... node scripts/rejouer-retrait-contre-lettrage.cjs
 */
const path = require('node:path');
const { PrismaClient, Prisma } = require(path.join(__dirname, '..', 'node_modules', '@prisma', 'client'));
const { retirerLesLignesLibres, retenirLesLignesLibres, MOTIF_LIGNE_TENUE_ENTRE_TEMPS } = require(
  path.join(__dirname, '..', 'dist', 'modules', 'comptabilite', 'lignes-libres.js'),
);
const url = process.env.DATABASE_URL;
if (!url || /neon\.tech|\.run\.app/i.test(url)) {
  console.error('DATABASE_URL doit pointer une base JETABLE.');
  process.exit(2);
}
const a = new PrismaClient({ datasources: { db: { url } } });
const b = new PrismaClient({ datasources: { db: { url } } });

const issueDe = (e) =>
  e && e.message === MOTIF_LIGNE_TENUE_ENTRE_TEMPS
    ? '409 nommé'
    : /40001|P2034|serializ/i.test(String(e && e.code) + (e && e.message))
      ? 'conflit 40001'
      : 'erreur ' + (e && e.message);

async function essai(nom, geste, ligne, isolation) {
  let relacher;
  const lu = new Promise((r) => (relacher = r));
  let fin;
  const lettre = new Promise((r) => (fin = r));
  const transaction = a
    .$transaction(
      async (tx) => {
        // L'image de la transaction se prend à sa première lecture.
        await tx.$queryRaw`SELECT 1 FROM "lignes_ecriture" WHERE id = ${ligne.id}`;
        relacher();
        await lettre;
        await geste(tx);
        throw new Error('le geste est passé sur une ligne lettrée');
      },
      { isolationLevel: isolation },
    )
    .then(
      () => 'validée',
      (e) => issueDe(e),
    );
  await lu;
  await b.$executeRaw`UPDATE "lignes_ecriture" SET "lettre" = 'ZZ' WHERE id = ${ligne.id}`;
  fin();
  const issue = await transaction;
  const apres = await b.ligneEcriture.findUnique({ where: { id: ligne.id } });
  await b.$executeRaw`UPDATE "lignes_ecriture" SET "lettre" = NULL WHERE id = ${ligne.id}`;
  const ok = (issue === '409 nommé' || issue === 'conflit 40001') && apres && apres.lettre === 'ZZ';
  console.log(`${ok ? 'VERT ' : 'ROUGE'} · ${nom} (${isolation}) · issue : ${issue} · ligne ${apres ? 'toujours là' : 'RETIRÉE'}`);
  return ok;
}

// LA FENÊTRE RÉELLE · le contrôle se faisait AVANT la transaction ; un lettrage
// validé entre les deux est déjà dans l'image du geste. L'ancienne forme (retrait
// sans filtre) l'emportait en silence ; le témoin le montre, puis l'annule.
async function avantLaTransaction(nom, geste, ligne, isolation, attendu) {
  await b.$executeRaw`UPDATE "lignes_ecriture" SET "lettre" = 'ZZ' WHERE id = ${ligne.id}`;
  let parti = false;
  const issue = await a
    .$transaction(
      async (tx) => {
        await geste(tx);
        parti = !(await tx.ligneEcriture.findUnique({ where: { id: ligne.id } }));
        throw new Error('annulé par le témoin');
      },
      { isolationLevel: isolation },
    )
    .then(
      () => 'validée',
      (e) => (e.message === 'annulé par le témoin' ? (parti ? 'ligne lettrée RETIRÉE' : 'passé sans la retirer') : issueDe(e)),
    );
  await b.$executeRaw`UPDATE "lignes_ecriture" SET "lettre" = NULL WHERE id = ${ligne.id}`;
  const ok = issue === attendu;
  console.log(`${ok ? 'VERT ' : 'ROUGE'} · ${nom} (${isolation}) · issue : ${issue} · attendu : ${attendu}`);
  return ok;
}

(async () => {
  const ligne = await a.ligneEcriture.findFirst({
    where: { lettrageId: null, lettre: null, rapprochementId: null, ecriture: { statut: 'VALIDEE' } },
    include: { ecriture: { select: { tenantId: true } } },
  });
  if (!ligne) throw new Error('aucune ligne libre validée dans la base');
  const tenantId = ligne.ecriture.tenantId;
  const R = Prisma.TransactionIsolationLevel;
  const resultats = [];
  for (const isolation of [R.Serializable, R.ReadCommitted]) {
    resultats.push(await essai('retrait des lignes (supprimer, modifier)', (tx) => retirerLesLignesLibres(tx, tenantId, ligne.ecritureId), ligne, isolation));
    resultats.push(await essai('rétention des lignes validées (réimputer)', (tx) => retenirLesLignesLibres(tx, tenantId, [ligne.id]), ligne, isolation));
  }
  resultats.push(
    await avantLaTransaction(
      'TÉMOIN · ancien retrait sans filtre',
      (tx) => tx.ligneEcriture.deleteMany({ where: { ecritureId: ligne.ecritureId, ecriture: { tenantId } } }),
      ligne,
      R.Serializable,
      'ligne lettrée RETIRÉE',
    ),
  );
  resultats.push(await avantLaTransaction('retrait des lignes libres', (tx) => retirerLesLignesLibres(tx, tenantId, ligne.ecritureId), ligne, R.Serializable, '409 nommé'));
  resultats.push(await avantLaTransaction('rétention des lignes validées', (tx) => retenirLesLignesLibres(tx, tenantId, [ligne.id]), ligne, R.Serializable, '409 nommé'));
  await a.$disconnect();
  await b.$disconnect();
  const vert = resultats.every(Boolean);
  console.log(vert ? 'PREUVE VERTE' : 'PREUVE ROUGE');
  process.exit(vert ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
