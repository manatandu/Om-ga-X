import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LA LONGUEUR FIXE DES CODES DE SECTION À L'ÉCRAN (ligne sage-l6, fonction
 * n° 50). L'écran n'en juge rien · il lit l'aperçu du serveur, montre son
 * refus, ne laisse pas enregistrer ce que le serveur refuserait, et borne la
 * frappe du code d'une section. Ce qui casserait en silence · un aperçu lu à
 * une autre adresse que celle du contrôleur (le refus ne se verrait qu'au
 * clic), une longueur jamais envoyée, une frappe non bornée.
 */
const lire = (f: string) => readFileSync(join(__dirname, f), 'utf8');
const page = lire('PlansAnalytiquesPage.tsx');
const controleur = readFileSync(join(__dirname, '../../../src/modules/analytique/analytique.controller.ts'), 'utf8');

describe('longueur des codes de section · l’écran des plans analytiques', () => {
  it('l’aperçu se lit à la route du contrôleur, avec la longueur choisie', () => {
    expect(controleur).toMatch(/@Controller\('analytique'\)/);
    expect(controleur).toMatch(/@Get\('plans\/:planId\/longueur-sections'\)/);
    expect(page).toContain('`/analytique/plans/${axeId}/longueur-sections?longueur=${encodeURIComponent(longueurChoisie)}`');
  });

  it('la longueur part avec les réglages de l’axe, vide = libre', () => {
    expect(page).toContain("longueurSections: axe.longueurSections === '' ? null : Number(axe.longueurSections),");
  });

  it('le refus du serveur se montre, et l’enregistrement se ferme tant qu’il tient', () => {
    expect(page).toMatch(/\{apercuLongueur\.motif\}/);
    expect(page).toMatch(/disabled=\{!!apercuLongueur\?\.motif\}/);
  });

  it('les longueurs offertes vont de 2 à 13, comme au serveur', () => {
    expect(page).toContain('Array.from({ length: 12 }, (_, i) => i + 2)');
    const serveur = readFileSync(join(__dirname, '../../../src/modules/analytique/longueur-sections.ts'), 'utf8');
    expect(serveur).toContain('export const LONGUEUR_SECTIONS_MIN = 2;');
    expect(serveur).toContain('export const LONGUEUR_SECTIONS_MAX = 13;');
  });

  it('la frappe du code d’une section se borne à la longueur de l’axe, une rubrique plus courte', () => {
    expect(page).toMatch(/maxLength=\{plan\?\.longueurSections \? \(type === 'TOTAL' \? plan\.longueurSections - 1 : plan\.longueurSections\) : undefined\}/);
  });
});
