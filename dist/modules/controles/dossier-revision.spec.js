"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dossier_revision_service_1 = require("./dossier-revision.service");
function service(mouvements, comptes) {
    const prisma = {
        ligneEcriture: {
            groupBy: jest.fn(async ({ where }) => {
                const parCompte = new Map();
                for (const m of mouvements) {
                    if (m.soldeDeGestion && where.ecriture.estSoldeDesComptesDeGestion === false)
                        continue;
                    const a = parCompte.get(m.compteId) ?? { debit: 0, credit: 0 };
                    a.debit += m.debit;
                    a.credit += m.credit;
                    parCompte.set(m.compteId, a);
                }
                return [...parCompte].map(([compteId, s]) => ({ compteId, _sum: s }));
            }),
        },
        compte: {
            findMany: jest.fn(async ({ where }) => comptes.filter((c) => where.id.in.includes(c.id))),
        },
    };
    return new dossier_revision_service_1.DossierRevisionService(prisma);
}
describe('Dossier de révision · un exercice clos', () => {
    it('rend la charge de l’année, pas le zéro du solde de clôture (régression de F4)', async () => {
        const svc = service([
            { compteId: 'c-601', debit: 400, credit: 0 },
            { compteId: 'c-601', debit: 0, credit: 400, soldeDeGestion: true },
            { compteId: 'c-131', debit: 400, credit: 0, soldeDeGestion: true },
        ], [
            { id: 'c-601', numero: '60110000', intitule: 'Achats' },
            { id: 'c-131', numero: '13100000', intitule: 'Résultat' },
        ]);
        const { comptes } = await svc.dossier('t-1', 'ex-1', client_1.Referentiel.SYSCOHADA);
        expect(comptes.map((c) => [c.numero, c.debit, c.credit, c.solde])).toEqual([['60110000', 400, 0, 400]]);
    });
});
//# sourceMappingURL=dossier-revision.spec.js.map