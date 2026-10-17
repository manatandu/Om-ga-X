"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ecriture_service_1 = require("./ecriture.service");
function ligneEcriture(compte, debit, credit, echeance, date) {
    return {
        debit,
        credit,
        dateEcheance: echeance ? new Date(echeance) : null,
        compte: { id: `c-${compte}`, numero: compte, intitule: `Compte ${compte}` },
        ecriture: { date: new Date(date) },
    };
}
function service(lignes, rattachements = []) {
    const prisma = {
        exercice: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.id === 'ex' && where.tenantId === 't'
                ? { dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }
                : null)),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        tiersCompte: { findMany: jest.fn().mockResolvedValue(rattachements) },
    };
    return new ecriture_service_1.EcritureService(prisma, {}, {}, {});
}
const AU_31_12 = { exerciceId: 'ex', dateReference: '2025-12-31' };
describe('balance âgée · découpage des tranches', () => {
    it('ouvre sept tranches sur un exercice civil entier', async () => {
        const r = await service([]).balanceAgee('t', AU_31_12);
        expect(r.tranches.map((t) => t.cle)).toEqual([
            'ouverture',
            'ancien',
            '2025-08',
            '2025-09',
            '2025-10',
            '2025-11',
            '2025-12',
        ]);
        expect(r.tranches[1].libelleAge).toBe('180 jours et plus');
        expect(r.tranches[6].libelleAge).toBe('Moins de 30 jours');
        expect(r.tranches[6].libellePeriode).toBe('Du 01/12/2025 au 31/12/2025');
    });
    it('range chaque échéance dans SA tranche, bornes comprises', async () => {
        const r = await service([
            ligneEcriture('411001', 100, 0, '2024-12-31', '2025-01-05'),
            ligneEcriture('411001', 200, 0, '2025-07-31', '2025-07-31'),
            ligneEcriture('411001', 400, 0, '2025-08-01', '2025-08-01'),
            ligneEcriture('411001', 800, 0, '2025-11-30', '2025-11-30'),
            ligneEcriture('411001', 1600, 0, '2025-12-01', '2025-12-01'),
        ]).balanceAgee('t', AU_31_12);
        expect(r.debiteurs).toHaveLength(1);
        expect(r.debiteurs[0].montants).toEqual([100, 200, 400, 0, 0, 800, 1600]);
        expect(r.debiteurs[0].solde).toBe(3100);
    });
    it('reprend la date d’écriture quand l’échéance n’est pas saisie', async () => {
        const r = await service([ligneEcriture('411001', 500, 0, null, '2025-09-15')]).balanceAgee('t', AU_31_12);
        expect(r.debiteurs[0].montants[3]).toBe(500);
    });
    it('réunit sur UNE ligne les deux comptes d’un même tiers', async () => {
        const r = await service([
            ligneEcriture('411001', 300, 0, '2025-12-10', '2025-12-10'),
            ligneEcriture('416001', 700, 0, '2025-03-10', '2025-03-10'),
        ], [
            { compteId: 'c-411001', tiers: { id: 'T1', code: '410038', nom: 'CREC 8' } },
            { compteId: 'c-416001', tiers: { id: 'T1', code: '410038', nom: 'CREC 8' } },
        ]).balanceAgee('t', AU_31_12);
        expect(r.debiteurs).toHaveLength(1);
        expect(r.debiteurs[0].libelle).toBe('410038 - CREC 8');
        expect(r.debiteurs[0].solde).toBe(1000);
    });
    it('sépare les soldes de sens contraire, sans les ventiler', async () => {
        const r = await service([
            ligneEcriture('411001', 1000, 0, '2025-12-10', '2025-12-10'),
            ligneEcriture('411002', 0, 400, '2025-12-10', '2025-12-10'),
        ]).balanceAgee('t', AU_31_12);
        expect(r.debiteurs).toHaveLength(1);
        expect(r.crediteurs).toHaveLength(0);
        expect(r.sensInverse).toHaveLength(1);
        expect(r.sensInverse[0].montants).toEqual([]);
        expect(r.totaux.debiteurs).toBe(1000);
        expect(r.totaux.crediteurs).toBe(0);
        expect(r.totaux.sensInverse).toBe(-400);
        expect(r.totaux.net).toBe(600);
        expect(r.totaux.parTranche[6]).toBe(1000);
    });
    it('compense une correction en négatif dans la tranche d’origine', async () => {
        const r = await service([
            ligneEcriture('411001', 900, 0, '2025-10-05', '2025-10-05'),
            ligneEcriture('411001', 0, 900, '2025-10-05', '2025-10-06'),
            ligneEcriture('411001', 250, 0, '2025-10-05', '2025-10-06'),
        ]).balanceAgee('t', AU_31_12);
        expect(r.debiteurs[0].montants[4]).toBe(250);
        expect(r.debiteurs[0].solde).toBe(250);
    });
    it('n’ouvre pas de bloc « reste de l’exercice » quand la fenêtre le couvre', async () => {
        const r = await service([]).balanceAgee('t', { exerciceId: 'ex', dateReference: '2025-03-31' });
        expect(r.tranches.map((t) => t.cle)).not.toContain('ancien');
        expect(r.tranches).toHaveLength(6);
    });
    it('borne une date de référence postérieure à la clôture', async () => {
        const r = await service([]).balanceAgee('t', { exerciceId: 'ex', dateReference: '2026-06-30' });
        expect(r.dateReference).toBe('2025-12-31');
    });
});
describe('balance âgée · les périmètres et ce que l’antériorité y signifie', () => {
    const requete = async (type, lignes = []) => {
        const s = service(lignes);
        const r = await s.balanceAgee('t', { ...AU_31_12, type });
        return r;
    };
    it('TOUS reste le crédit commercial · 40 et 41, et rien d’autre', () => {
        expect(ecriture_service_1.PERIMETRES_BALANCE_AGEE.TOUS.racines).toEqual(['40', '41']);
        expect(ecriture_service_1.PERIMETRES_BALANCE_AGEE.TOUS.exclusions).toEqual([]);
    });
    it('les comptes de TVA sont ÉCARTÉS du 44 · une liquidation périodique n’a pas d’antériorité', () => {
        expect(ecriture_service_1.PERIMETRES_BALANCE_AGEE.ETAT_44.exclusions).toEqual(['443', '444', '445', '446']);
        expect(ecriture_service_1.PERIMETRES_BALANCE_AGEE.ETAT_44.racines).toEqual(['44']);
    });
    it('l’exclusion atteint bien la requête · le filtre NOT porte les quatre racines', async () => {
        const s = service([]);
        await s.balanceAgee('t', { ...AU_31_12, type: 'ETAT_44' });
        const where = s.prisma.ligneEcriture
            .findMany.mock.calls[0][0].where;
        expect(where.NOT).toEqual([
            { compte: { numero: { startsWith: '443' } } },
            { compte: { numero: { startsWith: '444' } } },
            { compte: { numero: { startsWith: '445' } } },
            { compte: { numero: { startsWith: '446' } } },
        ]);
    });
    it('un périmètre sans exclusion ne pose AUCUN filtre NOT · sinon Prisma exclurait tout', async () => {
        const s = service([]);
        await s.balanceAgee('t', { ...AU_31_12, type: 'PERSONNEL_42' });
        const where = s.prisma.ligneEcriture
            .findMany.mock.calls[0][0].where;
        expect(where.NOT).toBeUndefined();
    });
    it('chaque périmètre porte sa lecture, et les quatre nouveaux disent qu’il n’y a pas de crédit commercial', () => {
        for (const cle of Object.keys(ecriture_service_1.PERIMETRES_BALANCE_AGEE)) {
            const p = ecriture_service_1.PERIMETRES_BALANCE_AGEE[cle];
            expect(p.lecture.length).toBeGreaterThan(60);
            expect(p.libelle.length).toBeGreaterThan(5);
        }
        for (const cle of ['PERSONNEL_42', 'SOCIAL_43', 'ETAT_44']) {
            expect(ecriture_service_1.PERIMETRES_BALANCE_AGEE[cle].lecture).toContain('AUCUN CRÉDIT COMMERCIAL');
        }
        expect(ecriture_service_1.PERIMETRES_BALANCE_AGEE.DIVERS_47.lecture).not.toContain('AUCUN CRÉDIT COMMERCIAL');
        expect(ecriture_service_1.PERIMETRES_BALANCE_AGEE.DIVERS_47.lecture).toContain('EN INSTANCE DE RÉGULARISATION');
    });
    it('la lecture voyage avec l’état · sans elle le même tableau se lit de travers', async () => {
        const r = await requete('SOCIAL_43');
        expect(r.type).toBe('SOCIAL_43');
        expect(r.lecture).toContain('échéance légale');
        expect(r.libellePerimetre).toContain('43');
    });
    it('les sept périmètres sont couverts · un huitième ajouté sans sa lecture fait tomber ce test', () => {
        expect(Object.keys(ecriture_service_1.PERIMETRES_BALANCE_AGEE).sort()).toEqual(['CLIENTS_41', 'DIVERS_47', 'ETAT_44', 'FOURNISSEURS', 'PERSONNEL_42', 'SOCIAL_43', 'TOUS'].sort());
    });
    it('chaque périmètre déclare son sens normal', () => {
        expect(Object.fromEntries(Object.entries(ecriture_service_1.PERIMETRES_BALANCE_AGEE).map(([k, p]) => [k, p.sensNormal]))).toEqual({
            TOUS: 'SELON_LE_COMPTE',
            CLIENTS_41: 'DEBITEUR',
            FOURNISSEURS: 'CREDITEUR',
            PERSONNEL_42: 'LES_DEUX',
            SOCIAL_43: 'LES_DEUX',
            ETAT_44: 'LES_DEUX',
            DIVERS_47: 'LES_DEUX',
        });
    });
    it('la dette fournisseur se VENTILE dans la colonne de son échéance · un retard de paiement', async () => {
        const r = await requete('FOURNISSEURS', [
            ligneEcriture('401001', 0, 2_320_000, '2025-10-05', '2025-09-05'),
            ligneEcriture('401002', 150_000, 0, '2025-11-20', '2025-11-20'),
        ]);
        expect(r.crediteurs).toHaveLength(1);
        expect(r.crediteurs[0].solde).toBe(-2_320_000);
        expect(r.crediteurs[0].montants[r.tranches.findIndex((t) => t.cle === '2025-10')]).toBe(-2_320_000);
        expect(r.totaux.parTrancheCrediteurs[r.tranches.findIndex((t) => t.cle === '2025-10')]).toBe(-2_320_000);
        expect(r.totaux.crediteurs).toBe(-2_320_000);
        expect(r.debiteurs).toHaveLength(0);
        expect(r.sensInverse.map((l) => l.solde)).toEqual([150_000]);
        expect(r.sensInverse[0].montants).toEqual([]);
        expect(r.totaux.net).toBe(-2_170_000);
    });
    it('« 40 et 41 » lit le sens sur le compte de la ligne', async () => {
        const r = await requete('TOUS', [
            ligneEcriture('411001', 1_000, 0, '2025-12-10', '2025-12-10'),
            ligneEcriture('401001', 0, 700, '2025-11-10', '2025-11-10'),
            ligneEcriture('401002', 50, 0, '2025-11-10', '2025-11-10'),
            ligneEcriture('411002', 0, 30, '2025-12-10', '2025-12-10'),
        ]);
        expect(r.debiteurs.map((l) => l.numero)).toEqual(['411001']);
        expect(r.crediteurs.map((l) => l.numero)).toEqual(['401001']);
        expect(r.sensInverse.map((l) => l.numero)).toEqual(['401002', '411002']);
        expect(r.totaux.net).toBe(1_000 - 700 + 50 - 30);
    });
    it('les dettes sociales et les produits à recevoir du 43 se ventilent tous deux', async () => {
        const r = await requete('SOCIAL_43', [
            ligneEcriture('431100', 0, 900_000, '2025-09-15', '2025-08-31'),
            ligneEcriture('438700', 40_000, 0, '2025-12-31', '2025-12-31'),
        ]);
        expect(r.crediteurs[0].montants[r.tranches.findIndex((t) => t.cle === '2025-09')]).toBe(-900_000);
        expect(r.debiteurs[0].montants[6]).toBe(40_000);
        expect(r.sensInverse).toHaveLength(0);
    });
    it('un solde nul n’est en aucun sens · rendu à part, hors des totaux (B3)', async () => {
        const r = await requete('CLIENTS_41', [
            ligneEcriture('411003', 1_000_000, 0, '2025-03-10', '2025-03-10'),
            ligneEcriture('411003', 0, 1_000_000, '2025-10-10', '2025-10-10'),
            ligneEcriture('411004', 500_000, 0, '2025-11-10', '2025-11-10'),
        ]);
        expect(r.sensInverse).toHaveLength(0);
        expect(r.totaux.sensInverse).toBe(0);
        expect(r.soldesNuls.map((l) => l.numero)).toEqual(['411003']);
        expect(r.soldesNuls[0]).toMatchObject({ solde: 0, montants: [] });
        expect(r.debiteurs.map((l) => l.numero)).toEqual(['411004']);
        expect(r.totaux.debiteurs).toBe(500_000);
        expect(r.totaux.net).toBe(500_000);
        expect(r.totaux.parTranche.reduce((t, m) => t + m, 0)).toBe(500_000);
    });
    it('un solde nul n’est en aucun sens non plus sous « 40 et 41 » ni pour un fournisseur (B3)', async () => {
        for (const type of ['TOUS', 'FOURNISSEURS']) {
            const r = await requete(type, [
                ligneEcriture('401005', 0, 300_000, '2025-04-10', '2025-04-10'),
                ligneEcriture('401005', 300_000, 0, '2025-09-10', '2025-09-10'),
            ]);
            expect(r.sensInverse).toHaveLength(0);
            expect(r.crediteurs).toHaveLength(0);
            expect(r.soldesNuls.map((l) => l.numero)).toEqual(['401005']);
            expect(r.totaux.net).toBe(0);
        }
    });
    it('deux pièces ouvertes qui se compensent dans la même tranche restent rendues avec les soldes nuls (mineur 5)', async () => {
        const r = await requete('CLIENTS_41', [
            ligneEcriture('411055', 500_000, 0, '2025-12-05', '2025-12-02'),
            ligneEcriture('411055', 0, 500_000, '2025-12-20', '2025-12-20'),
            ligneEcriture('411056', 300_000, 0, '2025-12-28', '2025-12-28'),
        ]);
        expect(r.soldesNuls.map((l) => l.numero)).toEqual(['411055']);
        expect(r.debiteurs.map((l) => l.numero)).toEqual(['411056']);
        expect(r.totaux.net).toBe(300_000);
    });
    it('une seule pièce, au net nul par son poids, ne fait pas de ligne', async () => {
        const r = await requete('CLIENTS_41', [ligneEcriture('411057', 0, 0, '2025-12-05', '2025-12-05')]);
        expect(r.soldesNuls).toHaveLength(0);
        expect(r.debiteurs).toHaveLength(0);
    });
    it('un solde nul ne se ventile jamais, quel que soit le périmètre', () => {
        for (const sens of ['DEBITEUR', 'CREDITEUR', 'LES_DEUX', 'SELON_LE_COMPTE']) {
            expect((0, ecriture_service_1.ligneVentilee)(sens, ['401001'], 0)).toBe(false);
            expect((0, ecriture_service_1.ligneVentilee)(sens, ['411001'], 0.004)).toBe(false);
        }
        expect((0, ecriture_service_1.ligneVentilee)('SELON_LE_COMPTE', ['401001'], -1)).toBe(true);
        expect((0, ecriture_service_1.ligneVentilee)('SELON_LE_COMPTE', ['411001'], -1)).toBe(false);
    });
    it('un tiers à la fois fournisseur et client se lit sur TOUS ses comptes, quel que soit l’ordre de lecture', async () => {
        const rattachements = [
            { compteId: 'c-401009', tiers: { id: 'T9', code: 'X9', nom: 'Mixte' } },
            { compteId: 'c-411009', tiers: { id: 'T9', code: 'X9', nom: 'Mixte' } },
        ];
        const lignes = [
            ligneEcriture('411009', 100, 0, '2025-12-10', '2025-12-10'),
            ligneEcriture('401009', 0, 600, '2025-11-10', '2025-11-10'),
        ];
        for (const ordre of [lignes, [...lignes].reverse()]) {
            const r = await service(ordre, rattachements).balanceAgee('t', { ...AU_31_12, type: 'TOUS' });
            expect(r.crediteurs.map((l) => [l.libelle, l.numero, l.solde])).toEqual([['X9 - Mixte', '401009', -500]]);
            expect(r.sensInverse).toHaveLength(0);
        }
    });
    it('le calcul des tranches est le même dans tous les périmètres · seule la source change', async () => {
        const lignes = [ligneEcriture('421001', 500, 0, '2024-06-30', '2025-01-05')];
        const r = await requete('PERSONNEL_42', lignes);
        expect(r.debiteurs).toHaveLength(1);
        expect(r.debiteurs[0].montants[0]).toBe(500);
    });
});
//# sourceMappingURL=balance-agee-tranches.spec.js.map