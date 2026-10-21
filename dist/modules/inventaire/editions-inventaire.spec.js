"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const editions_inventaire_1 = require("./editions-inventaire");
const lieu_sur_fiche_1 = require("./lieu-sur-fiche");
const inventaire_service_1 = require("./inventaire.service");
const solde_caisse_au_comptage_1 = require("./solde-caisse-au-comptage");
const CAMPAGNE = {
    id: 'camp1',
    libelle: 'Inventaire de clôture 2026',
    dateInventaire: new Date('2026-12-31'),
    statut: client_1.StatutCampagneInventaire.RECENSEMENT,
    instructions: null,
    exercice: { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), dateArreteComptes: null },
};
const SC_MAGASIN = {
    id: 'sc-mag',
    nom: 'Magasin',
    perimetre: 'Magasin central',
    membres: [
        { nom: 'Kabila', fonction: 'Magasinier', role: client_1.RoleMembreInventaire.INVENTORIANT },
        { nom: 'Mutombo', fonction: 'Auditeur', role: client_1.RoleMembreInventaire.TEMOIN },
    ],
};
const SC_PARC = {
    id: 'sc-parc',
    nom: 'Parc',
    perimetre: null,
    membres: [{ nom: 'Lukusa', fonction: null, role: client_1.RoleMembreInventaire.INVENTORIANT }],
};
const fiche = (p) => ({
    designation: p.id,
    emplacement: null,
    uniteMesure: 'unité',
    quantiteComptee: null,
    valeurInventaire: null,
    referencePiece: null,
    sousCommissionId: null,
    compte: { numero: '24410000', intitule: 'Mobilier de bureau' },
    ...p,
});
describe('le lieu du bien sur sa fiche (AUDCIF art. 16, al. 4 et 5)', () => {
    it('« code · intitulé », un seul des deux s’il manque l’autre, null sans lieu', () => {
        expect((0, lieu_sur_fiche_1.libelleLieuBien)({ code: 'B2', intitule: 'Bureau du directeur' })).toBe('B2 · Bureau du directeur');
        expect((0, lieu_sur_fiche_1.libelleLieuBien)({ code: '', intitule: 'Entrepôt' })).toBe('Entrepôt');
        expect((0, lieu_sur_fiche_1.libelleLieuBien)({ code: 'E1', intitule: '  ' })).toBe('E1');
        expect((0, lieu_sur_fiche_1.libelleLieuBien)(null)).toBeNull();
        expect((0, lieu_sur_fiche_1.libelleLieuBien)({ code: ' ', intitule: '' })).toBeNull();
    });
    function serviceDesFiches(fichesExistantes) {
        const prisma = {
            campagneInventaire: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'camp1',
                    tenantId: 't1',
                    statut: client_1.StatutCampagneInventaire.PREPARATION,
                    dateInventaire: new Date('2026-12-31'),
                }),
            },
            immobilisation: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 'bureau', designation: 'Bureau', numeroInventaire: 'INV-1', compteImmobilisationId: 'c244', compteEnCoursId: null, dateMiseEnService: new Date('2025-01-01'), lieu: { code: 'B2', intitule: 'Direction' } },
                    { id: 'groupe', designation: 'Groupe électrogène', numeroInventaire: null, compteImmobilisationId: 'c241', compteEnCoursId: null, dateMiseEnService: new Date('2025-01-01'), lieu: null },
                    { id: 'chaise', designation: 'Chaise', numeroInventaire: null, compteImmobilisationId: 'c244', compteEnCoursId: null, dateMiseEnService: new Date('2025-01-01'), lieu: { code: 'S1', intitule: 'Salle' } },
                    { id: 'table', designation: 'Table', numeroInventaire: null, compteImmobilisationId: 'c244', compteEnCoursId: null, dateMiseEnService: new Date('2025-01-01'), lieu: { code: 'S1', intitule: 'Salle' } },
                ]),
            },
            ficheInventaire: {
                findMany: jest.fn().mockResolvedValue(fichesExistantes),
                createMany: jest.fn().mockResolvedValue({ count: 0 }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        };
        return { svc: new inventaire_service_1.InventaireService(prisma, {}), prisma };
    }
    it('la fiche engendrée porte le lieu du bien, une fiche sans lieu reste sans emplacement', async () => {
        const { svc, prisma } = serviceDesFiches([]);
        await svc.engendrerFichesImmobilisations('t1', 'camp1');
        expect(prisma.immobilisation.findMany.mock.calls[0][0].include).toEqual({
            lieu: { select: { code: true, intitule: true } },
        });
        const creees = prisma.ficheInventaire.createMany.mock.calls[0][0].data;
        expect(Object.fromEntries(creees.map((f) => [f.immobilisationId, f.emplacement]))).toEqual({
            bureau: 'B2 · Direction',
            groupe: null,
            chaise: 'S1 · Salle',
            table: 'S1 · Salle',
        });
    });
    it('une fiche déjà engendrée SANS emplacement le reçoit ; un emplacement saisi n’est jamais écrasé', async () => {
        const { svc, prisma } = serviceDesFiches([
            { id: 'f-chaise', immobilisationId: 'chaise', emplacement: null },
            { id: 'f-table', immobilisationId: 'table', emplacement: 'Couloir (vu sur place)' },
            { id: 'f-groupe', immobilisationId: 'groupe', emplacement: null },
        ]);
        const r = await svc.engendrerFichesImmobilisations('t1', 'camp1');
        const maj = prisma.ficheInventaire.updateMany.mock.calls.map((c) => c[0]);
        expect(maj).toEqual([{ where: { id: 'f-chaise', tenantId: 't1', emplacement: null }, data: { emplacement: 'S1 · Salle' } }]);
        expect(r.lieuxRecopies).toBe(1);
        const creees = prisma.ficheInventaire.createMany.mock.calls[0][0].data;
        expect(creees.map((f) => f.immobilisationId)).toEqual(['bureau']);
    });
});
describe('fiches de comptage vierges', () => {
    const fiches = [
        fiche({ id: 'chaise', emplacement: 'S1 · Salle', sousCommissionId: 'sc-parc' }),
        fiche({ id: 'armoire', emplacement: null, sousCommissionId: 'sc-parc' }),
        fiche({ id: 'bureau', emplacement: 'B2 · Direction', sousCommissionId: 'sc-parc', quantiteComptee: 1, valeurInventaire: 500 }),
        fiche({ id: 'riz', emplacement: 'Magasin', sousCommissionId: 'sc-mag', compte: { numero: '31100000', intitule: 'Marchandises' }, uniteMesure: 'sac' }),
        fiche({ id: 'perdue', emplacement: 'Garage', sousCommissionId: 'sc-retiree' }),
        fiche({ id: 'libre', emplacement: 'Cour' }),
    ];
    it('une section par sous-commission, rangée par lieu (lieu non renseigné en dernier), les orphelines à part', () => {
        const e = (0, editions_inventaire_1.editionFichesVierges)({ campagne: CAMPAGNE, sousCommissions: [SC_PARC, SC_MAGASIN], fiches });
        expect(e.sections.map((s) => s.sousCommission?.nom ?? null)).toEqual(['Magasin', 'Parc', null]);
        expect(e.sections[1].lignes.map((l) => [l.designation, l.lieu])).toEqual([
            ['bureau', 'B2 · Direction'],
            ['chaise', 'S1 · Salle'],
            ['armoire', 'Lieu non renseigné'],
        ]);
        expect(e.sections[2].lignes.map((l) => l.designation)).toEqual(['libre', 'perdue']);
        expect(e.nombreFiches).toBe(6);
        expect(e.sections[0].lignes[0]).toEqual({
            ficheId: 'riz',
            designation: 'riz',
            compte: '31100000 · Marchandises',
            lieu: 'Magasin',
            unite: 'sac',
        });
    });
    it('les trois colonnes de l’art. 16, al. 4 restent à remplir · aucune quantité ni valeur n’est servie', () => {
        const e = (0, editions_inventaire_1.editionFichesVierges)({ campagne: CAMPAGNE, sousCommissions: [SC_PARC], fiches });
        expect(e.colonnesARemplir).toEqual(editions_inventaire_1.COLONNES_A_REMPLIR);
        expect(e.colonnesARemplir).toEqual(["Quantité comptée", "Valeur d'inventaire", 'Pièce de référence']);
        for (const s of e.sections)
            for (const l of s.lignes)
                expect(Object.keys(l).sort()).toEqual(['compte', 'designation', 'ficheId', 'lieu', 'unite']);
        expect(e.dejaComptees).toBe(1);
        expect(e.perimetre).toBe('Toutes les sous-commissions · 6 fiches · dont 1 déjà comptée (feuille de recomptage)');
    });
    it('restreinte à une sous-commission, elle ne porte que ses fiches et ses membres, et le dit', () => {
        const e = (0, editions_inventaire_1.editionFichesVierges)({ campagne: CAMPAGNE, sousCommissions: [SC_PARC, SC_MAGASIN], fiches, sousCommissionId: 'sc-mag' });
        expect(e.sections).toHaveLength(1);
        expect(e.sections[0].sousCommission).toEqual({
            id: 'sc-mag',
            nom: 'Magasin',
            perimetre: 'Magasin central',
            inventoriants: [{ nom: 'Kabila', fonction: 'Magasinier' }],
            temoins: [{ nom: 'Mutombo', fonction: 'Auditeur' }],
        });
        expect(e.perimetre).toBe('Sous-commission « Magasin » · 1 fiche');
    });
});
describe('procès-verbal d’inventaire physique', () => {
    const ecarts = [
        {
            compte: { numero: '31100000', intitule: 'Marchandises' },
            valeurInventaire: 900,
            soldeComptable: 1000,
            ecart: -100,
            nombreFiches: 1,
            rapprocheLe: new Date('2027-01-05'),
            decision: client_1.DecisionEcartInventaire.A_REDRESSER,
            responsable: 'Magasinier',
            explication: null,
            arbitreLe: new Date('2027-01-06'),
        },
        {
            compte: { numero: '24410000', intitule: 'Mobilier de bureau' },
            valeurInventaire: 0.3,
            soldeComptable: 0.3,
            ecart: 0,
            nombreFiches: 2,
            rapprocheLe: new Date('2027-01-05'),
            decision: null,
            responsable: null,
            explication: null,
            arbitreLe: null,
        },
    ];
    it('le relevé garde null pour ce qui n’est ni compté ni valorisé, jamais zéro, et le total du compte aussi', () => {
        const e = (0, editions_inventaire_1.editionPvInventaire)({
            campagne: CAMPAGNE,
            etabli: null,
            sousCommissions: [SC_MAGASIN],
            fiches: [
                fiche({ id: 'a', quantiteComptee: 1, valeurInventaire: 0.1 }),
                fiche({ id: 'b', quantiteComptee: 1, valeurInventaire: 0.2 }),
                fiche({ id: 'riz', quantiteComptee: null, valeurInventaire: null, compte: { numero: '31100000', intitule: 'Marchandises' } }),
            ],
            ecarts: [],
            pvCaisses: [],
        });
        expect(e.releve.find((l) => l.designation === 'riz')).toMatchObject({ quantite: null, valeur: null });
        expect(e.totauxParCompte).toEqual([
            { compte: '24410000 · Mobilier de bureau', nombreFiches: 2, valeurInventaire: 0.3, nonValorisees: 0 },
            { compte: '31100000 · Marchandises', nombreFiches: 1, valeurInventaire: null, nonValorisees: 1 },
        ]);
        expect(e.rapprochee).toBe(false);
        expect(e.mentions).toEqual([
            'Procès-verbal non établi dans OmegaX · document de travail.',
            '1 fiche sans quantité comptée.',
            "1 fiche sans valeur d'inventaire.",
            'Écarts non encore rapprochés de la balance.',
        ]);
    });
    it('écarts figés avec leur sens et leur décision, caisses renvoyées à leur PV, signataires par rôle', () => {
        const e = (0, editions_inventaire_1.editionPvInventaire)({
            campagne: { ...CAMPAGNE, statut: client_1.StatutCampagneInventaire.ARBITRAGE },
            etabli: { le: new Date('2027-01-04'), par: 'chef@cabinet.cd' },
            sousCommissions: [SC_PARC, SC_MAGASIN],
            fiches: [fiche({ id: 'a', quantiteComptee: 1, valeurInventaire: 0.3 })],
            ecarts,
            pvCaisses: [
                {
                    id: 'pv1',
                    dateComptage: new Date('2027-01-10'),
                    heureComptage: '08:30',
                    especesComptees: 150000,
                    soldeComptableFige: 150500,
                    ecart: -500,
                    compte: { numero: '57110000', intitule: 'Caisse siège' },
                    sousCommission: { nom: 'Magasin' },
                    unite: null,
                },
            ],
        });
        expect(e.ecarts.map((x) => [x.compte, x.sens, x.decision])).toEqual([
            ['24410000 · Mobilier de bureau', 'SANS_ECART', null],
            ['31100000 · Marchandises', 'MANQUANT', 'A_REDRESSER'],
        ]);
        expect(e.caisses).toEqual([
            {
                pvId: 'pv1',
                caisse: '57110000 · Caisse siège',
                dateComptage: new Date('2027-01-10'),
                heureComptage: '08:30',
                sousCommission: 'Magasin',
                unite: null,
                especesComptees: 150000,
                soldeComptable: 150500,
                ecart: -500,
            },
        ]);
        expect(e.signataires).toEqual({
            inventoriants: [
                { nom: 'Kabila', fonction: 'Magasinier', sousCommission: 'Magasin' },
                { nom: 'Lukusa', fonction: null, sousCommission: 'Parc' },
            ],
            temoins: [{ nom: 'Mutombo', fonction: 'Auditeur', sousCommission: 'Magasin' }],
        });
        expect(e.rapprochee).toBe(true);
        expect(e.mentions).toEqual(['1 écart sans décision.']);
    });
});
describe('procès-verbal de comptage d’une caisse', () => {
    const dateCloture = new Date('2026-12-31');
    const pvBrut = {
        id: 'pv1',
        campagneId: 'camp1',
        dateComptage: new Date('2027-01-10'),
        heureComptage: '08:30',
        especesComptees: 140000,
        soldeComptableFige: 150000,
        ecart: -10000,
        soldeALaCloture: 100000,
        mouvementsValeurAvantCloture: 0,
        encaissementsPosterieurs: 80000,
        decaissementsPosterieurs: 30000,
        mouvementsPosterieurs: 3,
        modeComparaison: client_1.ModeComparaisonCaisse.FRANCS,
        devise: null,
        attestationEtablieLe: new Date('2027-01-10'),
        attestationPar: 'Directeur financier',
        observations: null,
        etabliLe: new Date('2027-01-10'),
        etabliPar: 'u1',
        coupures: [
            { valeurUnitaire: 5000, nombre: 20 },
            { valeurUnitaire: 20000, nombre: 2 },
        ],
        compte: { numero: '57110000', intitule: 'Caisse siège' },
    };
    it('reprend les chiffres figés et les MENTIONS de presenterPvCaisse, sans les recomposer', () => {
        const presente = inventaire_service_1.InventaireService.presenterPvCaisse(pvBrut, dateCloture);
        const e = (0, editions_inventaire_1.editionPvCaisse)({ campagne: CAMPAGNE, pv: presente, sousCommission: SC_MAGASIN, etabliPar: 'chef@cabinet.cd' });
        expect(e.mentions).toBe(presente.mentions);
        expect(e.mentions).toEqual((0, solde_caisse_au_comptage_1.mentionsDuPv)({
            dateComptage: pvBrut.dateComptage,
            dateCloture,
            mode: client_1.ModeComparaisonCaisse.FRANCS,
            soldeComptable: 150000,
            soldeALaCloture: 100000,
            mouvementsValeurAvantCloture: 0,
            especesReconstituees: presente.especesReconstitueesALaCloture,
        }));
        expect(e.reconstitution).toEqual({
            dateCloture,
            soldeALaCloture: 100000,
            mouvementsValeurAvantCloture: 0,
            encaissementsPosterieurs: 80000,
            decaissementsPosterieurs: 30000,
            mouvementsPosterieurs: 3,
            especesReconstitueesALaCloture: 90000,
        });
        expect([e.especesComptees, e.soldeComptable, e.ecart]).toEqual([140000, 150000, -10000]);
        expect(e.coupures).toEqual([
            { valeurUnitaire: 20000, nombre: 2, total: 40000 },
            { valeurUnitaire: 5000, nombre: 20, total: 100000 },
        ]);
        expect(e.totalCoupures).toBe(140000);
        expect(e.attestation).toEqual({ le: new Date('2027-01-10'), par: 'Directeur financier' });
        expect(e.etabli).toEqual({ le: new Date('2027-01-10'), par: 'chef@cabinet.cd' });
        expect(e.sousCommission.inventoriants).toEqual([{ nom: 'Kabila', fonction: 'Magasinier' }]);
    });
    it('comptée avant la clôture · aucune reconstitution, sans coupures ni attestation · null, jamais zéro', () => {
        const presente = inventaire_service_1.InventaireService.presenterPvCaisse({
            ...pvBrut,
            dateComptage: new Date('2026-12-31'),
            soldeALaCloture: null,
            mouvementsValeurAvantCloture: null,
            encaissementsPosterieurs: null,
            decaissementsPosterieurs: null,
            mouvementsPosterieurs: null,
            coupures: [],
            attestationEtablieLe: null,
            attestationPar: null,
        }, dateCloture);
        const e = (0, editions_inventaire_1.editionPvCaisse)({ campagne: CAMPAGNE, pv: presente, sousCommission: SC_MAGASIN, etabliPar: 'x' });
        expect(e.reconstitution).toBeNull();
        expect(e.compteApresLaCloture).toBe(false);
        expect(e.totalCoupures).toBeNull();
        expect(e.attestation).toBeNull();
    });
    it('comptée après la clôture sans reconstitution figée (PV d’avant A10) · reconstitution null, et le PV le dit', () => {
        const presente = inventaire_service_1.InventaireService.presenterPvCaisse({ ...pvBrut, soldeALaCloture: null, encaissementsPosterieurs: null, decaissementsPosterieurs: null }, dateCloture);
        const e = (0, editions_inventaire_1.editionPvCaisse)({ campagne: CAMPAGNE, pv: presente, sousCommission: SC_MAGASIN, etabliPar: 'x' });
        expect(e.reconstitution).toBeNull();
        expect(e.reconstitutionManquante).toBe(true);
    });
});
describe('les éditions servies par le service', () => {
    function serviceEditions(etat = {}) {
        const prisma = {
            campagneInventaire: {
                findFirst: jest.fn().mockImplementation((a) => Promise.resolve(a.select
                    ? { procesVerbalEtabliLe: new Date('2027-01-04'), procesVerbalPar: 'u1' }
                    : { ...CAMPAGNE, tenantId: 't1', exercice: CAMPAGNE.exercice })),
            },
            sousCommissionInventaire: {
                findMany: jest.fn().mockResolvedValue(etat.sousCommissions ?? [SC_MAGASIN]),
            },
            ficheInventaire: { findMany: jest.fn().mockResolvedValue([]) },
            ecartInventaire: { findMany: jest.fn().mockResolvedValue([]) },
            procesVerbalComptageCaisse: { findMany: jest.fn().mockResolvedValue([]) },
            user: {
                findFirst: jest.fn().mockResolvedValue(etat.userEmail === null ? null : { email: etat.userEmail ?? 'chef@cabinet.cd' }),
            },
        };
        return { svc: new inventaire_service_1.InventaireService(prisma, {}), prisma };
    }
    it('une sous-commission étrangère à la campagne est refusée · jamais une feuille vide', async () => {
        const { svc } = serviceEditions();
        await expect(svc.editionFichesVierges('t1', 'camp1', 'sc-autre')).rejects.toThrow("Cette sous-commission n'appartient pas à la campagne.");
    });
    it('les lectures sont bornées au dossier et à la campagne', async () => {
        const { svc, prisma } = serviceEditions();
        await svc.editionFichesVierges('t1', 'camp1');
        expect(prisma.sousCommissionInventaire.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', campagneId: 'camp1' });
        expect(prisma.ficheInventaire.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', campagneId: 'camp1' });
    });
    it('l’auteur du PV est rendu par son courriel, ou nommé « retiré du dossier »', async () => {
        const a = await serviceEditions().svc.editionProcesVerbal('t1', 'camp1');
        expect(a.etabli).toEqual({ le: new Date('2027-01-04'), par: 'chef@cabinet.cd' });
        const b = await serviceEditions({ userEmail: null }).svc.editionProcesVerbal('t1', 'camp1');
        expect(b.etabli?.par).toBe('utilisateur retiré du dossier');
    });
});
//# sourceMappingURL=editions-inventaire.spec.js.map