import { readFileSync } from 'fs';
import { join } from 'path';
import { PLAN_COMPTES_SYSCOHADA } from '../comptes/compte-seed-syscohada';
import {
  COMPTES_RESULTAT_DE_L_EXERCICE,
  estCompteDuResultatDeLExercice,
  estResultatEnInstanceDAffectation,
  partsDuResultatAuBilan,
  resultatAnterieurNonVire,
  resultatAnterieurNonVireDuComparatif,
  resultatAuBilan,
} from './resultat-de-l-exercice';

/**
 * UNE SEULE LECTURE DU RÉSULTAT (audit du serveur, I5) · jusqu'au
 * 2026-09-27, l'impôt lisait le 131 et le 139, le bilan SYSCOHADA 131 à 139,
 * le Système minimal et la consolidation tout le 13. Ce spec tient la règle
 * et vérifie que chaque lecteur l'appelle au lieu de la réécrire.
 */
describe('résultat de l’exercice · 131 à 139, jamais le 130', () => {
  it('retient les neuf subdivisions 131 à 139 et écarte le 130', () => {
    expect([...COMPTES_RESULTAT_DE_L_EXERCICE]).toEqual(['131', '132', '133', '134', '135', '136', '137', '138', '139']);
    for (const n of ['13100000', '13200000', '13700000', '13810000', '13900000']) expect(estCompteDuResultatDeLExercice(n)).toBe(true);
    for (const n of ['13010000', '13090000', '12100000', '14100000']) expect(estCompteDuResultatDeLExercice(n)).toBe(false);
    expect(estResultatEnInstanceDAffectation('13010000')).toBe(true);
    expect(estResultatEnInstanceDAffectation('13100000')).toBe(false);
  });

  it('prémisse relue au semis SYSCOHADA · sous le 13, seul le 130 est écarté', () => {
    const sous13 = PLAN_COMPTES_SYSCOHADA.filter((c) => c.numero.startsWith('13') && c.numero.length === 8).map((c) => c.numero);
    expect(sous13.filter((n) => !estCompteDuResultatDeLExercice(n)).sort()).toEqual(['13010000', '13090000']);
  });

  it('une cascade de soldes intermédiaires arrêtée en chemin rend le résultat (Titre VIII ch. 19 § 2.4)', () => {
    // Chaque virement solde le compte précédent · restent le 137 et le 138.
    const balance = [
      { numero: '13700000', solde: -1_700 },
      { numero: '13800000', solde: 900 },
      { numero: '13010000', solde: -5_000 },
    ];
    const resultat = -balance.filter((l) => estCompteDuResultatDeLExercice(l.numero)).reduce((s, l) => s + l.solde, 0);
    expect(resultat).toBe(800);
  });

  it('chaque lecteur du résultat appelle la règle commune', () => {
    const lecteurs = [
      'etats-financiers/etats-financiers.service.ts',
      'etats-financiers/etats-financiers-smt.service.ts',
      'etats-financiers/etats-financiers-projet.service.ts',
      'etats-financiers-syscohada/correspondance-bilan-syscohada.ts',
      'etats-financiers-syscohada/correspondance-smt-syscohada.ts',
      'fiscalite/fiscalite.service.ts',
      'consolidation/cumul-consolidation.ts',
    ];
    const sansLaRegle = lecteurs.filter(
      (f) => !readFileSync(join(__dirname, '..', f), 'utf8').includes("from '../etats-financiers/resultat-de-l-exercice'") &&
        !readFileSync(join(__dirname, '..', f), 'utf8').includes("from './resultat-de-l-exercice'"),
    );
    expect(sansLaRegle).toEqual([]);
  });
});

/**
 * LE POSTE DU RÉSULTAT PARTAGÉ ENTRE L'EXERCICE ET LE RÉSULTAT ANTÉRIEUR NON
 * AFFECTÉ (relecture de la passe V1, 2026-10-08) · la règle de la fiscalité
 * (cas chiffré V3), jamais « classes 6 à 8 non nulles, sinon le 13 ».
 */
describe('parts du résultat au bilan · la règle de la fiscalité', () => {
  const gestion = (solde: number) => ({ solde });
  const treize = (mouvementDebit: number, mouvementCredit: number) => ({ mouvementDebit, mouvementCredit });

  it('MAJEUR · ventes 1 000 000, achats 1 000 000, 13 à -300 000 non affecté · exercice 0, antérieur -300 000', () => {
    // La gestion porte un solde sur ses comptes · son net, nul, EST le
    // résultat de l'exercice. L'ancienne lecture rendait -300 000 « de
    // l'exercice » et faisait tomber les contrôles du SMT et des liasses.
    const parts = partsDuResultatAuBilan(0, -300_000, [gestion(-1_000_000), gestion(1_000_000)], [treize(0, 0)]);
    expect(parts).toEqual({ resultatDeLExercice: 0, resultatAnterieurNonAffecte: -300_000 });
    expect(parts.resultatDeLExercice + parts.resultatAnterieurNonAffecte).toBe(resultatAuBilan(0, -300_000));
  });

  it('un 13 qui ne porte que l’à-nouveau, sans gestion, est antérieur · l’exercice vaut zéro', () => {
    expect(partsDuResultatAuBilan(0, -46_072_000, [], [treize(0, 0)])).toEqual({
      resultatDeLExercice: 0,
      resultatAnterieurNonAffecte: -46_072_000,
    });
  });

  it('gestion soldée et 13 mouvementé dans l’exercice · le 13 est le résultat de l’exercice', () => {
    expect(partsDuResultatAuBilan(0, 25_000, [gestion(0)], [treize(0, 25_000)])).toEqual({
      resultatDeLExercice: 25_000,
      resultatAnterieurNonAffecte: 0,
    });
  });

  it('avant l’affectation · les classes 6 à 8 portent N, le 13 porte N-1', () => {
    expect(partsDuResultatAuBilan(500, 1_164_000, [gestion(-500)], [treize(0, 0)])).toEqual({
      resultatDeLExercice: 500,
      resultatAnterieurNonAffecte: 1_164_000,
    });
  });
});

/**
 * BLOQUANT de la relecture de la passe V1 · un exercice CLÔTURÉ avant le
 * virement de clôture garde le résultat précédent au 13, et le poste
 * l'additionne · il est NOMMÉ, jamais présenté en silence comme résultat de
 * l'exercice. Ouvert, c'est la situation légitime d'avant l'assemblée.
 */
describe('résultat antérieur non viré · seulement sur un exercice clôturé', () => {
  it('exercice clôturé, perte 2026 de 46 072 000 restée au 13 · nommée, poste, montant et fiche', () => {
    const avis = resultatAnterieurNonVire(true, -46_072_000, 'CJ', 'SYSCOHADA');
    expect(avis).not.toBeNull();
    expect(avis!.montant).toBe(-46_072_000);
    expect(avis!.poste).toBe('CJ');
    expect(avis!.motif).toContain('une perte de 46');
    expect(avis!.motif).toContain('AUDCIF, Titre VII, compte 13');
    expect(avis!.motif).toContain('poste CJ');
  });

  it('le mot de chaque plan · déficit au SYCEBNL, et sa fiche', () => {
    const avis = resultatAnterieurNonVire(true, -1_000, 'CH', 'SYCEBNL');
    expect(avis!.motif).toContain('un déficit de');
    expect(avis!.motif).toContain('SYCEBNL, Partie 2 ch. 3, compte 13');
  });

  it('exercice ouvert, ou rien d’antérieur · rien n’est dit', () => {
    expect(resultatAnterieurNonVire(false, -46_072_000, 'CJ', 'SYSCOHADA')).toBeNull();
    expect(resultatAnterieurNonVire(true, 0, 'CJ', 'SYSCOHADA')).toBeNull();
    expect(resultatAnterieurNonVire(true, 0.004, 'CJ', 'SYSCOHADA')).toBeNull();
  });
});

/**
 * PAQUET 1, A1 (reproduit sur vraie base le 2026-10-08) · la colonne N-1 de
 * l'exercice qui suit un exercice clôturé sans le virement reprend le même
 * poste (AUDCIF art. 34, dernier tiret ; SYCEBNL art. 16, 7)) · elle le DIT,
 * sans rien recalculer. Seulement quand la colonne vient de l'exercice
 * précédent tenu dans OmegaX et clôturé.
 */
describe('résultat antérieur non viré · la colonne N-1', () => {
  it('exercice précédent clôturé, bénéfice de 2025 resté au 13 · nommé pour la colonne N-1, poste, montant, fiche et comparatif', () => {
    const avis = resultatAnterieurNonVireDuComparatif('EXERCICE_N1', true, 1_000_000, 'CJ', 'SYSCOHADA');
    expect(avis).toEqual(expect.objectContaining({ montant: 1_000_000, poste: 'CJ' }));
    expect(avis!.motif).toMatch(/^Colonne N-1 · /);
    expect(avis!.motif).toContain('un bénéfice de 1');
    expect(avis!.motif).toContain('AUDCIF, Titre VII, compte 13');
    expect(avis!.motif).toContain('AUDCIF art. 34');
    expect(avis!.motif).toContain("Rien n'est recalculé");
  });

  it('le texte de chaque plan · excédent, fiche SYCEBNL et art. 16, 7)', () => {
    const avis = resultatAnterieurNonVireDuComparatif('EXERCICE_N1', true, 1_000_000, 'CH', 'SYCEBNL');
    expect(avis!.motif).toContain('un excédent de');
    expect(avis!.motif).toContain('SYCEBNL, Partie 2 ch. 3, compte 13');
    expect(avis!.motif).toContain('SYCEBNL art. 16, 7)');
  });

  it('colonne lue sur le bilan d’ouverture, absente, exercice précédent ouvert, ou rien d’antérieur · rien n’est dit', () => {
    expect(resultatAnterieurNonVireDuComparatif('BILAN_D_OUVERTURE', true, 1_000_000, 'CJ', 'SYSCOHADA')).toBeNull();
    expect(resultatAnterieurNonVireDuComparatif(null, true, 1_000_000, 'CJ', 'SYSCOHADA')).toBeNull();
    expect(resultatAnterieurNonVireDuComparatif('EXERCICE_N1', false, 1_000_000, 'CJ', 'SYSCOHADA')).toBeNull();
    expect(resultatAnterieurNonVireDuComparatif('EXERCICE_N1', true, 0, 'CJ', 'SYSCOHADA')).toBeNull();
  });
});
