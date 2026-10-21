"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt = require("bcryptjs");
const client_1 = require("@prisma/client");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
function chaine(existants = []) {
    const ecrits = [...existants];
    const tx = {
        $executeRaw: async () => 1,
        $queryRaw: async () => [],
        evenementAudit: {
            findFirst: async ({ where }) => ecrits.filter((m) => m.tenantId === where.tenantId).sort((a, b) => b.rang - a.rang)[0] ?? null,
            create: async ({ data }) => {
                ecrits.push(data);
                return data;
            },
        },
    };
    return { ecrits, clientNu: { $transaction: async (f) => f(tx) } };
}
async function service(user, clientNu) {
    return new auth_service_1.AuthService({
        user: { findUnique: async () => user, update: async () => ({}) },
        clientNu,
    }, { sign: () => 'jeton' }, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
}
async function utilisateur() {
    return {
        id: 'u1',
        email: 'chef@asbl.cd',
        tenantId: 'd1',
        motDePasse: await bcrypt.hash('le-bon', 4),
        estActif: true,
        tentativesEchouees: 0,
        verrouilleJusqua: null,
        dernierEchecLe: null,
        doubleAuthActiveDepuis: null,
        estOperateurPlateforme: false,
    };
}
describe('la connexion réussie est inscrite au journal d’audit (art. 219, 14°)', () => {
    it('écrit un maillon CONNEXION · qui, quel dossier, d’où, à la suite de la chaîne du dossier', async () => {
        const c = chaine([
            { tenantId: 'd1', rang: 7, empreinte: 'e7' },
            { tenantId: 'autre', rang: 40, empreinte: 'x40' },
        ]);
        await (await service(await utilisateur(), c.clientNu)).login({ email: 'chef@asbl.cd', motDePasse: 'le-bon' }, '41.243.0.9');
        const nouveau = c.ecrits.slice(2);
        expect(nouveau).toHaveLength(1);
        expect(nouveau[0]).toMatchObject({
            action: client_1.ActionAudit.CONNEXION,
            tenantId: 'd1',
            acteurId: 'u1',
            acteurEmail: 'chef@asbl.cd',
            adresseIp: '41.243.0.9',
            entite: 'User',
            entiteId: 'u1',
            rang: 8,
            empreintePrecedente: 'e7',
        });
    });
    it('un refus n’est pas un accès · le mot de passe faux n’écrit aucun maillon', async () => {
        const c = chaine();
        await expect((await service(await utilisateur(), c.clientNu)).login({ email: 'chef@asbl.cd', motDePasse: 'faux' }, '1.2.3.4')).rejects.toThrow();
        expect(c.ecrits).toHaveLength(0);
    });
    it('un maillon non écrit ne refuse pas la connexion', async () => {
        const enPanne = { $transaction: async () => { throw new Error('table indisponible'); } };
        const r = await (await service(await utilisateur(), enPanne)).login({ email: 'chef@asbl.cd', motDePasse: 'le-bon' }, null);
        expect(r).toHaveProperty('csrfToken');
    });
    it('le contrôleur transmet `req.ip`, l’adresse que règlent les relais de confiance', async () => {
        const recus = [];
        const controleur = new auth_controller_1.AuthController({ login: async (...args) => { recus.push(...args); return { accessToken: 'j', csrfToken: 'c' }; } }, { get: () => undefined });
        const res = { cookie: () => undefined, req: { secure: true, hostname: 'oomega.web.app' } };
        await controleur.login({ email: 'a@b.cd', motDePasse: 'x' }, res, { ip: '41.243.0.9' });
        expect(recus[1]).toBe('41.243.0.9');
    });
});
//# sourceMappingURL=connexion-auditee.spec.js.map