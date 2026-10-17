"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const demantelement_1 = require("./demantelement");
const demantelement_service_1 = require("./demantelement.service");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
describe('provision pour démantèlement · règle (lot 15)', () => {
    it('exemple du texte · valeur actualisée 3 219 732 F', () => {
        expect(Math.round((0, demantelement_1.valeurActualiseeDemantelement)(10_000_000, 12, 10))).toBe(3_219_732);
    });
    it('exemple du texte · désactualisation de N 386 368 F, provision 3 606 100 F au 31/12/N', () => {
        const mois = (0, demantelement_1.moisDeDesactualisation)({ dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }, new Date('2026-01-02'));
        expect(mois).toBe(12);
        const d = (0, demantelement_1.desactualisationExercice)({ provisionOuverture: 3_219_732, tauxPourcent: 12, mois, coutFutur: 10_000_000 });
        expect(Math.round(d)).toBe(386_368);
        expect(Math.round(3_219_732 + d)).toBe(Math.round((0, demantelement_1.valeurActualiseeDemantelement)(10_000_000, 12, 9)));
        expect(Math.round((0, demantelement_1.valeurActualiseeDemantelement)(10_000_000, 12, 9))).toBe(3_606_100);
    });
    it('dix désactualisations rendent la provision au coût attendu, jamais au-delà', () => {
        let provision = (0, demantelement_1.valeurActualiseeDemantelement)(10_000_000, 12, 10);
        for (let k = 0; k < 12; k++) {
            provision += (0, demantelement_1.desactualisationExercice)({ provisionOuverture: provision, tauxPourcent: 12, mois: 12, coutFutur: 10_000_000 });
        }
        expect(provision).toBeCloseTo(10_000_000, 2);
    });
    it('une entrée en cours d’exercice ne court que de son mois ; postérieure, rien', () => {
        const ex = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
        expect((0, demantelement_1.moisDeDesactualisation)(ex, new Date('2026-07-15'))).toBe(6);
        expect((0, demantelement_1.moisDeDesactualisation)(ex, new Date('2027-01-02'))).toBe(0);
        expect((0, demantelement_1.moisDeDesactualisation)(ex, new Date('2024-01-02'))).toBe(12);
    });
    it('la reprise solde le 1984 · valeur d’entrée au 7911, désactualisations au 7971 (§ 4.1, § 4.2)', () => {
        expect((0, demantelement_1.ventilationReprise)(3_219_732, [386_367.84, 432_732])).toEqual({ exploitation: 3_219_732, financiere: 819_099.84, total: 4_038_831.84 });
    });
    it('les paramètres ne vont qu’au composant démantèlement, taux exigé, entrée sous le coût attendu', () => {
        const p = { estComposantDemantelement: true, coutFutur: 10_000_000, tauxPourcent: 12, valeurOrigine: 3_219_732 };
        expect((0, demantelement_1.motifRefusParametresDemantelement)(p)).toBeNull();
        expect((0, demantelement_1.motifRefusParametresDemantelement)({ ...p, coutFutur: null, tauxPourcent: null })).toBeNull();
        expect((0, demantelement_1.motifRefusParametresDemantelement)({ ...p, estComposantDemantelement: false })).toContain('composant démantèlement');
        expect((0, demantelement_1.motifRefusParametresDemantelement)({ ...p, tauxPourcent: null })).toContain("taux d'actualisation");
        expect((0, demantelement_1.motifRefusParametresDemantelement)({ ...p, valeurOrigine: 12_000_000 })).toContain('dépasse le coût attendu');
    });
    const etat = {
        estComposantDemantelement: true,
        entreParLaProvision: true,
        tauxPourcent: 12,
        exerciceOuvert: true,
        dejaPassee: false,
        repriseFaite: false,
        enService: true,
        mois: 12,
        exercicesManquants: [],
    };
    it('chaque refus de la désactualisation est nommé', () => {
        expect((0, demantelement_1.motifRefusDesactualisation)(etat)).toBeNull();
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, estComposantDemantelement: false })).toContain('composant démantèlement');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, entreParLaProvision: false })).toContain('1984');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, tauxPourcent: null })).toContain('Aucun taux');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, exerciceOuvert: false })).toContain('clôturé');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, repriseFaite: true })).toContain('reprise');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, enService: false })).toContain('sorti');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, dejaPassee: true })).toContain('déjà passée');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, mois: 0 })).toContain('après la fin');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, exercicesManquants: ["l'exercice 2026"] })).toContain("l'exercice 2026");
    });
    it('chaque refus de la reprise est nommé', () => {
        const r = { estComposantDemantelement: true, entreParLaProvision: true, exerciceOuvert: true, repriseFaite: false, dateDansExercice: true };
        expect((0, demantelement_1.motifRefusReprise)(r)).toBeNull();
        expect((0, demantelement_1.motifRefusReprise)({ ...r, entreParLaProvision: false })).toContain('1984');
        expect((0, demantelement_1.motifRefusReprise)({ ...r, repriseFaite: true })).toContain('déjà été reprise');
        expect((0, demantelement_1.motifRefusReprise)({ ...r, dateDansExercice: false })).toContain("dans l'exercice");
        expect((0, demantelement_1.motifRefusReprise)({ ...r, exerciceOuvert: false })).toContain('clôturé');
        expect((0, demantelement_1.motifRefusReprise)({ ...r, repris: true })).toContain("repris au bilan d'ouverture");
        expect((0, demantelement_1.motifRefusReprise)({ ...r, exercicesManquants: ["l'exercice 2025"] })).toContain("l'exercice 2025");
        expect((0, demantelement_1.motifRefusReprise)({ ...r, desactualiseeJusquAu: '2026-12-31' })).toContain('2026-12-31');
    });
    it('SMT et composant repris ferment la désactualisation, chacun par son motif', () => {
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, refusSystemeMinimal: 'SMT' })).toBe('SMT');
        expect((0, demantelement_1.motifRefusDesactualisation)({ ...etat, repris: true })).toContain("repris au bilan d'ouverture");
    });
    it('rien à désactualiser · taux nul ou absent, ou provision au coût attendu', () => {
        expect((0, demantelement_1.resteADesactualiser)({ tauxPourcent: 12, provision: 3_219_732, coutFutur: 10_000_000 })).toBe(true);
        expect((0, demantelement_1.resteADesactualiser)({ tauxPourcent: 0, provision: 3_219_732, coutFutur: 10_000_000 })).toBe(false);
        expect((0, demantelement_1.resteADesactualiser)({ tauxPourcent: null, provision: 3_219_732, coutFutur: null })).toBe(false);
        expect((0, demantelement_1.resteADesactualiser)({ tauxPourcent: 12, provision: 10_000_000, coutFutur: 10_000_000 })).toBe(false);
        expect((0, demantelement_1.resteADesactualiser)({ tauxPourcent: 12, provision: 3_219_732, coutFutur: null })).toBe(true);
    });
    it('la reprise en cours d’exercice arrête les mois à sa date', () => {
        const ex = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
        expect((0, demantelement_1.moisDeDesactualisation)(ex, new Date('2026-01-02'), new Date('2026-06-30'))).toBe(6);
        expect((0, demantelement_1.moisDeDesactualisation)(ex, new Date('2026-01-02'))).toBe(12);
    });
    it('les comptes du texte sont semés, les mêmes aux deux plans', () => {
        for (const plan of [compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA, compte_seed_1.PLAN_COMPTES_SYCEBNL]) {
            const numeros = plan.map((c) => c.numero);
            for (const r of Object.values(demantelement_service_1.COMPTES_DEMANTELEMENT))
                expect(numeros).toContain(`${r}0000`);
        }
    });
});
describe('provision pour démantèlement · service (lot 15)', () => {
    const exercice = { id: 'ex-1', tenantId: 't', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: client_1.StatutExercice.OUVERT };
    function monter(options = {}) {
        let rang = 0;
        const creer = jest.fn().mockImplementation(() => Promise.resolve({ id: `ecr-${++rang}` }));
        const retirer = jest.fn().mockResolvedValue(undefined);
        const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'mv-1', ...data }));
        const prisma = {
            immobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'c-1',
                    designation: 'Plate-forme · démantèlement',
                    typeComposant: client_1.TypeComposant.DEMANTELEMENT,
                    immobilisationPrincipaleId: 'p-1',
                    valeurOrigine: 3_219_732,
                    dateAcquisition: new Date('2026-01-02'),
                    statut: client_1.StatutImmobilisation.EN_SERVICE,
                    ecritureAcquisitionId: options.ecritureAcquisitionId === undefined ? 'acq-1' : options.ecritureAcquisitionId,
                    coutFuturDemantelement: 10_000_000,
                    tauxActualisationDemantelementPourcent: 12,
                    mouvementsDemantelement: options.mouvements ?? [],
                }),
            },
            ligneEcriture: { count: jest.fn().mockResolvedValue(options.credit1984 ?? 1) },
            exercice: {
                findFirst: jest.fn().mockResolvedValue(exercice),
                findMany: jest.fn().mockResolvedValue(options.anterieurs ?? []),
            },
            compte: { findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: `cpt-${where.numero.startsWith}`, numero: `${where.numero.startsWith}0000` })) },
            mouvementDemantelement: { create, delete: jest.fn().mockResolvedValue({}) },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'NORMAL', ...options.regime }) },
            $transaction: (f) => f(prisma),
        };
        const service = new demantelement_service_1.DemantelementService(prisma, { creer, retirerCompensation: retirer });
        return { service, creer, create, retirer, prisma };
    }
    it('désactualise au 31 décembre · D 6971 / C 1984 pour 386 367,84, ligne retenue', async () => {
        const { service, creer, create } = monter();
        await service.desactualiser('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1' });
        const lignes = creer.mock.calls[0][2].lignes;
        expect(creer.mock.calls[0][2].date).toBe('2026-12-31');
        expect(lignes).toEqual([
            { compteId: 'cpt-6971', debit: 386_367.84, credit: 0 },
            { compteId: 'cpt-1984', debit: 0, credit: 386_367.84 },
        ]);
        expect(create.mock.calls[0][0].data).toMatchObject({ nature: client_1.NatureMouvementDemantelement.DESACTUALISATION, ecritureId: 'ecr-1', montant: 386_367.84 });
    });
    it('refusé avant toute écriture sur un composant qui n’est pas entré par le 1984', async () => {
        const { service, creer } = monter({ credit1984: 0 });
        await expect(service.desactualiser('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1' })).rejects.toThrow('1984');
        expect(creer).not.toHaveBeenCalled();
    });
    it('refusé tant qu’un exercice antérieur traversé n’a pas sa désactualisation', async () => {
        const { service, creer } = monter({ anterieurs: [{ id: 'ex-0', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }] });
        await expect(service.desactualiser('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1' })).rejects.toThrow('2025-01-01');
        expect(creer).not.toHaveBeenCalled();
    });
    it('reprise au 31 décembre · D 1984 / C 7911 / C 7971, sur la valeur d’entrée et le cumul des désactualisations', async () => {
        const { service, creer, create } = monter({
            mouvements: [
                { nature: client_1.NatureMouvementDemantelement.DESACTUALISATION, exerciceId: 'ex-1', date: new Date('2026-12-31'), montant: 386_367.84 },
            ],
        });
        await service.reprendre('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-12-31', motif: 'ENGAGEMENT_COUTS' });
        expect(creer).toHaveBeenCalledTimes(1);
        expect(creer.mock.calls[0][2].lignes).toEqual([
            { compteId: 'cpt-1984', debit: 3_606_099.84, credit: 0 },
            { compteId: 'cpt-7911', debit: 0, credit: 3_219_732 },
            { compteId: 'cpt-7971', debit: 0, credit: 386_367.84 },
        ]);
        expect(create.mock.calls[0][0].data).toMatchObject({ nature: client_1.NatureMouvementDemantelement.REPRISE, motifReprise: 'ENGAGEMENT_COUTS' });
    });
    it('reprise en cours d’exercice · la désactualisation courue jusqu’à elle est passée d’abord, puis reprise au 7971', async () => {
        const { service, creer, create } = monter();
        await service.reprendre('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-06-30', motif: 'ENGAGEMENT_COUTS' });
        expect(creer).toHaveBeenCalledTimes(2);
        expect(creer.mock.calls[0][2]).toMatchObject({ date: '2026-06-30' });
        expect(creer.mock.calls[0][2].lignes).toEqual([
            { compteId: 'cpt-6971', debit: 187_712.06, credit: 0 },
            { compteId: 'cpt-1984', debit: 0, credit: 187_712.06 },
        ]);
        expect(creer.mock.calls[1][2].lignes).toEqual([
            { compteId: 'cpt-1984', debit: 3_407_444.06, credit: 0 },
            { compteId: 'cpt-7911', debit: 0, credit: 3_219_732 },
            { compteId: 'cpt-7971', debit: 0, credit: 187_712.06 },
        ]);
        expect(create.mock.calls.map((c) => c[0].data.nature)).toEqual([
            client_1.NatureMouvementDemantelement.DESACTUALISATION,
            client_1.NatureMouvementDemantelement.REPRISE,
        ]);
    });
    it('reprise refusée tant qu’un exercice antérieur traversé n’a pas sa désactualisation', async () => {
        const { service, creer } = monter({ anterieurs: [{ id: 'ex-0', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }] });
        await expect(service.reprendre('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-06-30', motif: 'ENGAGEMENT_COUTS' })).rejects.toThrow(/Désactualisation non passée pour l'exercice du 2025-01-01/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('reprise refusée avant la date jusqu’à laquelle l’exercice est déjà désactualisé', async () => {
        const { service, creer } = monter({
            mouvements: [
                { nature: client_1.NatureMouvementDemantelement.DESACTUALISATION, exerciceId: 'ex-1', date: new Date('2026-12-31'), montant: 386_367.84 },
            ],
        });
        await expect(service.reprendre('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-06-30', motif: 'ENGAGEMENT_COUTS' })).rejects.toThrow(/déjà passée jusqu'au 2026-12-31/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('une reprise refusée à l’écriture défait la désactualisation courue qu’elle venait de passer', async () => {
        const { service, creer, retirer, prisma } = monter();
        creer.mockImplementationOnce(() => Promise.resolve({ id: 'ecr-couru' })).mockImplementationOnce(() => Promise.reject(new Error('journal fermé')));
        await expect(service.reprendre('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-06-30', motif: 'ENGAGEMENT_COUTS' })).rejects.toThrow('journal fermé');
        expect(prisma.mouvementDemantelement.delete).toHaveBeenCalledTimes(1);
        expect(retirer).toHaveBeenCalledWith('t', 'ecr-couru');
    });
    it.each([
        ['SYSCOHADA', { referentiel: 'SYSCOHADA', systemeComptableSyscohada: 'MINIMAL_TRESORERIE' }],
        ['SYCEBNL', { referentiel: 'SYCEBNL', jeuEtatsFinanciersSycebnl: 'SYSTEME_MINIMAL_TRESORERIE' }],
    ])('%s au SMT · la désactualisation est refusée, la reprise solde sans rien créer', async (_ref, regime) => {
        const { service, creer } = monter({ regime });
        await expect(service.desactualiser('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1' })).rejects.toThrow(/Système minimal de trésorerie/);
        expect(creer).not.toHaveBeenCalled();
        await service.reprendre('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-06-30', motif: 'CESSION_SOUS_JACENT' });
        expect(creer).toHaveBeenCalledTimes(1);
        expect(creer.mock.calls[0][2].lignes).toEqual([
            { compteId: 'cpt-1984', debit: 3_219_732, credit: 0 },
            { compteId: 'cpt-7911', debit: 0, credit: 3_219_732 },
        ]);
    });
    it('composant repris au bilan d’ouverture · désactualisation et reprise refusées, la raison dite', async () => {
        const { service, creer } = monter({ ecritureAcquisitionId: null, credit1984: 0 });
        await expect(service.desactualiser('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1' })).rejects.toThrow(/repris au bilan d'ouverture/);
        await expect(service.reprendre('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-06-30', motif: 'ENGAGEMENT_COUTS' })).rejects.toThrow(/repris au bilan d'ouverture/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('l’état ne propose plus de reprise une fois faite', async () => {
        const { service } = monter({
            mouvements: [{ nature: client_1.NatureMouvementDemantelement.REPRISE, exerciceId: 'ex-1', date: new Date('2026-06-30'), montant: 3_219_732 }],
        });
        const etat = await service.etat('t', 'c-1', 'ex-1');
        expect(etat.repriseFaite).toBe(true);
        expect(etat.reprise).toBeNull();
    });
    it('une ligne refusée retire son écriture, et un double envoi se dit en 409', async () => {
        const { service, create, retirer } = monter();
        const { Prisma } = jest.requireActual('@prisma/client');
        create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('doublon', { code: 'P2002', clientVersion: 'x' }));
        await expect(service.desactualiser('t', 'u', 'c-1', { exerciceId: 'ex-1', journalId: 'j-1' })).rejects.toThrow('déjà passé');
        expect(retirer).toHaveBeenCalledWith('t', 'ecr-1');
    });
});
//# sourceMappingURL=demantelement.spec.js.map