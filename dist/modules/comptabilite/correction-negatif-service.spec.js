"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("./ecriture.service");
const D = (x) => new client_1.Prisma.Decimal(x);
function service(surcharge = {}) {
    const origine = {
        id: 'e1',
        tenantId: 't1',
        statut: client_1.StatutEcriture.VALIDEE,
        exerciceId: 'ex',
        journalId: 'j',
        journal: { id: 'j', code: 'ACH' },
        exercice: { statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
        libelle: 'Facture FA-1',
        reference: 'FA-1',
        numeroPiece: 12,
        estGenereeParCloture: false,
        corrigeEcritureId: null,
        correction: null,
        immobilisationsAcquisition: [],
        immobilisationSortie: null,
        dotationAmortissement: null,
        lignes: [
            {
                compteId: 'c601',
                libelle: 'Achat',
                debit: D(2_800_000),
                credit: D(0),
                lettre: null,
                rapprochementId: null,
                tauxTvaId: null,
                dateEcheance: null,
                dateVersement: null,
                deviseId: 'usd',
                montantDevise: D(1000),
                coursApplique: D(2800),
                ventilations: [{ sectionId: 's1', planId: 'p1', debit: D(2_800_000), credit: D(0) }],
            },
            {
                compteId: 'c401',
                libelle: 'Fournisseur',
                debit: D(0),
                credit: D(2_800_000),
                lettre: null,
                rapprochementId: null,
                tauxTvaId: null,
                dateEcheance: null,
                dateVersement: null,
                deviseId: 'usd',
                montantDevise: D(1000),
                coursApplique: D(2800),
                ventilations: [],
            },
        ],
        ...surcharge,
    };
    const tx = { ecriture: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = new Proxy({
        ecriture: { findFirst: jest.fn().mockResolvedValue(origine) },
        $transaction: jest.fn((fn) => fn(tx)),
    }, { get: (cible, cle) => cible[cle] ?? { count: jest.fn().mockResolvedValue(0) } });
    const journal = { prochainNumeroPiece: jest.fn().mockResolvedValue(13) };
    const exercice = { verifierEcritureAutorisee: jest.fn().mockResolvedValue(undefined) };
    return { s: new ecriture_service_1.EcritureService(prisma, journal, exercice, {}), tx };
}
describe('Correction par inscription en négatif · le service', () => {
    it('recopie en négatif la ventilation analytique · le cumul de la section revient à zéro', async () => {
        const { s, tx } = service();
        await s.corrigerParInscriptionEnNegatif('t1', 'u1', 'e1', { motifCorrection: 'Doublon', date: '2026-06-30' });
        const lignes = tx.ecriture.create.mock.calls[0][0].data.lignes.create;
        const ventilation = lignes[0].ventilations.create[0];
        expect({ section: ventilation.sectionId, net: Number(ventilation.debit) - Number(ventilation.credit) + 2_800_000 }).toEqual({
            section: 's1',
            net: 0,
        });
    });
    it('recopie la devise sans signe, le sens venant de la ligne', async () => {
        const { s, tx } = service();
        await s.corrigerParInscriptionEnNegatif('t1', 'u1', 'e1', { motifCorrection: 'Doublon', date: '2026-06-30' });
        const l = tx.ecriture.create.mock.calls[0][0].data.lignes.create[1];
        expect({
            devise: l.deviseId,
            montant: Number(l.montantDevise),
            cours: Number(l.coursApplique),
            credit: Number(l.credit),
        }).toEqual({ devise: 'usd', montant: 1000, cours: 2800, credit: -2_800_000 });
    });
});
describe('une écriture de la clôture · le refus nomme le chemin qui existe (audit final F64)', () => {
    it('renvoie à l’imputation déclarée aux capitaux propres d’ouverture, et ne passe rien', async () => {
        const { s, tx } = service({ estGenereeParCloture: true });
        const refus = s.corrigerParInscriptionEnNegatif('t1', 'u1', 'e1', { motifCorrection: 'x', date: '2026-06-30' });
        await expect(refus).rejects.toThrow(/imputation déclarée aux capitaux propres d'ouverture \(fenêtre Exercices\)/);
        expect(tx.ecriture.create).not.toHaveBeenCalled();
    });
    it('le service porte bien cette route', () => {
        expect(typeof ecriture_service_1.EcritureService.prototype.imputerAuxCapitauxPropresDOuverture).toBe('function');
    });
});
describe('inscription en négatif pour l’annulation d’une réévaluation', () => {
    function annulation(premierJour, surcharge = {}) {
        const origine = {
            id: 'e1',
            tenantId: 't1',
            statut: client_1.StatutEcriture.VALIDEE,
            exerciceId: 'ex',
            journalId: 'j',
            journal: { id: 'j', code: 'OD' },
            exercice: { statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
            date: new Date('2026-12-31'),
            libelle: 'Réévaluation des créances et dettes en devises au 2026-12-31',
            reference: 'REEVAL',
            numeroPiece: 40,
            correction: null,
            lignes: [
                { compteId: 'c401', libelle: 'R', debit: D(0), credit: D(198_200), tauxTvaId: null, dateEcheance: null, dateVersement: null, deviseId: null, montantDevise: null, coursApplique: null, ventilations: [] },
                { compteId: 'c478', libelle: 'R', debit: D(198_200), credit: D(0), tauxTvaId: null, dateEcheance: null, dateVersement: null, deviseId: null, montantDevise: null, coursApplique: null, ventilations: [] },
            ],
            ...surcharge,
        };
        const create = jest.fn().mockResolvedValue({ id: 'neg', numeroPiece: 41, date: premierJour });
        const prisma = { ecriture: { findFirst: jest.fn().mockResolvedValue(origine), create } };
        const journal = { prochainNumeroPiece: jest.fn().mockResolvedValue(41) };
        const exercice = { premierJourOuvert: jest.fn().mockResolvedValue(premierJour) };
        return { s: new ecriture_service_1.EcritureService(prisma, journal, exercice, {}), create };
    }
    it('validée, mêmes comptes, mêmes sens, montants négatifs, à la date de l’écriture annulée', async () => {
        const { s, create } = annulation(new Date('2026-12-31'));
        await s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'Cours corrigé');
        const data = create.mock.calls[0][0].data;
        expect(data).toMatchObject({ statut: client_1.StatutEcriture.VALIDEE, valideeBy: 'u1', corrigeEcritureId: 'e1', motifCorrection: 'Cours corrigé', dateValeur: null });
        expect(data.lignes.create.map((l) => [l.compteId, l.debit.toNumber(), l.credit.toNumber()])).toEqual([
            ['c401', -0, -198_200],
            ['c478', -198_200, -0],
        ]);
    });
    it('A7 ter, B2b · une ligne lettrée refuse, sauf celle du groupe que le module TOLÈRE (figé par une clôture)', async () => {
        const lettree = (lettrageId) => ({
            lignes: [
                { compteId: 'c401', libelle: 'R', debit: D(0), credit: D(198_200), tauxTvaId: null, dateEcheance: null, dateVersement: null, deviseId: null, montantDevise: null, coursApplique: null, ventilations: [], lettre: 'A', lettrageId, rapprochementId: null },
                { compteId: 'c478', libelle: 'R', debit: D(198_200), credit: D(0), tauxTvaId: null, dateEcheance: null, dateVersement: null, deviseId: null, montantDevise: null, coursApplique: null, ventilations: [], lettre: null, lettrageId: null, rapprochementId: null },
            ],
        });
        await expect(annulation(new Date('2026-12-31'), lettree('g-A')).s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm')).rejects.toThrow(/lettrées \(A\)/);
        const { s, create } = annulation(new Date('2026-12-31'), lettree('g-A'));
        await s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm', undefined, { groupeTolere: 'g-A' });
        expect(create).toHaveBeenCalled();
        await expect(annulation(new Date('2026-12-31'), lettree('g-B')).s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm', undefined, { groupeTolere: 'g-A' })).rejects.toThrow(/lettrées \(A\)/);
    });
    it('période close · au premier jour non clôturé, la date réelle en date de valeur', async () => {
        const { s, create } = annulation(new Date('2027-01-01'), { exercice: { statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2027-03-31') } });
        await s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm');
        expect(create.mock.calls[0][0].data).toMatchObject({ date: new Date('2027-01-01'), dateValeur: new Date('2026-12-31') });
    });
    it('refus · premier jour ouvert hors de l’exercice, exercice clôturé, déjà corrigée', async () => {
        await expect(annulation(new Date('2027-01-01')).s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm')).rejects.toThrow(/hors de l'exercice/);
        const refus = annulation(new Date('2027-01-01')).s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm');
        await expect(refus).rejects.toThrow(/close jusqu'à la fin de l'exercice, définitivement, et plus rien ne s'y inscrit/);
        await expect(annulation(new Date('2027-01-01')).s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm')).rejects.not.toThrow(/rouvrez/);
        await expect(annulation(new Date('2026-12-31'), { exercice: { statut: client_1.StatutExercice.CLOTURE, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') } }).s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm')).rejects.toThrow(/exercice clôturé.*art\. 20, al\. 3/);
        await expect(annulation(new Date('2026-12-31'), { correction: { id: 'x' } }).s.inscrireEnNegatifPourAnnulation('t1', 'u1', 'e1', 'm')).rejects.toThrow(/déjà corrigée/);
    });
});
//# sourceMappingURL=correction-negatif-service.spec.js.map