import { Prisma } from '@prisma/client';
import {
  AVERTISSEMENT_AUTEUR_INCONNU,
  MOTIF_CONTENU_CHANGE_DEPUIS_LA_LECTURE,
  MOTIF_DEJA_VISEE,
  MOTIF_VISA_PAR_SON_AUTEUR,
  auteurDuDernierContenu,
  contenuChange,
  empreinteDuContenu,
  etatDuVisa,
  motifComptabilisationSansVisa,
  motifNonVisees,
  motifRefusRetraitVisa,
  motifRefusVisaEcriture,
  motifRefusVisaFacture,
  natureDeLaPiece,
  partitionnerLaValidation,
  type ContenuDeLEcriture,
  type EcritureAValider,
} from './circuit-visa';

/**
 * LE CIRCUIT DE VISA ET L'AUTEUR DU DERNIER CONTENU (ligne microfina-m1,
 * idée 1). Ce qui casserait en silence, dans l'ordre ·
 *
 *  1. LA FAILLE DE L'AUDIT · un comptable B réécrit le brouillard de A et le
 *     valide · le double regard qui ne lisait que `createdBy` le laissait
 *     passer, et rien n'en gardait trace ;
 *  2. un visa qui survit à un changement du contenu · l'écran dirait
 *     « visée » d'une pièce que personne n'a vue sous cette forme ;
 *  3. une empreinte qui bouge sans que rien n'ait changé (ordre des lignes,
 *     forme d'un `Decimal`) · le visa tomberait à chaque relecture.
 */

const contenu = (over: Partial<ContenuDeLEcriture> = {}): ContenuDeLEcriture => ({
  date: new Date('2026-03-10T00:00:00Z'),
  dateValeur: null,
  journalId: 'j-ach',
  numeroPiece: 12,
  reference: 'FA-1',
  libelle: 'Achat fournitures',
  lignes: [
    {
      compteId: 'c-601',
      libelle: null,
      debit: new Prisma.Decimal('100000'),
      credit: new Prisma.Decimal('0'),
      deviseId: null,
      montantDevise: null,
      coursApplique: null,
      dateEcheance: null,
      tauxTvaId: null,
      modeReglementId: null,
      ventilations: [{ sectionId: 's-1', planId: 'p-1', debit: new Prisma.Decimal('100000'), credit: new Prisma.Decimal('0') }],
    },
    {
      compteId: 'c-401',
      libelle: 'Fournisseur',
      debit: new Prisma.Decimal('0'),
      credit: new Prisma.Decimal('100000'),
      deviseId: null,
      montantDevise: null,
      coursApplique: null,
      dateEcheance: new Date('2026-04-10T00:00:00Z'),
      tauxTvaId: null,
      modeReglementId: null,
      ventilations: [],
    },
  ],
  ...over,
});

describe("l'empreinte du contenu", () => {
  it("ne bouge pas quand rien n'a changé · ordre des lignes, forme des montants", () => {
    const a = contenu();
    const b = contenu({
      lignes: [
        { ...a.lignes[1], debit: '0.00', credit: 100000 },
        { ...a.lignes[0], debit: '100000.00', credit: '0', ventilations: [{ sectionId: 's-1', planId: 'p-1', debit: 100000, credit: '0.00' }] },
      ],
    });
    expect(empreinteDuContenu(b)).toBe(empreinteDuContenu(a));
  });

  it('change avec le compte, le montant, la date, le journal et la ventilation', () => {
    const a = empreinteDuContenu(contenu());
    const c = contenu();
    expect(empreinteDuContenu({ ...c, lignes: [{ ...c.lignes[0], compteId: 'c-605' }, c.lignes[1]] })).not.toBe(a);
    expect(empreinteDuContenu({ ...c, lignes: [{ ...c.lignes[0], debit: '100000.01' }, c.lignes[1]] })).not.toBe(a);
    expect(empreinteDuContenu({ ...c, date: new Date('2026-03-11T00:00:00Z') })).not.toBe(a);
    expect(empreinteDuContenu({ ...c, journalId: 'j-od' })).not.toBe(a);
    // Le budget fait partie de ce qui est approuvé (convention d'OmegaX).
    expect(
      empreinteDuContenu({ ...c, lignes: [{ ...c.lignes[0], ventilations: [{ sectionId: 's-2', planId: 'p-1', debit: 100000, credit: 0 }] }, c.lignes[1]] }),
    ).not.toBe(a);
  });
});

describe("l'auteur du dernier contenu", () => {
  it('est le créateur tant que rien n’a réécrit la pièce', () => {
    expect(auteurDuDernierContenu({ createdBy: 'A', contenuPar: null, contenuLe: null })).toEqual({ connu: true, id: 'A' });
  });
  it('est celui qui l’a réécrite ensuite', () => {
    expect(auteurDuDernierContenu({ createdBy: 'A', contenuPar: 'B', contenuLe: new Date() })).toEqual({ connu: true, id: 'B' });
  });
  it('est INCONNU quand un chemin a réécrit sans se nommer · jamais présumé être le créateur', () => {
    expect(auteurDuDernierContenu({ createdBy: 'A', contenuPar: null, contenuLe: new Date() })).toEqual({ connu: false });
  });
  it('une réécriture fait tomber le visa', () => {
    const d = contenuChange('B', new Date('2026-03-12T08:00:00Z'));
    expect(d).toEqual({ contenuPar: 'B', contenuLe: new Date('2026-03-12T08:00:00Z'), viseePar: null, viseeLe: null, viseeEmpreinte: null });
  });
});

const aValider = (over: Partial<EcritureAValider> = {}): EcritureAValider => ({
  id: 'e1',
  createdBy: 'A',
  contenuPar: null,
  contenuLe: null,
  viseePar: null,
  viseeLe: null,
  viseeEmpreinte: null,
  estGenereeParCloture: false,
  empreinte: 'h1',
  ...over,
});

describe('la faille de l’audit de sécurité · B réécrit le brouillard de A, puis le valide', () => {
  const reecrite = aValider({ contenuPar: 'B', contenuLe: new Date() });

  it('sous le double regard, B est écarté · il est l’auteur du dernier contenu', () => {
    const p = partitionnerLaValidation([reecrite], 'B', { doubleRegard: true, visa: false });
    expect(p.validables).toEqual([]);
    expect(p.refuseesSecondRegard).toEqual(['e1']);
  });

  it('A, qui n’a pas écrit ce contenu, le valide · il en est le second regard', () => {
    const p = partitionnerLaValidation([reecrite], 'A', { doubleRegard: true, visa: false });
    expect(p.validables).toEqual(['e1']);
  });

  it('un contenu d’auteur inconnu ne passe pas le double regard', () => {
    const p = partitionnerLaValidation([aValider({ contenuLe: new Date() })], 'C', { doubleRegard: true, visa: false });
    expect(p.refuseesAuteurInconnu).toEqual(['e1']);
    expect(p.validables).toEqual([]);
  });
});

describe('le circuit de visa à la validation', () => {
  const visee = aValider({ viseePar: 'B', viseeLe: new Date(), viseeEmpreinte: 'h1' });

  it('écarte la pièce non visée, et celle dont le contenu a changé depuis le visa', () => {
    const p = partitionnerLaValidation(
      [aValider({ id: 'nue' }), { ...visee, id: 'tombe', empreinte: 'h2' }, { ...visee, id: 'ok' }],
      'A',
      { doubleRegard: false, visa: true },
    );
    expect(p.nonVisees).toEqual(['nue']);
    expect(p.visaTombe).toEqual(['tombe']);
    expect(p.validables).toEqual(['ok']);
  });

  it('le visa ne dispense pas du double regard · l’auteur du contenu ne valide toujours pas', () => {
    const p = partitionnerLaValidation([visee], 'A', { doubleRegard: true, visa: true });
    expect(p.refuseesSecondRegard).toEqual(['e1']);
  });

  it('les écritures de clôture n’entrent pas au circuit', () => {
    const p = partitionnerLaValidation([aValider({ estGenereeParCloture: true, empreinte: null })], 'A', { doubleRegard: true, visa: true });
    expect(p.validables).toEqual(['e1']);
  });

  it('le motif dit les deux compteurs', () => {
    expect(motifNonVisees(0, 0)).toBeNull();
    expect(motifNonVisees(2, 1)).toMatch(/2 pièce\(s\) non visée\(s\) et 1 pièce\(s\) dont le contenu a changé/);
  });
});

describe('viser une écriture', () => {
  const base = {
    statut: 'BROUILLARD',
    estGenereeParCloture: false,
    estANouveauProvisoire: false,
    journalDeSituation: false,
    createdBy: 'A',
    contenuPar: null,
    contenuLe: null,
    viseePar: null,
    viseeLe: null,
    viseeEmpreinte: null,
  };

  it('l’auteur du dernier contenu ne vise pas le sien', () => {
    expect(motifRefusVisaEcriture(base, 'A', 'h', 'h').motif).toBe(MOTIF_VISA_PAR_SON_AUTEUR);
    expect(motifRefusVisaEcriture({ ...base, contenuPar: 'B', contenuLe: new Date() }, 'B', 'h', 'h').motif).toBe(MOTIF_VISA_PAR_SON_AUTEUR);
    // Le créateur vise le contenu qu'un collègue a réécrit.
    expect(motifRefusVisaEcriture({ ...base, contenuPar: 'B', contenuLe: new Date() }, 'A', 'h', 'h').motif).toBeNull();
  });

  it('le visa vise ce qui a été lu · un contenu changé depuis la lecture est refusé', () => {
    expect(motifRefusVisaEcriture(base, 'B', 'lue', 'actuelle').motif).toBe(MOTIF_CONTENU_CHANGE_DEPUIS_LA_LECTURE);
  });

  it('une pièce déjà visée sur son contenu présent ne se vise pas deux fois ; visa tombé, elle se revise', () => {
    const visee = { ...base, viseePar: 'B', viseeLe: new Date(), viseeEmpreinte: 'h' };
    expect(motifRefusVisaEcriture(visee, 'C', 'h', 'h').motif).toBe(MOTIF_DEJA_VISEE);
    expect(etatDuVisa(visee, 'h2')).toBe('VISA_TOMBE');
    expect(motifRefusVisaEcriture(visee, 'C', 'h2', 'h2').motif).toBeNull();
  });

  it('un auteur inconnu se vise, et la réponse le dit', () => {
    const r = motifRefusVisaEcriture({ ...base, contenuLe: new Date() }, 'A', 'h', 'h');
    expect(r.motif).toBeNull();
    expect(r.avertissement).toBe(AVERTISSEMENT_AUTEUR_INCONNU);
  });

  it('le brouillard seul se vise · ni validée, ni report provisoire, ni clôture, ni situation', () => {
    expect(motifRefusVisaEcriture({ ...base, statut: 'VALIDEE' }, 'B', 'h', 'h').motif).toMatch(/plus au brouillard/);
    expect(motifRefusVisaEcriture({ ...base, estANouveauProvisoire: true }, 'B', 'h', 'h').motif).toMatch(/provisoire/);
    expect(motifRefusVisaEcriture({ ...base, estGenereeParCloture: true }, 'B', 'h', 'h').motif).toMatch(/clôture/);
    expect(motifRefusVisaEcriture({ ...base, journalDeSituation: true }, 'B', 'h', 'h').motif).toMatch(/situation/);
  });

  it('un visa absent ou incomplet n’est jamais un visa', () => {
    expect(etatDuVisa({ viseePar: 'B', viseeLe: null, viseeEmpreinte: 'h' }, 'h')).toBe('A_VISER');
    expect(etatDuVisa({ viseePar: '', viseeLe: new Date(), viseeEmpreinte: 'h' }, 'h')).toBe('A_VISER');
  });

  it('le retrait · par son auteur ou l’administrateur, au brouillard', () => {
    const visee = { statut: 'BROUILLARD', viseePar: 'B', viseeLe: new Date(), viseeEmpreinte: 'h' };
    expect(motifRefusRetraitVisa(visee, 'B', false)).toBeNull();
    expect(motifRefusRetraitVisa(visee, 'C', true)).toBeNull();
    expect(motifRefusRetraitVisa(visee, 'C', false)).toMatch(/auteur du visa/);
    expect(motifRefusRetraitVisa({ ...visee, statut: 'VALIDEE' }, 'B', false)).toMatch(/plus au brouillard/);
  });
});

describe('le visa d’une facture', () => {
  it('l’auteur de l’enregistrement ne vise pas sa facture · une facture comptabilisée ne se vise plus', () => {
    expect(motifRefusVisaFacture({ saisiePar: 'A', viseePar: null, viseeLe: null, ecritureId: null, emiseParLeLogiciel: false }, 'A').motif).toMatch(/enregistré/);
    expect(motifRefusVisaFacture({ saisiePar: 'A', viseePar: null, viseeLe: null, ecritureId: 'e', emiseParLeLogiciel: false }, 'B').motif).toMatch(/comptabilisée/);
    expect(motifRefusVisaFacture({ saisiePar: 'A', viseePar: null, viseeLe: null, ecritureId: null, emiseParLeLogiciel: false }, 'B').motif).toBeNull();
    expect(motifRefusVisaFacture({ saisiePar: null, viseePar: null, viseeLe: null, ecritureId: null, emiseParLeLogiciel: false }, 'B').avertissement).toMatch(/avant le circuit/);
    // La facture d'abonnement émise par le logiciel n'est pas une pièce
    // d'avant le circuit · son motif propre (relecture du circuit, mineur).
    const abonnement = motifRefusVisaFacture({ saisiePar: null, viseePar: null, viseeLe: null, ecritureId: null, emiseParLeLogiciel: true }, 'B');
    expect(abonnement.motif).toBeNull();
    expect(abonnement.avertissement).toMatch(/émise par OmegaX/);
    expect(abonnement.avertissement).not.toMatch(/avant le circuit/);
  });

  it('sous le circuit, la comptabilisation d’une facture non visée est refusée ; hors du circuit, rien', () => {
    expect(motifComptabilisationSansVisa({ viseePar: null, viseeLe: null }, true)).toMatch(/pas visée/);
    expect(motifComptabilisationSansVisa({ viseePar: null, viseeLe: null }, false)).toBeNull();
    expect(motifComptabilisationSansVisa({ viseePar: 'B', viseeLe: new Date() }, true)).toBeNull();
  });
});

describe('la nature de la pièce · objet par objet', () => {
  it('la facture par sa liaison, l’opération diverse par son journal, le règlement par la trésorerie et un tiers', () => {
    expect(natureDeLaPiece({ journalType: 'ACHATS', aUneFacture: true, numerosComptes: ['60100000', '40110000'] })).toBe('FACTURE');
    expect(natureDeLaPiece({ journalType: 'GENERAL', aUneFacture: false, numerosComptes: ['63100000', '52110000'] })).toBe('OD');
    expect(natureDeLaPiece({ journalType: 'TRESORERIE', aUneFacture: false, numerosComptes: ['40110001', '52110000'] })).toBe('REGLEMENT');
    expect(natureDeLaPiece({ journalType: 'TRESORERIE', aUneFacture: false, numerosComptes: ['63100000', '52110000'] })).toBe('SAISIE');
    expect(natureDeLaPiece({ journalType: 'ACHATS', aUneFacture: false, numerosComptes: ['60100000', '40110000'] })).toBe('SAISIE');
  });
});
