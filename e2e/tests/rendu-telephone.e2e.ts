import { expect, test, type Page } from '@playwright/test';
import { creerDossier, seConnecter, surveiller } from './outils';

/**
 * LE RENDU SOUS 640 PX, AU NAVIGATEUR (reprise du design, lot 4, 2026-11-04).
 *
 * Les specs de source gèlent la CAUSE d'un défaut de mise en page ; seul un
 * navigateur le MESURE. Chromium, 390 x 844, pointeur grossier (écran tactile) ·
 * trois écrans, dans les deux référentiels, chacun dans ses états :
 * états financiers (chaque onglet), saisie des journaux (choix, puis grille),
 * contrôles (chaque onglet). Trois mesures, chacune dit ce qu'elle protège :
 *  (1) la PAGE ne défile pas de côté (`scrollWidth <= clientWidth` du document) ;
 *  (2) le CONTENU de la fenêtre non plus : un tableau large défile dans SON
 *      cadre (ancêtre en `overflow-x: auto`), jamais la fenêtre entière ;
 *  (3) rien ne sort de la fenêtre sans défilement, ni n'est coupé en silence
 *      par un parent `overflow: hidden` (un bouton à moitié rogné, un onglet
 *      perdu) ;
 *  (4) tout bouton de fenêtre offre une cible de 32 px au moins dans les deux
 *      sens ; un `.cible-tactile` compte avec la zone de son pseudo-élément.
 * Au bureau (pointeur fin), la règle de taille ne s'applique pas.
 *
 * Le chemin du menu n'est pas recopié : chaque écran est ouvert par l'adresse
 * que `AppShell.tsx` donne à sa commande, et le test vérifie qu'elle y est.
 */
const CIBLE_MINIMALE = 32;
const COMMANDES = ['/etats-financiers', '/saisie', '/controles'] as const;

/** Ce que la page rend, mesuré DANS le navigateur (aucune dépendance au test). */
function mesurer() {
  const CIBLE = 32;
  const contenu = document.querySelector<HTMLElement>('.anim-fenetre:not(.fenetre-inactive) [data-contenu-fenetre]');
  if (!contenu) return null;
  const racine = document.documentElement;
  const cadre = contenu.getBoundingClientRect();

  // (3) Ce qui sort sans défiler, ou qu'un parent coupe.
  const sortants: string[] = [];
  const fautifs = new Set<Element>();
  const petits: string[] = [];
  for (const el of Array.from(contenu.querySelectorAll<HTMLElement>('*'))) {
    const b = el.getBoundingClientRect();
    // Le dessin interne d'une icône suit son <svg> : seul celui-ci se juge.
    if (b.width === 0 || b.height === 0 || el.closest('.sr-only') || (el instanceof SVGElement && !(el instanceof SVGSVGElement))) continue;
    let defile = false;
    let coupe = false;
    for (let a = el.parentElement; a && a !== contenu; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o === 'auto' || o === 'scroll') {
        defile = true;
        break;
      }
      if ((o === 'hidden' || o === 'clip') && b.right > a.getBoundingClientRect().right + 1) {
        coupe = true;
        break;
      }
    }
    if (!defile && (coupe || b.right > cadre.right + 1 || b.left < cadre.left - 1)) {
      // Seul le plus HAUT fautif est nommé : ses enfants ne font que le suivre.
      const enfantDUnFautif = !!el.parentElement && fautifs.has(el.parentElement);
      fautifs.add(el);
      if (!enfantDUnFautif) {
        sortants.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 4).join('.')} «${(el.textContent ?? '').trim().slice(0, 30)}» · droite à ${Math.round(b.right)} px`);
      }
    }

    // (4) La cible des boutons.
    if (el.matches('button, [role=button]')) {
      let h = b.height;
      let l = b.width;
      if (el.classList.contains('cible-tactile')) {
        const apres = getComputedStyle(el, '::after');
        h = Math.max(h, parseFloat(apres.height) || 0);
        l = Math.max(l, parseFloat(apres.width) || 0);
      }
      if (h < CIBLE - 0.5 || l < CIBLE - 0.5) {
        const nom = (el.textContent ?? '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || '(sans nom)';
        petits.push(`${nom.slice(0, 30)} · ${Math.round(l)} x ${Math.round(h)}`);
      }
    }
  }
  return {
    pointeurGrossier: matchMedia('(pointer: coarse)').matches,
    page: { defilement: racine.scrollWidth, visible: racine.clientWidth },
    fenetre: { defilement: contenu.scrollWidth, visible: contenu.clientWidth },
    sortants,
    petits,
  };
}

async function verifier(page: Page, ecran: string, problemes: string[]) {
  // La fenêtre est RENDUE avant d'être lue (cf. ecrans.e2e.ts) : une mesure
  // prise sur le squelette de chargement ne mesure rien.
  await page.getByText('Chargement…', { exact: true }).first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle');
  const m = await page.evaluate(mesurer);
  // TOUS les écarts d'un parcours sont rendus d'un coup (un seul passage pour
  // les corriger tous), jamais le premier seul.
  if (!m) return void problemes.push(`${ecran} · aucune fenêtre active`);
  if (!m.pointeurGrossier) problemes.push(`${ecran} · le contexte doit être tactile`);
  if (m.page.defilement > m.page.visible) problemes.push(`${ecran} · la page défile de côté (${m.page.defilement} > ${m.page.visible})`);
  // Un PIXEL de tolérance, et lui seul : la zone de toucher de 32 px d'une aide
  // « ? » de 15 px posée au bord droit de la fenêtre dépasse de 8,5 px la marge
  // de 8 px (`.cible-tactile::after`, pseudo-élément positionné, que le
  // navigateur compte dans le défilement). Le demi-pixel est invisible ; la
  // page, elle, est jugée sans aucune tolérance.
  if (m.fenetre.defilement > m.fenetre.visible + 1) problemes.push(`${ecran} · la fenêtre défile de côté (${m.fenetre.defilement} > ${m.fenetre.visible})`);
  for (const s of m.sortants) problemes.push(`${ecran} · sort ou coupé · ${s}`);
  for (const p of m.petits) problemes.push(`${ecran} · bouton sous ${CIBLE_MINIMALE} px · ${p}`);
}

test.describe('téléphone · 390 x 844, pointeur grossier', () => {
  test.use({ viewport: { width: 1366, height: 900 }, hasTouch: true, isMobile: true });

  test('les commandes de menu visées existent encore', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(__dirname, '../../client/src/components/chrome/AppShell.tsx'), 'utf8');
    const chemins = new Set([...source.matchAll(/chemin: '(\/[^']*)'/g)].map((m) => m[1]));
    for (const c of COMMANDES) expect(chemins.has(c), c).toBe(true);
  });

  for (const referentiel of ['SYSCOHADA', 'SYCEBNL'] as const) {
    test(`${referentiel} · états financiers, saisie et contrôles ne débordent pas et se touchent au doigt`, async ({ page }) => {
      test.setTimeout(180_000);
      const pannes = surveiller(page);
      const problemes: string[] = [];
      const dossier = await creerDossier(page, { referentiel, nom: `Rendu tel ${referentiel}`, montant: 1000 });
      // La barre de menus se replie sous 640 px (☰) : la connexion se fait
      // à la largeur du bureau, comme `seConnecter` l'attend, puis le
      // téléphone prend la main.
      await seConnecter(page, dossier.email);
      await page.setViewportSize({ width: 390, height: 844 });

      // --- États financiers : chaque onglet ---------------------------------
      await page.goto('/#/etats-financiers');
      await verifier(page, `${referentiel} · états financiers`, problemes);
      for (const onglet of ['BILAN', 'COMPTE DE RÉSULTAT', 'FLUX DE TRÉSORERIE']) {
        await page.getByRole('button', { name: onglet, exact: true }).click();
        await verifier(page, `${referentiel} · états financiers · ${onglet}`, problemes);
      }

      // --- Saisie des journaux : le choix, puis la grille --------------------
      await page.goto('/#/saisie');
      await verifier(page, `${referentiel} · saisie · choix du journal`, problemes);
      await page.getByRole('button', { name: /^(OD|BQ)$/ }).first().click();
      await page.getByRole('button', { name: 'Ouvrir le journal' }).click();
      await expect(page.getByRole('button', { name: 'Changer de journal / période' })).toBeVisible();
      await verifier(page, `${referentiel} · saisie · grille`, problemes);

      // --- Contrôles : chaque onglet ----------------------------------------
      await page.goto('/#/controles');
      await verifier(page, `${referentiel} · contrôles`, problemes);
      for (const onglet of ['Contrôle de caisse', 'Évolution mensuelle', 'Comptes dormants']) {
        await page.getByRole('button', { name: onglet, exact: true }).click();
        await verifier(page, `${referentiel} · contrôles · ${onglet}`, problemes);
      }

      expect(problemes).toEqual([]);
      expect(pannes).toEqual([]);
    });
  }
});

test.describe('bureau · pointeur fin', () => {
  test('la taille minimale des boutons de fenêtre ne s’applique pas à la souris', async ({ page }) => {
    const dossier = await creerDossier(page, { referentiel: 'SYSCOHADA', nom: 'Rendu bureau', montant: 1000 });
    await seConnecter(page, dossier.email);
    await page.goto('/#/journal?onglet=journal');
    const filtrer = page.getByRole('button', { name: 'Filtrer', exact: true });
    await expect(filtrer).toBeVisible();
    const regle = await filtrer.evaluate((el) => ({ fin: matchMedia('(pointer: fine)').matches, min: getComputedStyle(el).minHeight }));
    expect(regle.fin).toBe(true);
    expect(regle.min).not.toBe('32px');
    expect((await filtrer.boundingBox())?.height ?? 99).toBeLessThan(32);
  });
});
