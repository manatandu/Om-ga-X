"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const auth_service_1 = require("./auth.service");
function me(tenant) {
    const user = {
        id: 'u1',
        email: 'a@b.cd',
        role: 'ADMIN_CABINET',
        estOperateurPlateforme: false,
        doitChangerMotDePasse: false,
        tenant: { id: 't1', nom: 'X', _count: { cellules: 0 }, ...tenant },
    };
    const s = new auth_service_1.AuthService({ user: { findUnique: async () => user } }, { sign: () => 'jeton' }, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
    return s.me('u1');
}
describe('/auth/me · le fait « ONG de droit étranger »', () => {
    it('vrai pour une ONG de droit étranger seulement', async () => {
        const base = { referentiel: 'SYCEBNL', jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' };
        expect((await me({ ...base, formeJuridique: 'ORGANISATION_NON_GOUVERNEMENTALE', droitEtranger: true })).tenant.ongEtrangere).toBe(true);
        expect((await me({ ...base, formeJuridique: 'ORGANISATION_NON_GOUVERNEMENTALE', droitEtranger: false })).tenant.ongEtrangere).toBe(false);
        expect((await me({ ...base, formeJuridique: 'ASSOCIATION', droitEtranger: true })).tenant.ongEtrangere).toBe(false);
    });
    it('null hors SYCEBNL, où la question ne se pose pas', async () => {
        expect((await me({ referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' })).tenant.ongEtrangere).toBeNull();
    });
});
describe('/auth/me · assujettissement à la TVA et ventes, trois valeurs', () => {
    const base = { referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' };
    it('le faux par défaut, sans réponse, vaut « pas encore dit »', async () => {
        const t = (await me({ ...base, assujettiTva: false, assujettissementTvaRepondu: false, venteBiensServices: null })).tenant;
        expect(t.assujettissementTva).toBeNull();
        expect(t.venteBiensServices).toBeNull();
    });
    it('une réponse donnée est rendue telle quelle', async () => {
        const t = (await me({ ...base, assujettiTva: false, assujettissementTvaRepondu: true, venteBiensServices: false })).tenant;
        expect(t.assujettissementTva).toBe(false);
        expect(t.venteBiensServices).toBe(false);
        expect((await me({ ...base, assujettiTva: true, assujettissementTvaRepondu: true })).tenant.assujettissementTva).toBe(true);
    });
});
describe('/auth/me · la longueur des numéros de compte (audit final F144)', () => {
    it('porte la borne du dossier, que la saisie du plan de comptes impose', async () => {
        const t = (await me({ referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL', longueurCompte: 12 })).tenant;
        expect(t.longueurCompte).toBe(12);
    });
});
describe('/auth/me · la vitrine se dit fictive (dossiers de démonstration)', () => {
    const base = { referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' };
    it('porte le drapeau du dossier, que le bandeau du chrome lit', async () => {
        expect((await me({ ...base, estDemonstration: true })).tenant.estDemonstration).toBe(true);
        expect((await me({ ...base, estDemonstration: false })).tenant.estDemonstration).toBe(false);
    });
    it('jamais le nom · un client qui s’appelle « Démo » n’est pas une vitrine, et l’absence vaut faux', async () => {
        expect((await me({ ...base, nom: 'Démo SARL', estDemonstration: false })).tenant.estDemonstration).toBe(false);
        expect((await me({ ...base })).tenant.estDemonstration).toBe(false);
    });
});
//# sourceMappingURL=me-fait-ong-etrangere.spec.js.map