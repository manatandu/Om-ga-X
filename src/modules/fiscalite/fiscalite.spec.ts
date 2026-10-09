import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FormeJuridiqueSyscohada, Prisma, Referentiel, SensRetraitementFiscal, TypeCompteDetailTotal } from '@prisma/client';
import {
  COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE,
  COMPLEMENT_UNICITE_NON_DECLARABLE,
  COMPLEMENT_UNICITE_NON_DECLAREE,
  FiscaliteService,
  arrondirImpotArt150,
  observationBilansSuccessifs,
  unipersonnaliteDeLArticle63,
} from './fiscalite.service';
import { CATALOGUE_RETRAITEMENTS, CODE_LIBRE } from './catalogue-retraitements';
import { motifsRefusConstat } from './ecriture-impot-resultat';
import { chiffreAffairesMinimumPremierExercice } from './periode-creation';

/**
 * RÉSULTAT FISCAL · ce qui casserait en silence.
 *
 * Un impôt faux ne lève aucune erreur : il se paie, ou se redresse au
 * contrôle. Les cinq règles vérifiées ici sont celles où l'écart entre le
 * texte et l'intuition est le plus grand · le résultat comptable lu dans la
 * bonne source, l'impôt minimum qui prime sur l'impôt théorique, le déficit
 * qui s'impute dans l'ordre et se perd au-delà de trois exercices, le régime
 * qui bascule avec la forme et le chiffre d'affaires, et le refus du SYCEBNL.
 */

type Ligne = { numero: string; solde: number; typeCompte?: TypeCompteDetailTotal };
const D = TypeCompteDetailTotal.DETAIL;
const ligne = (numero: string, solde: number, typeCompte: TypeCompteDetailTotal = D): Ligne => ({ numero, solde, typeCompte });

function service(options: {
  referentiel?: Referentiel;
  forme?: FormeJuridiqueSyscohada | null;
  balances: Record<string, Ligne[]>;
  /** Écritures ordinaires restées au BROUILLARD, par exercice. */
  brouillards?: Record<string, Ligne[]>;
  /**
   * Comptes intermédiaires · la balance lue à une date à l'intérieur de
   * l'exercice (`arreteAu`, art. 12, al. 3), par exercice. La doublure ne rend
   * ces lignes QUE lorsque la date est demandée.
   */
  balancesAu?: Record<string, Ligne[]>;
  /**
   * Écriture de CLÔTURE qui solde les classes 6 à 8 sur le 13
   * (`estSoldeDesComptesDeGestion`), par exercice. VALIDÉE, comme en
   * production depuis l'audit final F4 · elle compte donc au livre-journal.
   */
  clotures?: Record<string, Ligne[]>;
  /**
   * À-nouveau écrit par la clôture de l'exercice précédent
   * (`estGenereeParCloture`), colonne REPORT de la balance · le résultat non
   * affecté y revient sur le 131 ou le 139 (cas chiffré V3).
   */
  reports?: Record<string, Ligne[]>;
  exercices?: { id: string; dateDebut: Date; dateFin: Date; statut?: string }[];
  retraitements?: Record<string, { sens: SensRetraitementFiscal; montant: number }[]>;
  dossier?: {
    acomptesVerses?: number;
    supplementsAdministration?: number;
    deficitAnterieurSaisi?: number | null;
    natureActivite?: 'VENTE' | 'PRESTATIONS' | null;
    resultatPeriodeCreationSaisi?: number | null;
    chiffreAffairesPeriodeCreationSaisi?: number | null;
    supplementsPeriodeCreation?: number;
  };
  /** Dossier fiscal PAR exercice (B2, P1) · lu par la cible et par le rejeu. */
  dossiers?: Record<string, Record<string, unknown>>;
  /** Faits du dossier en plus (dissolution, liquidation). */
  tenant?: Record<string, unknown>;
}) {
  const exercices = options.exercices ?? [
    { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
  ];
  const crees: Record<string, unknown>[] = [];
  const prisma = {
    tenant: {
      findUnique: async () => ({
        id: 't1',
        referentiel: options.referentiel ?? Referentiel.SYSCOHADA,
        formeJuridiqueSyscohada: options.forme === undefined ? FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE : options.forme,
        ...(options.tenant ?? {}),
      }),
    },
    exercice: {
      findFirst: async ({ where }: { where: { id: string } }) => exercices.find((e) => e.id === where.id) ?? null,
      // LA DOUBLURE HONORE LES DEUX BORNES · `lt` ET `gte`.
      //
      // Elle n'appliquait que `lt`, et laissait donc passer un exercice hors
      // de la fenêtre de trois ans de l'art. 51, alinéa 1er. Une doublure qui
      // filtre moins que la production valide un code qui ne filtre pas · même
      // famille que les doublures de `findMany` et de `findFirst` relevées aux
      // passes F2a et I2.
      findMany: async ({ where, take }: { where: { dateFin: { lt: Date; gte?: Date } }; take: number }) =>
        exercices
          .filter((e) => e.dateFin < where.dateFin.lt && (!where.dateFin.gte || e.dateFin >= where.dateFin.gte))
          .sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())
          .slice(0, take),
    },
    retraitementFiscal: {
      findMany: async ({ where }: { where: { exerciceId: string } }) =>
        (options.retraitements?.[where.exerciceId] ?? []).map((r, i) => ({
          id: `r${i}`,
          code: 'X',
          libelle: 'x',
          commentaire: null,
          ...r,
        })),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        crees.push(data);
        return data;
      },
    },
    // LE COMPTE DES ÉCRITURES AU BROUILLARD (C01-bis) · une écriture par
    // exercice qui porte des lignes au brouillard, comme la requête de
    // production qui compte les écritures, pas les lignes.
    ecriture: {
      count: async ({ where }: { where: { exerciceId: string } }) =>
        (options.brouillards?.[where.exerciceId] ?? []).length > 0 ? 1 : 0,
    },
    dossierFiscalExercice: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        crees.push(create);
        return create;
      },
      findMany: async ({ where }: { where: { exerciceId: { in: string[] } } }) =>
        Object.entries(options.dossiers ?? {})
          .filter(([id]) => where.exerciceId.in.includes(id))
          .map(([exerciceId, d]) => ({ exerciceId, deficitAnterieurSaisi: null, deficitAnterieurOrigines: null, ...d })),
      findUnique: async ({ where }: { where: { exerciceId: string } }) =>
        options.dossiers?.[where.exerciceId]
          ? { acomptesVerses: 0, supplementsAdministration: 0, deficitAnterieurSaisi: null, natureActivite: null, ...options.dossiers[where.exerciceId] }
          : options.dossier
          ? {
              acomptesVerses: 0,
              supplementsAdministration: 0,
              deficitAnterieurSaisi: null,
              natureActivite: null,
              resultatPeriodeCreationSaisi: null,
              ...options.dossier,
            }
          : null,
    },
  };
  // LA DOUBLURE HONORE LE BROUILLARD ET SÉPARE LES COLONNES, comme
  // `EcritureService.balance` · une doublure qui rendait la même balance quel
  // que soit le troisième argument validait un service qui lisait le
  // provisoire (audit du 2026-09-27, F6). L'écriture qui solde les comptes de
  // gestion entre VALIDÉE (audit final F4) · elle est lue au livre-journal,
  // rangée dans les colonnes de CLÔTURE et comptée dans le solde, jamais dans
  // les mouvements. La ranger au brouillard, comme avant F4, laissait passer
  // un service qui lisait le résultat d'un exercice clos sur un solde nul.
  type LigneBalance = Ligne & {
    totalDebit: number; totalCredit: number;
    reportDebit: number; reportCredit: number;
    mouvementDebit: number; mouvementCredit: number;
    clotureDebit: number; clotureCredit: number;
  };
  const ecritures = {
    balance: async (_t: string, exerciceId: string, inclureBrouillard = true, arreteAu?: Date) => {
      const parNumero = new Map<string, LigneBalance>();
      const verser = (lignes: Ligne[] | undefined, estCloture: boolean | 'report') => {
        for (const l of lignes ?? []) {
          const a = parNumero.get(l.numero) ?? {
            numero: l.numero, solde: 0, typeCompte: l.typeCompte ?? D,
            totalDebit: 0, totalCredit: 0, reportDebit: 0, reportCredit: 0,
            mouvementDebit: 0, mouvementCredit: 0, clotureDebit: 0, clotureCredit: 0,
          };
          a.solde += l.solde;
          const debit = Math.max(l.solde, 0);
          const credit = Math.max(-l.solde, 0);
          a.totalDebit += debit;
          a.totalCredit += credit;
          if (estCloture === 'report') {
            a.reportDebit += debit;
            a.reportCredit += credit;
          } else if (estCloture) {
            a.clotureDebit += debit;
            a.clotureCredit += credit;
          } else {
            a.mouvementDebit += debit;
            a.mouvementCredit += credit;
          }
          parNumero.set(l.numero, a);
        }
      };
      if (arreteAu) {
        verser(options.balancesAu?.[exerciceId], false);
        return { lignes: [...parNumero.values()], totaux: { debit: 0, credit: 0 } };
      }
      verser(options.reports?.[exerciceId], 'report');
      verser(options.balances[exerciceId], false);
      verser(options.clotures?.[exerciceId], true);
      if (inclureBrouillard) verser(options.brouillards?.[exerciceId], false);
      return { lignes: [...parNumero.values()], totaux: { debit: 0, credit: 0 } };
    },
  };
  return { s: new FiscaliteService(prisma as never, ecritures as never), crees };
}

describe('Résultat fiscal · lecture de la balance', () => {
  it('lit le résultat dans les classes 6, 7, 8 avant clôture, et le chiffre d’affaires dans 701 à 707 seulement', async () => {
    const { s } = service({
      balances: {
        N: [
          ligne('70110000', -1000), // vente · crédit
          ligne('70610000', -500), // service · crédit
          ligne('75800000', -200), // autre produit · PAS du chiffre d'affaires
          ligne('60110000', 900), // achat · débit
          ligne('70', -1500, TypeCompteDetailTotal.TOTAL), // agrégat d'affichage, ignoré
        ],
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.sourceResultat).toBe('CLASSES_6_7_8');
    expect(r.resultatComptable).toBe(800);
    expect(r.chiffreAffaires).toBe(1500);
  });

  it('bascule sur le compte 13 quand les classes de gestion sont soldées', async () => {
    const { s } = service({ balances: { N: [ligne('13100000', -800)] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.sourceResultat).toBe('COMPTE_13');
    expect(r.resultatComptable).toBe(800);
  });

  /**
   * LE COMPTE 13 N'EST PAS ENTIÈREMENT LE RÉSULTAT, EN SYSCOHADA.
   *
   * Le plan SYSCOHADA ouvre sous le 13 le 130 (résultat de l'exercice
   * PRÉCÉDENT en instance d'affectation) et les soldes intermédiaires 132 à
   * 138. Le premier est exclu, les seconds comptent · règle commune de
   * `resultat-de-l-exercice.ts`, la même que celle du bilan.
   */
  it('IGNORE le résultat en instance d’affectation (130) · sinon l’impôt est payé deux fois', async () => {
    const { s } = service({
      balances: {
        // Bénéfice de l'exercice : 800. Et 5 000 encore en instance
        // d'affectation, qui sont le résultat de l'exercice PRÉCÉDENT tant
        // que l'assemblée n'a pas statué · déjà imposés une fois.
        N: [ligne('13100000', -800), ligne('13010000', -5_000)],
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.resultatComptable).toBe(800);
  });

  it('LIT une cascade de soldes intermédiaires arrêtée en chemin (Titre VIII ch. 19 § 2.4)', async () => {
    // Marge 12 000 virée à la valeur ajoutée, et ainsi de suite jusqu'au
    // résultat des activités ordinaires, 1 700 · le virement vers le 131
    // n'a pas encore été passé, et le hors activités ordinaires (-900) est
    // resté au 138. Chaque virement solde le compte précédent : ne restent
    // que le 137 et le 138. Lire le 131 et le 139 seuls rendait ZÉRO.
    const { s } = service({
      balances: {
        N: [ligne('13200000', 0), ligne('13300000', 0), ligne('13700000', -1_700), ligne('13800000', 900)],
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.sourceResultat).toBe('COMPTE_13');
    expect(r.resultatComptable).toBe(800);
  });

  it('retient la PERTE portée au 139', async () => {
    const { s } = service({ balances: { N: [ligne('13900000', 1_500)] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.resultatComptable).toBe(-1_500);
  });
});

describe('Impôt sur les sociétés · art. 56 et 57', () => {
  it('applique 30 % du résultat fiscal après réintégrations et déductions', async () => {
    const { s } = service({
      balances: { N: [ligne('70110000', -100_000), ligne('60110000', 60_000)] },
      retraitements: {
        N: [
          { sens: SensRetraitementFiscal.REINTEGRATION, montant: 5_000 },
          { sens: SensRetraitementFiscal.DEDUCTION, montant: 1_000 },
        ],
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.resultatComptable).toBe(40_000);
    expect(r.resultatFiscal).toBe(44_000);
    expect(r.impotTheorique).toBe(13_200);
    expect(r.impotMinimum).toBe(1_000);
    expect(r.impotDu).toBe(13_200);
    expect(r.minimumApplique).toBe(false);
  });

  it('retient l’impôt minimum de 1 % du chiffre d’affaires quand il dépasse l’impôt théorique, déficit compris', async () => {
    const { s } = service({
      balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] },
      dossier: { acomptesVerses: 4_000 },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.resultatFiscal).toBe(-200_000);
    expect(r.impotTheorique).toBe(0);
    expect(r.impotMinimum).toBe(10_000);
    expect(r.impotDu).toBe(10_000);
    expect(r.minimumApplique).toBe(true);
    expect(r.soldeAPayer).toBe(6_000);
    // Les acomptes du prochain exercice se calent sur l'impôt de celui-ci ·
    // 30 %, 30 %, 20 % (art. 57 bis LPF).
    expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([3_000, 3_000, 2_000]);
  });
});

/**
 * BASE DES ACOMPTES PROVISIONNELS · art. 57 bis de la loi de procédures
 * fiscales, TEL QUE MODIFIÉ par la loi de finances n° 25/060 du 29 décembre
 * 2025 : les acomptes sont calculés « sur base de l'impôt déclaré au titre de
 * l'exercice précédent, AUGMENTÉ DES SUPPLÉMENTS ÉVENTUELS ÉTABLIS PAR
 * L'ADMINISTRATION DES IMPÔTS […] QUE CES SOMMES FASSENT OU NON L'OBJET DE
 * CONTESTATION ».
 *
 * CE QUE RIEN NE VOYAIT. Un supplément naît d'un avis de redressement, jamais
 * d'une écriture : aucun solde de compte ne le porte, et le logiciel ne peut
 * que le recevoir. Assis sur le seul impôt calculé, les trois acomptes
 * proposés à un dossier redressé sont sous-évalués, et l'insuffisance de
 * versement se paie même quand le redressement est contesté. Rien dans le
 * calcul ne se déséquilibre : les trois montants restent 30/30/20 d'une base,
 * mais de la mauvaise.
 *
 * Les ÉCHÉANCES elles-mêmes viennent de la loi de finances et non de la
 * rédaction de 2023 (« avant le 1er août… »), périmée · d'où le dernier test.
 */
describe('Base des acomptes provisionnels · art. 57 bis LPF', () => {
  const dossierRedresse = (supplements: number) =>
    service({
      balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] },
      dossier: { supplementsAdministration: supplements },
    });

  it('ajoute les suppléments de l’Administration à la base des trois acomptes', async () => {
    const { s } = dossierRedresse(5_000);
    const r = await s.resultatFiscal('t1', 'N');
    // Impôt minimum de 10 000, plus 5 000 de supplément : la base est 15 000.
    expect(r.impotDu).toBe(10_000);
    expect(r.baseAcomptes).toBe(15_000);
    expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([4_500, 4_500, 3_000]);
  });

  it('ne touche NI le solde à payer NI l’impôt dû de l’exercice', async () => {
    // Le supplément porte sur un exercice ANTÉRIEUR · l'imputer ici ferait
    // payer deux fois le même redressement.
    const { s } = dossierRedresse(5_000);
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.impotDu).toBe(10_000);
    expect(r.soldeAPayer).toBe(10_000);
  });

  it('sans supplément, la base est l’impôt dû seul', async () => {
    const { s } = dossierRedresse(0);
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.baseAcomptes).toBe(10_000);
    expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([3_000, 3_000, 2_000]);
  });

  it('porte les échéances de la loi de finances, pas celles de la rédaction de 2023', async () => {
    const { s } = dossierRedresse(0);
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.acomptesProchainExercice.map((a) => a.echeance)).toEqual(['25 juillet', '25 septembre', '25 novembre']);
  });
});

describe('Acomptes de l’année de la dissolution · bornés comme l’échéancier (relecture du 2026-10-07, mineur 7)', () => {
  // L'exercice 2025, clos avant la dissolution du 15/05/2026, sert ses
  // acomptes en 2026 · ceux qui échoient après la dernière cotisation
  // spéciale ne sont plus dus (loi n° 23/053, art. 13 al. 3), comme dans
  // l'échéancier des retenues (`echeancierDissolution().retenir`).
  const exercice2025 = [{ id: 'N', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }];
  const dossierDissous = (tenant: Record<string, unknown>) =>
    service({
      balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] },
      exercices: exercice2025,
      tenant: { dateDissolution: new Date(Date.UTC(2026, 4, 15)), regimeLiquidation: null, associeUniquePersonneMorale: null, ...tenant },
    });

  it('liquidation close le 10/08/2026 · seul l’acompte du 25 juillet reste dû', async () => {
    const { s } = dossierDissous({ dateClotureLiquidation: new Date(Date.UTC(2026, 7, 10)) });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.acomptesProchainExercice.map((a) => a.echeance)).toEqual(['25 juillet']);
    expect(r.baseAcomptes).toBe(10_000);
    expect(r.observations.some((o: string) => o.startsWith('ACOMPTES APRÈS LA DISSOLUTION · 2 acompte(s) de 2026'))).toBe(true);
  });

  it('sans liquidation, la cotisation de juin est la dernière · aucun acompte de 2026', async () => {
    const { s } = dossierDissous({ associeUniquePersonneMorale: true });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.acomptesProchainExercice).toEqual([]);
    expect(r.baseAcomptes).toBeNull();
  });

  it('liquidation dont la clôture n’est pas déclarée · les trois restent servis, rien ne les borne encore', async () => {
    const { s } = dossierDissous({});
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.acomptesProchainExercice).toHaveLength(3);
  });
});

describe('Report des déficits · art. 51 et 52', () => {
  const ex = (id: string, annee: number) => ({
    id,
    dateDebut: new Date(Date.UTC(annee, 0, 1)),
    dateFin: new Date(Date.UTC(annee, 11, 31)),
  });

  it('impute le déficit antérieur sur le bénéfice, sans jamais dépasser celui-ci', async () => {
    const { s } = service({
      exercices: [ex('N-1', 2025), ex('N', 2026)],
      balances: {
        'N-1': [ligne('60110000', 30_000)], // perte 30 000
        N: [ligne('70110000', -20_000)], // bénéfice 20 000
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.deficitAnterieur.montant).toBe(30_000);
    expect(r.deficitImpute).toBe(20_000);
    expect(r.resultatFiscal).toBe(0);
  });

  /**
   * CE TEST GELAIT LE DÉFAUT DU CAS CHIFFRÉ C05 (`docs/cas-chiffres/is.md`),
   * corrigé le 2026-10-04. Il attendait 11 000 · le bénéfice de 2024 consommait
   * la perte de 2023, parce que la perte de 2022, hors de la fenêtre de 2026,
   * n'était pas lue. Or en 2024 la perte de 2022 était imputable (troisième
   * exercice qui suit, art. 51) et la plus ancienne · c'est elle que ce
   * bénéfice a consommée, vu de 2024 comme de 2025. Rejoué dans l'ordre depuis
   * le premier exercice, le report de 2026 est 10 000 (2023, intacte) plus
   * 5 000 (2025) ; la perte de 2022 reste perdue au-delà de sa fenêtre.
   */
  it('consomme les déficits dans l’ordre sur les bénéfices intermédiaires, et perd ce qui a plus de trois exercices', async () => {
    const { s } = service({
      exercices: [ex('N-4', 2022), ex('N-3', 2023), ex('N-2', 2024), ex('N-1', 2025), ex('N', 2026)],
      balances: {
        'N-4': [ligne('60110000', 100_000)], // perte de 2022 · imputable jusqu'en 2025, puis perdue
        'N-3': [ligne('60110000', 10_000)], // perte 10 000
        'N-2': [ligne('70110000', -4_000)], // bénéfice 4 000 · consomme 4 000 de 2022, la plus ancienne
        'N-1': [ligne('60110000', 5_000)], // perte 5 000
        N: [ligne('70110000', -1_000)],
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.deficitAnterieur.montant).toBe(15_000);
    expect(r.deficitAnterieur.detail.map((d) => d.montant)).toEqual([10_000, 5_000]);
  });

  /**
   * DEUX RÈGLES DE L'ANCIEN RÉGIME, ET LE CALCUL QUI LES REFUSE. Le séminaire
   * CPCC sur l'arrêté des comptes 2024 enseigne, sur l'art. 42 de
   * l'ordonnance-loi n° 69/009 dans sa rédaction consolidée de 2023, que
   * « l'imputation des pertes professionnelles […] ne peut dépasser 60 % du
   * bénéfice fiscal avant leur imputation », et que les amortissements réputés
   * différés se reportent sans limitation de durée. Les deux valaient sous
   * l'IBP, abrogé au 1er janvier 2026.
   *
   * Vérifié le 2026-09-05 dans la loi n° 23/053 art. 51 et 52 (compilation DGI
   * au 19/07/2026), que la loi de finances n° 25/060 ne modifie pas : NI le
   * plafond de 60 %, NI le report illimité n'y figurent. L'art. 51 dit au
   * contraire que les amortissements réputés différés « sont considérés comme
   * des déficits ordinaires », donc soumis aux trois exercices comme le reste.
   *
   * Ces deux tests existent pour qu'un praticien qui cite l'ancien régime de
   * mémoire, ou qui relit ces diapositives, fasse tomber la suite plutôt que
   * de rétablir la règle en silence.
   */
  it('impute le déficit à 100 % du bénéfice · aucun plafond de 60 % (art. 51)', async () => {
    const { s } = service({
      exercices: [ex('N-1', 2025), ex('N', 2026)],
      balances: {
        'N-1': [ligne('60110000', 100_000)], // perte 100 000
        N: [ligne('70110000', -50_000)], // bénéfice 50 000
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    // Sous plafond de 60 %, l'imputation vaudrait 30 000 et l'impôt porterait
    // sur 20 000. La loi actuelle laisse imputer le bénéfice entier.
    expect(r.deficitImpute).toBe(50_000);
    expect(r.resultatFiscal).toBe(0);
  });

  it('perd un amortissement réputé différé au-delà de trois exercices · art. 51, déficit ordinaire', async () => {
    const { s } = service({
      exercices: [ex('N-4', 2022), ex('N-3', 2023), ex('N-2', 2024), ex('N-1', 2025), ex('N', 2026)],
      balances: {
        // Exercice sans produit : la dotation aux amortissements est à elle
        // seule la perte, cas même de l'art. 52, 3°.
        'N-4': [ligne('68130000', 40_000)],
        'N-3': [],
        'N-2': [],
        'N-1': [],
        N: [ligne('70110000', -40_000)], // bénéfice 40 000
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    // Report illimité : les 40 000 s'imputeraient et l'impôt serait nul.
    expect(r.deficitAnterieur.montant).toBe(0);
    expect(r.resultatFiscal).toBe(40_000);
  });

  it('laisse un déficit saisi à la main primer sur le calcul · dossier repris à un confrère', async () => {
    const { s } = service({
      exercices: [ex('N-1', 2025), ex('N', 2026)],
      balances: { 'N-1': [ligne('60110000', 30_000)], N: [ligne('70110000', -50_000)] },
      dossier: { deficitAnterieurSaisi: 7_000 },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.deficitAnterieur).toMatchObject({ montant: 7_000, saisi: true });
    expect(r.resultatFiscal).toBe(43_000);
  });
});

describe('Régime selon la forme juridique · art. 3 à 6 et 107 à 128', () => {
  it('une entreprise individuelle bascule de régime avec son chiffre d’affaires', async () => {
    const cas = async (ca: number, nature?: 'VENTE' | 'PRESTATIONS') => {
      const { s } = service({
        forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
        balances: { N: [ligne('70110000', -ca)] },
        dossier: nature ? { natureActivite: nature } : undefined,
      });
      return s.resultatFiscal('t1', 'N');
    };
    const micro = await cas(20_000_000);
    expect(micro.regime).toBe('IRPP_MICRO_ENTREPRISE');
    expect(micro.impotDu).toBeNull();

    const petiteSansNature = await cas(100_000_000);
    expect(petiteSansNature.regime).toBe('IRPP_PETITE_ENTREPRISE');
    // Le taux ne se devine pas : sans nature d'activité, pas de montant.
    expect(petiteSansNature.impotDu).toBeNull();
    expect((await cas(100_000_000, 'VENTE')).impotDu).toBe(1_000_000);
    expect((await cas(100_000_000, 'PRESTATIONS')).impotDu).toBe(2_000_000);

    const reel = await cas(400_000_000);
    expect(reel.regime).toBe('IRPP_REGIME_REEL');
    expect(reel.impotDu).toBeNull();
    expect(reel.impotMinimum).toBe(4_000_000);
  });

  it('une société de personnes est signalée comme imposable sur option seulement', async () => {
    const { s } = service({ forme: FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF, balances: { N: [] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IMPOT_SOCIETES');
    expect(r.observations.join(' ')).toMatch(/SUR OPTION/);
  });

  it('une forme non renseignée est dite, pas devinée en silence', async () => {
    const { s } = service({ forme: null, balances: { N: [] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.observations.join(' ')).toMatch(/pas renseignée/);
  });
});

describe('Cloisonnement et saisie', () => {
  it('refuse un dossier SYCEBNL · une EBNL est exemptée (art. 5)', async () => {
    const { s } = service({ referentiel: Referentiel.SYCEBNL, balances: { N: [] } });
    await expect(s.resultatFiscal('t1', 'N')).rejects.toThrow(/SYSCOHADA/);
  });

  it('impose un fondement écrit à une ligne libre, et le sens du catalogue aux autres', async () => {
    const { s, crees } = service({ balances: { N: [] } });
    await expect(
      s.ajouterRetraitement('t1', 'N', { code: CODE_LIBRE, libelle: 'x', montant: 10 }),
    ).rejects.toThrow(/fondement/);
    // Une déduction demandée sur un code de réintégration est ignorée · le
    // sens d'un code est celui du catalogue.
    await s.ajouterRetraitement('t1', 'N', {
      code: 'AMENDES_PENALITES',
      sens: SensRetraitementFiscal.DEDUCTION,
      montant: 10,
    });
    expect(crees[0].sens).toBe(SensRetraitementFiscal.REINTEGRATION);
  });

  it('chaque entrée du catalogue cite un article et porte un sens', () => {
    for (const r of CATALOGUE_RETRAITEMENTS) {
      expect(r.source.length).toBeGreaterThan(8);
      expect([SensRetraitementFiscal.REINTEGRATION, SensRetraitementFiscal.DEDUCTION]).toContain(r.sens);
      if (r.plafond) expect(r.plafond.part).toBeGreaterThan(0);
    }
    // Pas de doublon de code · un retraitement enregistré se relit par son code.
    expect(new Set(CATALOGUE_RETRAITEMENTS.map((r) => r.code)).size).toBe(CATALOGUE_RETRAITEMENTS.length);
  });
});

/**
 * LE RÉGIME D'UNE PERSONNE PHYSIQUE NE SE LIT PAS DANS UN SEUL EXERCICE ·
 * art. 113 de la loi n° 23/053 :
 *
 *   « Les entreprises dont le chiffre d'affaires hors taxes devient inférieur
 *   à la limite de leur régime d'imposition ne sont soumises au régime
 *   d'imposition immédiatement inférieur que lorsque leur chiffre d'affaires
 *   est resté en dessous de cette limite pendant deux exercices consécutifs.
 *   Toutefois, les entreprises dont le chiffre d'affaires hors taxes devient
 *   supérieur à la limite de leur régime d'imposition sont soumises
 *   immédiatement au régime supérieur […]. »
 *
 * L'article est ASYMÉTRIQUE : montée immédiate, descente après deux exercices
 * consécutifs et d'un seul cran. Trancher sur le chiffre d'affaires de
 * l'exercice en cours, ce que faisait le service, déclassait dès la première
 * mauvaise année · avec un impôt et un calendrier de paiement qui n'étaient
 * pas ceux du contribuable.
 */
describe('Régime des personnes physiques · art. 113, déclassement et reclassement', () => {
  const ex = (id: string, annee: number) => ({
    id,
    dateDebut: new Date(Date.UTC(annee, 0, 1)),
    dateFin: new Date(Date.UTC(annee, 11, 31)),
  });
  const individuelle = (
    exercices: { id: string; dateDebut: Date; dateFin: Date }[],
    balances: Record<string, Ligne[]>,
    nature?: 'VENTE' | 'PRESTATIONS',
  ) =>
    service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      exercices,
      balances,
      dossier: nature ? { natureActivite: nature } : undefined,
    }).s;

  it('NE DÉCLASSE PAS après un seul exercice sous le seuil', async () => {
    // 400 000 000 en 2025 (régime réel), 100 000 000 en 2026 · un seul
    // exercice sous la limite : le régime réel est maintenu.
    const s = individuelle(
      [ex('N-1', 2025), ex('N', 2026)],
      { 'N-1': [ligne('70110000', -400_000_000)], N: [ligne('70110000', -100_000_000)] },
      'VENTE',
    );
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_REGIME_REEL');
    // L'impôt des petites entreprises aurait été de 1 000 000 (1 % du chiffre
    // d'affaires) · il n'est pas dû, et le barème du revenu global n'est pas
    // ici : aucun montant n'est annoncé.
    expect(r.impotDu).toBeNull();
    expect(r.observations.join(' ')).toMatch(/Art. 113/);
    expect(r.observations.join(' ')).toMatch(/MAINTENU/);
  });

  it('déclasse après DEUX exercices consécutifs sous le seuil', async () => {
    const s = individuelle(
      [ex('N-2', 2024), ex('N-1', 2025), ex('N', 2026)],
      {
        'N-2': [ligne('70110000', -400_000_000)],
        'N-1': [ligne('70110000', -100_000_000)],
        N: [ligne('70110000', -100_000_000)],
      },
      'VENTE',
    );
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_PETITE_ENTREPRISE');
    expect(r.impotDu).toBe(1_000_000);
  });

  it('ne descend que d’UN CRAN · le régime réel tombe aux petites entreprises, pas aux micro', async () => {
    // Chiffre d'affaires effondré à 20 000 000, sous le seuil des
    // micro-entreprises, deux exercices de suite. L'art. 113 ne donne que le
    // régime « immédiatement inférieur » : il faudra deux exercices de plus
    // sous 25 000 000 pour descendre encore.
    const s = individuelle(
      [ex('N-2', 2024), ex('N-1', 2025), ex('N', 2026)],
      {
        'N-2': [ligne('70110000', -400_000_000)],
        'N-1': [ligne('70110000', -20_000_000)],
        N: [ligne('70110000', -20_000_000)],
      },
      'VENTE',
    );
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_PETITE_ENTREPRISE');
    expect(r.impotDu).toBe(200_000);
  });

  it('reclasse IMMÉDIATEMENT vers le haut · art. 113, al. 2', async () => {
    const s = individuelle([ex('N-1', 2025), ex('N', 2026)], {
      'N-1': [ligne('70110000', -20_000_000)],
      N: [ligne('70110000', -400_000_000)],
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_REGIME_REEL');
  });

  it('AVERTIT de l’option pour le régime réel, qu’aucune écriture ne porte · art. 110 et 111', async () => {
    const s = individuelle([ex('N', 2026)], { N: [ligne('70110000', -100_000_000)] }, 'VENTE');
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_PETITE_ENTREPRISE');
    const dit = r.observations.join(' ');
    expect(dit).toMatch(/Art. 110 et 111/);
    expect(dit).toMatch(/1er février/);
    expect(dit).toMatch(/irrévocable/);
    // Et le dossier sans historique le dit, au lieu de faire comme si le
    // chiffre d'affaires d'un exercice suffisait.
    expect(dit).toMatch(/Aucun exercice antérieur/);
  });
});

/**
 * LE CALENDRIER DE PAIEMENT D'UNE PETITE ENTREPRISE · art. 57, al. 3 et
 * art. 57 quater de la loi de procédures fiscales.
 *
 * Ce que le service faisait : les trois acomptes de l'art. 57 bis, servis dès
 * que l'impôt était calculable, donc à toute petite entreprise dont la nature
 * d'activité était renseignée. Total juste, dates fausses, article faux · le
 * renvoi de l'art. 57 bis à « l'article 57, ALINÉA 2 » exclut la petite
 * entreprise, régie par l'alinéa 3.
 */
describe('Paiement en deux quotités · art. 57, al. 3 et 57 quater LPF', () => {
  const petite = async (nature: 'VENTE' | 'PRESTATIONS') => {
    const { s } = service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70610000', -100_000_000)] },
      dossier: { natureActivite: nature },
    });
    return s.resultatFiscal('t1', 'N');
  };

  it('sert 60 % au 31 janvier et 40 % ensuite, sur l’impôt de l’exercice', async () => {
    const r = await petite('PRESTATIONS');
    expect(r.impotDu).toBe(2_000_000);
    expect(r.quotitesPetiteEntreprise.map((q) => [q.quotite, q.echeance, q.montant])).toEqual([
      [0.6, '31 janvier', 1_200_000],
      [0.4, '30 avril', 800_000],
    ]);
  });

  it('NE SERT PAS les trois acomptes de l’impôt sur les sociétés', async () => {
    const r = await petite('PRESTATIONS');
    expect(r.acomptesProchainExercice).toEqual([]);
    expect(r.baseAcomptes).toBeNull();
    expect(r.observations.join(' ')).toMatch(/DEUX QUOTITÉS/);
  });

  it('porte la réserve sur la seconde échéance, que le texte officiel libelle mal', async () => {
    const r = await petite('VENTE');
    expect(r.quotitesPetiteEntreprise[0].reserve).toBeNull();
    expect(r.quotitesPetiteEntreprise[1].reserve).toMatch(/57 quater/);
    expect(r.observations.join(' ')).toMatch(/à confirmer auprès du service gestionnaire/);
  });

  it('laisse à l’impôt sur les sociétés ses trois acomptes, et aucune quotité', async () => {
    const { s } = service({
      balances: { N: [ligne('70110000', -100_000_000), ligne('60110000', 60_000_000)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.quotitesPetiteEntreprise).toEqual([]);
    expect(r.acomptesProchainExercice.map((a) => a.echeance)).toEqual(['25 juillet', '25 septembre', '25 novembre']);
  });

  it('une micro-entreprise ne reçoit ni acompte ni quotité', async () => {
    const { s } = service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70110000', -20_000_000)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_MICRO_ENTREPRISE');
    expect(r.acomptesProchainExercice).toEqual([]);
    expect(r.quotitesPetiteEntreprise).toEqual([]);
  });
});

/**
 * LES DÉCHÉANCES DU REPORT DÉFICITAIRE SE DISENT, ELLES NE SE CALCULENT PAS ·
 * art. 51, al. 2 (absence de déclaration après mise en demeure) et art. 52,
 * 1° (nouvel exploitant d'une entreprise déficitaire, changement complet
 * d'activité). Ni la mise en demeure ni le changement d'exploitant n'entrent
 * dans un journal : les deviner serait pire que les signaler.
 */
describe('Déchéances du report déficitaire · avertissements, art. 51 al. 2 et 52, 1°', () => {
  const ex = (id: string, annee: number) => ({
    id,
    dateDebut: new Date(Date.UTC(annee, 0, 1)),
    dateFin: new Date(Date.UTC(annee, 11, 31)),
  });

  it('avertit dès qu’un déficit antérieur est imputé', async () => {
    const { s } = service({
      exercices: [ex('N-1', 2025), ex('N', 2026)],
      balances: { 'N-1': [ligne('60110000', 30_000)], N: [ligne('70110000', -20_000)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.deficitImpute).toBe(20_000);
    const dit = r.observations.join(' ');
    expect(dit).toMatch(/Art. 51, al. 2/);
    expect(dit).toMatch(/mise en demeure/);
    expect(dit).toMatch(/Art. 52, 1°/);
    expect(dit).toMatch(/nouvel exploitant/);
  });

  it('ne dit rien quand il n’y a aucun déficit à reporter', async () => {
    const { s } = service({ balances: { N: [ligne('70110000', -20_000)] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.deficitAnterieur.montant).toBe(0);
    expect(r.observations.join(' ')).not.toMatch(/mise en demeure/);
  });

  it('avertit aussi quand le déficit a été SAISI à la main', async () => {
    const { s } = service({ balances: { N: [ligne('70110000', -50_000)] }, dossier: { deficitAnterieurSaisi: 7_000 } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.observations.join(' ')).toMatch(/Art. 51, al. 2/);
  });
});

/**
 * ARRONDI LÉGAL DE L'IMPÔT · loi n° 23/053, art. 150, TITRE VI, chapitre 1
 * « DES DISPOSITIONS RELATIVES AUX ARRONDIS » :
 *
 *   « Lorsque le montant de l'Impôt sur les Sociétés, de l'Impôt minimum, de
 *   l'Impôt sur le Revenu des Personnes Physiques et de tous autres
 *   prélèvements prévus dans la présente Loi comprend une décimale, cette
 *   fraction est arrondie à l'unité supérieure si la première décimale est
 *   supérieure ou égale à 5. Dans le cas contraire, elle est ramenée à
 *   l'unité inférieure.
 *   Lorsque le montant arrondi comprend une tranche supérieure ou égale à 50
 *   Francs congolais, celle-ci est ramenée à la centaine de Francs congolais
 *   supérieure.
 *   Lorsque cette tranche est inférieure à 50 Francs congolais, elle est
 *   ramenée à la centaine de Francs congolais inférieure. »
 *
 * Le module liquidait au CENTIME. L'écart par montant est inférieur à cent
 * francs, mais le montant affiché n'était pas celui qui se déclare, et il
 * servait d'assiette aux acomptes de l'exercice suivant.
 */
describe('Arrondi légal de l’impôt · art. 150', () => {
  it('supprime la décimale, PUIS remonte ou descend à la centaine', () => {
    // 1 % de 123 456 789 = 1 234 567,89 · décimale 8 ≥ 5, donc 1 234 568,
    // puis tranche 68 ≥ 50, donc centaine supérieure.
    expect(arrondirImpotArt150(1_234_567.89)).toBe(1_234_600);
    // Décimale 4 < 5 : unité inférieure, 1 234 549, tranche 49 < 50.
    expect(arrondirImpotArt150(1_234_549.4)).toBe(1_234_500);
    // La décimale seule fait basculer la centaine · 1 234 549,5 devient
    // 1 234 550, dont la tranche atteint 50.
    expect(arrondirImpotArt150(1_234_549.5)).toBe(1_234_600);
    expect(arrondirImpotArt150(0)).toBe(0);
    expect(arrondirImpotArt150(49)).toBe(0);
    expect(arrondirImpotArt150(50)).toBe(100);
    expect(arrondirImpotArt150(1_234_600)).toBe(1_234_600);
  });

  it('l’impôt minimum de l’art. 57 sort arrondi, et sert de base aux acomptes', async () => {
    const { s } = service({
      balances: { N: [ligne('70110000', -123_456_789), ligne('60110000', 200_000_000)] },
      dossier: { supplementsAdministration: 0 },
    });
    const r = await s.resultatFiscal('t1', 'N');
    // Au centime, le module affichait 1 234 567,89.
    expect(r.impotMinimum).toBe(1_234_600);
    expect(r.impotDu).toBe(1_234_600);
    expect(r.minimumApplique).toBe(true);
    expect(r.baseAcomptes).toBe(1_234_600);
  });

  it('l’IRPP d’une petite entreprise aussi · l’article le nomme', async () => {
    const { s } = service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70110000', -123_456_789)] },
      dossier: { natureActivite: 'PRESTATIONS' },
    });
    const r = await s.resultatFiscal('t1', 'N');
    // 2 % de 123 456 789 = 2 469 135,78 · décimale 7, donc 2 469 136, puis
    // tranche 36 < 50, donc centaine inférieure.
    expect(r.impotDu).toBe(2_469_100);
    expect(r.quotitesPetiteEntreprise.map((q) => q.montant)).toEqual([1_481_460, 987_640]);
  });
});

/**
 * ART. 44, AL. 2, 2° · LE PLAFOND SERVI À L'ÉCRAN DE SAISIE.
 *
 * La page calcule l'excédent à réintégrer à partir de `plafonds.montantAdmis`
 * et de la charge que le comptable vient de taper. Servir 0,5 % du chiffre
 * d'affaires à un dossier dont le droit à déduction n'est pas ouvert, c'est
 * lui faire déclarer un déficit reportable trop élevé.
 */
describe('Plafond des dons servi à l’écran · condition de l’art. 44', () => {
  const dons = (r: { plafonds: { code: string; montantAdmis: number | null; enonce: string; conditionOuverte: boolean | null }[] }) =>
    r.plafonds.find((p) => p.code === 'DONS_EXCEDENT')!;

  it('dossier DÉFICITAIRE · le plafond est servi à zéro, et le seuil est dit', async () => {
    const { s } = service({ balances: { N: [ligne('70110000', -100_000_000), ligne('60110000', 102_800_000)] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.resultatFiscalBrut).toBe(-2_800_000);
    expect(dons(r).montantAdmis).toBe(0);
    expect(dons(r).conditionOuverte).toBe(false);
    expect(dons(r).enonce.replace(/[\u202f\u00a0]/g, ' ')).toContain('dépassent 2 800 000');
  });

  it('dossier BÉNÉFICIAIRE · le plafond joue, et le relevé du 1° est rappelé', async () => {
    const { s } = service({ balances: { N: [ligne('70110000', -100_000_000), ligne('60110000', 60_000_000)] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(dons(r).montantAdmis).toBe(500_000);
    expect(dons(r).conditionOuverte).toBe(true);
    expect(dons(r).enonce).toContain('relevé');
  });

  it('les plafonds SANS condition d’ouverture ne bougent pas, déficit ou non', async () => {
    // Art. 49, 1° · 2 ‰ du chiffre d'affaires, sans aucune condition de
    // résultat. Neutraliser tous les plafonds d'un dossier déficitaire serait
    // l'erreur opposée, et elle ferait payer trop.
    const { s } = service({ balances: { N: [ligne('70110000', -100_000_000), ligne('60110000', 102_800_000)] } });
    const r = await s.resultatFiscal('t1', 'N');
    const cadeaux = r.plafonds.find((p) => p.code === 'CADEAUX_EXCEDENT')!;
    expect(cadeaux.montantAdmis).toBe(200_000);
    expect(cadeaux.conditionOuverte).toBeNull();
  });
});

/**
 * LES DEUX BRANCHES D'ASSIETTE DES ACOMPTES QUE LE MODULE NE CALCULE PAS ·
 * art. 57 bis, al. 1er LPF, dans sa rédaction issue de la L.F. n° 25/060 :
 * les acomptes sont calculés « sur base de l'impôt déclaré au titre de
 * l'exercice précédent, augmenté des suppléments éventuels établis par
 * l'Administration des Impôts, ou, en cas d'absence de déclaration, de
 * l'impôt reconstitué d'office ».
 *
 * Aucune écriture ne dit qu'un exercice n'a pas été déclaré, ni ce que
 * l'Administration a reconstitué · le module le DIT plutôt que de l'inventer.
 */
describe('Assiette des acomptes · les branches que le module ne peut pas calculer', () => {
  it('avertit de la base reconstituée d’office, qui REMPLACE l’impôt déclaré', async () => {
    const { s } = service({ balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.observations.join(' ')).toContain("reconstitué d'office");
    expect(r.observations.join(' ')).toContain('REMPLACE');
  });

  it('dit qu’aucun acompte n’est dû quand le dossier n’a pas d’exercice antérieur', async () => {
    const { s } = service({ balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)] } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.observations.join(' ')).toContain("AUCUN acompte n'est dû au titre de la présente année");
  });

  it('se tait sur ce point dès qu’un exercice antérieur est tenu', async () => {
    const { s } = service({
      exercices: [
        { id: 'N-1', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) },
        { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
      ],
      balances: { N: [ligne('70110000', -1_000_000), ligne('60110000', 1_200_000)], 'N-1': [] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.observations.join(' ')).not.toContain("AUCUN acompte n'est dû");
    // La branche reconstituée d'office, elle, reste servie · c'est l'exercice
    // précédent qui peut ne pas avoir été déclaré.
    expect(r.observations.join(' ')).toContain("reconstitué d'office");
  });

  it('ne sert AUCUNE de ces observations à qui ne verse pas d’acompte', async () => {
    // Art. 57, al. 3 · une micro-entreprise acquitte un forfait annuel.
    const { s } = service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70110000', -20_000_000)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_MICRO_ENTREPRISE');
    expect(r.observations.join(' ')).not.toContain("reconstitué d'office");
  });
});

/**
 * ART. 64, 3° ET ART. 108 · les contribuables dispensés de patente sont
 * EXEMPTÉS d'IRPP et exclus du régime des micro-entreprises. Le module
 * annonçait à tout dossier de personne physique à faible chiffre d'affaires
 * un régime et une base d'imposition, sans jamais poser la question.
 *
 * La dispense est un fait administratif : le logiciel ne la devine pas, il la
 * rappelle avec la liste limitative que l'art. 108 énumère lui-même.
 */
describe('Contribuables dispensés de patente · art. 64, 3° et 108', () => {
  it('avertit le dossier classé en micro-entreprise', async () => {
    const { s } = service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70110000', -20_000_000)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_MICRO_ENTREPRISE');
    const dit = r.observations.join(' ');
    expect(dit).toContain("dispensés de l'obligation d'obtenir la patente");
    expect(dit).toContain('vendeurs de journaux à la criée');
    expect(dit).toContain('EXEMPTÉS');
  });

  it('ne le sert pas à une petite entreprise, que l’art. 108 ne vise pas', async () => {
    const { s } = service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70110000', -100_000_000)] },
      dossier: { natureActivite: 'VENTE' },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.regime).toBe('IRPP_PETITE_ENTREPRISE');
    expect(r.observations.join(' ')).not.toContain('patente');
  });
});

/** PASSE F5 · ce que le Titre 3 pose et qu'aucune balance ne tranche. */
describe('passe F5 · observations du Titre 3', () => {
  it("sert l'art. 103 à toute personne physique, et les art. 89, 90 et 92 à 99 au seul régime réel", async () => {
    const micro = await service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70110000', -20_000_000)] },
    }).s.resultatFiscal('t1', 'N');
    const reel = await service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70110000', -5_000_000_000)] },
      dossier: { natureActivite: 'VENTE' },
    }).s.resultatFiscal('t1', 'N');
    const petite = await service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      balances: { N: [ligne('70110000', -100_000_000)] },
      dossier: { natureActivite: 'VENTE' },
    }).s.resultatFiscal('t1', 'N');
    expect({
      micro: [micro.regime, micro.observations.some((o) => o.startsWith('Art. 103')), micro.observations.some((o) => o.startsWith('Art. 92 à 99'))],
      petite: [petite.regime, petite.observations.some((o) => o.startsWith('Art. 89, al. 2 et 3'))],
      reel: [
        reel.regime,
        reel.observations.some((o) => o.startsWith('Art. 103')),
        reel.observations.some((o) => o.startsWith('Art. 89, al. 2 et 3')),
        reel.observations.some((o) => o.startsWith('Art. 92 à 99')),
      ],
    }).toEqual({
      micro: ['IRPP_MICRO_ENTREPRISE', true, false],
      petite: ['IRPP_PETITE_ENTREPRISE', false],
      reel: ['IRPP_REGIME_REEL', true, true, true],
    });
  });

  // PAQUET 1, C4 · l'observation se sert sur les FAITS déclarés, jamais sur
  // la seule forme. Ce test la disait servie à toute SARL SANS CONDITION (il
  // gelait le défaut) · une SARL à plusieurs associés lisait qu'elle était
  // « unipersonnelle à associé unique personne physique ». Art. 63, al. 2,
  // 1° · associé ou actionnaire UNIQUE, PERSONNE PHYSIQUE ; le dossier ne
  // déclare l'unicité que d'une SAS (AUSCGIE art. 853-2) et la personne
  // morale de l'associé unique (art. 201, al. 4).
  //
  // PREMIER TOUR DE RELECTURE, CONSTAT 2 · la version de C4 de ce test gelait
  // le défaut inverse · la SARL, la SA et la SAS à unicité non dite ne
  // recevaient RIEN, et la SARL à associé unique personne physique, que
  // l'article nomme le premier, perdait l'observation sans un mot. Un silence
  // n'est pas un « non » · l'observation se sert avec sa condition, et ne se
  // retire que sur un fait déclaré qui l'écarte.
  it("sert l'anomalie de l'art. 63, al. 2, 1° sous sa condition tant que le dossier ne tranche pas, sans quitter l'IS", async () => {
    const lire = async (forme: FormeJuridiqueSyscohada, tenant: Record<string, unknown> = {}) => {
      const r = await service({ forme, tenant, balances: { N: [ligne('70110000', -20_000_000)] } }).s.resultatFiscal('t1', 'N');
      const obs = r.observations.filter((o) => o.includes('art. 63, al. 2, 1°'));
      const condition = obs.some((o) => o.includes(COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE))
        ? 'NATURE'
        : obs.some((o) => o.includes(COMPLEMENT_UNICITE_NON_DECLAREE))
          ? 'UNICITE'
          : obs.some((o) => o.includes(COMPLEMENT_UNICITE_NON_DECLARABLE))
            ? 'UNICITE_NON_DECLARABLE'
            : null;
      return [r.regime, obs.length, condition];
    };
    const F = FormeJuridiqueSyscohada;
    expect({
      sarlSansFait: await lire(F.SOCIETE_RESPONSABILITE_LIMITEE),
      sarlAssociePm: await lire(F.SOCIETE_RESPONSABILITE_LIMITEE, { associeUniquePersonneMorale: true }),
      sarlNonPm: await lire(F.SOCIETE_RESPONSABILITE_LIMITEE, { associeUniquePersonneMorale: false }),
      saSansFait: await lire(F.SOCIETE_ANONYME),
      saAssociePm: await lire(F.SOCIETE_ANONYME, { associeUniquePersonneMorale: true }),
      sasUniciteNonDite: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUniqueSas: null }),
      sasUniciteNonDitePm: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUniqueSas: null, associeUniquePersonneMorale: true }),
      sasPluripersonnelle: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUniqueSas: false }),
      sasuNatureNonDite: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUniqueSas: true, associeUniquePersonneMorale: null }),
      sasuPersonnePhysique: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUniqueSas: true, associeUniquePersonneMorale: false }),
      sasuPersonneMorale: await lire(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, { associeUniqueSas: true, associeUniquePersonneMorale: true }),
      snc: await lire(F.SOCIETE_NOM_COLLECTIF),
    }).toEqual({
      // L'unicité d'une SARL ou d'une SA ne se déclare pas · servie, sous condition.
      sarlSansFait: ['IMPOT_SOCIETES', 1, 'UNICITE_NON_DECLARABLE'],
      sarlAssociePm: ['IMPOT_SOCIETES', 0, null],
      // « Non personne morale » ne dit pas qu'elle est unipersonnelle · la condition reste.
      sarlNonPm: ['IMPOT_SOCIETES', 1, 'UNICITE_NON_DECLARABLE'],
      saSansFait: ['IMPOT_SOCIETES', 1, 'UNICITE_NON_DECLARABLE'],
      saAssociePm: ['IMPOT_SOCIETES', 0, null],
      sasUniciteNonDite: ['IMPOT_SOCIETES', 1, 'UNICITE'],
      sasUniciteNonDitePm: ['IMPOT_SOCIETES', 0, null],
      sasPluripersonnelle: ['IMPOT_SOCIETES', 0, null],
      sasuNatureNonDite: ['IMPOT_SOCIETES', 1, 'NATURE'],
      sasuPersonnePhysique: ['IMPOT_SOCIETES', 1, null],
      sasuPersonneMorale: ['IMPOT_SOCIETES', 0, null],
      snc: ['IMPOT_SOCIETES', 0, null],
    });
  });

  it('les deux conditions disent la même chose, l’unicité ET la personne physique', () => {
    for (const complement of [COMPLEMENT_UNICITE_NON_DECLAREE, COMPLEMENT_UNICITE_NON_DECLARABLE]) {
      expect(complement).toContain("ne vaut que si la société n'a qu'un associé ou actionnaire, personne physique");
    }
  });

  it('unipersonnaliteDeLArticle63 · la règle seule, forme par forme', () => {
    const F = FormeJuridiqueSyscohada;
    const u = (formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null, associeUniqueSas?: boolean | null, associeUniquePersonneMorale?: boolean | null) =>
      unipersonnaliteDeLArticle63({ formeJuridiqueSyscohada, associeUniqueSas, associeUniquePersonneMorale });
    expect([
      u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true, false),
      u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true, null),
      u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true, undefined),
      u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, true, true),
      u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, false, false),
      u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, null, false),
      u(F.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, undefined, null),
      // Le fait de la SAS posé sur une autre forme ne vaut rien (le service
      // du dossier le refuse d'ailleurs, AUSCGIE art. 853-2) · l'unicité d'une
      // SA ou d'une SARL reste non déclarable.
      u(F.SOCIETE_ANONYME, true, false),
      u(F.SOCIETE_RESPONSABILITE_LIMITEE, true, false),
      u(F.SOCIETE_RESPONSABILITE_LIMITEE, false, true),
      u(F.SOCIETE_NOM_COLLECTIF, true, false),
      u(null, true, false),
    ]).toEqual([
      'ASSOCIE_PERSONNE_PHYSIQUE',
      'NATURE_NON_DECLAREE',
      'NATURE_NON_DECLAREE',
      null,
      null,
      'UNICITE_NON_DECLAREE',
      'UNICITE_NON_DECLAREE',
      'UNICITE_NON_DECLARABLE',
      'UNICITE_NON_DECLARABLE',
      null,
      null,
      null,
    ]);
  });
});

/**
 * ART. 133, AL. 2 · « Les amortissements des immobilisations réévaluées
 * doivent être calculés et comptabilisés sur la base des valeurs réévaluées
 * mais l'augmentation corrélative de chaque annuité d'amortissements ne doit
 * pas entraîner de diminution du bénéfice comptable et du bénéfice fiscal.
 * Cette neutralité est obtenue chaque année par une réintégration dans les
 * bénéfices d'une fraction équivalente à l'augmentation corrélative de chaque
 * annuité d'amortissements. »
 *
 * Le catalogue n'avait aucune ligne pour ce redressement, et le seul endroit
 * où le logiciel parlait de réévaluation (contrôle REEVALUATION_IMMO_HORS_MODULE)
 * ne citait que le SYCEBNL et l'AUDCIF. Le comptable qui suivait l'écran
 * jusqu'au bout obtenait un résultat fiscal minoré, chaque année du plan.
 */
describe('Réintégration du supplément d’annuité des biens réévalués · art. 133', () => {
  it('le catalogue porte la ligne, avec son article', () => {
    const entree = CATALOGUE_RETRAITEMENTS.find((r) => r.code === 'REEVALUATION_SUPPLEMENT_ANNUITE');
    expect(entree).toBeDefined();
    expect(entree!.sens).toBe(SensRetraitementFiscal.REINTEGRATION);
    expect(entree!.source).toContain('art. 133');
    // Le montant est la DIFFÉRENCE entre deux plans d'amortissement · aucune
    // balance ne la porte, et le module ne la propose donc pas.
    expect(entree!.assietteHorsPortee).toBeTruthy();
  });

  it('dit que la provision spéciale reprise au 861 neutralise déjà · sinon le supplément serait neutralisé deux fois (lot 14)', () => {
    const entree = CATALOGUE_RETRAITEMENTS.find((r) => r.code === 'REEVALUATION_SUPPLEMENT_ANNUITE')!;
    expect(entree.assietteHorsPortee).toContain('154');
    expect(entree.assietteHorsPortee).toContain('861');
    expect(entree.assietteHorsPortee).toContain('deux fois');
    // Le module réévalue et garde les valeurs d'avant · le supplément se lit, et la phrase le dit.
    expect(entree.assietteHorsPortee).toContain("D × (1 − 1/k')");
  });
});

/**
 * SUIVI DES ACOMPTES PROVISIONNELS · les deux lectures fausses.
 *
 * `acomptesVerses` est une SAISIE, le compte 4492 un DÉCAISSEMENT. Ils
 * peuvent différer de plusieurs millions sans qu'aucune balance ne cesse de
 * boucler : le solde à payer est faux de l'écart, la déclaration part avec, et
 * l'art. 98 bis LPF punit l'insuffisance d'« une amende égale à 50 % du
 * montant de l'acompte non versé ».
 *
 * Et un solde négatif se lit comme de l'argent qui revient. L'art. 57 ter dit
 * autre chose : c'est un CRÉDIT au compte courant fiscal, imputable sur
 * d'autres impôts « à sa demande ». Le porter au budget de trésorerie comme un
 * encaissement attendu est une erreur que ce champ empêche.
 */
describe('Suivi des acomptes provisionnels · la saisie contre le compte 4492', () => {
  const base = { acomptesDus: true, declares: 0, comptabilises: 0, impotDu: 0 };

  it('ne sert rien à qui ne doit pas d’acomptes · une petite entreprise paie en deux quotités', () => {
    expect(FiscaliteService.suiviAcomptes({ ...base, acomptesDus: false, declares: 500, comptabilises: 0 })).toBeNull();
  });

  it('signale l’écart entre le montant déclaré et le solde du 4492, et cite l’art. 98 bis', () => {
    const s = FiscaliteService.suiviAcomptes({ ...base, declares: 3000000, comptabilises: 1000000, impotDu: 5000000 })!;
    expect(s.ecart).toBe(2000000);
    expect(s.observations.join(' ')).toContain('98 bis');
    expect(s.observations.join(' ')).toContain('50 %');
  });

  it('ne signale aucun écart quand la saisie et le compte disent la même chose', () => {
    const s = FiscaliteService.suiviAcomptes({ ...base, declares: 1000000, comptabilises: 1000000, impotDu: 5000000 })!;
    expect(s.ecart).toBe(0);
    expect(s.observations.some((o) => o.includes('98 bis'))).toBe(false);
  });

  it('un excédent d’acomptes n’est PAS un remboursement · art. 57 ter, crédit au compte courant fiscal', () => {
    const s = FiscaliteService.suiviAcomptes({ ...base, declares: 8000000, comptabilises: 8000000, impotDu: 5000000 })!;
    expect(s.excedent).toBe(3000000);
    const texte = s.observations.join(' ');
    expect(texte).toContain('57 ter');
    expect(texte).toContain("N'EST PAS UN REMBOURSEMENT");
    expect(texte.toLowerCase()).toContain('à sa demande');
  });

  it('aucun excédent tant que l’impôt dépasse les acomptes', () => {
    const s = FiscaliteService.suiviAcomptes({ ...base, declares: 1000000, comptabilises: 1000000, impotDu: 5000000 })!;
    expect(s.excedent).toBeNull();
  });

  it('rappelle que le 4492 se solde à la liquidation · sinon l’avance est comptée deux fois', () => {
    const s = FiscaliteService.suiviAcomptes({ ...base, declares: 1000000, comptabilises: 1000000, impotDu: 5000000 })!;
    expect(s.observations.join(' ')).toContain('57 bis, al. 3');
  });

  it('ne dit rien sur la liquidation quand aucun acompte n’a été versé', () => {
    const s = FiscaliteService.suiviAcomptes({ ...base, declares: 0, comptabilises: 0, impotDu: 5000000 })!;
    expect(s.observations).toEqual([]);
  });

  it('n’affirme jamais qu’un acompte est « non versé » · établir l’insuffisance appartient à l’Administration', () => {
    // Le module rapproche deux chiffres du dossier et nomme l'exposition. Il
    // ne connaît pas la base légale de l'acompte (impôt déclaré de l'exercice
    // précédent, ou impôt reconstitué d'office) et ne peut donc pas conclure.
    const s = FiscaliteService.suiviAcomptes({ ...base, declares: 3000000, comptabilises: 1000000, impotDu: 5000000 })!;
    const texte = s.observations.join(' ');
    expect(texte).not.toMatch(/amende (due|à payer|de \d)/i);
    expect(texte).toContain('diffèrent de');
  });
});

/**
 * LE PRÉFIXE DU 4492, ET POURQUOI IL N'EST PAS '449'.
 *
 * Le compte 449 « État, créances et dettes diverses » loge sept choses
 * différentes (AUDCIF Titre VII) : 4491 obligations cautionnées, 4492 avances
 * et acomptes versés sur impôts, 4493 fonds de dotation à recevoir, 4494 à
 * 4496 subventions à recevoir, 4497 avances sur subventions. Toutes sont
 * débitrices. Prendre le préfixe '449' ferait donc passer une subvention
 * ATTENDUE pour un acompte d'impôt VERSÉ, et le solde à payer serait faux
 * d'autant, sans qu'aucun total ne bouge et sans qu'aucune balance cesse de
 * boucler. C'est la mutation qui avait survécu à la première série de tests.
 */
describe('Suivi des acomptes · le 4492 et lui seul', () => {
  it('ne compte que le 4492 · une subvention à recevoir au 4495 n’est pas un acompte versé', async () => {
    const { s } = service({
      balances: {
        N: [
          ligne('70110000', -50000000),
          ligne('60110000', 20000000),
          // Un acompte réellement versé.
          ligne('44920000', 3000000),
          // Une subvention d'exploitation à recevoir · débitrice elle aussi.
          ligne('44950000', 9000000),
          // Une obligation cautionnée.
          ligne('44910000', 4000000),
        ],
      },
      dossier: { acomptesVerses: 3000000 },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.suiviAcomptes!.comptabilises).toBe(3000000);
    // Les deux chiffres concordent : rien à signaler. Avec le préfixe '449',
    // le compte porterait 16 000 000 et le module crierait un écart de
    // 13 000 000 sur un dossier parfaitement tenu.
    expect(r.suiviAcomptes!.ecart).toBe(0);
  });

  it('agrège plusieurs sous-comptes du 4492 · un dossier peut en ouvrir un par impôt', async () => {
    const { s } = service({
      balances: {
        N: [ligne('70110000', -50000000), ligne('44921000', 1000000), ligne('44922000', 2000000)],
      },
      dossier: { acomptesVerses: 3000000 },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.suiviAcomptes!.comptabilises).toBe(3000000);
  });
});

/*
  DEUX BORNES QUE CE MODULE FRANCHISSAIT SANS LES NOMMER · passe F4a.

  Le service applique l'assiette, le catalogue, le taux, le minimum de
  perception et le report déficitaire de la loi n° 23/053 du 30 novembre 2023,
  « entrée en vigueur le 1er janvier 2026 ». Or il REMONTE jusqu'à trois
  exercices pour y recalculer un résultat fiscal avec les mêmes règles : un
  dossier ouvert en 2026 se voyait calculer un résultat 2024 et 2025 sous une
  loi qui ne régissait pas ces exercices, et ce résultat servait ensuite
  d'assiette au report imputé en 2026. Deuxième piège du dépôt, dont la
  doctrine était pourtant écrite au CLAUDE.md.

  Et l'article 7 ne retient « uniquement » que les bénéfices réalisés en RDC,
  quand le résultat fiscal part ici du résultat comptable entier.

  ON AVERTIT, ON NE BLOQUE PAS : le texte antérieur n'est pas dans le corpus
  lu, et refuser le calcul priverait le cabinet d'un chiffre sans rien lui
  offrir en échange.
*/
describe('Le périmètre de la loi est annoncé · entrée en vigueur et territoire', () => {
  // 131 · résultat net de l'exercice, seule subdivision du 13 que le service
  // lit (avec le 139) · voir le commentaire de `lireBalance`.
  const balance = [ligne('13100000', -10_000_000)];

  /*
    LA CORRECTION DE F4a AVAIT DONNÉ UNE DIRECTION UNIQUE À UNE RÈGLE QUI EN A
    DEUX, et la passe F4b l'a relevé le lendemain.

    Elle n'avait lu que l'art. 7 et écrivait donc, sans condition, « la base
    affichée est TROP LARGE · à retrancher par une déduction ». Vrai d'une
    exploitation étrangère BÉNÉFICIAIRE ; faux d'une exploitation étrangère
    DÉFICITAIRE, que l'art. 51, alinéa 3 traite en sens inverse : « les pertes
    subies dans les entreprises exploitées hors de la République Démocratique
    du Congo ne sont pas déductibles du bénéfice imposable des entreprises
    exploitées en République Démocratique du Congo ». La perte étrangère est
    déjà dans le résultat comptable, la base est TROP ÉTROITE, et il faut la
    RÉINTÉGRER. Un comptable qui suivait l'avertissement à la lettre creusait
    l'écart au lieu de le combler.
  */
  it('la territorialité est annoncée sur TOUT exercice, DANS LES DEUX SENS', async () => {
    const { s } = service({ balances: { N: balance } });
    const r = await s.resultatFiscal('t1', 'N');
    const texte = r.observations.join(' | ');
    expect(texte).toContain('PÉRIMÈTRE TERRITORIAL NON DÉCOUPÉ (art. 7 et art. 51, alinéa 3)');
    expect(texte).toContain('uniquement');
    // Bénéficiaire · art. 7, on retranche. Déficitaire · art. 51 al. 3, on
    // réintègre. Les deux directions servies ensemble, sans quoi la moitié des
    // cas reçoit la mauvaise consigne.
    expect(texte).toContain('TROP LARGE');
    expect(texte).toContain('TROP ÉTROITE');
    expect(texte).toContain('RÉINTÉGRER');
    expect(texte).toContain('sens inverse');
  });

  it('un exercice de 2026 ne porte PAS l’avertissement d’entrée en vigueur', async () => {
    const { s } = service({ balances: { N: balance } });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.observations.join(' | ')).not.toContain("ANTÉRIEUR À L'ENTRÉE EN VIGUEUR");
  });

  it('un exercice ouvert AVANT le 1er janvier 2026 est annoncé comme une SIMULATION', async () => {
    const { s } = service({
      balances: { A: balance },
      exercices: [{ id: 'A', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }],
    });
    const r = await s.resultatFiscal('t1', 'A');
    const texte = r.observations.join(' | ');
    expect(texte).toContain("EXERCICE ANTÉRIEUR À L'ENTRÉE EN VIGUEUR DE LA LOI");
    expect(texte).toContain('2025-01-01');
    expect(texte).toContain('SIMULATION');
    // La conséquence la plus coûteuse est nommée · ce chiffre ne doit pas
    // servir d'assiette à un report déficitaire.
    expect(texte).toContain('report déficitaire');
  });

  it('le chiffre reste CALCULÉ · on avertit, on ne bloque pas', async () => {
    const { s } = service({
      balances: { A: balance },
      exercices: [{ id: 'A', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }],
    });
    const r = await s.resultatFiscal('t1', 'A');
    // Le calcul va jusqu'au bout · le résultat comptable est lu, le résultat
    // fiscal en découle, et seule la MENTION dit que ce chiffre est une
    // simulation. Refuser de calculer priverait le cabinet sans rien offrir.
    expect(r.resultatComptable).toBe(10_000_000);
    expect(r.observations.length).toBeGreaterThan(0);
  });
});


/*
  ARTICLE 51, ALINÉA 1er · LA FENÊTRE SE COMPTE EN EXERCICES, PAS EN LIGNES.

  « Il est procédé à un report déficitaire sur les exercices suivants JUSQU'AU
  TROISIÈME EXERCICE QUI SUIT l'exercice déficitaire. » C'est une borne de
  DATE. La requête ne portait qu'un `take: 3`, c'est-à-dire trois
  ENREGISTREMENTS, et rien n'oblige les exercices d'un dossier à être jointifs :
  un dossier repris d'un confrère ne contient que ce qu'on a saisi.

  ARTICLE 57 · TROIS CAS, ET NON DEUX. La comparaison `minimum > theorique` est
  stricte : l'ÉGALITÉ tombait dans la branche qui affirme que le 30 % est
  « supérieur » au minimum. Le cas n'a rien d'exotique · il est atteint par
  toute société déficitaire dont le chiffre d'affaires est nul, le chiffre
  d'affaires ne lisant que les comptes 701 à 707.
*/
describe('Report déficitaire et impôt minimum · deux bornes rendues exactes', () => {
  it('un déficit hors fenêtre de trois exercices n’est plus imputé', async () => {
    // 2020 déficitaire, puis un TROU, puis 2026. Le droit du déficit de 2020
    // s'est éteint au 31 décembre 2023 : trois lignes en base, mais six ans.
    const { s } = service({
      balances: {
        A2020: [ligne('13100000', 5_000_000)],
        A2021: [ligne('13100000', 0)],
        N: [ligne('13100000', -20_000_000)],
      },
      exercices: [
        { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
        { id: 'A2021', dateDebut: new Date(Date.UTC(2021, 0, 1)), dateFin: new Date(Date.UTC(2021, 11, 31)) },
        { id: 'A2020', dateDebut: new Date(Date.UTC(2020, 0, 1)), dateFin: new Date(Date.UTC(2020, 11, 31)) },
      ],
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.deficitAnterieur.montant).toBe(0);
    expect(r.resultatFiscal).toBe(20_000_000);
  });

  it('un déficit DANS la fenêtre reste imputé', async () => {
    const { s } = service({
      balances: {
        A2025: [ligne('13100000', 5_000_000)],
        N: [ligne('13100000', -20_000_000)],
      },
      exercices: [
        { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
        { id: 'A2025', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) },
      ],
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.deficitAnterieur.montant).toBe(5_000_000);
    expect(r.resultatFiscal).toBe(15_000_000);
  });

  it('une société DÉFICITAIRE sans chiffre d’affaires n’est plus dite imposée au taux de 30 %', async () => {
    // Produits en 77 seulement · le chiffre d'affaires ne lit que 701 à 707,
    // donc les deux impôts valent zéro et ils sont ÉGAUX.
    const { s } = service({
      balances: { N: [ligne('77100000', -1_000_000), ligne('62100000', 3_000_000)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.chiffreAffaires).toBe(0);
    expect(r.impotDu).toBe(0);
    expect(r.explication).toContain('RÉSULTAT DÉFICITAIRE');
    expect(r.explication).toContain('article 57');
    expect(r.explication).not.toContain('supérieur à l’impôt minimum');
    // Et la réserve sur l'assiette est dite · le chiffre DÉCLARÉ à
    // l'administration peut ne pas être celui-là.
    expect(r.explication).toContain('701 à 707');
  });
});

/**
 * ART. 110, ALINÉA 2 · LA CONSIGNATION DU DIXIÈME N'EST PAS UN ACOMPTE.
 *
 * Passe F10. Le rapprochement du 4492 renvoyait INCONDITIONNELLEMENT à
 * l'amende de l'art. 98 bis pour insuffisance d'acompte, y compris quand le
 * compte porte PLUS que ce qui est déclaré · c'est-à-dire dans le sens où rien
 * ne manque.
 */
describe('Rapprochement du 4492 · les deux sens de l’écart (art. 110, al. 2)', () => {
  const suivi = (declares: number, comptabilises: number) =>
    FiscaliteService.suiviAcomptes({ acomptesDus: true, declares, comptabilises, impotDu: null });

  it("LE COMPTE PORTE MOINS · l'amende de l'art. 98 bis est nommée, c'est le sens où elle vaut", () => {
    const o = suivi(3_000_000, 1_000_000)!.observations.join(' ');
    expect(o).toContain('art. 98 bis');
    expect(o).toContain('MOINS QUE CE QUI EST DÉCLARÉ');
    // Dans ce sens, la consignation n'a rien à faire là.
    expect(o).not.toContain('art. 110');
  });

  it("LE COMPTE PORTE PLUS · l'amende n'est PAS nommée, et c'est la correction de la passe", () => {
    const o = suivi(1_000_000, 3_000_000)!.observations.join(' ');
    expect(o).toContain('PLUS QUE CE QUI EST DÉCLARÉ');
    expect(o).toContain("n'est PAS une insuffisance de versement");
    // ON EXIGE LA RÉSERVE EXACTE, ON NE BANNIT JAMAIS UN NUMÉRO. La première
    // version de ce test posait `not.toContain('art. 98 bis')` et tombait sur
    // un message JUSTE · celui qui nomme l'article POUR DIRE qu'il ne
    // s'applique pas, ce qui est précisément ce qu'un cabinet a besoin de
    // lire. Quatrième occurrence de ce piège après les « art. 25 » et
    // « art. 63 » de `hors-scope-tva.spec.ts` (passes F2a et F2b), et la
    // première commise en écrivant le test d'une correction.
    expect(o).toContain("l'amende de l'art. 98 bis ne s'y applique pas");
  });

  it('LE COMPTE PORTE PLUS · la consignation du dixième est nommée avec son article et sa limite', () => {
    const o = suivi(1_000_000, 3_000_000)!.observations.join(' ');
    expect(o).toContain('art. 110, alinéa 2');
    expect(o).toContain('DIXIÈME');
    // La limite de l'alinéa 3 fait partie de la règle : le sursis ne joue pas
    // sur une taxation d'office, et taire la limite ferait croire l'inverse.
    expect(o).toContain("taxation d'office");
    // Le module NOMME une cause possible, il ne qualifie pas : OmegaX ne
    // détient aucune réclamation.
    expect(o).toContain('appartient au cabinet');
  });

  it("un écart nul ne produit aucune des deux phrases", () => {
    expect(suivi(2_000_000, 2_000_000)!.observations.join(' ')).not.toContain('diffèrent de');
  });
});

/**
 * PASSE F6 · LA NOTE DE RECHERCHE DIT-ELLE CE QUE LE CODE FAIT ?
 *
 * `docs/fiscalite-asbl-rdc.md` est la matière fiscale de référence du cabinet.
 * Elle énonçait l'arrondi de l'art. 150 EN UN SEUL TEMPS, « à la centaine de
 * FC la plus proche », et supprimait l'alinéa 1, celui de la décimale. Le code
 * le fait en deux temps, et les deux règles ne donnent pas le même montant :
 * sur 1 234 549,5 FC, la règle raccourcie descend à 1 234 500 et le texte
 * monte à 1 234 600.
 *
 * Une note qui contredit le code est pire qu'une note absente : le
 * collaborateur qui recalcule à la main conclut à une divergence du logiciel
 * et « corrige » vers le montant qui ne se déclare pas.
 */
describe('Passe F6 · la note de recherche énonce l’arrondi de l’art. 150 en deux temps', () => {
  const note = readFileSync(join(__dirname, '../../../docs/fiscalite-asbl-rdc.md'), 'utf8');

  it('porte l’alinéa 1, la décimale, avant la tranche', () => {
    expect(note).toContain('en DEUX temps');
    expect(note).toContain('première décimale est\nsupérieure ou égale à 5');
    expect(note).toContain('alinéas 2 et 3');
  });

  it('donne le cas chiffré qui sépare les deux lectures, et il est celui du test du code', () => {
    expect(note).toContain('1 234 549,5');
    expect(note).toContain('1 234 600');
    // La valeur que la note annonce est bien celle que la fonction sert · la
    // note et le code ne peuvent plus diverger sans qu'un test tombe.
    expect(arrondirImpotArt150(1_234_549.5)).toBe(1_234_600);
  });
});

/*
  PASSE F13 · les acomptes de 2026 ont pour base l'impôt DÉCLARÉ pour 2025.

  Art. 57 bis LPF, tel que modifié par la L.F. n° 25/060 : les acomptes « sont
  calculés sur base de l'impôt déclaré au titre de l'exercice précédent ». Sur
  un exercice ouvert avant le 1er janvier 2026, l'impôt liquidé ici est une
  SIMULATION sous la loi n° 23/053 · le service le disait, puis présentait ce
  même chiffre comme « la première branche » de la base légale des acomptes,
  dans la même réponse. C'est le cas ordinaire de septembre 2026.
*/
describe('Passe F13 · la simulation d’avant 2026 ne fonde pas les acomptes', () => {
  const balance = [ligne('13100000', -10_000_000)];
  const exercice2025 = [{ id: 'A', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }];

  it('l’avertissement de simulation interdit aussi d’y asseoir les acomptes', async () => {
    const { s } = service({ balances: { A: balance }, exercices: exercice2025 });
    const texte = (await s.resultatFiscal('t1', 'A')).observations.join(' | ');
    expect(texte).toContain('BASE AUX ACOMPTES PROVISIONNELS');
    expect(texte).toContain("l'impôt déclaré au titre de l'exercice précédent");
  });

  it('sur 2025, la base servie est dite NON légale ; sur 2026, elle reste la première branche', async () => {
    const a = service({ balances: { A: balance }, exercices: exercice2025 });
    const t2025 = (await a.s.resultatFiscal('t1', 'A')).observations.join(' | ');
    const b = service({ balances: { N: balance } });
    const t2026 = (await b.s.resultatFiscal('t1', 'N')).observations.join(' | ');
    // Les deux exercices servent l'observation des acomptes · sans quoi le
    // test ne prouverait rien.
    expect(t2025).toContain('Art. 57 bis, al. 1er : la base des acomptes');
    expect(t2026).toContain('Art. 57 bis, al. 1er : la base des acomptes');
    expect(t2025).toContain("N'EST PAS la base légale");
    expect(t2025).not.toContain('La base servie ci-dessous est la première branche');
    expect(t2026).toContain('La base servie ci-dessous est la première branche');
  });
});

/**
 * LE LIVRE-JOURNAL SEUL, ET SANS L'ÉCRITURE DE CLÔTURE · audit du serveur du
 * 2026-09-27, F6.
 *
 * La balance lue brouillard compris faisait entrer dans l'impôt une écriture
 * provisoire, et l'écriture de clôture (au brouillard, par construction) y
 * soldait la classe 7 de tout exercice clos : son chiffre d'affaires valait
 * zéro, et l'historique de l'art. 113 n'était fait que de zéros.
 */
describe('Lecture du livre-journal · brouillard et écriture de clôture (F6)', () => {
  const ex = (id: string, annee: number) => ({
    id,
    dateDebut: new Date(Date.UTC(annee, 0, 1)),
    dateFin: new Date(Date.UTC(annee, 11, 31)),
  });

  it('un exercice clos rend son chiffre d’affaires du livre-journal, écriture de clôture comprise', async () => {
    const { s } = service({
      balances: { N: [ligne('70110000', -1000), ligne('60110000', 400)] },
      // L'écriture de clôture solde 70 et 60 sur le 13.
      clotures: { N: [ligne('70110000', 1000), ligne('60110000', -400), ligne('13100000', -600)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(['chiffreAffaires', r.chiffreAffaires]).toEqual(['chiffreAffaires', 1000]);
    expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 600]);
  });

  it('un exercice clos lit son résultat dans les classes 6 à 8 AVANT leur solde, pas dans un 13 qui porte encore N-1 (régression de F4)', async () => {
    // Le bénéfice de N-1 (5 000) est reporté au 131 et pas encore affecté.
    // Le solde de clôture de N, validé, vire 600 au 131 · lu au 13, le
    // résultat de N valait 5 600 et l'impôt portait sur deux bénéfices.
    const { s } = service({
      balances: { N: [ligne('13100000', -5_000), ligne('70110000', -1000), ligne('60110000', 400)] },
      clotures: { N: [ligne('70110000', 1000), ligne('60110000', -400), ligne('13100000', -600)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(['sourceResultat', r.sourceResultat]).toEqual(['sourceResultat', 'CLASSES_6_7_8']);
    expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 600]);
  });

  it('une écriture au brouillard ne change pas l’impôt', async () => {
    const lignesN = [ligne('70110000', -1_000_000), ligne('60110000', 200_000)];
    const sans = await service({ balances: { N: lignesN } }).s.resultatFiscal('t1', 'N');
    const avec = await service({
      balances: { N: lignesN },
      brouillards: { N: [ligne('70110000', -5_000_000)] },
    }).s.resultatFiscal('t1', 'N');
    expect(['impotDu', avec.impotDu]).toEqual(['impotDu', sans.impotDu]);
    expect(['chiffreAffaires', avec.chiffreAffaires]).toEqual(['chiffreAffaires', 1_000_000]);
  });

  it('l’historique de l’art. 113 lit les chiffres d’affaires RÉELS des exercices clos', async () => {
    // 400 000 000 en 2025, exercice clos dont la clôture solde la classe 7 ;
    // 100 000 000 en 2026. Un seul exercice sous le seuil · le régime réel
    // est maintenu. Lu à zéro, 2025 ferait descendre le dossier sur une
    // activité fictive.
    const { s } = service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      exercices: [ex('N-1', 2025), ex('N', 2026)],
      balances: { 'N-1': [ligne('70110000', -400_000_000)], N: [ligne('70110000', -100_000_000)] },
      clotures: { 'N-1': [ligne('70110000', 400_000_000), ligne('13100000', -400_000_000)] },
      dossier: { natureActivite: 'VENTE' },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(['regime', r.regime]).toEqual(['regime', 'IRPP_REGIME_REEL']);
  });
});

/**
 * PASSES F11 ET O1a · deux observations du module fiscal qui en disaient plus
 * que leurs textes, ou moins.
 */
describe('Passes F11 et O1a · le 4492 et la succursale', () => {
  it('F11-B7 · un 4492 qui porte PLUS nomme aussi la retenue sur loyers subie, imputée sur l’IRL', () => {
    const o = FiscaliteService.suiviAcomptes({
      acomptesDus: true,
      declares: 1_000_000,
      comptabilises: 3_000_000,
      impotDu: null,
    })!.observations.join(' ');
    expect(o).toContain('TROIS CAUSES À EXAMINER');
    expect(o).toContain('la loi n° 83/004, art. 11, appelle chacune « acompte »');
  });

  it('O1a-B1 · une succursale ne se lit plus comme l’établissement d’une société non-résidente', async () => {
    const { s } = service({ forme: FormeJuridiqueSyscohada.SUCCURSALE, balances: { N: [] } });
    const r = await s.resultatFiscal('t1', 'N');
    const o = r.observations.join(' ');
    expect(o).toContain('SI ce propriétaire est une société non-résidente');
    expect(o).toContain('(AUSCGIE, art. 116)');
  });
});

describe('Ligne A11 · le 899 lu à part de l’impôt constaté', () => {
  it('899 crédité, le module reste passable · aucune réintégration exigée, le dégrèvement nommé', async () => {
    const { s } = service({
      balances: {
        N: [ligne('70110000', -10_000_000), ligne('60110000', 2_000_000), ligne('89910000', -500_000)],
      },
    });
    const r = await s.resultatFiscal('t1', 'N');
    // Seuls les DÉBITS des 891, 892 et 895 sont l'impôt constaté · le crédit du
    // 899 n'y entre pas, sans quoi aucune réintégration (toujours positive) ne
    // l'égalait et le constat restait refusé pour toujours.
    expect(r.impotConstateAu89).toBe(0);
    expect(r.degrevementsAu899).toBe(500_000);
    const o = r.observations.join(' ');
    expect(o).toMatch(/DÉGRÈVEMENT AU 899/);
    expect(o).not.toMatch(/IMPÔT NON RÉINTÉGRÉ/);
    expect(
      motifsRefusConstat({
        formeJuridique: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        regime: r.regime,
        impotDu: r.impotDu,
        minimumApplique: r.minimumApplique,
        simulationAvantLaLoi: false,
        exerciceClos: false,
        brouillardGestion: 0,
        impotDejaConstate: r.impotExerciceAu89,
        impotConstateAu89: r.impotConstateAu89,
        reintegrationsImpot: r.reintegrationsImpot,
        attestationRegime: null,
      }),
    ).toEqual([]);
  });

  it('un 892 débité sans sa réintégration reste signalé · le rappel est de l’impôt constaté', async () => {
    const { s } = service({
      balances: { N: [ligne('70110000', -10_000_000), ligne('60110000', 2_000_000), ligne('89200000', 300_000)] },
    });
    const r = await s.resultatFiscal('t1', 'N');
    expect(r.impotConstateAu89).toBe(300_000);
    expect(r.observations.join(' ')).toMatch(/IMPÔT NON RÉINTÉGRÉ/);
  });
});

/**
 * CAS CHIFFRÉS DE L'IS (`docs/cas-chiffres/is.md`, 2026-10-04) · chaque écart
 * relevé au rejeu sur vraie base, gelé avec le montant calculé à la main.
 */
describe('Cas chiffrés IS · C05, report rejoué dans l’ordre (art. 51)', () => {
  const ex = (id: string, annee: number) => ({
    id,
    dateDebut: new Date(Date.UTC(annee, 0, 1)),
    dateFin: new Date(Date.UTC(annee, 11, 31)),
  });
  const exercices = [ex('A2026', 2026), ex('A2027', 2027), ex('A2028', 2028), ex('A2029', 2029), ex('A2030', 2030)];
  const balances = {
    A2026: [ligne('70110000', -10_000_000), ligne('60410000', 10_100_000)], // perte 100 000
    A2027: [ligne('70110000', -10_000_000), ligne('60410000', 10_500_000)], // perte 500 000
    A2028: [ligne('70110000', -10_000_000), ligne('60410000', 9_940_000)], // bénéfice 60 000
    A2029: [ligne('70110000', -10_000_000), ligne('60410000', 9_970_000)], // bénéfice 30 000
    A2030: [ligne('70110000', -10_000_000), ligne('60410000', 9_000_000)], // bénéfice 1 000 000
  };

  it('2030 · déficit imputé 500 000, impôt 150 000 (OmegaX rendait 410 000 et 177 000)', async () => {
    const r = await service({ exercices, balances }).s.resultatFiscal('t1', 'A2030');
    expect(['deficitImpute', r.deficitImpute]).toEqual(['deficitImpute', 500_000]);
    expect(['impotDu', r.impotDu]).toEqual(['impotDu', 150_000]);
    expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([45_000, 45_000, 30_000]);
  });

  it('le même bénéfice ne se réimpute pas · vu de 2029, 540 000 restent, dont 40 000 de 2026', async () => {
    const r = await service({ exercices, balances }).s.resultatFiscal('t1', 'A2029');
    expect(r.deficitAnterieur.montant).toBe(540_000);
    expect(r.deficitAnterieur.detail.map((d) => d.montant)).toEqual([40_000, 500_000]);
    expect(r.impotDu).toBe(100_000);
  });
});

describe('Cas chiffrés IS · C09 et C10, premier exercice long (art. 12, al. 3)', () => {
  const premier = (debut: [number, number, number], fin: [number, number, number]) => [
    { id: 'P', dateDebut: new Date(Date.UTC(...debut)), dateFin: new Date(Date.UTC(...fin)) },
  ];

  it('C09 · période de création 300 000 (minimum), premier exercice clos 1 500 000, acomptes 2027 de 90 000, 90 000, 60 000', async () => {
    const r = await service({
      exercices: premier([2026, 8, 1], [2027, 11, 31]),
      balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] },
      balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation).not.toBeNull();
    expect(r.periodeCreation!.resultatFiscal).toBe(100_000);
    expect(r.periodeCreation!.impotDu).toBe(300_000);
    expect(r.periodeCreation!.minimumApplique).toBe(true);
    expect(r.periodeCreation!.acomptesExercice.map((a) => [a.montant, a.annee])).toEqual([
      [90_000, 2027],
      [90_000, 2027],
      [60_000, 2027],
    ]);
    expect(['resultatFiscal', r.resultatFiscal]).toEqual(['resultatFiscal', 5_000_000]);
    expect(['impotDu', r.impotDu]).toEqual(['impotDu', 1_500_000]);
    expect(['impotTotalExercice', r.impotTotalExercice]).toEqual(['impotTotalExercice', 1_800_000]);
    // DÉCISION PAR LA LOI DU 2026-10-07, POINT 2 · le minimum du premier
    // exercice clos se calcule SANS le chiffre d'affaires de la période
    // (70 000 000 - 30 000 000 = 40 000 000, minimum 400 000 et non 700 000) ·
    // l'impôt dû reste au taux.
    expect(r.chiffreAffaires).toBe(70_000_000);
    expect(['chiffreAffairesMinimum', r.chiffreAffairesMinimum]).toEqual(['chiffreAffairesMinimum', 40_000_000]);
    expect(['impotMinimum', r.impotMinimum]).toEqual(['impotMinimum', 400_000]);
    expect(r.minimumApplique).toBe(false);
    expect(r.observations.join(' ')).toMatch(
      /Ici · 70\s000\s000,00 pour l'exercice, 30\s000\s000,00 pour la période, 40\s000\s000,00 retenus pour le minimum du premier exercice clos\./u,
    );
    expect(r.observations.join(' ')).not.toContain('à faire confirmer');
    expect(r.simulationAvantLaLoi).toBe(false);
    // « AUCUN acompte n'est dû » était faux · l'impôt de la période EST la base.
    expect(r.observations.join(' ')).not.toContain("AUCUN acompte n'est dû");
    expect(r.observations.join(' ')).toContain('Art. 12, al. 3 et art. 57 bis LPF');
  });

  it('C09 · un bénéfice fiscal DÉCLARÉ pour la période prime sur la lecture du livre-journal', async () => {
    const r = await service({
      exercices: premier([2026, 8, 1], [2027, 11, 31]),
      balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] },
      balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
      dossier: { resultatPeriodeCreationSaisi: 1_100_000 },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation!.source).toBe('DECLARE');
    expect(r.periodeCreation!.impotDu).toBe(330_000);
    expect(r.resultatFiscal).toBe(4_000_000);
    // Bénéfice déclaré sans son chiffre d'affaires · la lecture est DITE (mineur C09).
    expect(r.periodeCreation!.sourceChiffreAffaires).toBe('LIVRE_JOURNAL');
    expect(r.observations.join(' ')).toContain(
      "lu au livre-journal au 31 décembre de l'année de création · le bénéfice de la période est déclaré, son chiffre d'affaires ne l'est pas",
    );
  });

  it('mineur C09 · le chiffre d’affaires DÉCLARÉ avec le bénéfice assied le minimum de la période et se retranche du premier exercice clos', async () => {
    const r = await service({
      exercices: premier([2026, 8, 1], [2027, 11, 31]),
      balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] },
      balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
      dossier: { resultatPeriodeCreationSaisi: 100_000, chiffreAffairesPeriodeCreationSaisi: 25_000_000 },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation!.sourceChiffreAffaires).toBe('DECLARE');
    expect(r.periodeCreation!.chiffreAffaires).toBe(25_000_000);
    expect(r.periodeCreation!.chiffreAffairesLu).toBe(30_000_000);
    // Minimum de la période · 1 % de 25 000 000 = 250 000 ; premier exercice clos · 70 000 000 - 25 000 000.
    expect(r.periodeCreation!.impotMinimum).toBe(250_000);
    expect(r.chiffreAffairesMinimum).toBe(45_000_000);
    expect(r.observations.join(' ')).toContain("celui que le cabinet DÉCLARE pour la période");
  });

  it('mineur C09 · un chiffre d’affaires sans bénéfice déclaré est refusé ; le bénéfice retiré emporte le chiffre d’affaires', async () => {
    const { s } = service({ exercices: premier([2026, 8, 1], [2027, 11, 31]), balances: { P: [] }, dossier: {} });
    await expect(s.modifierDossier('t1', 'P', { chiffreAffairesPeriodeCreationSaisi: 25_000_000 })).rejects.toThrow(
      "se déclare avec son bénéfice fiscal",
    );
    const t = service({ exercices: premier([2026, 8, 1], [2027, 11, 31]), balances: { P: [] }, dossier: {} });
    await t.s.modifierDossier('t1', 'P', { resultatPeriodeCreationSaisi: null });
    expect(t.crees[0]).toEqual(expect.objectContaining({ resultatPeriodeCreationSaisi: null, chiffreAffairesPeriodeCreationSaisi: null }));
  });

  it('une perte de la période de création ne vient pas en déduction (« ces bénéfices »), et la règle se dit avec ses articles', async () => {
    const r = await service({
      exercices: premier([2026, 8, 1], [2027, 11, 31]),
      balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 66_000_000)] },
      balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 31_000_000)] },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation!.deduction).toBe(0);
    expect(r.resultatFiscal).toBe(4_000_000);
    // Décision par la loi du 2026-10-07, point 2 · la règle citée, plus « non visée ».
    const texte = r.observations.join(' ');
    expect(texte).toContain("PERTE DE LA PÉRIODE DE CRÉATION · elle n'est ni déduite ni reportée à part");
    expect(texte).toMatch(/art\. 12, al\. 3.*« ces bénéfices ».*art\. 51.*« les pertes constatées au cours d'un exercice ».*art\. 52, 2°/);
  });

  it('une période BÉNÉFICIAIRE ne fait pas dire la règle de la perte', async () => {
    const r = await service({
      exercices: premier([2026, 8, 1], [2027, 11, 31]),
      balances: { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] },
      balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
    }).s.resultatFiscal('t1', 'P');
    expect(r.observations.join(' ')).not.toContain('PERTE DE LA PÉRIODE DE CRÉATION');
  });

  // C09 BIS (décision par la loi du 2026-10-07, point 2) · L'ÉCART CHANGE
  // L'IMPÔT. Créée le 1er septembre 2026, close le 31 décembre 2027. Période
  // · chiffre d'affaires 80 000 000, bénéfice 500 000, impôt au taux 150 000,
  // minimum 800 000 · dû 800 000. Exercice entier · chiffre d'affaires
  // 100 000 000, bénéfice 1 000 000, période déduite 500 000, base 500 000,
  // au taux 150 000. Minimum sur 2027 seul · 1 % de 20 000 000 = 200 000, dû
  // 200 000 ; sur l'exercice entier il valait 1 000 000 (écart 800 000, le
  // minimum de la période payé deux fois). Calcul à la main dans
  // `docs/cas-chiffres/is.md`, cas C09 bis.
  it('C09 bis · minimum du premier exercice clos 200 000 sur 20 000 000 (1 000 000 avant), total 1 000 000, acomptes rejoués', async () => {
    const r = await service({
      exercices: premier([2026, 8, 1], [2027, 11, 31]),
      balances: { P: [ligne('70110000', -100_000_000), ligne('60410000', 99_000_000)] },
      balancesAu: { P: [ligne('70110000', -80_000_000), ligne('60410000', 79_500_000)] },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation!.resultatFiscal).toBe(500_000);
    expect(r.periodeCreation!.impotTheorique).toBe(150_000);
    expect(r.periodeCreation!.impotMinimum).toBe(800_000);
    expect(r.periodeCreation!.impotDu).toBe(800_000);
    expect(r.periodeCreation!.minimumApplique).toBe(true);
    expect(r.periodeCreation!.acomptesExercice.map((a) => [a.montant, a.annee])).toEqual([
      [240_000, 2027],
      [240_000, 2027],
      [160_000, 2027],
    ]);
    expect(r.resultatFiscal).toBe(500_000);
    expect(r.chiffreAffairesMinimum).toBe(20_000_000);
    expect(r.impotTheorique).toBe(150_000);
    expect(['impotMinimum', r.impotMinimum]).toEqual(['impotMinimum', 200_000]);
    expect(['impotDu', r.impotDu]).toEqual(['impotDu', 200_000]);
    expect(r.minimumApplique).toBe(true);
    expect(['impotTotalExercice', r.impotTotalExercice]).toEqual(['impotTotalExercice', 1_000_000]);
    // La base des acomptes de 2028 est l'impôt du premier exercice clos.
    expect(r.acomptesProchainExercice.map((a) => a.montant)).toEqual([60_000, 60_000, 40_000]);
  });

  it('la règle du chiffre d’affaires du minimum · retranchée, jamais négative', () => {
    expect(chiffreAffairesMinimumPremierExercice(70_000_000, 30_000_000)).toBe(40_000_000);
    expect(chiffreAffairesMinimumPremierExercice(100_000_000.55, 80_000_000.3)).toBe(20_000_000.25);
    expect(chiffreAffairesMinimumPremierExercice(10_000_000, 12_000_000)).toBe(0);
  });

  it('un premier exercice ouvert au premier semestre n’est pas le cas de l’art. 12, al. 3', async () => {
    const r = await service({
      exercices: premier([2026, 2, 1], [2026, 11, 31]),
      balances: { P: [ligne('70110000', -40_000_000), ligne('60410000', 38_000_000)] },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation).toBeNull();
    expect(r.impotDu).toBe(600_000);
  });

  it('C10 · créée en 2025 · impôt du premier exercice clos 1 500 000 sous la loi, période de 2025 non chiffrée', async () => {
    const r = await service({
      exercices: premier([2025, 8, 1], [2026, 11, 31]),
      balances: { P: [ligne('70110000', -60_000_000), ligne('60410000', 54_000_000)] },
      balancesAu: { P: [ligne('70110000', -10_000_000), ligne('60410000', 9_000_000)] },
    }).s.resultatFiscal('t1', 'P');
    expect(r.simulationAvantLaLoi).toBe(false);
    expect(r.periodeCreation!.sousLaLoi).toBe(false);
    expect(r.periodeCreation!.impotDu).toBeNull();
    expect(r.periodeCreation!.acomptesExercice).toEqual([]);
    expect(r.impotDu).toBe(1_500_000);
    // Le minimum du premier exercice clos porte sur 2026 seul (art. 153) ·
    // 1 % de 50 000 000, comme le calcul à la main.
    expect(r.chiffreAffairesMinimum).toBe(50_000_000);
    expect(r.impotMinimum).toBe(500_000);
    expect(r.impotTotalExercice).toBeNull();
    const texte = r.observations.join(' ');
    expect(texte).toContain('PREMIER EXERCICE LONG OUVERT AVANT LA LOI');
    expect(texte).not.toContain("EXERCICE ANTÉRIEUR À L'ENTRÉE EN VIGUEUR");
  });

  it('A11 · deux impositions, l’écriture se refuse en nommant les deux lignes', () => {
    const motifs = motifsRefusConstat({
      formeJuridique: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
      regime: 'IMPOT_SOCIETES',
      impotDu: 1_500_000,
      minimumApplique: false,
      simulationAvantLaLoi: false,
      exerciceClos: false,
      brouillardGestion: 0,
      impotDejaConstate: 0,
      impotConstateAu89: 0,
      reintegrationsImpot: 0,
      attestationRegime: undefined,
      periodeCreation: {
        dateFin: new Date(Date.UTC(2026, 11, 31)),
        dateFinExercice: new Date(Date.UTC(2027, 11, 31)),
        impotDu: 300_000,
        minimumApplique: true,
      },
    });
    const texte = motifs.join(' ');
    expect(texte).toContain('art. 12, al. 3');
    expect(texte).toContain('89500000');
    expect(texte).toContain('89110000');
    expect(texte).toMatch(/1\s800\s000,00 au 441/u);
    // Relevé 2 · chaque ligne porte sa date.
    expect(texte).toContain('au 2026-12-31 (période de création)');
    expect(texte).toContain('au 2027-12-31 (premier exercice clos)');
  });

  it('le report rejoue la BASE du premier exercice long, période de création déduite', async () => {
    // Période de création 2026 : bénéfice 2 000 000, imposé à part. Exercice
    // 2026-2027 entier : perte 1 000 000 · le premier exercice clos perd donc
    // 3 000 000, que 2028 impute.
    const r = await service({
      exercices: [
        { id: 'P', dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) },
        { id: 'A2028', dateDebut: new Date(Date.UTC(2028, 0, 1)), dateFin: new Date(Date.UTC(2028, 11, 31)) },
      ],
      balances: { P: [ligne('60410000', 1_000_000)], A2028: [ligne('70110000', -5_000_000)] },
      balancesAu: { P: [ligne('70110000', -2_000_000)] },
    }).s.resultatFiscal('t1', 'A2028');
    expect(r.periodeCreation).toBeNull();
    expect(r.deficitAnterieur.montant).toBe(3_000_000);
  });

  it('C10 · la perte du premier exercice long ouvert en 2025 n’est pas une simulation · aucun avertissement en 2027', async () => {
    // Premier exercice du 01/09/2025 au 31/12/2026, perte 600 000 · imposé
    // pour 2026 sous la loi (art. 12, al. 3 et art. 153). Le drapeau
    // `simulation` se lisait sur l'ouverture de l'exercice (2025) · 2027
    // annonçait « déficit d'avant la loi, simulation » sur une perte de 2026.
    const r = await service({
      exercices: [
        { id: 'P', dateDebut: new Date(Date.UTC(2025, 8, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
        { id: 'A2027', dateDebut: new Date(Date.UTC(2027, 0, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) },
      ],
      balances: { P: [ligne('60410000', 600_000)], A2027: [ligne('70110000', -5_000_000)] },
      balancesAu: { P: [] },
    }).s.resultatFiscal('t1', 'A2027');
    expect(r.deficitAnterieur.montant).toBe(600_000);
    expect(r.deficitAnterieur.detail[0].simulation).toBe(false);
    expect(r.deficitImpute).toBe(600_000);
    expect(r.observations.join(' ')).not.toContain("DÉFICIT D'AVANT LA LOI");
  });
});

describe('Cas chiffrés IS · hypothèses dites (C01-bis, C02, C12a, C15)', () => {
  it('C01-bis · le brouillard est dit, chiffré, et le calcul n’est pas définitif', async () => {
    const r = await service({
      balances: { N: [ligne('70110000', -10_000_000)] },
      brouillards: { N: [ligne('60410000', 8_000_000)] },
    }).s.resultatFiscal('t1', 'N');
    expect(r.impotDu).toBe(3_000_000); // montant inchangé · livre-journal seul
    expect(r.definitif).toBe(false);
    expect(r.brouillard).toEqual({ ecritures: 1, effetSurResultat: -8_000_000, effetSurChiffreAffaires: 0 });
    expect(r.observations[0]).toContain('CHIFFRE PROVISOIRE');
  });

  it('C01-bis · sans brouillard, le calcul est dit définitif et rien n’est annoncé', async () => {
    const r = await service({ balances: { N: [ligne('70110000', -10_000_000)] } }).s.resultatFiscal('t1', 'N');
    expect(r.definitif).toBe(true);
    expect(r.observations.join(' ')).not.toContain('CHIFFRE PROVISOIRE');
  });

  it('C02 · le chiffre d’affaires lu est dit dans toutes les branches et sur les plafonds', async () => {
    const r = await service({
      balances: { N: [ligne('70110000', -100_000_000), ligne('60410000', 60_000_000)] },
    }).s.resultatFiscal('t1', 'N');
    expect(r.explication).toContain('701 à 707');
    const plafondDons = r.plafonds.find((p) => p.assiette === 'CHIFFRE_AFFAIRES');
    expect(plafondDons?.enonce).toContain('701 à 707');
  });

  it('C12a · égaux après arrondi seulement · le libellé le dit, le montant et le compte ne bougent pas', async () => {
    const r = await service({
      balances: { N: [ligne('70110000', -123_456_789), ligne('60410000', 119_341_567)] },
    }).s.resultatFiscal('t1', 'N');
    expect(r.impotDu).toBe(1_234_600);
    expect(r.minimumApplique).toBe(false);
    expect(r.explication).toContain("APRÈS l'arrondi de l'art. 150");
    expect(r.explication).toContain('compte 895');
  });

  it('C15 · un déficit d’avant 2026 imputé porte son avertissement dans la vue 2026', async () => {
    const r = await service({
      exercices: [
        { id: 'A2025', dateDebut: new Date(Date.UTC(2025, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) },
        { id: 'N', dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
      ],
      balances: {
        A2025: [ligne('70110000', -10_000_000), ligne('60410000', 12_000_000)],
        N: [ligne('70110000', -30_000_000), ligne('60410000', 25_000_000)],
      },
    }).s.resultatFiscal('t1', 'N');
    expect(r.deficitImpute).toBe(2_000_000); // montant inchangé
    expect(r.impotDu).toBe(900_000);
    expect(r.deficitAnterieur.detail[0].simulation).toBe(true);
    expect(r.observations.join(' ')).toContain("DÉFICIT D'AVANT LA LOI, RECALCULÉ");
  });
});

/**
 * SECOND TOUR DES CAS CHIFFRÉS IS (2026-10-04) · B1, B2, P1 et relevés.
 */
describe('Cas chiffrés IS, second tour · le rejeu du report', () => {
  const an = (id: string, annee: number) => ({
    id,
    dateDebut: new Date(Date.UTC(annee, 0, 1)),
    dateFin: new Date(Date.UTC(annee, 11, 31)),
  });

  it('B1 · une entreprise individuelle n’a pas de période de création · aucun déficit inventé en 2028', async () => {
    // Premier exercice du 01/09/2026 au 31/12/2027 · bénéfice 1 000 000 sur
    // 2026, perte 600 000 en 2027, soit 400 000 sur l'exercice. L'art. 12,
    // al. 3 relève de l'IS · le rejeu ne doit rien déduire, et 2028 ne voit
    // aucun déficit.
    const r = await service({
      forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
      exercices: [
        { id: 'P', dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) },
        an('A2028', 2028),
      ],
      balances: { P: [ligne('70110000', -400_000)], A2028: [ligne('70110000', -2_000_000)] },
      balancesAu: { P: [ligne('70110000', -1_000_000)] },
      dossier: { natureActivite: 'VENTE' },
    }).s.resultatFiscal('t1', 'A2028');
    expect(['deficitAnterieur', r.deficitAnterieur.montant]).toEqual(['deficitAnterieur', 0]);
  });

  // 2025 · perte recalculée 1 000 000 ; déclarée à l'ouverture de 2026 · 400 000 ;
  // 2026 · bénéfice 300 000 ; vu de 2027, le reste réel est 100 000.
  const casB2 = (dossier2026: Record<string, unknown>) =>
    service({
      exercices: [an('A2025', 2025), an('A2026', 2026), an('A2027', 2027)],
      balances: {
        A2025: [ligne('60410000', 1_000_000)],
        A2026: [ligne('70110000', -300_000)],
        A2027: [ligne('70110000', -2_000_000)],
      },
      dossiers: { A2026: dossier2026 },
    }).s.resultatFiscal('t1', 'A2027');

  it('B2 · la saisie à l’ouverture de 2026 fait foi · 2027 voit 100 000, pas 700 000', async () => {
    const r = await casB2({ deficitAnterieurSaisi: 400_000, deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 400_000 }] });
    expect(['deficitAnterieur', r.deficitAnterieur.montant]).toEqual(['deficitAnterieur', 100_000]);
    expect(r.deficitAnterieur.detail[0]).toMatchObject({ declare: true, bornePrudente: false });
    // La saisie a remplacé le recalcul · plus de simulation à signaler.
    expect(r.observations.join(' ')).not.toContain("DÉFICIT D'AVANT LA LOI");
  });

  it('B2 · sans origine dite, la saisie est bornée par prudence et le reste perdu est NOMMÉ', async () => {
    const r = await casB2({ deficitAnterieurSaisi: 400_000 });
    expect(r.deficitAnterieur.montant).toBe(0);
    expect(r.observations.join(' ')).toContain('REPORT PERDU PAR PRUDENCE');
  });

  it('P1 · dossier repris en 2026 avec 800 000 déclarés, 300 000 de bénéfice · 500 000 restent en 2027', async () => {
    const r = await service({
      exercices: [an('A2026', 2026), an('A2027', 2027)],
      balances: { A2026: [ligne('70110000', -300_000)], A2027: [ligne('70110000', -2_000_000)] },
      dossiers: {
        A2026: {
          deficitAnterieurSaisi: 800_000,
          deficitAnterieurOrigines: [
            { dateFin: '2024-12-31', montant: 300_000 },
            { dateFin: '2025-12-31', montant: 500_000 },
          ],
        },
      },
    }).s.resultatFiscal('t1', 'A2027');
    // Le bénéfice de 2026 consomme la perte de 2024, la plus ancienne · reste 500 000 de 2025.
    expect(r.deficitAnterieur.montant).toBe(500_000);
    expect(r.deficitImpute).toBe(500_000);
  });

  it('P1 · sans origine dite, le reste qui demeure imputable est dit borné par prudence', async () => {
    // Saisie à l'ouverture de 2027 elle-même · reste imputable en 2027, dit.
    const r = await service({
      exercices: [an('A2026', 2026), an('A2027', 2027), an('A2028', 2028)],
      balances: {
        A2026: [ligne('70110000', -100_000)],
        A2027: [ligne('70110000', -300_000)],
        A2028: [ligne('70110000', -2_000_000)],
      },
      dossiers: { A2027: { deficitAnterieurSaisi: 800_000 } },
    }).s.resultatFiscal('t1', 'A2028');
    expect(r.deficitAnterieur.montant).toBe(0);
    expect(r.observations.join(' ')).toMatch(/REPORT PERDU PAR PRUDENCE · 500\s000/u);
  });

  it('C15 · l’avertissement demande le reste à reporter à l’ouverture', async () => {
    const r = await service({
      exercices: [an('A2025', 2025), an('N', 2026)],
      balances: { A2025: [ligne('60410000', 2_000_000)], N: [ligne('70110000', -5_000_000)] },
    }).s.resultatFiscal('t1', 'N');
    expect(r.observations.join(' ')).toContain("le reste à reporter à l'ouverture de cet exercice");
  });

  it('(8) · des exercices non jointifs dans la fenêtre sont nommés', async () => {
    const r = await service({
      exercices: [an('A2024', 2024), an('N', 2026)],
      balances: { A2024: [ligne('60410000', 1_000)], N: [ligne('70110000', -5_000)] },
    }).s.resultatFiscal('t1', 'N');
    expect(r.observations.join(' ')).toContain('EXERCICES NON JOINTIFS');
    expect(r.observations.join(' ')).toContain('du 2025-01-01 au 2025-12-31');
  });
});

describe('Cas chiffrés IS, second tour · la période de création', () => {
  const P = [{ id: 'P', dateDebut: new Date(Date.UTC(2026, 8, 1)), dateFin: new Date(Date.UTC(2027, 11, 31)) }];
  const balances = { P: [ligne('70110000', -70_000_000), ligne('60410000', 64_900_000)] };

  it('(2) · l’impôt passé au 31/12 ne minore pas la lecture de la période (art. 45)', async () => {
    const r = await service({
      exercices: P,
      balances,
      balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000), ligne('89500000', 300_000)] },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation!.resultatComptable).toBe(100_000);
    expect(r.periodeCreation!.impotDu).toBe(300_000);
    expect(r.periodeCreation!.impotNeutralise).toBe(300_000);
  });

  it('(1) · un bénéfice déclaré qui s’écarte du livre-journal est signalé avec son écart', async () => {
    const r = await service({
      exercices: P,
      balances,
      balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
      dossier: { resultatPeriodeCreationSaisi: 1_100_000 },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation!.ecartDeclaration).toBe(1_000_000);
    expect(r.observations.join(' ')).toContain('BÉNÉFICE DÉCLARÉ DE LA PÉRIODE DE CRÉATION');
  });

  it('(5) · les suppléments sur l’impôt de la période entrent dans la base des acomptes de 2027', async () => {
    const r = await service({
      exercices: P,
      balances,
      balancesAu: { P: [ligne('70110000', -30_000_000), ligne('60410000', 29_900_000)] },
      dossier: { supplementsPeriodeCreation: 100_000 },
    }).s.resultatFiscal('t1', 'P');
    expect(r.periodeCreation!.baseAcomptesExercice).toBe(400_000);
    expect(r.periodeCreation!.acomptesExercice.map((a) => a.montant)).toEqual([120_000, 120_000, 80_000]);
  });

  it('(6) · période d’impôt nul · aucune ligne à zéro, l’écriture ordinaire passe', () => {
    const motifs = motifsRefusConstat({
      formeJuridique: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
      regime: 'IMPOT_SOCIETES',
      impotDu: 1_500_000,
      minimumApplique: false,
      simulationAvantLaLoi: false,
      exerciceClos: false,
      brouillardGestion: 0,
      impotDejaConstate: 0,
      impotConstateAu89: 0,
      reintegrationsImpot: 0,
      attestationRegime: undefined,
      periodeCreation: {
        dateFin: new Date(Date.UTC(2026, 11, 31)),
        dateFinExercice: new Date(Date.UTC(2027, 11, 31)),
        impotDu: 0,
        minimumApplique: false,
      },
    });
    expect(motifs).toEqual([]);
  });

  it('(7) · sur un exercice clos, le report déclaré et la période de création ne changent plus', async () => {
    const { s } = service({
      exercices: [{ ...P[0], statut: 'CLOTURE' }],
      balances,
    });
    await expect(s.modifierDossier('t1', 'P', { deficitAnterieurSaisi: 10 })).rejects.toThrow('exercice ouvert suivant');
    await expect(s.modifierDossier('t1', 'P', { resultatPeriodeCreationSaisi: 10 })).rejects.toThrow('clôturé');
  });

  it('(7) · l’origine d’un déficit doit totaliser la saisie', async () => {
    const { s } = service({ exercices: P, balances });
    await expect(
      s.modifierDossier('t1', 'P', { deficitAnterieurSaisi: 100, deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 90 }] }),
    ).rejects.toThrow('totalise');
  });
});

describe('Cas chiffrés IS, dernière correction · une origine hors fenêtre (art. 51)', () => {
  const an = (id: string, annee: number, statut?: string) => ({
    id,
    dateDebut: new Date(Date.UTC(annee, 0, 1)),
    dateFin: new Date(Date.UTC(annee, 11, 31)),
    statut,
  });

  it('2026, résultat 1 000 000, saisie de 500 000 d’origine 2021 · rien imputé, impôt 300 000, dit', async () => {
    const r = await service({
      exercices: [an('N', 2026)],
      balances: { N: [ligne('70110000', -1_000_000)] },
      dossier: { deficitAnterieurSaisi: 500_000, deficitAnterieurOrigines: [{ dateFin: '2021-12-31', montant: 500_000 }] } as never,
    }).s.resultatFiscal('t1', 'N');
    expect(['deficitImpute', r.deficitImpute]).toEqual(['deficitImpute', 0]);
    expect(['impotDu', r.impotDu]).toEqual(['impotDu', 300_000]);
    expect(r.deficitAnterieur.montantSaisi).toBe(500_000);
    expect(r.observations.join(' ')).toContain('PERTE DÉCLARÉE HORS FENÊTRE');
    expect(r.observations.join(' ')).toContain('2024-12-31');
  });

  it('seule la part couverte par sa fenêtre s’impute', async () => {
    const r = await service({
      exercices: [an('N', 2026)],
      balances: { N: [ligne('70110000', -1_000_000)] },
      dossier: {
        deficitAnterieurSaisi: 800_000,
        deficitAnterieurOrigines: [
          { dateFin: '2021-12-31', montant: 500_000 },
          { dateFin: '2024-12-31', montant: 300_000 },
        ],
      } as never,
    }).s.resultatFiscal('t1', 'N');
    expect(r.deficitImpute).toBe(300_000);
    expect(r.impotDu).toBe(210_000);
  });

  it('modifierDossier refuse une origine hors fenêtre en citant l’art. 51 et la date de fin', async () => {
    const { s } = service({ exercices: [an('N', 2026)], balances: { N: [] } });
    await expect(
      s.modifierDossier('t1', 'N', { deficitAnterieurSaisi: 500_000, deficitAnterieurOrigines: [{ dateFin: '2021-12-31', montant: 500_000 }] }),
    ).rejects.toThrow(/art\. 51.*2024-12-31/s);
  });

  it('le message « par prudence » renvoie à l’exercice ouvert suivant quand l’exercice de la saisie est clos', async () => {
    const r = await service({
      exercices: [an('A2027', 2027, 'CLOTURE'), an('A2028', 2028)],
      balances: { A2027: [ligne('70110000', -300_000)], A2028: [ligne('70110000', -2_000_000)] },
      dossiers: { A2027: { deficitAnterieurSaisi: 800_000 } },
    }).s.resultatFiscal('t1', 'A2028');
    const texte = r.observations.join(' ');
    expect(texte).toContain('REPORT PERDU PAR PRUDENCE');
    expect(texte).toContain("exercice OUVERT suivant");
    expect(texte).not.toContain("déclarez leur origine sur l'exercice de la saisie");
  });
});

describe('Cas chiffrés IS, troisième tour · relecture adverse', () => {
  const an = (id: string, annee: number) => ({
    id,
    dateDebut: new Date(Date.UTC(annee, 0, 1)),
    dateFin: new Date(Date.UTC(annee, 11, 31)),
  });

  /*
    V3, rejoué sur vraie base le 2026-10-07 · pertes de 2026 (100 000) et
    2027 (200 000) non affectées, reportées par la clôture sur le 139 ; 2028
    et 2029 se soldent à zéro (ventes 1 000 000, achats 1 000 000). Lus sur le
    13, ils sortaient à -300 000 chacun, et 2030 rendait 60 000 au lieu de
    240 000.
  */
  it('V3 · une gestion qui se solde à zéro lit zéro, jamais l’à-nouveau du 13', async () => {
    const r = await service({
      balances: { N: [ligne('70110000', -1_000_000), ligne('60410000', 1_000_000)] },
      reports: { N: [ligne('13900000', 300_000)] },
    }).s.resultatFiscal('t1', 'N');
    expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 0]);
    expect(r.sourceResultat).toBe('CLASSES_6_7_8');
    expect(r.observations.join(' ')).not.toContain('RÉSULTAT LU SUR LE COMPTE 13');
  });

  it('un 13 qui ne porte que l’à-nouveau ne fait pas le résultat d’un exercice sans gestion', async () => {
    const r = await service({ balances: { N: [] }, reports: { N: [ligne('13900000', 300_000)] } }).s.resultatFiscal('t1', 'N');
    expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 0]);
  });

  it('le 13 lu porte aussi l’à-nouveau · le montant reste lu sur le solde, et l’à-nouveau est dit', async () => {
    const r = await service({
      balances: { N: [ligne('13100000', -800)] },
      reports: { N: [ligne('13900000', 300_000)] },
    }).s.resultatFiscal('t1', 'N');
    expect(r.sourceResultat).toBe('COMPTE_13');
    expect(r.resultatComptable).toBe(-299_200);
    expect(r.observations.join(' ')).toContain('RÉSULTAT LU SUR LE COMPTE 13');
  });

  it('exercice sans gestion dont l’affectation solde l’à-nouveau du 13 · résultat nul, rien à dire', async () => {
    const r = await service({
      balances: { N: [ligne('13900000', -300_000)] },
      reports: { N: [ligne('13900000', 300_000)] },
    }).s.resultatFiscal('t1', 'N');
    expect(['resultatComptable', r.resultatComptable]).toEqual(['resultatComptable', 0]);
    expect(r.observations.join(' ')).not.toContain('RÉSULTAT LU SUR LE COMPTE 13');
  });

  it('V3 · 2030 n’impute que la perte de 2027 (N-3), celle de 2026 (N-4) étant éteinte · impôt 240 000', async () => {
    const zero = [ligne('70110000', -1_000_000), ligne('60410000', 1_000_000)];
    const { s } = service({
      exercices: [an('A2026', 2026), an('A2027', 2027), an('A2028', 2028), an('A2029', 2029), an('A2030', 2030)],
      balances: {
        A2026: [ligne('70110000', -1_000_000), ligne('60410000', 1_100_000)],
        A2027: [ligne('70110000', -1_000_000), ligne('60410000', 1_200_000)],
        A2028: zero,
        A2029: zero,
        A2030: [ligne('70110000', -2_000_000), ligne('60410000', 1_000_000)],
      },
      reports: {
        A2027: [ligne('13900000', 100_000)],
        A2028: [ligne('13900000', 300_000)],
        A2029: [ligne('13900000', 300_000)],
        A2030: [ligne('13900000', 300_000)],
      },
    });
    const r2029 = await s.resultatFiscal('t1', 'A2029');
    expect(['2029', r2029.resultatComptable, r2029.deficitAnterieur.montant]).toEqual(['2029', 0, 300_000]);
    const r = await s.resultatFiscal('t1', 'A2030');
    expect(['deficitAnterieur', r.deficitAnterieur.montant]).toEqual(['deficitAnterieur', 200_000]);
    expect(['deficitImpute', r.deficitImpute]).toEqual(['deficitImpute', 200_000]);
    expect(['impotDu', r.impotDu]).toEqual(['impotDu', 240_000]);
  });

  it('une saisie changée seule emporte l’origine qui ne la ventile plus', async () => {
    const origines = [
      { dateFin: '2024-12-31', montant: 500_000 },
      { dateFin: '2025-12-31', montant: 300_000 },
    ];
    const change = service({ balances: { N: [] }, dossier: { deficitAnterieurSaisi: 800_000, deficitAnterieurOrigines: origines } as never });
    await change.s.modifierDossier('t1', 'N', { deficitAnterieurSaisi: 600_000 });
    expect(change.crees[0].deficitAnterieurOrigines).toBe(Prisma.DbNull);
    const meme = service({ balances: { N: [] }, dossier: { deficitAnterieurSaisi: 800_000, deficitAnterieurOrigines: origines } as never });
    await meme.s.modifierDossier('t1', 'N', { deficitAnterieurSaisi: 800_000 });
    expect('deficitAnterieurOrigines' in meme.crees[0]).toBe(false);
  });

  it('une origine qui ne totalise plus la saisie ne fait pas foi · le rejeu retombe sur la borne prudente, et le dit', async () => {
    const { s } = service({
      exercices: [an('A2026', 2026), an('A2027', 2027)],
      balances: { A2026: [ligne('70110000', -100_000)], A2027: [ligne('70110000', -2_000_000)] },
      dossiers: {
        A2026: { deficitAnterieurSaisi: 600_000, deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: 800_000 }] },
      },
    });
    const r2026 = await s.resultatFiscal('t1', 'A2026');
    expect(r2026.deficitAnterieur.origines).toBeNull();
    const r = await s.resultatFiscal('t1', 'A2027');
    expect(['deficitImpute', r.deficitImpute]).toEqual(['deficitImpute', 0]);
    expect(['impotDu', r.impotDu]).toEqual(['impotDu', 600_000]);
    expect(r.observations.join(' ')).toContain('REPORT PERDU PAR PRUDENCE');
  });
});

describe('loi n° 23/053, art. 12 al. 4 · bilans successifs DITS, jamais totalisés (décision par la loi du 2026-10-07, point 2)', () => {
  const j = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));
  const exercices = [
    { id: 'A', dateDebut: j(2026, 1, 1), dateFin: j(2026, 6, 30) },
    { id: 'L', dateDebut: j(2026, 7, 1), dateFin: j(2026, 12, 31) },
    { id: 'C', dateDebut: j(2027, 1, 1), dateFin: j(2027, 12, 31) },
  ];
  const balances = {
    A: [ligne('70110000', -1000), ligne('60110000', 400)],
    L: [ligne('70110000', -500), ligne('60110000', 100)],
    C: [ligne('70110000', -500), ligne('60110000', 100)],
  };

  it('l’exercice arrêté hors du 31 décembre et celui qui le suit la même année le disent, chacun calculé seul', async () => {
    const { s } = service({ exercices, balances });
    const rA = await s.resultatFiscal('t1', 'A');
    expect(rA.observations).toContain(observationBilansSuccessifs(j(2026, 6, 30)));
    // Aucun impôt nouveau · le résultat est celui de l'exercice seul.
    expect(rA.resultatComptable).toBe(600);
    const rL = await s.resultatFiscal('t1', 'L');
    expect(rL.observations).toContain(observationBilansSuccessifs(j(2026, 12, 31)));
    expect(rL.resultatComptable).toBe(400);
    expect(observationBilansSuccessifs(j(2026, 6, 30))).toContain('art. 12 al. 4');
  });

  it('un exercice civil ordinaire ne dit rien', async () => {
    const { s } = service({ exercices, balances });
    const rC = await s.resultatFiscal('t1', 'C');
    expect(rC.observations.join(' ')).not.toContain('BILANS SUCCESSIFS');
  });
});
