"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const client_1 = require("@prisma/client");
const tenant_service_1 = require("./tenant.service");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const groupe_controller_1 = require("../groupe/groupe.controller");
function service(referentiel, capture = {}) {
    return new tenant_service_1.TenantService({
        tenant: {
            findUnique: async () => ({ id: 't1', referentiel }),
            findUniqueOrThrow: async () => ({ id: 't1', referentiel }),
            update: async ({ data }) => {
                capture.data = data;
                return { id: 't1' };
            },
        },
        exercice: { findFirst: async () => null, count: async () => 0 },
        ecriture: { count: async () => 0 },
        compte: { findMany: async () => [] },
    });
}
describe('identifiants légaux · chacun son référentiel', () => {
    it('refuse un RCCM à une entité à but non lucratif, et cite le texte', async () => {
        const capture = {};
        await expect(service(client_1.Referentiel.SYCEBNL, capture).modifierIdentite('t1', { rccm: 'CD/KIN/RCCM/24-B-1' }))
            .rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(service(client_1.Referentiel.SYCEBNL).modifierIdentite('t1', { rccm: 'X' })).rejects.toThrow(/AUDCG/);
        expect(capture.data).toBeUndefined();
    });
    it('refuse les identifiants d’ASBL à une société commerciale', async () => {
        const champs = [
            { actePersonnaliteJuridique: 'ARR-2024-01' },
            { numeroEnregistrementSecteur: 'SEC-9' },
            { certificatEnregistrementPlan: 'PLAN-9' },
            { attestationExemptionIs: 'EX-9' },
            { dateActePersonnalite: '2024-01-01' },
        ];
        for (const champ of champs) {
            const capture = {};
            await expect(service(client_1.Referentiel.SYSCOHADA, capture).modifierIdentite('t1', champ)).rejects.toBeInstanceOf(common_1.BadRequestException);
            expect(`${Object.keys(champ)[0]} écrit ? ${capture.data !== undefined}`).toBe(`${Object.keys(champ)[0]} écrit ? false`);
        }
    });
    it('laisse EFFACER un identifiant hérité, dans les deux sens', async () => {
        const capture = {};
        await service(client_1.Referentiel.SYCEBNL, capture).modifierIdentite('t1', { rccm: '' });
        expect(capture.data.rccm).toBeNull();
        const capture2 = {};
        await service(client_1.Referentiel.SYSCOHADA, capture2).modifierIdentite('t1', { attestationExemptionIs: '  ' });
        expect(capture2.data.attestationExemptionIs).toBeNull();
    });
    it('laisse passer les identifiants COMMUNS aux deux référentiels', async () => {
        for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            const capture = {};
            await service(referentiel, capture).modifierIdentite('t1', { numeroImpot: 'A1234567X', idNat: '01-A-4567' });
            expect(capture.data.numeroImpot).toBe('A1234567X');
            expect(capture.data.idNat).toBe('01-A-4567');
        }
    });
});
describe('module groupe · les deux référentiels, sauf le canevas', () => {
    it('le contrôleur autorise le SYCEBNL et le SYSCOHADA, sous sa garde', () => {
        expect(Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, groupe_controller_1.GroupeController)).toEqual([client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]);
        expect(Reflect.getMetadata(constants_1.GUARDS_METADATA, groupe_controller_1.GroupeController)).toContain(referentiel_guard_1.ReferentielGuard);
    });
    it('le canevas de trésorerie reste au SYCEBNL · ses rubriques sont des comptes de son plan', () => {
        const proto = groupe_controller_1.GroupeController.prototype;
        expect(Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, proto.canevas)).toEqual([client_1.Referentiel.SYCEBNL]);
        expect(Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, proto.importerCanevas)).toEqual([client_1.Referentiel.SYCEBNL]);
        expect(Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, proto.balanceAgregee)).toBeUndefined();
        expect(Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, proto.liasseGroupe)).toBeUndefined();
    });
    it('la fenêtre du client est commune aux deux référentiels', () => {
        const registre = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../client/src/lib/registre-fenetres.tsx'), 'utf8');
        const bloc = registre.slice(registre.indexOf("motif: /^\\/groupe$/"), registre.indexOf("motif: /^\\/groupe$/") + 600);
        expect(bloc).toContain('FENÊTRE COMMUNE AUX DEUX RÉFÉRENTIELS');
    });
});
describe('entreprise du portefeuille de l’État · O.-L. n° 13/003, art. 112 et 113', () => {
    function avecForme(referentiel, forme, capture = {}) {
        const t = { id: 't1', referentiel, formeJuridiqueSyscohada: forme };
        return new tenant_service_1.TenantService({
            tenant: {
                findUnique: async () => t,
                findUniqueOrThrow: async () => t,
                update: async ({ data }) => {
                    capture.data = data;
                    return { id: 't1' };
                },
            },
            exercice: { findFirst: async () => null, count: async () => 0 },
            ecriture: { count: async () => 0 },
            compte: { findMany: async () => [] },
        });
    }
    it('se déclare oui, non, pas encore dit pour une société commerciale', async () => {
        const capture = {};
        await avecForme(client_1.Referentiel.SYSCOHADA, 'SOCIETE_ANONYME', capture).modifierIdentite('t1', { entreprisePortefeuilleEtat: 'OUI' });
        expect(capture.data?.entreprisePortefeuilleEtat).toBe(true);
        await avecForme(client_1.Referentiel.SYSCOHADA, 'SOCIETE_ANONYME', capture).modifierIdentite('t1', {
            entreprisePortefeuilleEtat: 'PAS_ENCORE_DIT',
        });
        expect(capture.data?.entreprisePortefeuilleEtat).toBeNull();
        const rien = {};
        await avecForme(client_1.Referentiel.SYSCOHADA, 'SOCIETE_ANONYME', rien).modifierIdentite('t1', {});
        expect(rien.data && 'entreprisePortefeuilleEtat' in rien.data).toBe(false);
    });
    it('« oui » refusé, nommé, hors des cinq sociétés commerciales · association, entreprenant, entité publique, forme non dite', async () => {
        for (const [referentiel, forme] of [
            [client_1.Referentiel.SYCEBNL, null],
            [client_1.Referentiel.SYSCOHADA, 'ENTREPRENANT'],
            [client_1.Referentiel.SYSCOHADA, 'ENTREPRISE_INDIVIDUELLE'],
            [client_1.Referentiel.SYSCOHADA, 'ENTITE_PUBLIQUE'],
            [client_1.Referentiel.SYSCOHADA, null],
        ]) {
            await expect(avecForme(referentiel, forme).modifierIdentite('t1', { entreprisePortefeuilleEtat: 'OUI' })).rejects.toThrow('loi n° 08/010, art. 3');
        }
    });
    it('secteur minier et quote-part · sous le portefeuille seulement, la quote-part avec sa source', async () => {
        const sa = (faits, capture = {}) => {
            const t = { id: 't1', referentiel: client_1.Referentiel.SYSCOHADA, formeJuridiqueSyscohada: 'SOCIETE_ANONYME', ...faits };
            return new tenant_service_1.TenantService({
                tenant: {
                    findUnique: async () => t,
                    findUniqueOrThrow: async () => t,
                    update: async ({ data }) => {
                        capture.data = data;
                        return { id: 't1' };
                    },
                },
                exercice: { findFirst: async () => null, count: async () => 0 },
                ecriture: { count: async () => 0 },
                compte: { findMany: async () => [] },
            });
        };
        const nonDit = { entreprisePortefeuilleEtat: null, quotePartEtatCapital: null, sourceQuotePartEtat: null };
        await expect(sa(nonDit).modifierIdentite('t1', { portefeuilleSecteurMinier: 'OUI' })).rejects.toThrow('déclarez d’abord cette qualité');
        await expect(sa(nonDit).modifierIdentite('t1', { quotePartEtatCapital: 20, sourceQuotePartEtat: 'Statuts' })).rejects.toThrow('déclarez d’abord cette qualité');
        const oui = { entreprisePortefeuilleEtat: true, quotePartEtatCapital: null, sourceQuotePartEtat: null };
        await expect(sa(oui).modifierIdentite('t1', { quotePartEtatCapital: 20 })).rejects.toThrow('se déclare avec sa source');
        await expect(sa(oui).modifierIdentite('t1', { sourceQuotePartEtat: 'Statuts' })).rejects.toThrow('déclarez d’abord la quote-part');
        const capture = {};
        await sa(oui, capture).modifierIdentite('t1', {
            portefeuilleSecteurMinier: 'OUI',
            quotePartEtatCapital: 60,
            sourceQuotePartEtat: '  Statuts, art. 6 ',
        });
        expect(capture.data).toMatchObject({ portefeuilleSecteurMinier: true, quotePartEtatCapital: 60, sourceQuotePartEtat: 'Statuts, art. 6' });
        const efface = {};
        await sa({ ...oui, quotePartEtatCapital: '60', sourceQuotePartEtat: 'Statuts' }, efface).modifierIdentite('t1', {
            quotePartEtatCapital: null,
        });
        expect(efface.data).toMatchObject({ quotePartEtatCapital: null, sourceQuotePartEtat: null });
    });
});
//# sourceMappingURL=identifiants-referentiel.spec.js.map