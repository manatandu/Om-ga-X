"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const exceljs_1 = require("exceljs");
const groupe_service_1 = require("./groupe.service");
const EX = { id: 'ex-m', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const l = (numero, intitule, totalDebit, totalCredit) => ({
    numero,
    intitule,
    typeCompte: 'DETAIL',
    totalDebit,
    totalCredit,
    solde: totalDebit - totalCredit,
});
const SIEGE = {
    lignes: [
        l('18510001', 'Liaison succursale Lubumbashi', 500, 0),
        l('52110000', 'Banque', 2000, 500),
        l('70110000', 'Ventes de marchandises', 0, 2000),
    ],
    totaux: { debit: 2500, credit: 2500 },
};
const SUCCURSALE = {
    lignes: [
        l('18510000', 'Liaison siège', 0, 500),
        l('57110000', 'Caisse', 500, 200),
        l('60110000', 'Achats de marchandises', 200, 0),
    ],
    totaux: { debit: 700, credit: 700 },
};
const SUCCURSALE_BOITEUSE = {
    lignes: [l('57110000', 'Caisse', 300, 200), l('10100000', 'Capital', 0, 300), l('60110000', 'Achats de marchandises', 200, 0)],
    totaux: { debit: 500, credit: 500 },
};
function lectureDesBalances(parDossier) {
    const comptes = Object.entries(parDossier).flatMap(([tenantId, { lignes }]) => lignes.map((x) => ({
        id: `${tenantId}:${x.numero}`,
        tenantId,
        numero: x.numero,
        intitule: x.intitule,
        classe: `CLASSE_${x.numero[0]}`,
        typeCompte: x.typeCompte,
        sommes: { debit: x.totalDebit, credit: x.totalCredit },
    })));
    return {
        compte: {
            findMany: async ({ where }) => comptes.filter((c) => where.tenantId.in.includes(c.tenantId)).sort((a, b) => (a.numero < b.numero ? -1 : 1)),
        },
        ligneEcriture: {
            groupBy: async ({ where }) => where.ecriture.estGenereeParCloture !== false
                ? []
                : comptes
                    .filter((c) => where.ecriture.OR.some((o) => o.tenantId === c.tenantId && o.exerciceId === parDossier[c.tenantId].exerciceId))
                    .map((c) => ({ compteId: c.id, _sum: c.sommes })),
        },
    };
}
const service = (options) => {
    const majTenant = [];
    const s = new groupe_service_1.GroupeService({
        ...lectureDesBalances({
            siege: { exerciceId: 'ex-m', lignes: (options.siege ?? SIEGE).lignes },
            succ: { exerciceId: 'ex-s', lignes: (options.succursale ?? SUCCURSALE).lignes },
        }),
        exercice: {
            findFirst: async ({ where }) => where.id === 'ex-m' && where.tenantId === 'siege' ? EX : null,
        },
        tiersCompte: { findMany: async () => [] },
        tenant: {
            findUnique: async () => ({
                id: 'siege',
                nom: 'Société Kivu Trading',
                referentiel: options.referentiel,
                systemeComptableSyscohada: null,
                dossierCombinaisonId: 't-comb',
            }),
            findMany: async ({ where }) => where.dossierMereId === 'siege'
                ? [{ id: 'succ', nom: 'Succursale Lubumbashi', jeuEtatsFinanciersSycebnl: null, exercices: [{ ...EX, id: 'ex-s' }] }]
                : [],
            update: async (args) => {
                majTenant.push(args);
                return {};
            },
        },
        ecriture: {
            groupBy: async ({ where }) => where.OR.map((c) => ({
                tenantId: c.tenantId,
                exerciceId: c.exerciceId,
                statut: 'VALIDEE',
                estANouveauProvisoire: false,
                _count: { _all: 3 },
                _max: { date: new Date('2026-06-30') },
            })),
        },
    }, {}, undefined, undefined);
    return { s, majTenant };
};
describe('groupe SYSCOHADA · la liaison siège / succursales se neutralise, et sort', () => {
    it('retire les 184 à 187 des deux dossiers, et l’agrégat reste équilibré', async () => {
        const a = await service({ referentiel: 'SYSCOHADA' }).s.balanceAgregee('siege', 'ex-m');
        expect(a.controles.ecartLiaison18).toBe(0);
        expect(a.controles.liaison18Neutralisee).toBe(true);
        expect(a.lignes.map((x) => x.numero)).toEqual(['52110000', '57110000', '60110000', '70110000']);
        expect(a.totaux).toEqual({ debit: 2700, credit: 2700 });
        expect(a.detailParDossier.filter((d) => d.numero.startsWith('185'))).toHaveLength(2);
    });
    it('rend chaque ligne retirée, avec son motif, et l’élimination est symétrique', async () => {
        const a = await service({ referentiel: 'SYSCOHADA' }).s.balanceAgregee('siege', 'ex-m');
        const liaison = a.eliminations.filter((e) => e.motif === 'Compte de liaison siège / établissement');
        expect(liaison).toEqual([
            expect.objectContaining({ dossier: 'Société Kivu Trading', numero: '18510001', debit: 500, credit: 0, contrepartie: 'établissements et succursales' }),
            expect.objectContaining({ dossier: 'Succursale Lubumbashi', numero: '18510000', debit: 0, credit: 500, contrepartie: 'siège' }),
        ]);
        expect(a.totauxEliminations).toEqual({ debit: 500, credit: 500 });
        expect(a.controles.eliminationsSymetriques).toBe(true);
        expect(a.dossiers.map((d) => d.soldeLiaison18)).toEqual([500, -500]);
    });
});
describe('groupe SYSCOHADA · une liaison boiteuse ne sort pas, et bloque la liasse', () => {
    it('ne retire rien et chiffre l’écart', async () => {
        const a = await service({ referentiel: 'SYSCOHADA', succursale: SUCCURSALE_BOITEUSE }).s.balanceAgregee('siege', 'ex-m');
        expect(a.controles.ecartLiaison18).toBe(500);
        expect(a.controles.liaison18Neutralisee).toBe(false);
        expect(a.lignes.find((x) => x.numero === '18510001')?.solde).toBe(500);
        expect(a.eliminations).toEqual([]);
    });
    it('la liasse refuse et cite la fiche du COMPTE 18', async () => {
        const { s } = service({ referentiel: 'SYSCOHADA', succursale: SUCCURSALE_BOITEUSE });
        const echec = s.liasseGroupe('siege', 'ex-m', 'u1');
        await expect(echec).rejects.toThrow(common_1.BadRequestException);
        await expect(s.liasseGroupe('siege', 'ex-m', 'u1')).rejects.toThrow(/comptes de liaison siège \/ établissements \(184 à 187\) non neutralisés \(écart 500\.00 · Société Kivu Trading 500\.00, Succursale Lubumbashi 0\.00\).*égaux et de sens contraire dans les deux comptabilités.*fiche du COMPTE 18/);
    });
    it('le dossier de combinaison est réaligné sur le référentiel du siège avant tout', async () => {
        const { s, majTenant } = service({ referentiel: 'SYSCOHADA', succursale: SUCCURSALE_BOITEUSE });
        await expect(s.liasseGroupe('siege', 'ex-m', 'u1')).rejects.toThrow(common_1.BadRequestException);
        expect(majTenant[0]).toEqual({
            where: { id: 't-comb' },
            data: { referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL' },
        });
    });
});
describe('groupe SYCEBNL · le 185 est un dépôt reçu, pas une liaison', () => {
    it('reste dans l’agrégat, et le contrôle de liaison n’existe pas', async () => {
        const siegeSycebnl = {
            lignes: [l('18510000', 'Dépôts et cautionnements reçus · dépôts', 0, 300), l('52110000', 'Banque', 300, 0)],
            totaux: { debit: 300, credit: 300 },
        };
        const celluleSycebnl = { lignes: [l('57110000', 'Caisse', 100, 0), l('70100000', 'Cotisations', 0, 100)], totaux: { debit: 100, credit: 100 } };
        const a = await service({ referentiel: 'SYCEBNL', siege: siegeSycebnl, succursale: celluleSycebnl }).s.balanceAgregee('siege', 'ex-m');
        expect(a.lignes.find((x) => x.numero === '18510000')?.solde).toBe(-300);
        expect(a.controles.ecartLiaison18).toBeNull();
        expect(a.controles.liaison18Neutralisee).toBeNull();
        expect(a.dossiers.map((d) => d.soldeLiaison18)).toEqual([null, null]);
        expect(a.eliminations).toEqual([]);
    });
});
describe('classeur et supervision · la liaison se montre là où elle existe', () => {
    const entetes = async (referentiel) => {
        const { buffer } = await service({ referentiel }).s.balanceAgregeeExcel('siege', 'ex-m');
        const wb = new exceljs_1.Workbook();
        await wb.xlsx.load(buffer);
        return wb.getWorksheet('Contrôles').getRow(1).values.filter(Boolean);
    };
    it('la feuille « Contrôles » porte la colonne de liaison en SYSCOHADA, et seulement là', async () => {
        expect(await entetes('SYSCOHADA')).toContain('Solde 184 à 187 (liaison siège / établissements)');
        expect(await entetes('SYCEBNL')).toEqual(['Dossier', 'Débit', 'Crédit', 'Solde 58 (virements internes)', 'Équilibre']);
    });
    it('la supervision rend le solde du compte réfléchi de la succursale', async () => {
        const sup = await service({ referentiel: 'SYSCOHADA' }).s.supervision('siege', 'ex-m');
        expect(sup.cellules[0].soldeLiaison18).toBe(-500);
        const supSycebnl = await service({ referentiel: 'SYCEBNL' }).s.supervision('siege', 'ex-m');
        expect(supSycebnl.cellules[0].soldeLiaison18).toBeNull();
    });
});
describe('caracteresCombinaison · le dossier de combinaison porte le référentiel du siège', () => {
    it('SYSCOHADA au système du siège, SYCEBNL en jeu ASSOCIATIONS', () => {
        expect(groupe_service_1.GroupeService.caracteresCombinaison({ referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'MINIMAL_TRESORERIE' })).toEqual({
            referentiel: 'SYSCOHADA',
            systemeComptableSyscohada: 'MINIMAL_TRESORERIE',
        });
        expect(groupe_service_1.GroupeService.caracteresCombinaison({ referentiel: 'SYCEBNL', systemeComptableSyscohada: null })).toEqual({
            referentiel: 'SYCEBNL',
            jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
            systemeComptableSyscohada: null,
        });
    });
    it('F153 · un siège « projets de développement » garde son jeu, seul le SMT est remplacé', () => {
        const jeu = (j) => groupe_service_1.GroupeService.caracteresCombinaison({ referentiel: 'SYCEBNL', systemeComptableSyscohada: null, jeuEtatsFinanciersSycebnl: j })
            .jeuEtatsFinanciersSycebnl;
        expect(jeu('PROJETS_DEVELOPPEMENT')).toBe('PROJETS_DEVELOPPEMENT');
        expect(jeu('ASSOCIATIONS_ORDRES_PROFESSIONNELS')).toBe('ASSOCIATIONS_ORDRES_PROFESSIONNELS');
        expect(jeu('SYSTEME_MINIMAL_TRESORERIE')).toBe('ASSOCIATIONS_ORDRES_PROFESSIONNELS');
    });
});
describe('F153 · le câblage · le dossier de combinaison lit le jeu du siège', () => {
    it('un siège « projets » ouvre sa combinaison au jeu des projets', async () => {
        const siege = { nom: 'Projet X', dossierCombinaisonId: null, referentiel: 'SYCEBNL', systemeComptableSyscohada: null, jeuEtatsFinanciersSycebnl: 'PROJETS_DEVELOPPEMENT' };
        const cree = jest.fn(async (_a) => ({ id: 'comb' }));
        const prisma = {
            tenant: {
                findUnique: jest.fn(async ({ select }) => Object.fromEntries(Object.entries(siege).filter(([k]) => select[k]))),
                create: cree,
                update: jest.fn(async () => ({})),
            },
        };
        const s = new groupe_service_1.GroupeService(prisma, {}, {}, {});
        await s.assurerDossierCombinaison('siege');
        expect(cree.mock.calls[0][0].data.jeuEtatsFinanciersSycebnl).toBe('PROJETS_DEVELOPPEMENT');
    });
});
//# sourceMappingURL=liaison-etablissements-syscohada.spec.js.map