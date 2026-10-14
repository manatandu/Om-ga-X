import {
  EtatDeLaFiche,
  champsAEffetDemandes,
  motifRefusModificationAEffet,
  motifRefusSuppression,
  propositionDeDuplication,
} from './fiche-immobilisation';

/**
 * MODIFIER, SUPPRIMER OU DUPLIQUER UNE FICHE (ligne sage-l4, fonction n° 66,
 * décision D7) · les règles pures. Ce qui casserait en silence · une valeur
 * modifiée sur une fiche dont l'écriture est validée (le journal et la fiche
 * divergent, la balance boucle des deux côtés), une fiche supprimée qui
 * retenait une écriture (lien dénoué), une dotation calculée sur l'ancienne
 * valeur laissée au journal.
 */

const vierge: EtatDeLaFiche = {
  sortie: false,
  autresEcritures: [],
  acquisition: { validee: false, numeroPiece: 4, nombreLignes: 2, exerciceClos: false },
  motifLignesTenues: null,
  origineParticuliere: null,
  neeDUneEcriturePassee: false,
  usages: [],
  annulationsRetenant: 0,
  exerciceClosQuiLaPorte: null,
  renouvelle: null,
};

describe('les champs à effet', () => {
  it('ne retient que les champs présents · absent vaut inchangé', () => {
    expect(champsAEffetDemandes({ valeurOrigine: 10, dureeAmortissementAns: undefined })).toEqual(['valeurOrigine']);
    expect(champsAEffetDemandes({ dateMiseEnService: null })).toEqual(['dateMiseEnService']);
    expect(champsAEffetDemandes({})).toEqual([]);
  });

  it('se modifient au brouillard, sans traitement', () => {
    expect(motifRefusModificationAEffet(vierge)).toBeNull();
    expect(motifRefusModificationAEffet({ ...vierge, acquisition: null })).toBeNull();
  });

  it("refusent quand l'écriture d'acquisition est validée, et nomment les gestes qui existent", () => {
    const m = motifRefusModificationAEffet({ ...vierge, acquisition: { ...vierge.acquisition!, validee: true } });
    expect(m).toMatch(/pièce n° 4\) est validée/);
    expect(m).toMatch(/AUDCIF art\. 22, 2°/);
    expect(m).toMatch(/reclassement/);
    expect(m).toMatch(/révision du plan/);
  });

  it('refusent tant qu’un traitement a lu la fiche, en le nommant, avec l’issue', () => {
    const m = motifRefusModificationAEffet({ ...vierge, usages: [{ modele: 'DotationAmortissement', champ: 'immobilisationId', nombre: 1 }] });
    expect(m).toMatch(/dotations \(1\)/);
    expect(m).toMatch(/annulez-les d’abord/);
  });

  it("une annulation de traitement ne bloque pas la modification · origine et négatif s'y neutralisent", () => {
    expect(motifRefusModificationAEffet({ ...vierge, annulationsRetenant: 2 })).toBeNull();
  });

  it('refusent sur un bien sorti, une écriture propre au bien, une origine particulière, un exercice clôturé', () => {
    expect(motifRefusModificationAEffet({ ...vierge, sortie: true })).toMatch(/sorti/);
    expect(motifRefusModificationAEffet({ ...vierge, autresEcritures: ["l'écriture de mise en service"] })).toMatch(/mise en service/);
    expect(motifRefusModificationAEffet({ ...vierge, origineParticuliere: "d'un legs" })).toMatch(/Supprimez la fiche et refaites/);
    expect(motifRefusModificationAEffet({ ...vierge, acquisition: { ...vierge.acquisition!, exerciceClos: true } })).toMatch(/clôturé/);
  });
});

describe('la suppression', () => {
  it('passe sans écriture retenue', () => {
    expect(motifRefusSuppression(vierge)).toBeNull();
    expect(motifRefusSuppression({ ...vierge, acquisition: null })).toBeNull();
  });

  it("refuse une écriture d'acquisition validée et renvoie à la sortie du bien", () => {
    expect(motifRefusSuppression({ ...vierge, acquisition: { ...vierge.acquisition!, validee: true } })).toMatch(/se sort/);
  });

  it('refuse un bien utilisé et un traitement annulé qui garde son écriture', () => {
    expect(motifRefusSuppression({ ...vierge, usages: [{ modele: 'FicheInventaire', champ: 'immobilisationId', nombre: 3 }] })).toMatch(
      /fiches d'inventaire \(3\)/,
    );
    expect(motifRefusSuppression({ ...vierge, annulationsRetenant: 1 })).toMatch(/gardent leur écriture et son négatif/);
  });
});

describe('la duplication', () => {
  it('propose une copie sans dates, sans numéro d’inventaire, sans écriture', () => {
    const p = propositionDeDuplication({
      designation: 'Camion',
      compteImmobilisationId: 'c1',
      natureFiscaleCle: 'B.3',
      lieuId: 'l1',
      valeurOrigine: 12_000_000,
      valeurResiduelle: 0,
      dureeAmortissementAns: 4,
      modeAmortissement: 'LINEAIRE',
      unitesOeuvrePrevues: null,
      uniteOeuvreLibelle: null,
    });
    expect(p.designation).toBe('Camion (copie)');
    expect(p).not.toHaveProperty('dateAcquisition');
    expect(p).not.toHaveProperty('numeroInventaire');
    expect(p).not.toHaveProperty('compteContrepartieId');
    expect(p.valeurOrigine).toBe(12_000_000);
  });
});

describe('la fiche née d’un renouvellement (relecture, mineur)', () => {
  it('ne se supprime pas · elle porte la trace du renouvellement ; elle se modifie au brouillard', () => {
    const e: EtatDeLaFiche = { ...vierge, renouvelle: 'Moteur 1' };
    expect(motifRefusSuppression(e)).toMatch(/renouvellement de « Moteur 1 »/);
    expect(motifRefusModificationAEffet(e)).toBeNull();
  });
});

describe('un exercice clôturé a porté le bien (relecture M4)', () => {
  // Un bien REPRIS n'a pas d'écriture d'acquisition · rien ne le disait porté
  // par un exercice clos, et sa valeur, son amortissement antérieur et la
  // fiche elle-même se changeaient sous des états déjà arrêtés.
  const repris: EtatDeLaFiche = { ...vierge, acquisition: null, exerciceClosQuiLaPorte: '2026-12-31' };

  it('refuse les champs à effet d’un bien repris porté par un exercice clos, avec l’issue', () => {
    const m = motifRefusModificationAEffet(repris);
    expect(m).toMatch(/clos le 2026-12-31 a porté ce bien/);
    expect(m).toMatch(/AUDCIF art\. 19/);
    expect(m).toMatch(/AUDCIF art\. 20, al\. 3 et 4/);
    expect(m).toMatch(/reclassement/);
  });

  it('refuse sa suppression, et dit de le sortir', () => {
    const m = motifRefusSuppression(repris);
    expect(m).toMatch(/clos le 2026-12-31 a porté ce bien/);
    expect(m).toMatch(/se sort/);
  });

  it('refuse le retrait d’une fiche née d’une écriture passée que l’exercice clos a portée', () => {
    expect(
      motifRefusSuppression({ ...vierge, neeDUneEcriturePassee: true, acquisition: { ...vierge.acquisition!, validee: true }, exerciceClosQuiLaPorte: '2026-12-31' }),
    ).toMatch(/ne se retire plus/);
  });

  it('laisse tout ouvert sans exercice clos qui le porte', () => {
    expect(motifRefusModificationAEffet({ ...repris, exerciceClosQuiLaPorte: null })).toBeNull();
    expect(motifRefusSuppression({ ...repris, exerciceClosQuiLaPorte: null })).toBeNull();
  });
});

describe('la fiche née d’une écriture déjà passée (fonction n° 68)', () => {
  // L'écriture est VALIDÉE (la création l'exige) · elle n'est pas celle du
  // module. Lue comme une acquisition du module, la fiche ne se retirerait
  // jamais, et un mauvais choix de ligne enfermerait le bien.
  const nee: EtatDeLaFiche = {
    ...vierge,
    acquisition: { ...vierge.acquisition!, validee: true, nombreLignes: 3 },
    origineParticuliere: "d'une écriture déjà passée au journal",
    neeDUneEcriturePassee: true,
    motifLignesTenues: 'Une ligne de l’écriture est lettrée.',
  };

  it('se retire sans usage, l’écriture validée et lettrée restant au journal', () => {
    expect(motifRefusSuppression(nee)).toBeNull();
  });

  it('ne se retire plus quand son écriture est dans un exercice clôturé, ni sous un usage', () => {
    expect(motifRefusSuppression({ ...nee, acquisition: { ...nee.acquisition!, exerciceClos: true } })).toMatch(/exercice clôturé/);
    expect(motifRefusSuppression({ ...nee, usages: [{ modele: 'DotationAmortissement', champ: 'immobilisationId', nombre: 1 }] })).toMatch(
      /dotations \(1\)/,
    );
    expect(motifRefusSuppression({ ...nee, autresEcritures: ["l'écriture de sortie"] })).toMatch(/sortie/);
  });

  it('ne retouche ni valeur, ni compte, ni date · l’issue dépend de ce qui l’a lue', () => {
    const libre = motifRefusModificationAEffet(nee);
    expect(libre).toMatch(/née d’une écriture déjà passée au journal \(pièce n° 4\)/);
    expect(libre).toMatch(/recréez-la depuis la même ligne/);
    const lue = motifRefusModificationAEffet({ ...nee, usages: [{ modele: 'DotationAmortissement', champ: 'immobilisationId', nombre: 1 }] });
    expect(lue).toMatch(/révision du plan/);
    expect(lue).not.toMatch(/recréez-la/);
  });
});
