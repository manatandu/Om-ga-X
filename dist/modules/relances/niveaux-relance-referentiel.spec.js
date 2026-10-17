"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const relances_service_1 = require("./relances.service");
const sansCourrier = () => ({ mettreEnFile: jest.fn() });
function service() {
    const createMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = {
        niveauRelance: { count: jest.fn().mockResolvedValue(0), createMany },
    };
    return { svc: new relances_service_1.RelancesService(prisma, sansCourrier()), createMany };
}
async function modeles(referentiel) {
    const { svc, createMany } = service();
    await svc.seedNiveauxDefaut('t1', referentiel);
    const data = createMany.mock.calls[0][0].data;
    return data;
}
describe('Niveaux de relance semés à la création du dossier', () => {
    it('sème trois niveaux dans les deux référentiels', async () => {
        for (const r of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            const d = await modeles(r);
            expect(d.map((n) => n.niveau)).toEqual([1, 2, 3]);
            expect(d.every((n) => n.modeleTexte.includes('{tiers}') || n.modeleTexte.includes('Madame'))).toBe(true);
            for (const n of d) {
                const date = n.niveau === 1 ? '{echeance}' : '{date}';
                for (const marqueur of ['{montant}', date, '{detail}', '{entite}']) {
                    expect(n.modeleTexte).toContain(marqueur);
                }
            }
        }
    });
    it('ne sert pas la même lettre aux deux référentiels', async () => {
        const sycebnl = (await modeles(client_1.Referentiel.SYCEBNL)).map((n) => n.modeleTexte);
        const syscohada = (await modeles(client_1.Referentiel.SYSCOHADA)).map((n) => n.modeleTexte);
        expect(syscohada).not.toEqual(sycebnl);
    });
    it('la lettre d’une entreprise ne parle pas comme une association', async () => {
        const textes = (await modeles(client_1.Referentiel.SYSCOHADA)).map((n) => n.modeleTexte).join('\n');
        expect(textes).not.toMatch(/adhérent|cotisation|membre|notre entité de poursuivre/i);
    });
    it('n’annonce d’intérêts de retard dans aucun des deux jeux', async () => {
        for (const r of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            const textes = (await modeles(r)).map((n) => n.modeleTexte).join('\n');
            expect(textes).not.toMatch(/intérêt|pénalit/i);
        }
    });
    it('ne sème rien si le dossier porte déjà des niveaux', async () => {
        const createMany = jest.fn();
        const prisma = {
            niveauRelance: { count: jest.fn().mockResolvedValue(3), createMany },
        };
        await new relances_service_1.RelancesService(prisma, sansCourrier()).seedNiveauxDefaut('t1', client_1.Referentiel.SYSCOHADA);
        expect(createMany).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=niveaux-relance-referentiel.spec.js.map