import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Referentiel } from '@prisma/client';
import { REFERENTIELS_KEY } from '../../common/decorators/referentiels.decorator';
import { ReferentielGuard } from '../../common/guards/referentiel.guard';
import { ImmobilisationService } from './immobilisation.service';
import { TransfertGroupeController } from './transfert-groupe.controller';
import {
  DossierDuGroupe,
  FaitsDuBien,
  MOTIF_REFUS_SYCEBNL,
  debutDeDetention,
  estDepreciationAnterieure,
  montantsDuTransfert,
  motifRefusBien,
  motifRefusCompteLiaison,
  motifRefusDossiers,
  piecesDuTransfert,
} from './transfert-groupe';

/*
  LIGNE SAGE-L4, N° 73 · le transfert d'un bien entre deux dossiers du groupe.
  Ce qui casserait en silence · une liaison qui ne serait plus égale et de sens
  contraire dans les deux comptabilités (AUDCIF, Titre VII, fiche du compte 18),
  un bien qui sortirait par le 81 et entrerait par une acquisition (la liasse
  du groupe compterait une cession et un achat qui n'existent pas), une
  annuité doublée ou perdue l'année du transfert, et une association qui
  ferait passer un bien par le 58 que sa fiche réserve à la trésorerie.
*/

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

function bien(p: Partial<FaitsDuBien> = {}): FaitsDuBien {
  return {
    statut: 'EN_SERVICE',
    dateAcquisition: D('2026-01-01'),
    dateMiseEnService: D('2026-01-01'),
    compteEnCours: false,
    composantDe: false,
    composantsEnService: 0,
    degressifFiscal: false,
    reevaluations: 0,
    soldeSubventionNonRepris: 0,
    detteAleatoireNonSoldee: false,
    demantelement: false,
    locationAcquisition: false,
    unitesOeuvreDeprecie: false,
    dotationDeLExercicePassee: false,
    traitementsPosterieurs: [],
    exerciceAnterieurNonDote: null,
    dateEntreeGroupe: null,
    ...p,
  };
}

const siege: DossierDuGroupe = { id: 'S', dossierMereId: null, referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' };
const cellule: DossierDuGroupe = { id: 'C1', dossierMereId: 'S', referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' };
const cellule2: DossierDuGroupe = { id: 'C2', dossierMereId: 'S', referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' };

describe('transfert d’un bien dans le groupe · SYCEBNL refusé (gelé)', () => {
  it('la route est fermée au SYCEBNL par le serveur, pas seulement masquée', () => {
    expect(Reflect.getMetadata(REFERENTIELS_KEY, TransfertGroupeController)).toEqual([Referentiel.SYSCOHADA]);
    const gardes = Reflect.getMetadata(GUARDS_METADATA, TransfertGroupeController) ?? [];
    expect(gardes).toContain(ReferentielGuard);
  });

  it('deux dossiers SYCEBNL reçoivent le refus nommé · la fiche du compte 58 ne vise que la trésorerie', () => {
    const a = { ...siege, referentiel: 'SYCEBNL', systemeComptableSyscohada: null };
    const b = { ...cellule, referentiel: 'SYCEBNL', systemeComptableSyscohada: null };
    expect(motifRefusDossiers({ siegeId: 'S', cedant: a, receveur: b })).toBe(MOTIF_REFUS_SYCEBNL);
    expect(MOTIF_REFUS_SYCEBNL).toContain('fiche du compte 58');
    expect(MOTIF_REFUS_SYCEBNL).toContain('La question reste ouverte au suivi.');
  });
});

describe('transfert d’un bien dans le groupe · les dossiers', () => {
  it('le siège et une cellule, dans les deux sens', () => {
    expect(motifRefusDossiers({ siegeId: 'S', cedant: siege, receveur: cellule })).toBeNull();
    expect(motifRefusDossiers({ siegeId: 'S', cedant: cellule, receveur: siege })).toBeNull();
  });

  it('deux cellules entre elles · refus, le bien passe par le siège', () => {
    expect(motifRefusDossiers({ siegeId: 'S', cedant: cellule, receveur: cellule2 })).toMatch(/siège/);
  });

  it('un dossier hors du groupe, le même dossier, un autre référentiel, un autre système', () => {
    const etranger = { ...cellule, id: 'X', dossierMereId: 'AUTRE' };
    expect(motifRefusDossiers({ siegeId: 'S', cedant: siege, receveur: etranger })).toMatch(/hors du groupe/);
    expect(motifRefusDossiers({ siegeId: 'S', cedant: siege, receveur: null })).toMatch(/hors du groupe/);
    expect(motifRefusDossiers({ siegeId: 'S', cedant: siege, receveur: siege })).toMatch(/même dossier/);
    expect(motifRefusDossiers({ siegeId: 'S', cedant: siege, receveur: { ...cellule, referentiel: 'SYCEBNL' } })).toMatch(/référentiel/);
    expect(motifRefusDossiers({ siegeId: 'S', cedant: siege, receveur: { ...cellule, systemeComptableSyscohada: 'SMT' } })).toMatch(/système/);
  });
});

describe('transfert d’un bien dans le groupe · les refus du bien', () => {
  const date = D('2027-06-15');
  it('un bien ordinaire en service passe', () => {
    expect(motifRefusBien(bien(), date)).toBeNull();
  });
  it.each([
    ['déjà sorti', { statut: 'CEDEE' }, /sorti/],
    ['en cours', { compteEnCours: true }, /en cours/],
    ['composant', { composantDe: true }, /composant/],
    ['principal à composants', { composantsEnService: 2 }, /composant/],
    ['dérogatoire', { degressifFiscal: true }, /dérogatoire/],
    ['réévalué', { reevaluations: 1 }, /réévalué/],
    ['subvention à reprendre', { soldeSubventionNonRepris: 150_000 }, /150 000,00 non repris/],
    ['dotation de l’exercice déjà passée', { dotationDeLExercicePassee: true }, /Annulez d'abord/],
  ] as Array<[string, Partial<FaitsDuBien>, RegExp]>)('%s · refus nommé', (_n, faits, motif) => {
    expect(motifRefusBien(bien(faits), date)).toMatch(motif);
  });
  it('une subvention soldée par ses reprises ne retient plus le bien', () => {
    expect(motifRefusBien(bien({ soldeSubventionNonRepris: 0 }), date)).toBeNull();
    expect(motifRefusBien(bien({ soldeSubventionNonRepris: 0.004 }), date)).toBeNull();
  });

  it('B1 · un traitement d’un exercice qui finit après la date (N+1 ouvert avant la clôture de N) refuse, le plus récent nommé', () => {
    const m = motifRefusBien(
      bien({ traitementsPosterieurs: ["la dotation de l'exercice clos le 2028-12-31", "la dépréciation de l'exercice clos le 2027-12-31"] }),
      date,
    );
    expect(m).toMatch(/finit après le 2027-06-15/);
    expect(m).toContain("Annulez d'abord la dotation de l'exercice clos le 2028-12-31");
  });

  it('un exercice antérieur encore ouvert sans sa dotation refuse · elle ne se passerait plus', () => {
    const m = motifRefusBien(bien({ exerciceAnterieurNonDote: D('2026-12-31') }), date);
    expect(m).toMatch(/finit le 2026-12-31, encore ouvert/);
    expect(m).toMatch(/Passez d'abord cette dotation/);
  });

  it('un transfert ne précède ni la mise en service ni une entrée antérieure par transfert', () => {
    expect(motifRefusBien(bien({ dateMiseEnService: D('2027-07-01') }), date)).toMatch(/mise en service/);
    expect(motifRefusBien(bien({ dateEntreeGroupe: D('2027-06-15') }), date)).toMatch(/postérieur/);
    expect(motifRefusBien(bien({ dateEntreeGroupe: D('2027-03-01') }), date)).toBeNull();
  });
});

describe('transfert d’un bien dans le groupe · le compte de liaison', () => {
  it('184 ou 185 de détail et actif seulement · jamais le 186 ni le 187', () => {
    expect(motifRefusCompteLiaison({ numero: '18510000', typeCompte: 'DETAIL', estActif: true }, 'reçoit')).toBeNull();
    expect(motifRefusCompteLiaison({ numero: '18600000', typeCompte: 'DETAIL', estActif: true }, 'reçoit')).toMatch(/186/);
    expect(motifRefusCompteLiaison({ numero: '185', typeCompte: 'TOTAL', estActif: true }, 'cède')).toMatch(/regroupement/);
    expect(motifRefusCompteLiaison({ numero: '18410000', typeCompte: 'DETAIL', estActif: false }, 'cède')).toMatch(/sommeil/);
    expect(motifRefusCompteLiaison(null, 'cède')).toMatch(/cède/);
  });
});

describe('transfert d’un bien dans le groupe · les deux pièces', () => {
  const cedant = { bien: 'C-2441', amortissement: 'C-2844', depreciation: 'C-2944', liaison: 'C-185', dotation: 'C-6813' };
  const receveur = { bien: 'R-2441', amortissement: 'R-2844', depreciation: 'R-2944', liaison: 'R-185', dotation: 'R-6813' };
  const m = montantsDuTransfert({ valeurOrigine: 1_200_000, cumulAmortiAvant: 240_000, complement: 120_000, depreciations: 60_000 });

  it('les montants · valeur d’entrée, amortissements (complément compris), dépréciation, valeur nette', () => {
    expect(m).toEqual({ valeurOrigine: 1_200_000, amortissements: 360_000, complementDotation: 120_000, depreciations: 60_000, valeurNette: 780_000 });
  });

  it('chaque pièce s’équilibre, et les deux liaisons sont égales et de sens contraire (fiche du compte 18)', () => {
    const p = piecesDuTransfert(m, cedant, receveur);
    const solde = (l: typeof p.cedant) => l.reduce((s, x) => s + x.debit - x.credit, 0);
    expect(solde(p.cedant)).toBeCloseTo(0, 6);
    expect(solde(p.receveur)).toBeCloseTo(0, 6);
    const liaisonCedant = p.cedant.filter((l) => l.compteId === 'C-185').reduce((s, l) => s + l.debit - l.credit, 0);
    const liaisonReceveur = p.receveur.filter((l) => l.compteId === 'R-185').reduce((s, l) => s + l.debit - l.credit, 0);
    expect(liaisonCedant).toBe(780_000);
    expect(liaisonReceveur).toBe(-780_000);
  });

  it('le bien passe à sa valeur d’entrée avec ses amortissements et sa dépréciation · aucun 81 ni 82 (art. 35 et 36)', () => {
    const p = piecesDuTransfert(m, cedant, receveur);
    const comptes = new Set([...p.cedant, ...p.receveur].map((l) => l.compteId));
    expect([...comptes].sort()).toEqual(['C-185', 'C-2441', 'C-2844', 'C-2944', 'C-6813', 'R-185', 'R-2441', 'R-2844', 'R-2944'].sort());
    expect(p.receveur.find((l) => l.compteId === 'R-2441')!.debit).toBe(1_200_000);
    expect(p.receveur.find((l) => l.compteId === 'R-2844')!.credit).toBe(360_000);
    expect(p.receveur.find((l) => l.compteId === 'R-2944')!.credit).toBe(60_000);
    expect(p.cedant.find((l) => l.compteId === 'C-2441')!.credit).toBe(1_200_000);
  });

  it('une dépréciation sans compte 29 désigné des deux côtés ne passe pas en silence', () => {
    expect(() => piecesDuTransfert(m, { ...cedant, depreciation: null }, receveur)).toThrow(/29/);
  });

  it('un bien entièrement amorti passe sans ligne de liaison nulle', () => {
    const plein = montantsDuTransfert({ valeurOrigine: 500_000, cumulAmortiAvant: 500_000, complement: 0, depreciations: 0 });
    const p = piecesDuTransfert(plein, cedant, receveur);
    expect(p.cedant.some((l) => l.compteId === 'C-185')).toBe(false);
    expect(p.receveur.some((l) => l.compteId === 'R-185')).toBe(false);
  });
});

describe('transfert d’un bien dans le groupe · l’annuité de l’année du transfert se partage', () => {
  const svc = new ImmobilisationService({} as never, {} as never) as unknown as {
    calculerDotation: (...a: unknown[]) => number;
  };
  const dotation = (exercice: { dateDebut: Date; dateFin: Date }, anterieur: number, sansProrata: boolean, detention: Date | null) =>
    svc.calculerDotation(1_200_000, 0, 5, D('2026-01-01'), [], exercice, anterieur, 0, sansProrata, null, {}, detention);
  const ex2027 = { dateDebut: D('2027-01-01'), dateFin: D('2027-12-31') };
  const ex2028 = { dateDebut: D('2028-01-01'), dateFin: D('2028-12-31') };

  it('le premier jour de détention est le premier du mois qui suit l’entrée', () => {
    expect(debutDeDetention(D('2027-06-15'))!.toISOString().slice(0, 10)).toBe('2027-07-01');
    expect(debutDeDetention(D('2027-12-31'))!.toISOString().slice(0, 10)).toBe('2028-01-01');
    expect(debutDeDetention(null)).toBeNull();
  });

  it('celui qui reçoit en juin dote juillet à décembre · six douzièmes, et non l’annuité entière', () => {
    expect(dotation(ex2027, 360_000, false, debutDeDetention(D('2027-06-15')))).toBeCloseTo(120_000, 2);
    // Sans la date d'entrée, la même fiche doterait l'année entière · le
    // contrôle que ce test garde.
    expect(dotation(ex2027, 360_000, false, null)).toBeCloseTo(240_000, 2);
  });

  it('l’exercice suivant, l’annuité est pleine', () => {
    expect(dotation(ex2028, 480_000, false, debutDeDetention(D('2027-06-15')))).toBeCloseTo(240_000, 2);
  });

  it('au Système minimal, sans prorata, celui qui cède a pris l’année · rien chez celui qui reçoit cette année-là', () => {
    expect(dotation(ex2027, 480_000, true, debutDeDetention(D('2027-06-15')))).toBe(0);
    expect(dotation(ex2028, 480_000, true, debutDeDetention(D('2027-06-15')))).toBeCloseTo(240_000, 2);
  });

  it('un bien déprécié se ré-étale sur la durée restant au JOUR D’ENTRÉE, non au début de l’exercice', () => {
    // 600 000 sur quatre ans, 150 000 dotés en 2026, déprécié de 90 000 à la
    // clôture · 360 000 sur trois ans, 120 000 par an. Cédé le 15 juin 2027 ·
    // 60 000 de janvier à juin chez celui qui cède ; chez celui qui reçoit,
    // 300 000 sur trente mois · 60 000 de juillet à décembre, l'année entière
    // faisant bien 120 000.
    const recu = svc.calculerDotation(600_000, 0, 4, D('2026-01-01'), [], ex2027, 210_000, 90_000, false, null, {}, debutDeDetention(D('2027-06-15')));
    expect(recu).toBeCloseTo(60_000, 2);
    const cede = svc.calculerDotation(600_000, 0, 4, D('2026-01-01'), [{ montant: 150_000 }], { dateDebut: D('2027-01-01'), dateFin: D('2027-06-15') }, 0, 90_000, false, null, {}, null);
    expect(cede).toBeCloseTo(60_000, 2);
  });

  it('le contrôle de l’amortissement hors module écarte la pièce du transfert et son négatif par leur liaison', () => {
    // Vu sur vraie base le 2026-10-25 · une annulation défait la sortie et
    // retire la fiche née, si bien que plus rien ne retenait les pièces et
    // leurs négatifs · le contrôle 15 bis les aurait lus « hors du module ».
    const controles = readFileSync(join(__dirname, '..', 'controles', 'controles.service.ts'), 'utf8');
    const bloc = controles.slice(controles.indexOf('const lignes28 = '), controles.indexOf("code: 'AMORTISSEMENT_IMMO_HORS_MODULE'"));
    expect(bloc).toContain('transfertGroupe: null');
    expect(bloc).toContain('transfertGroupeNegatif: null');
    // L'annulation ne compte pas le transfert lui-même parmi les actes du
    // dossier qui a reçu · la clé d'exclusion est « Modèle.colonne ».
    expect(readFileSync(join(__dirname, 'transfert-groupe.service.ts'), 'utf8')).toContain("'TransfertImmobilisationGroupe.immobilisationId',");
  });

  it('la dépréciation qui a suivi le bien compte dès l’exercice d’entrée · le plan se ré-étale', () => {
    const suivie = { sens: 'DOTATION', nature: 'TRANSFERT_GROUPE', exercice: { dateFin: D('2027-12-31') } };
    const ordinaire = { sens: 'DOTATION', nature: 'PERTE_DE_VALEUR', exercice: { dateFin: D('2027-12-31') } };
    expect(estDepreciationAnterieure(suivie, ex2027)).toBe(true);
    expect(estDepreciationAnterieure(ordinaire, ex2027)).toBe(false);
    expect(estDepreciationAnterieure({ ...suivie, sens: 'REPRISE' }, ex2027)).toBe(false);
  });
});

describe('transfert d’un bien dans le groupe · la préparation se rejoue sous verrou (gelé)', () => {
  const source = readFileSync(join(__dirname, 'transfert-groupe.service.ts'), 'utf8');
  const corps = (nom: string) => {
    const debut = source.indexOf(`async ${nom}(`);
    const suivant = source.indexOf('\n  async ', debut + 1);
    return source.slice(debut, suivant === -1 ? undefined : suivant);
  };

  it('transférer · les deux verrous, puis la préparation rejouée avec le client de la transaction, puis la comparaison', () => {
    const t = corps('transferer');
    const verrou = t.indexOf('prendreLeVerrouDuDossier(tx');
    const rejeu = t.indexOf('this.preparer(tenantId, dto, tx)');
    const comparaison = t.indexOf('JSON.stringify(p.montants) !== JSON.stringify(avant.montants)');
    const premiereEcriture = t.indexOf('tx.ecriture.create');
    expect(verrou).toBeGreaterThan(0);
    expect(rejeu).toBeGreaterThan(verrou);
    expect(comparaison).toBeGreaterThan(rejeu);
    expect(premiereEcriture).toBeGreaterThan(comparaison);
  });

  it('la situation du bien et les contrôles d’entrée lisent par le client reçu, jamais par this.prisma', () => {
    const p = corps('preparer');
    expect(p).toContain('situationAuTransfert(cedant!.id, dto.immobilisationId, exerciceCedant, date, db)');
    expect(p.match(/controlesDEntree\([^;]*, db\);/g)?.length).toBe(2);
    expect(p).not.toContain('this.prisma.');
    const immo = readFileSync(join(__dirname, 'immobilisation.service.ts'), 'utf8');
    const s = immo.slice(immo.indexOf('async situationAuTransfert('), immo.indexOf('async sortir('));
    expect(s).not.toContain('this.prisma.');
  });

  it('annuler · usages, lettrage et pointage relus dans la transaction, après le verrou de la fiche reçue', () => {
    const a = corps('annuler');
    const tx = a.indexOf('transactionJournalisee(');
    expect(a.indexOf('FOR UPDATE')).toBeGreaterThan(tx);
    expect(a.indexOf('referencesVers(tx')).toBeGreaterThan(a.indexOf('FOR UPDATE'));
    expect(a.indexOf('motifLignesTenues(')).toBeGreaterThan(tx);
    // L'historique d'un traitement annulé ne retient pas la fiche · il se
    // détache, sans quoi le retrait tombait en 500 sur la clé RESTRICT.
    expect(a).toContain("'AnnulationTraitementImmobilisation.immobilisationId'");
    expect(a.indexOf('annulationTraitementImmobilisation.update(')).toBeLessThan(a.indexOf('tx.immobilisation.delete('));
    expect(a).toContain('annulez d\'abord le transfert suivant');
  });

  it('les journaux autorisés de l’utilisateur se jugent à la préparation · refus nommé, jamais un 403 tardif', () => {
    const p = corps('preparer');
    expect(p).toContain('journalHorsPerimetre(j.id, autorises)');
  });
});
