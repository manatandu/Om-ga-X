"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("./ecriture.service");
const controles_service_1 = require("../controles/controles.service");
const COMPTES = {
    ran: { id: 'ran', numero: '12100000', intitule: 'Report à nouveau' },
    capital: { id: 'capital', numero: '10100000', intitule: 'Dotation' },
    amortissements: { id: 'amort', numero: '28410000', intitule: 'Amortissements du matériel' },
    charge: { id: 'charge', numero: '62100000', intitule: 'Transports' },
    reserve: { id: 'reserve', numero: '11100000', intitule: 'Réserve légale' },
};
function service() {
    const creees = [];
    const misAJour = [];
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
                statut: 'OUVERT',
            }),
        },
        compte: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(Object.values(COMPTES).find((c) => c.id === where.id) ?? null)),
        },
        ecriture: {
            update: jest.fn().mockImplementation(({ data }) => {
                misAJour.push(data);
                return Promise.resolve({ id: 'e1', ...data });
            }),
        },
    };
    const svc = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
    jest.spyOn(svc, 'creer').mockImplementation(((_t, _u, dto) => {
        creees.push(dto);
        return Promise.resolve({ id: 'e1' });
    }));
    return { svc, creees, misAJour };
}
const IMPUTATION = {
    exerciceId: 'ex',
    journalId: 'j1',
    motif: client_1.MotifImputationOuverture.CHANGEMENT_METHODE,
    justification: 'Passage de la méthode de l’achèvement à l’avancement, impact fort significatif sur les capitaux propres',
    compteReportANouveauId: 'ran',
    compteContrepartieId: 'amort',
    montant: 4_500_000,
};
describe('l’imputation aux capitaux propres d’ouverture', () => {
    it('débite le report à nouveau quand le montant est positif', async () => {
        const { svc, creees, misAJour } = service();
        await svc.imputerAuxCapitauxPropresDOuverture('t1', 'u1', IMPUTATION);
        expect(creees[0].lignes).toEqual([
            { compteId: 'ran', debit: 4_500_000, credit: 0 },
            { compteId: 'amort', debit: 0, credit: 4_500_000 },
        ]);
        expect(misAJour[0].motifImputationOuverture).toBe(client_1.MotifImputationOuverture.CHANGEMENT_METHODE);
        expect(misAJour[0].justificationImputationOuverture).toContain('impact fort significatif');
    });
    it('crédite le report à nouveau quand le montant est négatif', async () => {
        const { svc, creees } = service();
        await svc.imputerAuxCapitauxPropresDOuverture('t1', 'u1', { ...IMPUTATION, montant: -1_000_000 });
        expect(creees[0].lignes).toEqual([
            { compteId: 'amort', debit: 1_000_000, credit: 0 },
            { compteId: 'ran', debit: 0, credit: 1_000_000 },
        ]);
    });
    it('date l’écriture à l’OUVERTURE de l’exercice, pas au jour de la saisie', async () => {
        const { svc, creees } = service();
        await svc.imputerAuxCapitauxPropresDOuverture('t1', 'u1', IMPUTATION);
        expect(creees[0].date).toBe('2026-01-01');
    });
    it('exige une justification · le texte impose l’information en Notes annexes', async () => {
        const { svc } = service();
        await expect(svc.imputerAuxCapitauxPropresDOuverture('t1', 'u1', { ...IMPUTATION, justification: '   ' })).rejects.toThrow(/justification est obligatoire/i);
    });
    it('refuse un compte qui n’est pas un report à nouveau', async () => {
        const { svc } = service();
        await expect(svc.imputerAuxCapitauxPropresDOuverture('t1', 'u1', {
            ...IMPUTATION,
            compteReportANouveauId: 'reserve',
        })).rejects.toThrow(/compte 12/i);
    });
    it('refuse une contrepartie de charge ou de produit', async () => {
        const { svc } = service();
        await expect(svc.imputerAuxCapitauxPropresDOuverture('t1', 'u1', { ...IMPUTATION, compteContrepartieId: 'charge' })).rejects.toThrow(/poste de BILAN/i);
    });
    it('refuse un montant nul', async () => {
        const { svc } = service();
        await expect(svc.imputerAuxCapitauxPropresDOuverture('t1', 'u1', { ...IMPUTATION, montant: 0 })).rejects.toThrow(/ne corrige rien/i);
    });
    it('accepte les DEUX motifs, et seulement eux', () => {
        expect(Object.keys(client_1.MotifImputationOuverture)).toEqual([
            'CHANGEMENT_METHODE',
            'CORRECTION_ERREUR_SIGNIFICATIVE',
        ]);
    });
});
function serviceControles(referentiel, lignes) {
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
                dateArreteComptes: new Date('2027-04-28'),
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', nom: 'Dossier', referentiel }) },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const ligne = (numero, debit, credit = 0) => ({
    debit,
    credit,
    compte: { numero, intitule: 'Report à nouveau' },
    ecriture: { numeroPiece: 'OD-000012', date: new Date('2026-03-04'), libelle: 'Régularisation' },
});
const anomalie = async (referentiel, lignes) => {
    const rapport = await serviceControles(referentiel, lignes).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'IMPUTATION_REPORT_A_NOUVEAU_NON_DECLAREE');
};
describe('le contrôle des imputations non déclarées', () => {
    for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        it(`${referentiel} · signale un mouvement du 12 hors clôture et hors exception`, async () => {
            const a = await anomalie(referentiel, [ligne('12100000', 3_000_000)]);
            expect(a).toBeDefined();
            expect(a.gravite).toBe('AVERTISSEMENT');
            expect(a.occurrences[0].montant).toBe(3_000_000);
            expect(a.consequence).toContain('aucun total ne bouge');
            expect(a.consequence).toContain('Deux exceptions');
        });
    }
    it('chaque référentiel cite SON article, jamais celui de l’autre', async () => {
        const sycebnl = await anomalie(client_1.Referentiel.SYCEBNL, [ligne('12100000', 1)]);
        expect(sycebnl.consequence).toContain('SYCEBNL art. 16, 4)');
        expect(sycebnl.consequence).not.toContain('art. 34');
        const syscohada = await anomalie(client_1.Referentiel.SYSCOHADA, [ligne('12100000', 1)]);
        expect(syscohada.consequence).toContain('AUDCIF art. 34');
        expect(syscohada.consequence).not.toContain('SYCEBNL');
    });
    it('se tait quand aucun compte 12 n’a bougé', async () => {
        expect(await anomalie(client_1.Referentiel.SYSCOHADA, [ligne('10100000', 5_000)])).toBeUndefined();
    });
    it('se tait quand rien n’a bougé du tout', async () => {
        expect(await anomalie(client_1.Referentiel.SYSCOHADA, [])).toBeUndefined();
    });
    it("EXCLUT l'affectation du résultat, qui est le chemin ORDINAIRE du compte 12", async () => {
        const prisma = {
            exercice: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockResolvedValue({
                    id: 'ex',
                    dateDebut: new Date('2026-01-01'),
                    dateFin: new Date('2026-12-31'),
                    dateArreteComptes: new Date('2027-04-28'),
                }),
            },
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', nom: 'D', referentiel: client_1.Referentiel.SYSCOHADA }),
            },
            ecriture: { findMany: jest.fn().mockResolvedValue([]) },
            compte: { findMany: jest.fn().mockResolvedValue([]) },
            ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
            exoneration: { findMany: jest.fn().mockResolvedValue([]) },
            manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
            conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
            mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
            reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
            rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
            dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
            depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
            reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
            amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
            clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
            immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        };
        await new controles_service_1.ControlesService(prisma).analyser('t', 'ex');
        const lecture = prisma.ligneEcriture.findMany;
        const lectures12 = lecture.mock.calls
            .map((appel) => appel[0])
            .filter((a) => a?.where?.compte?.numero?.startsWith === '12');
        expect(lectures12).toHaveLength(1);
        expect(lectures12[0].where.ecriture.affectationResultat).toBeNull();
        expect(lectures12[0].where.ecriture.estGenereeParCloture).toBe(false);
        expect(lectures12[0].where.ecriture.motifImputationOuverture).toBeNull();
    });
});
//# sourceMappingURL=imputation-ouverture.spec.js.map