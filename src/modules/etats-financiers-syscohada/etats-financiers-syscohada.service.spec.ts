import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClasseCompte, TypeCompteDetailTotal } from '@prisma/client';
import { EtatsFinanciersSyscohadaService, lireDateArrete, subdivisionsLuesParLeTft } from './etats-financiers-syscohada.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import { ORDRE_AFFICHAGE_COMPTE_RESULTAT } from './correspondance-compte-resultat-syscohada';
import { CONTROLE_ZH_PAR_LES_FLUX } from './correspondance-tft-syscohada';
import { mentionComparatifSurOuverture, mentionExercicePrecedentVide } from '../etats-financiers/etats-financiers.communs';

/**
 * Ce spec ne re-teste pas les tables de correspondance (leurs specs voisins
 * s'en chargent, poste par poste et compte par compte contre le plan semé) :
 * il teste ce que le SERVICE peut casser EN SILENCE, c'est-à-dire un état qui
 * ne boucle plus.
 *
 * Les quatre bouclages du texte officiel, chacun couvert ici :
 *  - BILAN · total actif = total passif (AUDCIF Titre IX ch. 3 section 2, les
 *    deux rubriques BZ et DZ portant le même libellé « TOTAL GÉNÉRAL ») ;
 *  - COMPTE DE RÉSULTAT · XI, obtenu par les sommes du modèle (ch. 4 section
 *    2, « logique de signe »), doit valoir le solde de TOUTES les classes de
 *    gestion, celui-là même que le bilan loge en CJ ;
 *  - TFT · ZH par le cumul des flux (G + A) doit valoir ZH par le bilan
 *    (« Contrôle : Trésorerie actif N – Trésorerie passif N », ch. 5 section
 *    2), les deux calculs restant indépendants ;
 *  - DÉCOUVERT BANCAIRE · un 52 créditeur va au passif (DR) et n'est PAS
 *    laissé en négatif à l'actif : c'est le cas où un bilan reste « équilibré »
 *    tout en étant faux du double du découvert.
 *
 * Les numéros de comptes utilisés sont ceux du plan SYSCOHADA semé
 * (`compte-seed-syscohada.ts`, généré depuis le skill `syscohada`), à une
 * exception commentée sur place : le compte de gestion hors plan, qui teste
 * précisément le comportement face à un plan personnalisé.
 */

/**
 * Fabrique une ligne de balance telle que `EcritureService.balance()` la
 * renvoie · les six agrégats, dont la scission report / mouvement sans
 * laquelle le tableau de flux lirait un report à-nouveau comme une
 * acquisition de l'exercice.
 */
function ligne(
  numero: string,
  classe: ClasseCompte,
  mouvementDebit: number,
  mouvementCredit: number,
  report: { debit?: number; credit?: number } = {},
  typeCompte: TypeCompteDetailTotal = TypeCompteDetailTotal.DETAIL,
) {
  const reportDebit = report.debit ?? 0;
  const reportCredit = report.credit ?? 0;
  const totalDebit = reportDebit + mouvementDebit;
  const totalCredit = reportCredit + mouvementCredit;
  return {
    compteId: `id-${numero}`,
    numero,
    intitule: `Compte ${numero}`,
    classe,
    typeCompte,
    totalDebit,
    totalCredit,
    reportDebit,
    reportCredit,
    mouvementDebit,
    mouvementCredit,
    solde: totalDebit - totalCredit,
  };
}

type LigneBalance = ReturnType<typeof ligne>;

function serviceAvecExercices(
  lignesParExercice: Record<string, LigneBalance[]>,
  exercices: Array<{ id: string; dateDebut: Date }> = [],
  // Lot 14 · l'écriture de réévaluation du module, par exercice · par DÉFAUT aucune.
  reevaluationsParExercice: Record<string, Map<string, { debit: number; credit: number }>> = {},
  // L'OUVERTURE lue avant la clôture de l'exercice (`avantLaCloture`,
  // paquet 1, A4) · par DÉFAUT les mêmes lignes que l'exercice entier.
  ouverturesParExercice: Record<string, LigneBalance[]> = {},
) {
  const ecritureService = {
    balance: jest.fn().mockImplementation((
      _tenantId: string,
      exerciceId: string,
      _inclureBrouillard?: boolean,
      _arreteAu?: Date,
      options?: { avantLaCloture?: boolean },
    ) => {
      const lignes = (options?.avantLaCloture ? ouverturesParExercice[exerciceId] : undefined) ?? lignesParExercice[exerciceId] ?? [];
      return Promise.resolve({
        lignes,
        totaux: {
          debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
          credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
        },
      });
    }),
    // Bloquant 2 · aucune ouverture saisie en OD au premier jour.
    ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
    mouvementsDeReevaluation: jest.fn().mockImplementation((_t: string, exerciceId: string | null) =>
      Promise.resolve((exerciceId && reevaluationsParExercice[exerciceId]) || new Map()),
    ),
  } as unknown as EcritureService;
  const exerciceService = {
    // ExerciceService.lister() trie par dateDebut décroissant · répliqué ici,
    // c'est sur ce tri que `trouverExerciceN1` s'appuie.
    lister: jest.fn().mockResolvedValue([...exercices].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())),
  } as unknown as ExerciceService;
  return new EtatsFinanciersSyscohadaService(ecritureService, exerciceService);
}

/**
 * Un seul exercice ('e1'), sans antérieur. L'exercice est DÉCLARÉ au dossier
 * de la doublure · depuis l'audit final F222, un exercice que le dossier ne
 * connaît pas est refusé (404), et une doublure qui ne le déclarerait pas
 * testerait ce refus au lieu de l'état.
 */
function serviceAvecBalance(lignes: LigneBalance[]) {
  return serviceAvecExercices({ e1: lignes }, [
    { id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') } as never,
  ]);
}

const C1 = ClasseCompte.CLASSE_1;
const C2 = ClasseCompte.CLASSE_2;
const C4 = ClasseCompte.CLASSE_4;
const C5 = ClasseCompte.CLASSE_5;
const C6 = ClasseCompte.CLASSE_6;
const C7 = ClasseCompte.CLASSE_7;
const C8 = ClasseCompte.CLASSE_8;
const C9 = ClasseCompte.CLASSE_9;

/**
 * DOSSIER DE RÉFÉRENCE · deux exercices, balances équilibrées, et un jeu
 * d'écritures choisi pour que le tableau des flux BOUCLE EXACTEMENT (écart 0).
 * Il sert aux trois états à la fois, ce qui est le point : les trois lisent la
 * même balance et doivent se répondre.
 *
 * Exercice e1 (N-1) · le dossier ouvre : capital 10 000 souscrit et versé en
 * banque, un véhicule de 6 000 amorti de 1 000, 2 000 de créances clients,
 * 500 de dettes fournisseurs, 3 500 en banque.
 *   Actif 5 000 (AN net) + 2 000 (BI) + 3 500 (BS) = 10 500
 *   Passif 10 000 (CA) + 500 (DJ) = 10 500
 *
 * Exercice e2 (N) · reprise en report à-nouveau, puis 8 000 de ventes dont
 * 7 000 encaissées, 5 000 d'achats dont 4 800 réglés, 1 500 de salaires payés,
 * 500 de dotation aux amortissements (sans trésorerie), et une écriture de
 * liaison siège/établissement de 400 (186 contre 187) qu'AUCUN poste du bilan
 * ni du tableau de flux ne réclame · anomalie n° 5 de la table du bilan et
 * n° 17 de celle du TFT, présente ici exprès pour vérifier qu'elle ressort.
 *   Actif 4 500 (AN net) + 3 000 (BI) + 4 200 (BS) = 11 700
 *   Passif 10 000 (CA) + 1 000 (CJ) + 700 (DJ) = 11 700
 *   Trésorerie : 3 500 à l'ouverture, 4 200 à la clôture, variation +700.
 */
const LIGNES_E1: LigneBalance[] = [
  ligne('10130000', C1, 0, 10000),
  ligne('24510000', C2, 6000, 0),
  ligne('28450000', C2, 0, 1000),
  ligne('41110000', C4, 2000, 0),
  ligne('40110000', C4, 0, 500),
  ligne('52110000', C5, 3500, 0),
];

const LIGNES_E2: LigneBalance[] = [
  ligne('10130000', C1, 0, 0, { credit: 10000 }),
  ligne('24510000', C2, 0, 0, { debit: 6000 }),
  ligne('28450000', C2, 0, 500, { credit: 1000 }),
  ligne('41110000', C4, 8000, 7000, { debit: 2000 }),
  ligne('40110000', C4, 4800, 5000, { credit: 500 }),
  ligne('52110000', C5, 7000, 6300, { debit: 3500 }),
  ligne('70110000', C7, 0, 8000), // TA · ventes de marchandises
  ligne('60110000', C6, 5000, 0), // RA · achats de marchandises
  ligne('66110000', C6, 1500, 0), // RK · charges de personnel
  ligne('68130000', C6, 500, 0), // RL · dotation aux amortissements
  ligne('18600000', C1, 400, 0), // compte de liaison charges · sans poste
  ligne('18700000', C1, 0, 400), // compte de liaison produits · sans poste
];

const EXERCICES = [
  { id: 'e1', dateDebut: new Date('2025-01-01') },
  { id: 'e2', dateDebut: new Date('2026-01-01') },
];

function serviceDeReference() {
  return serviceAvecExercices({ e1: LIGNES_E1, e2: LIGNES_E2 }, EXERCICES);
}

describe('EtatsFinanciersSyscohadaService', () => {
  // =========================================================================
  describe('bilan', () => {
    const poste = (bilan: Awaited<ReturnType<EtatsFinanciersSyscohadaService['bilan']>>, ref: string) =>
      [...bilan.actif, ...bilan.passif].find((p) => p.ref === ref);

    // Q3 DES CAS CHIFFRÉS DE LA CLÔTURE (2026-10-07) · un dossier repris
    // sans exercice N-1 tenu a son comparatif · le bilan d'ouverture importé
    // EST le bilan de clôture N-1 (AUDCIF art. 34). Le compte de résultat
    // N-1, lui, reste vide, avec l'issue.
    it('dossier repris · la colonne N-1 du bilan est le bilan d’ouverture, dit ; le compte de résultat N-1 reste vide avec l’issue', async () => {
      const lignes = [
        ligne('10130000', C1, 0, 0, { credit: 2000 }),
        ligne('12100000', C1, 0, 0, { credit: 500 }),
        ligne('24510000', C2, 0, 0, { debit: 2100 }),
        ligne('41110000', C4, 0, 0, { debit: 800 }),
        ligne('40110000', C4, 0, 0, { credit: 600 }),
        ligne('52110000', C5, 3000, 0, { debit: 200 }),
        ligne('70110000', C7, 0, 3000),
      ];
      const bilan = await serviceAvecBalance(lignes).bilan('t1', 'e1');
      expect({
        disponible: bilan.exerciceN1Disponible,
        comparatif: bilan.comparatif,
        mention: bilan.mentionComparatif,
        bz: bilan.totalActifN1,
        dz: bilan.totalPassifN1,
        bs: poste(bilan, 'BS')?.montantN1,
        ch: poste(bilan, 'CH')?.montantN1,
      }).toEqual({
        disponible: false,
        comparatif: 'BILAN_D_OUVERTURE',
        mention: expect.stringContaining('AUDCIF art. 34'),
        bz: 3100,
        dz: 3100,
        bs: 200,
        ch: 500,
      });
      const cr = await serviceAvecBalance(lignes).compteDeResultat('t1', 'e1');
      expect(cr.lignes.every((l) => l.montantN1 === undefined)).toBe(true);
      expect(cr.motifComparatifAbsent).toContain('importez-y sa balance de clôture');
    });

    // PAQUET 1, A4 (reproduit sur vraie base le 2026-10-09) · la clôture de
    // 2026 vire au 121, à la date de FIN, les 2 000 000 de résultat 2025 que
    // le bilan d'ouverture importé portait au 13 · la balance range ce
    // virement en colonne report. Lue sur ce report, la colonne N-1 montrait
    // CJ à zéro et CH à 2 000 000 ; le bilan d'ouverture (AUDCIF art. 34) les
    // porte au 13. Elle se lit avant la clôture (`chargerOuverture`).
    describe('Paquet 1, A4 · l’ouverture d’un premier exercice clôturé se lit avant le virement du 13', () => {
      const apresCloture = [
        ligne('52110000', C5, 500_000, 0, { debit: 12_000_000 }),
        ligne('10130000', C1, 0, 0, { credit: 10_000_000 }),
        ligne('13100000', C1, 0, 0, { debit: 2_000_000, credit: 2_000_000 }),
        ligne('12100000', C1, 0, 0, { credit: 2_000_000 }),
        ligne('70110000', C7, 0, 500_000),
      ];
      const avantCloture = [
        ligne('52110000', C5, 500_000, 0, { debit: 12_000_000 }),
        ligne('10130000', C1, 0, 0, { credit: 10_000_000 }),
        ligne('13100000', C1, 0, 0, { credit: 2_000_000 }),
        ligne('70110000', C7, 0, 500_000),
      ];
      const E1 = { id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') } as never;
      const service = () => serviceAvecExercices({ e1: apresCloture }, [E1], {}, { e1: avantCloture });

      it('la colonne N-1 porte le résultat 2025 au 13 (CJ) et aucun report à nouveau (CH)', async () => {
        const bilan = await service().bilan('t1', 'e1');
        expect({
          comparatif: bilan.comparatif,
          cjN1: poste(bilan, 'CJ')?.montantN1,
          chN1: poste(bilan, 'CH')?.montantN1,
          dzN1: bilan.totalPassifN1,
          cjN: poste(bilan, 'CJ')?.montant,
          chN: poste(bilan, 'CH')?.montant,
        }).toEqual({ comparatif: 'BILAN_D_OUVERTURE', cjN1: 2_000_000, chN1: 0, dzN1: 12_000_000, cjN: 500_000, chN: 2_000_000 });
      });

      it('bilan, compte de résultat et tableau des flux demandent l’ouverture avant la clôture', async () => {
        const s = service();
        await s.bilan('t1', 'e1');
        await s.compteDeResultat('t1', 'e1');
        const tft = await s.tableauFluxTresorerie('t1', 'e1');
        const balance = (s as any).ecritureService.balance as jest.Mock;
        const ouvertures = balance.mock.calls.filter((c) => c[4]?.avantLaCloture);
        expect(ouvertures).toHaveLength(3);
        for (const c of ouvertures) expect(c.slice(0, 3)).toEqual(['t1', 'e1', false]);
        expect((tft.lignes.find((l: any) => l.ref === 'ZA') as any)?.montant).toBe(12_000_000);
        expect(tft.mentionOuverture).toBe(mentionComparatifSurOuverture('SYSCOHADA'));
      });

      it('la colonne N-1 du tableau des flux de l’exercice suivant part de la même ouverture', async () => {
        const E2 = { id: 'e2', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z') } as never;
        const s = serviceAvecExercices(
          { e1: apresCloture, e2: [ligne('52110000', C5, 0, 0, { debit: 12_500_000 }), ligne('10130000', C1, 0, 0, { credit: 10_000_000 }), ligne('12100000', C1, 0, 0, { credit: 2_500_000 })] },
          [E1, E2],
          {},
          { e1: avantCloture },
        );
        const tft = await s.tableauFluxTresorerie('t1', 'e2');
        const balance = (s as any).ecritureService.balance as jest.Mock;
        expect(balance.mock.calls.filter((c) => c[4]?.avantLaCloture).map((c) => c[1])).toEqual(['e1']);
        expect((tft.lignes.find((l: any) => l.ref === 'ZA') as any)?.montantN1).toBe(12_000_000);
      });
    });

    it('société qui naît · aucune colonne N-1, l’ouverture présumée nulle DITE', async () => {
      const lignes = [ligne('10130000', C1, 0, 1000), ligne('52110000', C5, 1000, 0)];
      const bilan = await serviceAvecBalance(lignes).bilan('t1', 'e1');
      expect({ comparatif: bilan.comparatif, mention: bilan.mentionComparatif, bz: bilan.totalActifN1 }).toEqual({
        comparatif: null,
        mention: expect.stringContaining('présumée nulle'),
        bz: undefined,
      });
      expect((await serviceAvecBalance(lignes).compteDeResultat('t1', 'e1')).motifComparatifAbsent).toBeNull();
    });

    it('nomme un 104 non soldé, avec sa fiche, sans répéter les non rattachés (audit final F92)', async () => {
      const bilan = await serviceAvecBalance([
        ligne('10410000', C1, 300, 0),
        // Un 104 bien soldé dans l'exercice ne se signale pas.
        ligne('10420000', C1, 200, 200),
        ligne('58500000', C5, 50, 0),
        ligne('10130000', C1, 0, 350),
      ]).bilan('t1', 'e1');
      expect(bilan.comptesASolderALaCloture.map((c) => c.numero)).toEqual(['10410000']);
      expect(bilan.comptesASolderALaCloture[0].source).toContain('COMPTE 104');
      expect(bilan.comptesASolderALaCloture[0].montant).toBe(300);
      // Le 585 n'a aucun poste · il est déjà nommé parmi les non rattachés.
      expect(bilan.comptesNonRattaches.map((c) => c.numero)).toContain('58500000');
    });

    it('ne les signale pas sur une situation intermédiaire, où ils sont légitimes', async () => {
      const service = serviceAvecExercices({ e1: [ligne('10410000', C1, 300, 0), ligne('10130000', C1, 0, 300)] }, [
        { id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') } as never,
      ]);
      expect((await service.bilan('t1', 'e1', '2026-06-30')).comptesASolderALaCloture).toEqual([]);
      // Et la situation au DERNIER jour de l'exercice n'est plus refusée (audit final F90).
      await expect(service.bilan('t1', 'e1', '2026-12-31')).resolves.toBeDefined();
    });

    it('équilibre le dossier de référence et loge chaque compte au poste du ch. 7', async () => {
      const bilan = await serviceDeReference().bilan('t1', 'e2');

      expect(poste(bilan, 'AN')?.brut).toBe(6000);
      expect(poste(bilan, 'AN')?.amortissement).toBe(1500); // magnitude POSITIVE, colonne officielle
      expect(poste(bilan, 'AN')?.montant).toBe(4500); // net = brut - amortissements
      expect(poste(bilan, 'BI')?.montant).toBe(3000);
      expect(poste(bilan, 'BS')?.montant).toBe(4200);
      expect(poste(bilan, 'CA')?.montant).toBe(10000);
      expect(poste(bilan, 'CJ')?.montant).toBe(1000);
      expect(poste(bilan, 'DJ')?.montant).toBe(700);

      // Totalisations du modèle : AI = AJ à AN, AZ = AD + AI + AP + AQ
      // (anomalie n° 13 de la table : AP est une rubrique sœur de AI).
      expect(poste(bilan, 'AI')?.montant).toBe(4500);
      expect(poste(bilan, 'AZ')?.montant).toBe(4500);
      expect(poste(bilan, 'BG')?.montant).toBe(3000);
      expect(poste(bilan, 'BT')?.montant).toBe(4200);
      expect(poste(bilan, 'CP')?.montant).toBe(11000);
      expect(poste(bilan, 'DP')?.montant).toBe(700);

      expect(bilan.totalActif).toBe(11700);
      expect(bilan.totalPassif).toBe(11700);
      expect(bilan.equilibre).toBe(true);
      expect(poste(bilan, 'BZ')?.estTotal).toBe(true);
      expect(poste(bilan, 'AN')?.estTotal).toBe(false);
    });

    it('n’imprime pas de drill-down sous une rubrique de totalisation', async () => {
      const bilan = await serviceDeReference().bilan('t1', 'e2');
      // Les comptes de AN sont déjà sous AN : les répéter sous AI, AZ puis BZ
      // ferait croire à un triple compte du même véhicule.
      expect(poste(bilan, 'BZ')?.comptes).toEqual([]);
      expect(poste(bilan, 'AN')?.comptes.map((c) => c.numero)).toEqual(['24510000', '28450000']);
    });

    it('porte le comparatif N-1 quand l’exercice antérieur existe, et rien quand il n’existe pas', async () => {
      const avecN1 = await serviceDeReference().bilan('t1', 'e2');
      expect(avecN1.exerciceN1Disponible).toBe(true);
      expect(poste(avecN1, 'AN')?.montantN1).toBe(5000); // 6000 - 1000
      expect(avecN1.totalActifN1).toBe(10500);

      const sansN1 = await serviceDeReference().bilan('t1', 'e1');
      expect(sansN1.exerciceN1Disponible).toBe(false);
      // Jamais un faux zéro : le comparatif est ABSENT, il ne vaut pas 0.
      expect(poste(sansN1, 'AN')?.montantN1).toBeUndefined();
      expect(sansN1.totalActifN1).toBeUndefined();
    });

    /**
     * DÉCOUVERT BANCAIRE · ch. 7, clés de lecture : « 52, 53 vont en BS si
     * débiteurs, DR si créditeurs ». Laisser le compte des deux côtés compte
     * le découvert DEUX FOIS, en négatif à l'actif et en positif au passif :
     * le bilan reste « équilibré » et se trouve faux du double du découvert.
     */
    it('transfère un 52 créditeur de BS vers DR, sans double comptage', async () => {
      const service = serviceAvecBalance([
        ligne('10130000', C1, 0, 700),
        ligne('57110000', C5, 1000, 0), // caisse débitrice · reste en BS
        ligne('52110000', C5, 0, 300), // banque à découvert · part en DR
      ]);

      const bilan = await service.bilan('t1', 'e1');

      expect(poste(bilan, 'BS')?.montant).toBe(1000);
      expect(poste(bilan, 'BS')?.comptes.map((c) => c.numero)).toEqual(['57110000']);
      expect(poste(bilan, 'DR')?.montant).toBe(300);
      expect(poste(bilan, 'DR')?.comptes.map((c) => c.numero)).toEqual(['52110000']);
      // 700 si le découvert était resté en négatif à l'actif tout en étant
      // repris au passif ; 1 300 s'il avait été compté deux fois en positif.
      expect(bilan.totalActif).toBe(1000);
      expect(poste(bilan, 'BT')?.montant).toBe(1000);
      expect(poste(bilan, 'DT')?.montant).toBe(300);
      expect(bilan.totalPassif).toBe(1000);
      expect(bilan.equilibre).toBe(true);
    });

    it('laisse un 57 créditeur VISIBLE en négatif dans BS · aucun poste de passif ne l’accueille', async () => {
      // Anomalie n° 3 de la table : appliquer à la lettre le qualificatif
      // « soldes débiteurs » de BS ferait DISPARAÎTRE du bilan une caisse
      // créditrice, sans autre signe qu'un total faux.
      const service = serviceAvecBalance([
        ligne('10130000', C1, 0, 700),
        ligne('52110000', C5, 1000, 0),
        ligne('57110000', C5, 0, 300),
      ]);

      const bilan = await service.bilan('t1', 'e1');

      expect(poste(bilan, 'BS')?.montant).toBe(700);
      expect(poste(bilan, 'BS')?.comptes.find((c) => c.numero === '57110000')?.montant).toBe(-300);
      expect(bilan.equilibre).toBe(true);
    });

    it('soustrait l’amortissement du brut, jamais l’inverse', async () => {
      const service = serviceAvecBalance([ligne('24510000', C2, 5000, 0), ligne('28450000', C2, 0, 1500)]);
      const bilan = await service.bilan('t1', 'e1');
      // 6 500 si le solde créditeur de l'amortissement avait été signé en
      // positif dans la somme du net au lieu d'y être ajouté tel quel.
      expect(poste(bilan, 'AN')?.montant).toBe(3500);
    });

    it('ignore la classe 9, hors états de synthèse selon le ch. 7', async () => {
      const service = serviceAvecBalance([
        ligne('52110000', C5, 100, 0),
        ligne('10130000', C1, 0, 100),
        ligne('90100000', C9, 500, 0),
      ]);
      const bilan = await service.bilan('t1', 'e1');
      expect(bilan.totalActif).toBe(100);
      expect(bilan.comptesNonRattaches.some((c) => c.numero === '90100000')).toBe(false);
    });

    it('exclut les comptes Total, simple agrégat d’affichage des comptes Détail', async () => {
      const service = serviceAvecBalance([
        ligne('52110000', C5, 100, 0),
        ligne('52', C5, 100, 0, {}, TypeCompteDetailTotal.TOTAL),
        ligne('10130000', C1, 0, 100),
      ]);
      const bilan = await service.bilan('t1', 'e1');
      expect(bilan.totalActif).toBe(100); // 200 si le compte Total avait été additionné
    });

    it('liste les comptes de bilan sans poste, jamais absorbés dans un poste voisin', async () => {
      const bilan = await serviceDeReference().bilan('t1', 'e2');
      // 186 et 187 (comptes de liaison) n'ont aucun poste au ch. 7 · anomalie
      // n° 5 de la table. Ils doivent ressortir NOMMÉS, pas être glissés dans
      // DA (« 16, 181, 182, 183, 184 ») dont ils ne font pas partie.
      expect(bilan.comptesNonRattaches.map((c) => c.numero).sort()).toEqual(['18600000', '18700000']);
    });

    /**
     * Anomalie n° 7 · le 130 (résultat de l'exercice PRÉCÉDENT en instance
     * d'affectation) n'est ni dans CJ ni dans CH tant que l'assemblée n'a pas
     * statué. Le mettre dans CJ présenterait le résultat N-1 comme résultat N
     * sur toute balance arrêtée avant l'assemblée. Le 585 (virements de fonds)
     * doit être soldé à la clôture, anomalie n° 4.
     */
    it('laisse le 130 et le 585 orphelins et les signale, plutôt que de les ranger d’office', async () => {
      const service = serviceAvecBalance([
        ligne('13010000', C1, 0, 800), // résultat en instance d'affectation
        ligne('58500000', C5, 200, 0), // virement de fonds non soldé
        ligne('52110000', C5, 800, 200),
      ]);

      const bilan = await service.bilan('t1', 'e1');

      expect(bilan.comptesNonRattaches.map((c) => c.numero).sort()).toEqual(['13010000', '58500000']);
      expect(poste(bilan, 'CJ')?.montant).toBe(0); // le 130 n'est PAS le résultat de N
      expect(bilan.equilibre).toBe(false); // et le déséquilibre le dit
    });

    it('prend le résultat dans le compte 13 APRÈS clôture, quand les classes de gestion sont soldées', async () => {
      const service = serviceAvecBalance([
        ligne('52110000', C5, 11000, 0),
        ligne('10130000', C1, 0, 10000),
        ligne('13100000', C1, 0, 1000), // Résultat net : bénéfice
      ]);

      const bilan = await service.bilan('t1', 'e1');

      expect(poste(bilan, 'CJ')?.montant).toBe(1000);
      expect(bilan.controle.resultatClasses678).toBe(0);
      expect(bilan.controle.resultatCompte13).toBe(1000);
      expect(bilan.equilibre).toBe(true);
    });

    it('B1 · avant l\'affectation, CJ additionne le résultat de N resté au 131 et celui de N+1 en cours · le bilan s\'équilibre', async () => {
      // Passe V1, constat B1 · Titre VII COMPTE 13, « L'affectation du
      // résultat d'un exercice est décidée par les organes compétents au
      // cours de l'exercice suivant ; le compte 13 est donc soldé lors de la
      // comptabilisation de cette affectation ». Le 131 porte le bénéfice de
      // N (1 000), les classes 6/7/8 celui de N+1 en cours (500) · CJ les
      // additionne. Lu sur une seule source, CJ perdait 1 000 et le bilan
      // sortait déséquilibré d'autant (15 288 000 au banc).
      const service = serviceAvecBalance([
        ligne('52110000', C5, 11000, 0),
        ligne('10130000', C1, 0, 10000),
        ligne('13100000', C1, 0, 1000),
        ligne('41110000', C4, 500, 0),
        ligne('70110000', C7, 0, 500),
      ]);

      const bilan = await service.bilan('t1', 'e1');

      expect(bilan.controle).toEqual({ resultatClasses678: 500, resultatCompte13: 1000, resultatAnterieurNonAffecte: 1000 });
      expect(poste(bilan, 'CJ')?.montant).toBe(1500);
      expect(bilan.totalActif).toBe(11500);
      expect(bilan.totalPassif).toBe(11500);
      expect(bilan.equilibre).toBe(true);
    });

    it('BLOQUANT (relecture V1) · exercice CLÔTURÉ sans le virement du résultat précédent · CJ le porte, et il est NOMMÉ', async () => {
      // Perte 2026 de 46 072 000 non affectée, exercice 2027 clôturé avant
      // que la clôture ne la vire au report à nouveau (fiche du compte 13 ·
      // « En fin d'exercice, le résultat de l'exercice précédent non affecté
      // [...] est viré au compte de report à nouveau »). Le 139 garde
      // l'à-nouveau, la gestion de 2027 rend 600 000. CJ les additionne et
      // le bilan s'équilibre · sans un mot, il présentait deux résultats
      // comme « Résultat net de l'exercice ».
      const lignes = [
        ligne('52110000', C5, 1_000_000, 400_000, { debit: 53_928_000 }),
        ligne('10130000', C1, 0, 0, { credit: 100_000_000 }),
        ligne('13900000', C1, 0, 0, { debit: 46_072_000 }),
        ligne('70110000', C7, 0, 1_000_000),
        ligne('60110000', C6, 400_000, 0),
      ];
      const exercice = (statut: string) =>
        [{ id: 'e1', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z'), statut } as never];

      const clos = await serviceAvecExercices({ e1: lignes }, exercice('CLOTURE')).bilan('t1', 'e1');
      expect(poste(clos, 'CJ')?.montant).toBe(600_000 - 46_072_000);
      expect(clos.equilibre).toBe(true);
      expect(clos.controle.resultatAnterieurNonAffecte).toBe(-46_072_000);
      expect(clos.resultatAnterieurNonVire).toEqual(expect.objectContaining({ montant: -46_072_000, poste: 'CJ' }));
      expect(clos.resultatAnterieurNonVire!.motif).toContain('AUDCIF, Titre VII, compte 13');
      // Au tableau des comptes à solder, avec la fiche du compte 13.
      expect(clos.comptesASolderALaCloture).toEqual([
        expect.objectContaining({ numero: '13900000', montant: 46_072_000, source: expect.stringContaining('Titre VII COMPTE 13') }),
      ]);

      // Ouvert · la même balance est celle d'avant l'assemblée, légitime.
      const ouvert = await serviceAvecExercices({ e1: lignes }, exercice('OUVERT')).bilan('t1', 'e1');
      expect(ouvert.resultatAnterieurNonVire).toBeNull();
      expect(ouvert.comptesASolderALaCloture).toEqual([]);
      expect(poste(ouvert, 'CJ')?.montant).toBe(600_000 - 46_072_000);
    });

    it('paquet 1, A1 · la colonne N-1 de l’exercice suivant reprend CJ tel quel, et le DIT', async () => {
      // 2027 clôturé avant le virement (la balance du BLOQUANT ci-dessus),
      // 2028 ouvert. La colonne N-1 de 2028 reprend CJ de 2027 · 600 000 de
      // l'exercice et -46 072 000 de 2026 (AUDCIF art. 34, dernier tiret, rien
      // n'est recalculé), et elle le dit. Sans l'avis, rien ne le disait.
      const lignes2027 = [
        ligne('52110000', C5, 1_000_000, 400_000, { debit: 53_928_000 }),
        ligne('10130000', C1, 0, 0, { credit: 100_000_000 }),
        ligne('13900000', C1, 0, 0, { debit: 46_072_000 }),
        ligne('70110000', C7, 0, 1_000_000),
        ligne('60110000', C6, 400_000, 0),
      ];
      const lignes2028 = [ligne('52110000', C5, 0, 0, { debit: 54_528_000 }), ligne('10130000', C1, 0, 0, { credit: 100_000_000 })];
      const exercices = (statut2027: string) => [
        { id: 'e0', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z'), statut: statut2027 } as never,
        { id: 'e1', dateDebut: new Date('2028-01-01T00:00:00Z'), dateFin: new Date('2028-12-31T00:00:00Z'), statut: 'OUVERT' } as never,
      ];

      const bilan = await serviceAvecExercices({ e0: lignes2027, e1: lignes2028 }, exercices('CLOTURE')).bilan('t1', 'e1');
      expect(poste(bilan, 'CJ')?.montantN1).toBe(600_000 - 46_072_000);
      expect(bilan.resultatAnterieurNonVire).toBeNull();
      expect(bilan.resultatAnterieurNonVireN1).toEqual(expect.objectContaining({ montant: -46_072_000, poste: 'CJ' }));
      expect(bilan.resultatAnterieurNonVireN1!.motif).toMatch(/^Colonne N-1 · /);

      // 2027 encore ouvert · sa balance est celle d'avant l'assemblée, la colonne N-1 ne dit rien.
      const ouvert = await serviceAvecExercices({ e0: lignes2027, e1: lignes2028 }, exercices('OUVERT')).bilan('t1', 'e1');
      expect(ouvert.resultatAnterieurNonVireN1).toBeNull();
      // Premier exercice du dossier · aucune colonne N-1, rien à dire.
      expect((await serviceAvecBalance(lignes2028).bilan('t1', 'e1')).resultatAnterieurNonVireN1).toBeNull();
    });
  });

  // =========================================================================
  describe('compteDeResultat', () => {
    it('rend la maquette complète du ch. 4, dans l’ordre du modèle', async () => {
      const cr = await serviceDeReference().compteDeResultat('t1', 'e2');
      // Sauf RQP et TQP · le dossier de référence ne fait aucune opération en
      // commun, et le ch. 33 ne les imprime que « dès lors que l'entité
      // réalise de telles opérations » (audit final F89).
      expect(cr.lignes.map((l) => l.ref)).toEqual(ORDRE_AFFICHAGE_COMPTE_RESULTAT.filter((r) => r !== 'RQP' && r !== 'TQP'));
      const xa = cr.lignes.find((l) => l.ref === 'XA');
      expect(xa?.estSolde).toBe(true);
      expect(xa?.formuleOfficielle).toBe('Somme TA à RB');
      expect(cr.lignes.find((l) => l.ref === 'TA')?.estSolde).toBeUndefined();
    });

    /**
     * Convention du ch. 4 : « les postes de charges (préfixe R) sont saisis EN
     * NÉGATIF ; les formules de totalisation sont des SOMMES, jamais des
     * différences […] ne jamais soustraire deux fois ». Une charge rendue en
     * positif ferait double emploi avec le signe des formules.
     */
    it('porte les charges en NÉGATIF et les produits en positif', async () => {
      const cr = await serviceDeReference().compteDeResultat('t1', 'e2');
      const montant = (ref: string) => cr.lignes.find((l) => l.ref === ref)!.montant;
      expect(montant('TA')).toBe(8000);
      expect(montant('RA')).toBe(-5000);
      expect(montant('RK')).toBe(-1500);
      expect(montant('RL')).toBe(-500);
    });

    it('calcule les neuf lignes X* par les formules du modèle', async () => {
      const cr = await serviceDeReference().compteDeResultat('t1', 'e2');
      expect(cr.soldes.margeCommerciale).toBe(3000); // XA = TA + RA + RB
      expect(cr.soldes.chiffreAffaires).toBe(8000); // XB = A + B + C + D
      expect(cr.soldes.valeurAjoutee).toBe(3000); // XC = (XB + RA + RB) + somme TE à RJ
      expect(cr.soldes.excedentBrutExploitation).toBe(1500); // XD = XC + RK
      expect(cr.soldes.resultatExploitation).toBe(1000); // XE = XD + TJ + RL
      expect(cr.soldes.resultatFinancier).toBe(0); // XF
      expect(cr.soldes.resultatActivitesOrdinaires).toBe(1000); // XG = XE + XF
      expect(cr.soldes.resultatHorsActivitesOrdinaires).toBe(0); // XH
      expect(cr.soldes.resultatNet).toBe(1000); // XI = XG + XH + RQ + RS
      // Les lignes affichées portent les mêmes montants que les soldes nommés.
      expect(cr.lignes.find((l) => l.ref === 'XI')?.montant).toBe(1000);
    });

    /**
     * BOUCLAGE avec le bilan · XI, obtenu par les postes du modèle, doit
     * valoir le solde de toutes les classes de gestion, celui que le bilan
     * loge en CJ. Tout écart vaut exactement la somme des comptes de gestion
     * non rattachés.
     */
    it('boucle : XI vaut le solde de toutes les classes de gestion', async () => {
      const cr = await serviceDeReference().compteDeResultat('t1', 'e2');
      const classesDeGestion: ClasseCompte[] = [ClasseCompte.CLASSE_6, ClasseCompte.CLASSE_7, ClasseCompte.CLASSE_8];
      const soldeDesClassesDeGestion = LIGNES_E2.filter((l) => classesDeGestion.includes(l.classe)).reduce(
        (s, l) => s + l.solde,
        0,
      );

      expect(cr.soldes.resultatNet).toBe(-soldeDesClassesDeGestion);
      expect(cr.controle.resultatToutesClassesDeGestion).toBe(1000);
      expect(cr.controle.ecart).toBe(0);
      expect(cr.controle.coherent).toBe(true);

      const bilan = await serviceDeReference().bilan('t1', 'e2');
      expect([...bilan.actif, ...bilan.passif].find((p) => p.ref === 'CJ')?.montant).toBe(cr.soldes.resultatNet);
    });

    it('signale un compte de gestion sans poste et chiffre l’écart qu’il crée', async () => {
      // 609 n'existe pas au plan SYSCOHADA (le ch. 7 note que « 606, 607 et
      // 788 n'existent pas au plan ») : c'est le cas d'un plan personnalisé,
      // celui-là même pour lequel la garantie existe.
      const service = serviceAvecBalance([ligne('60900000', C6, 300, 0), ligne('52110000', C5, 0, 300)]);

      const cr = await service.compteDeResultat('t1', 'e1');

      expect(cr.comptesNonRattaches).toEqual([{ numero: '60900000', intitule: 'Compte 60900000', montant: -300 }]);
      expect(cr.soldes.resultatNet).toBe(0);
      expect(cr.controle.ecart).toBe(-300); // exactement le compte non rattaché
      expect(cr.controle.coherent).toBe(false);
    });

    /**
     * QUOTE-PART DE RÉSULTAT PARTAGÉ · AUDCIF Titre VIII ch. 33 section 7.2 :
     * les deux postes supplémentaires sont « à la fin du niveau
     * "Exploitation" ». De bout en bout, sur une vraie balance : ce que le
     * texte protège, ce sont la valeur ajoutée et l'excédent brut, où le
     * rattachement en bloc du 65 et du 75 (ch. 7) faisait entrer la
     * quote-part sans que rien ne le signale. Le bilan, lui, doit continuer
     * de boucler avec le compte de résultat · c'est la moitié du test.
     */
    it('garde RQP quand seul N-1 en porte · la colonne comparative doit pouvoir se lire (audit final F89)', async () => {
      const service = serviceAvecExercices(
        {
          e1: [ligne('52110000', C5, 1000, 0), ligne('65250000', C6, 400, 0), ligne('70110000', C7, 0, 1400)],
          e2: [ligne('52110000', C5, 500, 0), ligne('70110000', C7, 0, 500)],
        },
        EXERCICES,
      );
      const cr = await service.compteDeResultat('t1', 'e2');
      const rqp = cr.lignes.find((l) => l.ref === 'RQP');
      expect(rqp?.montant).toBe(0);
      expect(rqp?.montantN1).toBe(-400);
    });

    it('sort la quote-part de résultat partagé de la valeur ajoutée et de l’EBE, sans rompre le bouclage (ch. 33)', async () => {
      // Coparticipant NON GÉRANT : 1 000 de ventes encaissées, et le gérant
      // lui impute 400 de perte (débit 6525 par crédit 463, ch. 33 § 6.3).
      const service = serviceAvecBalance([
        ligne('52110000', C5, 1000, 0),
        ligne('70110000', C7, 0, 1000),
        ligne('65250000', C6, 400, 0),
        ligne('46310000', C4, 0, 400),
      ]);

      const cr = await service.compteDeResultat('t1', 'e1');
      const montantDe = (ref: string) => cr.lignes.find((l) => l.ref === ref)!.montant;

      expect(montantDe('RQP')).toBe(-400);
      expect(cr.lignes.find((l) => l.ref === 'RQP')?.supplementaire).toBe(true);
      // TQP, nul en N et sans N-1, n'est pas imprimé (audit final F89).
      expect(cr.lignes.some((l) => l.ref === 'TQP')).toBe(false);
      expect(montantDe('RJ')).toBe(0); // le 652 n'est plus absorbé par « Autres charges »
      expect(cr.soldes.valeurAjoutee).toBe(1000);
      expect(cr.soldes.excedentBrutExploitation).toBe(1000);
      expect(cr.soldes.resultatExploitation).toBe(600);
      expect(cr.soldes.resultatNet).toBe(600);
      // Le compte est bien rattaché : aucun compte de gestion orphelin, et XI
      // vaut le solde de toutes les classes de gestion.
      expect(cr.comptesNonRattaches).toEqual([]);
      expect(cr.controle.ecart).toBe(0);
      expect(cr.controle.coherent).toBe(true);

      // Et le bilan répond : CJ porte le même résultat, actif = passif.
      const bilan = await service.bilan('t1', 'e1');
      expect([...bilan.actif, ...bilan.passif].find((p) => p.ref === 'CJ')?.montant).toBe(600);
      expect(bilan.totalActif).toBe(1000);
      expect(bilan.totalPassif).toBe(1000);
    });

    it('rend la colonne N-1 seulement quand l’exercice antérieur existe', async () => {
      const avecN1 = await serviceDeReference().compteDeResultat('t1', 'e2');
      expect(avecN1.exerciceN1Disponible).toBe(true);
      expect(avecN1.soldesN1?.resultatNet).toBe(0); // e1 n'a aucun compte de gestion
      expect(avecN1.lignes.every((l) => l.montantN1 !== undefined)).toBe(true);

      const sansN1 = await serviceDeReference().compteDeResultat('t1', 'e1');
      expect(sansN1.exerciceN1Disponible).toBe(false);
      expect(sansN1.soldesN1).toBeUndefined();
      expect(sansN1.lignes.every((l) => l.montantN1 === undefined)).toBe(true);
    });
  });

  // =========================================================================
  describe('tableauFluxTresorerie', () => {
    const montant = (
      tft: Awaited<ReturnType<EtatsFinanciersSyscohadaService['tableauFluxTresorerie']>>,
      ref: string,
    ) => tft.lignes.find((l): l is Extract<(typeof tft.lignes)[number], { ref: string }> => 'ref' in l && l.ref === ref)!;

    it('applique la méthode indirecte : FA part de l’EBE, FB à FE sont des variations de bilan', async () => {
      const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');

      expect(montant(tft, 'FA').montant).toBe(1500); // CAFG = EBE, aucun retraitement ici
      expect(montant(tft, 'FB').montant).toBe(0);
      expect(montant(tft, 'FC').montant).toBe(0);
      expect(montant(tft, 'FD').montant).toBe(-1000); // BG passe de 2 000 à 3 000
      expect(montant(tft, 'FE').montant).toBe(200); // DP passe de 500 à 700
      expect(montant(tft, 'ZB').montant).toBe(700);
      expect(montant(tft, 'ZC').montant).toBe(0);
      expect(montant(tft, 'ZF').montant).toBe(0);
    });

    /**
     * Le seul bouclage imposé par le modèle (ch. 5 section 2) : « ZH
     * Trésorerie nette au 31 Décembre (G + A) · Contrôle : Trésorerie actif N
     * – Trésorerie passif N ». Les deux calculs sont indépendants : l'un
     * cumule les flux, l'autre relit le bilan.
     */
    it('boucle : ZH par les flux = ZA + ZB + ZC + ZF = ZH par le bilan', async () => {
      const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');

      expect(montant(tft, 'ZA').montant).toBe(3500); // BT - DT de l'exercice antérieur
      expect(montant(tft, 'ZG').montant).toBe(700);
      expect(montant(tft, 'ZH').montant).toBe(4200);

      const parLesFlux = CONTROLE_ZH_PAR_LES_FLUX.reduce((s, ref) => s + montant(tft, ref).montant, 0);
      expect(parLesFlux).toBe(4200);

      expect(tft.controle.tresorerieOuverture).toBe(3500);
      expect(tft.controle.variation).toBe(700);
      expect(tft.controle.tresorerieClotureParFlux).toBe(4200);
      expect(tft.controle.tresorerieClotureParBilan).toBe(4200);
      expect(tft.controle.ecart).toBe(0);
      expect(tft.controle.coherent).toBe(true);

      // Et c'est bien la trésorerie du BILAN, pas un second calcul parallèle.
      const bilan = await serviceDeReference().bilan('t1', 'e2');
      const bt = [...bilan.actif].find((p) => p.ref === 'BT')!.montant;
      const dt = [...bilan.passif].find((p) => p.ref === 'DT')!.montant;
      expect(tft.controle.tresorerieClotureParBilan).toBe(bt - dt);
    });

    it('lit la trésorerie du contrôle APRÈS transfert du découvert, sans le compter deux fois', async () => {
      const service = serviceAvecBalance([
        ligne('10130000', C1, 0, 700),
        ligne('57110000', C5, 1000, 0),
        ligne('52110000', C5, 0, 300),
      ]);

      const tft = await service.tableauFluxTresorerie('t1', 'e1');

      // 1 000 - 300 = 700. Si le 52 créditeur était resté à l'actif ET repris
      // au passif, le contrôle vaudrait 400 ; s'il n'était nulle part, 1 000.
      expect(tft.controle.tresorerieClotureParBilan).toBe(700);
    });

    // CAS CHIFFRÉS DE LA CLÔTURE, B1, N1 ET Q3 (2026-10-07) · sans exercice
    // antérieur tenu, les positions N-1 sont celles de l'OUVERTURE (AUDCIF
    // art. 34) · nulles pour une société qui naît, le bilan d'ouverture
    // importé pour un dossier repris. Les postes ne restent plus vides, et
    // le tableau du premier exercice boucle.
    it('premier exercice d’une société qui naît · ZA nul, variations contre zéro, tableau cohérent', async () => {
      const tft = await serviceAvecBalance([
        ligne('10130000', C1, 0, 10000),
        ligne('24510000', C2, 6000, 0),
        ligne('28450000', C2, 0, 1000),
        ligne('68130000', C6, 1000, 0),
        ligne('70110000', C7, 0, 8000),
        ligne('41110000', C4, 8000, 6000),
        ligne('60110000', C6, 5000, 0),
        ligne('40110000', C4, 4500, 5000),
        ligne('52110000', C5, 16000, 10500),
      ]).tableauFluxTresorerie('t1', 'e1');

      expect(tft.exerciceN1Disponible).toBe(false);
      expect(tft.postesNonCalculables.filter((p) => p.ref === 'ZA' || /^F[B-G]$/.test(p.ref))).toEqual([]);
      expect({
        za: montant(tft, 'ZA').montant,
        fd: montant(tft, 'FD').montant,
        fe: montant(tft, 'FE').montant,
        zb: montant(tft, 'ZB').montant,
        fg: montant(tft, 'FG').montant,
        zh: montant(tft, 'ZH').montant,
        coherent: tft.controle.coherent,
      }).toEqual({ za: 0, fd: -2000, fe: 500, zb: 1500, fg: -6000, zh: 5500, coherent: true });
      // Et la colonne N-1 du modèle reste absente, jamais remplie de zéros.
      expect(montant(tft, 'ZH').montantN1).toBeUndefined();
    });

    it('relecture V1 · un exercice précédent ouvert SANS ÉCRITURE · ZA se lit sur le bilan d’ouverture de l’exercice, et c’est dit', async () => {
      // e1 (2025) ouvert pour y importer plus tard sa balance, e2 (2026)
      // porte son bilan d'ouverture · lues sur e1 vide, les positions
      // d'ouverture étaient nulles et ZA valait 0 sans un mot.
      const service = serviceAvecExercices(
        {
          e1: [],
          e2: [
            ligne('10130000', C1, 0, 0, { credit: 2000 }),
            ligne('52110000', C5, 500, 0, { debit: 2000 }),
            ligne('70110000', C7, 0, 500),
          ],
        },
        EXERCICES,
      );
      const tft = await service.tableauFluxTresorerie('t1', 'e2');
      expect(montant(tft, 'ZA').montant).toBe(2000);
      expect(montant(tft, 'ZH').montant).toBe(2500);
      expect(tft.controle.coherent).toBe(true);
      expect(tft.mentionOuverture).toBe(mentionExercicePrecedentVide('SYSCOHADA', true));
    });

    it('premier exercice d’une société qui naît · l’ouverture présumée nulle est DITE', async () => {
      const tft = await serviceAvecBalance([ligne('10130000', C1, 0, 1000), ligne('52110000', C5, 1000, 0)]).tableauFluxTresorerie('t1', 'e1');
      expect(tft.mentionOuverture).toContain('présumée nulle');
    });

    // BLOQUANT 2 DE LA RELECTURE DU 2026-10-07 · le bilan d'ouverture d'un
    // premier exercice passé en OD au premier jour (chemin admis par AU2) ·
    // lu comme flux, le matériel sortait en acquisition (FF) et le capital
    // en apport (FK), ZA à zéro, sans un mot. Rien ne le distingue d'un
    // apport du premier jour · ni flux ni ouverture, postes vides et motif.
    it('premier exercice dont l’ouverture est passée en OD au premier jour · ni flux ni ouverture, postes vides et motif', async () => {
      const lignes = [
        ligne('10130000', C1, 0, 2000),
        ligne('24510000', C2, 2100, 0),
        ligne('40110000', C4, 0, 300),
        ligne('52110000', C5, 200, 0),
      ];
      const service = serviceAvecBalance(lignes);
      const ecritures = (service as unknown as { ecritureService: { ouverturePasseeAuPremierJour: jest.Mock } }).ecritureService;
      ecritures.ouverturePasseeAuPremierJour.mockResolvedValue({ nombre: 1, pieces: ['OD n° 1'] });
      const tft = await service.tableauFluxTresorerie('t1', 'e1');
      const vides = new Set(tft.postesVides);
      expect(['ZA', 'FF', 'FG', 'FK', 'ZH'].every((r) => vides.has(r))).toBe(true);
      expect(tft.postesNonCalculables.find((p) => p.ref === 'ZA')?.raison).toContain('OD n° 1');
      expect(tft.mentionOuverture).toContain('passez-le en à-nouveau');
      expect(ecritures.ouverturePasseeAuPremierJour).toHaveBeenCalledWith('t1', 'e1');
      const bilan = await service.bilan('t1', 'e1');
      expect({ comparatif: bilan.comparatif, bz: bilan.totalActifN1 }).toEqual({ comparatif: null, bz: undefined });
      expect(bilan.mentionComparatif).toContain('OD n° 1');
    });

    it('un report tenu ou un exercice précédent · l’OD du premier jour n’est pas cherchée', async () => {
      const service = serviceAvecBalance([ligne('10130000', C1, 0, 0, { credit: 2000 }), ligne('52110000', C5, 0, 0, { debit: 2000 })]);
      await service.tableauFluxTresorerie('t1', 'e1');
      const ecritures = (service as unknown as { ecritureService: { ouverturePasseeAuPremierJour: jest.Mock } }).ecritureService;
      expect(ecritures.ouverturePasseeAuPremierJour).not.toHaveBeenCalled();
    });

    it('dossier repris · les positions N-1 sont le bilan d’ouverture importé (ZA = trésorerie d’ouverture)', async () => {
      const tft = await serviceAvecBalance([
        ligne('10130000', C1, 0, 0, { credit: 2000 }),
        ligne('13100000', C1, 0, 0, { credit: 500 }),
        ligne('24510000', C2, 0, 0, { debit: 2100 }),
        ligne('41110000', C4, 0, 0, { debit: 800 }),
        ligne('40110000', C4, 0, 0, { credit: 600 }),
        ligne('52110000', C5, 3000, 0, { debit: 200 }),
        ligne('70110000', C7, 0, 3000),
      ]).tableauFluxTresorerie('t1', 'e1');
      expect({ za: montant(tft, 'ZA').montant, zh: montant(tft, 'ZH').montant, coherent: tft.controle.coherent }).toEqual({
        za: 200,
        zh: 3200,
        coherent: true,
      });
    });

    it('rend la colonne N-1 quand l’exercice antérieur existe, ses positions N-1 lues sur son ouverture sans N-2', async () => {
      const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');
      expect(tft.exerciceN1Disponible).toBe(true);
      // e1 n'a lui-même aucun exercice antérieur · sa trésorerie d'ouverture
      // est celle de son ouverture, nulle ici (B1, N1 et Q3 des cas chiffrés
      // de la clôture · elle restait vide depuis l'audit final F14).
      expect({
        za: montant(tft, 'ZA').montantN1,
        motifZa: tft.postesNonCalculablesN1.some((p) => p.ref === 'ZA'),
        zh: typeof montant(tft, 'ZH').montantN1,
      }).toEqual({ za: 0, motifZa: false, zh: 'number' });
    });

    it('liste les comptes de bilan mouvementés qu’aucun poste ne ventile', async () => {
      const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');
      // 186 et 187 · anomalie n° 17 de la table du TFT. Ils n'entrent dans
      // aucun total lu par le tableau ; s'ils n'étaient pas nommés, un écart de
      // bouclage resterait sans explication.
      expect(tft.comptesNonVentiles.map((c) => c.numero)).toEqual(['18600000', '18700000']);
      // Les comptes que le tableau ventile bel et bien n'y figurent pas.
      expect(tft.comptesNonVentiles.some((c) => c.numero === '52110000')).toBe(false);
      expect(tft.comptesNonVentiles.some((c) => c.numero === '41110000')).toBe(false);
      expect(tft.comptesNonVentiles.some((c) => c.numero === '28450000')).toBe(false);
    });

    it('nomme les comptes tenus sans la subdivision que le tableau lit', async () => {
      // Vécu sur la balance d'un expert · 481, 81 et 82 tenus en comptes
      // génériques. Le tableau lit 4812, 812 et 822 : le 48100000 n'est PAS
      // non ventilé (sa racine 48 est connue du bilan), il est trop agrégé, et
      // le tableau ne bouclait pas sans que rien ne nomme la cause.
      const tft = await serviceAvecBalance([
        // Tenu en report seulement · un solde sans mouvement se signale aussi,
        // le tableau lisant la VARIATION entre deux soldes.
        ligne('24500000', C2, 0, 0, { debit: 5000 }),
        ligne('48100000', C4, 0, 0, { credit: 5000 }),
        ligne('81000000', C8, 300, 0),
        ligne('82000000', C8, 0, 300),
        ligne('48120000', C4, 0, 0, { credit: 100 }),
        ligne('52110000', C5, 100, 0),
      ]).tableauFluxTresorerie('t1', 'e1');
      const parNumero = new Map(tft.comptesTropAgreges.map((c) => [c.numero, c]));
      expect(parNumero.get('48100000')?.subdivisions).toContain('4812');
      expect(parNumero.get('48100000')?.montant).toBe(-5000);
      expect(parNumero.get('81000000')?.subdivisions).toContain('812');
      expect(parNumero.get('82000000')?.subdivisions).toContain('822');
      // Le compte détaillé que le tableau lit n'est pas signalé.
      expect(parNumero.has('48120000')).toBe(false);
      expect(parNumero.has('52110000')).toBe(false);
    });

    // LOT 14 · « – Écart et provision spéciale de réévaluation de l'exercice
    // de réévaluation uniquement » (Titre IX ch. 5 § 1.3). Exemple 2 du
    // ch. 28 § 4.2.1.3 · brut 1 000 → 1 400, cumul 400 → 560, écart 240 au
    // 1061 · D 241 400 / C 284 160 / C 1061 240. Aucune trésorerie · FG doit
    // valoir zéro et le tableau boucler.
    describe('lot 14 · l’écriture de réévaluation du module', () => {
      const e1 = [
        ligne('10130000', C1, 0, 5600),
        ligne('24110000', C2, 1000, 0),
        ligne('28410000', C2, 0, 400),
        ligne('52110000', C5, 5000, 0),
      ];
      const reports = (e: LigneBalance[]) =>
        e.map((l) => ligne(l.numero, l.classe, 0, 0, l.solde >= 0 ? { debit: l.solde } : { credit: -l.solde }));
      const ecriture = (...l: Array<[string, number, number]>) =>
        new Map(l.map(([numero, debit, credit]) => [`id-${numero}`, { debit, credit }]));

      it('légale, exemple 2 du § 4.2.1.3 · FG à zéro, et −160 sans la liaison (anomalie n° 21)', async () => {
        const e2 = [
          ...reports(e1).filter((l) => !['24110000', '28410000'].includes(l.numero)),
          ligne('24110000', C2, 400, 0, { debit: 1000 }),
          ligne('28410000', C2, 0, 160, { credit: 400 }),
          ligne('10610000', C1, 0, 240),
        ];
        const lie = ecriture(['24110000', 400, 0], ['28410000', 0, 160], ['10610000', 0, 240]);
        const tft = await serviceAvecExercices({ e1, e2 }, EXERCICES, { e2: lie }).tableauFluxTresorerie('t1', 'e2');
        expect(montant(tft, 'FG').montant).toBe(0);
        expect(montant(tft, 'ZC').montant).toBe(0);
        expect(tft.controle.coherent).toBe(true);
        const sansLiaison = await serviceAvecExercices({ e1, e2 }, EXERCICES).tableauFluxTresorerie('t1', 'e2');
        expect(montant(sansLiaison, 'FG').montant).toBe(-160);
        expect(sansLiaison.controle.coherent).toBe(false);
      });

      it('libre, méthode 2 du § 4.3.1 (150 000 000, 30 000 000, 135 000 000) · FG à zéro', async () => {
        const base = [
          ligne('10130000', C1, 0, 130_000_000),
          ligne('23110000', C2, 150_000_000, 0),
          ligne('28310000', C2, 0, 30_000_000),
          ligne('52110000', C5, 10_000_000, 0),
        ];
        const e2 = [
          ligne('10130000', C1, 0, 0, { credit: 130_000_000 }),
          ligne('23110000', C2, 15_000_000, 30_000_000, { debit: 150_000_000 }),
          ligne('28310000', C2, 30_000_000, 0, { credit: 30_000_000 }),
          ligne('10620000', C1, 0, 15_000_000),
          ligne('52110000', C5, 0, 0, { debit: 10_000_000 }),
        ];
        const lie = ecriture(['23110000', 15_000_000, 30_000_000], ['28310000', 30_000_000, 0], ['10620000', 0, 15_000_000]);
        const tft = await serviceAvecExercices({ e1: base, e2 }, EXERCICES, { e2: lie }).tableauFluxTresorerie('t1', 'e2');
        expect(montant(tft, 'FG').montant).toBe(0);
        expect(tft.controle.coherent).toBe(true);
      });

      it('un titre réévalué ne fausse plus la répartition FG/FH (anomalie n° 11)', async () => {
        const base = [ligne('10130000', C1, 0, 6000), ligne('27410000', C2, 1000, 0), ligne('52110000', C5, 5000, 0)];
        const e2 = [...reports(base).filter((l) => l.numero !== '27410000'), ligne('27410000', C2, 400, 0, { debit: 1000 }), ligne('10610000', C1, 0, 400)];
        const lie = ecriture(['27410000', 400, 0], ['10610000', 0, 400]);
        const tft = await serviceAvecExercices({ e1: base, e2 }, EXERCICES, { e2: lie }).tableauFluxTresorerie('t1', 'e2');
        expect(montant(tft, 'FG').montant).toBe(0);
        expect(montant(tft, 'FH').montant).toBe(0);
        // La réserve de l'anomalie n° 11 ne naît plus de l'écriture du module.
        expect(tft.postesNonCalculables.filter((p) => p.ref === 'FH')).toEqual([]);
        const sansLiaison = await serviceAvecExercices({ e1: base, e2 }, EXERCICES).tableauFluxTresorerie('t1', 'e2');
        expect(montant(sansLiaison, 'FG').montant).toBe(400);
        expect(montant(sansLiaison, 'FH').montant).toBe(-400);
        expect(sansLiaison.postesNonCalculables.some((p) => p.ref === 'FH' && /HORS du module/.test(p.raison))).toBe(true);
      });
    });

    // CAS CHIFFRÉS DE LA CLÔTURE, CONSTAT N2 (2026-10-07) · la réserve
    // « réévaluation passée HORS du module » naissait de toute dotation au
    // 28. Elle ne naît plus que d'un crédit du 1061 ou du 154 hors module,
    // ce que porte une réévaluation à la main (Titre VIII ch. 28 § 4.2.4.1).
    describe('constat N2 · la réserve de réévaluation sur FG', () => {
      const reserveReevaluation = (tft: { postesNonCalculables: Array<{ ref: string; raison: string }> }) =>
        tft.postesNonCalculables.some((p) => p.ref === 'FG' && /Réévaluation passée HORS du module/.test(p.raison));

      it('une simple dotation au 28 ne la fait pas naître', async () => {
        const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');
        expect(reserveReevaluation(tft)).toBe(false);
      });

      it('un crédit du 1061 et du 28 passés à la main la font naître ; liés au module, non', async () => {
        const e1 = [ligne('10130000', C1, 0, 5600), ligne('24110000', C2, 1000, 0), ligne('28410000', C2, 0, 400), ligne('52110000', C5, 5000, 0)];
        const e2 = [
          ligne('10130000', C1, 0, 0, { credit: 5600 }),
          ligne('52110000', C5, 0, 0, { debit: 5000 }),
          ligne('24110000', C2, 400, 0, { debit: 1000 }),
          ligne('28410000', C2, 0, 160, { credit: 400 }),
          ligne('10610000', C1, 0, 240),
        ];
        const aLaMain = await serviceAvecExercices({ e1, e2 }, EXERCICES).tableauFluxTresorerie('t1', 'e2');
        expect(reserveReevaluation(aLaMain)).toBe(true);
        const lie = new Map([
          ['id-24110000', { debit: 400, credit: 0 }],
          ['id-28410000', { debit: 0, credit: 160 }],
          ['id-10610000', { debit: 0, credit: 240 }],
        ]);
        const duModule = await serviceAvecExercices({ e1, e2 }, EXERCICES, { e2: lie }).tableauFluxTresorerie('t1', 'e2');
        expect(reserveReevaluation(duModule)).toBe(false);
      });
    });

    it('lit la subdivision après avoir retiré les zéros de complément', () => {
      // 48100000 et 481 sont le même compte · sans le retrait des zéros,
      // « 4812 » ne commencerait jamais par « 48100000 ».
      expect(subdivisionsLuesParLeTft('48100000')).toContain('4812');
      expect(subdivisionsLuesParLeTft('481')).toContain('4812');
      expect(subdivisionsLuesParLeTft('48120000')).not.toContain('4812');
      expect(subdivisionsLuesParLeTft('24500000')).toEqual([]);
    });

    it('reproduit la maquette du modèle : rubriques intercalées, clés A à H, drill-down des postes', async () => {
      const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');

      expect(tft.lignes.some((l) => 'section' in l)).toBe(true);
      expect(montant(tft, 'ZA').repere).toBe('A');
      expect(montant(tft, 'ZH').repere).toBe('H');
      expect(montant(tft, 'ZH').estTotal).toBe(true);
      expect(montant(tft, 'FA').estTotal).toBe(false);
      // FD lit le poste BG du bilan : son drill-down doit nommer le compte qui
      // porte la variation, pas rester muet.
      expect(montant(tft, 'FD').comptes.map((c) => c.numero)).toEqual(['41110000']);
      expect(montant(tft, 'FD').comptes[0].montant).toBe(-1000);
    });
  });

  // =========================================================================
  describe('refus et colonnes du modèle (audit final F217, F220, F222)', () => {
    it('ne sert ni Brut ni Amort. en N-1 · le modèle du ch. 3 n’imprime que le net de N-1 (F217)', async () => {
      // e1 n'a pas d'exercice antérieur : l'ancien code y servait `brutN1: 0`,
      // un faux zéro sur une colonne que le modèle n'a pas. e2 en a un.
      for (const exercice of ['e1', 'e2']) {
        const bilan = await serviceDeReference().bilan('t1', exercice);
        for (const l of [...bilan.actif, ...bilan.passif]) {
          expect({ ref: l.ref, cles: Object.keys(l).filter((k) => k === 'brutN1' || k === 'amortissementN1') }).toEqual({
            ref: l.ref,
            cles: [],
          });
        }
      }
      // Le net N-1, lui, reste servi quand l'exercice antérieur existe.
      const avecN1 = await serviceDeReference().bilan('t1', 'e2');
      expect(avecN1.actif.find((l) => l.ref === 'AN')?.montantN1).toBe(5000);
    });

    it.each(['xyz', '2026-02-30', '06/30/2026', '2026-6-30'])(
      'refuse la date d’arrêté illisible « %s » par un 400, jamais un 500 ni un jour déplacé (F220)',
      async (date) => {
        const service = serviceAvecBalance([ligne('52110000', C5, 100, 0), ligne('10130000', C1, 0, 100)]);
        await expect(service.bilan('t1', 'e1', date)).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.compteDeResultat('t1', 'e1', date)).rejects.toThrow('AAAA-MM-JJ');
        await expect(service.tableauFluxTresorerie('t1', 'e1', date)).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('lit une date bien formée à la FIN de ce jour, et pas un autre (F220)', () => {
      expect(lireDateArrete('2026-06-30').toISOString()).toBe('2026-06-30T23:59:59.999Z');
      expect(lireDateArrete('2024-02-29').toISOString()).toBe('2024-02-29T23:59:59.999Z');
    });

    it('refuse un exercice que le dossier ne connaît pas · 404, jamais des états à zéro « équilibrés » (F222)', async () => {
      const service = serviceDeReference();
      await expect(service.bilan('t1', 'inconnu')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.compteDeResultat('t1', 'inconnu')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.tableauFluxTresorerie('t1', 'inconnu')).rejects.toBeInstanceOf(NotFoundException);
      // Situation intermédiaire comprise · l'exercice est refusé avant la date.
      await expect(service.bilan('t1', 'inconnu', '2026-06-30')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
