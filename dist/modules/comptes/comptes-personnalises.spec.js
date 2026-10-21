"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const compte_service_1 = require("./compte.service");
const catalogue_retraitements_1 = require("../fiscalite/catalogue-retraitements");
const comptes_proposes_1 = require("./comptes-proposes");
const compte_seed_1 = require("./compte-seed");
const compte_seed_syscohada_1 = require("./compte-seed-syscohada");
const subdivisions_du_plan_1 = require("./subdivisions-du-plan");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const tiers_service_1 = require("../tiers/tiers.service");
const journal_service_1 = require("../journaux/journal.service");
const COMPTES = [
    { id: 'c411', tenantId: 't1', numero: '41110000', intitule: 'Clients', estRetenu: true, typeCompte: 'DETAIL', classe: 'CLASSE_4' },
    { id: 'c661', tenantId: 't1', numero: '66110000', intitule: 'Appointements', estRetenu: false, typeCompte: 'DETAIL' },
    { id: 'c521', tenantId: 't1', numero: '52110000', intitule: 'Banques locales', estRetenu: false, typeCompte: 'DETAIL', classe: 'CLASSE_5' },
    { id: 'c622', tenantId: 't1', numero: '62200000', intitule: 'Locations et charges locatives', estRetenu: false, typeCompte: 'DETAIL' },
    { id: 'c4011', tenantId: 't1', numero: '40110000', intitule: 'Fournisseurs', estRetenu: false, typeCompte: 'DETAIL', classe: 'CLASSE_4' },
    { id: 'c5212', tenantId: 't1', numero: '52120000', intitule: 'Banques autres États', estRetenu: false, typeCompte: 'DETAIL', classe: 'CLASSE_5' },
    { id: 't62', tenantId: 't1', numero: '62', intitule: 'Services extérieurs', estRetenu: false, typeCompte: 'TOTAL' },
    { id: 'v622', tenantId: 't2', numero: '62200000', intitule: 'Locations', estRetenu: false, typeCompte: 'DETAIL' },
];
const REFERENCES = {
    ligneEcriture: [{ compteId: 'c661' }],
    journal: [{ compteTresorerieId: 'c521' }],
};
function lectureDesReferences(nom) {
    return jest.fn(async ({ where, by }) => {
        const champ = by[0];
        const lignes = (REFERENCES[nom] ?? []).filter((l) => l[champ] && where[champ]?.in?.includes(l[champ]));
        return [...new Map(lignes.map((l) => [l[champ], { [champ]: l[champ] }])).values()];
    });
}
function prisma(extra = {}) {
    const handler = {
        get(cible, nom) {
            if (nom in cible) {
                const d = cible[nom];
                if (d && typeof d === 'object' && nom !== 'compte' && !('groupBy' in d))
                    d.groupBy = lectureDesReferences(nom);
                return d;
            }
            return { groupBy: lectureDesReferences(nom) };
        },
    };
    const compte = {
        findMany: jest.fn(async ({ where }) => COMPTES.filter((c) => c.tenantId === where.tenantId &&
            (typeof where.id !== 'object' || where.id.in.includes(c.id)) &&
            (where.estRetenu === undefined || c.estRetenu === where.estRetenu) &&
            (where.typeCompte === undefined || c.typeCompte === where.typeCompte))),
        findFirst: jest.fn(async ({ where }) => COMPTES.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null),
    };
    return new Proxy({ compte, ...extra }, handler);
}
describe('le compte personnalisé · une seule règle', () => {
    it('rend les comptes ni retenus ni utilisés, jamais un retenu, un utilisé, un Total ou le compte d’un voisin', async () => {
        const non = await (0, comptes_proposes_1.comptesNonPersonnalises)(prisma(), 't1', ['c411', 'c661', 'c521', 'c622', 't62', 'v622', 'c622']);
        expect(non.map((c) => c.numero)).toEqual(['62200000']);
    });
    it('un identifiant répété n’est demandé qu’une fois', async () => {
        const p = prisma();
        await (0, comptes_proposes_1.comptesNonPersonnalises)(p, 't1', ['c622', 'c622', 'c411']);
        const where = p.compte.findMany.mock.calls[0][0].where;
        expect(where.id.in).toEqual(['c622', 'c411']);
    });
    it('aucun identifiant, aucune lecture', async () => {
        const p = prisma();
        await expect((0, comptes_proposes_1.comptesNonPersonnalises)(p, 't1', [])).resolves.toEqual([]);
        expect(p.compte.findMany).not.toHaveBeenCalled();
    });
    it('le refus nomme le compte, le geste, et dit comment le lever', () => {
        expect((0, comptes_proposes_1.motifComptesNonPersonnalises)([], 'une saisie')).toBeNull();
        const m = (0, comptes_proposes_1.motifComptesNonPersonnalises)([{ numero: '62200000', intitule: 'Locations' }], 'une saisie');
        expect(m).toContain('Compte non personnalisé : 62200000 Locations');
        expect(m).toContain('une saisie ne se fait que sur un compte personnalisé');
        expect(m).toContain('Plan comptable');
        expect(m).toMatch(/adoptez le compte du plan tel quel, ou ouvrez un sous-compte/);
        expect(m).toContain("geste de l'administrateur du dossier");
    });
    it('au-delà de cinq comptes, le refus compte les autres au lieu de les taire', () => {
        const six = Array.from({ length: 7 }, (_, i) => ({ numero: `6220000${i}`, intitule: 'L' }));
        expect((0, comptes_proposes_1.motifComptesNonPersonnalises)(six, 'une saisie')).toContain('et 2 autre(s)');
    });
});
describe('la saisie n’admet que les comptes personnalisés', () => {
    const ecritures = () => new ecriture_service_1.EcritureService(prisma(), {}, {}, {});
    it('refuse une pièce qui porte un compte non personnalisé, en le nommant', async () => {
        await expect(ecritures().verifierComptesPersonnalises('t1', [{ compteId: 'c521' }, { compteId: 'c622' }])).rejects.toThrow(/Compte non personnalisé : 62200000/);
    });
    it('admet un compte adopté, un compte mouvementé et le compte d’un journal', async () => {
        await expect(ecritures().verifierComptesPersonnalises('t1', [{ compteId: 'c411' }, { compteId: 'c661' }, { compteId: 'c521' }])).resolves.toBeUndefined();
    });
    it('nomme le geste de la réimputation', async () => {
        await expect(ecritures().verifierComptesPersonnalises('t1', [{ compteId: 'c622' }], 'une réimputation')).rejects.toThrow(/une réimputation ne se fait que sur un compte personnalisé/);
    });
});
describe('un tiers ou une banque ne se rattache qu’à un compte personnalisé', () => {
    it('le tiers refuse un compte de classe 4 non personnalisé, sans rien écrire', async () => {
        const tiersCompte = { findUnique: jest.fn(async () => null), create: jest.fn() };
        const p = prisma({ tiers: { findFirst: jest.fn(async () => ({ id: 'ti1', tenantId: 't1' })) }, tiersCompte });
        const svc = new tiers_service_1.TiersService(p);
        await expect(svc.rattacherCompte('t1', 'ti1', { compteId: 'c4011' })).rejects.toThrow(common_1.BadRequestException);
        await expect(svc.rattacherCompte('t1', 'ti1', { compteId: 'c4011' })).rejects.toThrow(/le rattachement à un tiers ne se fait que sur un compte personnalisé/);
        expect(tiersCompte.create).not.toHaveBeenCalled();
    });
    it('le journal de banque refuse un compte existant non personnalisé, à la création et à la modification', async () => {
        const journal = {
            findUnique: jest.fn(async () => null),
            findFirst: jest.fn(async ({ where }) => where.id === 'j1' ? { id: 'j1', tenantId: 't1', code: 'BQ2', type: 'TRESORERIE', compteTresorerieId: 'c521' } : null),
            create: jest.fn(),
            update: jest.fn(),
        };
        const p = prisma({ journal, tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) } });
        const svc = new journal_service_1.JournalService(p);
        await expect(svc.creer('t1', { code: 'BQ3', intitule: 'Rawbank', type: 'TRESORERIE', compteTresorerieId: 'c5212' })).rejects.toThrow(/le rattachement à un journal ne se fait que sur un compte personnalisé/);
        await expect(svc.modifier('t1', 'j1', { compteTresorerieId: 'c5212' })).rejects.toThrow(/Compte non personnalisé : 52120000/);
        expect(journal.create).not.toHaveBeenCalled();
        expect(journal.update).not.toHaveBeenCalled();
    });
});
describe('un sous-compte fonctionne comme son compte du plan', () => {
    function monde(parent) {
        const create = jest.fn(async ({ data }) => data);
        const p = {
            tenant: { findUniqueOrThrow: jest.fn(async () => ({ id: 't1', longueurCompte: 8, referentiel: 'SYSCOHADA' })) },
            compte: {
                findUnique: jest.fn(async ({ where }) => where.tenantId_numero.numero === '52110000' ? parent : null),
                create,
            },
            natureCompte: { findMany: jest.fn(async () => []), createMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 7) },
        };
        return { svc: new compte_service_1.CompteService(p), create, p };
    }
    const DU_PLAN = {
        lettrable: true,
        modeReportANouveau: 'DETAIL',
        tauxTvaDefautId: 'tva-16',
        comportementGestion: 'FIXE',
        partVariableGestionPct: null,
        codeRetraitementFiscal: catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS[0].code,
    };
    it('reprend lettrage, report, taxe et comportement de gestion du compte du plan qu’il subdivise', async () => {
        const { svc, create, p } = monde(DU_PLAN);
        await svc.creer('t1', { numero: '52110001', intitule: 'Rawbank' });
        expect(p.compte.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId_numero: { tenantId: 't1', numero: '52110000' } } }));
        expect(create.mock.calls[0][0].data).toMatchObject({
            numero: '52110001',
            lettrable: true,
            modeReportANouveau: 'DETAIL',
            tauxTvaDefautId: 'tva-16',
            comportementGestion: 'FIXE',
        });
        expect(create.mock.calls[0][0].data).toMatchObject({ codeRetraitementFiscal: DU_PLAN.codeRetraitementFiscal });
        expect(create.mock.calls[0][0].data).not.toHaveProperty('bailleurId');
        expect(create.mock.calls[0][0].data).not.toHaveProperty('porteFondsContrepartieEtat');
        expect(create.mock.calls[0][0].data).not.toHaveProperty('collectifId');
    });
    it('un traitement fiscal hérité sorti du catalogue est refusé comme un code saisi', async () => {
        const { svc, create } = monde({ ...DU_PLAN, codeRetraitementFiscal: 'CODE_DISPARU' });
        await expect(svc.creer('t1', { numero: '52110001', intitule: 'Rawbank' })).rejects.toThrow(/Code de retraitement fiscal inconnu : CODE_DISPARU/);
        expect(create).not.toHaveBeenCalled();
    });
    it('ce que la création précise prime sur le compte du plan', async () => {
        const { svc, create } = monde(DU_PLAN);
        await svc.creer('t1', { numero: '52110001', intitule: 'Rawbank', lettrable: false, tauxTvaDefautId: null });
        expect(create.mock.calls[0][0].data).toMatchObject({ lettrable: false, tauxTvaDefautId: null });
    });
    it('un numéro qui ne subdivise aucun compte du plan ne reprend rien', async () => {
        const { svc, create, p } = monde(DU_PLAN);
        await svc.creer('t1', { numero: '52100001', intitule: 'Hors racine' });
        expect(p.compte.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId_numero: { tenantId: 't1', numero: '52110000' } } }));
        expect(create.mock.calls[0][0].data).not.toHaveProperty('tauxTvaDefautId');
    });
});
describe('le Plan comptable dit le compte du plan et le compte subdivisé', () => {
    it('un compte du plan sous lequel le dossier a ouvert un compte actif est subdivisé, sauf celui d’un journal de banque', async () => {
        const plan = [
            { id: 'a', tenantId: 't1', numero: '52110000', typeCompte: 'DETAIL', estActif: true, estRetenu: false },
            { id: 'b', tenantId: 't1', numero: '52110001', typeCompte: 'DETAIL', estActif: true, estRetenu: true },
            { id: 'c', tenantId: 't1', numero: '62210000', typeCompte: 'DETAIL', estActif: true, estRetenu: false },
            { id: 'd', tenantId: 't1', numero: '62210001', typeCompte: 'DETAIL', estActif: true, estRetenu: true },
            { id: 'e', tenantId: 't1', numero: '62220000', typeCompte: 'DETAIL', estActif: true, estRetenu: false },
            { id: 'f', tenantId: 't1', numero: '62220001', typeCompte: 'DETAIL', estActif: false, estRetenu: true },
        ];
        const handler = {
            get(cible, nom) {
                return nom in cible ? cible[nom] : { groupBy: jest.fn(async () => []) };
            },
        };
        const p = new Proxy({
            compte: { findMany: jest.fn(async () => plan) },
            natureCompte: { findMany: jest.fn(async () => []), createMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 7) },
            tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) },
            journal: { findMany: jest.fn(async () => [{ compteTresorerieId: 'a' }]), groupBy: jest.fn(async () => [{ compteTresorerieId: 'a' }]) },
        }, handler);
        const r = await new compte_service_1.CompteService(p).lister('t1', { usage: true });
        const lu = (n) => r.find((c) => c.numero === n);
        expect(lu('52110000')).toMatchObject({ duPlan: true, subdivise: false });
        expect(lu('52110001')).toMatchObject({ duPlan: false, subdivise: false });
        expect(lu('62210000')).toMatchObject({ duPlan: true, subdivise: true });
        expect(lu('62220000')).toMatchObject({ duPlan: true, subdivise: false });
    });
});
describe('le numéro proposé d’un sous-compte', () => {
    it('le premier libre sous la racine, à la longueur du dossier', () => {
        expect((0, subdivisions_du_plan_1.sousComptePropose)('SYSCOHADA', '52110000', 8, [])).toBe('52110001');
        expect((0, subdivisions_du_plan_1.sousComptePropose)('SYSCOHADA', '52110000', 8, ['52110001', '52110000'])).toBe('52110002');
        expect((0, subdivisions_du_plan_1.sousComptePropose)('SYSCOHADA', '52110000', 10, [])).toBe('5211000001');
    });
    it('la racine officielle, jamais le numéro dépouillé · le 49000000 est le 490', () => {
        expect((0, subdivisions_du_plan_1.sousComptePropose)('SYSCOHADA', '49000000', 8, [])).toBe('49000001');
    });
    it('jamais sous une racine semée plus profonde · le 8311 relève du 8311, pas du 831', () => {
        expect((0, subdivisions_du_plan_1.sousComptePropose)('SYCEBNL', '83100000', 4, [])).toBe('8312');
    });
    it('rien pour un Total, un numéro hors du plan, ou une racine pleine', () => {
        expect((0, subdivisions_du_plan_1.sousComptePropose)('SYSCOHADA', '52', 8, [])).toBeNull();
        expect((0, subdivisions_du_plan_1.sousComptePropose)('SYSCOHADA', '52110001', 8, [])).toBeNull();
        const pleins = Array.from({ length: 9999 }, (_, i) => `5211${String(i + 1).padStart(4, '0')}`);
        expect((0, subdivisions_du_plan_1.sousComptePropose)('SYSCOHADA', '52110000', 8, pleins)).toBeNull();
    });
});
describe('ne garder que les utilisés ne touche qu’au plan officiel', () => {
    it('les comptes que le cabinet a créés restent personnalisés', async () => {
        const updateMany = jest.fn(async () => ({ count: 3 }));
        const p = {
            tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYCEBNL' })) },
            compte: { updateMany },
        };
        await new compte_service_1.CompteService(p).neRetenirQueLesUtilises('t1');
        const where = updateMany.mock.calls[0][0].where;
        expect(where.tenantId).toBe('t1');
        expect(where.estRetenu).toBe(true);
        expect(new Set(where.numero.in)).toEqual(new Set((0, subdivisions_du_plan_1.numerosSemes)('SYCEBNL')));
        expect(where.numero.in).not.toContain('52110001');
    });
    it('au SYSCOHADA, les sous-comptes de taxe routés restent personnalisés', async () => {
        const updateMany = jest.fn(async () => ({ count: 3 }));
        const p = { tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: 'SYSCOHADA' })) }, compte: { updateMany } };
        await new compte_service_1.CompteService(p).neRetenirQueLesUtilises('t1');
        const where = updateMany.mock.calls[0][0].where;
        for (const n of ['44540000', '44310000'])
            expect(where.numero.in).not.toContain(n);
        expect(where.numero.in).toContain('62210000');
    });
});
describe('la migration des dossiers existants', () => {
    const sql = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../prisma/migrations/20270164000000_comptes_personnalises/migration.sql'), 'utf8');
    it('porte les comptes d’imputation semés au jour de la migration, une fois chacun', () => {
        const lus = [...sql.matchAll(/\('(SYCEBNL|SYSCOHADA)','(\d+)'\)/g)].map((m) => `${m[1]}:${m[2]}`);
        expect(new Set(lus).size).toBe(lus.length);
        expect(lus.filter((x) => x.startsWith('SYCEBNL:'))).toHaveLength(880);
        expect(lus.filter((x) => x.startsWith('SYSCOHADA:'))).toHaveLength(1130);
        for (const x of ['SYSCOHADA:52110000', 'SYSCOHADA:62210000', 'SYSCOHADA:40110000', 'SYCEBNL:41100000', 'SYCEBNL:52110000'])
            expect(lus).toContain(x);
        const totaux = new Set([
            ...compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.typeCompte === 'TOTAL').map((c) => `SYCEBNL:${c.numero}`),
            ...compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.typeCompte === 'TOTAL').map((c) => `SYSCOHADA:${c.numero}`),
        ]);
        expect(lus.filter((x) => totaux.has(x))).toEqual([]);
    });
    it('ne touche qu’aux dossiers dont aucun compte n’est non retenu, et qu’aux comptes d’imputation', () => {
        expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM comptes c WHERE c\."tenantId" = t\.id AND c\."estRetenu" = false\)/);
        expect(sql).toMatch(/SET "estRetenu" = false/);
        expect(sql).toMatch(/c\."typeCompte" = 'DETAIL'/);
        expect(sql).toMatch(/s\.referentiel = i\.referentiel/);
    });
});
describe('les liens qui ne personnalisent pas', () => {
    it('chaque lien exclu de l’usage est une relation réelle vers Compte · un nom faux ne retirerait rien, en silence', () => {
        const { Prisma } = require('@prisma/client');
        const reels = new Set();
        for (const m of Prisma.dmmf.datamodel.models) {
            for (const f of m.fields) {
                if (f.kind === 'object' && f.type === 'Compte' && (f.relationFromFields ?? []).length === 1)
                    reels.add(`${m.name}.${f.relationFromFields[0]}`);
            }
        }
        const { LIENS_QUI_NE_RETIENNENT_PAS } = require('./comptes-proposes');
        expect(LIENS_QUI_NE_RETIENNENT_PAS.filter((l) => !reels.has(l))).toEqual([]);
        for (const l of ['LigneEcriture.compteId', 'Journal.compteTresorerieId', 'TiersCompte.compteId', 'EcartInventaire.compteId']) {
            expect(LIENS_QUI_NE_RETIENNENT_PAS).not.toContain(l);
        }
    });
});
//# sourceMappingURL=comptes-personnalises.spec.js.map