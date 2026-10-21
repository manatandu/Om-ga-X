"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const ligne = (numero, intitule, debit, credit = 0, exerciceId = 'ex', soldeDeGestion = false) => ({
    debit,
    credit,
    compte: { numero, intitule },
    ecriture: { exerciceId },
    soldeDeGestion,
});
function service(lignes, referentiel) {
    const courant = { id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
    const precedent = { id: 'exN1', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') };
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockImplementation((args) => args?.where?.dateFin?.lt ? Promise.resolve(precedent) : Promise.resolve(courant)),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: {
            findMany: jest.fn(async (args) => lignes.filter((l) => !(l.soldeDeGestion && args?.where?.ecriture?.estSoldeDesComptesDeGestion === false))),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const trouver = async (code, lignes, referentiel = client_1.Referentiel.SYSCOHADA) => {
    const rapport = await service(lignes, referentiel).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === code);
};
const stockEnRouteBoucle = (racine) => [
    ligne(`${racine}100000`, 'Marchandises en cours de route', 5_000_000),
    ligne('60310000', 'Variations des stocks de marchandises', 0, 5_000_000),
];
describe('dépréciation de stocks · la nomenclature est fermée, et pas la même', () => {
    it('accepte le 398 en SYSCOHADA', async () => {
        const a = await trouver('DEPRECIATION_STOCK_HORS_NOMENCLATURE', [
            ...stockEnRouteBoucle('38'),
            ligne('39800000', 'Dépréciations des stocks en cours de route', 0, 400_000),
        ]);
        expect(a).toBeUndefined();
    });
    it('refuse le 398 en SYCEBNL, dont le plan ne l’ouvre pas', async () => {
        const a = await trouver('DEPRECIATION_STOCK_HORS_NOMENCLATURE', [
            ...stockEnRouteBoucle('37'),
            ligne('39800000', 'Dépréciations des stocks en cours de route', 0, 400_000),
        ], client_1.Referentiel.SYCEBNL);
        expect(a).toBeDefined();
        expect(a.occurrences[0].reference).toBe('39800000');
        expect(a.consequence).toContain('391, 392, 393, 396, 397');
    });
    it('refuse le 394 et le 395 en SYCEBNL, absents de son compte 39', async () => {
        for (const numero of ['39400000', '39500000']) {
            const a = await trouver('DEPRECIATION_STOCK_HORS_NOMENCLATURE', [...stockEnRouteBoucle('37'), ligne(numero, 'Dépréciation', 0, 100_000)], client_1.Referentiel.SYCEBNL);
            expect({ numero, signale: Boolean(a) }).toEqual({ numero, signale: true });
        }
    });
    it('les accepte en SYSCOHADA, qui les ouvre', async () => {
        for (const numero of ['39400000', '39500000']) {
            const a = await trouver('DEPRECIATION_STOCK_HORS_NOMENCLATURE', [
                ...stockEnRouteBoucle('38'),
                ligne(numero, 'Dépréciation', 0, 100_000),
                ligne('34100000', 'Produits en cours', 900_000),
                ligne('35100000', 'Services en cours', 900_000),
            ]);
            expect({ numero, signale: Boolean(a) }).toEqual({ numero, signale: false });
        }
    });
});
describe('une dépréciation sans le poste qu’elle déduit', () => {
    it('signale un 391 créditeur quand le 31 est à zéro', async () => {
        const a = await trouver('DEPRECIATION_STOCK_SANS_STOCK', [
            ...stockEnRouteBoucle('38'),
            ligne('39100000', 'Dépréciations des stocks de marchandises', 0, 750_000),
        ]);
        expect(a).toBeDefined();
        expect(a.occurrences[0].montant).toBe(750_000);
        expect(a.occurrences[0].detail).toContain('31');
        expect(a.consequence).toContain('DÉDUCTION');
    });
    it('se tait dès que le stock adossé porte un solde', async () => {
        const a = await trouver('DEPRECIATION_STOCK_SANS_STOCK', [
            ...stockEnRouteBoucle('38'),
            ligne('31100000', 'Marchandises', 12_000_000),
            ligne('39100000', 'Dépréciations des stocks de marchandises', 0, 750_000),
        ]);
        expect(a).toBeUndefined();
    });
    it('rapproche 39X de 3X, et le fait des deux côtés malgré le sens différent du 397', async () => {
        for (const referentiel of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            const racine = referentiel === client_1.Referentiel.SYSCOHADA ? '38' : '37';
            const a = await trouver('DEPRECIATION_STOCK_SANS_STOCK', [...stockEnRouteBoucle(racine), ligne('39700000', 'Dépréciation', 0, 300_000)], referentiel);
            expect({ referentiel, signale: Boolean(a) }).toEqual({
                referentiel,
                signale: referentiel === client_1.Referentiel.SYSCOHADA,
            });
        }
    });
    it('ne signale pas une dépréciation débitrice · c’est une reprise', async () => {
        const a = await trouver('DEPRECIATION_STOCK_SANS_STOCK', [
            ...stockEnRouteBoucle('38'),
            ligne('39100000', 'Dépréciations des stocks de marchandises', 750_000),
        ]);
        expect(a).toBeUndefined();
    });
});
describe('stock en cours de route sans variation de stock', () => {
    it('signale le 38 en SYSCOHADA quand aucun 603 n’a bougé', async () => {
        const a = await trouver('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION', [
            ligne('38100000', 'Marchandises en cours de route', 5_000_000),
        ]);
        expect(a).toBeDefined();
        expect(a.occurrences[0].montant).toBe(5_000_000);
        expect(a.occurrences[0].reference).toMatch(/^38 /);
    });
    it('signale le 37 en SYCEBNL, et jamais le 38, qui y porte les dons en nature H.A.O.', async () => {
        const surLe37 = await trouver('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION', [ligne('37100000', 'Biens liés à l’activité en cours de route', 5_000_000)], client_1.Referentiel.SYCEBNL);
        expect(surLe37).toBeDefined();
        expect(surLe37.occurrences[0].reference).toMatch(/^37 /);
        const surLe38 = await trouver('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION', [ligne('38100000', 'Dons en nature HAO non affectés', 5_000_000)], client_1.Referentiel.SYCEBNL);
        expect(surLe38).toBeUndefined();
    });
    it('ne signale pas le 37 en SYSCOHADA, qui y porte les produits intermédiaires', async () => {
        const a = await trouver('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION', [
            ligne('37100000', 'Produits intermédiaires', 5_000_000),
        ]);
        expect(a).toBeUndefined();
    });
    it('se tait dès qu’une variation de stock a été passée', async () => {
        const a = await trouver('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION', stockEnRouteBoucle('38'));
        expect(a).toBeUndefined();
    });
});
describe('production immobilisée sans immobilisation', () => {
    it('signale un 72 crédité quand aucun 21, 23 ou 24 n’a été débité', async () => {
        const a = await trouver('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION', [
            ...stockEnRouteBoucle('38'),
            ligne('72200000', 'Immobilisations corporelles', 0, 18_000_000),
        ]);
        expect(a).toBeDefined();
        expect(a.occurrences[0].montant).toBe(18_000_000);
        expect(a.consequence).toContain('par le débit du compte 21');
    });
    it('au SYSCOHADA, une autoconsommation (724 crédité par le 104) ne fabrique aucune anomalie (R1-C1)', async () => {
        const a = await trouver('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION', [
            ...stockEnRouteBoucle('38'),
            ligne('10470000', 'Prélèvements d’autoconsommation', 2_000_000),
            ligne('72400000', 'Production autoconsommée', 0, 2_000_000),
            ligne('72600000', 'Immobilisations financières', 0, 1_000_000),
        ]);
        expect(a).toBeUndefined();
    });
    it('au SYCEBNL, la fiche du 72 ne donne au 724 aucune autre contrepartie · rien n’est transposé', async () => {
        const a = await trouver('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION', [...stockEnRouteBoucle('37'), ligne('72400000', 'Production auto-consommée', 0, 2_000_000)], client_1.Referentiel.SYCEBNL);
        expect(a.occurrences.map((o) => o.reference)).toEqual(['72400000 Production auto-consommée']);
    });
    it('l’action renvoie aux comptes en cours 219, 239 ou 249, jamais au 22 des terrains (R1-C2)', async () => {
        const a = await trouver('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION', [
            ...stockEnRouteBoucle('38'),
            ligne('72200000', 'Immobilisations corporelles', 0, 18_000_000),
        ]);
        expect(a.action).toContain('du compte en cours de sa nature (219, 239 ou 249)');
    });
    it('signale encore un exercice CLOS · le solde de clôture ne vaut pas immobilisation (régression de F4)', async () => {
        const a = await trouver('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION', [
            ...stockEnRouteBoucle('38'),
            ligne('72200000', 'Immobilisations corporelles', 0, 18_000_000),
            ligne('72200000', 'Immobilisations corporelles', 18_000_000, 0, 'ex', true),
        ]);
        expect(a?.occurrences[0].montant).toBe(18_000_000);
    });
    it('se tait dès qu’une immobilisation est entrée · 21, 23 ou 24', async () => {
        for (const racine of ['21', '23', '24']) {
            const a = await trouver('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION', [
                ...stockEnRouteBoucle('38'),
                ligne('72200000', 'Immobilisations corporelles', 0, 18_000_000),
                ligne(`${racine}100000`, 'Immobilisation produite', 18_000_000),
            ]);
            expect({ racine, signale: Boolean(a) }).toEqual({ racine, signale: false });
        }
    });
    it('vaut pour les deux référentiels · le compte 72 est identique des deux côtés', async () => {
        for (const referentiel of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            const racine = referentiel === client_1.Referentiel.SYSCOHADA ? '38' : '37';
            const a = await trouver('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION', [...stockEnRouteBoucle(racine), ligne('72100000', 'Immobilisations incorporelles', 0, 4_000_000)], referentiel);
            expect({ referentiel, signale: Boolean(a) }).toEqual({ referentiel, signale: true });
        }
    });
    it('ne signale pas un 72 débité · c’est le solde de fin d’exercice au 13', async () => {
        const a = await trouver('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION', [
            ...stockEnRouteBoucle('38'),
            ligne('72200000', 'Immobilisations corporelles', 18_000_000),
        ]);
        expect(a).toBeUndefined();
    });
});
describe('ce que le module refuse de signaler', () => {
    it('ne dit rien d’un dossier qui n’a ni stock en cours de route ni production immobilisée', async () => {
        const rapport = await service([
            ligne('60100000', 'Achats de marchandises', 40_000_000),
            ligne('40100000', 'Fournisseurs', 0, 40_000_000),
        ], client_1.Referentiel.SYSCOHADA).analyser('t', 'ex');
        const codes = rapport.anomalies.map((a) => a.code);
        expect(codes).not.toContain('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION');
        expect(codes).not.toContain('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION');
        expect(codes).not.toContain('DEPRECIATION_STOCK_SANS_STOCK');
    });
    it('ne porte aucun critère fondé sur l’absence pure du compte 72', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'controles.service.ts'), 'utf8');
        const bloc = source.slice(source.indexOf('PRODUCTION_IMMOBILISEE_SANS_IMMOBILISATION'), source.indexOf('const ordre: Record<Gravite, number>'));
        expect(bloc).not.toMatch(/productionImmobilisee\.credit\s*<=/);
        expect(bloc).not.toMatch(/productionImmobilisee[^\n]*===\s*0/);
    });
});
describe('388 · stock provenant d’immobilisations mises hors service', () => {
    it('un 388 ouvert à la clôture est signalé sous son propre nom, pas comme un stock en route', async () => {
        const lignes = [ligne('38800000', 'Stock provenant d’immobilisations mises hors service ou au rebut', 2_000_000)];
        const a = await trouver('STOCK_IMMOBILISATIONS_388_NON_SOLDE', lignes);
        expect(a).toBeDefined();
        expect(a.occurrences[0].montant).toBe(2_000_000);
        expect(await trouver('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION', lignes)).toBeUndefined();
    });
    it('un 388 soldé par le 603 ne dit rien', async () => {
        const a = await trouver('STOCK_IMMOBILISATIONS_388_NON_SOLDE', [
            ligne('38800000', 'Stock provenant d’immobilisations mises hors service ou au rebut', 2_000_000, 2_000_000),
            ligne('60310000', 'Variations des stocks de marchandises', 2_000_000, 2_000_000),
        ]);
        expect(a).toBeUndefined();
    });
    it('le même objet est au 378 en SYCEBNL · jamais lu comme un stock en route, et sans règle de solde', async () => {
        const lignes = [ligne('37800000', 'Stock provenant d’immobilisations mises hors services ou au rebut', 2_000_000)];
        expect(await trouver('STOCK_IMMOBILISATIONS_388_NON_SOLDE', lignes, client_1.Referentiel.SYCEBNL)).toBeUndefined();
        expect(await trouver('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION', lignes, client_1.Referentiel.SYCEBNL)).toBeUndefined();
        expect(await trouver('STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION', [ligne('37100000', 'Biens liés à l’activité en cours de route', 2_000_000)], client_1.Referentiel.SYCEBNL)).toBeDefined();
    });
});
//# sourceMappingURL=stocks-production-immobilisee.spec.js.map