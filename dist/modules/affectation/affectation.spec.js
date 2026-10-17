"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const affectation_service_1 = require("./affectation.service");
const COMPTES = [
    { id: 'c131', numero: '13100000', intitule: 'Résultat net : bénéfice', typeCompte: 'DETAIL' },
    { id: 'c139', numero: '13900000', intitule: 'Résultat net : perte', typeCompte: 'DETAIL' },
    { id: 'c111', numero: '11100000', intitule: 'Réserve légale', typeCompte: 'DETAIL' },
    { id: 'c118', numero: '11810000', intitule: 'Réserves facultatives', typeCompte: 'DETAIL' },
    { id: 'c121', numero: '12100000', intitule: 'Report à nouveau créditeur', typeCompte: 'DETAIL' },
    { id: 'c129', numero: '12910000', intitule: 'Perte nette à reporter', typeCompte: 'DETAIL' },
    { id: 'c465', numero: '46500000', intitule: 'Associés, dividendes à payer', typeCompte: 'DETAIL' },
    { id: 'c10', numero: '10110000', intitule: 'Dotation', typeCompte: 'DETAIL' },
    { id: 'c12', numero: '12', intitule: 'Report à nouveau', typeCompte: 'TOTAL' },
    { id: 'c60', numero: '60100000', intitule: 'Achats', typeCompte: 'DETAIL' },
    { id: 'c103', numero: '10300000', intitule: 'Capital personnel', typeCompte: 'DETAIL' },
    { id: 'c1061', numero: '10610000', intitule: 'Écarts de réévaluation légale', typeCompte: 'DETAIL' },
    { id: 'c104', numero: '10410000', intitule: 'Compte de l’exploitant', typeCompte: 'DETAIL' },
    { id: 'c105', numero: '10510000', intitule: 'Primes d’émission', typeCompte: 'DETAIL' },
    { id: 'c109', numero: '10900000', intitule: 'Apporteurs, capital souscrit, non appelé', typeCompte: 'DETAIL' },
];
function service(o = {}) {
    const creerEcriture = jest.fn().mockResolvedValue({ id: 'ecr1', numeroPiece: 12 });
    const creerAffectation = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'aff1', ...data }));
    const clos = {
        id: 'ex2026',
        statut: o.statutExercice ?? 'CLOTURE',
        dateDebut: new Date('2026-01-01'),
        dateFin: new Date('2026-12-31'),
    };
    const suivant = o.suivant === undefined
        ? { id: 'ex2027', statut: 'OUVERT', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') }
        : o.suivant;
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.dateDebut ? suivant : clos)),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: o.referentiel ?? client_1.Referentiel.SYSCOHADA,
                formeJuridiqueSyscohada: o.forme === undefined ? client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE : o.forme,
                formeJuridiqueSyscohadaAnterieure: o.transformation?.anterieure ?? null,
                dateTransformationForme: o.transformation?.date ?? null,
            }),
        },
        compte: {
            findMany: jest
                .fn()
                .mockImplementation(({ where }) => Promise.resolve(where.id
                ? COMPTES.filter((c) => where.id.in.includes(c.id))
                : COMPTES.filter((c) => c.typeCompte === 'DETAIL' &&
                    (!where.OR || where.OR.some((o) => c.numero.startsWith(o.numero.startsWith)))))),
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(COMPTES.find((c) => c.numero.startsWith(where.numero.startsWith)) ?? null)),
        },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'jOD', code: 'OD' }) },
        affectationResultat: {
            findUnique: jest.fn().mockResolvedValue(o.affectationExistante ?? null),
            create: creerAffectation,
            findMany: jest.fn().mockResolvedValue([]),
        },
    };
    const ecritures = {
        balance: jest.fn().mockImplementation((_t, exerciceId) => Promise.resolve({
            lignes: (exerciceId === suivant?.id && o.balanceAccueil ? o.balanceAccueil : (o.balance ?? [])).map((l) => ({
                clotureDebit: 0,
                clotureCredit: 0,
                ...l,
            })),
            totaux: { debit: 0, credit: 0 },
        })),
        creer: creerEcriture,
    };
    return { svc: new affectation_service_1.AffectationService(prisma, ecritures), creerEcriture, creerAffectation };
}
const benefice = (montant, extra = []) => [
    { numero: '13100000', mouvementDebit: 0, mouvementCredit: 0, clotureCredit: montant, solde: -montant },
    ...extra,
];
const perte = (montant, extra = []) => [
    { numero: '13900000', mouvementDebit: 0, mouvementCredit: 0, clotureDebit: montant, solde: montant },
    ...extra,
];
const DECISION = { dateDecision: '2027-06-30', organe: 'Assemblée générale ordinaire', reference: 'PV-2027-01' };
describe('Affectation · le montant à affecter', () => {
    it('lit le résultat que la clôture a posé sur le 13, ni son mouvement ni son solde (audit final F4)', async () => {
        const { svc } = service({
            balance: [
                { numero: '13100000', mouvementDebit: 1_000_000, mouvementCredit: 0, clotureCredit: 2_000_000, solde: -5_000_000 },
            ],
        });
        const p = await svc.preparer('t1', 'ex2026');
        expect(p.montant).toBe(2_000_000);
        expect(p.estBenefice).toBe(true);
    });
    it('reconnaît une perte posée sur le 139 par la clôture', async () => {
        const { svc } = service({
            balance: [{ numero: '13900000', mouvementDebit: 0, mouvementCredit: 0, clotureDebit: 800_000, solde: 800_000 }],
        });
        const p = await svc.preparer('t1', 'ex2026');
        expect(p.montant).toBe(800_000);
        expect(p.estBenefice).toBe(false);
    });
    it('refuse d’affecter un exercice qui n’est pas clôturé', async () => {
        const { svc } = service({ statutExercice: 'OUVERT' });
        await expect(svc.preparer('t1', 'ex2026')).rejects.toThrow(/après la clôture/);
    });
});
describe('Affectation · le compte 13 doit être SOLDÉ', () => {
    it('refuse une affectation partielle, et dit ce qui reste', async () => {
        const { svc } = service({ balance: benefice(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 600_000 }],
        })).rejects.toThrow(/reste 400000.00 à affecter/);
    });
    it('accepte une affectation qui épuise le résultat', async () => {
        const { svc, creerEcriture } = service({ balance: benefice(1_000_000) });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 100_000 },
                { compteId: 'c121', montant: 900_000 },
            ],
        });
        expect(creerEcriture).toHaveBeenCalledTimes(1);
    });
});
describe('Affectation · le résultat viré au 130 à la réouverture (paquet 1, A6)', () => {
    it('débite le 1301, et non le 131, quand le bénéfice y a été viré', async () => {
        const { svc, creerEcriture } = service({
            balance: benefice(1_000_000),
            balanceAccueil: [
                { compteId: 'c131', numero: '13100000', mouvementDebit: 1_000_000, mouvementCredit: 0, solde: 0 },
                { compteId: 'c1301', numero: '13010000', mouvementDebit: 0, mouvementCredit: 1_000_000, solde: -1_000_000 },
            ],
        });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 100_000 },
                { compteId: 'c121', montant: 900_000 },
            ],
        });
        const dto = creerEcriture.mock.calls[0][2];
        expect(dto.lignes[0]).toMatchObject({ compteId: 'c1301', debit: 1_000_000 });
        expect(dto.lignes.some((l) => l.compteId === 'c131')).toBe(false);
    });
    it('crédite le 1309 pour une perte qui y a été virée, le reste au 139', async () => {
        const { svc, creerEcriture } = service({
            balance: perte(500_000),
            balanceAccueil: [
                { compteId: 'c139', numero: '13900000', mouvementDebit: 0, mouvementCredit: 300_000, solde: 200_000 },
                { compteId: 'c1309', numero: '13090000', mouvementDebit: 300_000, mouvementCredit: 0, solde: 300_000 },
            ],
        });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c129', montant: 500_000 }],
        });
        const dto = creerEcriture.mock.calls[0][2];
        expect(dto.lignes[0]).toMatchObject({ compteId: 'c1309', credit: 300_000 });
        expect(dto.lignes[1]).toMatchObject({ compteId: 'c139', credit: 200_000 });
    });
});
describe('Affectation · l’écriture qui solde le 13', () => {
    it('DÉBITE le 131 et crédite les destinations, pour un bénéfice', async () => {
        const { svc, creerEcriture } = service({ balance: benefice(1_000_000) });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 100_000 },
                { compteId: 'c121', montant: 900_000 },
            ],
        });
        const dto = creerEcriture.mock.calls[0][2];
        expect(dto.lignes[0]).toMatchObject({ compteId: 'c131', debit: 1_000_000 });
        expect(dto.lignes[1]).toMatchObject({ compteId: 'c111', credit: 100_000 });
        expect(dto.lignes[2]).toMatchObject({ compteId: 'c121', credit: 900_000 });
    });
    it('CRÉDITE le 139 et débite les destinations, pour une perte', async () => {
        const { svc, creerEcriture } = service({
            balance: [{ numero: '13900000', mouvementDebit: 0, mouvementCredit: 0, clotureDebit: 500_000, solde: 500_000 }],
        });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c129', montant: 500_000 }],
        });
        const dto = creerEcriture.mock.calls[0][2];
        expect(dto.lignes[0]).toMatchObject({ compteId: 'c139', credit: 500_000 });
        expect(dto.lignes[1]).toMatchObject({ compteId: 'c129', debit: 500_000 });
    });
    it('passe l’écriture dans l’exercice SUIVANT, à la date de la décision', async () => {
        const { svc, creerEcriture } = service({ balance: benefice(1_000_000) });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 100_000 },
                { compteId: 'c121', montant: 900_000 },
            ],
        });
        const dto = creerEcriture.mock.calls[0][2];
        expect(dto.exerciceId).toBe('ex2027');
        expect(dto.date).toBe('2027-06-30');
        expect(dto.libelle).toContain('2026');
    });
    it('refuse une date de décision hors de l’exercice d’accueil', async () => {
        const { svc } = service({ balance: benefice(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            dateDecision: '2026-06-30',
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        })).rejects.toThrow(/date de décision/);
    });
    it('refuse quand aucun exercice ne suit · il faut l’ouvrir d’abord', async () => {
        const { svc } = service({ balance: benefice(1_000_000), suivant: null });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        })).rejects.toThrow(/Aucun exercice ne suit/);
    });
});
describe('Affectation · les destinations dépendent du référentiel', () => {
    it('refuse les dividendes à une entité à but non lucratif', async () => {
        const { svc } = service({ referentiel: client_1.Referentiel.SYCEBNL, balance: benefice(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c465', montant: 1_000_000 }],
        })).rejects.toThrow(/but désintéressé/);
    });
    it('les accepte d’une société', async () => {
        const { svc, creerEcriture } = service({ balance: benefice(1_000_000) });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 100_000 },
                { compteId: 'c465', montant: 900_000 },
            ],
        });
        expect(creerEcriture).toHaveBeenCalled();
    });
    it('refuse un compte qui n’est pas une destination du résultat', async () => {
        const { svc } = service({ balance: benefice(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c60', montant: 1_000_000 }],
        })).rejects.toThrow(/n'est pas une destination admise/);
    });
    it('refuse un compte de totalisation', async () => {
        const { svc } = service({ balance: benefice(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c12', montant: 1_000_000 }],
        })).rejects.toThrow(/compte de totalisation/);
    });
});
describe('Affectation · la réserve légale bloque, elle n’avertit pas', () => {
    const avecCapital = (montant) => benefice(montant, [
        { numero: '10110000', mouvementDebit: 0, mouvementCredit: 0, solde: -10_000_000 },
        { numero: '11100000', mouvementDebit: 0, mouvementCredit: 0, solde: 0 },
    ]);
    it('refuse une affectation qui dote moins du dixième', async () => {
        const { svc } = service({ balance: avecCapital(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 50_000 },
                { compteId: 'c121', montant: 950_000 },
            ],
        })).rejects.toThrow(/au moins 100000.00/);
    });
    it('accepte au-delà du minimum · c’est un plancher, pas un montant', async () => {
        const { svc, creerEcriture } = service({ balance: avecCapital(1_000_000) });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 300_000 },
                { compteId: 'c121', montant: 700_000 },
            ],
        });
        expect(creerEcriture).toHaveBeenCalled();
    });
    it('ne l’exige pas d’une entité à but non lucratif', async () => {
        const { svc, creerEcriture } = service({
            referentiel: client_1.Referentiel.SYCEBNL,
            balance: benefice(1_000_000),
        });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        });
        expect(creerEcriture).toHaveBeenCalled();
    });
    it('ne l’exige pas sur une perte', async () => {
        const { svc, creerEcriture } = service({
            balance: [
                { numero: '13900000', mouvementDebit: 0, mouvementCredit: 0, clotureDebit: 400_000, solde: 400_000 },
                { numero: '10110000', mouvementDebit: 0, mouvementCredit: 0, solde: -10_000_000 },
            ],
        });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c129', montant: 400_000 }],
        });
        expect(creerEcriture).toHaveBeenCalled();
    });
});
describe('Affectation · la réserve légale ne frappe que les formes que le texte vise', () => {
    const avecCapital = (montant, capital, racine = '10110000') => benefice(montant, [
        { numero: racine, mouvementDebit: 0, mouvementCredit: 0, solde: -capital },
        { numero: '11100000', mouvementDebit: 0, mouvementCredit: 0, solde: 0 },
    ]);
    it('laisse passer l’affectation d’un GIE, qui peut n’avoir aucun capital', async () => {
        const { svc, creerEcriture } = service({
            forme: client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE,
            balance: benefice(1_000_000),
        });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        });
        expect(creerEcriture).toHaveBeenCalledTimes(1);
    });
    it('laisse passer l’affectation d’une société coopérative', async () => {
        const { svc, creerEcriture } = service({
            forme: client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
            balance: avecCapital(1_000_000, 10_000_000),
        });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        });
        expect(creerEcriture).toHaveBeenCalledTimes(1);
    });
    it('laisse passer l’affectation quand la forme n’est pas renseignée', async () => {
        const { svc, creerEcriture } = service({ forme: null, balance: benefice(1_000_000) });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        });
        expect(creerEcriture).toHaveBeenCalledTimes(1);
    });
    it('continue de REFUSER une SARL sous-dotée · la règle n’est pas désarmée', async () => {
        const { svc } = service({
            forme: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            balance: avecCapital(1_000_000, 10_000_000),
        });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        })).rejects.toThrow(/au moins 100000.00/);
    });
    it('sert à chaque forme SON article, jamais celui de la voisine', async () => {
        const sarl = await service({
            forme: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            balance: avecCapital(1_000_000, 10_000_000),
        }).svc.preparer('t1', 'ex2026');
        expect(sarl.reserveLegale.motif).toContain('art. 346');
        expect(sarl.reserveLegale.motif).not.toContain('546');
        const sa = await service({
            forme: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            balance: avecCapital(1_000_000, 10_000_000),
        }).svc.preparer('t1', 'ex2026');
        expect(sa.reserveLegale.motif).toContain('art. 546, 2°');
        const gie = await service({
            forme: client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE,
            balance: benefice(1_000_000),
        }).svc.preparer('t1', 'ex2026');
        expect(gie.reserveLegale.dotation).toBeNull();
        expect(gie.reserveLegale.motif).toContain('art. 869');
    });
    it('lit le capital d’une entreprise individuelle au 103, pas au 101', async () => {
        const { svc } = service({
            forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            balance: avecCapital(1_000_000, 4_000_000, '10300000'),
        });
        const p = await svc.preparer('t1', 'ex2026');
        expect(p.capitalRacine).toBe('103');
        expect(p.capitalSocial).toBe(4_000_000);
        expect(p.reserveLegale.dotation).toBeNull();
    });
    it('ne lit aucun capital social à une entité à but non lucratif', async () => {
        const { svc } = service({
            referentiel: client_1.Referentiel.SYCEBNL,
            forme: null,
            balance: benefice(1_000_000, [
                { numero: '10110000', mouvementDebit: 0, mouvementCredit: 0, solde: -8_000_000 },
            ]),
        });
        const p = await svc.preparer('t1', 'ex2026');
        expect(p.capitalRacine).toBeNull();
        expect(p.capitalSocial).toBe(0);
    });
});
describe('Affectation · une seule par exercice', () => {
    it('refuse une seconde décision sur le même exercice', async () => {
        const { svc } = service({
            balance: benefice(1_000_000),
            affectationExistante: { id: 'aff0', dateDecision: new Date('2027-05-01') },
        });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        })).rejects.toThrow(/déjà été affecté le 2027-05-01/);
    });
});
describe('Passe F6 · le compte 106 « Écarts de réévaluation » n’est pas une destination', () => {
    it('refuse d’imputer une PERTE sur l’écart de réévaluation', async () => {
        const { svc } = service({ balance: perte(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c1061', montant: 1_000_000 }],
        })).rejects.toThrow(/compensation/);
    });
    it('le refuse aussi d’un BÉNÉFICE · l’écart naît d’une réévaluation, pas d’une affectation', async () => {
        const { svc } = service({ balance: benefice(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c1061', montant: 1_000_000 }],
        })).rejects.toThrow(/n'est PAS une destination du résultat/);
    });
    it('le refuse dans les DEUX référentiels', async () => {
        const { svc } = service({ referentiel: client_1.Referentiel.SYCEBNL, balance: perte(1_000_000) });
        await expect(svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c1061', montant: 1_000_000 }],
        })).rejects.toThrow(/Écarts de réévaluation/);
    });
    it('ne le PROPOSE plus au menu · refuser après avoir offert arrive trop tard', async () => {
        const { svc } = service({ balance: benefice(1_000_000) });
        const vue = await svc.preparer('t1', 'ex2026');
        const numeros = vue.destinations.map((d) => d.numero);
        expect(numeros).toContain('10110000');
        expect(numeros).not.toContain('10610000');
    });
    it('laisse passer une réserve facultative · la correction n’a pas fermé la racine 10', async () => {
        const { svc, creerEcriture } = service({ balance: benefice(1_000_000) });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 100_000 },
                { compteId: 'c118', montant: 900_000 },
            ],
        });
        expect(creerEcriture).toHaveBeenCalled();
    });
});
describe('Affectation · les destinations dépendent du SENS du résultat', () => {
    it('refuse une perte portée au 465 · la fiche ne crédite le 13 que par le 12, le 11, le 101 ou le 103', async () => {
        const { svc } = service({ balance: perte(500_000) });
        await expect(svc.enregistrer('t1', 'u1', { ...DECISION, exerciceId: 'ex2026', lignes: [{ compteId: 'c465', montant: 500_000 }] })).rejects.toThrow(/destination admise d’une perte.*101 \(Capital social\) ou 103/);
    });
    it('refuse un bénéfice porté au 104 ou au 109', async () => {
        for (const compteId of ['c104', 'c109']) {
            const { svc } = service({ forme: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, balance: benefice(1_000_000) });
            await expect(svc.enregistrer('t1', 'u1', { ...DECISION, exerciceId: 'ex2026', lignes: [{ compteId, montant: 1_000_000 }] })).rejects.toThrow(/destination admise d’un bénéfice/);
        }
    });
    it('admet l’absorption d’une perte par le 105, que sa fiche prévoit', async () => {
        const { svc, creerEcriture } = service({ balance: perte(500_000) });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c105', montant: 500_000 }],
        });
        expect(creerEcriture.mock.calls[0][2].lignes[1]).toMatchObject({ compteId: 'c105', debit: 500_000 });
    });
    it('ne propose pas le 465 sur une perte, et le propose sur un bénéfice', async () => {
        const surPerte = (await service({ balance: perte(500_000) }).svc.preparer('t1', 'ex2026')).destinations.map((d) => d.numero);
        const surBenefice = (await service({ balance: benefice(500_000) }).svc.preparer('t1', 'ex2026')).destinations.map((d) => d.numero);
        expect(surPerte).not.toContain('46500000');
        expect(surPerte).toContain('10510000');
        expect(surBenefice).toContain('46500000');
        expect(surBenefice).not.toContain('10900000');
        expect(surBenefice).not.toContain('10410000');
    });
});
describe('Affectation · les pertes antérieures comptent le 13 non affecté', () => {
    const balance = benefice(3_000_000, [
        { numero: '13910000', mouvementDebit: 0, mouvementCredit: 0, solde: 1_000_000 },
    ]);
    it('lit la perte N-1 au 139 parmi les pertes antérieures', async () => {
        const p = await service({ balance }).svc.preparer('t1', 'ex2026');
        expect(p.pertesAnterieures).toBe(1_000_000);
        expect(p.montant).toBe(3_000_000);
        expect(p.reserveLegale.dotation).toBe(200_000);
    });
    it('accepte la délibération qui dote le dixième du bénéfice diminué de cette perte', async () => {
        const { svc, creerEcriture } = service({ balance });
        await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 200_000 },
                { compteId: 'c121', montant: 2_800_000 },
            ],
        });
        expect(creerEcriture).toHaveBeenCalled();
    });
});
describe('Affectation · avertissements rendus avec la décision', () => {
    it('nomme le dividende qui excède le bénéfice distribuable connu (art. 143 et 144)', async () => {
        const { svc } = service({
            balance: benefice(1_000_000, [{ numero: '12910000', mouvementDebit: 0, mouvementCredit: 0, solde: 600_000 }]),
        });
        const r = await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 40_000 },
                { compteId: 'c465', montant: 960_000 },
            ],
        });
        expect(r.avertissements.join(' ')).toContain('excèdent le bénéfice distribuable');
        expect(r.avertissements.join(' ')).toContain('dividende fictif (art. 144)');
        expect(r.avertissements.join(' ')).toContain('réserves statutaires');
    });
    it('ne crie pas au dividende fictif quand il tient dans le distribuable connu', async () => {
        const { svc } = service({ balance: benefice(1_000_000) });
        const r = await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 100_000 },
                { compteId: 'c465', montant: 900_000 },
            ],
        });
        expect(r.avertissements.join(' ')).not.toContain('excèdent');
        expect(r.avertissements.join(' ')).toContain('réserves statutaires');
    });
    it('dit qu’une ligne au capital d’une SA est une augmentation de capital (art. 564)', async () => {
        const { svc } = service({ forme: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, balance: benefice(1_000_000) });
        const r = await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [
                { compteId: 'c111', montant: 100_000 },
                { compteId: 'c10', montant: 900_000 },
            ],
        });
        expect(r.avertissements.join(' ')).toContain('AUGMENTATION DE CAPITAL');
        expect(r.avertissements.join(' ')).toContain('art. 564');
    });
    it('sert l’avertissement du capital avant la saisie', async () => {
        const p = await service({ forme: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, balance: perte(1_000) }).svc.preparer('t1', 'ex2026');
        expect(p.avertissementCapital).toContain('art. 630');
    });
});
describe('Affectation · la forme juridique est celle de l’exercice (art. 182 et 183)', () => {
    const transformation = {
        anterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        date: new Date('2027-03-01'),
    };
    it('sert la réserve légale de l’ancienne forme à un exercice clos avant la transformation', async () => {
        const p = await service({
            forme: client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
            transformation,
            balance: benefice(1_000_000),
        }).svc.preparer('t1', 'ex2026');
        expect(p.formeJuridiqueSyscohada).toBe(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(p.reserveLegale.dotation).toBe(100_000);
    });
    it('une décision postérieure à la transformation n’est pas bloquée, elle est avertie', async () => {
        const { svc } = service({
            forme: client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
            transformation,
            balance: benefice(1_000_000),
        });
        const r = await svc.enregistrer('t1', 'u1', {
            ...DECISION,
            exerciceId: 'ex2026',
            lignes: [{ compteId: 'c121', montant: 1_000_000 }],
        });
        expect(r.avertissements.join(' ')).toContain('art. 182 à 184');
    });
    it('une décision antérieure à la transformation reste bloquée sous l’ancienne forme', async () => {
        const { svc } = service({
            forme: client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
            transformation: { ...transformation, date: new Date('2027-09-01') },
            balance: benefice(1_000_000),
        });
        await expect(svc.enregistrer('t1', 'u1', { ...DECISION, exerciceId: 'ex2026', lignes: [{ compteId: 'c121', montant: 1_000_000 }] })).rejects.toThrow(/NULLE/);
    });
});
describe('Affectation · la suppression ne retire que ce qui est ENCORE au brouillard', () => {
    function monter(compte) {
        const tx = {
            affectationResultat: { delete: jest.fn().mockResolvedValue({}) },
            ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
            ecriture: { deleteMany: jest.fn().mockResolvedValue({ count: compte }), delete: jest.fn() },
        };
        const prisma = {
            affectationResultat: {
                findFirst: jest.fn().mockResolvedValue({ id: 'a1', ecriture: { id: 'e-aff', statut: 'BROUILLARD', numeroPiece: 7 } }),
            },
            $transaction: jest.fn(async (fn) => fn(tx)),
        };
        return { svc: new affectation_service_1.AffectationService(prisma, {}), tx };
    }
    it('au brouillard · la décision et son écriture partent, filtrées sur le statut', async () => {
        const { svc, tx } = monter(1);
        await expect(svc.supprimer('t1', 'a1')).resolves.toEqual({ supprime: true });
        expect(tx.ecriture.deleteMany).toHaveBeenCalledWith({ where: { id: 'e-aff', tenantId: 't1', statut: 'BROUILLARD' } });
        expect(tx.ligneEcriture.deleteMany).toHaveBeenCalledWith({
            where: { ecritureId: 'e-aff', ecriture: { tenantId: 't1', statut: 'BROUILLARD' } },
        });
        expect(tx.ecriture.delete).not.toHaveBeenCalled();
    });
    it('validée entre la lecture et la transaction · 409 nommé, rien ne part', async () => {
        const { svc } = monter(0);
        await expect(svc.supprimer('t1', 'a1')).rejects.toThrow(/pièce n° 7\) a été validée ou retirée pendant la suppression · rien n'est supprimé/);
    });
});
//# sourceMappingURL=affectation.spec.js.map