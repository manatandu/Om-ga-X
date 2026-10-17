"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const personnel_service_1 = require("./personnel.service");
const baremes_dossier_1 = require("./baremes-dossier");
const cotisations_paie_1 = require("./cotisations-paie");
const bareme_smig_1 = require("./bareme-smig");
const cnss = (tenantId, aPartirDu, pension) => ({
    tenantId,
    bareme: 'CNSS',
    aPartirDu,
    reference: `Référence d'essai CNSS du ${aPartirDu}`,
    valeurs: {
        prestationsAuxFamilles: 7,
        pensionsEmployeur: pension,
        pensionsTravailleur: pension,
        risquesProfessionnels: 2,
    },
});
const inpp = (tenantId, aPartirDu, prive) => ({
    tenantId,
    bareme: 'INPP',
    aPartirDu,
    reference: `Référence d'essai INPP du ${aPartirDu}`,
    valeurs: {
        publicPourCent: 4.5,
        priveParTranche: [
            { jusqua: 50, tauxPourCent: prive },
            { jusqua: null, tauxPourCent: prive / 2 },
        ],
    },
});
const onem = (tenantId, aPartirDu, taux) => ({
    tenantId,
    bareme: 'ONEM',
    aPartirDu,
    reference: `Référence d'essai ONEM du ${aPartirDu}`,
    valeurs: { tauxPourCent: taux },
});
const smig = (tenantId, aPartirDu, smigJournalierFc) => ({
    tenantId,
    bareme: 'SMIG',
    aPartirDu,
    reference: `Référence d'essai SMIG du ${aPartirDu}`,
    valeurs: { smigJournalierFc },
});
const VERSIONS = [
    cnss('t-1', '2026-07-15', 6),
    onem('t-1', '2024-03-01', 0.3),
    cnss('t-2', '2026-05-01', 9),
    inpp('t-1', '2026-09-01', 4),
    smig('t-1', '2025-08-01', 15_000),
    cnss('t-1', '2027-01-01', 7),
    onem('t-2', '2026-01-01', 0.9),
    cnss('t-1', '2026-03-01', 5.5),
    inpp('t-1', '2026-08-31', 3.8),
    smig('t-1', '2026-06-01', 23_000),
    onem('t-1', '2026-11-01', 0.6),
    smig('t-2', '2026-02-01', 30_000),
];
const MOIS = ['2024-06', '2025-10', '2026-02', '2026-03', '2026-07', '2026-08', '2026-09', '2026-12', '2027-01'];
function lectureBornee(versions) {
    const findFirst = jest.fn(async (args) => {
        const { tenantId, bareme, aPartirDu, ...reste } = args.where;
        if (Object.keys(reste).length > 0) {
            throw new Error(`Filtre inconnu de la doublure : ${Object.keys(reste).join(', ')}`);
        }
        let lignes = versions.filter((v) => (tenantId === undefined || v.tenantId === tenantId) && (bareme === undefined || v.bareme === bareme));
        for (const [op, borne] of Object.entries((aPartirDu ?? {}))) {
            if (op === 'lt')
                lignes = lignes.filter((v) => v.aPartirDu < borne);
            else if (op === 'lte')
                lignes = lignes.filter((v) => v.aPartirDu <= borne);
            else if (op === 'gt')
                lignes = lignes.filter((v) => v.aPartirDu > borne);
            else if (op === 'gte')
                lignes = lignes.filter((v) => v.aPartirDu >= borne);
            else
                throw new Error(`Opérateur inconnu de la doublure : ${op}`);
        }
        if (args.orderBy) {
            const { aPartirDu: sens, ...autres } = args.orderBy;
            if (Object.keys(autres).length > 0 || (sens !== 'asc' && sens !== 'desc')) {
                throw new Error(`Tri inconnu de la doublure : ${JSON.stringify(args.orderBy)}`);
            }
            lignes = [...lignes].sort((a, b) => sens === 'asc' ? a.aPartirDu.localeCompare(b.aPartirDu) : b.aPartirDu.localeCompare(a.aPartirDu));
        }
        const trouvee = lignes[0];
        if (!trouvee)
            return null;
        return { bareme: trouvee.bareme, aPartirDu: trouvee.aPartirDu, reference: trouvee.reference, valeurs: trouvee.valeurs };
    });
    return findFirst;
}
function service(versions) {
    const findFirst = lectureBornee(versions);
    const salarie = { findFirst: jest.fn().mockResolvedValue(null) };
    const tenant = { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) };
    const prisma = { salarie, tenant, versionBaremePaie: { findFirst } };
    return { svc: new personnel_service_1.PersonnelService(prisma), findFirst, salarie, tenant };
}
function serviceSurToutesLesVersions(versions, tenantId) {
    const { svc } = service(versions);
    const toutes = versions
        .filter((v) => v.tenantId === tenantId)
        .map(({ bareme, aPartirDu, reference, valeurs }) => ({ bareme, aPartirDu, reference, valeurs }));
    jest
        .spyOn(svc, 'versionsBaremesDuMois')
        .mockResolvedValue(toutes);
    return svc;
}
const saisie = (moisDePaie) => ({
    moisDePaie,
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 300_000 }],
    natureEmployeurInpp: 'PRIVE',
    effectif: 30,
    joursPayes: bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS,
    classeProfessionnelle: 5,
    enfantsBeneficiairesAllocations: 2,
});
const ligne = (r, organisme) => {
    const l = r.cotisations.lignes.find((x) => x.organisme === organisme);
    if (!l)
        throw new Error(`Aucune ligne ${organisme} pour ${r.moisDePaie}`);
    return l;
};
describe('simulerPaie · les barèmes du cabinet lus pour le seul mois simulé', () => {
    it.each(MOIS)('%s · le même résultat, au centime, que sur toutes les versions du dossier', async (mois) => {
        const { svc } = service(VERSIONS);
        const bornee = await svc.simulerPaie('t-1', null, saisie(mois));
        const complete = await serviceSurToutesLesVersions(VERSIONS, 't-1').simulerPaie('t-1', null, saisie(mois));
        expect(bornee).toEqual(complete);
    });
    it('le jeu d\'essai atteint bien les versions du cabinet, et les versions livrées plus récentes', async () => {
        const { svc } = service(VERSIONS);
        const [octobre25, mars, juillet, aout, septembre, decembre, janvier27] = await Promise.all(['2025-10', '2026-03', '2026-07', '2026-08', '2026-09', '2026-12', '2027-01'].map((m) => svc.simulerPaie('t-1', null, saisie(m))));
        expect(ligne(octobre25, 'ONEM').source).toContain(cotisations_paie_1.BAREMES_ONEM[cotisations_paie_1.BAREMES_ONEM.length - 1].reference);
        expect(ligne(octobre25, 'ONEM').source).not.toContain("Référence d'essai ONEM du 2024-03-01");
        expect(ligne(mars, 'CNSS').source).toContain("Référence d'essai CNSS du 2026-03-01");
        expect(ligne(juillet, 'CNSS').source).toContain("Référence d'essai CNSS du 2026-07-15");
        expect(ligne(aout, 'INPP').source).toContain("Référence d'essai INPP du 2026-08-31");
        expect(ligne(septembre, 'INPP').source).toContain("Référence d'essai INPP du 2026-09-01");
        expect(ligne(decembre, 'CNSS').source).toContain("Référence d'essai CNSS du 2026-07-15");
        expect(ligne(decembre, 'ONEM').source).toContain("Référence d'essai ONEM du 2026-11-01");
        expect(ligne(janvier27, 'CNSS').source).toContain("Référence d'essai CNSS du 2027-01-01");
        expect(ligne(octobre25, 'CNSS').assietteFc).toBe(15_000 * bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS);
        expect(ligne(mars, 'CNSS').assietteFc).not.toBe(15_000 * bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS);
        expect(ligne(juillet, 'CNSS').assietteFc).toBe(23_000 * bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS);
        for (const r of [octobre25, mars, juillet, aout, septembre, decembre, janvier27]) {
            expect(JSON.stringify(r)).not.toContain('2026-05-01');
        }
    });
    it('une lecture par barème servi, bornée au dossier et au premier jour du mois suivant, la plus récente d\'abord', async () => {
        for (const [mois, borne] of [
            ['2026-07', '2026-08-01'],
            ['2026-12', '2027-01-01'],
        ]) {
            const { svc, findFirst } = service(VERSIONS);
            await svc.simulerPaie('t-1', null, saisie(mois));
            expect(findFirst).toHaveBeenCalledTimes(baremes_dossier_1.BAREMES_SERVIS.length);
            expect(findFirst.mock.calls.map(([a]) => a.where.bareme).sort()).toEqual([...baremes_dossier_1.BAREMES_SERVIS].sort());
            for (const [args] of findFirst.mock.calls) {
                expect(args.where).toEqual({ tenantId: 't-1', bareme: args.where.bareme, aPartirDu: { lt: borne } });
                expect(args.orderBy).toEqual({ aPartirDu: 'desc' });
            }
        }
    });
    it.each(['2026-13', '2026-00', '2026-1', '26-01', ''])('un mois illisible (« %s ») est refusé avant toute lecture', async (mois) => {
        const { svc, findFirst, salarie, tenant } = service(VERSIONS);
        await expect(svc.simulerPaie('t-1', null, saisie(mois))).rejects.toThrow(common_1.BadRequestException);
        await expect(svc.simulerPaie('t-1', null, saisie(mois))).rejects.toThrow('Mois de paie illisible · la forme attendue est AAAA-MM.');
        expect(findFirst).not.toHaveBeenCalled();
        expect(salarie.findFirst).not.toHaveBeenCalled();
        expect(tenant.findUniqueOrThrow).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=simulation-baremes-du-mois.spec.js.map