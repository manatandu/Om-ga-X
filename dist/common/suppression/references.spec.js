"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const references_1 = require("./references");
function fauxPrisma(comptes) {
    const appels = [];
    const proxy = new Proxy({}, {
        get: (_c, modele) => ({
            count: async ({ where }) => {
                appels.push({ modele, where });
                const cle = `${modele}.${Object.keys(where).find((k) => k !== 'tenantId')}`;
                return comptes[cle] ?? 0;
            },
        }),
    });
    return { proxy, appels };
}
describe('les relations se lisent dans le schéma', () => {
    it('un taux de TVA · ses liens facultatifs sont tous comptés, modèles de saisie compris', async () => {
        const { proxy, appels } = fauxPrisma({});
        await (0, references_1.referencesVers)(proxy, 'TauxTva', 'x', 't');
        expect(appels.map((a) => `${a.modele}.${Object.keys(a.where)[0]}`).sort()).toEqual(['compte.tauxTvaDefautId', 'ligneEcriture.tauxTvaId', 'ligneFacture.tauxTvaId', 'ligneModeleSaisie.tauxTvaId'].sort());
    });
    it('un compte · les lignes d’écriture, le journal de trésorerie et les taux sont dans l’inventaire', async () => {
        const { proxy, appels } = fauxPrisma({});
        await (0, references_1.referencesVers)(proxy, 'Compte', 'x', 't');
        const cles = appels.map((a) => `${a.modele}.${Object.keys(a.where)[0]}`);
        for (const c of ['ligneEcriture.compteId', 'journal.compteTresorerieId', 'tauxTva.compteCollecteId', 'tauxTva.compteDeductibleId', 'tiersCompte.compteId']) {
            expect(cles).toContain(c);
        }
        expect(cles.length).toBeGreaterThanOrEqual(31);
    });
    it('une table cloisonnée est bornée au dossier', async () => {
        const { proxy, appels } = fauxPrisma({});
        await (0, references_1.referencesVers)(proxy, 'Journal', 'j', 't1');
        expect(appels.find((a) => a.modele === 'ecriture').where).toEqual({ journalId: 'j', tenantId: 't1' });
    });
    it('seules les relations utilisées sont rendues, et une exclusion est respectée', async () => {
        const { proxy } = fauxPrisma({ 'ligneEcriture.compteId': 12, 'tiersCompte.compteId': 1 });
        expect(await (0, references_1.referencesVers)(proxy, 'Compte', 'x', 't', ['TiersCompte.compteId'])).toEqual([
            { modele: 'LigneEcriture', champ: 'compteId', nombre: 12 },
        ]);
    });
});
describe('le refus', () => {
    it('nomme chaque usage et propose la mise en sommeil', () => {
        expect(() => (0, references_1.refuserSiReferences)('Le compte 60110000', [{ modele: 'LigneEcriture', champ: 'compteId', nombre: 3 }])).toThrow("Le compte 60110000 ne peut pas être supprimé · il est utilisé : lignes d'écriture (compte mouvementé) (3). Mettez-le en sommeil pour qu’il ne soit plus proposé.");
        expect(() => (0, references_1.refuserSiReferences)('x', [])).not.toThrow();
    });
});
describe('le câblage', () => {
    const lire = (f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../modules', f), 'utf8');
    it.each([
        ['comptes/compte.controller.ts', 'compteService'],
        ['journaux/journal.controller.ts', 'journalService'],
        ['tiers/tiers.controller.ts', 'tiersService'],
        ['tva/taux-tva.controller.ts', 'tauxTvaService'],
    ])('%s · DELETE réservé à l’administrateur', (f, svc) => {
        expect(lire(f)).toContain(`@Roles(RoleUtilisateur.ADMIN_CABINET)\n  @Delete(':id')\n  async supprimer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {\n    return this.${svc}.supprimer(`);
    });
    it.each(['comptes/compte.service.ts', 'journaux/journal.service.ts', 'tiers/tiers.service.ts', 'tva/taux-tva.service.ts'])('%s · la suppression passe par l’inventaire des références', (f) => {
        const src = lire(f);
        const debut = src.indexOf('  async supprimer(');
        expect(debut).toBeGreaterThan(0);
        expect(src.slice(debut, src.indexOf('\n  async ', debut + 5))).toContain('await referencesVers(this.prisma,');
    });
});
//# sourceMappingURL=references.spec.js.map