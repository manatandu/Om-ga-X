"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const selections_edition_service_1 = require("./selections-edition.service");
const selections_edition_1 = require("./selections-edition");
const DOSSIER = 'dossier-1';
const AUTRE = 'dossier-2';
function nouveauFaux() {
    const lignes = [];
    const journaux = [{ id: 'jnl-od', tenantId: DOSSIER }, { id: 'jnl-voisin', tenantId: AUTRE }];
    let n = 0;
    const filtre = (l, where) => Object.entries(where).every(([k, v]) => l[k] === v);
    const prisma = {
        selectionEdition: {
            findMany: async ({ where, take }) => lignes
                .filter((l) => filtre(l, where))
                .sort((a, b) => a.nom.localeCompare(b.nom))
                .slice(0, take)
                .map((l) => ({ ...l })),
            count: async ({ where }) => lignes.filter((l) => filtre(l, where)).length,
            findFirst: async ({ where }) => lignes.find((l) => filtre(l, where)) ?? null,
            create: async ({ data }) => {
                if (lignes.some((l) => l.tenantId === data.tenantId && l.edition === data.edition && l.nom === data.nom)) {
                    throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
                }
                const l = { id: `sel-${++n}`, creeLe: new Date(), modifieLe: new Date(), ...data };
                lignes.push(l);
                return { ...l };
            },
            update: async ({ where, data }) => Object.assign(lignes.find((l) => l.id === where.id), data),
            delete: async ({ where }) => lignes.splice(lignes.findIndex((l) => l.id === where.id), 1)[0],
        },
        journal: {
            findFirst: async ({ where }) => journaux.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null,
            findMany: async ({ where }) => journaux.filter((j) => j.tenantId === where.tenantId && where.id.in.includes(j.id)),
        },
        user: { findMany: async () => [{ id: 'u1', email: 'comptable@cabinet.cd' }] },
    };
    return { service: new selections_edition_service_1.SelectionsEditionService(prisma), lignes, journaux };
}
describe('sélections enregistrées · au dossier', () => {
    it('une sélection garde les critères de son édition, sans valeur vide, et se rappelle avec son auteur', async () => {
        const f = nouveauFaux();
        await f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, '  Achats du premier trimestre ', {
            journalId: 'jnl-od',
            dateDebut: '2026-01-01',
            dateFin: '2026-03-31',
            recherche: '',
            inclureBrouillard: false,
        });
        const l = await f.service.lister(DOSSIER, client_1.EditionSelection.JOURNAL);
        expect(l.selections.map((s) => [s.nom, s.criteres, s.creePar, s.journalIntrouvable])).toEqual([
            ['Achats du premier trimestre', { journalId: 'jnl-od', dateDebut: '2026-01-01', dateFin: '2026-03-31', inclureBrouillard: false }, 'comptable@cabinet.cd', false],
        ]);
        expect((await f.service.lister(DOSSIER, client_1.EditionSelection.IMPRESSION_DIFFEREE)).total).toBe(0);
        expect((await f.service.lister(AUTRE, client_1.EditionSelection.JOURNAL)).total).toBe(0);
    });
    it('un même nom dans la même édition est refusé, avec ses deux issues', async () => {
        const f = nouveauFaux();
        await f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, 'Banque', { compte: '52' });
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, 'Banque', { compte: '521' })).rejects.toThrow(/porte déjà le nom « Banque » · remplacez-la ou choisissez un autre nom/);
        await f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.IMPRESSION_DIFFEREE, 'Banque', { nature: 'BALANCE' });
    });
    it('le journal d’un autre dossier, l’exercice, une clé inconnue ou une date illisible sont refusés', async () => {
        const f = nouveauFaux();
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, 'X', { journalId: 'jnl-voisin' })).rejects.toThrow(/Journal introuvable/);
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, 'X', { exerciceId: 'e' })).rejects.toThrow(/ne garde pas l'exercice/);
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, 'X', { format: 'plat' })).rejects.toThrow(/Critère inconnu/);
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, 'X', { dateDebut: '31/03/2026' })).rejects.toThrow(/AAAA-MM-JJ/);
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, '   ', {})).rejects.toThrow(/nom de la sélection est exigé/);
        expect(f.lignes).toHaveLength(0);
    });
    it('remplacer change les critères, jamais l’édition ni le nom ; supprimer retire la sélection du seul dossier', async () => {
        const f = nouveauFaux();
        const s = await f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.IMPRESSION_DIFFEREE, 'Grand livre à plat', { nature: 'GRAND_LIVRE', format: 'plat' });
        await f.service.remplacer(DOSSIER, s.id, { nature: 'GRAND_LIVRE', format: 'fpm' });
        expect(f.lignes[0]).toMatchObject({ nom: 'Grand livre à plat', edition: client_1.EditionSelection.IMPRESSION_DIFFEREE, criteres: { nature: 'GRAND_LIVRE', format: 'fpm' } });
        await expect(f.service.remplacer(DOSSIER, s.id, { format: 'pdf' })).rejects.toThrow(/« fpm », « plat »/);
        await expect(f.service.supprimer(AUTRE, s.id)).rejects.toThrow(/introuvable/);
        await f.service.supprimer(DOSSIER, s.id);
        expect(f.lignes).toHaveLength(0);
    });
    it('un journal retiré depuis l’enregistrement se dit au rappel', async () => {
        const f = nouveauFaux();
        await f.service.creer(DOSSIER, 'u1', client_1.EditionSelection.JOURNAL, 'OD', { journalId: 'jnl-od' });
        f.journaux.splice(0, 1);
        const l = await f.service.lister(DOSSIER, client_1.EditionSelection.JOURNAL);
        expect(l.selections[0].journalIntrouvable).toBe(true);
    });
});
describe('sélections enregistrées · règles pures', () => {
    it('les critères du journal sont exactement les filtres de sa fenêtre, relus dans sa source', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../../client/src/pages/JournalPage.tsx'), 'utf8');
        const bloc = source.slice(source.indexOf('interface Filtres {'), source.indexOf('\n}', source.indexOf('interface Filtres {')));
        const filtres = [...bloc.matchAll(/^  (\w+): /gm)].map((m) => m[1]);
        expect(filtres.length).toBeGreaterThan(5);
        expect(Object.keys(selections_edition_1.CRITERES_PAR_EDITION.JOURNAL).sort()).toEqual(filtres.sort());
        expect(Object.keys(selections_edition_1.CRITERES_PAR_EDITION.JOURNAL)).not.toContain('exerciceId');
        expect(Object.keys(selections_edition_1.CRITERES_PAR_EDITION.IMPRESSION_DIFFEREE)).not.toContain('exerciceId');
    });
    it('un booléen reste un booléen, un nom se borne', () => {
        expect((0, selections_edition_1.criteresSelectionOuMotif)(client_1.EditionSelection.JOURNAL, { inclureBrouillard: 'false' })).toEqual({ motif: 'Critère « inclureBrouillard » · oui ou non.' });
        expect((0, selections_edition_1.criteresSelectionOuMotif)(client_1.EditionSelection.JOURNAL, [])).toEqual({ motif: 'Les critères de la sélection sont illisibles.' });
        expect((0, selections_edition_1.nomOuMotif)('x'.repeat(61))).toEqual({ motif: 'Le nom de la sélection tient en 60 caractères au plus.' });
    });
});
//# sourceMappingURL=selections-edition.spec.js.map