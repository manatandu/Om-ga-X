import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ecartEnUnites, MENTION_EXCEDENT_UNITES, motifRefusQuantiteDuBien } from './ecart-en-unites';

/**
 * Ligne restes-immos-budgets, point 2 · ce qui casserait en silence · un lot
 * non compté lu comme un manquant de tout le lot, un excédent d'unités qui
 * créerait un bien ou une valeur, une fraction d'unité prise pour un comptage,
 * et une fiche engendrée sans la quantité du registre.
 */
describe('la quantité du bien sur la fiche de comptage', () => {
  it('sans quantité du registre, aucun écart · une fiche saisie à la main', () => {
    expect(ecartEnUnites({ quantiteAttendue: null, quantiteComptee: '3' })).toBeNull();
  });

  it('pas encore compté n’est pas zéro · aucun manquant dit', () => {
    const e = ecartEnUnites({ quantiteAttendue: 10, quantiteComptee: null });
    expect(e).toMatchObject({ attendue: 10, comptee: null, ecart: null, sens: null });
  });

  it('manquant, conforme et excédent en unités, lus sur un Decimal en chaîne', () => {
    expect(ecartEnUnites({ quantiteAttendue: 10, quantiteComptee: '7.000' })).toMatchObject({ ecart: -3, sens: 'MANQUANT' });
    expect(ecartEnUnites({ quantiteAttendue: 10, quantiteComptee: '10' })).toMatchObject({ ecart: 0, sens: 'CONFORME' });
    const plus = ecartEnUnites({ quantiteAttendue: 10, quantiteComptee: 12 });
    expect(plus).toMatchObject({ ecart: 2, sens: 'EXCEDENT' });
    expect(plus?.mention).toContain(MENTION_EXCEDENT_UNITES);
    expect(plus?.mention).toContain('AUDCIF art. 43');
  });

  it('un bien du registre se compte en unités entières', () => {
    expect(motifRefusQuantiteDuBien(2.5, true)).toMatch(/unités entières/);
    expect(motifRefusQuantiteDuBien(2.5, false)).toBeNull();
    expect(motifRefusQuantiteDuBien(3, true)).toBeNull();
    expect(motifRefusQuantiteDuBien(undefined, true)).toBeNull();
  });

  it('les fiches engendrées recopient la quantité du registre, sans toucher une fiche déjà comptée', () => {
    const source = readFileSync(join(__dirname, 'inventaire.service.ts'), 'utf8');
    const debut = source.indexOf('async engendrerFichesImmobilisations(');
    const corps = source.slice(debut, source.indexOf('\n  async ', debut + 10));
    expect(corps).toContain('quantiteAttendue: b.quantite');
    // Une fiche déjà comptée ne reçoit pas après coup une quantité qu'on ne lui a pas montrée.
    expect(corps).toMatch(/where: \{ id: f\.id, tenantId, quantiteComptee: null \}/);
    expect(corps).toMatch(/quantiteParBien\.get\(f\.immobilisationId\) !== f\.quantiteAttendue/);
  });
});
