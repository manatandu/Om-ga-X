"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const personnel_service_1 = require("./personnel.service");
const assiettes_paie_1 = require("./assiettes-paie");
const bareme_irpp_1 = require("./bareme-irpp");
function service(salarie, referentiel) {
    const findFirst = jest.fn().mockResolvedValue(salarie === undefined ? null : salarie);
    const tenantFind = jest.fn().mockResolvedValue({ referentiel: referentiel ?? 'SYSCOHADA' });
    const prisma = {
        salarie: { findFirst },
        tenant: { findUniqueOrThrow: tenantFind },
        versionBaremePaie: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return { svc: new personnel_service_1.PersonnelService(prisma), findFirst, tenantFind };
}
const dto = (over = {}) => ({
    moisDePaie: '2026-03',
    elements: [
        { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
    ],
    ...over,
});
describe('La simulation appelle bien les deux moteurs, et avec la bonne entrée', () => {
    it("rend EXACTEMENT ce que les fonctions pures rendent sur les mêmes données", () => {
        const { svc } = service();
        return svc
            .simulerPaie('t-1', null, dto({ retenuesArticle71Fc: 50_000, personnesACharge: 2 }))
            .then((res) => {
            const attendu = (0, assiettes_paie_1.assiettes)([{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000, conditionArticle69Attestee: null }], { tauxLegalAllocationsFamilialesFc: null, retenuesArticle71Fc: 100_000 });
            expect(res.assiettes.assietteSocialeFc).toBe(attendu.assietteSocialeFc);
            expect(res.assiettes.assietteFiscaleNetteFc).toBe(attendu.assietteFiscaleNetteFc);
            expect(res.retenue?.retenueFc).toBeCloseTo((0, bareme_irpp_1.retenueMensuelle)('2026-03', attendu.assietteFiscaleNetteFc, 2).retenueFc, 6);
        });
    });
    it("assied la retenue sur l'assiette NETTE de l'article 71, jamais sur le brut", () => {
        const { svc } = service();
        return svc
            .simulerPaie('t-1', null, dto({ retenuesArticle71Fc: 200_000 }))
            .then((res) => {
            const surLeBrut = (0, bareme_irpp_1.retenueMensuelle)('2026-03', 1_000_000, 0).retenueFc;
            const surLeNet = (0, bareme_irpp_1.retenueMensuelle)('2026-03', 750_000, 0).retenueFc;
            expect(surLeNet).toBeLessThan(surLeBrut);
            expect(res.retenue?.retenueFc).toBeCloseTo(surLeNet, 6);
        });
    });
    it("ne chiffre AUCUNE retenue tant qu'une assiette est indéterminée", () => {
        const { svc } = service();
        return svc
            .simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'INDEMNITE_DE_TRANSPORT', libelle: 'Transport', montantFc: 90_000 },
            ],
        }))
            .then((res) => {
            expect(res.assiettes.assietteFiscaleNetteFc).toBeNull();
            expect(res.retenue).toBeNull();
            expect(res.assiettes.abstentions).toHaveLength(1);
            expect(res.assiettes.assietteSocialeFc).toBe(1_000_000);
        });
    });
    it("ne présume JAMAIS un taux légal d'allocations familiales à zéro", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations', montantFc: 40_000 },
            ],
        }));
        expect(res.assiettes.assietteFiscaleNetteFc).toBeNull();
        expect(res.retenue).toBeNull();
        expect(res.assiettes.abstentions[0].motif).toBe('TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI');
    });
    it("chiffre dès que le cabinet a fourni le taux légal", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations', montantFc: 40_000 },
            ],
            tauxLegalAllocationsFamilialesFc: 25_000,
        }));
        expect(res.assiettes.assietteFiscaleNetteFc).toBe(965_000);
        expect(res.retenue).not.toBeNull();
    });
    it("refuse le barème sur un mois antérieur au 1er janvier 2026, et le DIT", () => {
        const { svc } = service();
        return svc.simulerPaie('t-1', null, dto({ moisDePaie: '2025-11' })).then((res) => {
            expect(res.baremeApplicable).toBe(false);
            expect(res.retenue).toBeNull();
            expect(res.motifBaremeInapplicable).toContain('1er janvier 2026');
            expect(res.assiettes.assietteSocialeFc).toBe(1_000_000);
        });
    });
});
describe('Le cloisonnement de la simulation', () => {
    it('borne la lecture du salarié au dossier de la session', async () => {
        const { svc, findFirst } = service({ nom: 'X', nomConjoint: 'Y', _count: { enfants: 3 } });
        await svc.simulerPaie('t-1', 'sal-9', dto());
        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sal-9', tenantId: 't-1' } }));
    });
    it("rend introuvable le salarié d'un autre dossier", async () => {
        const { svc } = service();
        await expect(svc.simulerPaie('t-1', 'sal-etranger', dto())).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
});
describe('Passe F11 · la simulation lit la ville du dossier pour l’indemnité de logement', () => {
    it('sert la réserve de la DGRK à un siège de Kinshasa, pas ailleurs', async () => {
        const elements = [
            { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
            { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 200_000 },
        ];
        const kin = service();
        kin.tenantFind.mockResolvedValue({ referentiel: 'SYSCOHADA', ville: 'Kinshasa' });
        const r = await kin.svc.simulerPaie('t-1', null, dto({ elements }));
        expect(r.reserveIndemniteLogement).toMatch(/DGRK/);
        expect(kin.tenantFind.mock.calls[0][0].select).toMatchObject({ ville: true });
        const autre = service();
        autre.tenantFind.mockResolvedValue({ referentiel: 'SYSCOHADA', ville: 'Goma' });
        expect((await autre.svc.simulerPaie('t-1', null, dto({ elements }))).reserveIndemniteLogement).toBeNull();
    });
});
describe('Passe D2 · le régime CNSS se lit sur le contrat qui couvre le mois', () => {
    const avecContrat = (type) => ({
        nom: 'X',
        nomConjoint: null,
        _count: { enfants: 0 },
        contrats: [{ id: 'c-1', type, dateEntreeEnVigueur: new Date('2026-01-05T00:00:00Z'), dateFin: null }],
    });
    it('un apprenti ne cotise qu’aux risques professionnels, sans quote-part ouvrière', async () => {
        const { svc, findFirst } = service(avecContrat('APPRENTISSAGE'));
        const res = await svc.simulerPaie('t-1', 'sal-9', dto({ natureEmployeurInpp: 'PRIVE', effectif: 10 }));
        expect(res.cotisations.lignes.filter((l) => l.organisme === 'CNSS').map((l) => l.cle)).toEqual(['cnss-rp']);
        expect(res.cotisations.totalTravailleurFc).toBe(0);
        expect(findFirst.mock.calls[0][0].select.contrats.select).toMatchObject({ type: true });
    });
    it('un CDI garde la quote-part ouvrière des pensions', async () => {
        const { svc } = service(avecContrat('DUREE_INDETERMINEE'));
        const res = await svc.simulerPaie('t-1', 'sal-9', dto({ natureEmployeurInpp: 'PRIVE', effectif: 10 }));
        expect(res.cotisations.lignes.some((l) => l.cle === 'cnss-pension-travailleur')).toBe(true);
    });
});
describe("Les personnes à charge sont PROPOSÉES, jamais substituées", () => {
    it("propose le compte du registre et retient celui que le cabinet a donné", async () => {
        const { svc } = service({ nom: 'X', nomConjoint: 'Y', _count: { enfants: 3 } });
        const res = await svc.simulerPaie('t-1', 'sal-1', dto({ personnesACharge: 2 }));
        expect(res.propositionPersonnesACharge).toBe(4);
        expect(res.personnesAChargeRetenues).toBe(2);
        expect(res.retenue?.annuel.personnesAChargeRetenues).toBe(2);
    });
    it("ne substitue PAS la proposition quand le cabinet n'a rien donné", async () => {
        const { svc } = service({ nom: 'X', nomConjoint: 'Y', _count: { enfants: 3 } });
        const res = await svc.simulerPaie('t-1', 'sal-1', dto());
        expect(res.propositionPersonnesACharge).toBe(4);
        expect(res.personnesAChargeRetenues).toBe(0);
        expect(res.retenue?.annuel.quotitePourCent).toBe(0);
    });
    it("nomme les articles 124 et 125 dans la source de la proposition", async () => {
        const { svc } = service({ nom: 'X', nomConjoint: null, _count: { enfants: 1 } });
        const res = await svc.simulerPaie('t-1', 'sal-1', dto());
        expect(res.propositionPersonnesACharge).toBe(1);
        expect(res.sourceProposition).toContain('article 124');
        expect(res.sourceProposition).toContain('article 125');
        expect(res.sourceProposition).toContain("pendant l'année précédant celle de la réalisation des revenus");
        expect(res.sourceProposition).toContain('double négation');
    });
});
describe("Ce que la simulation annonce ne pas être", () => {
    it("dit, avant tout chiffre, qu'elle n'est pas un bulletin de paie", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto());
        expect(res.avertissement).toContain("n'est PAS un bulletin de paie");
        expect(res.avertissement).toContain('ACOMPTE');
    });
    it('ne conserve rien · aucune écriture Prisma sur cette route', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'personnel.service.ts'), 'utf8');
        const debut = source.indexOf('async simulerPaie(');
        const fin = source.indexOf('  /** Le nombre de renouvellements', debut);
        const corps = source.slice(debut, fin);
        expect(debut).toBeGreaterThan(0);
        expect(fin).toBeGreaterThan(debut);
        const appels = corps.match(/this\.prisma\.\w+\.(\w+)\(/g) ?? [];
        expect(appels.length).toBeGreaterThan(0);
        for (const appel of appels) {
            expect(appel).toMatch(/\.(find\w*|count|aggregate|groupBy)\($/);
        }
        expect(corps).toContain('this.prisma.salarie.findFirst(');
        expect(corps).toContain('this.prisma.tenant.findUniqueOrThrow(');
        expect(corps).toContain('this.versionsBaremesDuMois(tenantId, dto.moisDePaie)');
        const debutVersions = source.indexOf('private async versionsBaremesDuMois(');
        const versions = source.slice(debutVersions, source.indexOf('\n  }\n', debutVersions));
        expect(versions).toContain('this.prisma.versionBaremePaie.findFirst(');
        for (const appel of versions.match(/this\.prisma\.\w+\.(\w+)\(/g) ?? []) {
            expect(appel).toMatch(/\.(find\w*|count|aggregate|groupBy)\($/);
        }
    });
});
describe("P2b · l'ordre de calcul, et le net qui ne part pas de l'assiette", () => {
    it("assied les cotisations sur l'assiette SOCIALE, pas sur le total versé", () => {
        const { svc } = service();
        return svc
            .simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
            ],
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }))
            .then((res) => {
            expect(res.assiettes.assietteSocialeFc).toBe(1_000_000);
            for (const ligne of res.cotisations.lignes) {
                expect(ligne.assietteFc).toBe(1_000_000);
            }
            expect(res.cotisations.totalTravailleurFc).toBeCloseTo(50_000, 6);
        });
    });
    it("fait entrer la quote-part ouvrière dans les retenues de l'article 71", () => {
        const { svc } = service();
        return svc
            .simulerPaie('t-1', null, dto({ natureEmployeurInpp: 'PRIVE', effectif: 10 }))
            .then((res) => {
            expect(res.assiettes.retenuesArticle71Fc).toBeCloseTo(50_000, 6);
            expect(res.assiettes.assietteFiscaleNetteFc).toBe(950_000);
        });
    });
    it("ADDITIONNE la quote-part calculée et les autres versements saisis", () => {
        const { svc } = service();
        return svc
            .simulerPaie('t-1', null, dto({
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
            retenuesArticle71Fc: 20_000,
        }))
            .then((res) => {
            expect(res.assiettes.retenuesArticle71Fc).toBeCloseTo(70_000, 6);
        });
    });
    it('rend un net qui part du TOTAL VERSÉ, logement compris', () => {
        const { svc } = service();
        return svc
            .simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
            ],
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }))
            .then((res) => {
            expect(res.net.totalVerseFc).toBe(1_400_000);
            expect(res.net.netAPayerFc).toBeCloseTo(1_400_000 - res.net.quotePartOuvriereFc - (res.retenue?.retenueFc ?? 0), 6);
            expect(res.net.netAPayerFc).toBeGreaterThan(res.assiettes.assietteSocialeFc - 100_000);
        });
    });
    it("ne verse pas l'avantage en nature, qui reste dans les assiettes (audit final F22)", async () => {
        const { svc } = service();
        const avec = (avantage) => svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                ...(avantage ? [{ nature: 'AVANTAGE_EN_NATURE', libelle: 'Véhicule', montantFc: avantage }] : []),
            ],
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        const [sans, avecVehicule] = await Promise.all([avec(0), avec(300_000)]);
        expect({
            verse: avecVehicule.net.totalVerseFc,
            assietteElargie: avecVehicule.assiettes.assietteSocialeFc > sans.assiettes.assietteSocialeFc,
            passationEquilibree: avecVehicule.passation.equilibree,
        }).toEqual({ verse: 1_000_000, assietteElargie: true, passationEquilibree: true });
    });
    it("passe F5 · ne verse pas le logement FOURNI en nature, qui reste hors de l'assiette sociale", async () => {
        const { svc } = service();
        const avec = (enNature) => svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 200_000, conditionArticle69Attestee: true, enNature },
            ],
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        const [especes, nature] = await Promise.all([avec(false), avec(true)]);
        expect({
            verseEspeces: especes.net.totalVerseFc,
            verseNature: nature.net.totalVerseFc,
            memeAssietteSociale: nature.assiettes.assietteSocialeFc === especes.assiettes.assietteSocialeFc,
            passationEquilibree: nature.passation.equilibree,
        }).toEqual({ verseEspeces: 1_200_000, verseNature: 1_000_000, memeAssietteSociale: true, passationEquilibree: true });
    });
    it("passe F5 · refuse « fourni en nature » sur un salaire", async () => {
        const { svc } = service();
        await expect(svc.simulerPaie('t-1', null, dto({
            elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000, enNature: true }],
        }))).rejects.toThrow('seuls le logement, le transport et les soins');
    });
    it("s'abstient sur l'INPP sans emporter la CNSS ni le net", () => {
        const { svc } = service();
        return svc.simulerPaie('t-1', null, dto()).then((res) => {
            expect(res.cotisations.abstentions.join(' ')).toContain('NATURE');
            expect(res.cotisations.lignes.some((l) => l.organisme === 'CNSS')).toBe(true);
            expect(res.net.netAPayerFc).not.toBeNull();
        });
    });
});
describe("P3 · la passation lit le référentiel du dossier, et le cloisonne", () => {
    it('borne la lecture du référentiel au dossier de la session', async () => {
        const { svc, tenantFind } = service();
        await svc.simulerPaie('t-1', null, dto({ natureEmployeurInpp: 'PRIVE', effectif: 10 }));
        expect(tenantFind).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't-1' } }));
    });
    it('route la pension vers 43130000 en SYSCOHADA et 43210000 en SYCEBNL', async () => {
        const p = { natureEmployeurInpp: 'PRIVE', effectif: 10 };
        const sys = await service(undefined, 'SYSCOHADA').svc.simulerPaie('t-1', null, dto(p));
        const syc = await service(undefined, 'SYCEBNL').svc.simulerPaie('t-1', null, dto(p));
        expect(sys.passation.lignes.some((l) => l.compte === '43130000')).toBe(true);
        expect(syc.passation.lignes.some((l) => l.compte === '43210000')).toBe(true);
        expect(syc.passation.lignes.some((l) => l.compte === '43130000')).toBe(false);
    });
    it("propose une écriture équilibrée sur un dossier complet", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({ natureEmployeurInpp: 'PRIVE', effectif: 10 }));
        expect(res.passation.refus).toEqual([]);
        expect(res.passation.equilibree).toBe(true);
        expect(res.passation.totalDebitFc).toBeCloseTo(res.passation.totalCreditFc, 6);
    });
    it("REFUSE la passation tant que la nature de l'employeur INPP manque", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto());
        expect(res.passation.lignes).toEqual([]);
        expect(res.passation.refus.map((r) => r.motif)).toContain('COTISATION_EN_ABSTENTION');
        expect(res.assiettes.assietteSocialeFc).toBe(1_000_000);
        expect(res.net.netAPayerFc).not.toBeNull();
    });
});
describe("Le « taux légal » des allocations familiales, calculé et non saisi", () => {
    it("le tire de la colonne 19 et le MENSUALISE par vingt-six", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                {
                    nature: 'ALLOCATIONS_FAMILIALES_LEGALES',
                    libelle: 'Allocations',
                    montantFc: 30_000,
                },
            ],
            enfantsBeneficiairesAllocations: 1,
        }));
        expect(res.tauxLegalAllocationsFamilialesFc).toBeCloseTo(796.3 * 26, 6);
        expect(res.assiettes.abstentions).toHaveLength(0);
    });
    it('le porte au NOMBRE D\'ENFANTS, pas à un seul', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({ enfantsBeneficiairesAllocations: 3 }));
        expect(res.tauxLegalAllocationsFamilialesFc).toBeCloseTo(796.3 * 26 * 3, 6);
    });
    it("C1 · le rend AU CENTIME, et une allocation égale au taux légal n'a aucun excédent imposable", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations', montantFc: 62_111.4 },
            ],
            enfantsBeneficiairesAllocations: 3,
        }));
        expect(res.tauxLegalAllocationsFamilialesFc).toBe(62_111.4);
        const sort = res.assiettes.sortsFiscaux.find((x) => x.libelle === 'Allocations');
        expect(sort?.imposableFc).toBe(0);
        expect(sort?.motif).toContain("L'allocation est entièrement immunisée.");
        expect(res.assiettes.assietteFiscaleBruteFc).toBe(1_000_000);
    });
    it('PASSE D2 · sur un mois incomplet, le plafond suit les jours ouvrant droit (mention 28)', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({ enfantsBeneficiairesAllocations: 2, joursAllocationsFamiliales: 13, joursPayes: 13 }));
        expect(res.tauxLegalAllocationsFamilialesFc).toBeCloseTo(796.3 * 13 * 2, 6);
        expect(res.reserveTauxLegalAllocations).toMatch(/13 jour\(s\) ouvrant droit/);
        const entier = await svc.simulerPaie('t-1', null, dto({ enfantsBeneficiairesAllocations: 2, joursPayes: 13 }));
        expect(entier.tauxLegalAllocationsFamilialesFc).toBeCloseTo(796.3 * 26 * 2, 6);
        expect(entier.reserveTauxLegalAllocations).toMatch(/déclaré incomplet \(13 jours payés\)/);
    });
    it("ne le devine PAS quand le nombre d'enfants n'est pas déclaré", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto());
        expect(res.tauxLegalAllocationsFamilialesFc).toBeNull();
    });
    it("laisse PRIMER le taux saisi, pour le mois hors annexe", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            tauxLegalAllocationsFamilialesFc: 12_345,
            enfantsBeneficiairesAllocations: 2,
        }));
        expect(res.tauxLegalAllocationsFamilialesFc).toBe(12_345);
    });
    it("C2 · l'abstention dit la cause que le service connaît, et le geste qui la lève", async () => {
        const { svc } = service();
        const elements = [
            { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
            { nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations', montantFc: 50_000 },
        ];
        const abstention = async (over) => {
            const res = await svc.simulerPaie('t-1', null, dto({ elements, ...over }));
            const a = res.assiettes.abstentions.find((x) => x.libelle === 'Allocations');
            expect(a?.explication).not.toMatch(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/);
            return a?.explication ?? '';
        };
        const sansEnfants = await abstention({});
        expect(sansEnfants).toContain("Renseignez le nombre d'enfants bénéficiaires");
        expect(sansEnfants).not.toMatch(/saisissez le taux légal/i);
        const sansGrille = await abstention({ moisDePaie: '2019-03', enfantsBeneficiairesAllocations: 2 });
        expect(sansGrille).toContain('Saisissez le taux légal du mois');
        expect(sansGrille).toContain('De janvier à juin 2019');
        expect(sansGrille).not.toMatch(/renseignez le nombre d.enfants/i);
        const lesDeux = await abstention({ moisDePaie: '2019-03' });
        expect(lesDeux).toContain('Saisissez le taux légal du mois');
        expect(lesDeux).not.toMatch(/renseignez le nombre d.enfants/i);
        const saisi = await svc.simulerPaie('t-1', null, dto({ elements, moisDePaie: '2019-03', tauxLegalAllocationsFamilialesFc: 40_000 }));
        expect(saisi.assiettes.abstentions.filter((x) => x.libelle === 'Allocations')).toHaveLength(0);
    });
    it("rend null hors période d'annexe, même avec des enfants déclarés", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            moisDePaie: '2018-09',
            enfantsBeneficiairesAllocations: 2,
        }));
        expect(res.tauxLegalAllocationsFamilialesFc).toBeNull();
    });
});
describe("La quotité saisissable est appelée sur la RÉMUNÉRATION, pas sur le total versé", () => {
    it("s'assied sur l'assiette SOCIALE et déduit les retenues réellement liquidées", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                {
                    nature: 'INDEMNITE_DE_TRANSPORT',
                    libelle: 'Transport',
                    montantFc: 200_000,
                    conditionArticle69Attestee: true,
                },
            ],
            classeProfessionnelle: 1,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        expect(res.quotite.baseFc).toBeCloseTo(res.assiettes.assietteSocialeFc -
            res.cotisations.totalTravailleurFc -
            (res.retenue ? res.retenue.retenueFc : 0), 6);
        expect(res.net.totalVerseFc).toBe(1_200_000);
        expect(res.quotite.baseFc).toBeLessThan(res.net.totalVerseFc);
    });
    it("s'abstient sans classe, et la simulation tient quand même", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({ natureEmployeurInpp: 'PRIVE', effectif: 10 }));
        expect(res.quotite.quotiteOrdinaireFc).toBeNull();
        expect(res.quotite.abstentions.map((a) => a.motif)).toContain('CLASSE_PROFESSIONNELLE_ABSENTE');
        expect(res.net.netAPayerFc).not.toBeNull();
    });
    it("CHIFFRE le logement en nature depuis l'arrêté de 2005, sans s'abstenir", async () => {
        const { svc } = service();
        const avec = await svc.simulerPaie('t-1', null, dto({
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        const sans = await svc.simulerPaie('t-1', null, dto({
            classeProfessionnelle: 5,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        expect(avec.quotite.abstentions).toHaveLength(0);
        expect(avec.quotite.evaluationForfaitaireLogementFc).toBeCloseTo((796.3 / 5) * 26, 6);
        expect(avec.quotite.baseFc).toBeLessThan(sans.quotite.baseFc);
    });
    it("ne déduit pas le logement quand l'employeur l'a déjà défalqué", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
            logementEnNatureDejaDefalque: true,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        expect(res.quotite.evaluationForfaitaireLogementFc).toBe(0);
    });
    it("C3 (P12 f) · défalque le logement que le BULLETIN porte fourni en nature, case non cochée", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            classeProfessionnelle: 5,
            natureEmployeurInpp: 'PRIVE',
            effectif: 30,
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 250_000, enNature: true },
            ],
        }));
        expect(res.quotite.evaluationForfaitaireLogementFc).toBeCloseTo(4_140.76, 2);
        expect(res.quotite.baseFc).toBeCloseTo(822_759.24, 2);
        expect(res.quotite.quotiteOrdinaireFc).toBeCloseTo(164_551.85, 2);
    });
    it("C3 · une INDEMNITÉ de logement versée n'est pas un logement fourni · aucune défalcation", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            classeProfessionnelle: 5,
            natureEmployeurInpp: 'PRIVE',
            effectif: 30,
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Indemnité de logement', montantFc: 250_000 },
            ],
        }));
        expect(res.quotite.evaluationForfaitaireLogementFc).toBe(0);
    });
});
describe("L'avertissement de la simulation dit la vérité de ce qu'elle fait", () => {
    it("ne prétend plus ne liquider aucune cotisation patronale ni ne proposer d'écriture", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto());
        expect(res.avertissement).not.toMatch(/ne liquide aucune cotisation patronale/i);
        expect(res.avertissement).not.toMatch(/ne propose aucune écriture/i);
        expect(res.avertissement).toMatch(/ne tient PAS lieu de livre de paie/i);
        expect(res.avertissement).toMatch(/aucun décompte écrit/i);
        expect(res.avertissement).toMatch(/ACOMPTE/);
    });
});
describe('Le livre de paie ne lit ni n\'écrit rien', () => {
    it("rend son verdict sans toucher à Prisma", () => {
        const { svc, findFirst, tenantFind } = service();
        const v = svc.livreDePaie('t-1', { siegeDExploitation: 'Gombe' });
        expect(findFirst).not.toHaveBeenCalled();
        expect(tenantFind).not.toHaveBeenCalled();
        expect(v.conformiteAuModeleCertifiee).toBe(false);
        expect(v.mentions).toHaveLength(33);
        expect(v.arreteDuModele.lu).toBe(true);
        expect(v.formules.brut.composantes).toEqual([7, 10, 11, 12, 13, 16, 19]);
        expect(v.destinationDesDoubles.second).toMatch(/CNSS/);
        expect(v.texteSecondDouble).toMatch(/Institut National de Sécurité Sociale/);
        expect(v.arrete1422018.mentions).toHaveLength(33);
    });
});
describe("P7 · le service guette la BONNE nature pour le cumul de l'article 138", () => {
    it("signale le cumul quand une INDEMNITÉ de logement est à la paie", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                {
                    nature: 'LOGEMENT_OU_SON_INDEMNITE',
                    libelle: 'Indemnité de logement',
                    montantFc: 200_000,
                    conditionArticle69Attestee: true,
                },
            ],
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        expect(res.quotite.reserves.some((r) => r.includes('Lukoo Musubao'))).toBe(true);
    });
    it("passe F5 · ne le signale PAS pour un logement FOURNI en nature, qui n'est pas une indemnité", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                {
                    nature: 'LOGEMENT_OU_SON_INDEMNITE',
                    libelle: 'Maison de fonction',
                    montantFc: 200_000,
                    conditionArticle69Attestee: true,
                    enNature: true,
                },
            ],
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        expect(res.quotite.reserves.some((r) => r.includes('Lukoo Musubao'))).toBe(false);
    });
    it("ne le signale PAS pour une autre nature d'élément", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                {
                    nature: 'SOINS_DE_SANTE',
                    libelle: 'Soins',
                    montantFc: 200_000,
                    conditionArticle69Attestee: true,
                },
            ],
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        expect(res.quotite.reserves.some((r) => r.includes('Lukoo Musubao'))).toBe(false);
    });
    it("ne le signale pas non plus sur une indemnité de logement à ZÉRO", async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 0 },
            ],
            classeProfessionnelle: 5,
            logementFourniEnNature: true,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
        }));
        expect(res.quotite.reserves.some((r) => r.includes('Lukoo Musubao'))).toBe(false);
    });
});
describe('F104 · la simulation passe à la quotité les retenues qu’elle n’a pas chiffrées', () => {
    it('un IRPP en abstention abstient la quotité, au lieu de la gonfler', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            classeProfessionnelle: 5,
            natureEmployeurInpp: 'PRIVE',
            effectif: 10,
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
                { nature: 'INDEMNITE_DE_TRANSPORT', libelle: 'Transport', montantFc: 90_000 },
            ],
        }));
        expect(res.retenue).toBeNull();
        expect(res.quotite.quotiteOrdinaireFc).toBeNull();
        expect(res.quotite.abstentions.map((a) => a.motif)).toContain('IMPOT_NON_CHIFFRE');
    });
    it('une paie antérieure à tout barème CNSS abstient la quotité sur la quote-part', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({ moisDePaie: '2018-06', classeProfessionnelle: 5, natureEmployeurInpp: 'PRIVE', effectif: 10 }));
        expect(res.quotite.abstentions.map((a) => a.motif)).toContain('COTISATION_NON_CHIFFREE');
    });
});
describe('F105 · le régime salarial est lu, et son absence est dite', () => {
    it('un forfait déclaré abstient la retenue du barème', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({ regimeSalarial: 'FORFAIT_PERSONNEL_DOMESTIQUE' }));
        expect(res.retenue).toBeNull();
        expect(res.regimeSalarial.calculable).toBe(false);
        expect(res.regimeSalarial.declare).toBe(true);
        expect(res.regimeSalarial.regime).toBe('FORFAIT_PERSONNEL_DOMESTIQUE');
    });
    it('un régime non déclaré garde le barème de droit commun et le dit', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto());
        expect(res.retenue).not.toBeNull();
        expect(res.regimeSalarial.declare).toBe(false);
        expect(res.regimeSalarial.calculable).toBe(true);
        expect(res.regimeSalarial.motif).toContain('RÉGIME NON DÉCLARÉ');
    });
    it('le barème déclaré se dit déclaré, sans réserve de régime', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({ regimeSalarial: 'BAREME_ARTICLE_118' }));
        expect(res.retenue).not.toBeNull();
        expect(res.regimeSalarial.declare).toBe(true);
        expect(res.regimeSalarial.motif ?? '').not.toContain('RÉGIME NON DÉCLARÉ');
    });
});
describe('F112 · la simulation passe les jours payés au plancher de la CNSS', () => {
    it('un mois incomplet de dix jours cotise sur 215 000 FC', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, dto({
            joursPayes: 10,
            elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 100_000 }],
        }));
        const qp = res.cotisations.lignes.find((l) => l.cle === 'cnss-pension-travailleur');
        expect(qp?.assietteFc).toBe(215_000);
    });
});
describe('C1 · la simulation ne chiffre ni base nette, ni impôt, ni net sous abstention de la CNSS', () => {
    const p07b = () => dto({
        natureEmployeurInpp: 'PRIVE',
        effectif: 30,
        elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 400_000 }],
    });
    it('rend null la base nette, la retenue, la quote-part et le net, et dit pourquoi', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, p07b());
        expect(res.cotisations.quotePartOuvriereNonChiffree).toContain('ASSIETTE SOUS LE PLANCHER');
        expect(res.assiettes.assietteFiscaleBruteFc).toBe(400_000);
        expect(res.assiettes.assietteFiscaleNetteFc).toBeNull();
        expect(res.assiettes.motifAssietteNetteNonChiffree).toContain('art. 70 et 71');
        expect(res.retenue).toBeNull();
        expect(res.net.quotePartOuvriereFc).toBeNull();
        expect(res.net.netAPayerFc).toBeNull();
        expect(res.cotisations.lignes.map((l) => l.cle).sort()).toEqual(['inpp', 'onem']);
    });
    it('les jours payés déclarés lèvent l’abstention et chiffrent tout', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, { ...p07b(), joursPayes: 26 });
        expect(res.cotisations.quotePartOuvriereNonChiffree).toBeNull();
        expect(res.assiettes.assietteFiscaleNetteFc).toBe(372_050);
        expect(res.retenue?.retenueFc).toBe(36_400);
        expect(res.net.netAPayerFc).toBe(335_650);
    });
    it('un apprenti ne doit aucune quote-part · une RÉPONSE, jamais une abstention', async () => {
        const { svc } = service({
            nom: 'A',
            nomConjoint: null,
            _count: { enfants: 0 },
            contrats: [{ id: 'c', type: 'APPRENTISSAGE', dateEntreeEnVigueur: new Date('2026-01-01'), dateFin: null }],
        });
        const res = await svc.simulerPaie('t-1', 's-1', dto());
        expect(res.cotisations.quotePartOuvriereNonChiffree).toBeNull();
        expect(res.net.quotePartOuvriereFc).toBe(0);
        expect(res.net.netAPayerFc).not.toBeNull();
    });
});
describe('Second tour, BLOQUANT · le millier de l’art. 118 se prend sur la valeur exacte', () => {
    const cinqLignes = [51_905.39, 53_651.71, 168_138.49, 68_332.09, 537_972.32];
    const enLignes = (montants) => montants.map((montantFc, i) => ({
        nature: i === 0 ? 'SALAIRE_OU_TRAITEMENT' : 'PRIME',
        libelle: `Ligne ${i + 1}`,
        montantFc,
    }));
    const mars2026 = (montants, over = {}) => dto({
        moisDePaie: '2026-03',
        natureEmployeurInpp: 'PRIVE',
        effectif: 30,
        personnesACharge: 0,
        elements: enLignes(montants),
        ...over,
    });
    it('témoin · la somme flottante des cinq lignes tombe sous 880 000, celle de leurs centimes non', () => {
        expect(cinqLignes.reduce((a, b) => a + b, 0)).toBeLessThan(880_000);
        expect(cinqLignes.reduce((a, b) => a + Math.round(b * 100), 0)).toBe(88_000_000);
    });
    it('cinq lignes de 880 000 FC retiennent 106 000 FC, comme une seule ligne de 880 000', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, mars2026(cinqLignes));
        expect(res.assiettes.assietteSocialeFc).toBe(880_000);
        expect(res.cotisations.totalTravailleurFc).toBe(44_000);
        expect(res.assiettes.assietteFiscaleNetteFc).toBe(836_000);
        expect(res.retenue?.revenuAnnualiseFc).toBe(10_032_000);
        expect(res.retenue?.annuel.assietteArrondieFc).toBe(10_032_000);
        expect(res.retenue?.retenueFc).toBe(106_000);
        const uneLigne = await service().svc.simulerPaie('t-1', null, mars2026([880_000]));
        expect(uneLigne.retenue?.retenueFc).toBe(106_000);
    });
    it('un revenu à 999,9964 FC sous le millier n’est pas remonté au millier · aucun arrondi au centime d’abord', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, mars2026([880_000], { retenuesArticle71Fc: 0.0003 }));
        expect(res.retenue?.annuel.assietteArrondieFc).toBe(10_031_000);
        expect(res.retenue?.retenueFc).toBe(105_900);
    });
    it('le verdict figé reste du JSON · aucune valeur exacte n’en sort', async () => {
        const { svc } = service();
        const res = await svc.simulerPaie('t-1', null, mars2026(cinqLignes));
        expect(() => JSON.stringify(res)).not.toThrow();
    });
});
describe('Second tour, jumeau m1 · le net négatif se juge en centimes sur la valeur exacte', () => {
    const avance = (montantFc) => ({
        avanceId: 'av-1',
        type: 'AVANCE',
        categoriePret: null,
        littera: 'c',
        libelle: "Avance sur salaire",
        montantFc,
        soldeAvantFc: 2_000_000,
    });
    const avecRetenue = (montantFc) => {
        const { svc } = service();
        jest
            .spyOn(svc, 'resoudreSaisie')
            .mockImplementation(async (_t, _s, d) => ({ dto: d, retenuesAvances: [avance(montantFc)] }));
        return svc;
    };
    const prive = (montants) => dto({
        moisDePaie: '2026-03',
        natureEmployeurInpp: 'PRIVE',
        effectif: 30,
        personnesACharge: 0,
        elements: montants.map((montantFc, i) => ({
            nature: i === 0 ? 'SALAIRE_OU_TRAITEMENT' : 'PRIME',
            libelle: `Ligne ${i + 1}`,
            montantFc,
        })),
    });
    const cinqLignes = [51_905.39, 53_651.71, 168_138.49, 68_332.09, 537_972.32];
    it('une retenue égale au net affiché de cinq lignes (730 000,00) passe, et le net vaut zéro', async () => {
        const res = await avecRetenue(730_000).simulerPaie('t-1', null, prive(cinqLignes));
        expect(res.net.netAPayerFc).toBe(0);
        const sans = await service().svc.simulerPaie('t-1', null, prive(cinqLignes));
        expect(sans.net.netAPayerFc).toBe(730_000);
    });
    it('un centime de plus est refusé, avec son issue', async () => {
        await expect(avecRetenue(730_000.01).simulerPaie('t-1', null, prive(cinqLignes))).rejects.toThrow(/dépassent ce qui reste dû au travailleur ce mois-ci · réduisez-les/);
    });
    it('un net exact de -0,005 FC, que la colonne figerait à -0,01, est refusé ; +0,005 passe', async () => {
        const sans = await service().svc.simulerPaie('t-1', null, prive([600_000.1]));
        expect(sans.cotisations.totalTravailleurFc).toBe(30_000.005);
        expect(sans.retenue?.retenueFc).toBe(66_100);
        expect(sans.net.netAPayerFc).toBe(503_900.095);
        await expect(avecRetenue(503_900.1).simulerPaie('t-1', null, prive([600_000.1]))).rejects.toThrow(/réduisez-les/);
        const passe = await avecRetenue(503_900.09).simulerPaie('t-1', null, prive([600_000.1]));
        expect(passe.net.netAPayerFc).toBeCloseTo(0.005, 9);
    });
});
//# sourceMappingURL=simulation-paie.spec.js.map