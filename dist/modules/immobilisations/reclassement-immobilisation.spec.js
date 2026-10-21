"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const COMPTES = {
    cImmoAvant: { numero: '23130000', intitule: 'Bâtiments administratifs et commerciaux' },
    cAmortAvant: { numero: '28313000', intitule: 'Amortissements des bâtiments administratifs' },
    cDotAvant: { numero: '68130000', intitule: 'Dotations aux amortissements des corporelles' },
    cImmoApres: { numero: '23150000', intitule: 'Bâtiments - immeubles de placement' },
    cAmortApres: { numero: '28315000', intitule: 'Amortissements des immeubles de placement' },
    cDotApres: { numero: '68130000', intitule: 'Dotations aux amortissements des corporelles' },
    c29Avant: { numero: '29313000', intitule: 'Dépréciations des bâtiments administratifs' },
    c29Apres: { numero: '29315000', intitule: 'Dépréciations des immeubles de placement' },
    cIncorporel: { numero: '21310000', intitule: 'Logiciels' },
    cAmortIncorporel: { numero: '28131000', intitule: 'Amortissements des logiciels' },
    cPasUn29: { numero: '39100000', intitule: 'Dépréciations des stocks de marchandises' },
    cFraisDev: { numero: '21100000', intitule: 'Frais de développement' },
    cAmortFraisDev: { numero: '28110000', intitule: 'Amortissements des frais de développement' },
    cDotIncorporel: { numero: '68120000', intitule: 'Dotations aux amortissements des incorporelles' },
};
function service(options = {}) {
    const ecrituresPostees = [];
    const misesAJour = [];
    const reclassements = [];
    const depreciationsRecomptees = [];
    const immo = {
        id: 'i1',
        designation: 'Immeuble Kalembelembe',
        statut: options.statut ?? client_1.StatutImmobilisation.EN_SERVICE,
        dateAcquisition: new Date('2020-01-10'),
        dateMiseEnService: new Date('2020-01-10'),
        valeurOrigine: 200_000_000,
        valeurResiduelle: 0,
        dureeAmortissementAns: 20,
        amortissementAnterieur: options.amortissementAnterieur ?? 0,
        familleId: 'fAvant',
        compteImmobilisationId: options.compteAvant ?? 'cImmoAvant',
        compteAmortissementId: 'cAmortAvant',
        compteDotationId: 'cDotAvant',
        compteImmobilisation: COMPTES[options.compteAvant ?? 'cImmoAvant'],
        dotations: (options.dotations ?? []).map((montant, i) => ({ id: `d${i}`, montant, exerciceId: `ex${i}` })),
        depreciations: (options.depreciations ?? []).map((d, i) => ({
            id: `dep${i}`,
            sens: d.sens,
            montant: d.montant,
            compteDepreciationId: 'c29Avant',
            compteContrepartieId: 'c69',
            exercice: { dateFin: new Date('2025-12-31') },
        })),
    };
    const destination = options.familleDestination ?? {
        compteImmobilisationId: 'cImmoApres',
        compteAmortissementId: 'cAmortApres',
        compteDotationId: 'cDotApres',
    };
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: options.referentiel ?? client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
            }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue(immo),
            update: jest.fn().mockImplementation((args) => {
                misesAJour.push(args.data);
                return Promise.resolve({ ...immo, ...args.data });
            }),
        },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'exN',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        familleImmobilisation: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'fApres',
                ...destination,
                compteImmobilisation: COMPTES[destination.compteImmobilisationId],
                compteAmortissement: COMPTES[destination.compteAmortissementId],
            }),
        },
        compte: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(COMPTES[where.id] ? { id: where.id, ...COMPTES[where.id] } : null)),
        },
        depreciationImmobilisation: {
            updateMany: jest.fn().mockImplementation((args) => {
                const a = args;
                depreciationsRecomptees.push({ where: a.where, data: a.data });
                return Promise.resolve({ count: 1 });
            }),
        },
        reclassementImmobilisation: {
            create: jest.fn().mockImplementation(({ data }) => {
                reclassements.push(data);
                return Promise.resolve({ id: 'r1', ...data });
            }),
        },
        $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
    };
    const ecritures = {
        creer: jest.fn().mockImplementation((_t, _u, dto) => {
            ecrituresPostees.push({ libelle: dto.libelle, lignes: dto.lignes });
            return Promise.resolve({ id: `e${ecrituresPostees.length}` });
        }),
    };
    return {
        svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures),
        ecrituresPostees,
        misesAJour,
        reclassements,
        depreciationsRecomptees,
    };
}
const RECLASSEMENT = {
    nouvelleFamilleId: '11111111-1111-4111-8111-111111111111',
    dateReclassement: '2026-07-01',
    exerciceId: 'exN',
    journalId: 'j1',
    motif: "Les trois étages sont désormais donnés en location simple · ch. 10 § 1.2.",
};
const somme = (lignes, champ) => lignes.reduce((s, l) => s + l[champ], 0);
describe('reclassement d’immobilisation · ch. 10 § 2.4', () => {
    it('vire la valeur d’origine du compte d’origine vers le compte de destination', async () => {
        const { svc, ecrituresPostees } = service();
        await svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT);
        expect(ecrituresPostees).toHaveLength(1);
        const { lignes } = ecrituresPostees[0];
        expect(lignes).toContainEqual({ compteId: 'cImmoApres', debit: 200_000_000, credit: 0 });
        expect(lignes).toContainEqual({ compteId: 'cImmoAvant', debit: 0, credit: 200_000_000 });
        expect(somme(lignes, 'debit')).toBe(somme(lignes, 'credit'));
    });
    it('EMPORTE l’amortissement cumulé avec le bien, amortissement antérieur compris', async () => {
        const { svc, ecrituresPostees } = service({ dotations: [10_000_000, 10_000_000], amortissementAnterieur: 60_000_000 });
        await svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT);
        const { lignes } = ecrituresPostees[0];
        expect(lignes).toContainEqual({ compteId: 'cAmortAvant', debit: 80_000_000, credit: 0 });
        expect(lignes).toContainEqual({ compteId: 'cAmortApres', debit: 0, credit: 80_000_000 });
        expect(somme(lignes, 'debit')).toBe(somme(lignes, 'credit'));
    });
    it('NE RECALCULE RIEN · aucune dotation complémentaire, aucune ligne de résultat', async () => {
        const { svc, ecrituresPostees } = service({ dotations: [10_000_000] });
        const resultat = await svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT);
        expect(ecrituresPostees).toHaveLength(1);
        expect(ecrituresPostees[0].libelle).toContain('Reclassement');
        const comptesTouches = ecrituresPostees[0].lignes.map((l) => COMPTES[l.compteId].numero);
        expect(comptesTouches.filter((n) => /^[6789]/.test(n))).toEqual([]);
        expect(resultat.vire).toEqual({
            valeurOrigine: 200_000_000,
            cumulAmortissement: 10_000_000,
            cumulDepreciation: 0,
        });
    });
    it('emporte aussi la DÉPRÉCIATION, et recompte les lignes qui la portent', async () => {
        const { svc, ecrituresPostees, depreciationsRecomptees } = service({
            depreciations: [{ sens: 'DOTATION', montant: 15_000_000 }],
        });
        await svc.reclasser('t1', 'u1', 'i1', {
            ...RECLASSEMENT,
            nouveauCompteDepreciationId: 'c29Apres',
        });
        const { lignes } = ecrituresPostees[0];
        expect(lignes).toContainEqual({ compteId: 'c29Avant', debit: 15_000_000, credit: 0 });
        expect(lignes).toContainEqual({ compteId: 'c29Apres', debit: 0, credit: 15_000_000 });
        expect(depreciationsRecomptees).toEqual([
            { where: { immobilisationId: 'i1' }, data: { compteDepreciationId: 'c29Apres' } },
        ]);
    });
    it('REFUSE un bien déprécié sans compte 29 de destination · un 29 deviné serait faux', async () => {
        const { svc } = service({ depreciations: [{ sens: 'DOTATION', montant: 15_000_000 }] });
        await expect(svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT)).rejects.toThrow(/compte 29 de destination/i);
    });
    it('refuse un compte de destination qui n’est pas un 29', async () => {
        const { svc } = service({ depreciations: [{ sens: 'DOTATION', montant: 15_000_000 }] });
        await expect(svc.reclasser('t1', 'u1', 'i1', { ...RECLASSEMENT, nouveauCompteDepreciationId: 'cPasUn29' })).rejects.toThrow(/préfixe 29/);
    });
    it('REFUSE de franchir la nature du bien', async () => {
        const { svc } = service({
            familleDestination: {
                compteImmobilisationId: 'cIncorporel',
                compteAmortissementId: 'cAmortIncorporel',
                compteDotationId: 'cDotApres',
            },
        });
        await expect(svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT)).rejects.toThrow(/NATURE/);
    });
    it('refuse un reclassement vers le compte que le bien porte déjà', async () => {
        const { svc } = service({
            familleDestination: {
                compteImmobilisationId: 'cImmoAvant',
                compteAmortissementId: 'cAmortAvant',
                compteDotationId: 'cDotAvant',
            },
        });
        await expect(svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT)).rejects.toThrow(/déjà porté au compte/);
    });
    it('refuse un bien déjà sorti · il n’a plus d’utilisation à changer', async () => {
        const { svc } = service({ statut: client_1.StatutImmobilisation.CEDEE });
        await expect(svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT)).rejects.toThrow(/bien sorti/i);
    });
    it('refuse une date hors de l’exercice, et une date antérieure à l’acquisition', async () => {
        const { svc } = service();
        await expect(svc.reclasser('t1', 'u1', 'i1', { ...RECLASSEMENT, dateReclassement: '2027-03-01' })).rejects.toThrow(/dans l'exercice indiqué/);
    });
    it('EXIGE un motif · le § 1.2 qualifie par l’usage, que nul solde ne porte', async () => {
        const { svc } = service();
        await expect(svc.reclasser('t1', 'u1', 'i1', { ...RECLASSEMENT, motif: '   ' })).rejects.toThrow(/motif du reclassement est obligatoire/i);
    });
    it('conserve le motif et les DEUX comptes, pour qu’un réviseur puisse relire', async () => {
        const { svc, reclassements } = service();
        await svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT);
        expect(reclassements).toHaveLength(1);
        expect(reclassements[0]).toMatchObject({
            immobilisationId: 'i1',
            exerciceId: 'exN',
            motif: RECLASSEMENT.motif,
            ancienCompteImmobilisationId: 'cImmoAvant',
            nouveauCompteImmobilisationId: 'cImmoApres',
            createdBy: 'u1',
        });
    });
    it('fait suivre les TROIS comptes du bien, pas seulement celui de l’actif', async () => {
        const { svc, misesAJour } = service();
        await svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT);
        expect(misesAJour[0]).toEqual({
            familleId: 'fApres',
            compteImmobilisationId: 'cImmoApres',
            compteAmortissementId: 'cAmortApres',
            compteDotationId: 'cDotApres',
        });
    });
});
describe('reclassement VERS le 211 · les six critères ne se contournent pas (lot 15)', () => {
    const VERS_211 = {
        compteAvant: 'cIncorporel',
        familleDestination: { compteImmobilisationId: 'cFraisDev', compteAmortissementId: 'cAmortFraisDev', compteDotationId: 'cDotIncorporel' },
    };
    const SIX = {
        FAISABILITE_TECHNIQUE: 'Prototype validé',
        INTENTION: 'Décision du conseil',
        CAPACITE: 'Équipe en place',
        AVANTAGES_ECONOMIQUES: 'Contrats signés',
        RESSOURCES: 'Budget voté',
        EVALUATION_FIABLE: 'Suivi analytique par projet',
    };
    it('REFUSE le virement sans les six critères, en nommant le premier qui manque', async () => {
        const { svc, ecrituresPostees } = service(VERS_211);
        await expect(svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT)).rejects.toThrow(/Critère 1 non démontré/);
        expect(ecrituresPostees).toHaveLength(0);
    });
    it('refuse une réunion des critères postérieure à la dépense (§ 3.1, pas de rétroactivité)', async () => {
        const { svc } = service(VERS_211);
        await expect(svc.reclasser('t1', 'u1', 'i1', { ...RECLASSEMENT, criteresFraisDeveloppement: SIX, dateReunionCriteresDeveloppement: '2021-01-01' })).rejects.toThrow(/avant la réunion des six critères/);
    });
    it('admet le virement quand les six critères sont déclarés, et les garde sur la fiche', async () => {
        const { svc, ecrituresPostees, misesAJour } = service(VERS_211);
        await svc.reclasser('t1', 'u1', 'i1', {
            ...RECLASSEMENT,
            criteresFraisDeveloppement: SIX,
            dateReunionCriteresDeveloppement: '2019-06-01',
        });
        expect(ecrituresPostees).toHaveLength(1);
        expect(misesAJour[0]).toMatchObject({
            compteImmobilisationId: 'cFraisDev',
            criteresFraisDeveloppement: SIX,
            dateReunionCriteresDeveloppement: new Date('2019-06-01'),
        });
    });
    it("ne s'applique pas au SYCEBNL · son plan n'ouvre aucun 211", async () => {
        const { svc, ecrituresPostees } = service({ ...VERS_211, referentiel: client_1.Referentiel.SYCEBNL });
        await svc.reclasser('t1', 'u1', 'i1', RECLASSEMENT);
        expect(ecrituresPostees).toHaveLength(1);
    });
});
//# sourceMappingURL=reclassement-immobilisation.spec.js.map