"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const route_paramtypes_enum_1 = require("@nestjs/common/enums/route-paramtypes.enum");
const class_validator_1 = require("class-validator");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const exercice_requis_1 = require("./exercice-requis");
const journal_du_dossier_1 = require("./journal-du-dossier");
const compte_du_dossier_1 = require("./compte-du-dossier");
const contexte_audit_1 = require("./audit/contexte-audit");
const jwt_auth_guard_1 = require("../modules/auth/jwt-auth.guard");
function fichiersControleurs(dossier) {
    const trouves = [];
    for (const nom of (0, node_fs_1.readdirSync)(dossier)) {
        const chemin = (0, node_path_1.join)(dossier, nom);
        if ((0, node_fs_1.statSync)(chemin).isDirectory())
            trouves.push(...fichiersControleurs(chemin));
        else if (nom.endsWith('.controller.ts'))
            trouves.push(chemin);
    }
    return trouves;
}
function proprietesDuDto(classe) {
    if (typeof classe !== 'function' || [String, Number, Boolean, Object, Array].includes(classe))
        return [];
    const metadonnees = (0, class_validator_1.getMetadataStorage)().getTargetValidationMetadatas(classe, '', true, false);
    return [...new Set(metadonnees.map((m) => m.propertyName))].sort();
}
function routesExercice() {
    const racine = (0, node_path_1.join)(__dirname, '..');
    const fichiers = fichiersControleurs(racine);
    const sansControleur = [];
    const routes = [];
    const routesJournal = [];
    const routesCompte = [];
    const dtosEnRequete = [];
    for (const fichier of fichiers) {
        const exports = require(fichier);
        let controleurs = 0;
        for (const exporte of Object.values(exports)) {
            if (typeof exporte !== 'function' || Reflect.getMetadata(constants_1.PATH_METADATA, exporte) === undefined)
                continue;
            controleurs++;
            const prototype = exporte.prototype;
            const gardesClasse = (Reflect.getMetadata(constants_1.GUARDS_METADATA, exporte) ?? []);
            for (const methode of Object.getOwnPropertyNames(prototype)) {
                if (methode === 'constructor')
                    continue;
                const gardesMethode = (Reflect.getMetadata(constants_1.GUARDS_METADATA, prototype[methode]) ?? []);
                const args = (Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, exporte, methode) ?? {});
                const typesDesParametres = (Reflect.getMetadata('design:paramtypes', prototype, methode) ?? []);
                for (const [cle, arg] of Object.entries(args)) {
                    const type = Number(cle.split(':')[0]);
                    if (type === route_paramtypes_enum_1.RouteParamtypes.QUERY && arg.data === undefined) {
                        const classe = typesDesParametres[arg.index];
                        dtosEnRequete.push({
                            route: `${(0, node_path_1.relative)(racine, fichier)} ${methode}`,
                            dto: classe?.name ?? '?',
                            proprietes: proprietesDuDto(classe),
                        });
                    }
                    if (type !== route_paramtypes_enum_1.RouteParamtypes.QUERY && type !== route_paramtypes_enum_1.RouteParamtypes.PARAM)
                        continue;
                    const route = {
                        route: `${(0, node_path_1.relative)(racine, fichier)} ${methode}`,
                        type: (type === route_paramtypes_enum_1.RouteParamtypes.QUERY ? 'query' : 'param'),
                        pipes: arg.pipes ?? [],
                        gardes: [...gardesClasse, ...gardesMethode],
                    };
                    if (arg.data === 'exerciceId')
                        routes.push(route);
                    if (arg.data === 'journalId')
                        routesJournal.push(route);
                    if (arg.data === 'compteId')
                        routesCompte.push(route);
                }
            }
        }
        if (controleurs === 0)
            sansControleur.push((0, node_path_1.relative)(racine, fichier));
    }
    return { fichiers: fichiers.length, sansControleur, routes, routesJournal, routesCompte, dtosEnRequete };
}
const ROUTES_A_EXERCICE_FACULTATIF = {
    'modules/comptabilite/ecriture.controller.ts lister': "le journal se filtre aussi par dates, et `perimetreJournal` n'ajoute le filtre d'exercice que s'il est nommé",
    'modules/exports/export.controller.ts journal': "même périmètre que la fenêtre du journal · sans exercice, le classeur se titre « Toutes périodes »",
    'modules/questionnaire/questionnaire.controller.ts lister': 'la liste des questionnaires du dossier, chacun portant son exercice',
    'modules/inventaire/inventaire.controller.ts lister': "la liste des campagnes d'inventaire du dossier, chacune portant son exercice",
    'modules/faiblesses/faiblesses.controller.ts lister': 'la liste des registres de faiblesses du dossier, chacun portant son exercice',
    'modules/circularisation/circularisation.controller.ts lister': 'la liste des campagnes de circularisation du dossier, chacune portant son exercice',
};
const ROUTES_A_EXERCICE_D_UNE_CELLULE = {
    'modules/groupe/groupe.controller.ts balanceCellule': "l'exercice est celui de la cellule lue par le siège · GroupeService.balanceCellule borne la cellule au groupe et l'exercice à la cellule",
};
const ROUTES_A_JOURNAL_EN_FILTRE = [
    'modules/comptabilite/ecriture.controller.ts brouillard',
    'modules/comptabilite/ecriture.controller.ts lister',
    'modules/exports/export.controller.ts journal',
    'modules/modeles-saisie/modele-saisie.controller.ts lister',
];
const ROUTES_A_COMPTE_EN_FILTRE = [
    'modules/exports/export.controller.ts grandLivreComplet',
    'modules/rapprochement/rapprochement.controller.ts lister',
    'modules/relances/relances.controller.ts historique',
];
const ROUTES_A_COMPTE_JUGE_PAR_LE_SERVICE = {
    'modules/inventaire/inventaire.controller.ts apercuPvCaisse': "la caisse du procès-verbal est requise · InventaireService.apercuPvCaisse la lit bornée au dossier et rend 404 « Compte introuvable pour ce dossier. »",
};
const IDENTIFIANTS_DANS_UN_DTO_DE_REQUETE = {
    'modules/registre-donateurs/donation.controller.ts lister FiltreRegistreDto exerciceId': "@IsUUID('4') refuse l'illisible (400) ; DonationService.lister lit l'exercice borné au dossier et rend 404 « Exercice introuvable pour ce dossier. »",
};
const IDENTIFIANTS_A_PORTEUR = ['exerciceId', 'journalId', 'compteId'];
const DOSSIER = 'dossier-de-la-session';
const VOISIN = 'dossier-voisin';
const ID = '0b5f9c1e-3a4d-4c2b-9f1e-2a7d6c8b1e30';
const ID_DU_VOISIN = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
function doublurePrisma() {
    const lignes = [
        { id: ID, tenantId: DOSSIER },
        { id: ID_DU_VOISIN, tenantId: VOISIN },
    ];
    const requetes = [];
    const modele = (nom) => ({
        findFirst: async (args) => {
            requetes.push({ modele: nom, where: args.where });
            const trouve = lignes.find((l) => l.id === args.where.id && l.tenantId === args.where.tenantId);
            return trouve ? { id: trouve.id } : null;
        },
    });
    return {
        prisma: { exercice: modele('exercice'), journal: modele('journal'), compte: modele('compte') },
        requetes,
    };
}
function instancier(pipes, prisma) {
    return pipes.map((p) => typeof p === 'function' ? new p(prisma) : p);
}
async function jouer(pipes, valeur, type, data = 'exerciceId', prisma = doublurePrisma().prisma) {
    return (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'comptable@dossier.test', tenantId: DOSSIER }, async () => {
        let courant = valeur;
        for (const pipe of instancier(pipes, prisma)) {
            courant = await pipe.transform(courant, { type, data });
        }
        return courant;
    });
}
const messageDe = (e) => e instanceof common_1.BadRequestException || e instanceof common_1.NotFoundException ? `${e.getStatus()} ${e.message}` : e;
describe('EXERCICE_REQUIS · un seul porteur', () => {
    let lecture;
    beforeAll(() => {
        lecture = routesExercice();
    }, 120_000);
    const PORTEURS = [exercice_requis_1.EXERCICE_REQUIS, exercice_requis_1.EXERCICE_FACULTATIF, exercice_requis_1.EXERCICE_D_UNE_CELLULE];
    it('le recensement lit chaque fichier de contrôleur et trouve des routes gardées (un garde-fou vide ne garde rien)', () => {
        expect(lecture.sansControleur).toEqual([]);
        expect(lecture.fichiers).toBeGreaterThan(60);
        const gardees = lecture.routes.filter((r) => r.pipes.includes(exercice_requis_1.EXERCICE_REQUIS));
        expect(gardees.length).toBeGreaterThanOrEqual(120);
        expect(lecture.routes.filter((r) => r.pipes.includes(exercice_requis_1.EXERCICE_FACULTATIF)).length).toBeGreaterThan(0);
        expect(lecture.routesJournal.length).toBeGreaterThan(0);
    });
    it('aucun contrôleur ne redéclare un ParseUUIDPipe pour exerciceId hors des porteurs', () => {
        const copies = lecture.routes
            .filter((r) => r.pipes.some((p) => !PORTEURS.includes(p) && (p === common_1.ParseUUIDPipe || p instanceof common_1.ParseUUIDPipe)))
            .map((r) => r.route);
        expect(copies).toEqual([]);
        expect(exercice_requis_1.EXERCICE_REQUIS.format).toBeInstanceOf(common_1.ParseUUIDPipe);
        expect(exercice_requis_1.EXERCICE_FACULTATIF.format).toBeInstanceOf(common_1.ParseUUIDPipe);
        expect(exercice_requis_1.EXERCICE_D_UNE_CELLULE).toBeInstanceOf(common_1.ParseUUIDPipe);
    });
    it('aucun exerciceId, en requête comme en chemin, ne passe sans porteur', () => {
        const nus = lecture.routes.filter((r) => !r.pipes.some((p) => PORTEURS.includes(p))).map((r) => r.route);
        expect(nus).toEqual([]);
        expect(lecture.routes.filter((r) => r.pipes.filter((p) => PORTEURS.includes(p)).length > 1)).toEqual([]);
    });
    it('le porteur facultatif ne vit que sur la liste fermée de ses routes, et jamais sur un chemin', () => {
        const facultatives = lecture.routes.filter((r) => r.pipes.includes(exercice_requis_1.EXERCICE_FACULTATIF));
        expect(facultatives.filter((r) => r.type === 'param').map((r) => r.route)).toEqual([]);
        expect(facultatives.map((r) => r.route).sort()).toEqual(Object.keys(ROUTES_A_EXERCICE_FACULTATIF).sort());
        for (const motif of Object.values(ROUTES_A_EXERCICE_FACULTATIF))
            expect(motif.length).toBeGreaterThan(20);
    });
    it('le porteur de format seul ne vit que sur la liste fermée des exercices de cellule (C3)', () => {
        const cellules = lecture.routes.filter((r) => r.pipes.includes(exercice_requis_1.EXERCICE_D_UNE_CELLULE));
        expect(cellules.map((r) => r.route).sort()).toEqual(Object.keys(ROUTES_A_EXERCICE_D_UNE_CELLULE).sort());
        for (const motif of Object.values(ROUTES_A_EXERCICE_D_UNE_CELLULE))
            expect(motif.length).toBeGreaterThan(20);
    });
    it('chaque route qui juge un identifiant au dossier est derrière JwtAuthGuard (le dossier jugé est celui de la session)', () => {
        const sansGarde = [...lecture.routes, ...lecture.routesJournal]
            .filter((r) => !r.gardes.includes(jwt_auth_guard_1.JwtAuthGuard))
            .map((r) => r.route);
        expect(sansGarde).toEqual([]);
    });
    it('chaque route, jouée comme Nest la joue, refuse un identifiant illisible par un 400 nommé', async () => {
        for (const r of lecture.routes) {
            const facultative = r.pipes.includes(exercice_requis_1.EXERCICE_FACULTATIF);
            const message = facultative ? exercice_requis_1.MESSAGE_EXERCICE_ILLISIBLE : exercice_requis_1.MESSAGE_EXERCICE_REQUIS;
            for (const v of ['undefined', '', 'ex-2026']) {
                const refus = await jouer(r.pipes, v, r.type).catch((e) => e);
                expect({ route: r.route, v, refus: refus instanceof common_1.BadRequestException ? refus.message : refus }).toEqual({
                    route: r.route,
                    v,
                    refus: message,
                });
            }
            const absent = await jouer(r.pipes, undefined, r.type).catch((e) => e);
            expect({ route: r.route, absent: absent instanceof common_1.BadRequestException ? absent.message : absent }).toEqual({
                route: r.route,
                absent: facultative ? undefined : exercice_requis_1.MESSAGE_EXERCICE_REQUIS,
            });
            await expect(jouer(r.pipes, ID, r.type)).resolves.toBe(ID);
        }
    });
    it('chaque route, jouée comme Nest la joue, dit introuvable (404 nommé) l’exercice d’un autre dossier (C3)', async () => {
        for (const r of lecture.routes) {
            const refus = await jouer(r.pipes, ID_DU_VOISIN, r.type).catch((e) => e);
            if (r.pipes.includes(exercice_requis_1.EXERCICE_D_UNE_CELLULE)) {
                expect({ route: r.route, refus }).toEqual({ route: r.route, refus: ID_DU_VOISIN });
                continue;
            }
            expect({ route: r.route, refus: messageDe(refus) }).toEqual({
                route: r.route,
                refus: `404 ${exercice_requis_1.MESSAGE_EXERCICE_HORS_DOSSIER}`,
            });
        }
    });
    it('refuse un exercice absent, vide ou illisible par un 400 nommé, laisse passer un identifiant du dossier', async () => {
        for (const v of [undefined, '', 'ex-2026', '1']) {
            const refus = await jouer([exercice_requis_1.EXERCICE_REQUIS], v, 'query').catch((e) => e);
            expect(refus).toBeInstanceOf(common_1.BadRequestException);
            expect(refus.message).toBe(exercice_requis_1.MESSAGE_EXERCICE_REQUIS);
        }
        await expect(jouer([exercice_requis_1.EXERCICE_REQUIS], ID, 'query')).resolves.toBe(ID);
    });
    it('le porteur facultatif laisse passer l’absence, jamais un identifiant illisible ni celui d’un autre dossier', async () => {
        await expect(jouer([exercice_requis_1.EXERCICE_FACULTATIF], undefined, 'query')).resolves.toBeUndefined();
        for (const v of ['', 'undefined', 'ex-2026', '1']) {
            const refus = await jouer([exercice_requis_1.EXERCICE_FACULTATIF], v, 'query').catch((e) => e);
            expect(refus).toBeInstanceOf(common_1.BadRequestException);
            expect(refus.message).toBe(exercice_requis_1.MESSAGE_EXERCICE_ILLISIBLE);
        }
        await expect(jouer([exercice_requis_1.EXERCICE_FACULTATIF], ID, 'query')).resolves.toBe(ID);
        const voisin = await jouer([exercice_requis_1.EXERCICE_FACULTATIF], ID_DU_VOISIN, 'query').catch((e) => e);
        expect(messageDe(voisin)).toBe(`404 ${exercice_requis_1.MESSAGE_EXERCICE_HORS_DOSSIER}`);
    });
    it('le dossier jugé est celui de la SESSION, borné par sa valeur · jamais un dossier reçu du client', async () => {
        const { prisma, requetes } = doublurePrisma();
        await jouer([exercice_requis_1.EXERCICE_REQUIS], ID, 'query', 'exerciceId', prisma);
        expect(requetes).toEqual([{ modele: 'exercice', where: { id: ID, tenantId: DOSSIER } }]);
        requetes.length = 0;
        await jouer([exercice_requis_1.EXERCICE_REQUIS], 'ex-2026', 'query', 'exerciceId', prisma).catch(() => undefined);
        expect(requetes).toEqual([]);
    });
    it('sans dossier de session, le porteur tombe en panne au lieu de laisser passer (un contexte absent n’est pas un « tout est permis »)', async () => {
        const { prisma } = doublurePrisma();
        const [porteur] = instancier([exercice_requis_1.EXERCICE_REQUIS], prisma);
        const panne = await porteur.transform(ID, { type: 'query', data: 'exerciceId' }).catch((e) => e);
        expect(panne).toBeInstanceOf(Error);
        expect(panne).not.toBeInstanceOf(common_1.NotFoundException);
        expect(String(panne.message)).toMatch(/JwtAuthGuard/);
    });
    it('exigerExercice refuse au service ce que la route aurait refusé', () => {
        for (const v of [undefined, null, '', '   ', 3]) {
            expect(() => (0, exercice_requis_1.exigerExercice)(v)).toThrow(exercice_requis_1.MESSAGE_EXERCICE_REQUIS);
        }
        expect(() => (0, exercice_requis_1.exigerExercice)('0b5f9c1e-3a4d-4c2b-9f1e-2a7d6c8b1e30')).not.toThrow();
    });
});
describe('JOURNAL_FACULTATIF · le journal en filtre, du dossier ou introuvable (C3)', () => {
    let lecture;
    beforeAll(() => {
        lecture = routesExercice();
    }, 120_000);
    it('toute route qui lit journalId en requête porte le porteur, et la liste est celle-ci', () => {
        const enRequete = lecture.routesJournal.filter((r) => r.type === 'query');
        expect(enRequete.map((r) => r.route).sort()).toEqual([...ROUTES_A_JOURNAL_EN_FILTRE].sort());
        expect(enRequete.filter((r) => !r.pipes.includes(journal_du_dossier_1.JOURNAL_FACULTATIF)).map((r) => r.route)).toEqual([]);
    });
    it('joué sur chaque route · absent reste absent, illisible 400, d’un autre dossier 404, du dossier passe', async () => {
        for (const r of lecture.routesJournal.filter((x) => x.type === 'query')) {
            await expect(jouer(r.pipes, undefined, 'query', 'journalId')).resolves.toBeUndefined();
            const illisible = await jouer(r.pipes, 'abc', 'query', 'journalId').catch((e) => e);
            expect({ route: r.route, refus: messageDe(illisible) }).toEqual({ route: r.route, refus: `400 ${journal_du_dossier_1.MESSAGE_JOURNAL_ILLISIBLE}` });
            const voisin = await jouer(r.pipes, ID_DU_VOISIN, 'query', 'journalId').catch((e) => e);
            expect({ route: r.route, refus: messageDe(voisin) }).toEqual({ route: r.route, refus: `404 ${journal_du_dossier_1.MESSAGE_JOURNAL_HORS_DOSSIER}` });
            await expect(jouer(r.pipes, ID, 'query', 'journalId')).resolves.toBe(ID);
        }
    });
    it('le journal est cherché dans le dossier de la session', async () => {
        const { prisma, requetes } = doublurePrisma();
        await jouer([journal_du_dossier_1.JOURNAL_FACULTATIF], ID, 'query', 'journalId', prisma);
        expect(requetes).toEqual([{ modele: 'journal', where: { id: ID, tenantId: DOSSIER } }]);
    });
});
describe('COMPTE_FACULTATIF · le compte en filtre, du dossier ou introuvable (constat 4)', () => {
    let lecture;
    beforeAll(() => {
        lecture = routesExercice();
    }, 120_000);
    it('toute route qui lit compteId en requête porte le porteur, ou figure avec son motif dans la liste fermée', () => {
        const enRequete = lecture.routesCompte.filter((r) => r.type === 'query');
        expect(enRequete.map((r) => r.route).sort()).toEqual([...ROUTES_A_COMPTE_EN_FILTRE, ...Object.keys(ROUTES_A_COMPTE_JUGE_PAR_LE_SERVICE)].sort());
        expect(enRequete.filter((r) => ROUTES_A_COMPTE_EN_FILTRE.includes(r.route) && !r.pipes.includes(compte_du_dossier_1.COMPTE_FACULTATIF)).map((r) => r.route)).toEqual([]);
        expect(enRequete.filter((r) => !r.gardes.includes(jwt_auth_guard_1.JwtAuthGuard)).map((r) => r.route)).toEqual([]);
    });
    it('joué sur chaque route · absent reste absent, illisible 400, d’un autre dossier 404, du dossier passe', async () => {
        const routes = lecture.routesCompte.filter((x) => x.type === 'query' && ROUTES_A_COMPTE_EN_FILTRE.includes(x.route));
        expect(routes).toHaveLength(ROUTES_A_COMPTE_EN_FILTRE.length);
        for (const r of routes) {
            await expect(jouer(r.pipes, undefined, 'query', 'compteId')).resolves.toBeUndefined();
            const illisible = await jouer(r.pipes, 'abc', 'query', 'compteId').catch((e) => e);
            expect({ route: r.route, refus: messageDe(illisible) }).toEqual({ route: r.route, refus: `400 ${compte_du_dossier_1.MESSAGE_COMPTE_ILLISIBLE}` });
            const voisin = await jouer(r.pipes, ID_DU_VOISIN, 'query', 'compteId').catch((e) => e);
            expect({ route: r.route, refus: messageDe(voisin) }).toEqual({ route: r.route, refus: `404 ${compte_du_dossier_1.MESSAGE_COMPTE_HORS_DOSSIER}` });
            await expect(jouer(r.pipes, ID, 'query', 'compteId')).resolves.toBe(ID);
        }
    });
    it('le compte est cherché dans le dossier de la session', async () => {
        const { prisma, requetes } = doublurePrisma();
        await jouer([compte_du_dossier_1.COMPTE_FACULTATIF], ID, 'query', 'compteId', prisma);
        expect(requetes).toEqual([{ modele: 'compte', where: { id: ID, tenantId: DOSSIER } }]);
    });
});
describe('Un identifiant porté par un DTO de requête (constat 5)', () => {
    let lecture;
    beforeAll(() => {
        lecture = routesExercice();
    }, 120_000);
    it('le recensement lit les DTO de requête et leurs champs (un garde-fou vide ne garde rien)', () => {
        expect(lecture.dtosEnRequete.length).toBeGreaterThan(0);
        expect(lecture.dtosEnRequete.filter((d) => d.dto === '?').map((d) => d.route)).toEqual([]);
        expect(lecture.dtosEnRequete.every((d) => d.proprietes.length > 0)).toBe(true);
    });
    it('aucun DTO de requête ne porte exerciceId, journalId ou compteId hors de la liste fermée, et la liste est celle-ci', () => {
        const portes = lecture.dtosEnRequete.flatMap((d) => d.proprietes.filter((p) => IDENTIFIANTS_A_PORTEUR.includes(p)).map((p) => `${d.route} ${d.dto} ${p}`));
        expect(portes.sort()).toEqual(Object.keys(IDENTIFIANTS_DANS_UN_DTO_DE_REQUETE).sort());
    });
});
//# sourceMappingURL=exercice-requis.spec.js.map