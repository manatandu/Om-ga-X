"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const operation_specifique_service_1 = require("./operation-specifique.service");
const tenant_service_1 = require("../tenant/tenant.service");
const controles_service_1 = require("../controles/controles.service");
function tenantService(tenant) {
    const prisma = {
        tenant: {
            findUnique: jest.fn().mockResolvedValue(tenant),
            update: jest.fn().mockResolvedValue({ ...tenant }),
        },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { service: new tenant_service_1.TenantService(prisma), prisma: prisma };
}
const DOSSIER_ASSOCIATION = {
    id: 't1',
    nom: 'ASBL',
    referentiel: client_1.Referentiel.SYCEBNL,
    jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
    methodeCotisations: null,
};
describe('paramètre du dossier · méthode de comptabilisation des cotisations', () => {
    it('enregistre le choix du cabinet et le rend dans les paramètres', async () => {
        const { service, prisma } = tenantService(DOSSIER_ASSOCIATION);
        prisma.tenant.findUnique
            .mockResolvedValueOnce(DOSSIER_ASSOCIATION)
            .mockResolvedValue({ ...DOSSIER_ASSOCIATION, methodeCotisations: client_1.MethodeCotisations.ENCAISSEMENT });
        const p = await service.modifierMethodeCotisations('t1', client_1.MethodeCotisations.ENCAISSEMENT);
        expect(prisma.tenant.update).toHaveBeenCalledWith({
            where: { id: 't1' },
            data: { methodeCotisations: client_1.MethodeCotisations.ENCAISSEMENT },
        });
        expect(p.methodeCotisations).toBe(client_1.MethodeCotisations.ENCAISSEMENT);
    });
    it('REFUSE un dossier SYSCOHADA · une entreprise n’a pas d’adhérents', async () => {
        const { service } = tenantService({ ...DOSSIER_ASSOCIATION, referentiel: client_1.Referentiel.SYSCOHADA });
        await expect(service.modifierMethodeCotisations('t1', client_1.MethodeCotisations.APPEL)).rejects.toThrow(/SYCEBNL/);
    });
    it('REFUSE un projet de développement · il est financé par un bailleur, pas par des cotisations', async () => {
        const { service } = tenantService({
            ...DOSSIER_ASSOCIATION,
            jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT,
        });
        await expect(service.modifierMethodeCotisations('t1', client_1.MethodeCotisations.APPEL)).rejects.toThrow(/bailleur/);
    });
});
function operationService(methodeCotisations) {
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
                methodeCotisations,
            }),
        },
        compte: {
            findMany: jest.fn().mockResolvedValue(['411', '1851', '701', '103', '1049', '703'].map((numero) => ({
                id: `c-${numero}`,
                numero: `${numero}00000`.slice(0, 8),
                intitule: `Compte ${numero}`,
                typeCompte: 'DETAIL',
                estActif: true,
            }))),
        },
    };
    return new operation_specifique_service_1.OperationSpecifiqueService(prisma, {});
}
describe('opérations spécifiques · l’appel suppose un droit d’agir', () => {
    it('REFUSE l’appel de cotisation à un dossier qui constate à l’encaissement', async () => {
        const s = operationService(client_1.MethodeCotisations.ENCAISSEMENT);
        await expect(s.proposer('t1', { codeModele: 'B6-APPEL-COTISATION', parametres: { cotisation: 1000 } })).rejects.toThrow(/ENCAISSEMENT/);
        await expect(s.proposer('t1', { codeModele: 'B6-APPEL-DROIT-ENTREE', parametres: { appelGlobal: 1000, tauxDepot: 0.15, tauxCotisation: 0.1 } })).rejects.toThrow(/411 Adhérents/);
    });
    it('ACCEPTE l’appel quand le dossier justifie d’un droit d’agir', async () => {
        const s = operationService(client_1.MethodeCotisations.APPEL);
        const e = await s.proposer('t1', { codeModele: 'B6-APPEL-COTISATION', parametres: { cotisation: 1000 } });
        expect(e.lignes).toHaveLength(2);
    });
    it('N’EXIGE PAS que le choix soit fait · le § 5.4.2.1 pose l’appel comme la règle', async () => {
        const s = operationService(null);
        const e = await s.proposer('t1', { codeModele: 'B6-APPEL-COTISATION', parametres: { cotisation: 1000 } });
        expect(e.lignes).toHaveLength(2);
    });
    it('laisse passer les modèles qui ne débitent pas le 411', async () => {
        const s = operationService(client_1.MethodeCotisations.ENCAISSEMENT);
        const e = await s.proposer('t1', {
            codeModele: 'B14-QUOTE-PART-CONSOMPTIBLE',
            parametres: { chargesCouvertes: 1000 },
        });
        expect(e.lignes).toHaveLength(2);
    });
});
let idLigne = 0;
const ligne = (numero, debit, credit = 0) => {
    idLigne += 1;
    return { id: `l${idLigne}`, debit, credit, lettre: null, compte: { numero, intitule: `Compte ${numero}` } };
};
const ecriture = (libelle, lignes) => ({
    id: `e-${libelle}`,
    date: new Date('2026-05-10'),
    libelle,
    reference: 'PJ-1',
    numeroPiece: 1,
    createdAt: new Date('2026-05-10'),
    statut: 'VALIDEE',
    journal: { code: 'OD' },
    lignes,
});
function controles(ecritures, methodeCotisations) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                id: 't',
                referentiel: client_1.Referentiel.SYCEBNL,
                jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
                methodeCotisations,
            }),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue(ecritures) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
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
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        cloture: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const APPEL_DE_COTISATION = ecriture('Appel de cotisation', [ligne('41110000', 1000), ligne('70110000', 0, 1000)]);
describe('contrôle · méthode de comptabilisation des cotisations non précisée', () => {
    const anomalie = async (svc) => (await svc.analyser('t', 'ex')).anomalies.find((a) => a.code === 'METHODE_COTISATIONS_NON_PRECISEE');
    it('SIGNALE un dossier qui appelle des cotisations sans avoir tranché', async () => {
        const a = await anomalie(controles([APPEL_DE_COTISATION], null));
        expect(a?.gravite).toBe('AVERTISSEMENT');
        expect(a?.consequence).toContain('5.4.2.1');
        expect(a?.occurrences).toHaveLength(1);
    });
    it('SE TAIT dès que le choix est fait', async () => {
        expect(await anomalie(controles([APPEL_DE_COTISATION], client_1.MethodeCotisations.APPEL))).toBeUndefined();
        expect(await anomalie(controles([APPEL_DE_COTISATION], client_1.MethodeCotisations.ENCAISSEMENT))).toBeUndefined();
    });
    it('SE TAIT sur un dossier sans cotisation · rien à préciser, donc rien à crier', async () => {
        const sansCotisation = ecriture('Achat de fournitures', [ligne('60410000', 500), ligne('40110000', 0, 500)]);
        expect(await anomalie(controles([sansCotisation], null))).toBeUndefined();
    });
});
//# sourceMappingURL=methode-cotisations.spec.js.map