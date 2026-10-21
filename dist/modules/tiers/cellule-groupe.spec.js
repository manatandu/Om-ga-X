"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const tiers_service_1 = require("./tiers.service");
const client_1 = require("@prisma/client");
const DOSSIERS = {
    siege: { id: 'siege', nom: 'Siège national', dossierMereId: null },
    goma: { id: 'goma', nom: 'Antenne de Goma', dossierMereId: 'siege' },
    bukavu: { id: 'bukavu', nom: 'Antenne de Bukavu', dossierMereId: 'siege' },
    autreSiege: { id: 'autreSiege', nom: 'Autre église', dossierMereId: null },
    autreCellule: { id: 'autreCellule', nom: 'Cellule d’une autre église', dossierMereId: 'autreSiege' },
    libre: { id: 'libre', nom: 'Association indépendante', dossierMereId: null },
};
function correspond(d, ou) {
    if (ou.OR) {
        if (!ou.OR.some((sous) => correspond(d, sous)))
            return false;
    }
    if (ou.NOT && d.id === ou.NOT.id)
        return false;
    if (ou.id !== undefined && d.id !== ou.id)
        return false;
    if (ou.dossierMereId !== undefined && d.dossierMereId !== ou.dossierMereId)
        return false;
    return true;
}
function avecTransaction(p) {
    const avec = p;
    avec.$transaction = (f) => f(avec);
    return avec;
}
function service(capture = {}) {
    return new tiers_service_1.TiersService(avecTransaction({
        tenant: {
            findUnique: async ({ where }) => DOSSIERS[where.id] ?? null,
            findUniqueOrThrow: async ({ where }) => DOSSIERS[where.id],
            findMany: async ({ where }) => Object.values(DOSSIERS).filter((d) => correspond(d, where)),
        },
        tiers: {
            findUnique: async () => null,
            findFirst: async () => ({ id: 'ti1', tenantId: 'goma' }),
            create: async ({ data }) => {
                capture.cree = data;
                return data;
            },
            update: async (args) => {
                capture.modifie = args;
                return args;
            },
        },
    }));
}
const base = { code: 'CLI-1', nom: 'Siège', type: client_1.TypeTiers.CLIENT, creerCompteIndividuel: false };
describe('tiers · rattachement à une cellule du groupe', () => {
    it('accepte le dossier mère depuis une cellule', async () => {
        const capture = {};
        await service(capture).creer('goma', { ...base, celluleGroupeId: 'siege' });
        expect(capture.cree).toMatchObject({ celluleGroupeId: 'siege', tenantId: 'goma' });
    });
    it('accepte un dossier sœur depuis une cellule', async () => {
        const capture = {};
        await service(capture).creer('goma', { ...base, celluleGroupeId: 'bukavu' });
        expect(capture.cree).toMatchObject({ celluleGroupeId: 'bukavu' });
    });
    it('accepte une cellule depuis le dossier mère', async () => {
        const capture = {};
        await service(capture).creer('siege', { ...base, celluleGroupeId: 'goma' });
        expect(capture.cree).toMatchObject({ celluleGroupeId: 'goma' });
    });
    it('refuse un dossier d’un AUTRE groupe, sans rien écrire', async () => {
        const capture = {};
        await expect(service(capture).creer('goma', { ...base, celluleGroupeId: 'autreCellule' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(capture.cree).toBeUndefined();
        await expect(service().creer('goma', { ...base, celluleGroupeId: 'autreSiege' })).rejects.toThrow(/groupe d'établissements/);
    });
    it('refuse le dossier courant lui-même, qui partage pourtant sa propre mère', async () => {
        const capture = {};
        await expect(service(capture).creer('goma', { ...base, celluleGroupeId: 'goma' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(capture.cree).toBeUndefined();
    });
    it('refuse tout rattachement depuis un dossier hors groupe', async () => {
        await expect(service().creer('libre', { ...base, celluleGroupeId: 'siege' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('applique la même règle à la MODIFICATION, pas seulement à la création', async () => {
        const capture = {};
        await expect(service(capture).modifier('goma', 'ti1', { celluleGroupeId: 'autreCellule' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(capture.modifie).toBeUndefined();
        await service(capture).modifier('goma', 'ti1', { celluleGroupeId: 'siege' });
        expect(capture.modifie).toMatchObject({ data: { celluleGroupeId: 'siege' } });
    });
    it('laisse passer le détachement (null) sans contrôle', async () => {
        const capture = {};
        await service(capture).modifier('goma', 'ti1', { celluleGroupeId: null });
        expect(capture.modifie).toMatchObject({ data: { celluleGroupeId: null } });
    });
});
describe('tiers · liste des dossiers du groupe servie à l’écran', () => {
    it('depuis le dossier mère : ses cellules, et elles seules', async () => {
        const membres = await service().dossiersDuGroupe('siege');
        expect(membres.map((m) => m.id).sort()).toEqual(['bukavu', 'goma']);
        expect(membres.every((m) => m.estDossierMere === false)).toBe(true);
    });
    it('depuis une cellule : la mère et les sœurs, jamais elle-même', async () => {
        const membres = await service().dossiersDuGroupe('goma');
        expect(membres.map((m) => m.id).sort()).toEqual(['bukavu', 'siege']);
        expect(membres.find((m) => m.id === 'siege').estDossierMere).toBe(true);
    });
    it('depuis un dossier hors groupe : rien', async () => {
        expect(await service().dossiersDuGroupe('libre')).toEqual([]);
    });
});
describe('tiers · les deux données de TVA d’après les débits se posent et se retirent', () => {
    it('enregistre la mention lue sur la facture et la référence de la décision', async () => {
        const capture = {};
        await service(capture).creer('goma', {
            ...base,
            type: client_1.TypeTiers.FOURNISSEUR,
            autoriseTvaDebits: true,
            referenceAutorisationDebits: 'DGI/DI/2026-118',
        });
        expect(capture.cree).toMatchObject({ autoriseTvaDebits: true, referenceAutorisationDebits: 'DGI/DI/2026-118' });
    });
    it('ne pose rien quand le comptable n’a rien saisi', async () => {
        const capture = {};
        await service(capture).creer('goma', base);
        expect(capture.cree.autoriseTvaDebits).toBeUndefined();
        expect(capture.cree.celluleGroupeId).toBeUndefined();
    });
    it('révoque l’autorisation par une simple modification', async () => {
        const capture = {};
        await service(capture).modifier('goma', 'ti1', { autoriseTvaDebits: false, referenceAutorisationDebits: null });
        expect(capture.modifie).toMatchObject({
            data: { autoriseTvaDebits: false, referenceAutorisationDebits: null },
        });
    });
});
//# sourceMappingURL=cellule-groupe.spec.js.map