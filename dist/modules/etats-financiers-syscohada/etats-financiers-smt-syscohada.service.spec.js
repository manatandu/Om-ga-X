"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const etats_financiers_smt_syscohada_service_1 = require("./etats-financiers-smt-syscohada.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const etats_garanties_smt_1 = require("./etats-garanties-smt");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const correspondance_smt_syscohada_1 = require("./correspondance-smt-syscohada");
const dettesRattachees = require("../etats-financiers/dettes-rattachees");
beforeEach(() => {
    jest.spyOn(dettesRattachees, 'dettesFournisseursNeesDImmobilisations').mockResolvedValue({ ouverture: 0, cloture: 0 });
});
function ligne(numero, classe, totalDebit, totalCredit, report = {}) {
    const reportDebit = report.debit ?? 0;
    const reportCredit = report.credit ?? 0;
    return {
        compteId: `id-${numero}`,
        numero,
        intitule: `Compte ${numero}`,
        classe,
        typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        totalDebit,
        totalCredit,
        reportDebit,
        reportCredit,
        mouvementDebit: totalDebit - reportDebit,
        mouvementCredit: totalCredit - reportCredit,
        solde: totalDebit - totalCredit,
    };
}
const CLASSE_PAR_CHIFFRE = {
    '1': client_1.ClasseCompte.CLASSE_1,
    '2': client_1.ClasseCompte.CLASSE_2,
    '3': client_1.ClasseCompte.CLASSE_3,
    '4': client_1.ClasseCompte.CLASSE_4,
    '5': client_1.ClasseCompte.CLASSE_5,
    '6': client_1.ClasseCompte.CLASSE_6,
    '7': client_1.ClasseCompte.CLASSE_7,
    '8': client_1.ClasseCompte.CLASSE_8,
};
function ligneTiers(numero, montant, options = {}) {
    return {
        compteId: `id-${numero}`,
        classe: CLASSE_PAR_CHIFFRE[numero[0]],
        debit: montant.debit ?? 0,
        credit: montant.credit ?? 0,
        dateEcheance: options.echeance ? new Date(options.echeance) : null,
        lettre: options.lettre ?? null,
        regleApresCloture: options.regleApresCloture ?? false,
        statut: options.statut ?? 'VALIDEE',
    };
}
function sommesDesLignesTiers(lignesTiers) {
    return jest.fn(({ by, where, _sum }) => {
        if (by.length === 1 && by[0] === 'lettrageId')
            return Promise.resolve([]);
        if (by.length !== 1 || by[0] !== 'compteId')
            throw new Error(`Regroupement inattendu : ${by.join(', ')}`);
        if (!_sum.debit || !_sum.credit)
            throw new Error('Les deux sommes, débit et crédit, sont attendues');
        const borne = where.dateEcheance;
        if (borne) {
            for (const op of Object.keys(borne)) {
                if (!['gt', 'gte', 'lt', 'lte'].includes(op))
                    throw new Error(`Borne d'échéance inattendue : ${op}`);
            }
        }
        const parCompte = new Map();
        for (const l of lignesTiers) {
            if (where.lettre === null && l.lettre !== null)
                continue;
            if (where.ecriture?.statut !== undefined && l.statut !== where.ecriture.statut)
                continue;
            if (where.OR && l.lettre !== null && !l.regleApresCloture)
                continue;
            if (where.compteId && !where.compteId.in.includes(l.compteId))
                continue;
            if (where.compte && l.classe !== where.compte.classe)
                continue;
            if (borne) {
                if (!l.dateEcheance)
                    continue;
                if (borne.gt && !(l.dateEcheance > borne.gt))
                    continue;
                if (borne.gte && !(l.dateEcheance >= borne.gte))
                    continue;
                if (borne.lt && !(l.dateEcheance < borne.lt))
                    continue;
                if (borne.lte && !(l.dateEcheance <= borne.lte))
                    continue;
            }
            const cumul = parCompte.get(l.compteId) ?? { debit: 0, credit: 0 };
            cumul.debit += Math.round(l.debit * 100);
            cumul.credit += Math.round(l.credit * 100);
            parCompte.set(l.compteId, cumul);
        }
        return Promise.resolve([...parCompte].map(([compteId, s]) => ({ compteId, _sum: { debit: s.debit / 100, credit: s.credit / 100 } })));
    });
}
function ecriture(id, date, libelle, lignes, options = {}) {
    return {
        id,
        date: new Date(date),
        createdAt: new Date(date),
        libelle,
        reference: null,
        estGenereeParCloture: options.estGenereeParCloture ?? false,
        lignes: lignes.map((l, i) => ({
            id: `${id}-${i}`,
            compteId: `id-${l.numero}`,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            compte: { numero: l.numero, intitule: `Compte ${l.numero}` },
        })),
    };
}
function service(lignesParExercice, options = {}) {
    const exercices = options.exercices ??
        Object.keys(lignesParExercice).map((id) => ({ id, dateDebut: new Date('2026-01-01T00:00:00Z') }));
    const ecritureService = {
        balance: jest.fn().mockImplementation((_t, exerciceId, _inclureBrouillard, _arreteAu, opts) => {
            const lignes = (opts?.avantLaCloture ? options.ouvertures?.[exerciceId] : undefined) ?? lignesParExercice[exerciceId] ?? [];
            return Promise.resolve({ lignes, totaux: { debit: 0, credit: 0 } });
        }),
        ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
    };
    const exerciceService = {
        lister: jest
            .fn()
            .mockResolvedValue([...exercices].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())),
    };
    const prisma = {
        ecriture: {
            findMany: jest.fn().mockImplementation(({ where, cursor, skip, take }) => {
                const prefixes = where.lignes?.some?.compte?.OR?.map((o) => o.numero.startsWith);
                const retenues = [...(options.ecritures ?? [])]
                    .filter((e) => where.estGenereeParCloture === undefined ? true : e.estGenereeParCloture === where.estGenereeParCloture)
                    .filter((e) => !prefixes || e.lignes.some((l) => prefixes.some((p) => l.compte.numero.startsWith(p))))
                    .sort((a, b) => a.id.localeCompare(b.id));
                const debut = cursor ? retenues.findIndex((e) => e.id === cursor.id) + (skip ?? 0) : 0;
                return Promise.resolve(retenues.slice(debut, take === undefined ? undefined : debut + take));
            }),
        },
        ligneEcriture: {
            groupBy: sommesDesLignesTiers(options.lignesTiers ?? []),
            findMany: jest.fn().mockImplementation(({ where }) => {
                if (!where.id?.in)
                    throw new Error('doublure : lecture de lignes non honorée');
                return Promise.resolve(where.id.in.map((id) => ({ id, lettrageId: null })));
            }),
        },
        immobilisation: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve((options.immobilisations ?? []).filter((i) => {
                if (where?.tenantId !== 't1')
                    return false;
                if (where.dateAcquisition?.lte && i.dateAcquisition > where.dateAcquisition.lte)
                    return false;
                if (where.OR) {
                    return where.OR.some((o) => o.dateSortie === null ? i.dateSortie === null : i.dateSortie !== null && i.dateSortie >= o.dateSortie.gte);
                }
                return true;
            }))),
        },
        campagneInventaire: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(options.campagne && where.tenantId === 't1' && where.exerciceId === (options.campagneExerciceId ?? 'e1') &&
                where.fiches?.some?.compte?.classe === 'CLASSE_3'
                ? options.campagne
                : null)),
        },
        tiersCompte: { findMany: jest.fn().mockResolvedValue(options.tiersComptes ?? []) },
        tenant: {
            findUniqueOrThrow: jest
                .fn()
                .mockResolvedValue({
                devise: 'devise' in options ? options.devise : 'CDF',
                systemeComptableSyscohada: 'MINIMAL_TRESORERIE',
                formeJuridiqueSyscohada: options.forme ?? null,
            }),
        },
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.tenantId === 't1' && exercices.some((e) => e.id === where.id)
                ? { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }
                : null)),
        },
    };
    return new etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService(ecritureService, exerciceService, prisma);
}
function poste(etat, ref) {
    return [...etat.actif, ...etat.passif].find((p) => p.ref === ref);
}
const BALANCE_NEGOCE = [
    ligne('10300000', client_1.ClasseCompte.CLASSE_1, 0, 1_000_000),
    ligne('24110000', client_1.ClasseCompte.CLASSE_2, 400_000, 0),
    ligne('28410000', client_1.ClasseCompte.CLASSE_2, 0, 80_000),
    ligne('31110000', client_1.ClasseCompte.CLASSE_3, 120_000, 0),
    ligne('40110000', client_1.ClasseCompte.CLASSE_4, 100_000, 150_000),
    ligne('41110000', client_1.ClasseCompte.CLASSE_4, 200_000, 0),
    ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1_050_000, 575_000),
    ligne('57110000', client_1.ClasseCompte.CLASSE_5, 500_000, 440_000),
    ligne('60110000', client_1.ClasseCompte.CLASSE_6, 450_000, 0),
    ligne('60310000', client_1.ClasseCompte.CLASSE_6, 0, 120_000),
    ligne('62210000', client_1.ClasseCompte.CLASSE_6, 60_000, 0),
    ligne('64110000', client_1.ClasseCompte.CLASSE_6, 10_000, 0),
    ligne('66110000', client_1.ClasseCompte.CLASSE_6, 90_000, 0),
    ligne('67110000', client_1.ClasseCompte.CLASSE_6, 5_000, 0),
    ligne('68130000', client_1.ClasseCompte.CLASSE_6, 80_000, 0),
    ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 700_000),
];
const ECRITURES_NEGOCE = [
    ecriture('e01', '2026-01-05', "Apport de l'exploitant", [
        { numero: '52110000', debit: 1_000_000 },
        { numero: '10300000', credit: 1_000_000 },
    ]),
    ecriture('e02', '2026-01-10', 'Achat matériel industriel', [
        { numero: '24110000', debit: 400_000 },
        { numero: '52110000', credit: 400_000 },
    ]),
    ecriture('e03', '2026-02-01', 'Achat de marchandises comptant', [
        { numero: '60110000', debit: 300_000 },
        { numero: '57110000', credit: 300_000 },
    ]),
    ecriture('e04', '2026-03-01', 'Vente comptant', [
        { numero: '57110000', debit: 500_000 },
        { numero: '70110000', credit: 500_000 },
    ]),
    ecriture('e05', '2026-03-15', 'Vente à crédit', [
        { numero: '41110000', debit: 200_000 },
        { numero: '70110000', credit: 200_000 },
    ]),
    ecriture('e06', '2026-04-01', 'Loyer du magasin', [
        { numero: '62210000', debit: 60_000 },
        { numero: '52110000', credit: 60_000 },
    ]),
    ecriture('e07', '2026-04-30', 'Salaires', [
        { numero: '66110000', debit: 90_000 },
        { numero: '57110000', credit: 90_000 },
    ]),
    ecriture('e08', '2026-05-10', 'Impôt foncier', [
        { numero: '64110000', debit: 10_000 },
        { numero: '52110000', credit: 10_000 },
    ]),
    ecriture('e09', '2026-06-01', "Intérêts d'emprunt", [
        { numero: '67110000', debit: 5_000 },
        { numero: '52110000', credit: 5_000 },
    ]),
    ecriture('e10', '2026-07-01', 'Achat de marchandises à crédit', [
        { numero: '60110000', debit: 150_000 },
        { numero: '40110000', credit: 150_000 },
    ]),
    ecriture('e11', '2026-08-01', 'Règlement partiel fournisseur', [
        { numero: '40110000', debit: 100_000 },
        { numero: '52110000', credit: 100_000 },
    ]),
    ecriture('e12', '2026-09-01', 'Virement caisse vers banque', [
        { numero: '52110000', debit: 50_000 },
        { numero: '57110000', credit: 50_000 },
    ]),
    ecriture('e13', '2026-12-31', 'Dotation aux amortissements', [
        { numero: '68130000', debit: 80_000 },
        { numero: '28410000', credit: 80_000 },
    ]),
    ecriture('e14', '2026-12-31', 'Stock final', [
        { numero: '31110000', debit: 120_000 },
        { numero: '60310000', credit: 120_000 },
    ]),
];
function negoce() {
    return service({ e2026: BALANCE_NEGOCE }, { ecritures: ECRITURES_NEGOCE });
}
describe('Bilan S.M.T SYSCOHADA', () => {
    it('boucle : SAZ = SPZ, résultat compris', async () => {
        const bilan = await negoce().bilan('t1', 'e2026');
        expect(bilan.totalActif).toBe(1_175_000);
        expect(bilan.totalPassif).toBe(1_175_000);
        expect(bilan.equilibre).toBe(true);
    });
    it('SA1 porte la classe 2 en valeur NETTE · la maquette n’a qu’une colonne de montant', async () => {
        const bilan = await negoce().bilan('t1', 'e2026');
        expect(poste(bilan, 'SA1').montant).toBe(320_000);
        expect(poste(bilan, 'SA1').note).toBe('1');
    });
    it('sépare les tiers débiteurs (SA3) des tiers créditeurs (SP4), sans compensation', async () => {
        const bilan = await negoce().bilan('t1', 'e2026');
        expect(poste(bilan, 'SA3').montant).toBe(200_000);
        expect(poste(bilan, 'SP4').montant).toBe(50_000);
    });
    it('SA4 est la caisse (57) et SA5 la banque (52 à 58) · 50 et 51 restent en SA3', async () => {
        const s = service({
            e1: [
                ligne('57110000', client_1.ClasseCompte.CLASSE_5, 60_000, 0),
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 475_000, 0),
                ligne('50110000', client_1.ClasseCompte.CLASSE_5, 30_000, 0),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'SA4').montant).toBe(60_000);
        expect(poste(bilan, 'SA5').montant).toBe(475_000);
        expect(poste(bilan, 'SA3').comptes.map((c) => c.numero)).toContain('50110000');
    });
    it('laisse un découvert bancaire à l’ACTIF en négatif · « Banque (en + ou en –) »', async () => {
        const s = service({
            e1: [
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 0, 120_000),
                ligne('60110000', client_1.ClasseCompte.CLASSE_6, 120_000, 0),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'SA5').montant).toBe(-120_000);
        expect(bilan.equilibre).toBe(true);
    });
    it('garde les dépréciations créditrices que le filtre de sens aurait mangées', async () => {
        const s = service({
            e1: [
                ligne('41110000', client_1.ClasseCompte.CLASSE_4, 200_000, 0),
                ligne('49110000', client_1.ClasseCompte.CLASSE_4, 0, 30_000),
                ligne('49910000', client_1.ClasseCompte.CLASSE_4, 0, 25_000),
                ligne('59900000', client_1.ClasseCompte.CLASSE_5, 0, 5_000),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(poste(bilan, 'SA3').montant).toBe(170_000);
        expect(poste(bilan, 'SA3').comptes.map((c) => c.numero)).toContain('49110000');
        expect(poste(bilan, 'SP4').montant).toBe(30_000);
        expect(poste(bilan, 'SP4').comptes.map((c) => c.numero)).toEqual(['49910000', '59900000']);
        expect(bilan.comptesNonRattaches).toEqual([]);
    });
    it('ne laisse AUCUN compte de bilan hors maquette avec le plan officiel', async () => {
        const bilan = await negoce().bilan('t1', 'e2026');
        expect(bilan.comptesNonRattaches).toEqual([]);
    });
    it('signale un compte de bilan hors maquette plutôt que de déséquilibrer en silence', async () => {
        const s = service({ e1: [ligne('06000000', client_1.ClasseCompte.CLASSE_1, 7_000, 0)] });
        const bilan = await s.bilan('t1', 'e1');
        expect(bilan.comptesNonRattaches.map((c) => c.numero)).toEqual(['06000000']);
    });
    it('prend le résultat dans les classes 6/7/8 avant clôture, au compte 13 après', async () => {
        const avant = await negoce().bilan('t1', 'e2026');
        expect(poste(avant, 'SP2').montant).toBe(125_000);
        expect(avant.controle.resultatClasses678).toBe(125_000);
        expect(avant.controle.resultatCompte13).toBe(0);
        const apres = service({
            e1: [
                ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 125_000, { credit: 125_000 }),
                ligne('70110000', client_1.ClasseCompte.CLASSE_7, 700_000, 700_000, { debit: 700_000 }),
            ],
        });
        const bilan = await apres.bilan('t1', 'e1');
        expect(bilan.controle.resultatClasses678).toBe(0);
        expect(poste(bilan, 'SP2').montant).toBe(125_000);
    });
    it('B1 · avant l\'affectation, SP2 additionne le résultat de N resté au 131 et celui de N+1 en cours', async () => {
        const s = service({
            e1: [
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 825_000, 0),
                ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 125_000),
                ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 700_000),
            ],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(bilan.controle).toEqual({ resultatClasses678: 700_000, resultatCompte13: 125_000, resultatAnterieurNonAffecte: 125_000 });
        expect(poste(bilan, 'SP2').montant).toBe(825_000);
        expect(bilan.equilibre).toBe(true);
    });
    it('n’invente pas de comparatif N-1 quand il n’y a pas d’exercice antérieur', async () => {
        const bilan = await negoce().bilan('t1', 'e2026');
        expect(bilan.exerciceN1Disponible).toBe(false);
        expect(poste(bilan, 'SA1').montantN1).toBeUndefined();
        expect(bilan.totalActifN1).toBeUndefined();
    });
});
function ligneCr(cr, ref) {
    return cr.lignes.find((l) => l.ref === ref);
}
describe('Compte de résultat S.M.T SYSCOHADA · comptabilité de TRÉSORERIE', () => {
    it('lit A et B dans les MOUVEMENTS de trésorerie, pas dans les soldes 6/7', async () => {
        const cr = await negoce().compteDeResultat('t1', 'e2026');
        expect(ligneCr(cr, 'SR1').montant).toBe(500_000);
        expect(cr.totalRecettes).toBe(500_000);
        expect(ligneCr(cr, 'SD1').montant).toBe(300_000);
        expect(ligneCr(cr, 'SD2').montant).toBe(60_000);
        expect(ligneCr(cr, 'SD3').montant).toBe(90_000);
        expect(ligneCr(cr, 'SD4').montant).toBe(10_000);
        expect(ligneCr(cr, 'SD5').montant).toBe(5_000);
        expect(ligneCr(cr, 'SD6').montant).toBe(100_000);
        expect(cr.totalDepenses).toBe(565_000);
        expect(cr.soldeCaisse).toBe(-65_000);
    });
    it('la dette du 401 née d’une immobilisation sort de la ligne E, comme le 481 (majeur 3 et sa suite)', async () => {
        jest.spyOn(dettesRattachees, 'dettesFournisseursNeesDImmobilisations').mockResolvedValue({ ouverture: 0, cloture: 30_000 });
        const cr = await negoce().compteDeResultat('t1', 'e2026');
        expect(ligneCr(cr, 'SV3').montant).toBe(-20_000);
        expect(ligneCr(cr, 'SG').montant).toBe(125_000 + 30_000);
    });
    it('G = C – D + E – F boucle sur le « Résultat exercice » du bilan', async () => {
        const s = negoce();
        const [cr, bilan] = await Promise.all([s.compteDeResultat('t1', 'e2026'), s.bilan('t1', 'e2026')]);
        expect(ligneCr(cr, 'SV1').montant).toBe(-120_000);
        expect(ligneCr(cr, 'SV2').montant).toBe(-200_000);
        expect(ligneCr(cr, 'SV3').montant).toBe(-50_000);
        expect(ligneCr(cr, 'SF').montant).toBe(80_000);
        expect(cr.lettres).toEqual({ D: -320_000, E: -50_000, F: 80_000 });
        expect(cr.resultatExercice).toBe(125_000);
        expect(ligneCr(cr, 'SG').montant).toBe(125_000);
        expect(poste(bilan, 'SP2').montant).toBe(125_000);
        expect(cr.controle.ecart).toBe(0);
        expect(cr.controle.concordant).toBe(true);
        expect(cr.controle.residuel).toBe(0);
    });
    it('tient l’apport et l’acquisition HORS de A et de B, et les expose à part', async () => {
        const cr = await negoce().compteDeResultat('t1', 'e2026');
        const numerosEnAB = [...cr.recettes, ...cr.depenses].flatMap((p) => p.comptes.map((c) => c.numero));
        expect(numerosEnAB).not.toContain('10300000');
        expect(numerosEnAB).not.toContain('24110000');
        const financement = cr.fluxHorsResultat.find((r) => r.cle === 'financement');
        const investissement = cr.fluxHorsResultat.find((r) => r.cle === 'investissement');
        expect(financement.montant).toBe(1_000_000);
        expect(investissement.montant).toBe(-400_000);
        expect(cr.contrepartiesNonRattachees).toEqual([]);
    });
    it('n’écarte PAS le flux hors résultat de G · il n’y est jamais entré', async () => {
        const cr = await negoce().compteDeResultat('t1', 'e2026');
        const horsResultat = cr.fluxHorsResultat.reduce((s, r) => s + r.montant, 0);
        expect(horsResultat).toBe(600_000);
        expect(cr.resultatExercice).toBe(125_000);
    });
    it('écarte le virement interne de A et de B · son flux net est nul', async () => {
        const cr = await negoce().compteDeResultat('t1', 'e2026');
        expect(cr.totalRecettes).toBe(500_000);
        expect(cr.totalDepenses).toBe(565_000);
    });
    it('écarte les écritures de clôture · un report à-nouveau n’est pas un encaissement', async () => {
        const s = service({ e1: [ligne('57110000', client_1.ClasseCompte.CLASSE_5, 300_000, 0, { debit: 300_000 })] }, {
            ecritures: [
                ecriture('ran', '2026-01-01', 'Report à-nouveau', [
                    { numero: '57110000', debit: 300_000 },
                    { numero: '10300000', credit: 300_000 },
                ], { estGenereeParCloture: true }),
            ],
        });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.totalRecettes).toBe(0);
        expect(cr.fluxHorsResultat.every((r) => r.montant === 0)).toBe(true);
    });
    it('MAJEUR (relecture V1) · ventes et achats égaux, perte antérieure au 139 · G = 0 concorde avec la part de l’exercice de SP2', async () => {
        const s = service({
            e1: [
                ligne('10130000', client_1.ClasseCompte.CLASSE_1, 0, 1_000_000, { credit: 1_000_000 }),
                ligne('13900000', client_1.ClasseCompte.CLASSE_1, 300_000, 0, { debit: 300_000 }),
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1_700_000, 1_000_000, { debit: 700_000 }),
                ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 1_000_000),
                ligne('60110000', client_1.ClasseCompte.CLASSE_6, 1_000_000, 0),
            ],
        }, {
            ecritures: [
                ecriture('v', '2026-03-01', 'Vente au comptant', [
                    { numero: '52110000', debit: 1_000_000 },
                    { numero: '70110000', credit: 1_000_000 },
                ]),
                ecriture('a', '2026-04-01', 'Achat au comptant', [
                    { numero: '60110000', debit: 1_000_000 },
                    { numero: '52110000', credit: 1_000_000 },
                ]),
            ],
        });
        const [cr, bilan] = await Promise.all([s.compteDeResultat('t1', 'e1'), s.bilan('t1', 'e1')]);
        expect(poste(bilan, 'SP2').montant).toBe(-300_000);
        expect(bilan.equilibre).toBe(true);
        expect(bilan.controle.resultatAnterieurNonAffecte).toBe(-300_000);
        expect(cr.resultatExercice).toBe(0);
        expect(cr.controle.resultatBilan).toBe(0);
        expect(cr.controle.concordant).toBe(true);
    });
    it('lit F dans les MOUVEMENTS : après clôture, le solde des 68/69/85 est nul', async () => {
        const s = service({
            e1: [
                ligne('24110000', client_1.ClasseCompte.CLASSE_2, 400_000, 0, { debit: 400_000 }),
                ligne('28410000', client_1.ClasseCompte.CLASSE_2, 0, 80_000),
                ligne('10300000', client_1.ClasseCompte.CLASSE_1, 0, 400_000, { credit: 400_000 }),
                { ...ligne('13900000', client_1.ClasseCompte.CLASSE_1, 80_000, 0), mouvementDebit: 0, clotureDebit: 80_000, clotureCredit: 0 },
                { ...ligne('68130000', client_1.ClasseCompte.CLASSE_6, 80_000, 80_000), mouvementCredit: 0, clotureDebit: 0, clotureCredit: 80_000 },
            ],
        }, {
            ecritures: [
                ecriture('d1', '2026-12-31', 'Dotation', [
                    { numero: '68130000', debit: 80_000 },
                    { numero: '28410000', credit: 80_000 },
                ]),
            ],
        });
        const [cr, bilan] = await Promise.all([s.compteDeResultat('t1', 'e1'), s.bilan('t1', 'e1')]);
        expect(ligneCr(cr, 'SF').montant).toBe(80_000);
        expect(cr.resultatExercice).toBe(-80_000);
        expect(poste(bilan, 'SP2').montant).toBe(-80_000);
        expect(cr.controle.concordant).toBe(true);
        expect(bilan.equilibre).toBe(true);
    });
    it('expose l’écart d’une cession saisie en deux écritures, et l’explique entièrement', async () => {
        const s = service({
            e1: [
                ligne('24110000', client_1.ClasseCompte.CLASSE_2, 400_000, 400_000, { debit: 400_000 }),
                ligne('28410000', client_1.ClasseCompte.CLASSE_2, 80_000, 80_000, { credit: 80_000 }),
                ligne('10300000', client_1.ClasseCompte.CLASSE_1, 0, 320_000, { credit: 320_000 }),
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 120_000, 0),
                ligne('81200000', client_1.ClasseCompte.CLASSE_8, 320_000, 0),
                ligne('82200000', client_1.ClasseCompte.CLASSE_8, 0, 120_000),
            ],
        }, {
            ecritures: [
                ecriture('c1', '2026-06-01', 'Encaissement du prix de cession', [
                    { numero: '52110000', debit: 120_000 },
                    { numero: '82200000', credit: 120_000 },
                ]),
                ecriture('c2', '2026-06-01', 'Sortie du bien cédé', [
                    { numero: '81200000', debit: 320_000 },
                    { numero: '28410000', debit: 80_000 },
                    { numero: '24110000', credit: 400_000 },
                ]),
            ],
        });
        const [cr, bilan] = await Promise.all([s.compteDeResultat('t1', 'e1'), s.bilan('t1', 'e1')]);
        expect(cr.totalRecettes).toBe(120_000);
        expect(cr.resultatExercice).toBe(120_000);
        expect(poste(bilan, 'SP2').montant).toBe(-200_000);
        expect(cr.controle.ecart).toBe(320_000);
        expect(cr.controle.concordant).toBe(false);
        expect(cr.controle.composantesEcart.classe2).toBe(320_000);
        expect(cr.controle.residuel).toBe(0);
    });
    it('imprime les lignes dans l’ordre de la maquette, totaux compris', async () => {
        const cr = await negoce().compteDeResultat('t1', 'e2026');
        expect(cr.lignes.map((l) => l.ref)).toEqual([
            'SR1', 'SR2', 'SRA',
            'SD1', 'SD2', 'SD3', 'SD4', 'SD5', 'SD6', 'SDB',
            'SC',
            'SV1', 'SV2', 'SV3',
            'SF',
            'SG',
        ]);
        expect(ligneCr(cr, 'SRA').montant).toBe(500_000);
        expect(ligneCr(cr, 'SDB').montant).toBe(565_000);
        expect(ligneCr(cr, 'SC').montant).toBe(-65_000);
    });
});
describe('NOTE 4 · journal de trésorerie SMT', () => {
    it('tient un journal par compte de trésorerie · « un par banque et un pour la caisse »', async () => {
        const j = await negoce().journalTresorerie('t1', 'e2026');
        expect(j.journaux.map((x) => x.numero)).toEqual(['52110000', '57110000']);
    });
    it('chaque journal se reboucle sur le solde du compte à la balance', async () => {
        const j = await negoce().journalTresorerie('t1', 'e2026');
        const banque = j.journaux.find((x) => x.numero === '52110000');
        const caisse = j.journaux.find((x) => x.numero === '57110000');
        expect(banque.soldeAReporter).toBe(475_000);
        expect(banque.soldeBalance).toBe(475_000);
        expect(banque.boucle).toBe(true);
        expect(caisse.soldeAReporter).toBe(60_000);
        expect(caisse.boucle).toBe(true);
    });
    it('ventile chaque opération dans la colonne officielle de sa nature', async () => {
        const j = await negoce().journalTresorerie('t1', 'e2026');
        const caisse = j.journaux.find((x) => x.numero === '57110000');
        const vente = caisse.operations.find((o) => o.libelle === 'Vente comptant');
        expect(vente.recette).toBe(500_000);
        expect(vente.ventilation.ventes).toBe(500_000);
        const achat = caisse.operations.find((o) => o.libelle === 'Achat de marchandises comptant');
        expect(achat.depense).toBe(300_000);
        expect(achat.ventilation.achatsMarchandises).toBe(300_000);
        const salaires = caisse.operations.find((o) => o.libelle === 'Salaires');
        expect(salaires.ventilation.salaires).toBe(90_000);
        const banque = j.journaux.find((x) => x.numero === '52110000');
        expect(banque.operations.find((o) => o.libelle === 'Loyer du magasin').ventilation.loyers).toBe(60_000);
        expect(banque.operations.find((o) => o.libelle === 'Impôt foncier').ventilation.impotsTaxes).toBe(10_000);
        expect(banque.operations.find((o) => o.libelle === "Apport de l'exploitant").ventilation.compteExploitant).toBe(1_000_000);
        expect(banque.operations.find((o) => o.libelle === 'Achat matériel industriel').ventilation.autres).toBe(400_000);
    });
    it('porte le virement interne dans LES DEUX journaux, sans ventilation', async () => {
        const j = await negoce().journalTresorerie('t1', 'e2026');
        const banque = j.journaux.find((x) => x.numero === '52110000');
        const caisse = j.journaux.find((x) => x.numero === '57110000');
        const cote = (x) => x.operations.find((o) => o.libelle === 'Virement caisse vers banque');
        expect(cote(banque).recette).toBe(50_000);
        expect(cote(caisse).depense).toBe(50_000);
        expect(cote(banque).virementInterne).toBe(true);
        expect(cote(banque).ventile).toBe(false);
    });
    it('ouvre chaque journal sur le report à-nouveau du compte', async () => {
        const s = service({ e1: [ligne('57110000', client_1.ClasseCompte.CLASSE_5, 300_000, 0, { debit: 300_000 })] }, { ecritures: [] });
        const j = await s.journalTresorerie('t1', 'e1');
        expect(j.journaux[0].reportANouveau).toBe(300_000);
        expect(j.journaux[0].soldeAReporter).toBe(300_000);
        expect(j.journaux[0].boucle).toBe(true);
    });
    it('signale les lignes non ventilables plutôt que d’inventer une clé de répartition', async () => {
        const s = service({
            e1: [
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 60_000, 0),
                ligne('57110000', client_1.ClasseCompte.CLASSE_5, 40_000, 0),
                ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 100_000),
            ],
        }, {
            ecritures: [
                ecriture('m1', '2026-05-01', 'Encaissement partagé caisse et banque', [
                    { numero: '52110000', debit: 60_000 },
                    { numero: '57110000', debit: 40_000 },
                    { numero: '70110000', credit: 100_000 },
                ]),
            ],
        });
        const j = await s.journalTresorerie('t1', 'e1');
        for (const journal of j.journaux) {
            expect(journal.lignesNonVentilees).toBe(1);
            expect(journal.operations[0].ventile).toBe(false);
            expect(journal.operations[0].ventilation.ventes).toBe(0);
            expect(journal.boucle).toBe(true);
        }
    });
});
describe('Notes annexes S.M.T SYSCOHADA', () => {
    it('NOTE 1 · sert le registre des immobilisations ET les cautions du compte 275', async () => {
        const s = service({ e1: [ligne('27510000', client_1.ClasseCompte.CLASSE_2, 90_000, 0)] }, {
            immobilisations: [
                {
                    designation: 'Camionnette',
                    valeurOrigine: 3_000_000,
                    dateAcquisition: new Date('2026-02-01'),
                    dateSortie: null,
                    prixCession: null,
                },
            ],
        });
        const note = await s.note1MaterielMobilierCautions('t1', 'e1');
        expect(note.lignes.map((l) => l.origine)).toEqual(['REGISTRE', 'BALANCE']);
        expect(note.totalRegistre).toBe(3_000_000);
        expect(note.totalCautions).toBe(90_000);
        expect(note.total).toBe(3_090_000);
        expect(note.amortissement).toEqual({ mode: 'LINEAIRE', prorataTemporis: false });
    });
    it('NOTE 1 · ne totalise que les biens détenus, présente à part ceux sortis dans l’exercice (passe R6, E15)', async () => {
        const s = service({
            e1: [
                ligne('24410000', client_1.ClasseCompte.CLASSE_2, 3_000_000, 0),
                ligne('27510000', client_1.ClasseCompte.CLASSE_2, 90_000, 0),
            ],
        }, {
            immobilisations: [
                { designation: 'Camionnette', valeurOrigine: 3_000_000, compteImmobilisationId: 'id-24410000', dateAcquisition: new Date('2025-02-01'), dateSortie: null, prixCession: null },
                { designation: 'Ordinateur cédé', valeurOrigine: 800_000, compteImmobilisationId: 'id-24410000', dateAcquisition: new Date('2024-02-01'), dateSortie: new Date('2026-06-30'), prixCession: 200_000 },
                { designation: 'Chaise sortie en 2025', valeurOrigine: 50_000, compteImmobilisationId: 'id-24410000', dateAcquisition: new Date('2023-02-01'), dateSortie: new Date('2025-06-30'), prixCession: null },
            ],
        });
        const note = await s.note1MaterielMobilierCautions('t1', 'e1');
        expect(note.lignes.filter((l) => l.origine === 'REGISTRE').map((l) => l.designation)).toEqual(['Camionnette']);
        expect(note.totalRegistre).toBe(3_000_000);
        expect(note.total).toBe(3_090_000);
        expect(note.sortiesDeLExercice.map((l) => [l.designation, l.prixCession])).toEqual([['Ordinateur cédé', 200_000]]);
        expect(note.ecartsImmobilisations).toEqual([]);
        expect(note.motifEcartsImmobilisations).toBeNull();
    });
    it('NOTE 1 · nomme le compte de classe 2 que les fiches ne reconstituent pas, et la fiche sans solde', async () => {
        const s = service({ e1: [ligne('24410000', client_1.ClasseCompte.CLASSE_2, 3_500_000, 0), ligne('28440000', client_1.ClasseCompte.CLASSE_2, 0, 600_000)] }, {
            immobilisations: [
                { designation: 'Camionnette', valeurOrigine: 3_000_000, compteImmobilisationId: 'id-24410000', dateAcquisition: new Date('2026-02-01'), dateSortie: null, prixCession: null },
                { designation: 'Logiciel', valeurOrigine: 100_000, compteImmobilisationId: 'id-21300000', dateAcquisition: new Date('2026-02-01'), dateSortie: null, prixCession: null },
            ],
        });
        const note = await s.note1MaterielMobilierCautions('t1', 'e1');
        expect(note.ecartsImmobilisations).toEqual([
            { numero: '24410000', intitule: 'Compte 24410000', soldeBalance: 3_500_000, valeurFiches: 3_000_000, ecart: 500_000 },
        ]);
        expect(note.fichesSansSolde).toEqual([{ designation: 'Logiciel', montant: 100_000 }]);
        expect(note.motifEcartsImmobilisations).toContain('Immobilisations');
    });
    it('NOTE 1 · un bien non achevé se confronte à son compte en cours, un bien achevé à son compte définitif (immobilisation-en-cours.ts)', async () => {
        const s = service({ e1: [ligne('23910000', client_1.ClasseCompte.CLASSE_2, 5_000_000, 0), ligne('24110000', client_1.ClasseCompte.CLASSE_2, 2_000_000, 0)] }, {
            immobilisations: [
                { designation: 'Entrepôt', valeurOrigine: 5_000_000, compteImmobilisationId: 'id-23110000', compteEnCoursId: 'id-23910000', dateMiseEnService: null, dateAcquisition: new Date('2026-03-01'), dateSortie: null, prixCession: null },
                { designation: 'Presse', valeurOrigine: 2_000_000, compteImmobilisationId: 'id-24110000', compteEnCoursId: 'id-24910000', dateMiseEnService: new Date('2026-09-01'), dateAcquisition: new Date('2026-02-01'), dateSortie: null, prixCession: null },
            ],
        });
        const note = await s.note1MaterielMobilierCautions('t1', 'e1');
        expect(note.ecartsImmobilisations).toEqual([]);
        expect(note.fichesSansSolde).toEqual([]);
    });
    it('NOTE 2 · le stock final moins le stock initial EST la ligne SV1', async () => {
        const s = negoce();
        const [note, cr] = await Promise.all([s.note2Stocks('t1', 'e2026'), s.compteDeResultat('t1', 'e2026')]);
        expect(note.valeurStockFinal).toBe(120_000);
        expect(note.valeurStockInitial).toBe(0);
        expect(note.variationSv1).toBe(ligneCr(cr, 'SV1').montant);
        expect(note.lignes[0].quantite).toBeNull();
        expect(note.quantitesTenues).toBe(false);
        expect(note.motifQuantites).toContain("Aucune campagne d'inventaire n'est enregistrée pour cet exercice");
        expect(note.motifQuantites).toContain('Titre X ch. 1 § 1');
    });
    it('NOTE 2 · sert quantité et prix unitaire depuis la campagne, sans toucher au total SV1 (audit final F85)', async () => {
        const s = service({ e2026: BALANCE_NEGOCE }, {
            ecritures: ECRITURES_NEGOCE,
            campagneExerciceId: 'e2026',
            campagne: {
                libelle: 'Inventaire magasin',
                dateInventaire: new Date('2026-12-31T00:00:00Z'),
                fiches: [
                    { designation: 'Ciment', uniteMesure: 'sac', quantiteComptee: 12, valeurInventaire: 120_000, compte: { numero: '31110000' } },
                ],
            },
        });
        const [note, cr] = await Promise.all([s.note2Stocks('t1', 'e2026'), s.compteDeResultat('t1', 'e2026')]);
        expect(note.lignes).toEqual([
            { reference: '31110000', designation: 'Ciment (sac)', quantite: 12, prixUnitaire: 10_000, montant: 120_000 },
        ]);
        expect(note.quantitesTenues).toBe(true);
        expect(note.sourceQuantites).toContain('« Inventaire magasin »');
        expect(note.variationSv1).toBe(ligneCr(cr, 'SV1').montant);
    });
    it('NOTE 3 · deux tableaux, dont les variations SONT les lignes SV2 et SV3', async () => {
        const s = negoce();
        const [note, cr] = await Promise.all([s.note3CreancesDettes('t1', 'e2026'), s.compteDeResultat('t1', 'e2026')]);
        expect(note.creances.map((c) => c.numero)).toEqual(['41110000']);
        expect(note.dettes.map((d) => d.numero)).toEqual(['40110000']);
        expect(note.totalCreances).toBe(200_000);
        expect(note.totalDettes).toBe(50_000);
        expect(note.variationSv2).toBe(ligneCr(cr, 'SV2').montant);
        expect(note.variationSv3).toBe(ligneCr(cr, 'SV3').montant);
        expect(note.creances[0].variationPourcent).toBeNull();
    });
    it('NOTE 3 · nomme le tiers rattaché au compte quand il y en a un', async () => {
        const s = service({ e1: [ligne('41110000', client_1.ClasseCompte.CLASSE_4, 200_000, 0)] }, { tiersComptes: [{ compteId: 'id-41110000', tiers: { nom: 'Ets Kabila' } }] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].nom).toBe('Ets Kabila');
    });
    it("NOTE 3 · le dossier qui n'a saisi AUCUNE échéance rend ce qu'il rendait, et le dit", async () => {
        const note = await negoce().note3CreancesDettes('t1', 'e2026');
        expect(note.totalCreances).toBe(200_000);
        expect(note.totalDettes).toBe(50_000);
        expect(note.totalCreancesNonEchues).toBe(0);
        expect(note.totalCreancesEchues).toBe(0);
        expect(note.totalDettesNonEchues).toBe(0);
        expect(note.totalDettesEchues).toBe(0);
        expect(note.totalCreancesNonVentilees).toBe(200_000);
        expect(note.totalDettesNonVentilees).toBe(50_000);
        expect(note.creances[0].montantNonVentile).toBe(200_000);
        expect(note.echeancesTenues).toBe(false);
        expect(note.motifEcheances).toContain('non échues');
    });
    it("NOTE 3 · ventile à la CLÔTURE, et les trois parts somment toujours au solde", async () => {
        const s = service({ e1: [ligne('41110000', client_1.ClasseCompte.CLASSE_4, 300_000, 0)] }, {
            lignesTiers: [
                ligneTiers('41110000', { debit: 120_000 }, { echeance: '2027-01-31' }),
                ligneTiers('41110000', { debit: 100_000 }, { echeance: '2026-11-30' }),
                ligneTiers('41110000', { debit: 80_000 }),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        const c = note.creances[0];
        expect(c.montantNonEchu).toBe(120_000);
        expect(c.montantEchu).toBe(100_000);
        expect(c.montantNonVentile).toBe(80_000);
        expect(c.montantNonEchu + c.montantEchu + c.montantNonVentile).toBe(c.montantCloture);
        expect(note.echeancesTenues).toBe(false);
    });
    it('NOTE 3 · une ligne au BROUILLARD n’entre dans aucune part (paquet 1, B8 ; livre-journal seul)', async () => {
        const s = service({ e1: [ligne('41110000', client_1.ClasseCompte.CLASSE_4, 220_000, 0)] }, {
            lignesTiers: [
                ligneTiers('41110000', { debit: 120_000 }, { echeance: '2027-01-31' }),
                ligneTiers('41110000', { debit: 100_000 }, { echeance: '2026-11-30' }),
                ligneTiers('41110000', { debit: 80_000 }, { echeance: '2027-03-31', statut: 'BROUILLARD' }),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantNonEchu).toBe(120_000);
        expect(note.creances[0].montantEchu).toBe(100_000);
        expect(note.creances[0].montantNonVentile).toBe(0);
        expect(note.echeancesTenues).toBe(true);
    });
    it("NOTE 3 · l'échéance tombant LE JOUR de la clôture est échue, le terme est atteint", async () => {
        const s = service({ e1: [ligne('41110000', client_1.ClasseCompte.CLASSE_4, 50_000, 0)] }, { lignesTiers: [ligneTiers('41110000', { debit: 50_000 }, { echeance: '2026-12-31' })] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantEchu).toBe(50_000);
        expect(note.creances[0].montantNonEchu).toBe(0);
        expect(note.echeancesTenues).toBe(true);
        expect(note.motifEcheances).toBeNull();
    });
    it('NOTE 3 · une ligne soldée après la clôture reste dans la ventilation', async () => {
        const s = service({ e1: [ligne('41110000', client_1.ClasseCompte.CLASSE_4, 700_000, 0)] }, {
            lignesTiers: [
                ligneTiers('41110000', { debit: 200_000 }, { echeance: '2027-02-28' }),
                ligneTiers('41110000', { debit: 500_000 }, { echeance: '2027-05-31', lettre: 'A', regleApresCloture: true }),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantNonEchu).toBe(700_000);
    });
    it('NOTE 3 · une ligne lettrée est soldée et sort de la ventilation', async () => {
        const s = service({ e1: [ligne('41110000', client_1.ClasseCompte.CLASSE_4, 200_000, 0)] }, {
            lignesTiers: [
                ligneTiers('41110000', { debit: 200_000 }, { echeance: '2027-02-28' }),
                ligneTiers('41110000', { debit: 500_000 }, { echeance: '2027-05-31', lettre: 'A' }),
            ],
        });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances[0].montantNonEchu).toBe(200_000);
        expect(note.creances[0].montantNonVentile).toBe(0);
        expect(note.echeancesTenues).toBe(true);
    });
    it('NOTE 3 · une dette non échue se lit en POSITIF sous un total de dettes', async () => {
        const s = service({ e1: [ligne('40110000', client_1.ClasseCompte.CLASSE_4, 0, 150_000)] }, { lignesTiers: [ligneTiers('40110000', { credit: 150_000 }, { echeance: '2027-03-31' })] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.dettes[0].montantCloture).toBe(150_000);
        expect(note.dettes[0].montantNonEchu).toBe(150_000);
        expect(note.dettes[0].montantNonVentile).toBe(0);
        expect(note.totalDettesNonEchues).toBe(150_000);
    });
    it('NOTE 3 · ventile les 50 et 51 que SA3 joint, que la classe 4 aurait manqués', async () => {
        const s = service({ e1: [ligne('51210000', client_1.ClasseCompte.CLASSE_5, 400_000, 0)] }, { lignesTiers: [ligneTiers('51210000', { debit: 400_000 }, { echeance: '2027-06-30' })] });
        const note = await s.note3CreancesDettes('t1', 'e1');
        expect(note.creances.map((c) => c.numero)).toEqual(['51210000']);
        expect(note.creances[0].montantNonEchu).toBe(400_000);
        expect(note.echeancesTenues).toBe(true);
    });
    it('NOTE 3 · deux sommes demandées à la base, la ventilation de la lecture ligne à ligne au centime', async () => {
        const lignesTiers = [
            ligneTiers('41110000', { debit: 0.1 }, { echeance: '2027-01-15' }),
            ligneTiers('41110000', { debit: 0.2 }, { echeance: '2027-02-15' }),
            ligneTiers('41110000', { debit: 1_234.57 }, { echeance: '2026-12-31' }),
            ligneTiers('41110000', { credit: 0.07 }, { echeance: '2026-10-01' }),
            ligneTiers('41110000', { debit: 999.99 }),
            ligneTiers('41110000', { debit: 333.33 }, { echeance: '2027-03-01', lettre: 'B', regleApresCloture: true }),
            ligneTiers('41110000', { debit: 777.77 }, { echeance: '2027-04-01', lettre: 'C' }),
            ligneTiers('40110000', { credit: 100.1 }, { echeance: '2027-01-10' }),
            ligneTiers('40110000', { credit: 200.2 }, { echeance: '2026-11-11' }),
            ligneTiers('40110000', { debit: 50.05 }, { echeance: '2026-12-01' }),
            ligneTiers('51210000', { debit: 0.3 }, { echeance: '2027-06-30' }),
        ];
        const s = service({
            e1: [
                ligne('41110000', client_1.ClasseCompte.CLASSE_4, 2_568.12, 0),
                ligne('40110000', client_1.ClasseCompte.CLASSE_4, 0, 250.25),
                ligne('51210000', client_1.ClasseCompte.CLASSE_5, 0.3, 0),
            ],
        }, { lignesTiers });
        const note = await s.note3CreancesDettes('t1', 'e1');
        const cloture = new Date('2026-12-31');
        const reference = new Map();
        for (const l of lignesTiers) {
            if (l.lettre !== null && !l.regleApresCloture)
                continue;
            const montant = l.debit - l.credit;
            if (montant === 0 || !l.dateEcheance)
                continue;
            const parts = reference.get(l.compteId) ?? { nonEchu: 0, echu: 0 };
            if (l.dateEcheance > cloture)
                parts.nonEchu += montant;
            else
                parts.echu += montant;
            reference.set(l.compteId, parts);
        }
        const auCentime = (x) => Math.round(x * 100);
        const lignesNote = [
            ...note.creances.map((c) => ({ ...c, signe: 1 })),
            ...note.dettes.map((d) => ({ ...d, signe: -1 })),
        ];
        expect(lignesNote.map((l) => l.numero).sort()).toEqual(['40110000', '41110000', '51210000']);
        for (const l of lignesNote) {
            const ref = reference.get(`id-${l.numero}`);
            expect(auCentime(l.montantNonEchu)).toBe(auCentime(l.signe * ref.nonEchu));
            expect(auCentime(l.montantEchu)).toBe(auCentime(l.signe * ref.echu));
        }
        const client = note.creances.find((c) => c.numero === '41110000');
        expect(client.montantNonEchu).toBeCloseTo(333.63, 2);
        expect(client.montantEchu).toBeCloseTo(1_234.5, 2);
        expect(client.montantNonVentile).toBeCloseTo(999.99, 2);
        const fournisseur = note.dettes.find((d) => d.numero === '40110000');
        expect(fournisseur.montantNonEchu).toBeCloseTo(100.1, 2);
        expect(fournisseur.montantEchu).toBeCloseTo(150.15, 2);
        expect(note.creances.find((c) => c.numero === '51210000').montantNonEchu).toBeCloseTo(0.3, 2);
        const prisma = s.prisma;
        expect(prisma.ligneEcriture.findMany).not.toHaveBeenCalled();
        const appels = prisma.ligneEcriture.groupBy.mock.calls
            .map(([args]) => args)
            .filter((a) => a.by[0] !== 'lettrageId');
        expect(appels).toHaveLength(2);
        expect(appels.map((a) => a.where.dateEcheance)).toEqual([{ gt: cloture }, { lte: cloture }]);
        for (const a of appels) {
            expect(a.by).toEqual(['compteId']);
            expect(a._sum).toEqual({ debit: true, credit: true });
            expect([...(a.where.compteId?.in ?? [])].sort()).toEqual(['id-40110000', 'id-41110000', 'id-51210000']);
            expect(a.where.ecriture).toEqual({
                tenantId: 't1',
                exerciceId: 'e1',
                statut: 'VALIDEE',
            });
        }
    });
    it("NOTE 3 · la table ne renvoie à la note 3 que les deux postes SA3 et SP4", () => {
        const refs = [...correspondance_smt_syscohada_1.POSTES_BILAN_ACTIF_SMT_SYSCOHADA, ...correspondance_smt_syscohada_1.POSTES_BILAN_PASSIF_SMT_SYSCOHADA]
            .filter((p) => p.note === '3')
            .map((p) => p.ref);
        expect(refs).toEqual(['SA3', 'SP4']);
    });
    it('la fiche récapitulative porte les quatre notes et les deux journaux de suivi', () => {
        const fiche = negoce().ficheNotes();
        expect(fiche.notes.map((n) => n.numero)).toEqual([1, 2, 3, 4]);
        expect(fiche.journauxDeSuivi.map((j) => j.cle)).toEqual(['creancesImpayees', 'dettesAPayer']);
        expect(fiche.documents).toEqual(['BILAN', 'COMPTE_DE_RESULTAT', 'NOTES_ANNEXES']);
        expect(fiche.inventaireExtraComptable).toHaveLength(4);
    });
});
describe('Éligibilité au S.M.T · art. 11 et 13', () => {
    it('mesure le chiffre d’affaires HT sur les comptes 701 à 707, ventilé TA à TD', async () => {
        const s = service({
            e1: [
                ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 500_000),
                ligne('70210000', client_1.ClasseCompte.CLASSE_7, 0, 300_000),
                ligne('70610000', client_1.ClasseCompte.CLASSE_7, 0, 200_000),
                ligne('70710000', client_1.ClasseCompte.CLASSE_7, 0, 100_000),
                ligne('75100000', client_1.ClasseCompte.CLASSE_7, 0, 900_000),
            ],
        });
        const e = await s.eligibilite('t1', 'e1');
        expect(e.chiffreAffaires).toBe(1_100_000);
        expect(e.ventilation.map((v) => [v.ref, v.montant])).toEqual([
            ['TA', 500_000],
            ['TB', 300_000],
            ['TC', 200_000],
            ['TD', 100_000],
        ]);
        expect(e.comptesHorsVentilation).toEqual([]);
    });
    it('lit le chiffre d’affaires FACTURÉ, pas encaissé · l’art. 13 dit « chiffre d’affaires »', async () => {
        const e = await negoce().eligibilite('t1', 'e2026');
        expect(e.chiffreAffaires).toBe(700_000);
    });
    it('présente LES TROIS seuils et ne qualifie pas l’activité à la place de l’entité', async () => {
        const e = await negoce().eligibilite('t1', 'e2026');
        expect(e.seuils.map((s) => [s.cle, s.montantFcfa])).toEqual([
            ['negoce', 60_000_000],
            ['artisanat', 40_000_000],
            ['services', 30_000_000],
        ]);
        expect(e.seuils).toHaveLength(correspondance_smt_syscohada_1.SEUILS_SMT_ART13_FCFA.length);
        for (const s of e.seuils) {
            expect(s.clause).toContain("ou l'équivalent dans l'unité monétaire ayant cours légal");
        }
        expect(e).not.toHaveProperty('eligible');
        for (const s of e.seuils)
            expect(Object.keys(s).sort()).toEqual(['categorie', 'clause', 'cle', 'montantFcfa']);
        expect(e.qualificationParLEntite).toContain('négoce');
    });
    it('ne convertit pas les F CFA et le dit', async () => {
        const e = await negoce().eligibilite('t1', 'e2026');
        expect(e.conversionAppliquee).toBe(false);
        expect(e.deviseDossier).toBe('CDF');
        expect(e.avertissementConversion).toContain('ne convertit pas');
    });
    it('rappelle l’art. 11 · le Système normal est la règle, le S.M.T l’exception', async () => {
        const e = await negoce().eligibilite('t1', 'e2026');
        expect(e.rappelArticle11).toContain('sauf exception liée à sa taille');
        expect(e.rappelArticle11).toContain('Système normal');
    });
});
function demandesEcritures(s) {
    const prisma = s.prisma;
    return prisma.ecriture.findMany.mock.calls.map(([args]) => args);
}
function ventesComptant(n) {
    return Array.from({ length: n }, (_, i) => ecriture(`v${String(i).padStart(6, '0')}`, '2026-03-01', `Vente ${i}`, [
        { numero: '57110000', debit: 1_000 },
        { numero: '70110000', credit: 1_000 },
    ]));
}
describe('lecture des écritures bornée · audit final F258', () => {
    it('ne demande que des écritures de TRÉSORERIE, par tranches, sans le compte entier', async () => {
        const s = negoce();
        await s.compteDeResultat('t1', 'e2026');
        await s.journalTresorerie('t1', 'e2026');
        const demandes = demandesEcritures(s);
        expect(demandes.length).toBeGreaterThan(0);
        for (const d of demandes) {
            expect(d.take).toBe(lecture_par_lots_1.LOT_ECRITURES);
            expect(d.where.lignes?.some?.compte?.OR?.map((o) => o.numero.startsWith)).toEqual([
                '52', '53', '54', '55', '56', '57', '58',
            ]);
            expect(d).toHaveProperty('select');
            expect(d).not.toHaveProperty('include');
        }
    });
    it('lit un exercice de plus d’une tranche sans perdre ni recompter l’écriture du curseur', async () => {
        const n = lecture_par_lots_1.LOT_ECRITURES * 2 + 1;
        const s = service({ e1: [ligne('57110000', client_1.ClasseCompte.CLASSE_5, n * 1_000, 0), ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, n * 1_000)] }, { ecritures: ventesComptant(n) });
        const cr = await s.compteDeResultat('t1', 'e1');
        expect(cr.totalRecettes).toBe(n * 1_000);
        expect(cr.controle.concordant).toBe(true);
        expect(demandesEcritures(s)).toHaveLength(3);
        const j = await s.journalTresorerie('t1', 'e1');
        expect(j.journaux[0].operations).toHaveLength(n);
        expect(j.journaux[0].boucle).toBe(true);
    });
    it('retrouve l’écart de concordance par différence avec la balance, sans relire les écritures d’engagement', async () => {
        const cr = await negoce().compteDeResultat('t1', 'e2026');
        expect(cr.controle.composantesEcart).toEqual({
            classe1: 0,
            classe2: 80_000,
            depreciationsTresorerie: 0,
            autresComptes: 0,
            dotations: 80_000,
            total: 0,
        });
        expect(cr.controle.residuel).toBe(0);
    });
    it('refuse la NOTE 4 au-delà de son plafond déclaré, en disant par où passer · jamais un journal tronqué', async () => {
        expect(etats_financiers_smt_syscohada_service_1.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA).toBe(ecriture_service_1.PLAFOND_LIGNES_GRAND_LIVRE);
        const n = etats_financiers_smt_syscohada_service_1.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA + lecture_par_lots_1.LOT_ECRITURES * 3;
        const s = service({ e1: [ligne('57110000', client_1.ClasseCompte.CLASSE_5, n * 1_000, 0), ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, n * 1_000)] }, { ecritures: ventesComptant(n) });
        const refus = s.journalTresorerie('t1', 'e1');
        await expect(refus).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(refus).rejects.toThrow('grand livre de chaque compte de trésorerie');
        expect(demandesEcritures(s)).toHaveLength(Math.ceil((etats_financiers_smt_syscohada_service_1.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA + 1) / lecture_par_lots_1.LOT_ECRITURES));
    });
    it('sert la NOTE 4 entière au plafond exactement', async () => {
        const n = etats_financiers_smt_syscohada_service_1.PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYSCOHADA;
        const s = service({ e1: [ligne('57110000', client_1.ClasseCompte.CLASSE_5, n * 1_000, 0), ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, n * 1_000)] }, { ecritures: ventesComptant(n) });
        const j = await s.journalTresorerie('t1', 'e1');
        expect(j.journaux[0].operations).toHaveLength(n);
        expect(j.journaux[0].boucle).toBe(true);
    });
    it('remet le journal dans l’ordre du livre · date comptable, puis ordre de saisie', async () => {
        const s = service({ e1: [ligne('57110000', client_1.ClasseCompte.CLASSE_5, 300, 0), ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 300)] }, {
            ecritures: [
                ecriture('a', '2026-05-01', 'Troisième', [{ numero: '57110000', debit: 100 }, { numero: '70110000', credit: 100 }]),
                ecriture('b', '2026-02-01', 'Premier', [{ numero: '57110000', debit: 100 }, { numero: '70110000', credit: 100 }]),
                ecriture('c', '2026-03-01', 'Deuxième', [{ numero: '57110000', debit: 100 }, { numero: '70110000', credit: 100 }]),
            ],
        });
        const j = await s.journalTresorerie('t1', 'e1');
        expect(j.journaux[0].operations.map((o) => o.libelle)).toEqual(['Premier', 'Deuxième', 'Troisième']);
        expect(j.journaux[0].operations.map((o) => o.solde)).toEqual([100, 200, 300]);
    });
});
describe('exercice introuvable · un refus, jamais des états vides (audit final F222)', () => {
    it('refuse le bilan, le compte de résultat, les NOTES 1 à 4 et l’éligibilité d’un exercice inconnu du dossier', async () => {
        const s = negoce();
        await expect(s.bilan('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.compteDeResultat('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.journalTresorerie('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.note1MaterielMobilierCautions('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.eligibilite('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.note2Stocks('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.note3CreancesDettes('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
});
describe('monnaie du jeu légal · audit final F215', () => {
    it('nomme la monnaie de tenue même quand la devise du dossier n’est pas renseignée', async () => {
        const s = service({ e1: [ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 100)] }, { devise: null });
        const e = await s.eligibilite('t1', 'e1');
        expect(e.deviseDossier).toBe('CDF');
    });
});
describe('le 130 est lu en SP2 (paquet 1, A6, décision de Manasse du 2026-10-09)', () => {
    it('l’additionne au résultat et dit sa part · le bilan arrêté avant l’assemblée s’équilibre', async () => {
        const s = service({
            e1: [ligne('13010000', client_1.ClasseCompte.CLASSE_1, 0, 50_000), ligne('57110000', client_1.ClasseCompte.CLASSE_5, 50_000, 0)],
        });
        const bilan = await s.bilan('t1', 'e1');
        expect(bilan.comptesNonRattaches).toEqual([]);
        expect(poste(bilan, 'SA4').montant).toBe(50_000);
        expect(poste(bilan, 'SP2').montant).toBe(50_000);
        expect(bilan.resultatEnInstance).toBe(50_000);
        expect(bilan.equilibre).toBe(true);
    });
});
describe('Compte de résultat S.M.T SYSCOHADA · tiers hors exploitation (passe R2, C1)', () => {
    it('un dividende décidé puis payé ne touche pas G · G égale le résultat du bilan', async () => {
        const s = service({
            e1: [
                ligne('57110000', client_1.ClasseCompte.CLASSE_5, 600_000, 150_000, { debit: 500_000 }),
                ligne('12110000', client_1.ClasseCompte.CLASSE_1, 200_000, 500_000, { credit: 500_000 }),
                ligne('46500000', client_1.ClasseCompte.CLASSE_4, 150_000, 200_000),
                ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 100_000),
            ],
        }, {
            ecritures: [
                ecriture('v1', '2026-02-01', 'Vente comptant', [
                    { numero: '57110000', debit: 100_000 },
                    { numero: '70110000', credit: 100_000 },
                ]),
                ecriture('d1', '2026-05-01', 'Dividende décidé', [
                    { numero: '12110000', debit: 200_000 },
                    { numero: '46500000', credit: 200_000 },
                ]),
                ecriture('d2', '2026-06-01', 'Dividende payé', [
                    { numero: '46500000', debit: 150_000 },
                    { numero: '57110000', credit: 150_000 },
                ]),
            ],
        });
        const [cr, bilan, note3] = await Promise.all([
            s.compteDeResultat('t1', 'e1'),
            s.bilan('t1', 'e1'),
            s.note3CreancesDettes('t1', 'e1'),
        ]);
        expect(cr.totalDepenses).toBe(0);
        expect(ligneCr(cr, 'SV3').montant).toBe(0);
        expect(cr.resultatExercice).toBe(100_000);
        expect(poste(bilan, 'SP2').montant).toBe(100_000);
        expect(cr.controle.concordant).toBe(true);
        expect(cr.controle.residuel).toBe(0);
        expect(cr.controle.composantesEcart.classe1).toBe(0);
        expect(cr.controle.composantesEcart.autresComptes).toBe(0);
        expect(cr.fluxHorsResultat.find((r) => r.cle === 'financement').montant).toBe(-150_000);
        expect(poste(bilan, 'SP4').montant).toBe(50_000);
        expect(note3.dettes.map((d) => d.numero)).toEqual(['46500000']);
        expect(note3.variationSv3).toBe(ligneCr(cr, 'SV3').montant);
    });
    it('une immobilisation achetée à crédit puis payée ne pèse qu’une fois, par F', async () => {
        const s = service({
            e1: [
                ligne('52110000', client_1.ClasseCompte.CLASSE_5, 500_000, 200_000, { debit: 500_000 }),
                ligne('10300000', client_1.ClasseCompte.CLASSE_1, 0, 500_000, { credit: 500_000 }),
                ligne('24410000', client_1.ClasseCompte.CLASSE_2, 300_000, 0),
                ligne('28440000', client_1.ClasseCompte.CLASSE_2, 0, 60_000),
                ligne('48120000', client_1.ClasseCompte.CLASSE_4, 200_000, 300_000),
                ligne('68130000', client_1.ClasseCompte.CLASSE_6, 60_000, 0),
            ],
        }, {
            ecritures: [
                ecriture('i1', '2026-03-01', 'Achat matériel à crédit', [
                    { numero: '24410000', debit: 300_000 },
                    { numero: '48120000', credit: 300_000 },
                ]),
                ecriture('i2', '2026-04-01', 'Règlement du fournisseur', [
                    { numero: '48120000', debit: 200_000 },
                    { numero: '52110000', credit: 200_000 },
                ]),
                ecriture('i3', '2026-12-31', 'Dotation', [
                    { numero: '68130000', debit: 60_000 },
                    { numero: '28440000', credit: 60_000 },
                ]),
            ],
        });
        const [cr, bilan] = await Promise.all([s.compteDeResultat('t1', 'e1'), s.bilan('t1', 'e1')]);
        expect(cr.totalDepenses).toBe(0);
        expect(ligneCr(cr, 'SV3').montant).toBe(0);
        expect(ligneCr(cr, 'SF').montant).toBe(60_000);
        expect(cr.resultatExercice).toBe(-60_000);
        expect(poste(bilan, 'SP2').montant).toBe(-60_000);
        expect(cr.fluxHorsResultat.find((r) => r.cle === 'investissement').montant).toBe(-200_000);
        expect(cr.controle.residuel).toBe(0);
    });
});
describe('Journaux de suivi S.M.T SYSCOHADA (passe R2, C4)', () => {
    const L = (o) => ({
        tenantId: 't1',
        exerciceId: 'e1',
        statut: 'VALIDEE',
        compteId: `id-${o.numero}`,
        debit: 0,
        credit: 0,
        lettre: null,
        lettrageId: null,
        reference: null,
        ...o,
    });
    const LIGNES = [
        L({ id: 'f1', numero: '41110000', debit: 500_000, date: '2026-02-01', reference: 'FV-001', lettre: 'A', lettrageId: 'g1' }),
        L({ id: 'r1', numero: '41110000', credit: 500_000, date: '2026-03-15', lettre: 'A', lettrageId: 'g1' }),
        L({ id: 'f2', numero: '41110000', debit: 200_000, date: '2026-04-01', reference: 'FV-002', lettrageId: 'g2' }),
        L({ id: 'r2', numero: '41110000', credit: 50_000, date: '2026-05-01', lettrageId: 'g2' }),
        L({ id: 'f3', numero: '40110000', credit: 150_000, date: '2026-06-01', reference: 'FA-77' }),
        L({ id: 'x1', numero: '41110000', debit: 999, date: '2026-06-01', statut: 'BROUILLARD' }),
        L({ id: 'x2', numero: '41110000', debit: 888, date: '2026-06-01', tenantId: 'autre' }),
    ];
    function serviceSuivi() {
        const findMany = jest.fn().mockImplementation(({ where }) => {
            const surEcriture = (l) => l.tenantId === where.ecriture.tenantId &&
                (where.ecriture.exerciceId === undefined || l.exerciceId === where.ecriture.exerciceId) &&
                (where.ecriture.statut === undefined || l.statut === where.ecriture.statut);
            const vers = (l) => ({
                id: l.id,
                compteId: l.compteId,
                debit: l.debit,
                credit: l.credit,
                lettre: l.lettre,
                lettrageId: l.lettrageId,
                compte: { numero: l.numero, intitule: `Compte ${l.numero}` },
                ecriture: { date: new Date(l.date), reference: l.reference, numeroPiece: null },
            });
            if (where.lettrageId) {
                return Promise.resolve(LIGNES.filter((l) => surEcriture(l) && l.lettrageId && where.lettrageId.in.includes(l.lettrageId)).map(vers));
            }
            return Promise.resolve(LIGNES.filter((l) => surEcriture(l) &&
                where.OR.some((o) => l.numero.startsWith(o.compte.numero.startsWith) &&
                    (o.debit ? l.debit > o.debit.gt : true) &&
                    (o.credit ? l.credit > o.credit.gt : true))).map(vers));
        });
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }) },
            ligneEcriture: { findMany },
            tiersCompte: { findMany: jest.fn().mockResolvedValue([{ compteId: 'id-41110000', tiers: { nom: 'Client Mbala' } }]) },
        };
        return new etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService({}, {}, prisma);
    }
    it('sert les factures aux colonnes du texte, la date de paiement du groupe soldé seulement', async () => {
        const j = await serviceSuivi().journauxDeSuivi('t1', 'e1');
        const creances = j.journaux.find((x) => x.cle === 'creancesImpayees');
        const dettes = j.journaux.find((x) => x.cle === 'dettesAPayer');
        expect(creances.colonnes).toEqual(['Date', 'N° facture', 'Nom du client', 'Montant', 'Date paiement']);
        expect(creances.lignes.map((l) => [l.numeroFacture, l.nom, l.montant, l.datePaiement?.toISOString().slice(0, 10) ?? null, l.paiementPartiel])).toEqual([
            ['FV-001', 'Client Mbala', 500_000, '2026-03-15', false],
            ['FV-002', 'Client Mbala', 200_000, null, true],
        ]);
        expect(dettes.lignes.map((l) => [l.numeroFacture, l.montant, l.datePaiement])).toEqual([['FA-77', 150_000, null]]);
        expect(j.limite).toContain('comptabilité de trésorerie pure');
    });
});
describe('passes O1a C7 et O6 B3 · les états des garanties que la forme exige au SMT', () => {
    it('une SARL au SMT doit joindre les deux états de l’AUSCGIE art. 139, que le Titre X ne porte pas', async () => {
        const r = await service({ e1: [] }, { forme: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE }).etatsDesGaranties('t1');
        expect(r).toEqual({
            article: 'AUSCGIE art. 139',
            etats: [
                'État des cautionnements, avals et garanties donnés par la société',
                'État des sûretés réelles consenties par la société',
            ],
        });
    });
    it('une coopérative, ceux de l’AUSCOOP art. 109, jamais l’article de l’AUSCGIE', async () => {
        const r = await service({ e1: [] }, { forme: client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE }).etatsDesGaranties('t1');
        expect(r?.article).toBe('AUSCOOP art. 109');
        expect(r?.etats[0]).toContain('garanties personnelles données par la société coopérative');
    });
    it('aucune autre forme n’est visée, ni une forme non déclarée', async () => {
        for (const forme of [
            client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE,
            client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            client_1.FormeJuridiqueSyscohada.ENTREPRENANT,
            client_1.FormeJuridiqueSyscohada.SUCCURSALE,
            null,
        ]) {
            expect(await service({ e1: [] }, { forme }).etatsDesGaranties('t1')).toBeNull();
        }
    });
    it('les cinq sociétés commerciales de l’art. 6 sont toutes visées', () => {
        for (const forme of [
            client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
            client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
            client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE,
        ]) {
            expect((0, etats_garanties_smt_1.etatsDesGarantiesDus)(forme)?.article).toBe('AUSCGIE art. 139');
        }
    });
});
describe('Bilan S.M.T SYSCOHADA · la colonne N-1 qui reprend un résultat antérieur non viré', () => {
    const lignes2027 = [
        ligne('52110000', client_1.ClasseCompte.CLASSE_5, 700_000, 0),
        ligne('13910000', client_1.ClasseCompte.CLASSE_1, 300_000, 0),
        ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 1_000_000),
    ];
    const lignes2028 = [ligne('52110000', client_1.ClasseCompte.CLASSE_5, 700_000, 0), ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 700_000)];
    const exercices = (statut2027) => [
        { id: 'e0', dateDebut: new Date('2027-01-01T00:00:00Z'), statut: statut2027 },
        { id: 'e1', dateDebut: new Date('2028-01-01T00:00:00Z'), statut: 'OUVERT' },
    ];
    it('2027 clôturé · SP2 N-1 reprend 700 000, et la colonne dit la perte de 2026 restée au 13', async () => {
        const bilan = await service({ e0: lignes2027, e1: lignes2028 }, { exercices: exercices('CLOTURE') }).bilan('t1', 'e1');
        expect(poste(bilan, 'SP2').montantN1).toBe(700_000);
        expect(bilan.resultatAnterieurNonVire).toBeNull();
        expect(bilan.resultatAnterieurNonVireN1).toEqual(expect.objectContaining({ montant: -300_000, poste: 'SP2' }));
        expect(bilan.resultatAnterieurNonVireN1.motif).toContain('une perte de');
    });
    it('2027 ouvert · rien n’est dit', async () => {
        const bilan = await service({ e0: lignes2027, e1: lignes2028 }, { exercices: exercices('OUVERT') }).bilan('t1', 'e1');
        expect(bilan.resultatAnterieurNonVireN1).toBeNull();
    });
});
describe('Bilan S.M.T SYSCOHADA · paquet 1, A4 · l’ouverture d’un premier exercice clôturé', () => {
    it('la colonne N-1 porte le résultat repris en SP2, pas au compte exploitant', async () => {
        const apresCloture = [
            ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1_700_000, 0, { debit: 1_700_000 }),
            ligne('10130000', client_1.ClasseCompte.CLASSE_1, 0, 1_000_000, { credit: 1_000_000 }),
            ligne('13100000', client_1.ClasseCompte.CLASSE_1, 700_000, 700_000, { debit: 700_000, credit: 700_000 }),
            ligne('12100000', client_1.ClasseCompte.CLASSE_1, 0, 700_000, { credit: 700_000 }),
        ];
        const avantCloture = [
            ligne('52110000', client_1.ClasseCompte.CLASSE_5, 1_700_000, 0, { debit: 1_700_000 }),
            ligne('10130000', client_1.ClasseCompte.CLASSE_1, 0, 1_000_000, { credit: 1_000_000 }),
            ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 700_000, { credit: 700_000 }),
        ];
        const bilan = await service({ e1: apresCloture }, { ouvertures: { e1: avantCloture } }).bilan('t1', 'e1');
        expect({ comparatif: bilan.comparatif, sp2N1: poste(bilan, 'SP2').montantN1, sp1N1: poste(bilan, 'SP1').montantN1 }).toEqual({
            comparatif: 'BILAN_D_OUVERTURE',
            sp2N1: 700_000,
            sp1N1: 1_000_000,
        });
        expect(poste(bilan, 'SP1').montant).toBe(1_700_000);
    });
});
//# sourceMappingURL=etats-financiers-smt-syscohada.service.spec.js.map