"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
let idLigne = 0;
function ligne(numero, debit, credit = 0) {
    idLigne += 1;
    return { id: `l${idLigne}`, debit, credit, lettre: null, compte: { numero, intitule: `Compte ${numero}` } };
}
function ecriture(libelle, lignes, date = '2026-05-10', ecartsInventaire = []) {
    return {
        id: `e-${libelle}`,
        date: new Date(date),
        libelle,
        reference: 'PJ-1',
        numeroPiece: 1,
        createdAt: new Date(date),
        statut: 'VALIDEE',
        journal: { code: 'OD' },
        lignes,
        ecartsInventaire,
    };
}
function service(ecritures, jeu = client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', jeuEtatsFinanciersSycebnl: jeu }) },
        ecriture: { findMany: jest.fn().mockResolvedValue(ecritures) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        cloture: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const trouver = async (svc) => (await svc.analyser('t', 'ex')).anomalies.find((a) => a.code === 'CHARGE_SANS_TIERS');
describe('charge imputée directement sur la trésorerie', () => {
    it('signale le cas que l’utilisateur a relevé : D/622 par C/521', async () => {
        const svc = service([ecriture('Loyer mai', [ligne('62210000', 300_000), ligne('52110000', 0, 300_000)])]);
        const a = await trouver(svc);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences).toHaveLength(1);
        expect(a.occurrences[0].montant).toBe(300_000);
    });
    it('la TVA récupérable n’est pas le tiers · un achat avec TVA réglé en banque remonte (R1-B3)', async () => {
        const svc = service([
            ecriture('Achat comptant', [ligne('60110000', 100_000), ligne('44520000', 16_000), ligne('52110000', 0, 116_000)]),
        ]);
        const a = await trouver(svc);
        expect(a.occurrences).toHaveLength(1);
    });
    it('une retenue à la source (447) absout toujours', async () => {
        const svc = service([
            ecriture('Loyer', [ligne('62210000', 300_000), ligne('44710000', 0, 60_000), ligne('52110000', 0, 240_000)]),
        ]);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('laisse passer le schéma correct : la charge contre le tiers', async () => {
        const svc = service([ecriture('Loyer mai', [ligne('62210000', 300_000), ligne('40110000', 0, 300_000)])]);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('laisse passer le règlement du tiers : le tiers contre la trésorerie', async () => {
        const svc = service([ecriture('Règlement bailleur', [ligne('40110000', 300_000), ligne('52110000', 0, 300_000)])]);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('absout l’écriture composée où le tiers est nommé', async () => {
        const svc = service([
            ecriture('Facture et acompte', [
                ligne('62210000', 300_000),
                ligne('40110000', 0, 100_000),
                ligne('52110000', 0, 200_000),
            ]),
        ]);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('ne dit rien des produits encaissés directement', async () => {
        const svc = service([
            ecriture('Recettes manifestation', [ligne('57100000', 25_000_000), ligne('70600000', 0, 25_000_000)]),
            ecriture('Dons en espèces', [ligne('57100000', 7_000_000), ligne('70410000', 0, 7_000_000)]),
        ]);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('se tait entièrement sur un dossier au Système minimal de trésorerie', async () => {
        const svc = service([ecriture('Loyer mai', [ligne('62210000', 300_000), ligne('52110000', 0, 300_000)])], client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('couvre aussi les charges H.A.O. de la classe 8', async () => {
        const svc = service([ecriture('Charge HAO', [ligne('83100000', 500_000), ligne('52110000', 0, 500_000)])]);
        expect(await trouver(svc)).toBeDefined();
    });
    it('ignore les dépréciations de trésorerie (59), qui ne sont pas un décaissement', async () => {
        const svc = service([ecriture('Dépréciation', [ligne('67900000', 50_000), ligne('59000000', 0, 50_000)])]);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('ne se déclenche pas sur un virement interne entre deux trésoreries', async () => {
        const svc = service([ecriture('Virement banque vers caisse', [ligne('57100000', 100_000), ligne('52110000', 0, 100_000)])]);
        expect(await trouver(svc)).toBeUndefined();
    });
});
describe('le redressement d’un manquant d’inventaire, reconnu par sa liaison (B1)', () => {
    const ECART_CAISSE = [{ ecart: -5_000, compte: { numero: '57100000' } }];
    it('ne signale pas la pièce rattachée à l’écart de caisse', async () => {
        const svc = service([
            ecriture('Manquant de caisse constaté à l’inventaire', [ligne('65800000', 5_000), ligne('57100000', 0, 5_000)], '2026-12-31', ECART_CAISSE),
        ]);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('la même pièce SANS liaison reste signalée · jamais reconnue au libellé', async () => {
        const svc = service([
            ecriture('Manquant de caisse constaté à l’inventaire', [ligne('65800000', 5_000), ligne('57100000', 0, 5_000)]),
        ]);
        expect((await trouver(svc)).occurrences).toHaveLength(1);
    });
    it('une dépense de caisse glissée dans la pièce rattachée reste signalée', async () => {
        const svc = service([
            ecriture('Manquant et fournitures', [ligne('65800000', 5_000), ligne('60520000', 20_000), ligne('57100000', 0, 5_000), ligne('57100000', 0, 20_000)], '2026-12-31', ECART_CAISSE),
        ]);
        const occ = (await trouver(svc)).occurrences;
        expect(occ).toHaveLength(1);
        expect(occ[0].montant).toBe(20_000);
        expect(occ[0].detail).toContain('60520000');
        expect(occ[0].detail).not.toContain('65800000');
    });
    it('la contrepartie du manquant ne sort qu’avec sa ligne de crédit, et au montant exact (mineur 6)', async () => {
        const scindee = service([
            ecriture('Manquant scindé et fournitures', [
                ligne('65800000', 3_000),
                ligne('65810000', 2_000),
                ligne('60520000', 20_000),
                ligne('57100000', 0, 5_000),
                ligne('57100000', 0, 20_000),
            ], '2026-12-31', ECART_CAISSE),
        ]);
        expect((await trouver(scindee)).occurrences[0].montant).toBe(25_000);
        const fondue = service([
            ecriture('Manquant fondu', [ligne('65800000', 5_000), ligne('60520000', 20_000), ligne('57100000', 0, 25_000)], '2026-12-31', ECART_CAISSE),
        ]);
        expect((await trouver(fondue)).occurrences[0].montant).toBe(25_000);
    });
    it('un virement interne glissé dans la pièce du manquant n’en fait pas une charge sans tiers (mineur 6)', async () => {
        const svc = service([
            ecriture('Manquant et versement en banque', [ligne('65800000', 5_000), ligne('57100000', 0, 5_000), ligne('52100000', 100_000), ligne('57100000', 0, 100_000)], '2026-12-31', ECART_CAISSE),
        ]);
        expect(await trouver(svc)).toBeUndefined();
    });
    it('seule la ligne au montant exact du manquant est justifiée', async () => {
        const svc = service([
            ecriture('Manquant et fournitures fondus', [ligne('65800000', 5_000), ligne('60520000', 20_000), ligne('57100000', 0, 25_000)], '2026-12-31', ECART_CAISSE),
        ]);
        expect((await trouver(svc)).occurrences).toHaveLength(1);
    });
});
describe('les frais financiers prélevés en trésorerie sont nommés (B2)', () => {
    it('intérêts d’emprunt prélevés en banque · signalés ET nommés, avec leur pièce', async () => {
        const svc = service([ecriture('Intérêts emprunt S1', [ligne('67120000', 450_000), ligne('52110000', 0, 450_000)])]);
        const a = await trouver(svc);
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences).toHaveLength(1);
        expect(a.occurrences[0].detail).toMatch(/fiche du compte 67/);
        expect(a.occurrences[0].detail).toMatch(/comptes de trésorerie/);
        expect(a.occurrences[0].detail).toMatch(/relevé de banque et le décompte d'intérêt/);
    });
    it('un loyer prélevé reste un oubli de tiers, non nommé', async () => {
        const svc = service([ecriture('Loyer juillet', [ligne('62210000', 300_000), ligne('52110000', 0, 300_000)])]);
        expect((await trouver(svc)).occurrences[0].detail).not.toMatch(/fiche du compte 67/);
    });
    it('une pièce qui mêle intérêts et loyer n’est pas nommée', async () => {
        const svc = service([
            ecriture('Intérêts et loyer', [
                ligne('67120000', 450_000),
                ligne('62210000', 300_000),
                ligne('52110000', 0, 750_000),
            ]),
        ]);
        const a = await trouver(svc);
        expect(a.occurrences).toHaveLength(1);
        expect(a.occurrences[0].detail).not.toMatch(/fiche du compte 67/);
    });
    it('le 679 (dotation, par le crédit du 59) n’est pas le cas de la fiche', async () => {
        const svc = service([ecriture('Charge 679 en banque', [ligne('67910000', 10_000), ligne('52110000', 0, 10_000)])]);
        expect((await trouver(svc)).occurrences[0].detail).not.toMatch(/fiche du compte 67/);
    });
});
//# sourceMappingURL=charge-sans-tiers.spec.js.map