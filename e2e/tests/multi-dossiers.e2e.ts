import { createServer, type Server } from 'node:net';
import { expect, test } from '@playwright/test';
import { MOT_DE_PASSE, appelApi, creerDossier, entrerDansUnLogiciel, surveiller } from './outils';

/**
 * UNE PERSONNE, PLUSIEURS DOSSIERS (ligne multi-dossiers, 2026-11-01, gel levé
 * par Manasse · « Enchaîne le point 3 et 4 »).
 *
 * Une adresse qui a déjà un compte n'entre dans un autre dossier que par une
 * INVITATION qu'elle accepte (relecture de sécurité, C1 et E1) · le courriel
 * porte le code, la personne l'accepte avec SA session. Le job
 * `tests-navigateur.yml` n'a AUCUNE messagerie · en ligne, l'adresse connue y
 * est donc refusée « messagerie requise », sans rien créer, et c'est ce que le
 * premier parcours gèle. Le parcours complet monte sa propre boîte SMTP de
 * poche et ne tourne que si le serveur a été démarré contre elle
 * (`OMEGAX_SMTP_POCHE_PORT`, avec `SMTP_HOST=127.0.0.1`, le même port,
 * `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE=false`) · en local, jamais en CI, où
 * toute création d'utilisateur deviendrait une invitation.
 */
interface Me {
  tenant: { id: string; referentiel: string };
  plusieursDossiers?: boolean;
}
interface Exercice {
  id: string;
}
interface Utilisateur {
  id: string;
  email: string;
}

const PORT_POCHE = Number(process.env.OMEGAX_SMTP_POCHE_PORT || 0);

test('sans messagerie, une adresse qui a déjà un compte n’est pas ajoutée à un autre dossier, et rien n’est créé', async ({ page, browser }) => {
  test.skip(PORT_POCHE > 0, 'serveur démarré avec une messagerie · le parcours par invitation le couvre');
  const pannes = surveiller(page);
  const a = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Association multi e2e', montant: 1_111 });
  const b = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Société multi e2e', montant: 2_222 });
  const admin = await (await browser.newContext()).newPage();
  const entetesAdmin = { 'X-Forwarded-For': `10.251.${Date.now() % 250}.9` };
  await admin.goto('/');
  await appelApi(admin, 'POST', '/auth/login', { email: b.email, motDePasse: MOT_DE_PASSE }, entetesAdmin);
  const refus = await appelApi(admin, 'POST', '/utilisateurs', { email: a.email, motDePasse: 'Choisi-par-B-2026!', role: 'COMPTABLE' }, entetesAdmin).then(
    () => null,
    (e: Error) => e.message,
  );
  expect(refus).toContain('503');
  expect(refus).toContain('messagerie');
  const liste = await appelApi<Utilisateur[]>(admin, 'GET', '/utilisateurs', undefined, entetesAdmin);
  expect(liste.map((u) => u.email)).not.toContain(a.email);
  // Le mot de passe saisi par B n'a rien ouvert.
  const ouvre = await appelApi(page, 'POST', '/auth/login', { email: a.email, motDePasse: 'Choisi-par-B-2026!' }).then(
    () => true,
    () => false,
  );
  expect(ouvre).toBe(false);
  await admin.context().close();
  expect(pannes).toEqual([]);
});

/** Une boîte SMTP de poche · garde les courriels reçus, n'envoie rien dehors. */
function boiteDePoche(port: number): Promise<{ courriels: { a: string[]; corps: string }[]; fermer: () => void }> {
  const courriels: { a: string[]; corps: string }[] = [];
  const serveur: Server = createServer((socket) => {
    let enDonnees = false;
    let tampon = '';
    let courant = { a: [] as string[], corps: '' };
    const ecrire = (x: string) => socket.write(x + '\r\n');
    ecrire('220 poche ESMTP');
    socket.on('data', (morceau) => {
      tampon += morceau.toString('utf8');
      for (;;) {
        if (enDonnees) {
          const fin = tampon.indexOf('\r\n.\r\n');
          if (fin < 0) return;
          // Le code se lit dans le texte brut · quoted-printable déplié.
          courant.corps = tampon.slice(0, fin).replace(/=\r?\n/g, '');
          tampon = tampon.slice(fin + 5);
          courriels.push(courant);
          courant = { a: [], corps: '' };
          enDonnees = false;
          ecrire('250 ok');
          continue;
        }
        const i = tampon.indexOf('\r\n');
        if (i < 0) return;
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        const cmd = ligne.toUpperCase();
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) socket.write('250-poche\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (cmd.startsWith('AUTH PLAIN')) ecrire('235 ok');
        else if (cmd.startsWith('AUTH LOGIN')) {
          ecrire('334 VXNlcm5hbWU6');
          socket.once('data', () => {
            ecrire('334 UGFzc3dvcmQ6');
            socket.once('data', () => ecrire('235 ok'));
          });
        } else if (cmd.startsWith('RCPT TO')) {
          courant.a.push(ligne.slice(8).replace(/[<>]/g, '').trim().toLowerCase());
          ecrire('250 ok');
        } else if (cmd === 'DATA') {
          enDonnees = true;
          ecrire('354 go');
        } else if (cmd === 'QUIT') {
          ecrire('221 bye');
          socket.end();
        } else ecrire('250 ok');
      }
    });
    socket.on('error', () => undefined);
  });
  return new Promise((resolve) => serveur.listen(port, '127.0.0.1', () => resolve({ courriels, fermer: () => serveur.close() })));
}

test('une personne invitée dans un second dossier · elle accepte, choisit, change, ne voit jamais l’autre, et le retrait coupe l’accès', async ({
  page,
  browser,
}) => {
  test.skip(!PORT_POCHE, 'aucune messagerie de poche (OMEGAX_SMTP_POCHE_PORT) · le parcours par invitation ne se rejoue pas en CI');
  const boite = await boiteDePoche(PORT_POCHE);
  try {
    const pannes = surveiller(page);
    const a = await creerDossier(page, { referentiel: 'SYCEBNL', nom: 'Association multi e2e', montant: 1_111 });
    const b = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Société multi e2e', montant: 2_222 });

    // L'administrateur de B, sur son propre navigateur, invite l'adresse de A.
    const admin = await (await browser.newContext()).newPage();
    const entetesAdmin = { 'X-Forwarded-For': `10.251.${Date.now() % 250}.9` };
    await admin.goto('/');
    await appelApi(admin, 'POST', '/auth/login', { email: b.email, motDePasse: MOT_DE_PASSE }, entetesAdmin);
    const invite = await appelApi<Record<string, unknown>>(admin, 'POST', '/utilisateurs', { email: a.email, role: 'COMPTABLE' }, entetesAdmin);
    expect(invite).toHaveProperty('invitation');
    expect(JSON.stringify(invite)).not.toContain('compteDeConnexion');
    const dossierB = (await appelApi<Me>(admin, 'GET', '/auth/me', undefined, entetesAdmin)).tenant.id;
    await expect.poll(() => boite.courriels.some((m) => m.a.includes(a.email.toLowerCase())), { timeout: 10_000 }).toBe(true);
    const courriel = boite.courriels.find((m) => m.a.includes(a.email.toLowerCase()))!;
    const code = /Ou saisissez ce code : (\S+)/.exec(courriel.corps)![1];

    // La personne se connecte · l'invitation reçue s'accepte avec le code.
    await page.goto('/');
    await page.fill('input[type=email]', a.email);
    await page.fill('input[type=password]', MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
    const recues = page.getByLabel('Invitations reçues');
    await expect(recues).toBeVisible();
    await recues.getByLabel('Code reçu par courriel :').fill(code);
    await recues.getByRole('button', { name: 'Accepter' }).click();
    await expect(recues.getByText('Invitation acceptée')).toBeVisible();
    const liste = page.getByRole('table', { name: 'Mes dossiers' });
    await expect(liste.locator('tbody tr')).toHaveCount(2);
    await expect(liste.getByText('Association multi e2e')).toBeVisible();
    await expect(liste.getByText('Société multi e2e')).toBeVisible();

    // Elle entre dans B · l'écran des logiciels de B suit.
    await liste.locator('tr[data-dossier="Société multi e2e"]').click();
    await entrerDansUnLogiciel(page);
    const meB = await appelApi<Me>(page, 'GET', '/auth/me');
    expect([meB.tenant.id, meB.tenant.referentiel, meB.plusieursDossiers]).toEqual([dossierB, 'SYSCOHADA', true]);
    const exercicesB = await appelApi<Exercice[]>(page, 'GET', '/exercices');
    expect(exercicesB.map((e) => e.id)).toContain(b.exerciceId);
    expect(exercicesB.map((e) => e.id)).not.toContain(a.exerciceId);

    // Un onglet resté sur A n'écrit pas dans B · 409 nommé.
    const autreOnglet = await appelApi(page, 'POST', '/auth/changer-dossier', { dossierId: dossierB }, { 'X-Dossier': 'un-autre-dossier' }).then(
      () => null,
      (e: Error) => e.message,
    );
    expect(autreOnglet).toContain('409');

    // Fichier > Changer de dossier · retour dans A.
    await page.getByRole('button', { name: 'Fichier', exact: true }).click();
    await page.getByText('Changer de dossier…', { exact: true }).click();
    const modale = page.getByRole('dialog', { name: 'Changer de dossier' });
    await expect(modale).toBeVisible();
    await modale.locator('tr[data-dossier="Association multi e2e"]').click();
    await entrerDansUnLogiciel(page);
    const meA = await appelApi<Me>(page, 'GET', '/auth/me');
    expect(meA.tenant.referentiel).toBe('SYCEBNL');
    expect((await appelApi<Exercice[]>(page, 'GET', '/exercices')).map((e) => e.id)).toContain(a.exerciceId);

    // De nouveau dans B, puis l'administrateur de B retire l'appartenance.
    await appelApi(page, 'POST', '/auth/changer-dossier', { dossierId: dossierB }, { 'X-Dossier': meA.tenant.id });
    await appelApi(page, 'GET', '/exercices');
    // La révocation se compare à la SECONDE · voir deconnexion-utilisateur.e2e.ts.
    await page.waitForTimeout(1_100);
    const ligne = (await appelApi<Utilisateur[]>(admin, 'GET', '/utilisateurs', undefined, entetesAdmin)).find((u) => u.email === a.email);
    expect(ligne).toBeTruthy();
    await appelApi(admin, 'PATCH', `/utilisateurs/${ligne!.id}`, { estActif: false }, entetesAdmin);
    const refus = await appelApi(page, 'GET', '/exercices').then(
      () => null,
      (e: Error) => e.message,
    );
    expect(refus).toContain('401');

    // Reconnectée, elle n'a plus que A, et B ne s'ouvre plus.
    await page.waitForTimeout(1_100);
    await page.goto('/');
    await appelApi(page, 'POST', '/auth/login', { email: a.email, motDePasse: MOT_DE_PASSE });
    expect((await appelApi<Me>(page, 'GET', '/auth/me')).plusieursDossiers).toBe(false);
    const ferme = await appelApi(page, 'POST', '/auth/changer-dossier', { dossierId: dossierB }).then(
      () => null,
      (e: Error) => e.message,
    );
    expect(ferme).toContain('404');
    await admin.context().close();
    expect(pannes).toEqual([]);
  } finally {
    boite.fermer();
  }
});
