import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { API, FENETRE_EN_ERREUR, MOT_DE_PASSE, appelApi, creerDossier, seConnecter, surveiller } from './outils';

/**
 * LE SERVEUR REFUSE CE QUI N'EST PAS ATTRIBUÉ, ET RIEN DE CE QUI L'EST
 * (ligne commercial-site, 2026-11-01). Un collaborateur restreint à UN
 * logiciel ouvre chacune des commandes de ce logiciel, et aucune réponse ne
 * doit être le refus des logiciels (« ne vous est pas attribué ») ni une
 * panne · c'est la preuve, sur le serveur réel et une vraie base, que la table
 * `src/common/logiciels/logiciels-des-routes.ts` ne casse aucun écran
 * attribué. Puis la contre-épreuve · la route d'un autre logiciel lui est
 * refusée, lecture comprise, en 403 nommé, et l'administrateur passe.
 *
 * Les chemins des tuiles sont LUS dans `client/src/lib/logiciels.ts`, jamais
 * recopiés. Un 403 d'un autre motif (route réservée à l'administrateur) est
 * une réponse du rôle, pas un défaut de cette ligne.
 */
const source = readFileSync(join(__dirname, '../../client/src/lib/logiciels.ts'), 'utf8');
const TUILES = new Map(
  [...source.matchAll(/cle: '(\w+)',[\s\S]*?chemins: \[([\s\S]*?)\]/g)].map((m) => [m[1], [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])]),
);
const REFUS_LOGICIEL = /ne vous (est|sont) pas attribués?|n'est rattachée à aucun logiciel/;

test('le relevé lit encore les tuiles', () => {
  expect(TUILES.size).toBe(9);
  expect(TUILES.get('PAIE')).toContain('/personnel');
});

async function connecterCollaborateur(page: Page, email: string, motDePasse: string) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', motDePasse);
  await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
  // Un seul logiciel attribué · on y entre directement, sans écran ; une
  // tuile que le dossier ne sert pas montre l'écran avec son motif.
  await expect(
    page.getByRole('button', { name: 'Fichier', exact: true }).or(page.getByRole('region', { name: 'Choix du logiciel' })).first(),
  ).toBeVisible();
}

for (const referentiel of ['SYSCOHADA', 'SYCEBNL'] as const) {
  test(`${referentiel} · un collaborateur restreint à un logiciel ouvre chacune de ses commandes sans refus`, async ({ page, browser }) => {
    test.setTimeout(900_000);
    const pannes = surveiller(page);
    const dossier = await creerDossier(page, { referentiel, nom: `Logiciels refus e2e ${referentiel}`, montant: 1_000 });
    await seConnecter(page, dossier.email);
    await appelApi(page, 'PATCH', '/dossier/modules', { modulesActives: ['PAIE', 'REVISION', 'GESTION_COMMERCIALE', 'CONSOLIDATION', 'IFRS'] });

    const email = `e2e-refus-${referentiel.toLowerCase()}-${Date.now()}@exemple.cd`;
    const motDePasse = `${MOT_DE_PASSE}-r`;
    const cree = await appelApi<{ id: string }>(page, 'POST', '/utilisateurs', { email, motDePasse: MOT_DE_PASSE, role: 'COMPTABLE' });
    const contexte = await browser.newContext();
    const autre = await contexte.newPage();
    const entetes = { 'X-Forwarded-For': `10.251.${Date.now() % 250}.7` };
    await autre.setExtraHTTPHeaders(entetes);
    await autre.goto('/');
    await appelApi(autre, 'POST', '/auth/login', { email, motDePasse: MOT_DE_PASSE });
    await appelApi(autre, 'POST', '/auth/changer-mot-de-passe', { motDePasseActuel: MOT_DE_PASSE, nouveauMotDePasse: motDePasse });
    await appelApi(autre, 'POST', '/auth/logout');
    const pannesAutre = surveiller(autre);

    const refus: string[] = [];
    let cheminCourant = '';
    autre.on('response', async (r) => {
      if (!r.url().startsWith(API) || r.status() !== 403) return;
      const corps = await r.text().catch(() => '');
      if (REFUS_LOGICIEL.test(corps)) refus.push(`${cheminCourant} · ${r.request().method()} ${r.url().slice(API.length)}`);
    });

    const croix = autre.locator('button[aria-label^="Fermer "]');
    const enErreur: string[] = [];
    for (const [cle, chemins] of TUILES) {
      // L'attribution ferme les sessions · le collaborateur se reconnecte.
      await appelApi(page, 'PUT', `/utilisateurs/${cree.id}/logiciels`, { restreindre: true, logiciels: [cle] });
      await autre.waitForTimeout(1_100);
      await connecterCollaborateur(autre, email, motDePasse);
      for (const chemin of [...new Set(chemins)]) {
        cheminCourant = `${cle} ${chemin}`;
        await autre.goto(`/#${chemin}`);
        await croix.first().waitFor({ timeout: 5_000 }).catch(() => undefined);
        await autre.getByText('Chargement…', { exact: true }).first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);
        await autre.waitForLoadState('networkidle');
        if ((await autre.getByText(FENETRE_EN_ERREUR).count()) > 0) enErreur.push(cheminCourant);
        for (let i = 0; i < 10; i++) {
          const ouvertes = await croix.count();
          if (ouvertes === 0) break;
          await croix.first().click({ timeout: 5_000 }).catch(() => undefined);
          await expect(croix).toHaveCount(ouvertes - 1, { timeout: 5_000 }).catch(() => undefined);
        }
      }
    }

    // Contre-épreuve · restreint à la paie, la balance lui est refusée, nommée.
    await appelApi(page, 'PUT', `/utilisateurs/${cree.id}/logiciels`, { restreindre: true, logiciels: ['PAIE'] });
    await autre.waitForTimeout(1_100);
    await appelApi(autre, 'POST', '/auth/login', { email, motDePasse });
    const lecture = await appelApi(autre, 'GET', `/ecritures/balance?exerciceId=${dossier.exerciceId}`).then(
      () => 'servie',
      (e: Error) => e.message,
    );
    expect(lecture).toMatch(/403 .*« Comptabilité ».*ne vous est pas attribué/);
    // Ce que la paie lit d'un autre logiciel reste servi.
    await appelApi(autre, 'GET', '/journaux');
    // L'administrateur, lui, n'est jamais restreint.
    await appelApi(page, 'GET', `/ecritures/balance?exerciceId=${dossier.exerciceId}`);

    await contexte.close();
    expect(refus, 'refus des logiciels sur un écran attribué').toEqual([]);
    expect(enErreur, 'fenêtres en erreur').toEqual([]);
    expect([...pannes, ...pannesAutre], 'exceptions et réponses 5xx').toEqual([]);
  });
}
