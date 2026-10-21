"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const inventaire_service_1 = require("./inventaire.service");
const MEMBRES = [{ role: client_1.RoleMembreInventaire.INVENTORIANT }, { role: client_1.RoleMembreInventaire.TEMOIN }];
const SOUS_COMMISSIONS = [
    { id: 'sc1', tenantId: 't1', campagneId: 'camp1', membres: MEMBRES },
    { id: 'scAutreCampagne', tenantId: 't1', campagneId: 'camp9', membres: MEMBRES },
    { id: 'scVoisin', tenantId: 't2', campagneId: 'camp1', membres: MEMBRES },
];
function monter(statut) {
    const campagne = { id: 'camp1', tenantId: 't1', exerciceId: 'ex1', statut };
    const fiches = [{ id: 'f1', tenantId: 't1', campagneId: 'camp1', compteId: 'c1', valeurInventaire: null }];
    const prisma = {
        $transaction: jest.fn(async (fn) => fn(prisma)),
        campagneInventaire: {
            findFirst: jest.fn(async ({ where }) => where.id === campagne.id && where.tenantId === campagne.tenantId ? { ...campagne } : null),
            updateMany: jest.fn(async ({ where, data }) => {
                if (where.id !== campagne.id || where.tenantId !== campagne.tenantId || where.statut !== campagne.statut)
                    return { count: 0 };
                campagne.statut = data.statut;
                return { count: 1 };
            }),
        },
        ficheInventaire: {
            findFirst: jest.fn(async ({ where }) => {
                const f = fiches.find((x) => x.id === where.id && x.tenantId === where.tenantId);
                return f ? { ...f, campagne: { ...campagne } } : null;
            }),
            update: jest.fn(async ({ data }) => ({ ...fiches[0], ...data })),
            create: jest.fn(async ({ data }) => ({ id: 'f2', ...data })),
            deleteMany: jest.fn(async ({ where }) => {
                const i = fiches.findIndex((x) => x.id === where.id && x.tenantId === where.tenantId);
                if (i < 0)
                    return { count: 0 };
                fiches.splice(i, 1);
                return { count: 1 };
            }),
        },
        compte: { findFirst: jest.fn(async () => ({ id: 'c57', numero: '57100000', intitule: 'Caisse siège' })) },
        exercice: {
            findFirst: jest.fn(async () => ({ id: 'ex1', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') })),
            findMany: jest.fn(async () => []),
        },
        ligneEcriture: {
            count: jest.fn(async () => 0),
            aggregate: jest.fn(async () => ({ _sum: { debit: 100, credit: 0 }, _count: { _all: 1 } })),
            groupBy: jest.fn(async () => [{ deviseId: null }]),
        },
        sousCommissionInventaire: {
            findFirst: jest.fn(async ({ where }) => SOUS_COMMISSIONS.find((sc) => sc.id === where.id && sc.tenantId === where.tenantId && sc.campagneId === where.campagneId) ?? null),
        },
        procesVerbalComptageCaisse: {
            findFirst: jest.fn(async () => null),
            findMany: jest.fn(async () => []),
            create: jest.fn(async ({ data }) => ({ id: 'pv1', ...data })),
        },
    };
    return { svc: new inventaire_service_1.InventaireService(prisma, {}), campagne, fiches };
}
describe('F134 · le premier comptage ouvre le recensement', () => {
    it('une quantité ou une valeur saisie fait passer la campagne de la préparation au recensement', async () => {
        const m = monter(client_1.StatutCampagneInventaire.PREPARATION);
        await m.svc.saisirComptage('t1', 'f1', { quantiteComptee: 12 });
        expect(m.campagne.statut).toBe(client_1.StatutCampagneInventaire.RECENSEMENT);
    });
    it('une pièce ou un emplacement corrigés ne sont pas un comptage', async () => {
        const m = monter(client_1.StatutCampagneInventaire.PREPARATION);
        await m.svc.saisirComptage('t1', 'f1', { referencePiece: 'BE-4', emplacement: 'Dépôt B' });
        expect(m.campagne.statut).toBe(client_1.StatutCampagneInventaire.PREPARATION);
    });
    it('le PV d’une caisse s’établit dès la préparation, et ouvre le recensement', async () => {
        const m = monter(client_1.StatutCampagneInventaire.PREPARATION);
        await m.svc.etablirPvCaisse('t1', 'camp1', 'u1', {
            compteId: 'c57',
            sousCommissionId: 'sc1',
            dateComptage: '2025-12-31',
            especesComptees: 100,
            modeComparaison: 'FRANCS',
        });
        expect(m.campagne.statut).toBe(client_1.StatutCampagneInventaire.RECENSEMENT);
    });
    it('une campagne déjà en arbitrage ne revient pas au recensement', async () => {
        const m = monter(client_1.StatutCampagneInventaire.ARBITRAGE);
        await m.svc.etablirPvCaisse('t1', 'camp1', 'u1', {
            compteId: 'c57', sousCommissionId: 'sc1', dateComptage: '2025-12-31', especesComptees: 100, modeComparaison: 'FRANCS',
        });
        expect(m.campagne.statut).toBe(client_1.StatutCampagneInventaire.ARBITRAGE);
    });
});
describe('F135 · une fiche se retire tant que rien n’est figé', () => {
    it.each([client_1.StatutCampagneInventaire.PREPARATION, client_1.StatutCampagneInventaire.RECENSEMENT])('en %s, la fiche part', async (statut) => {
        const m = monter(statut);
        await expect(m.svc.supprimerFiche('t1', 'f1')).resolves.toEqual({ supprimee: true });
        expect(m.fiches).toEqual([]);
    });
    it.each([client_1.StatutCampagneInventaire.ARBITRAGE, client_1.StatutCampagneInventaire.CLOTUREE])('en %s, elle reste', async (statut) => {
        const m = monter(statut);
        await expect(m.svc.supprimerFiche('t1', 'f1')).rejects.toBeInstanceOf(common_1.ForbiddenException);
        expect(m.fiches).toHaveLength(1);
    });
    it('la fiche d’un autre dossier n’existe pas', async () => {
        const m = monter(client_1.StatutCampagneInventaire.PREPARATION);
        await expect(m.svc.supprimerFiche('t2', 'f1')).rejects.toThrow(/introuvable/);
        expect(m.fiches).toHaveLength(1);
    });
});
describe('F136 · la sous-commission d’une fiche est celle de sa campagne', () => {
    it.each(['scAutreCampagne', 'scVoisin'])('refuse %s à la création comme au comptage', async (sousCommissionId) => {
        const m = monter(client_1.StatutCampagneInventaire.PREPARATION);
        await expect(m.svc.creerFiche('t1', 'camp1', { compteId: 'c57', designation: 'Caisse', sousCommissionId })).rejects.toThrow(/n'appartient pas à la campagne/);
        await expect(m.svc.saisirComptage('t1', 'f1', { sousCommissionId })).rejects.toThrow(/n'appartient pas à la campagne/);
    });
    it('accepte celle de la campagne', async () => {
        const m = monter(client_1.StatutCampagneInventaire.PREPARATION);
        await expect(m.svc.creerFiche('t1', 'camp1', { compteId: 'c57', designation: 'Caisse', sousCommissionId: 'sc1' })).resolves.toMatchObject({ sousCommissionId: 'sc1' });
        await expect(m.svc.saisirComptage('t1', 'f1', { sousCommissionId: 'sc1' })).resolves.toBeDefined();
    });
});
//# sourceMappingURL=inventaire-audit-final.spec.js.map