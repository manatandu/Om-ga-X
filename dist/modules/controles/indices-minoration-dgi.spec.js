"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const controles_service_1 = require("./controles.service");
const ligne = (numero, intitule, debit, credit = 0, exerciceId = 'ex', soldeDeGestion = false) => ({
    debit,
    credit,
    compte: { numero, intitule },
    ecriture: { exerciceId },
    soldeDeGestion,
});
function service(lignes, referentiel, avecExercicePrecedent = true, forme = null, balance) {
    const courant = { id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
    const precedent = { id: 'exN1', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') };
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockImplementation((args) => args?.where?.dateFin?.lt ? Promise.resolve(avecExercicePrecedent ? precedent : null) : Promise.resolve(courant)),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel, formeJuridiqueSyscohada: forme }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: {
            findMany: jest.fn(async (args) => lignes.filter((l) => !(l.soldeDeGestion && args?.where?.ecriture?.estSoldeDesComptesDeGestion === false) &&
                (typeof args?.where?.ecriture?.exerciceId !== 'string' || l.ecriture.exerciceId === args.where.ecriture.exerciceId))),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    if (!balance)
        return new controles_service_1.ControlesService(prisma);
    const ecritureService = {
        balance: jest.fn(async (_t, _e, inclureBrouillard) => ({
            lignes: inclureBrouillard
                ? []
                : balance.map((b) => ({
                    compteId: b.numero,
                    numero: b.numero,
                    intitule: b.numero,
                    classe: `CLASSE_${b.numero[0]}`,
                    typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                    totalDebit: Math.max(0, b.solde),
                    totalCredit: Math.max(0, -b.solde),
                    reportDebit: 0,
                    reportCredit: 0,
                    mouvementDebit: Math.max(0, b.solde),
                    mouvementCredit: Math.max(0, -b.solde),
                    clotureDebit: 0,
                    clotureCredit: 0,
                    solde: b.solde,
                })),
        })),
    };
    const etats = new etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService(ecritureService, {});
    return new controles_service_1.ControlesService(prisma, ecritureService, etats);
}
const trouver = async (code, lignes, referentiel = client_1.Referentiel.SYSCOHADA, avecExercicePrecedent = true, forme = null, balance) => {
    const rapport = await service(lignes, referentiel, avecExercicePrecedent, forme, balance).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === code);
};
describe('17 · transport pour le compte de tiers sans transfert de charges', () => {
    it('signale un solde 613 quand aucun 781 n’a bougé', async () => {
        const a = await trouver('TRANSPORT_TIERS_SANS_TRANSFERT', [
            ligne('61300000', 'Transports pour le compte de tiers', 2_400_000),
        ]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.occurrences[0].montant).toBe(2_400_000);
        expect(a.consequence).toContain('minoré');
    });
    it('signale encore un exercice CLOS · le solde de clôture n’est pas un transfert (régression de F4)', async () => {
        const a = await trouver('TRANSPORT_TIERS_SANS_TRANSFERT', [
            ligne('61300000', 'Transports pour le compte de tiers', 2_400_000),
            ligne('61300000', 'Transports pour le compte de tiers', 0, 2_400_000, 'ex', true),
        ]);
        expect(a).toBeDefined();
    });
    it('se tait dès qu’un transfert de charges a été passé', async () => {
        const a = await trouver('TRANSPORT_TIERS_SANS_TRANSFERT', [
            ligne('61300000', 'Transports pour le compte de tiers', 2_400_000),
            ligne('78100000', 'Transferts de charges d’exploitation', 0, 2_400_000),
        ]);
        expect(a).toBeUndefined();
    });
    it('ne s’adresse pas à une entité à but non lucratif', async () => {
        const a = await trouver('TRANSPORT_TIERS_SANS_TRANSFERT', [ligne('61300000', 'Transports pour le compte de tiers', 2_400_000)], client_1.Referentiel.SYCEBNL);
        expect(a).toBeUndefined();
    });
});
describe('18 · extourne de régularisation d’un montant différent', () => {
    const constatee = (montant) => ligne('47600000', 'Charges constatées d’avance', montant, 0, 'exN1');
    const extournee = (montant) => ligne('47600000', 'Charges constatées d’avance', 0, montant, 'ex');
    it('signale une extourne inférieure au solde repris', async () => {
        const a = await trouver('EXTOURNE_REGULARISATION_INCOHERENTE', [constatee(10_000), extournee(8_000)]);
        expect(a).toBeDefined();
        expect(a.occurrences[0].montant).toBe(-2_000);
        expect(a.occurrences[0].detail).toContain('10000.00');
    });
    it('signale une extourne supérieure au solde repris', async () => {
        const a = await trouver('EXTOURNE_REGULARISATION_INCOHERENTE', [constatee(10_000), extournee(12_000)]);
        expect(a.occurrences[0].montant).toBe(2_000);
    });
    it('se tait quand l’extourne est exacte', async () => {
        expect(await trouver('EXTOURNE_REGULARISATION_INCOHERENTE', [constatee(10_000), extournee(10_000)])).toBeUndefined();
    });
    it('lit le 477 dans son sens propre, créditeur', async () => {
        const a = await trouver('EXTOURNE_REGULARISATION_INCOHERENTE', [
            ligne('47700000', 'Produits constatés d’avance', 0, 6_000, 'exN1'),
            ligne('47700000', 'Produits constatés d’avance', 6_000, 0, 'ex'),
        ]);
        expect(a).toBeUndefined();
    });
    it('vaut pour les deux référentiels · ce n’est pas un risque d’assiette', async () => {
        const a = await trouver('EXTOURNE_REGULARISATION_INCOHERENTE', [constatee(10_000), extournee(3_000)], client_1.Referentiel.SYCEBNL);
        expect(a).toBeDefined();
    });
    it('se tait sur un premier exercice, faute de solde à reprendre', async () => {
        expect(await trouver('EXTOURNE_REGULARISATION_INCOHERENTE', [extournee(8_000)], client_1.Referentiel.SYSCOHADA, false)).toBeUndefined();
    });
});
describe('19 · avances clients reportées d’un exercice à l’autre', () => {
    it('signale une avance créditrice à la clôture précédente', async () => {
        const a = await trouver('AVANCE_CLIENT_REPORTEE', [
            ligne('41910000', 'Clients, avances et acomptes reçus', 0, 5_000_000, 'exN1'),
        ]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('INFORMATION');
        expect(a.consequence).toContain('pas une règle de l’AUDCIF');
        expect(a.occurrences[0].montant).toBe(5_000_000);
    });
    it('se tait quand l’avance a été soldée dans l’exercice précédent', async () => {
        const a = await trouver('AVANCE_CLIENT_REPORTEE', [
            ligne('41910000', 'Clients, avances et acomptes reçus', 0, 5_000_000, 'exN1'),
            ligne('41910000', 'Clients, avances et acomptes reçus', 5_000_000, 0, 'exN1'),
        ]);
        expect(a).toBeUndefined();
    });
    it('ne s’adresse pas à une entité à but non lucratif', async () => {
        const a = await trouver('AVANCE_CLIENT_REPORTEE', [ligne('41910000', 'Clients, avances et acomptes reçus', 0, 5_000_000, 'exN1')], client_1.Referentiel.SYCEBNL);
        expect(a).toBeUndefined();
    });
});
describe('19 bis · compte courant d’associé débiteur (passe F5, art. 73, al. 2, 2°, a)', () => {
    const avance = ligne('46210000', 'Associés, comptes courants', 3_000_000);
    it('signale un 462 débiteur d’une société SYSCOHADA, sans chiffrer de retenue', async () => {
        const a = await trouver('COMPTE_COURANT_ASSOCIE_DEBITEUR', [avance], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect([a?.gravite, a?.occurrences[0].montant, a?.consequence.includes('sauf preuve contraire')]).toEqual(['INFORMATION', 3_000_000, true]);
    });
    it('une SARL lit l’interdiction de l’art. 356, et la convention de prêt n’est plus offerte sans condition (O1b-A5)', async () => {
        const a = await trouver('COMPTE_COURANT_ASSOCIE_DEBITEUR', [avance], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(a.consequence).toContain('interdits à peine de nullité (AUSCGIE art. 356)');
        expect(a.action).toContain('seulement si le titulaire n’est pas visé par l’interdiction');
    });
    it('une SA lit les art. 450 et 507, une SAS l’art. 853-16 · chacune son article (O1b-B3, C5)', async () => {
        const [sa, sas, snc] = await Promise.all([
            trouver('COMPTE_COURANT_ASSOCIE_DEBITEUR', [avance], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME),
            trouver('COMPTE_COURANT_ASSOCIE_DEBITEUR', [avance], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE),
            trouver('COMPTE_COURANT_ASSOCIE_DEBITEUR', [avance], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF),
        ]);
        expect(sa.consequence).toContain('(AUSCGIE art. 450 et 507)');
        expect(sas.consequence).toContain('(AUSCGIE art. 853-16)');
        expect(snc.action).toContain('(convention de prêt, remboursement intervenu)');
    });
    it('ne lit que l’exercice analysé', async () => {
        const a = await trouver('COMPTE_COURANT_ASSOCIE_DEBITEUR', [ligne('46210000', 'Associés, comptes courants', 3_000_000, 0, 'exN1')], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(a).toBeUndefined();
    });
    it('se tait au SYCEBNL, où le 462 porte les fonds d’administration des projets, et chez une personne physique', async () => {
        const [ebnl, physique] = await Promise.all([
            trouver('COMPTE_COURANT_ASSOCIE_DEBITEUR', [avance], client_1.Referentiel.SYCEBNL),
            trouver('COMPTE_COURANT_ASSOCIE_DEBITEUR', [avance], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE),
        ]);
        expect([ebnl, physique]).toEqual([undefined, undefined]);
    });
});
describe('19 bis A · capitaux propres sous la moitié du capital (O1b-A4, D1, G3)', () => {
    const perte = [
        { numero: '10130000', solde: -10_000_000 },
        { numero: '13900000', solde: 7_000_000 },
        { numero: '52110000', solde: 3_000_000 },
    ];
    const sa = client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME;
    it('une SA sous la moitié est informée, sur les art. 664 et 665, grandeurs lues par le bilan', async () => {
        const a = await trouver('CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL', [], client_1.Referentiel.SYSCOHADA, true, sa, perte);
        expect(a.gravite).toBe('INFORMATION');
        expect(a.occurrences.map((o) => o.montant)).toEqual([3_000_000, 10_000_000]);
        expect(a.consequence).toContain('(AUSCGIE art. 664)');
        expect(a.consequence).toContain('(art. 669)');
    });
    it('le capital non appelé et les subventions comptent aux capitaux propres · AUDCIF Titre VIII ch. 16, § 3.1', async () => {
        const a = await trouver('CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL', [], client_1.Referentiel.SYSCOHADA, true, sa, [
            ...perte,
            { numero: '10900000', solde: 2_000_000 },
            { numero: '14100000', solde: -1_000_000 },
            { numero: '52110000', solde: 0 },
        ]);
        expect(a.occurrences[0].montant).toBe(4_000_000);
    });
    it('une SARL lit les art. 371 à 373, pas le délai de l’art. 665', async () => {
        const a = await trouver('CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL', [], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, perte);
        expect(a.consequence).toContain('(AUSCGIE art. 371)');
        expect(a.consequence).toContain('dans les deux ans qui suivent la clôture de l’exercice déficitaire');
    });
    it('se tait à la moitié, chez une SNC, et sans capital', async () => {
        const moitie = [
            { numero: '10130000', solde: -10_000_000 },
            { numero: '13900000', solde: 5_000_000 },
        ];
        const [aMoitie, snc] = await Promise.all([
            trouver('CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL', [], client_1.Referentiel.SYSCOHADA, true, sa, moitie),
            trouver('CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL', [], client_1.Referentiel.SYSCOHADA, true, client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF, perte),
        ]);
        expect([aMoitie, snc]).toEqual([undefined, undefined]);
    });
});
describe('le 109 et le 1011, de solde opposé et de montant identique (R1-A7)', () => {
    it('un appel qui touche le 1011 sans le 109 est nommé, deux soldes à l’appui', async () => {
        const a = await trouver('CAPITAL_NON_APPELE_DISCORDANT', [], client_1.Referentiel.SYSCOHADA, true, null, [
            { numero: '10110000', solde: -2_000_000 },
            { numero: '10900000', solde: 5_000_000 },
        ]);
        expect(a.gravite).toBe('INFORMATION');
        expect(a.occurrences.map((o) => [o.reference, o.montant])).toEqual([
            ['109', 5_000_000],
            ['1011', -2_000_000],
        ]);
        expect(a.consequence).toContain('de solde opposé et de montant identique');
    });
    it('un 109 crédité sans le 1011 est nommé aussi · l’écart vaut dans les deux sens', async () => {
        const a = await trouver('CAPITAL_NON_APPELE_DISCORDANT', [], client_1.Referentiel.SYSCOHADA, true, null, [
            { numero: '10110000', solde: -5_000_000 },
            { numero: '10900000', solde: 2_000_000 },
        ]);
        expect(a).toBeDefined();
    });
    it('se tait quand les deux se compensent', async () => {
        const a = await trouver('CAPITAL_NON_APPELE_DISCORDANT', [], client_1.Referentiel.SYSCOHADA, true, null, [
            { numero: '10110000', solde: -5_000_000 },
            { numero: '10900000', solde: 5_000_000 },
        ]);
        expect(a).toBeUndefined();
    });
});
describe('le millésime du séminaire ne contamine pas les messages', () => {
    it('ne cite ni l’IBP ni l’IPR, abrogés au 1er janvier 2026', async () => {
        const rapport = await service([
            ligne('61300000', 'Transports pour le compte de tiers', 2_400_000),
            ligne('47600000', 'Charges constatées d’avance', 10_000, 0, 'exN1'),
            ligne('47600000', 'Charges constatées d’avance', 0, 8_000, 'ex'),
            ligne('41910000', 'Clients, avances et acomptes reçus', 0, 5_000_000, 'exN1'),
        ], client_1.Referentiel.SYSCOHADA).analyser('t', 'ex');
        const textes = rapport.anomalies.map((a) => `${a.libelle} ${a.consequence} ${a.action}`).join(' ');
        expect(textes).not.toMatch(/\bIBP\b|\bIPR\b|impôt sur les bénéfices et profits/i);
    });
});
//# sourceMappingURL=indices-minoration-dgi.spec.js.map