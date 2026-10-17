"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const inventaire_service_1 = require("./inventaire.service");
const EXERCICE = {
    id: 'ex1',
    tenantId: 't1',
    dateDebut: new Date('2026-01-01'),
    dateFin: new Date('2026-12-31'),
    statut: 'OUVERT',
};
function service(etat = {}) {
    const maj = jest.fn().mockImplementation((a) => Promise.resolve({ ...(etat.campagne ?? {}), ...a.data }));
    const creerEcart = jest.fn().mockImplementation((a) => Promise.resolve(a.data));
    const majEcart = jest.fn().mockImplementation((a) => Promise.resolve({ ...a.data, id: a.where.id }));
    const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue(etat.exercice ?? EXERCICE) },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYCEBNL }) },
        compte: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', numero: '31100000', typeCompte: 'DETAIL' }) },
        campagneInventaire: {
            findFirst: jest.fn().mockImplementation((a) => Promise.resolve(etat.campagne && a?.include?.pvComptageCaisse
                ? { ...etat.campagne, exercice: { dateFin: EXERCICE.dateFin }, pvComptageCaisse: [] }
                : (etat.campagne ?? null))),
            create: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'camp1', ...a.data })),
            update: maj,
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        ficheInventaire: {
            findMany: jest.fn().mockResolvedValue(etat.fiches ?? []),
            findFirst: jest.fn().mockResolvedValue(null),
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        ecartInventaire: {
            findFirst: jest.fn().mockResolvedValue(etat.ecarts?.[0] ?? null),
            findMany: jest.fn().mockResolvedValue(etat.ecarts ?? []),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: creerEcart,
            update: majEcart,
            count: jest.fn().mockResolvedValue((etat.ecarts ?? []).filter((e) => !e.decision).length),
        },
        membreSousCommission: { findMany: jest.fn().mockResolvedValue(etat.membres ?? []) },
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue(etat.lignesCaisse ?? []),
            count: jest.fn().mockResolvedValue(etat.lignesAuBrouillard ?? 0),
        },
        procesVerbalComptageCaisse: {
            findMany: jest.fn().mockResolvedValue(etat.pvCaisse ?? []),
            create: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'pv1', ...a.data })),
        },
        sousCommissionInventaire: { findFirst: jest.fn().mockResolvedValue(etat.sousCommission ?? null) },
        $queryRaw: jest.fn().mockResolvedValue([]),
        $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
    };
    const ecritures = {
        balance: jest.fn().mockResolvedValue({ lignes: etat.balance ?? [], totaux: { debit: 0, credit: 0 } }),
    };
    return { svc: new inventaire_service_1.InventaireService(prisma, ecritures), prisma, creerEcart, maj, majEcart };
}
const campagne = (statut) => ({
    id: 'camp1',
    tenantId: 't1',
    exerciceId: 'ex1',
    statut,
});
const fiche = (compteId, valeur) => ({
    id: `f-${compteId}-${valeur}`,
    tenantId: 't1',
    campagneId: 'camp1',
    compteId,
    valeurInventaire: valeur,
    compte: { numero: '31100000', intitule: 'Marchandises' },
});
describe('la sanction citée est celle du référentiel du dossier', () => {
    it('SYSCOHADA · AUDCIF art. 111', () => {
        const s = inventaire_service_1.InventaireService.sanctionApplicable(client_1.Referentiel.SYSCOHADA);
        expect(s.texte).toBe('AUDCIF');
        expect(s.article).toContain('art. 111');
    });
    it('SYCEBNL · art. 24, parce que l’art. 3 écarte les articles 73 à 113', () => {
        const s = inventaire_service_1.InventaireService.sanctionApplicable(client_1.Referentiel.SYCEBNL);
        expect(s.texte).toBe('Acte uniforme SYCEBNL');
        expect(s.article).toContain('art. 24');
    });
    it('aucun des deux ne cite l’article de l’autre', () => {
        const sys = inventaire_service_1.InventaireService.sanctionApplicable(client_1.Referentiel.SYSCOHADA);
        const ebnl = inventaire_service_1.InventaireService.sanctionApplicable(client_1.Referentiel.SYCEBNL);
        expect(sys.article).not.toContain('art. 24');
        expect(ebnl.article).not.toContain('art. 111');
        expect(ebnl.texte).not.toBe(sys.texte);
    });
});
describe('rapprochement · étape 4, la comparaison avec la balance provisoire', () => {
    it('agrège les fiches PAR COMPTE, pas fiche à fiche', async () => {
        const { svc, creerEcart } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            fiches: [fiche('c1', 400), fiche('c1', 350), fiche('c2', 100)],
            balance: [
                { compteId: 'c1', solde: 800 },
                { compteId: 'c2', solde: 100 },
            ],
            ecarts: [],
        });
        await svc.rapprocher('t1', 'camp1');
        const ecrits = creerEcart.mock.calls.map((c) => c[0].data);
        expect(ecrits).toHaveLength(2);
        const c1 = ecrits.find((e) => e.compteId === 'c1');
        expect(c1).toMatchObject({ valeurInventaire: 750, soldeComptable: 800, ecart: -50, nombreFiches: 2 });
        expect(ecrits.find((e) => e.compteId === 'c2')).toMatchObject({ ecart: 0, nombreFiches: 1 });
    });
    it('REFUSE de rapprocher tant qu’une fiche n’est pas valorisée', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            fiches: [fiche('c1', 400), fiche('c1', null)],
            balance: [{ compteId: 'c1', solde: 400 }],
        });
        await expect(svc.rapprocher('t1', 'camp1')).rejects.toThrow(/sans valeur d'inventaire/);
    });
    it('prend la balance du LIVRE-JOURNAL · un solde figé ne se prend pas sur du provisoire (F6)', async () => {
        const ecritures = {
            balance: jest.fn().mockResolvedValue({ lignes: [{ compteId: 'c1', solde: 100 }], totaux: { debit: 0, credit: 0 } }),
        };
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            fiches: [fiche('c1', 100)],
            balance: [{ compteId: 'c1', solde: 100 }],
        });
        Object.assign(svc, { ecritures });
        await svc.rapprocher('t1', 'camp1');
        expect(ecritures.balance.mock.calls[0]).toEqual(['t1', 'ex1', false]);
    });
    it('REFUSE de rapprocher tant qu’une ligne des comptes inventoriés est au brouillard', async () => {
        const { svc, creerEcart } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            fiches: [fiche('c1', 100)],
            balance: [{ compteId: 'c1', solde: 100 }],
            lignesAuBrouillard: 2,
        });
        await expect(svc.rapprocher('t1', 'camp1')).rejects.toThrow(/2 ligne\(s\) au brouillard/);
        expect(creerEcart).not.toHaveBeenCalled();
    });
    it('le décompte du brouillard est borné aux comptes inventoriés et à l’exercice de la campagne', async () => {
        const { svc, prisma } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            fiches: [fiche('c1', 100), fiche('c2', 50), fiche('c1', 10)],
            balance: [{ compteId: 'c1', solde: 110 }, { compteId: 'c2', solde: 50 }],
        });
        await svc.rapprocher('t1', 'camp1');
        const where = prisma.ligneEcriture.count.mock.calls[0][0].where;
        expect(where).toEqual({
            compteId: { in: ['c1', 'c2'] },
            ecriture: { tenantId: 't1', exerciceId: 'ex1', statut: 'BROUILLARD' },
        });
    });
    it('compare à la VALEUR ABSOLUE du solde · un compte de passif est créditeur', async () => {
        const { svc, creerEcart } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            fiches: [fiche('c1', 500)],
            balance: [{ compteId: 'c1', solde: -500 }],
        });
        await svc.rapprocher('t1', 'camp1');
        expect(creerEcart.mock.calls[0][0].data.ecart).toBe(0);
    });
    it('ne rapproche plus une campagne déjà en arbitrage · le solde est figé', async () => {
        const { svc } = service({ campagne: campagne(client_1.StatutCampagneInventaire.ARBITRAGE) });
        await expect(svc.rapprocher('t1', 'camp1')).rejects.toThrow(/ARBITRAGE/);
    });
});
const ecartArbitrable = (montant) => ({
    id: 'e1',
    tenantId: 't1',
    ecart: montant,
    decision: null,
    campagne: campagne(client_1.StatutCampagneInventaire.ARBITRAGE),
    compte: { numero: '31100000', intitule: 'Marchandises' },
});
describe('arbitrage · l’asymétrie de l’AUDCIF art. 43', () => {
    it('REFUSE de redresser un excédent, et cite l’article', async () => {
        const { svc } = service({ ecarts: [ecartArbitrable(1200)] });
        await expect(svc.arbitrer('t1', 'e1', 'u1', { decision: client_1.DecisionEcartInventaire.A_REDRESSER, responsable: 'Magasinier' })).rejects.toThrow(/art\. 43/);
    });
    it('REFUSE de classer un manquant en excédent non comptabilisé', async () => {
        const { svc } = service({ ecarts: [ecartArbitrable(-800)] });
        await expect(svc.arbitrer('t1', 'e1', 'u1', {
            decision: client_1.DecisionEcartInventaire.EXCEDENT_NON_COMPTABILISE,
            explication: 'Rien à laisser au bilan',
        })).rejects.toThrow(/MANQUANT/);
    });
    it('exige le RESPONSABLE d’un écart négatif · CPCC étape 5', async () => {
        const { svc } = service({ ecarts: [ecartArbitrable(-800)] });
        await expect(svc.arbitrer('t1', 'e1', 'u1', { decision: client_1.DecisionEcartInventaire.A_REDRESSER })).rejects.toThrow(/responsable/);
    });
    it('exige l’EXPLICATION d’un écart non redressé · sinon il est effacé, pas arbitré', async () => {
        const { svc } = service({ ecarts: [ecartArbitrable(1200)] });
        await expect(svc.arbitrer('t1', 'e1', 'u1', { decision: client_1.DecisionEcartInventaire.EXCEDENT_NON_COMPTABILISE })).rejects.toThrow(/explication/);
    });
    it('accepte un manquant motivé et nomme son responsable', async () => {
        const { svc, majEcart } = service({ ecarts: [ecartArbitrable(-800)] });
        await svc.arbitrer('t1', 'e1', 'u1', {
            decision: client_1.DecisionEcartInventaire.A_REDRESSER,
            responsable: 'Magasinier central',
        });
        expect(majEcart.mock.calls[0][0].data).toMatchObject({
            decision: client_1.DecisionEcartInventaire.A_REDRESSER,
            responsable: 'Magasinier central',
            arbitrePar: 'u1',
        });
    });
});
describe('proposition de redressement · elle s’arrête où le texte s’arrête', () => {
    it('ne propose RIEN sur un excédent · art. 43', async () => {
        const { svc } = service({ ecarts: [{ ...ecartArbitrable(1200), decision: client_1.DecisionEcartInventaire.EXCEDENT_NON_COMPTABILISE }] });
        const p = await svc.propositionRedressement('t1', 'e1');
        expect(p.proposable).toBe(false);
        expect(p.motif).toContain('art. 43');
    });
    it('ne propose rien avant la décision de la sous-commission', async () => {
        const { svc } = service({ ecarts: [ecartArbitrable(-800)] });
        const p = await svc.propositionRedressement('t1', 'e1');
        expect(p.proposable).toBe(false);
    });
    it('propose un manquant arbitré, contrepartie LAISSÉE VIDE', async () => {
        const { svc } = service({
            ecarts: [{ ...ecartArbitrable(-800), decision: client_1.DecisionEcartInventaire.A_REDRESSER, responsable: 'Magasinier' }],
        });
        const p = await svc.propositionRedressement('t1', 'e1');
        expect(p.proposable).toBe(true);
        const lignes = p.lignes;
        expect(lignes.find((l) => l.sens === 'DEBIT').compte).toBeNull();
        expect(lignes.find((l) => l.sens === 'CREDIT')).toMatchObject({ compte: '31100000', montant: 800 });
    });
});
describe('procès-verbal · les deux listes de signataires', () => {
    it('REFUSE un PV sans témoin', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            membres: [{ role: client_1.RoleMembreInventaire.INVENTORIANT }],
        });
        await expect(svc.etablirProcesVerbal('t1', 'camp1', 'u1', {})).rejects.toThrow(/témoin/);
    });
    it('REFUSE un PV sans inventoriant · signé par ceux qui n’ont rien compté', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            membres: [{ role: client_1.RoleMembreInventaire.TEMOIN }],
        });
        await expect(svc.etablirProcesVerbal('t1', 'camp1', 'u1', {})).rejects.toThrow(/inventoriant/);
    });
    it('établit le PV quand les deux rôles sont là', async () => {
        const { svc, maj } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.RECENSEMENT),
            membres: [{ role: client_1.RoleMembreInventaire.TEMOIN }, { role: client_1.RoleMembreInventaire.INVENTORIANT }],
        });
        await svc.etablirProcesVerbal('t1', 'camp1', 'u1', {});
        expect(maj.mock.calls[0][0].data.procesVerbalPar).toBe('u1');
    });
});
describe('clôture · aucun écart ne se perd', () => {
    it('REFUSE de clore tant qu’un écart n’a pas de décision', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.ARBITRAGE),
            ecarts: [{ id: 'e1', decision: null }],
        });
        await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/sans décision/);
    });
    it('clôt quand tout est arbitré', async () => {
        const { svc, maj } = service({
            campagne: campagne(client_1.StatutCampagneInventaire.ARBITRAGE),
            ecarts: [{ id: 'e1', decision: client_1.DecisionEcartInventaire.A_REDRESSER }],
        });
        await svc.clore('t1', 'camp1', 'u1');
        expect(maj.mock.calls[0][0].data.statut).toBe(client_1.StatutCampagneInventaire.CLOTUREE);
    });
});
describe('ouverture d’une campagne', () => {
    it('REFUSE un exercice clos · l’inventaire précède les écritures d’inventaire', async () => {
        const { svc } = service({ exercice: { ...EXERCICE, statut: 'CLOTURE' } });
        await expect(svc.creer('t1', 'u1', { exerciceId: 'ex1', dateInventaire: '2026-12-31', libelle: 'Inventaire 2026' })).rejects.toThrow(/clos/);
    });
    it('REFUSE une date antérieure à l’ouverture de l’exercice', async () => {
        const { svc } = service();
        await expect(svc.creer('t1', 'u1', { exerciceId: 'ex1', dateInventaire: '2025-12-15', libelle: 'Inventaire' })).rejects.toThrow(/antérieure/);
    });
});
describe('résumé pour le livre d’inventaire · AUDCIF art. 19 et SYCEBNL art. 14', () => {
    it('sépare manquants et excédents, et compte ce qui reste sans décision', async () => {
        const campagnes = [
            {
                id: 'camp1',
                libelle: 'Inventaire 2026',
                dateInventaire: new Date('2026-12-31'),
                statut: client_1.StatutCampagneInventaire.ARBITRAGE,
                procesVerbalEtabliLe: null,
                _count: { fiches: 12 },
                ecarts: [
                    { ecart: -500, decision: client_1.DecisionEcartInventaire.A_REDRESSER, compte: { numero: '311', intitule: 'M' } },
                    { ecart: 200, decision: null, compte: { numero: '571', intitule: 'C' } },
                    { ecart: 0, decision: client_1.DecisionEcartInventaire.EXPLIQUE, compte: { numero: '245', intitule: 'V' } },
                ],
            },
        ];
        const prisma = {
            campagneInventaire: { findMany: jest.fn().mockResolvedValue(campagnes) },
        };
        const svc = new inventaire_service_1.InventaireService(prisma, {});
        const [r] = await svc.resumePourLivreInventaire('t1', 'ex1');
        expect(r).toMatchObject({
            fiches: 12,
            comptesRapproches: 3,
            manquants: 1,
            excedents: 1,
            sansEcart: 1,
            totalManquants: -500,
            totalExcedents: 200,
            ecartsSansDecision: 1,
        });
    });
});
describe('Inventaire · le motif du refus d’excédent dépend du compte', () => {
    it('sur un stock, l’art. 43 s’applique et il est cité', () => {
        const m = inventaire_service_1.InventaireService.motifRefusExcedent('31100000');
        expect(m).toContain('art. 43');
        expect(m).toContain("valeur d'entrée");
    });
    it('sur une immobilisation aussi', () => {
        expect(inventaire_service_1.InventaireService.motifRefusExcedent('24410000')).toContain('art. 43');
    });
    it('sur une CAISSE, l’art. 43 n’est pas invoqué comme fondement du refus', () => {
        const m = inventaire_service_1.InventaireService.motifRefusExcedent('57110000');
        expect(m).toContain('ne tranche pas');
        expect(m).toContain('variation de QUANTITÉ');
    });
    it('sur une caisse, le message cite la fiche du compte 57, qui dit l’inverse', () => {
        const m = inventaire_service_1.InventaireService.motifRefusExcedent('57110000');
        expect(m).toContain('somme disponible réellement');
    });
    it('et il dit pourquoi le refus tient quand même · aucun compte d’écart de caisse dans les deux plans', () => {
        const m = inventaire_service_1.InventaireService.motifRefusExcedent('57110000');
        expect(m).toContain('écart de');
        expect(m).toContain('commission');
    });
    it("sur un stock en inventaire PERMANENT, l’excédent n’est plus refusé au seul nom de l’art. 43", () => {
        const m = inventaire_service_1.InventaireService.motifRefusExcedent('31100000', client_1.MethodeInventaireStocks.PERMANENT);
        expect(m).toContain("BONI");
        expect(m).toContain('VARIATION');
        expect(m).toContain("valeur d'entrée");
    });
    it("sur un stock en inventaire INTERMITTENT, l’art. 43 reste le seul motif", () => {
        const m = inventaire_service_1.InventaireService.motifRefusExcedent('31100000', client_1.MethodeInventaireStocks.INTERMITTENT);
        expect(m).toContain('art. 43');
        expect(m).not.toContain('BONI');
    });
    it("la contrepartie d’un manquant est NOMMÉE sur un stock en inventaire permanent", () => {
        const note = inventaire_service_1.InventaireService.noteContrepartieManquant('31100000', client_1.MethodeInventaireStocks.PERMANENT);
        expect(note).toContain('MALI');
        expect(note).toContain('VARIATION');
        expect(note).toContain('DÉPRÉCIATION');
        expect(note).not.toContain("le référentiel n'en impose aucune");
    });
    it("ailleurs, la phrase d’origine tient · aucune source ne nomme la contrepartie", () => {
        for (const numero of ['57110000', '24410000', '41100000']) {
            expect(inventaire_service_1.InventaireService.noteContrepartieManquant(numero, client_1.MethodeInventaireStocks.PERMANENT)).toContain("le référentiel n'en impose aucune");
        }
        expect(inventaire_service_1.InventaireService.noteContrepartieManquant('31100000', null)).toContain("le référentiel n'en impose aucune");
    });
    it('le 58 (virements internes) n’est pas une caisse · seul le 57 bascule', () => {
        expect(inventaire_service_1.InventaireService.motifRefusExcedent('58500000')).toContain('art. 43');
        expect(inventaire_service_1.InventaireService.motifRefusExcedent('52100000')).toContain('art. 43');
    });
});
describe('fiches des immobilisations · le compte inscrit à la date de l’inventaire (immobilisation-en-cours.ts)', () => {
    it('un bien non achevé se compte contre son 2x9, un bien achevé contre son compte définitif', async () => {
        const { svc, prisma } = service({
            campagne: { ...campagne(client_1.StatutCampagneInventaire.RECENSEMENT), dateInventaire: new Date('2026-12-31') },
        });
        prisma.immobilisation = {
            findMany: jest.fn().mockResolvedValue([
                { id: 'chantier', designation: 'Entrepôt', numeroInventaire: null, valeurOrigine: 5000, compteImmobilisationId: 'c231', compteEnCoursId: 'c239', dateMiseEnService: null },
                { id: 'presse', designation: 'Presse', numeroInventaire: null, valeurOrigine: 2000, compteImmobilisationId: 'c241', compteEnCoursId: 'c249', dateMiseEnService: new Date('2026-09-01') },
                { id: 'chaise', designation: 'Chaise', numeroInventaire: null, valeurOrigine: 100, compteImmobilisationId: 'c244', compteEnCoursId: null, dateMiseEnService: new Date('2025-01-01') },
            ]),
        };
        await svc.engendrerFichesImmobilisations('t1', 'camp1');
        const creees = prisma.ficheInventaire.createMany.mock.calls[0][0].data;
        expect(creees.map((f) => [f.immobilisationId, f.compteId])).toEqual([
            ['chantier', 'c239'],
            ['presse', 'c241'],
            ['chaise', 'c244'],
        ]);
    });
});
//# sourceMappingURL=inventaire.spec.js.map