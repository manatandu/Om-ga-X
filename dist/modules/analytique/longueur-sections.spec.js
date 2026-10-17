"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const longueur_sections_1 = require("./longueur-sections");
const analytique_service_1 = require("./analytique.service");
const analytique_dto_1 = require("./dto/analytique.dto");
const rubriques_budgetaires_1 = require("./rubriques-budgetaires");
const { DETAIL, TOTAL } = client_1.TypeCompteDetailTotal;
const releve = (longueur, sections) => {
    const r = new longueur_sections_1.ReleveLongueurs(longueur);
    for (const [code, type] of sections)
        r.ajouter({ code, type });
    return r;
};
describe('longueur des codes de section · la règle', () => {
    it('une section Détail fait exactement la longueur, une rubrique est plus courte', () => {
        expect((0, longueur_sections_1.ecartALaLongueur)({ code: '101', type: DETAIL }, 3)).toBeNull();
        expect((0, longueur_sections_1.ecartALaLongueur)({ code: '10', type: DETAIL }, 3)).toBe('section Détail de 2 caractères au lieu de 3');
        expect((0, longueur_sections_1.ecartALaLongueur)({ code: '1011', type: DETAIL }, 3)).toContain('4 caractères');
        expect((0, longueur_sections_1.ecartALaLongueur)({ code: '1', type: TOTAL }, 3)).toBeNull();
        expect((0, longueur_sections_1.ecartALaLongueur)({ code: '10', type: TOTAL }, 3)).toBeNull();
        expect((0, longueur_sections_1.ecartALaLongueur)({ code: '100', type: TOTAL }, 3)).toContain('plus courte que 3');
    });
    it('la longueur se compte en caractères, pas en unités UTF-16', () => {
        expect((0, longueur_sections_1.longueurDuCode)('É01')).toBe(3);
        expect((0, longueur_sections_1.longueurDuCode)('😀1')).toBe(2);
        expect((0, longueur_sections_1.ecartALaLongueur)({ code: '😀12', type: DETAIL }, 3)).toBeNull();
    });
    it('LE DÉFAUT CORRIGÉ · en longueur fixe, une feuille de deux caractères ne se glisse plus sous la rubrique « 1 »', () => {
        expect((0, rubriques_budgetaires_1.appartientALaRubrique)({ id: 'a', code: '10', type: DETAIL }, { id: 'r', code: '1', type: TOTAL })).toBe(true);
        expect((0, longueur_sections_1.motifRefusCodeSection)({ code: '10', type: DETAIL }, 3)).toContain('exactement 3 caractères');
        expect((0, longueur_sections_1.motifRefusCodeSection)({ code: '10', type: DETAIL }, null)).toBeNull();
        expect((0, longueur_sections_1.motifRefusCodeSection)({ code: '1', type: TOTAL }, 3)).toBeNull();
        expect((0, longueur_sections_1.motifRefusCodeSection)({ code: '123', type: TOTAL }, 3)).toContain('une rubrique ne regroupe que des codes plus longs');
    });
    it('les bornes sont de 2 à 13 caractères, entiers', () => {
        expect([longueur_sections_1.LONGUEUR_SECTIONS_MIN, longueur_sections_1.LONGUEUR_SECTIONS_MAX]).toEqual([2, 13]);
        expect((0, longueur_sections_1.motifRefusBornesLongueur)(2)).toBeNull();
        expect((0, longueur_sections_1.motifRefusBornesLongueur)(13)).toBeNull();
        for (const n of [1, 14, 2.5, Number.NaN])
            expect((0, longueur_sections_1.motifRefusBornesLongueur)(n)).toContain('de 2 à 13');
    });
});
describe('longueur des codes de section · le relevé d’un plan', () => {
    it('propose la longueur commune des feuilles quand les rubriques sont plus courtes', () => {
        expect(releve(null, [['1', TOTAL], ['10', TOTAL], ['101', DETAIL], ['102', DETAIL]]).proposee).toBe(3);
        expect(releve(null, [['101', DETAIL], ['20', DETAIL]]).proposee).toBeNull();
        expect(releve(null, [['101', TOTAL], ['102', DETAIL]]).proposee).toBeNull();
        expect(releve(null, [['1', DETAIL]]).proposee).toBeNull();
        expect(releve(null, []).proposee).toBeNull();
    });
    it('refuse une longueur qu’une section existante ne respecte pas, en nommant les sections, et ne renumérote rien', () => {
        const r = releve(3, [['1', TOTAL], ['101', DETAIL], ['20', DETAIL], ['300', TOTAL]]);
        expect(r.nombreHorsLongueur).toBe(2);
        const motif = (0, longueur_sections_1.motifRefusLongueurSections)('PROJ', 3, r);
        expect(motif).toContain('Le plan PROJ ne peut pas passer à des codes de 3 caractères');
        expect(motif).toContain('20 (section Détail de 2 caractères au lieu de 3)');
        expect(motif).toContain('300 (rubrique de 3 caractères');
        expect(motif).toContain('Aucun code n’est renuméroté');
        expect((0, longueur_sections_1.motifRefusLongueurSections)('PROJ', 3, releve(3, [['1', TOTAL], ['101', DETAIL]]))).toBeNull();
        expect((0, longueur_sections_1.motifRefusLongueurSections)('PROJ', null, r)).toBeNull();
    });
    it('nomme vingt sections au plus et dit toujours le total', () => {
        const sections = Array.from({ length: 25 }, (_, i) => [`X${i}`, DETAIL]);
        const r = releve(5, sections);
        expect(r.horsLongueur).toHaveLength(longueur_sections_1.SECTIONS_NOMMEES_AU_PLUS);
        expect(r.nombreHorsLongueur).toBe(25);
        expect((0, longueur_sections_1.motifRefusLongueurSections)('PROJ', 5, r)).toContain('et 5 autres');
    });
});
function prismaFactice(plan, sections) {
    const ordre = [];
    const lignes = sections.map(([code, type], i) => ({ id: `s${String(i).padStart(4, '0')}`, code, type, planId: plan.id, tenantId: 't' }));
    const client = {
        planAnalytique: {
            findFirst: jest.fn(async (a) => (a.where.id === plan.id && a.where.tenantId === 't' ? plan : null)),
            update: jest.fn(async (a) => (ordre.push('update'), { ...plan, ...a.data })),
        },
        sectionAnalytique: {
            findMany: jest.fn(async (a) => {
                ordre.push('relevé');
                const { id, ...reste } = a.where;
                expect(reste).toEqual({ tenantId: 't', planId: plan.id });
                expect(a.cursor).toBeUndefined();
                expect(a.orderBy).toEqual({ id: 'asc' });
                return lignes.filter((l) => id === undefined || l.id > id.gt).slice(0, a.take);
            }),
            findFirst: jest.fn(async () => null),
            create: jest.fn(async (a) => (ordre.push('create'), { id: 'nouvelle', ...a.data })),
        },
        $queryRaw: jest.fn(async () => (ordre.push('verrou'), [])),
        evenementAudit: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})) },
    };
    client.$transaction = jest.fn(async (fn) => fn(client));
    return { client, ordre, lignes };
}
describe('longueur des codes de section · le service', () => {
    it('la pose se juge sous le verrou du plan, puis s’écrit', async () => {
        const { client, ordre } = prismaFactice({ id: 'p', code: 'PROJ', longueurSections: null }, [['1', TOTAL], ['101', DETAIL]]);
        await new analytique_service_1.AnalytiqueService(client).modifierPlan('t', 'p', { longueurSections: 3 });
        expect(ordre).toEqual(['verrou', 'relevé', 'update']);
        expect(client.planAnalytique.update.mock.calls[0][0].data).toEqual({ longueurSections: 3 });
    });
    it('une section hors longueur refuse la pose, rien n’est écrit', async () => {
        const { client } = prismaFactice({ id: 'p', code: 'PROJ', longueurSections: null }, [['101', DETAIL], ['20', DETAIL]]);
        await expect(new analytique_service_1.AnalytiqueService(client).modifierPlan('t', 'p', { longueurSections: 3 })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(client.planAnalytique.update).not.toHaveBeenCalled();
    });
    it('revenir à la longueur libre se fait toujours, sans relevé', async () => {
        const { client, ordre } = prismaFactice({ id: 'p', code: 'PROJ', longueurSections: 3 }, [['20', DETAIL]]);
        await new analytique_service_1.AnalytiqueService(client).modifierPlan('t', 'p', { longueurSections: null });
        expect(ordre).toEqual(['verrou', 'update']);
    });
    it('les autres champs se modifient comme avant, sans verrou', async () => {
        const { client, ordre } = prismaFactice({ id: 'p', code: 'PROJ', longueurSections: null }, []);
        await new analytique_service_1.AnalytiqueService(client).modifierPlan('t', 'p', { intitule: 'Projets' });
        expect(ordre).toEqual(['update']);
    });
    it('la création d’une section rejuge la longueur sous le verrou du plan', async () => {
        const { client, ordre } = prismaFactice({ id: 'p', code: 'PROJ', longueurSections: 3 }, []);
        const s = new analytique_service_1.AnalytiqueService(client);
        await expect(s.creerSection('t', 'p', { code: '10', intitule: 'Formation' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(client.sectionAnalytique.create).not.toHaveBeenCalled();
        await s.creerSection('t', 'p', { code: '101', intitule: 'Formation' });
        expect(ordre).toEqual(['verrou', 'create']);
    });
    it('l’aperçu lit le même relevé que la pose, tranche par tranche', async () => {
        const sections = Array.from({ length: 5003 }, (_, i) => [`A${String(i).padStart(4, '0')}`, DETAIL]);
        const { client } = prismaFactice({ id: 'p', code: 'PROJ', longueurSections: null }, sections);
        const r = await new analytique_service_1.AnalytiqueService(client).apercuLongueurSections('t', 'p', 4);
        expect(client.sectionAnalytique.findMany).toHaveBeenCalledTimes(2);
        expect(r).toMatchObject({ longueur: 4, nombreSections: 5003, nombreHorsLongueur: 5003, proposee: 5 });
        expect(r.motif).toContain('5003 sections');
        expect((await new analytique_service_1.AnalytiqueService(client).apercuLongueurSections('t', 'p', 1)).motif).toContain('de 2 à 13');
    });
    it('une section retirée pendant l’aperçu n’ampute pas le relevé (relecture sage-l6)', async () => {
        const sections = Array.from({ length: 5003 }, (_, i) => [`A${String(i).padStart(4, '0')}`, DETAIL]);
        const { client, lignes } = prismaFactice({ id: 'p', code: 'PROJ', longueurSections: null }, sections);
        const lire = client.sectionAnalytique.findMany.getMockImplementation();
        client.sectionAnalytique.findMany.mockImplementation(async (a) => {
            const lot = await lire(a);
            if (a.where.id === undefined)
                lignes.splice(4999, 1);
            return lot;
        });
        const r = await new analytique_service_1.AnalytiqueService(client).apercuLongueurSections('t', 'p', 4);
        expect(r.nombreSections).toBe(5003);
    });
    it('le DTO borne la longueur et admet null pour revenir au libre', async () => {
        const erreurs = async (corps) => (await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(analytique_dto_1.ModifierPlanAnalytiqueDto, corps))).length;
        expect(await erreurs({ longueurSections: 3 })).toBe(0);
        expect(await erreurs({ longueurSections: null })).toBe(0);
        expect(await erreurs({ longueurSections: 1 })).toBeGreaterThan(0);
        expect(await erreurs({ longueurSections: 14 })).toBeGreaterThan(0);
    });
    it('la base refuse une longueur hors bornes', () => {
        const sql = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../prisma/migrations/20270184000200_longueur_sections/migration.sql'), 'utf8');
        expect(sql).toContain('CHECK ("longueurSections" IS NULL OR "longueurSections" BETWEEN 2 AND 13)');
    });
});
//# sourceMappingURL=longueur-sections.spec.js.map