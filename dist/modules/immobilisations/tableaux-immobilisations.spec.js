"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const EXERCICE = { id: 'ex2025', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') };
function exerciceDuDossier() {
    return {
        findFirst: jest.fn(({ where }) => Promise.resolve(where.id === EXERCICE.id && where.tenantId === 'tn' ? EXERCICE : null)),
    };
}
function bien(opts) {
    return {
        id: opts.id,
        designation: opts.designation,
        numeroInventaire: null,
        compteImmobilisation: opts.compte ?? { id: 'c221499', numero: '221499', intitule: "Matériel d'exploitation" },
        dateAcquisition: new Date(opts.dateAcquisition),
        dateMiseEnService: new Date(opts.dateMiseEnService ?? opts.dateAcquisition),
        valeurOrigine: opts.valeurOrigine,
        valeurResiduelle: 0,
        dureeAmortissementAns: opts.dureeAns,
        amortissementAnterieur: opts.amortissementAnterieur ?? 0,
        statut: 'EN_SERVICE',
        dateSortie: opts.dateSortie ? new Date(opts.dateSortie) : null,
        dotations: (opts.dotations ?? []).map((d) => ({
            montant: d.montant,
            exerciceId: d.exerciceId,
            exercice: { dateFin: new Date(d.dateFin) },
        })),
        depreciations: (opts.depreciations ?? []).map((d) => ({
            sens: d.sens,
            montant: d.montant,
            exercice: { dateFin: new Date(d.dateFin) },
        })),
    };
}
function service(biens) {
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
            }),
        },
        immobilisation: { findMany: jest.fn().mockResolvedValue(biens) },
        exercice: exerciceDuDossier(),
    };
    return new immobilisation_service_1.ImmobilisationService(prisma, {});
}
describe('tableau des immobilisations · les biens sortis (audit final F31)', () => {
    const PARC = [
        bien({ id: 'a', designation: 'Concasseur', valeurOrigine: 100_000, dureeAns: 5, dateAcquisition: '2020-01-01' }),
        bien({
            id: 'b',
            designation: 'Camion cédé',
            valeurOrigine: 60_000,
            dureeAns: 5,
            dateAcquisition: '2021-01-01',
            dateSortie: '2025-06-30',
        }),
    ];
    it('un bien sorti à la date d’arrêté est présenté à part, HORS des totaux', async () => {
        const t = await service(PARC).tableauImmobilisations('tn', { dateArret: '2025-12-31' });
        expect(t.groupes.flatMap((g) => g.lignes.map((l) => l.id))).toEqual(['a']);
        expect(t.totaux.brut).toBe(100_000);
        expect(t.sortis.map((l) => [l.id, l.compte, l.dateSortie])).toEqual([['b', '221499', '2025-06-30']]);
    });
    it('un bien sorti APRÈS la date d’arrêté y était encore détenu · il reste dans son groupe', async () => {
        const t = await service(PARC).tableauImmobilisations('tn', { dateArret: '2025-03-31' });
        expect(t.totaux.brut).toBe(160_000);
        expect(t.sortis).toEqual([]);
    });
    it('sans date d’arrêté, tout bien sorti est à part', async () => {
        const t = await service(PARC).tableauImmobilisations('tn');
        expect(t.totaux.brut).toBe(100_000);
        expect(t.sortis.map((l) => l.id)).toEqual(['b']);
    });
});
describe('tableau des immobilisations', () => {
    it('groupe par compte d’imputation, avec sous-total · c’est lui qui recoupe la balance', async () => {
        const s = service([
            bien({ id: 'a', designation: 'Concasseur', valeurOrigine: 100_000, dureeAns: 5, dateAcquisition: '2020-01-01' }),
            bien({
                id: 'b',
                designation: 'Jeep',
                compte: { id: 'c221198', numero: '221198', intitule: 'Matériel roulant' },
                valeurOrigine: 30_000,
                dureeAns: 3,
                dateAcquisition: '2023-01-01',
            }),
        ]);
        const t = await s.tableauImmobilisations('tn');
        expect(t.groupes.map((g) => g.numero)).toEqual(['221198', '221499']);
        expect(t.groupes.find((g) => g.numero === '221499').brut).toBe(100_000);
        expect(t.totaux.brut).toBe(130_000);
    });
    it('compte l’AMORTISSEMENT ANTÉRIEUR dans le cumul', async () => {
        const s = service([
            bien({
                id: 'a',
                designation: 'Pont bascule repris',
                valeurOrigine: 100_000,
                dureeAns: 5,
                dateAcquisition: '2018-01-01',
                amortissementAnterieur: 80_000,
            }),
        ]);
        const t = await s.tableauImmobilisations('tn');
        expect(t.totaux.amortissements).toBe(80_000);
        expect(t.totaux.net).toBe(20_000);
    });
    it('écarte les dotations POSTÉRIEURES à la date d’arrêté', async () => {
        const s = service([
            bien({
                id: 'a',
                designation: 'Crible',
                valeurOrigine: 60_000,
                dureeAns: 5,
                dateAcquisition: '2023-01-01',
                dotations: [
                    { montant: 12_000, exerciceId: 'ex2023', dateFin: '2023-12-31' },
                    { montant: 12_000, exerciceId: 'ex2025', dateFin: '2025-12-31' },
                ],
            }),
        ]);
        const t = await s.tableauImmobilisations('tn', { dateArret: '2025-09-30' });
        expect(t.totaux.amortissements).toBe(12_000);
    });
});
describe('tableau des amortissements · douze colonnes', () => {
    it('ouvre une colonne par mois de l’exercice', async () => {
        const t = await service([]).tableauAmortissements('tn', 'ex2025');
        expect(t.mois).toHaveLength(12);
        expect(t.mois[0].libelle).toBe('Janv.');
        expect(t.mois[11].libelle).toBe('Déc.');
    });
    it('somme des douze colonnes = dotation, AU CENTIME', async () => {
        const s = service([
            bien({
                id: 'a',
                designation: 'Bien à annuité indivisible',
                valeurOrigine: 10_000,
                dureeAns: 3,
                dateAcquisition: '2023-01-01',
                dotations: [{ montant: 3_333.33, exerciceId: 'ex2023', dateFin: '2023-12-31' }],
            }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        const ligne = t.groupes[0].lignes[0];
        const somme = Math.round(ligne.parMois.reduce((a, b) => a + b, 0) * 100) / 100;
        expect(somme).toBe(ligne.dotation);
    });
    it('un bien que le plan ne fait pas amortir n’annonce aucune annuité (passe R1, A1)', async () => {
        const s = service([
            bien({
                id: 't',
                designation: 'Terrain à bâtir',
                compte: { id: 'c2221', numero: '22210000', intitule: 'Terrains à bâtir' },
                valeurOrigine: 50_000_000,
                dureeAns: 20,
                dateAcquisition: '2024-01-01',
            }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        expect(t.groupes[0].lignes[0].dotation).toBe(0);
    });
    it('ne sert que les mois où le bien est en service · entrée en cours d’exercice', async () => {
        const s = service([
            bien({
                id: 'a',
                designation: 'Acquis en juin',
                valeurOrigine: 12_000,
                dureeAns: 5,
                dateAcquisition: '2025-06-15',
            }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        const l = t.groupes[0].lignes[0];
        expect(l.parMois.slice(0, 5).every((m) => m === 0)).toBe(true);
        expect(l.parMois.slice(5).every((m) => m > 0)).toBe(true);
    });
    it('s’arrête au mois de SORTIE', async () => {
        const s = service([
            bien({
                id: 'a',
                designation: 'Cédé en septembre',
                valeurOrigine: 12_000,
                dureeAns: 5,
                dateAcquisition: '2022-01-01',
                dateSortie: '2025-09-20',
                dotations: [
                    { montant: 2_400, exerciceId: 'ex2023', dateFin: '2023-12-31' },
                    { montant: 1_800, exerciceId: 'ex2025', dateFin: '2025-12-31' },
                ],
            }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        const l = t.groupes[0].lignes[0];
        expect(l.parMois.slice(9).every((m) => m === 0)).toBe(true);
        expect(l.parMois[8]).toBeGreaterThan(0);
        expect(l.dotation).toBe(1_800);
        expect(l.sortiLe).toBe('2025-09-20');
    });
    it('un bien sorti dans l’exercice ne porte que la dotation PASSÉE, jamais un calcul (audit final F30)', async () => {
        const s = service([
            bien({
                id: 'a',
                designation: 'Cédé sans complément',
                valeurOrigine: 12_000,
                dureeAns: 5,
                dateAcquisition: '2022-01-01',
                dateSortie: '2025-06-30',
                dotations: [{ montant: 2_400, exerciceId: 'ex2024', dateFin: '2024-12-31' }],
            }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        const l = t.groupes[0].lignes[0];
        expect({ dotation: l.dotation, passee: l.dotationPassee, sortiLe: l.sortiLe }).toEqual({
            dotation: 0,
            passee: true,
            sortiLe: '2025-06-30',
        });
    });
    it('un bien sorti AVANT l’exercice n’est pas lu · la requête l’écarte (audit final F30)', async () => {
        const findMany = jest.fn().mockResolvedValue([]);
        const s = new immobilisation_service_1.ImmobilisationService({
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL }) },
            immobilisation: { findMany },
            exercice: exerciceDuDossier(),
        }, {});
        await s.tableauAmortissements('tn', 'ex2025');
        expect(findMany.mock.calls[0][0].where.OR).toEqual([
            { dateSortie: null },
            { dateSortie: { gte: EXERCICE.dateDebut } },
        ]);
    });
    it('retient la dotation COMPTABILISÉE plutôt que de la recalculer', async () => {
        const s = service([
            bien({
                id: 'a',
                designation: 'Bien doté à la main',
                valeurOrigine: 12_000,
                dureeAns: 5,
                dateAcquisition: '2022-01-01',
                dotations: [{ montant: 999.99, exerciceId: 'ex2025', dateFin: '2025-12-31' }],
            }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        const l = t.groupes[0].lignes[0];
        expect(l.dotation).toBe(999.99);
        expect(l.dotationPassee).toBe(true);
    });
    it('marque « à passer » une dotation seulement calculée', async () => {
        const s = service([
            bien({ id: 'a', designation: 'Non doté', valeurOrigine: 12_000, dureeAns: 5, dateAcquisition: '2022-01-01' }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        expect(t.groupes[0].lignes[0].dotationPassee).toBe(false);
    });
    it('porte le TAUX, pas seulement la durée', async () => {
        const s = service([
            bien({ id: 'a', designation: 'Bien', valeurOrigine: 12_000, dureeAns: 3, dateAcquisition: '2022-01-01' }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        expect(t.groupes[0].lignes[0].taux).toBe(33.33);
    });
    it('totalise mois par mois, pas seulement en fin de ligne', async () => {
        const s = service([
            bien({ id: 'a', designation: 'A', valeurOrigine: 12_000, dureeAns: 1, dateAcquisition: '2025-01-01' }),
            bien({ id: 'b', designation: 'B', valeurOrigine: 24_000, dureeAns: 1, dateAcquisition: '2025-01-01' }),
        ]);
        const t = await s.tableauAmortissements('tn', 'ex2025');
        expect(t.totaux.parMois).toHaveLength(12);
        expect(Math.round(t.totaux.parMois.reduce((a, b) => a + b, 0) * 100) / 100).toBe(t.totaux.dotation);
        expect(t.totaux.dotation).toBe(36_000);
    });
});
describe('les deux tableaux retranchent les dépréciations de la valeur nette (audit final F131)', () => {
    const DEPRECIE = () => bien({
        id: 'a',
        designation: 'Concasseur déprécié',
        valeurOrigine: 100_000,
        dureeAns: 5,
        dateAcquisition: '2024-01-01',
        dotations: [
            { montant: 20_000, exerciceId: 'ex2024', dateFin: '2024-12-31' },
            { montant: 17_500, exerciceId: 'ex2025', dateFin: '2025-12-31' },
        ],
        depreciations: [
            { sens: client_1.SensDepreciation.DOTATION, montant: 10_000, dateFin: '2024-12-31' },
            { sens: client_1.SensDepreciation.REPRISE, montant: 3_000, dateFin: '2025-12-31' },
        ],
    });
    it('tableau des immobilisations · brut − amortissements − dépréciations, comme la balance', async () => {
        const t = await service([DEPRECIE()]).tableauImmobilisations('tn', { dateArret: '2025-12-31' });
        const l = t.groupes[0].lignes[0];
        expect({ dep: l.depreciations, net: l.valeurNette }).toEqual({ dep: 7_000, net: 55_500 });
        expect(t.groupes[0].depreciations).toBe(7_000);
        expect(t.totaux).toMatchObject({ depreciations: 7_000, net: 55_500 });
    });
    it('tableau des immobilisations · une reprise postérieure à la date d’arrêté n’y est pas encore', async () => {
        const t = await service([DEPRECIE()]).tableauImmobilisations('tn', { dateArret: '2024-12-31' });
        const l = t.groupes[0].lignes[0];
        expect({ amort: l.amortissements, dep: l.depreciations, net: l.valeurNette }).toEqual({
            amort: 20_000,
            dep: 10_000,
            net: 70_000,
        });
    });
    it('tableau des amortissements · la valeur nette de clôture retranche les 29 de l’exercice compris', async () => {
        const t = await service([DEPRECIE()]).tableauAmortissements('tn', 'ex2025');
        const l = t.groupes[0].lignes[0];
        expect({ cumulN: l.cumulN, dep: l.depreciations, net: l.valeurNette }).toEqual({
            cumulN: 37_500,
            dep: 7_000,
            net: 55_500,
        });
        expect(t.totaux).toMatchObject({ depreciations: 7_000, net: 55_500 });
    });
});
//# sourceMappingURL=tableaux-immobilisations.spec.js.map