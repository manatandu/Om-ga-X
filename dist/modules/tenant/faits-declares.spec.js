"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const faits_declares_1 = require("./faits-declares");
describe('Faits déclarés · la troisième valeur n\'est pas « non »', () => {
    it('la réponse sur la TVA écrit le booléen ET le fait d\'avoir répondu', () => {
        expect((0, faits_declares_1.donneesAssujettissementTva)('OUI', undefined)).toEqual({ assujettiTva: true, assujettissementTvaRepondu: true });
        expect((0, faits_declares_1.donneesAssujettissementTva)('NON', undefined)).toEqual({ assujettiTva: false, assujettissementTvaRepondu: true });
    });
    it('« pas encore dit » efface la réponse et remet le booléen à faux (TVA posée d\'office)', () => {
        expect((0, faits_declares_1.donneesAssujettissementTva)('PAS_ENCORE_DIT', true)).toEqual({ assujettiTva: false, assujettissementTvaRepondu: false });
    });
    it('l\'ancien booléen seul vaut réponse ; rien envoyé, rien écrit', () => {
        expect((0, faits_declares_1.donneesAssujettissementTva)(undefined, false)).toEqual({ assujettiTva: false, assujettissementTvaRepondu: true });
        expect((0, faits_declares_1.donneesAssujettissementTva)(undefined, undefined)).toEqual({});
    });
    it('la vente : oui, non, ou null pour « pas encore dit »', () => {
        expect((0, faits_declares_1.donneesVenteBiensServices)('OUI')).toEqual({ venteBiensServices: true });
        expect((0, faits_declares_1.donneesVenteBiensServices)('NON')).toEqual({ venteBiensServices: false });
        expect((0, faits_declares_1.donneesVenteBiensServices)('PAS_ENCORE_DIT')).toEqual({ venteBiensServices: null });
        expect((0, faits_declares_1.donneesVenteBiensServices)(undefined)).toEqual({});
    });
    it('le fait lu par les menus · null tant que la question n\'est pas répondue', () => {
        expect((0, faits_declares_1.faitAssujettissementTva)({ assujettiTva: false, assujettissementTvaRepondu: false })).toBeNull();
        expect((0, faits_declares_1.faitAssujettissementTva)({ assujettiTva: false, assujettissementTvaRepondu: true })).toBe(false);
        expect((0, faits_declares_1.faitAssujettissementTva)({ assujettiTva: true, assujettissementTvaRepondu: true })).toBe(true);
    });
});
describe('Câblage · modifierRegime écrit ce que la règle rend', () => {
    it('passe la réponse TVA et la vente au dossier', async () => {
        const { TenantService } = await Promise.resolve().then(() => require('./tenant.service'));
        let data = {};
        const prisma = {
            tenant: {
                findUnique: async () => ({ id: 't1' }),
                update: async (args) => { data = args.data; },
            },
        };
        const s = new TenantService(prisma);
        s.parametres = async () => null;
        await s.modifierRegime('t1', { reponseAssujettissementTva: 'NON', venteBiensServices: 'PAS_ENCORE_DIT' });
        expect(data).toMatchObject({ assujettiTva: false, assujettissementTvaRepondu: true, venteBiensServices: null });
    });
});
//# sourceMappingURL=faits-declares.spec.js.map