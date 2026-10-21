"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const etats_financiers_syscohada_service_1 = require("./etats-financiers-syscohada.service");
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const correspondance_tft_syscohada_1 = require("./correspondance-tft-syscohada");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
function ligne(numero, classe, mouvementDebit, mouvementCredit, report = {}, typeCompte = client_1.TypeCompteDetailTotal.DETAIL) {
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
function serviceAvecExercices(lignesParExercice, exercices = [], reevaluationsParExercice = {}, ouverturesParExercice = {}) {
    const ecritureService = {
        balance: jest.fn().mockImplementation((_tenantId, exerciceId, _inclureBrouillard, _arreteAu, options) => {
            const lignes = (options?.avantLaCloture ? ouverturesParExercice[exerciceId] : undefined) ?? lignesParExercice[exerciceId] ?? [];
            return Promise.resolve({
                lignes,
                totaux: {
                    debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
                    credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
                },
            });
        }),
        ouverturePasseeAuPremierJour: jest.fn().mockResolvedValue(null),
        positionDOuvertureAuPremierJour: jest.fn().mockResolvedValue({ etat: 'AUCUNE' }),
        nombreAuBrouillard: jest.fn().mockResolvedValue(0),
        mouvementsDeReevaluation: jest.fn().mockImplementation((_t, exerciceId) => Promise.resolve((exerciceId && reevaluationsParExercice[exerciceId]) || new Map())),
    };
    const exerciceService = {
        lister: jest.fn().mockResolvedValue([...exercices].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())),
    };
    return new etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService(ecritureService, exerciceService);
}
function serviceAvecBalance(lignes) {
    return serviceAvecExercices({ e1: lignes }, [
        { id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') },
    ]);
}
const C1 = client_1.ClasseCompte.CLASSE_1;
const C2 = client_1.ClasseCompte.CLASSE_2;
const C4 = client_1.ClasseCompte.CLASSE_4;
const C5 = client_1.ClasseCompte.CLASSE_5;
const C6 = client_1.ClasseCompte.CLASSE_6;
const C7 = client_1.ClasseCompte.CLASSE_7;
const C8 = client_1.ClasseCompte.CLASSE_8;
const C9 = client_1.ClasseCompte.CLASSE_9;
const LIGNES_E1 = [
    ligne('10130000', C1, 0, 10000),
    ligne('24510000', C2, 6000, 0),
    ligne('28450000', C2, 0, 1000),
    ligne('41110000', C4, 2000, 0),
    ligne('40110000', C4, 0, 500),
    ligne('52110000', C5, 3500, 0),
];
const LIGNES_E2 = [
    ligne('10130000', C1, 0, 0, { credit: 10000 }),
    ligne('24510000', C2, 0, 0, { debit: 6000 }),
    ligne('28450000', C2, 0, 500, { credit: 1000 }),
    ligne('41110000', C4, 8000, 7000, { debit: 2000 }),
    ligne('40110000', C4, 4800, 5000, { credit: 500 }),
    ligne('52110000', C5, 7000, 6300, { debit: 3500 }),
    ligne('70110000', C7, 0, 8000),
    ligne('60110000', C6, 5000, 0),
    ligne('66110000', C6, 1500, 0),
    ligne('68130000', C6, 500, 0),
    ligne('18600000', C1, 400, 0),
    ligne('18700000', C1, 0, 400),
];
const EXERCICES = [
    { id: 'e1', dateDebut: new Date('2025-01-01') },
    { id: 'e2', dateDebut: new Date('2026-01-01') },
];
function serviceDeReference() {
    return serviceAvecExercices({ e1: LIGNES_E1, e2: LIGNES_E2 }, EXERCICES);
}
describe('EtatsFinanciersSyscohadaService', () => {
    describe('bilan', () => {
        const poste = (bilan, ref) => [...bilan.actif, ...bilan.passif].find((p) => p.ref === ref);
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
            const E1 = { id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') };
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
                const balance = s.ecritureService.balance;
                const ouvertures = balance.mock.calls.filter((c) => c[4]?.avantLaCloture);
                expect(ouvertures).toHaveLength(3);
                for (const c of ouvertures)
                    expect(c.slice(0, 3)).toEqual(['t1', 'e1', false]);
                expect(tft.lignes.find((l) => l.ref === 'ZA')?.montant).toBe(12_000_000);
                expect(tft.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionComparatifSurOuverture)('SYSCOHADA'));
            });
            it('la colonne N-1 du tableau des flux de l’exercice suivant part de la même ouverture', async () => {
                const E2 = { id: 'e2', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z') };
                const s = serviceAvecExercices({ e1: apresCloture, e2: [ligne('52110000', C5, 0, 0, { debit: 12_500_000 }), ligne('10130000', C1, 0, 0, { credit: 10_000_000 }), ligne('12100000', C1, 0, 0, { credit: 2_500_000 })] }, [E1, E2], {}, { e1: avantCloture });
                const tft = await s.tableauFluxTresorerie('t1', 'e2');
                const balance = s.ecritureService.balance;
                expect(balance.mock.calls.filter((c) => c[4]?.avantLaCloture).map((c) => c[1])).toEqual(['e1']);
                expect(tft.lignes.find((l) => l.ref === 'ZA')?.montantN1).toBe(12_000_000);
            });
            it('un premier exercice ouvert en OD et clôturé reste, en N-1, ni flux ni ouverture', async () => {
                const E2 = { id: 'e2', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z') };
                const enOd = [
                    ligne('52110000', C5, 12_500_000, 0),
                    ligne('10130000', C1, 0, 10_000_000),
                    ligne('13100000', C1, 0, 2_000_000, { debit: 2_000_000 }),
                    ligne('12100000', C1, 0, 0, { credit: 2_000_000 }),
                    ligne('70110000', C7, 0, 500_000),
                ];
                const enOdAvantCloture = [
                    ligne('52110000', C5, 12_500_000, 0),
                    ligne('10130000', C1, 0, 10_000_000),
                    ligne('13100000', C1, 0, 2_000_000),
                    ligne('70110000', C7, 0, 500_000),
                ];
                const s = serviceAvecExercices({ e1: enOd, e2: [ligne('52110000', C5, 0, 0, { debit: 12_500_000 }), ligne('10130000', C1, 0, 0, { credit: 10_000_000 }), ligne('12100000', C1, 0, 0, { credit: 2_500_000 })] }, [E1, E2], {}, { e1: enOdAvantCloture });
                const ecritures = s.ecritureService;
                ecritures.ouverturePasseeAuPremierJour.mockResolvedValue({ nombre: 1, pieces: ['OD n° 1'] });
                const tft = await s.tableauFluxTresorerie('t1', 'e2');
                expect(ecritures.ouverturePasseeAuPremierJour).toHaveBeenCalledWith('t1', 'e1');
                expect(tft.lignes.find((l) => l.ref === 'FK')?.montantN1).toBeUndefined();
                expect(tft.postesNonCalculablesN1.find((p) => p.ref === 'FK')?.raison).toContain('OD n° 1');
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
                ligne('10420000', C1, 200, 200),
                ligne('58500000', C5, 50, 0),
                ligne('10130000', C1, 0, 350),
            ]).bilan('t1', 'e1');
            expect(bilan.comptesASolderALaCloture.map((c) => c.numero)).toEqual(['10410000']);
            expect(bilan.comptesASolderALaCloture[0].source).toContain('COMPTE 104');
            expect(bilan.comptesASolderALaCloture[0].montant).toBe(300);
            expect(bilan.comptesNonRattaches.map((c) => c.numero)).toContain('58500000');
        });
        it('ne les signale pas sur une situation intermédiaire, où ils sont légitimes', async () => {
            const service = serviceAvecExercices({ e1: [ligne('10410000', C1, 300, 0), ligne('10130000', C1, 0, 300)] }, [
                { id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') },
            ]);
            expect((await service.bilan('t1', 'e1', '2026-06-30')).comptesASolderALaCloture).toEqual([]);
            await expect(service.bilan('t1', 'e1', '2026-12-31')).resolves.toBeDefined();
        });
        it('équilibre le dossier de référence et loge chaque compte au poste du ch. 7', async () => {
            const bilan = await serviceDeReference().bilan('t1', 'e2');
            expect(poste(bilan, 'AN')?.brut).toBe(6000);
            expect(poste(bilan, 'AN')?.amortissement).toBe(1500);
            expect(poste(bilan, 'AN')?.montant).toBe(4500);
            expect(poste(bilan, 'BI')?.montant).toBe(3000);
            expect(poste(bilan, 'BS')?.montant).toBe(4200);
            expect(poste(bilan, 'CA')?.montant).toBe(10000);
            expect(poste(bilan, 'CJ')?.montant).toBe(1000);
            expect(poste(bilan, 'DJ')?.montant).toBe(700);
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
            expect(poste(bilan, 'BZ')?.comptes).toEqual([]);
            expect(poste(bilan, 'AN')?.comptes.map((c) => c.numero)).toEqual(['24510000', '28450000']);
        });
        it('porte le comparatif N-1 quand l’exercice antérieur existe, et rien quand il n’existe pas', async () => {
            const avecN1 = await serviceDeReference().bilan('t1', 'e2');
            expect(avecN1.exerciceN1Disponible).toBe(true);
            expect(poste(avecN1, 'AN')?.montantN1).toBe(5000);
            expect(avecN1.totalActifN1).toBe(10500);
            const sansN1 = await serviceDeReference().bilan('t1', 'e1');
            expect(sansN1.exerciceN1Disponible).toBe(false);
            expect(poste(sansN1, 'AN')?.montantN1).toBeUndefined();
            expect(sansN1.totalActifN1).toBeUndefined();
        });
        it('transfère un 52 créditeur de BS vers DR, sans double comptage', async () => {
            const service = serviceAvecBalance([
                ligne('10130000', C1, 0, 700),
                ligne('57110000', C5, 1000, 0),
                ligne('52110000', C5, 0, 300),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'BS')?.montant).toBe(1000);
            expect(poste(bilan, 'BS')?.comptes.map((c) => c.numero)).toEqual(['57110000']);
            expect(poste(bilan, 'DR')?.montant).toBe(300);
            expect(poste(bilan, 'DR')?.comptes.map((c) => c.numero)).toEqual(['52110000']);
            expect(bilan.totalActif).toBe(1000);
            expect(poste(bilan, 'BT')?.montant).toBe(1000);
            expect(poste(bilan, 'DT')?.montant).toBe(300);
            expect(bilan.totalPassif).toBe(1000);
            expect(bilan.equilibre).toBe(true);
        });
        it('laisse un 57 créditeur VISIBLE en négatif dans BS · aucun poste de passif ne l’accueille', async () => {
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
                ligne('52', C5, 100, 0, {}, client_1.TypeCompteDetailTotal.TOTAL),
                ligne('10130000', C1, 0, 100),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.totalActif).toBe(100);
        });
        it('liste les comptes de bilan sans poste, jamais absorbés dans un poste voisin', async () => {
            const bilan = await serviceDeReference().bilan('t1', 'e2');
            expect(bilan.comptesNonRattaches.map((c) => c.numero).sort()).toEqual(['18600000', '18700000']);
        });
        it('lit le 130 en CJ et dit sa part ; laisse le 585 orphelin et le signale', async () => {
            const service = serviceAvecBalance([
                ligne('13010000', C1, 0, 800),
                ligne('58500000', C5, 200, 0),
                ligne('52110000', C5, 800, 200),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(bilan.comptesNonRattaches.map((c) => c.numero)).toEqual(['58500000']);
            expect(poste(bilan, 'CJ')?.montant).toBe(800);
            expect(bilan.resultatEnInstance).toBe(800);
            expect(bilan.equilibre).toBe(false);
        });
        it('prend le résultat dans le compte 13 APRÈS clôture, quand les classes de gestion sont soldées', async () => {
            const service = serviceAvecBalance([
                ligne('52110000', C5, 11000, 0),
                ligne('10130000', C1, 0, 10000),
                ligne('13100000', C1, 0, 1000),
            ]);
            const bilan = await service.bilan('t1', 'e1');
            expect(poste(bilan, 'CJ')?.montant).toBe(1000);
            expect(bilan.controle.resultatClasses678).toBe(0);
            expect(bilan.controle.resultatCompte13).toBe(1000);
            expect(bilan.equilibre).toBe(true);
        });
        it('B1 · avant l\'affectation, CJ additionne le résultat de N resté au 131 et celui de N+1 en cours · le bilan s\'équilibre', async () => {
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
            const lignes = [
                ligne('52110000', C5, 1_000_000, 400_000, { debit: 53_928_000 }),
                ligne('10130000', C1, 0, 0, { credit: 100_000_000 }),
                ligne('13900000', C1, 0, 0, { debit: 46_072_000 }),
                ligne('70110000', C7, 0, 1_000_000),
                ligne('60110000', C6, 400_000, 0),
            ];
            const exercice = (statut) => [{ id: 'e1', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z'), statut }];
            const clos = await serviceAvecExercices({ e1: lignes }, exercice('CLOTURE')).bilan('t1', 'e1');
            expect(poste(clos, 'CJ')?.montant).toBe(600_000 - 46_072_000);
            expect(clos.equilibre).toBe(true);
            expect(clos.controle.resultatAnterieurNonAffecte).toBe(-46_072_000);
            expect(clos.resultatAnterieurNonVire).toEqual(expect.objectContaining({ montant: -46_072_000, poste: 'CJ' }));
            expect(clos.resultatAnterieurNonVire.motif).toContain('AUDCIF, Titre VII, compte 13');
            expect(clos.comptesASolderALaCloture).toEqual([
                expect.objectContaining({ numero: '13900000', montant: 46_072_000, source: expect.stringContaining('Titre VII COMPTE 13') }),
            ]);
            const ouvert = await serviceAvecExercices({ e1: lignes }, exercice('OUVERT')).bilan('t1', 'e1');
            expect(ouvert.resultatAnterieurNonVire).toBeNull();
            expect(ouvert.comptesASolderALaCloture).toEqual([]);
            expect(poste(ouvert, 'CJ')?.montant).toBe(600_000 - 46_072_000);
        });
        it('paquet 1, A1 · la colonne N-1 de l’exercice suivant reprend CJ tel quel, et le DIT', async () => {
            const lignes2027 = [
                ligne('52110000', C5, 1_000_000, 400_000, { debit: 53_928_000 }),
                ligne('10130000', C1, 0, 0, { credit: 100_000_000 }),
                ligne('13900000', C1, 0, 0, { debit: 46_072_000 }),
                ligne('70110000', C7, 0, 1_000_000),
                ligne('60110000', C6, 400_000, 0),
            ];
            const lignes2028 = [ligne('52110000', C5, 0, 0, { debit: 54_528_000 }), ligne('10130000', C1, 0, 0, { credit: 100_000_000 })];
            const exercices = (statut2027) => [
                { id: 'e0', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z'), statut: statut2027 },
                { id: 'e1', dateDebut: new Date('2028-01-01T00:00:00Z'), dateFin: new Date('2028-12-31T00:00:00Z'), statut: 'OUVERT' },
            ];
            const bilan = await serviceAvecExercices({ e0: lignes2027, e1: lignes2028 }, exercices('CLOTURE')).bilan('t1', 'e1');
            expect(poste(bilan, 'CJ')?.montantN1).toBe(600_000 - 46_072_000);
            expect(bilan.resultatAnterieurNonVire).toBeNull();
            expect(bilan.resultatAnterieurNonVireN1).toEqual(expect.objectContaining({ montant: -46_072_000, poste: 'CJ' }));
            expect(bilan.resultatAnterieurNonVireN1.motif).toMatch(/^Colonne N-1 · /);
            const ouvert = await serviceAvecExercices({ e0: lignes2027, e1: lignes2028 }, exercices('OUVERT')).bilan('t1', 'e1');
            expect(ouvert.resultatAnterieurNonVireN1).toBeNull();
            expect((await serviceAvecBalance(lignes2028).bilan('t1', 'e1')).resultatAnterieurNonVireN1).toBeNull();
        });
    });
    describe('compteDeResultat', () => {
        it('rend la maquette complète du ch. 4, dans l’ordre du modèle', async () => {
            const cr = await serviceDeReference().compteDeResultat('t1', 'e2');
            expect(cr.lignes.map((l) => l.ref)).toEqual(correspondance_compte_resultat_syscohada_1.ORDRE_AFFICHAGE_COMPTE_RESULTAT.filter((r) => r !== 'RQP' && r !== 'TQP'));
            const xa = cr.lignes.find((l) => l.ref === 'XA');
            expect(xa?.estSolde).toBe(true);
            expect(xa?.formuleOfficielle).toBe('Somme TA à RB');
            expect(cr.lignes.find((l) => l.ref === 'TA')?.estSolde).toBeUndefined();
        });
        it('porte les charges en NÉGATIF et les produits en positif', async () => {
            const cr = await serviceDeReference().compteDeResultat('t1', 'e2');
            const montant = (ref) => cr.lignes.find((l) => l.ref === ref).montant;
            expect(montant('TA')).toBe(8000);
            expect(montant('RA')).toBe(-5000);
            expect(montant('RK')).toBe(-1500);
            expect(montant('RL')).toBe(-500);
        });
        it('calcule les neuf lignes X* par les formules du modèle', async () => {
            const cr = await serviceDeReference().compteDeResultat('t1', 'e2');
            expect(cr.soldes.margeCommerciale).toBe(3000);
            expect(cr.soldes.chiffreAffaires).toBe(8000);
            expect(cr.soldes.valeurAjoutee).toBe(3000);
            expect(cr.soldes.excedentBrutExploitation).toBe(1500);
            expect(cr.soldes.resultatExploitation).toBe(1000);
            expect(cr.soldes.resultatFinancier).toBe(0);
            expect(cr.soldes.resultatActivitesOrdinaires).toBe(1000);
            expect(cr.soldes.resultatHorsActivitesOrdinaires).toBe(0);
            expect(cr.soldes.resultatNet).toBe(1000);
            expect(cr.lignes.find((l) => l.ref === 'XI')?.montant).toBe(1000);
        });
        it('boucle : XI vaut le solde de toutes les classes de gestion', async () => {
            const cr = await serviceDeReference().compteDeResultat('t1', 'e2');
            const classesDeGestion = [client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7, client_1.ClasseCompte.CLASSE_8];
            const soldeDesClassesDeGestion = LIGNES_E2.filter((l) => classesDeGestion.includes(l.classe)).reduce((s, l) => s + l.solde, 0);
            expect(cr.soldes.resultatNet).toBe(-soldeDesClassesDeGestion);
            expect(cr.controle.resultatToutesClassesDeGestion).toBe(1000);
            expect(cr.controle.ecart).toBe(0);
            expect(cr.controle.coherent).toBe(true);
            const bilan = await serviceDeReference().bilan('t1', 'e2');
            expect([...bilan.actif, ...bilan.passif].find((p) => p.ref === 'CJ')?.montant).toBe(cr.soldes.resultatNet);
        });
        it('signale un compte de gestion sans poste et chiffre l’écart qu’il crée', async () => {
            const service = serviceAvecBalance([ligne('60900000', C6, 300, 0), ligne('52110000', C5, 0, 300)]);
            const cr = await service.compteDeResultat('t1', 'e1');
            expect(cr.comptesNonRattaches).toEqual([{ numero: '60900000', intitule: 'Compte 60900000', montant: -300 }]);
            expect(cr.soldes.resultatNet).toBe(0);
            expect(cr.controle.ecart).toBe(-300);
            expect(cr.controle.coherent).toBe(false);
        });
        it('garde RQP quand seul N-1 en porte · la colonne comparative doit pouvoir se lire (audit final F89)', async () => {
            const service = serviceAvecExercices({
                e1: [ligne('52110000', C5, 1000, 0), ligne('65250000', C6, 400, 0), ligne('70110000', C7, 0, 1400)],
                e2: [ligne('52110000', C5, 500, 0), ligne('70110000', C7, 0, 500)],
            }, EXERCICES);
            const cr = await service.compteDeResultat('t1', 'e2');
            const rqp = cr.lignes.find((l) => l.ref === 'RQP');
            expect(rqp?.montant).toBe(0);
            expect(rqp?.montantN1).toBe(-400);
        });
        it('sort la quote-part de résultat partagé de la valeur ajoutée et de l’EBE, sans rompre le bouclage (ch. 33)', async () => {
            const service = serviceAvecBalance([
                ligne('52110000', C5, 1000, 0),
                ligne('70110000', C7, 0, 1000),
                ligne('65250000', C6, 400, 0),
                ligne('46310000', C4, 0, 400),
            ]);
            const cr = await service.compteDeResultat('t1', 'e1');
            const montantDe = (ref) => cr.lignes.find((l) => l.ref === ref).montant;
            expect(montantDe('RQP')).toBe(-400);
            expect(cr.lignes.find((l) => l.ref === 'RQP')?.supplementaire).toBe(true);
            expect(cr.lignes.some((l) => l.ref === 'TQP')).toBe(false);
            expect(montantDe('RJ')).toBe(0);
            expect(cr.soldes.valeurAjoutee).toBe(1000);
            expect(cr.soldes.excedentBrutExploitation).toBe(1000);
            expect(cr.soldes.resultatExploitation).toBe(600);
            expect(cr.soldes.resultatNet).toBe(600);
            expect(cr.comptesNonRattaches).toEqual([]);
            expect(cr.controle.ecart).toBe(0);
            expect(cr.controle.coherent).toBe(true);
            const bilan = await service.bilan('t1', 'e1');
            expect([...bilan.actif, ...bilan.passif].find((p) => p.ref === 'CJ')?.montant).toBe(600);
            expect(bilan.totalActif).toBe(1000);
            expect(bilan.totalPassif).toBe(1000);
        });
        it('rend la colonne N-1 seulement quand l’exercice antérieur existe', async () => {
            const avecN1 = await serviceDeReference().compteDeResultat('t1', 'e2');
            expect(avecN1.exerciceN1Disponible).toBe(true);
            expect(avecN1.soldesN1?.resultatNet).toBe(0);
            expect(avecN1.lignes.every((l) => l.montantN1 !== undefined)).toBe(true);
            const sansN1 = await serviceDeReference().compteDeResultat('t1', 'e1');
            expect(sansN1.exerciceN1Disponible).toBe(false);
            expect(sansN1.soldesN1).toBeUndefined();
            expect(sansN1.lignes.every((l) => l.montantN1 === undefined)).toBe(true);
        });
    });
    describe('tableauFluxTresorerie', () => {
        const montant = (tft, ref) => tft.lignes.find((l) => 'ref' in l && l.ref === ref);
        it('applique la méthode indirecte : FA part de l’EBE, FB à FE sont des variations de bilan', async () => {
            const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');
            expect(montant(tft, 'FA').montant).toBe(1500);
            expect(montant(tft, 'FB').montant).toBe(0);
            expect(montant(tft, 'FC').montant).toBe(0);
            expect(montant(tft, 'FD').montant).toBe(-1000);
            expect(montant(tft, 'FE').montant).toBe(200);
            expect(montant(tft, 'ZB').montant).toBe(700);
            expect(montant(tft, 'ZC').montant).toBe(0);
            expect(montant(tft, 'ZF').montant).toBe(0);
        });
        it('boucle : ZH par les flux = ZA + ZB + ZC + ZF = ZH par le bilan', async () => {
            const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');
            expect(montant(tft, 'ZA').montant).toBe(3500);
            expect(montant(tft, 'ZG').montant).toBe(700);
            expect(montant(tft, 'ZH').montant).toBe(4200);
            const parLesFlux = correspondance_tft_syscohada_1.CONTROLE_ZH_PAR_LES_FLUX.reduce((s, ref) => s + montant(tft, ref).montant, 0);
            expect(parLesFlux).toBe(4200);
            expect(tft.controle.tresorerieOuverture).toBe(3500);
            expect(tft.controle.variation).toBe(700);
            expect(tft.controle.tresorerieClotureParFlux).toBe(4200);
            expect(tft.controle.tresorerieClotureParBilan).toBe(4200);
            expect(tft.controle.ecart).toBe(0);
            expect(tft.controle.coherent).toBe(true);
            const bilan = await serviceDeReference().bilan('t1', 'e2');
            const bt = [...bilan.actif].find((p) => p.ref === 'BT').montant;
            const dt = [...bilan.passif].find((p) => p.ref === 'DT').montant;
            expect(tft.controle.tresorerieClotureParBilan).toBe(bt - dt);
        });
        it('lit la trésorerie du contrôle APRÈS transfert du découvert, sans le compter deux fois', async () => {
            const service = serviceAvecBalance([
                ligne('10130000', C1, 0, 700),
                ligne('57110000', C5, 1000, 0),
                ligne('52110000', C5, 0, 300),
            ]);
            const tft = await service.tableauFluxTresorerie('t1', 'e1');
            expect(tft.controle.tresorerieClotureParBilan).toBe(700);
        });
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
            expect(montant(tft, 'ZH').montantN1).toBeUndefined();
        });
        it('relecture V1 · un exercice précédent ouvert SANS ÉCRITURE · ZA se lit sur le bilan d’ouverture de l’exercice, et c’est dit', async () => {
            const service = serviceAvecExercices({
                e1: [],
                e2: [
                    ligne('10130000', C1, 0, 0, { credit: 2000 }),
                    ligne('52110000', C5, 500, 0, { debit: 2000 }),
                    ligne('70110000', C7, 0, 500),
                ],
            }, EXERCICES);
            const tft = await service.tableauFluxTresorerie('t1', 'e2');
            expect(montant(tft, 'ZA').montant).toBe(2000);
            expect(montant(tft, 'ZH').montant).toBe(2500);
            expect(tft.controle.coherent).toBe(true);
            expect(tft.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionExercicePrecedentVide)('SYSCOHADA', true));
        });
        it('paquet 1, A2 · un exercice précédent qui n’a que du brouillard · la mention dit de le valider, pas d’importer', async () => {
            const service = serviceAvecExercices({ e1: [], e2: [ligne('52110000', C5, 500, 0), ligne('70110000', C7, 0, 500)] }, EXERCICES);
            const ecritures = service.ecritureService;
            ecritures.nombreAuBrouillard.mockResolvedValue(3);
            const tft = await service.tableauFluxTresorerie('t1', 'e2');
            expect(ecritures.nombreAuBrouillard).toHaveBeenCalledWith('t1', 'e1');
            expect(tft.mentionOuverture).toBe((0, etats_financiers_communs_1.mentionExercicePrecedentVide)('SYSCOHADA', false, 3));
            expect(tft.mentionOuverture).toContain('brouillard (3)');
            expect(tft.mentionOuverture).not.toContain('Importez');
        });
        it('premier exercice d’une société qui naît · l’ouverture présumée nulle est DITE', async () => {
            const tft = await serviceAvecBalance([ligne('10130000', C1, 0, 1000), ligne('52110000', C5, 1000, 0)]).tableauFluxTresorerie('t1', 'e1');
            expect(tft.mentionOuverture).toContain('présumée nulle');
        });
        it('second tour, B1 · l’ouverture annulée par un négatif du 15/03 · la mention nomme le négatif, sa date et la lecture en flux', async () => {
            const service = serviceAvecBalance([ligne('10130000', C1, 0, 1000), ligne('52110000', C5, 1000, 0)]);
            const ecritures = service.ecritureService;
            ecritures.positionDOuvertureAuPremierJour.mockResolvedValue({ etat: 'NULLE', negatifsTardifs: [{ piece: 'OD n° 2', date: new Date('2027-03-15') }] });
            const tft = await service.tableauFluxTresorerie('t1', 'e1');
            expect(tft.mentionOuverture).toContain('présumée nulle');
            expect(tft.mentionOuverture).toMatch(/annulée par son négatif inscrit plus tard \(OD n° 2 du 15\/03\/2027\).*flux de l'exercice.*AUDCIF art\. 34/);
            expect(ecritures.positionDOuvertureAuPremierJour).toHaveBeenCalledWith('t1', 'e1');
        });
        it('premier exercice dont l’ouverture est passée en OD au premier jour · ni flux ni ouverture, postes vides et motif', async () => {
            const lignes = [
                ligne('10130000', C1, 0, 2000),
                ligne('24510000', C2, 2100, 0),
                ligne('40110000', C4, 0, 300),
                ligne('52110000', C5, 200, 0),
            ];
            const service = serviceAvecBalance(lignes);
            const ecritures = service.ecritureService;
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
            expect({ coherent: tft.controle.coherent, ecart: tft.controle.ecart, zhFlux: tft.controle.tresorerieClotureParFlux }).toEqual({
                coherent: null,
                ecart: null,
                zhFlux: null,
            });
            expect(tft.controle.tresorerieClotureParBilan).toBe(200);
            expect(tft.controle.motifNonControlable).toContain('(ZH)');
        });
        it('relecture m2 · OD du premier jour derrière un exercice précédent au brouillard · il est dit, et l’issue de sa validation reste', async () => {
            const service = serviceAvecExercices({ e1: [], e2: [ligne('10130000', C1, 0, 2000), ligne('52110000', C5, 2000, 0)] }, EXERCICES);
            const ecritures = service.ecritureService;
            ecritures.ouverturePasseeAuPremierJour.mockResolvedValue({ nombre: 1, pieces: ['OD n° 1'] });
            ecritures.nombreAuBrouillard.mockResolvedValue(3);
            const tft = await service.tableauFluxTresorerie('t1', 'e2');
            expect(ecritures.ouverturePasseeAuPremierJour).toHaveBeenCalledWith('t1', 'e2');
            const attendu = (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)({ nombre: 1, pieces: ['OD n° 1'] }, 'SYSCOHADA', { auBrouillard: 3, clos: false });
            expect(tft.mentionOuverture).toBe(attendu);
            expect(tft.postesNonCalculables.find((p) => p.ref === 'ZA')?.raison).toBe(attendu);
            expect(attendu).not.toContain('sans exercice précédent');
            expect(attendu).toContain('validez-les (AUDCIF art. 22, 2°)');
        });
        it('un report tenu ou un exercice précédent · l’OD du premier jour n’est pas cherchée', async () => {
            const service = serviceAvecBalance([ligne('10130000', C1, 0, 0, { credit: 2000 }), ligne('52110000', C5, 0, 0, { debit: 2000 })]);
            await service.tableauFluxTresorerie('t1', 'e1');
            const ecritures = service.ecritureService;
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
            expect({
                za: montant(tft, 'ZA').montantN1,
                motifZa: tft.postesNonCalculablesN1.some((p) => p.ref === 'ZA'),
                zh: typeof montant(tft, 'ZH').montantN1,
            }).toEqual({ za: 0, motifZa: false, zh: 'number' });
        });
        it('liste les comptes de bilan mouvementés qu’aucun poste ne ventile', async () => {
            const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');
            expect(tft.comptesNonVentiles.map((c) => c.numero)).toEqual(['18600000', '18700000']);
            expect(tft.comptesNonVentiles.some((c) => c.numero === '52110000')).toBe(false);
            expect(tft.comptesNonVentiles.some((c) => c.numero === '41110000')).toBe(false);
            expect(tft.comptesNonVentiles.some((c) => c.numero === '28450000')).toBe(false);
        });
        it('nomme les comptes tenus sans la subdivision que le tableau lit', async () => {
            const tft = await serviceAvecBalance([
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
            expect(parNumero.has('48120000')).toBe(false);
            expect(parNumero.has('52110000')).toBe(false);
        });
        describe('lot 14 · l’écriture de réévaluation du module', () => {
            const e1 = [
                ligne('10130000', C1, 0, 5600),
                ligne('24110000', C2, 1000, 0),
                ligne('28410000', C2, 0, 400),
                ligne('52110000', C5, 5000, 0),
            ];
            const reports = (e) => e.map((l) => ligne(l.numero, l.classe, 0, 0, l.solde >= 0 ? { debit: l.solde } : { credit: -l.solde }));
            const ecriture = (...l) => new Map(l.map(([numero, debit, credit]) => [`id-${numero}`, { debit, credit }]));
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
                expect(tft.postesNonCalculables.filter((p) => p.ref === 'FH')).toEqual([]);
                const sansLiaison = await serviceAvecExercices({ e1: base, e2 }, EXERCICES).tableauFluxTresorerie('t1', 'e2');
                expect(montant(sansLiaison, 'FG').montant).toBe(400);
                expect(montant(sansLiaison, 'FH').montant).toBe(-400);
                expect(sansLiaison.postesNonCalculables.some((p) => p.ref === 'FH' && /HORS du module/.test(p.raison))).toBe(true);
            });
        });
        describe('constat N2 · la réserve de réévaluation sur FG', () => {
            const reserveReevaluation = (tft) => tft.postesNonCalculables.some((p) => p.ref === 'FG' && /Réévaluation passée HORS du module/.test(p.raison));
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
            expect((0, etats_financiers_syscohada_service_1.subdivisionsLuesParLeTft)('48100000')).toContain('4812');
            expect((0, etats_financiers_syscohada_service_1.subdivisionsLuesParLeTft)('481')).toContain('4812');
            expect((0, etats_financiers_syscohada_service_1.subdivisionsLuesParLeTft)('48120000')).not.toContain('4812');
            expect((0, etats_financiers_syscohada_service_1.subdivisionsLuesParLeTft)('24500000')).toEqual([]);
        });
        it('reproduit la maquette du modèle : rubriques intercalées, clés A à H, drill-down des postes', async () => {
            const tft = await serviceDeReference().tableauFluxTresorerie('t1', 'e2');
            expect(tft.lignes.some((l) => 'section' in l)).toBe(true);
            expect(montant(tft, 'ZA').repere).toBe('A');
            expect(montant(tft, 'ZH').repere).toBe('H');
            expect(montant(tft, 'ZH').estTotal).toBe(true);
            expect(montant(tft, 'FA').estTotal).toBe(false);
            expect(montant(tft, 'FD').comptes.map((c) => c.numero)).toEqual(['41110000']);
            expect(montant(tft, 'FD').comptes[0].montant).toBe(-1000);
        });
    });
    describe('refus et colonnes du modèle (audit final F217, F220, F222)', () => {
        it('ne sert ni Brut ni Amort. en N-1 · le modèle du ch. 3 n’imprime que le net de N-1 (F217)', async () => {
            for (const exercice of ['e1', 'e2']) {
                const bilan = await serviceDeReference().bilan('t1', exercice);
                for (const l of [...bilan.actif, ...bilan.passif]) {
                    expect({ ref: l.ref, cles: Object.keys(l).filter((k) => k === 'brutN1' || k === 'amortissementN1') }).toEqual({
                        ref: l.ref,
                        cles: [],
                    });
                }
            }
            const avecN1 = await serviceDeReference().bilan('t1', 'e2');
            expect(avecN1.actif.find((l) => l.ref === 'AN')?.montantN1).toBe(5000);
        });
        it.each(['xyz', '2026-02-30', '06/30/2026', '2026-6-30'])('refuse la date d’arrêté illisible « %s » par un 400, jamais un 500 ni un jour déplacé (F220)', async (date) => {
            const service = serviceAvecBalance([ligne('52110000', C5, 100, 0), ligne('10130000', C1, 0, 100)]);
            await expect(service.bilan('t1', 'e1', date)).rejects.toBeInstanceOf(common_1.BadRequestException);
            await expect(service.compteDeResultat('t1', 'e1', date)).rejects.toThrow('AAAA-MM-JJ');
            await expect(service.tableauFluxTresorerie('t1', 'e1', date)).rejects.toBeInstanceOf(common_1.BadRequestException);
        });
        it('lit une date bien formée à la FIN de ce jour, et pas un autre (F220)', () => {
            expect((0, etats_financiers_syscohada_service_1.lireDateArrete)('2026-06-30').toISOString()).toBe('2026-06-30T23:59:59.999Z');
            expect((0, etats_financiers_syscohada_service_1.lireDateArrete)('2024-02-29').toISOString()).toBe('2024-02-29T23:59:59.999Z');
        });
        it('refuse un exercice que le dossier ne connaît pas · 404, jamais des états à zéro « équilibrés » (F222)', async () => {
            const service = serviceDeReference();
            await expect(service.bilan('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
            await expect(service.compteDeResultat('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
            await expect(service.tableauFluxTresorerie('t1', 'inconnu')).rejects.toBeInstanceOf(common_1.NotFoundException);
            await expect(service.bilan('t1', 'inconnu', '2026-06-30')).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
    });
});
//# sourceMappingURL=etats-financiers-syscohada.service.spec.js.map