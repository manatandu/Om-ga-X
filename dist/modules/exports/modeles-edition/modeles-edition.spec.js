"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const modeles_edition_service_1 = require("./modeles-edition.service");
const modeles_edition_1 = require("./modeles-edition");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const modele_edition_dto_1 = require("./dto/modele-edition.dto");
const DOSSIER = 'dossier-1';
const AUTRE = 'dossier-2';
function nouveauFaux() {
    const lignes = [];
    let n = 0;
    const filtre = (l, where) => Object.entries(where).every(([k, v]) => l[k] === v);
    const prisma = {
        modeleEdition: {
            findMany: async ({ where, take }) => lignes.filter((l) => filtre(l, where)).sort((a, b) => a.nom.localeCompare(b.nom)).slice(0, take).map((l) => ({ ...l })),
            count: async ({ where }) => lignes.filter((l) => filtre(l, where)).length,
            findFirst: async ({ where }) => lignes.find((l) => filtre(l, where)) ?? null,
            create: async ({ data }) => {
                if (lignes.some((l) => l.tenantId === data.tenantId && l.edition === data.edition && l.nom === data.nom)) {
                    throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
                }
                const l = { id: `mod-${++n}`, ...data };
                lignes.push(l);
                return { ...l };
            },
            update: async ({ where, data }) => Object.assign(lignes.find((l) => l.id === where.id), data),
            delete: async ({ where }) => lignes.splice(lignes.findIndex((l) => l.id === where.id), 1)[0],
        },
    };
    return { service: new modeles_edition_service_1.ModelesEditionService(prisma), lignes };
}
describe('modèles d’édition · au dossier', () => {
    it('un modèle garde ses colonnes facultatives dans l’ordre de l’édition, jamais une colonne qui identifie', async () => {
        const f = nouveauFaux();
        const m = await f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_COMPTABLE, {
            nom: ' Liste courte ',
            colonnes: ['etat', 'numero', 'nature'],
            saut: client_1.SautEdition.PAGE,
        });
        expect([m.nom, m.colonnes, m.saut]).toEqual(['Liste courte', ['nature', 'etat'], client_1.SautEdition.PAGE]);
        expect((await f.service.lister(DOSSIER, client_1.EditionModele.PLAN_COMPTABLE)).total).toBe(1);
        expect((await f.service.lister(DOSSIER, client_1.EditionModele.PLAN_TIERS)).total).toBe(0);
        expect((await f.service.lister(AUTRE, client_1.EditionModele.PLAN_COMPTABLE)).total).toBe(0);
    });
    it('refuse le nom du modèle intégré, un nom en double, une colonne d’une autre édition, un saut inconnu', async () => {
        const f = nouveauFaux();
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_TIERS, { nom: 'standard', colonnes: [] })).rejects.toThrow(/modèle intégré/);
        await f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_TIERS, { nom: 'Annuaire', colonnes: ['ville', 'telephone'] });
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_TIERS, { nom: 'Annuaire', colonnes: [] })).rejects.toThrow(/porte déjà le nom « Annuaire » · remplacez-le ou choisissez un autre nom/);
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_TIERS, { nom: 'X', colonnes: ['lettrable'] })).rejects.toThrow(/Colonne inconnue/);
        await expect(f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_TIERS, { nom: 'X', colonnes: [], saut: 'COLONNE' })).rejects.toThrow(/Saut inconnu/);
    });
    it('remplacer change colonnes et saut, jamais l’édition ni le nom ; supprimer, du seul dossier', async () => {
        const f = nouveauFaux();
        const m = await f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_ANALYTIQUE, { nom: 'Bailleurs', colonnes: ['bailleur'] });
        await f.service.remplacer(DOSSIER, m.id, { colonnes: ['bailleur', 'debut', 'fin'], saut: client_1.SautEdition.LIGNE });
        expect(f.lignes[0]).toMatchObject({ nom: 'Bailleurs', edition: client_1.EditionModele.PLAN_ANALYTIQUE, colonnes: ['bailleur', 'debut', 'fin'], saut: client_1.SautEdition.LIGNE });
        await expect(f.service.supprimer(AUTRE, m.id)).rejects.toThrow(/introuvable/);
        await f.service.supprimer(DOSSIER, m.id);
        expect(f.lignes).toHaveLength(0);
    });
});
describe('modèles d’édition · le saut absent n’est pas le saut nul (mineur 5)', () => {
    it('un remplacement sans saut garde le saut de page du modèle', async () => {
        const f = nouveauFaux();
        const m = await f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_ANALYTIQUE, { nom: 'Par page', colonnes: [], saut: client_1.SautEdition.PAGE });
        await f.service.remplacer(DOSSIER, m.id, { colonnes: ['bailleur'] });
        expect(f.lignes[0]).toMatchObject({ colonnes: ['bailleur'], saut: client_1.SautEdition.PAGE });
    });
    it('un saut nul est refusé, à la porte comme au service, jamais lu comme « Aucun »', async () => {
        const remplacement = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(modele_edition_dto_1.RemplacerModeleEditionDto, { colonnes: [], saut: null }));
        expect(remplacement.map((e) => e.property)).toEqual(['saut']);
        const creation = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(modele_edition_dto_1.CreerModeleEditionDto, { edition: client_1.EditionModele.PLAN_ANALYTIQUE, nom: 'X', colonnes: [], saut: null }));
        expect(creation.map((e) => e.property)).toEqual(['saut']);
        expect(await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(modele_edition_dto_1.RemplacerModeleEditionDto, { colonnes: [] }))).toHaveLength(0);
        const f = nouveauFaux();
        const m = await f.service.creer(DOSSIER, 'u1', client_1.EditionModele.PLAN_ANALYTIQUE, { nom: 'Par page', colonnes: [], saut: client_1.SautEdition.PAGE });
        await expect(f.service.remplacer(DOSSIER, m.id, { colonnes: [], saut: null })).rejects.toThrow(/Saut inconnu/);
        expect(f.lignes[0]).toMatchObject({ saut: client_1.SautEdition.PAGE });
    });
});
describe('modèles d’édition · règles et miroir', () => {
    it('chaque édition a ses deux colonnes qui identifient, en tête', () => {
        for (const cat of Object.values(modeles_edition_1.COLONNES_PAR_EDITION)) {
            expect(cat.slice(0, 2).every((c) => c.identifiante)).toBe(true);
            expect(cat.slice(2).every((c) => !c.identifiante)).toBe(true);
        }
    });
    it('le catalogue de l’écran est celui du serveur, relu dans sa source', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../../client/src/lib/modeles-edition.ts'), 'utf8');
        for (const edition of Object.values(client_1.EditionModele)) {
            const debut = source.indexOf(`  ${edition}: [`);
            expect(debut).toBeGreaterThan(0);
            const bloc = source.slice(debut, source.indexOf('  ],', debut));
            const lues = [...bloc.matchAll(/\{ cle: '(\w+)', libelle: '[^']*', identifiante: (true|false) \}/g)].map((m) => ({
                cle: m[1],
                identifiante: m[2] === 'true',
            }));
            expect([edition, lues]).toEqual([edition, modeles_edition_1.COLONNES_PAR_EDITION[edition]]);
        }
    });
    it('un nom vide ou trop long, des colonnes illisibles ou en double sont refusés', () => {
        expect((0, modeles_edition_1.modeleOuMotif)(client_1.EditionModele.PLAN_COMPTABLE, { nom: '', colonnes: [] })).toEqual({ motif: 'Le nom du modèle est exigé.' });
        expect((0, modeles_edition_1.modeleOuMotif)(client_1.EditionModele.PLAN_COMPTABLE, { nom: 'x'.repeat(61), colonnes: [] })).toEqual({
            motif: 'Le nom du modèle tient en 60 caractères au plus.',
        });
        expect((0, modeles_edition_1.modeleOuMotif)(client_1.EditionModele.PLAN_COMPTABLE, { nom: 'X', colonnes: 'etat' })).toEqual({ motif: 'Les colonnes du modèle sont illisibles.' });
        expect((0, modeles_edition_1.modeleOuMotif)(client_1.EditionModele.PLAN_COMPTABLE, { nom: 'X', colonnes: ['etat', 'etat'] })).toEqual({ motif: 'Colonne en double · « etat ».' });
    });
});
//# sourceMappingURL=modeles-edition.spec.js.map