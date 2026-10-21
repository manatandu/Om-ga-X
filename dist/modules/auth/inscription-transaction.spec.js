"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const auth_service_1 = require("./auth.service");
const contexte_audit_1 = require("../../common/audit/contexte-audit");
function service(options) {
    const appels = [];
    const surPrisma = [];
    let optionsTransaction;
    const tx = { __estLaTransaction: true, user: { create: async () => ({ id: 'u1' }) } };
    const recevoir = (nom) => async (...args) => {
        const dernier = args[args.length - 1];
        appels.push({ nom, recuTx: dernier?.__estLaTransaction === true, dossierDeLActe: (0, contexte_audit_1.acteurCourant)()?.tenantId });
        if (options?.echoueSur === nom)
            throw new Error(`échec simulé du semis ${nom}`);
        return undefined;
    };
    const s = new auth_service_1.AuthService({
        user: {
            findUnique: async () => null,
            create: async () => {
                surPrisma.push('user.create');
                return { id: 'u-hors-transaction' };
            },
        },
        $transaction: async (fn, opts) => {
            optionsTransaction = opts;
            return fn(tx);
        },
    }, { sign: () => 'jeton' }, {
        creerTenant: async (p, client) => {
            appels.push({ nom: 'creerTenant', recuTx: client?.__estLaTransaction === true, dossierDeLActe: (0, contexte_audit_1.acteurCourant)()?.tenantId });
            return { id: p.id ?? 't1', nom: 'X', referentiel: client_1.Referentiel.SYCEBNL };
        },
    }, { seedPlan: recevoir('seedPlan') }, {
        creerExerciceCourant: async (_t, client) => {
            appels.push({ nom: 'creerExerciceCourant', recuTx: client?.__estLaTransaction === true, dossierDeLActe: (0, contexte_audit_1.acteurCourant)()?.tenantId });
            return { id: 'ex1' };
        },
    }, { seedJournauxDefaut: recevoir('seedJournauxDefaut') }, { seedTauxDefaut: recevoir('seedTauxDefaut') }, { seedFamillesDefaut: recevoir('seedFamillesDefaut') }, { seedPlansDefaut: recevoir('seedPlansDefaut') }, { seedNiveauxDefaut: recevoir('seedNiveauxDefaut') });
    return { s, appels, surPrisma, options: () => optionsTransaction };
}
const DTO = { nomEntite: 'X', email: 'a@b.cd', motDePasse: 'motdepasse12', referentiel: client_1.Referentiel.SYCEBNL };
describe('AuthService.register · tout ou rien', () => {
    it('fait passer les NEUF créations par la transaction, sans exception', async () => {
        const { s, appels } = service();
        await s.register(DTO);
        const attendus = [
            'creerTenant',
            'seedPlan',
            'seedJournauxDefaut',
            'seedTauxDefaut',
            'seedFamillesDefaut',
            'seedPlansDefaut',
            'seedNiveauxDefaut',
            'creerExerciceCourant',
        ];
        expect(appels.map((a) => a.nom).sort()).toEqual([...attendus].sort());
        expect(appels.filter((a) => !a.recuTx)).toEqual([]);
    });
    it("l'administrateur est créé DANS la transaction, jamais sur le client ordinaire", async () => {
        const { s, surPrisma } = service();
        await s.register(DTO);
        expect(surPrisma).toEqual([]);
    });
    it('laisse au semis le temps qu’il prend · les cinq secondes par défaut de Prisma ne suffisent pas', async () => {
        const { s, options } = service();
        await s.register(DTO);
        expect(options()?.timeout).toBeGreaterThanOrEqual(30_000);
    });
    it('un semis qui échoue fait remonter l’erreur · la transaction n’avale rien', async () => {
        const { s, appels } = service({ echoueSur: 'seedJournauxDefaut' });
        await expect(s.register(DTO)).rejects.toThrow(/seedJournauxDefaut/);
        expect(appels.map((a) => a.nom)).not.toContain('seedTauxDefaut');
        expect(appels.map((a) => a.nom)).not.toContain('creerExerciceCourant');
    });
});
describe('AuthService.register · au nom du dossier qui naît, dès sa création', () => {
    it('depuis la session d’un autre dossier (siège, console), la création elle-même est l’acte du dossier créé', async () => {
        const { s, appels } = service();
        const r = await (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'siege@exemple.cd', tenantId: 'siege' }, () => s.register(DTO));
        expect(r.tenant.id).not.toBe('t1');
        expect(appels.map((a) => a.dossierDeLActe)).toEqual(appels.map(() => r.tenant.id));
    });
});
describe('F161 · la licence de l’éditeur ne naît à aucune porte de création', () => {
    it('refusée AVANT toute écriture · ni transaction, ni dossier', async () => {
        const { s, appels, surPrisma, options } = service();
        await expect(s.register({ ...DTO, typeLicence: 'PROPRIETAIRE' })).rejects.toThrow(auth_service_1.MOTIF_LICENCE_EDITEUR_A_LA_CREATION);
        expect(appels).toEqual([]);
        expect(surPrisma).toEqual([]);
        expect(options()).toBeUndefined();
    });
    it('les autres types passent · la règle ne vise que l’éditeur', async () => {
        const { s, appels } = service();
        await s.register({ ...DTO, typeLicence: 'PERPETUEL_SAAS' });
        expect(appels.map((a) => a.nom)).toContain('creerTenant');
    });
});
//# sourceMappingURL=inscription-transaction.spec.js.map