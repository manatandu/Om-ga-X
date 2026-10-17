"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const personnel_service_1 = require("./personnel.service");
const comptabilisation_paie_1 = require("./comptabilisation-paie");
const personnel_dto_1 = require("./dto/personnel.dto");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
const CONTRAT = {
    id: 'c-1',
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: d('2023-01-01'),
    dateFin: d('2026-05-31'),
    natureTravail: 'Comptable',
    categorieProfessionnelle: 'Maîtrise',
    remunerationBase: new client_1.Prisma.Decimal(260_000),
    periodiciteRemuneration: 'MOIS',
    deviseRemuneration: 'CDF',
};
const SALARIE = {
    id: 's-1',
    nom: 'Mukendi',
    postNom: 'Kabasele',
    prenoms: 'Élodie',
    matricule: 'M-014',
    numeroAffiliationCnss: 'CNSS-77',
    nomConjoint: null,
    _count: { enfants: 0 },
    contrats: [CONTRAT],
};
function service(opts = {}) {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'b-1', ...data }));
    const avances = opts.avances ?? [];
    const correspond = (a, where) => (where.tenantId === undefined || a.tenantId === where.tenantId) &&
        (where.salarieId === undefined || a.salarieId === where.salarieId) &&
        (where.id === undefined ||
            (typeof where.id === 'string' ? a.id === where.id : (where.id.in ?? []).includes(a.id)));
    const retenuesCreees = [];
    const bulletinFindFirst = jest.fn().mockImplementation(({ where }) => {
        if (where.statut)
            return Promise.resolve(opts.actif ?? null);
        const data = create.mock.calls.at(-1)?.[0].data ?? {};
        return Promise.resolve({ id: where.id, ...data });
    });
    const prisma = {
        salarie: { findFirst: jest.fn().mockResolvedValue(opts.salarie === undefined ? SALARIE : opts.salarie) },
        congeSalarie: { findMany: jest.fn().mockResolvedValue([]) },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYCEBNL' }) },
        versionBaremePaie: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        bulletinPaie: { findFirst: bulletinFindFirst, aggregate: jest.fn().mockResolvedValue({ _max: { numero: 41 } }), create, update: jest.fn() },
        avanceSalaire: {
            findMany: jest.fn().mockImplementation(({ where, take }) => {
                const l = avances.filter((a) => correspond(a, where));
                return Promise.resolve(typeof take === 'number' ? l.slice(0, take) : l);
            }),
            findFirstOrThrow: jest.fn().mockImplementation(({ where }) => {
                const a = avances.find((x) => correspond(x, where));
                return a ? Promise.resolve(a) : Promise.reject(new Error('introuvable'));
            }),
        },
        retenueAvanceBulletin: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve((avances.find((a) => a.id === where.avanceId && a.tenantId === where.tenantId)?.retenues ?? []).map((r) => ({ ...r })))),
            create: jest.fn().mockImplementation(({ data }) => {
                retenuesCreees.push({ avanceId: data.avanceId, montantFc: data.montantFc });
                return Promise.resolve(data);
            }),
        },
    };
    prisma.$executeRaw = jest.fn().mockResolvedValue(0);
    prisma.$transaction = (fn) => fn(prisma);
    return { svc: new personnel_service_1.PersonnelService(prisma), create, prisma, retenuesCreees };
}
const FAITS = {
    anneesAnciennete: 3,
    moisNonCouvertsParUnConge: 6,
    initiative: 'EMPLOYEUR',
    motif: 'LICENCIEMENT',
    typeContrat: 'DUREE_INDETERMINEE',
    executionPreavis: 'DISPENSE_PAR_EMPLOYEUR',
    dateNotification: '2026-05-18',
    remunerationJournaliereFc: 10_000,
    moyenneMensuelleArticle66Fc: 0,
    moyenneMensuelleArticle142Fc: 0,
    avantagesPendantPreavisFc: 0,
    gratificationFc: 0,
    enfantsBeneficiairesAllocations: 0,
};
const PAIE = (over = {}) => ({
    moisDePaie: '2026-05',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de mai', montantFc: 260_000 }],
    natureEmployeurInpp: 'PRIVE',
    effectif: 12,
    ...over,
});
const emission = (faits = {}, paie = {}) => ({
    decompte: { ...FAITS, ...faits },
    paie: PAIE(paie),
});
describe('A8 · émettre le décompte final · rejoué, figé, numéroté avec les bulletins', () => {
    it('fige un double du livre de paie de nature DECOMPTE_FINAL, salaire du mois et indemnités ensemble', async () => {
        const { svc, create } = service();
        const relu = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission());
        const data = create.mock.calls[0][0].data;
        expect(data.nature).toBe('DECOMPTE_FINAL');
        expect(data.numero).toBe(42);
        expect(data.moisDePaie).toBe('2026-05');
        expect(data.totalVerseFc).toBe(260_000 + 350_000 + 60_000);
        const natures = data.entree.elements.map((e) => [e.nature, e.montantFc]);
        expect(natures).toEqual([
            ['SALAIRE_OU_TRAITEMENT', 260_000],
            ['INDEMNITE_DE_FIN_DE_CONTRAT', 350_000],
            ['ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', 60_000],
        ]);
        expect(data.calcul.decompte.totalDuAuTravailleurFc).toBe(670_000);
        expect(data.entree.decompte.arrieresFc).toBe(260_000);
        expect(data.irppFc).toBeGreaterThan(0);
        expect(data.cotisationsTravailleurFc).toBeGreaterThan(0);
        expect(data.netAPayerFc).toBeCloseTo(670_000 - data.cotisationsTravailleurFc - data.irppFc, 2);
        expect(relu.reserves.join(' ')).toContain('BARÈME DU MOIS');
    });
    it('se passe au journal par la paie du mois · D 6614 / C 422, le 422 soldé au net', async () => {
        const { svc, create } = service();
        await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission());
        const data = create.mock.calls[0][0].data;
        const b = {
            id: 'b-1',
            numero: data.numero,
            nomComplet: data.nomComplet,
            statut: 'EMIS',
            ecritureId: null,
            netAPayerFc: data.netAPayerFc,
            entree: data.entree,
            calcul: data.calcul,
        };
        const p = (0, comptabilisation_paie_1.propositionPaieDuMois)('2026-05', 'SYCEBNL', [b]);
        expect(p.refus).toEqual([]);
        expect(p.lignes.find((l) => l.compte === '66140000')).toEqual(expect.objectContaining({ sens: 'DEBIT', montantFc: 350_000 }));
        expect(p.lignes.find((l) => l.compte === '66130000')).toEqual(expect.objectContaining({ sens: 'DEBIT', montantFc: 60_000 }));
        expect(p.lignes.find((l) => l.bloc === 'BRUT' && l.compte === '42200000')).toEqual(expect.objectContaining({ sens: 'CREDIT', montantFc: 670_000 }));
        expect(p.equilibree).toBe(true);
        expect(p.solde422Fc).toBeCloseTo(data.netAPayerFc, 2);
    });
    it('COEXISTENCE · un bulletin actif du mois refuse le décompte, sans rien créer', async () => {
        const { svc, create } = service({ actif: { numero: 7, nature: 'MOIS' } });
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission())).rejects.toThrow(/Le bulletin n° 7.*remplace le bulletin du mois de cessation/);
        expect(create).not.toHaveBeenCalled();
    });
    it('COEXISTENCE · un décompte actif du mois refuse le bulletin, et inversement', async () => {
        const { svc, create } = service({ actif: { numero: 9, nature: 'DECOMPTE_FINAL' } });
        const bulletin = PAIE({ elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 }] });
        await expect(svc.emettreBulletin('t-1', 'u-1', 's-1', bulletin)).rejects.toThrow(/Le décompte final n° 9.*remplace/);
        expect(create).not.toHaveBeenCalled();
    });
    it('REFUSE un solde partiel, rubriques nommées', async () => {
        const { svc, create } = service();
        const e = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ executionPreavis: undefined })).catch((x) => x);
        expect(e).toBeInstanceOf(common_1.BadRequestException);
        expect(JSON.stringify(e.getResponse())).toContain('préavis non chiffrée');
        expect(create).not.toHaveBeenCalled();
    });
    it("refuse un contrat que le registre ne dit pas terminé dans le mois", async () => {
        const { svc, create } = service({ salarie: { ...SALARIE, contrats: [{ ...CONTRAT, dateFin: null }] } });
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission())).rejects.toThrow(/pas terminé/);
        expect(create).not.toHaveBeenCalled();
    });
    it('refuse le type de contrat que le registre contredit', async () => {
        const { svc } = service();
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ typeContrat: 'DUREE_DETERMINEE' }))).rejects.toThrow(/contredit/);
    });
    it('refuse une stipulation en dollars · le décompte se chiffre en francs', async () => {
        const { svc } = service();
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({}, { deviseStipulation: 'USD' }))).rejects.toThrow(/francs congolais/);
    });
    it('refuse des arriérés déclarés qui contredisent les éléments du mois, et un mois sans éléments sans zéro déclaré', async () => {
        const { svc } = service();
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ arrieresFc: 100_000 }))).rejects.toThrow(/diffèrent/);
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({}, { elements: [] }))).rejects.toThrow(/zéro arriéré/);
    });
    it("refuse un mois de cessation qui n'est pas le mois de paie", async () => {
        const { svc } = service();
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ moisDeCessation: '2026-04' }))).rejects.toThrow(/diffèrent/);
    });
    it("n'impose pas les allocations familiales du décompte · elles sont leur propre taux légal (art. 69, 1)", async () => {
        const sans = service();
        await sans.svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission());
        const avec = service();
        await avec.svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ enfantsBeneficiairesAllocations: 2, joursAllocationsFamiliales: 10 }));
        const a = sans.create.mock.calls[0][0].data;
        const b = avec.create.mock.calls[0][0].data;
        expect(b.totalVerseFc).toBeGreaterThan(a.totalVerseFc);
        expect(b.irppFc).toBe(a.irppFc);
        expect(b.assietteSocialeFc).toBe(a.assietteSocialeFc);
    });
    it("(h) prend le verrou du dossier EN TÊTE de la transaction, avant de lire l'actif du mois", async () => {
        const { svc, prisma } = service();
        await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission());
        const verrou = prisma.$executeRaw;
        expect(verrou).toHaveBeenCalledTimes(1);
        const gabarit = verrou.mock.calls[0][0].join('?');
        expect(gabarit).toContain('pg_advisory_xact_lock(hashtext(');
        expect(verrou.mock.calls[0][1]).toBe('bulletins-paie:t-1');
        const findFirst = prisma.bulletinPaie.findFirst;
        const lectureActif = findFirst.mock.calls.findIndex((c) => c[0].where.statut !== undefined);
        expect(lectureActif).toBeGreaterThanOrEqual(0);
        expect(verrou.mock.invocationCallOrder[0]).toBeLessThan(findFirst.mock.invocationCallOrder[lectureActif]);
    });
    it('(g) les motifs du refus arrivent DANS le message, que l’écran lit', async () => {
        const { svc } = service();
        const e = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ executionPreavis: undefined })).catch((x) => x);
        const reponse = e.getResponse();
        expect(reponse.message).toContain('préavis non chiffrée');
        expect(reponse.motifs.length).toBeGreaterThan(0);
    });
    it('(l) une gratification non déclarée refuse avec un motif qui dit quoi faire', async () => {
        const { svc, create } = service();
        const e = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ gratificationFc: undefined })).catch((x) => x);
        expect(e.getResponse().message).toContain('Déclarez la gratification, zéro compris.');
        expect(create).not.toHaveBeenCalled();
    });
    it('(j) un élément du mois NÉGATIF est refusé, jamais ramené à zéro', async () => {
        const { svc, create } = service();
        const e = await svc
            .emettreDecompteFinal('t-1', 'u-1', 's-1', emission({}, { elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: -5 }] }))
            .catch((x) => x);
        expect(e).toBeInstanceOf(common_1.BadRequestException);
        expect(e.getResponse().message).toContain('négatif');
        expect(create).not.toHaveBeenCalled();
    });
    it("(j) un taux légal d'allocations DÉCLARÉ n'est pas écrasé en silence · refusé quand le décompte calcule les allocations", async () => {
        const { svc, create } = service();
        const e = await svc
            .emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ enfantsBeneficiairesAllocations: 2, joursAllocationsFamiliales: 10 }, { tauxLegalAllocationsFamilialesFc: 1_000 }))
            .catch((x) => x);
        expect(e.getResponse().message).toContain('taux légal des allocations familiales est déclaré');
        expect(create).not.toHaveBeenCalled();
    });
    it('(m) une nature payée par le mois ET par le décompte est refusée · le congé ne se verse pas deux fois', async () => {
        const { svc, create } = service();
        const paie = {
            elements: [
                { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de mai', montantFc: 260_000 },
                { nature: 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE', libelle: 'Congé', montantFc: 10_000 },
            ],
        };
        const e = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({}, paie)).catch((x) => x);
        expect(e.getResponse().message).toContain('versée deux fois');
        expect(create).not.toHaveBeenCalled();
    });
    it("(n) des allocations familiales au décompte AVERTISSENT qu'il ne passera pas au journal, sans rien imputer", async () => {
        const { svc, create } = service();
        const relu = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ enfantsBeneficiairesAllocations: 2, joursAllocationsFamiliales: 10 }));
        expect(relu.avertissements.join(' ')).toContain('NE PASSERA PAS AU JOURNAL');
        const data = create.mock.calls[0][0].data;
        expect(data.calcul.avertissementsDecompteEmis.join(' ')).toContain('ALLOCATIONS_FAMILIALES_LEGALES');
        const b = {
            id: 'b-1',
            numero: data.numero,
            nomComplet: data.nomComplet,
            statut: 'EMIS',
            ecritureId: null,
            netAPayerFc: data.netAPayerFc,
            entree: data.entree,
            calcul: data.calcul,
        };
        const p = (0, comptabilisation_paie_1.propositionPaieDuMois)('2026-05', 'SYCEBNL', [b]);
        expect(p.refus.length).toBeGreaterThan(0);
        expect(p.lignes.some((l) => l.compte === '66160000')).toBe(false);
    });
    it("(n) sans allocations, aucun avertissement · la réponse le dit vide", async () => {
        const { svc } = service();
        const relu = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission());
        expect(relu.avertissements).toEqual([]);
    });
    it("(k) chaque rubrique est arrondie au centime avant d'être un élément", async () => {
        const { svc, create } = service();
        await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ remunerationJournaliereFc: 10_000.0003 }));
        const elements = create.mock.calls[0][0].data.entree.elements;
        for (const e of elements)
            expect(Math.round(e.montantFc * 100) / 100).toBe(e.montantFc);
        expect(elements.find((e) => e.nature === 'INDEMNITE_DE_FIN_DE_CONTRAT')?.montantFc).toBe(350_000.01);
    });
    it("ASSIETTE · des avantages compris dans le préavis et non ventilés refusent l'émission", async () => {
        const { svc, create } = service();
        const e = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ avantagesPendantPreavisFc: 35_000 })).catch((x) => x);
        expect(e.getResponse().message).toContain('ventilez-les');
        expect(create).not.toHaveBeenCalled();
    });
    it("ASSIETTE · ventilés en logement, les avantages sortent de l'assiette sociale sous leur nature", async () => {
        const base = service();
        await base.svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission());
        const ventile = service();
        await ventile.svc.emettreDecompteFinal('t-1', 'u-1', 's-1', {
            ...emission({ avantagesPendantPreavisFc: 35_000 }),
            ventilationAvantages: [{ rubrique: 'preavis', nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement pendant le préavis', montantFc: 35_000 }],
        });
        const a = base.create.mock.calls[0][0].data;
        const b = ventile.create.mock.calls[0][0].data;
        const natures = b.entree.elements.map((x) => [x.nature, x.montantFc]);
        expect(natures).toContainEqual(['INDEMNITE_DE_FIN_DE_CONTRAT', 350_000]);
        expect(natures).toContainEqual(['LOGEMENT_OU_SON_INDEMNITE', 35_000]);
        expect(b.totalVerseFc).toBe(a.totalVerseFc + 35_000);
        expect(b.assietteSocialeFc).toBe(a.assietteSocialeFc);
        expect(b.calcul.reservesDecompteEmis.join(' ')).toContain('ASSIETTE SOCIALE · par le texte');
    });
});
describe('A8 (B2) · ancienneté et mois non couverts exigés à l’ÉMISSION, pas au calcul seul', () => {
    const corps = (decompte) => ({ decompte, paie: PAIE() });
    it("refuse l'émission sans ancienneté ni mois non couverts, par un motif nommé", async () => {
        const { anneesAnciennete, moisNonCouvertsParUnConge, ...reste } = FAITS;
        void anneesAnciennete;
        void moisNonCouvertsParUnConge;
        const erreurs = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(personnel_dto_1.EmissionDecompteFinalDto, corps(reste)));
        const messages = JSON.stringify(erreurs);
        expect(messages).toContain(personnel_dto_1.MOTIF_ANCIENNETE_EXIGEE);
        expect(messages).toContain(personnel_dto_1.MOTIF_MOIS_NON_COUVERTS_EXIGES);
    });
    it('admet le zéro déclaré', async () => {
        const erreurs = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(personnel_dto_1.EmissionDecompteFinalDto, corps({ ...FAITS, anneesAnciennete: 0, moisNonCouvertsParUnConge: 0 })));
        expect(JSON.stringify(erreurs)).not.toContain(personnel_dto_1.MOTIF_ANCIENNETE_EXIGEE);
    });
    it('le calcul seul ne porte pas le motif de l’émission', async () => {
        const { anneesAnciennete, ...reste } = FAITS;
        void anneesAnciennete;
        const erreurs = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(personnel_dto_1.DecompteFinalDto, reste));
        expect(JSON.stringify(erreurs)).not.toContain(personnel_dto_1.MOTIF_ANCIENNETE_EXIGEE);
    });
});
describe('A18 · décompte final · avances et prêts proposés, gratification stipulée, indemnité stipulée', () => {
    const avance = (over) => ({
        id: 'av-1',
        tenantId: 't-1',
        salarieId: 's-1',
        type: 'AVANCE',
        categoriePret: null,
        dateOctroi: d('2026-02-10'),
        montantFc: new client_1.Prisma.Decimal(300_000),
        objet: 'Avance sur salaire',
        referenceActe: null,
        dateFin: null,
        retenues: [],
        ...over,
    });
    const AVANCES = [
        avance({}),
        avance({
            id: 'pr-1',
            type: 'PRET',
            categoriePret: 'AUTRE',
            dateOctroi: d('2025-11-01'),
            montantFc: new client_1.Prisma.Decimal(400_000),
            objet: 'Prêt personnel',
            retenues: [
                { montantFc: new client_1.Prisma.Decimal(150_000), bulletin: { statut: 'EMIS' } },
                { montantFc: new client_1.Prisma.Decimal(90_000), bulletin: { statut: 'ANNULE' } },
            ],
        }),
        avance({ id: 'av-autre', salarieId: 's-2', montantFc: new client_1.Prisma.Decimal(999_000) }),
        avance({ id: 'sa-1', type: 'SAISIE_ARRET', referenceActe: 'RS 12', montantFc: new client_1.Prisma.Decimal(80_000), objet: 'Créancier' }),
    ];
    it('propose les soldes relus au registre, avances puis prêts, sans la saisie ni le voisin', async () => {
        const { svc } = service({ avances: AVANCES });
        const p = await svc.proposerRetenuesDecompte('t-1', 's-1', emission());
        expect(p.retenues.map((r) => [r.avanceId, r.littera, r.soldeFc, r.montantProposeFc])).toEqual([
            ['av-1', 'c', 300_000, 300_000],
            ['pr-1', 'f', 250_000, 250_000],
        ]);
        expect(p.saisiesNonProposees.map((s) => s.avanceId)).toEqual(['sa-1']);
        expect(p.netDisponibleFc).toBeGreaterThan(550_000);
        expect(p.motifsNetNonChiffre).toEqual([]);
        expect(p.tronque).toBe(false);
    });
    it('borne la proposition au net du décompte · un net négatif ne se paie pas', async () => {
        const gros = [avance({ id: 'pr-gros', type: 'PRET', categoriePret: 'AUTRE', montantFc: new client_1.Prisma.Decimal(5_000_000) })];
        const { svc } = service({ avances: gros });
        const p = await svc.proposerRetenuesDecompte('t-1', 's-1', emission());
        const net = p.netDisponibleFc;
        expect(p.retenues[0].montantProposeFc).toBeCloseTo(net, 2);
        expect(p.resteNonRetenuFc).toBeCloseTo(5_000_000 - net, 2);
        expect(p.retenues[0].reserve).toContain('Ramenée');
    });
    it('un décompte non chiffré rend ses motifs, jamais un net nul · la proposition reste le solde', async () => {
        const { svc } = service({ avances: AVANCES });
        const p = await svc.proposerRetenuesDecompte('t-1', 's-1', emission({ gratificationFc: undefined }));
        expect(p.netDisponibleFc).toBeNull();
        expect(p.motifsNetNonChiffre.length).toBeGreaterThan(0);
        expect(p.retenues[0].montantProposeFc).toBe(300_000);
    });
    it('émet le décompte avec les retenues confirmées · net diminué, retenues inscrites, solde restant averti', async () => {
        const { svc: sans } = service({ avances: AVANCES });
        const { svc, create, retenuesCreees } = service({ avances: AVANCES });
        const p = await sans.proposerRetenuesDecompte('t-1', 's-1', emission());
        const relu = await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({}, { retenuesAvances: [{ avanceId: 'av-1', montantFc: 300_000 }, { avanceId: 'pr-1', montantFc: 100_000 }] }));
        const data = create.mock.calls[0][0].data;
        expect(data.netAPayerFc).toBeCloseTo(p.netDisponibleFc - 400_000, 2);
        expect(retenuesCreees).toEqual([
            { avanceId: 'av-1', montantFc: 300_000 },
            { avanceId: 'pr-1', montantFc: 100_000 },
        ]);
        expect(relu.avertissements.some((a) => a.includes('150000.00 FC restent dus'))).toBe(true);
        expect(data.calcul.reservesDecompteEmis.join(' ')).toContain("l'article 112, f) autorise");
    });
    it('refuse une retenue au-delà du solde · le trop-retenu est une réduction de rémunération (art. 112)', async () => {
        const { svc, create } = service({ avances: AVANCES });
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({}, { retenuesAvances: [{ avanceId: 'pr-1', montantFc: 260_000 }] }))).rejects.toThrow(/dépasse le solde restant dû \(250000\.00 FC\)/);
        expect(create).not.toHaveBeenCalled();
    });
    it('refuse une période de gratification qui dépasse la fin du contrat', async () => {
        const { svc } = service();
        await expect(svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({ gratificationStipulee: { montantAnnuelFc: 1_200_000, source: 'Contrat', debutPeriode: '2026-01-01', finPeriode: '2026-06-30' } }))).rejects.toThrow(/après la fin du contrat \(2026-05-31\)/);
    });
    it("émet la gratification confirmée et l'indemnité stipulée · 6612 et 6614 à la passation", async () => {
        const { svc, create } = service();
        await svc.emettreDecompteFinal('t-1', 'u-1', 's-1', emission({
            gratificationStipulee: { montantAnnuelFc: 1_200_000, source: 'Contrat, art. 6', debutPeriode: '2026-01-01', finPeriode: '2026-05-31' },
            gratificationFc: 500_000,
            indemniteStipulee: { montantFc: 400_000, source: 'Convention collective, art. 40' },
        }));
        const data = create.mock.calls[0][0].data;
        expect(data.calcul.decompte.propositionGratification).toEqual(expect.objectContaining({ montantFc: 500_000, moisEntiers: 5 }));
        const b = {
            id: 'b-1',
            numero: data.numero,
            nomComplet: data.nomComplet,
            statut: 'EMIS',
            ecritureId: null,
            netAPayerFc: data.netAPayerFc,
            entree: data.entree,
            calcul: data.calcul,
        };
        const prop = (0, comptabilisation_paie_1.propositionPaieDuMois)('2026-05', 'SYCEBNL', [b]);
        expect(prop.refus).toEqual([]);
        expect(prop.lignes.find((l) => l.compte === '66140000')).toEqual(expect.objectContaining({ sens: 'DEBIT', montantFc: 750_000 }));
        expect(prop.lignes.find((l) => l.compte === '66120000')).toEqual(expect.objectContaining({ sens: 'DEBIT', montantFc: 500_000 }));
    });
});
//# sourceMappingURL=decompte-final-emis-service.spec.js.map