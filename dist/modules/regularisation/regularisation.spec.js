"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const regularisation_service_1 = require("./regularisation.service");
const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
describe('prorata de la part différée', () => {
    const finExercice = d('2026-12-31');
    it('ne diffère rien quand la période finit avant la clôture', () => {
        expect(regularisation_service_1.RegularisationService.prorataDiffere(1_200_000, d('2026-01-01'), d('2026-06-30'), finExercice)).toBe(0);
    });
    it('diffère tout quand la période commence après la clôture', () => {
        expect(regularisation_service_1.RegularisationService.prorataDiffere(1_200_000, d('2027-01-01'), d('2027-12-31'), finExercice)).toBe(1_200_000);
    });
    it('coupe une année civile décalée au prorata des jours', () => {
        const differe = regularisation_service_1.RegularisationService.prorataDiffere(365_000, d('2026-07-01'), d('2027-06-30'), finExercice);
        expect(differe).toBeCloseTo(181_000, 0);
    });
    it('compte les bornes des deux côtés', () => {
        expect(regularisation_service_1.RegularisationService.prorataDiffere(310_000, d('2026-12-01'), d('2026-12-31'), finExercice)).toBe(0);
        expect(regularisation_service_1.RegularisationService.prorataDiffere(200, d('2026-12-31'), d('2027-01-01'), finExercice)).toBe(100);
    });
    it('renvoie zéro sur une période vide ou inversée', () => {
        expect(regularisation_service_1.RegularisationService.prorataDiffere(1000, d('2026-06-30'), d('2026-06-01'), finExercice)).toBe(0);
    });
});
describe('échéancier d’abonnement', () => {
    it('mensuel sur un an : douze échéances', () => {
        const dates = regularisation_service_1.RegularisationService.echeancesDe(d('2026-01-15'), d('2026-12-31'), client_1.PeriodiciteAbonnement.MENSUELLE);
        expect(dates).toHaveLength(12);
        expect(dates[0].toISOString().slice(0, 10)).toBe('2026-01-15');
        expect(dates[11].toISOString().slice(0, 10)).toBe('2026-12-15');
    });
    it('mensuel né un 31 janvier : février a son échéance, et mars revient au 31', () => {
        const dates = regularisation_service_1.RegularisationService.echeancesDe(d('2026-01-31'), d('2026-12-31'), client_1.PeriodiciteAbonnement.MENSUELLE);
        expect({ nombre: dates.length, premieres: dates.slice(0, 4).map((x) => x.toISOString().slice(0, 10)) }).toEqual({
            nombre: 12,
            premieres: ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
        });
    });
    it('trimestriel sur un an : quatre échéances', () => {
        const dates = regularisation_service_1.RegularisationService.echeancesDe(d('2026-01-01'), d('2026-12-31'), client_1.PeriodiciteAbonnement.TRIMESTRIELLE);
        expect(dates.map((x) => x.toISOString().slice(0, 10))).toEqual([
            '2026-01-01',
            '2026-04-01',
            '2026-07-01',
            '2026-10-01',
        ]);
    });
    it('annuel sur trois ans : trois échéances', () => {
        const dates = regularisation_service_1.RegularisationService.echeancesDe(d('2026-03-01'), d('2028-12-31'), client_1.PeriodiciteAbonnement.ANNUELLE);
        expect(dates).toHaveLength(3);
    });
    it('ne produit aucune échéance si la fin précède le début', () => {
        expect(regularisation_service_1.RegularisationService.echeancesDe(d('2026-06-01'), d('2026-01-01'), client_1.PeriodiciteAbonnement.MENSUELLE)).toHaveLength(0);
    });
});
describe('abonnement · contrepartie de la charge', () => {
    const compte = (id, numero) => ({ id, numero, intitule: `Compte ${numero}` });
    function service(debit, credit, referentiel = 'SYCEBNL') {
        const prisma = {
            modeleAbonnement: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
            journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j', code: 'OD' }) },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel }) },
            compte: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.id === debit.id ? debit : credit)),
                findMany: jest.fn(async () => []),
            },
        };
        return { svc: new regularisation_service_1.RegularisationService(prisma, {}), prisma };
    }
    const dto = {
        code: 'LOYER',
        intitule: 'Loyer du siège',
        journalId: 'j',
        compteDebitId: 'd',
        compteCreditId: 'c',
        periodicite: client_1.PeriodiciteAbonnement.MENSUELLE,
        dateDebut: '2026-01-01',
        dateFin: '2026-12-31',
        montant: 300_000,
    };
    it('refuse D/622 par C/521, le cas relevé sur les abonnements', async () => {
        const { svc } = service(compte('d', '62210000'), compte('c', '52110000'));
        await expect(svc.creerAbonnement('t', 'u', dto)).rejects.toThrow(/directement sur la trésorerie/);
    });
    it('nomme la voie à suivre dans le message, pas seulement le refus', async () => {
        const { svc } = service(compte('d', '62210000'), compte('c', '57100000'));
        await expect(svc.creerAbonnement('t', 'u', dto)).rejects.toThrow(/compte fournisseur \(40\)/);
    });
    it('accepte le schéma du référentiel : la charge contre le tiers', async () => {
        const { svc, prisma } = service(compte('d', '62210000'), compte('c', '40110000'));
        prisma.modeleAbonnement.create.mockResolvedValue({ id: 'a' });
        await svc.creerAbonnement('t', 'u', dto);
        expect(prisma.modeleAbonnement.create).toHaveBeenCalled();
    });
    it('laisse intacts les abonnements qui ne portent aucune charge', async () => {
        const { svc, prisma } = service(compte('d', '48600000'), compte('c', '52110000'));
        prisma.modeleAbonnement.create.mockResolvedValue({ id: 'a' });
        await svc.creerAbonnement('t', 'u', dto);
        expect(prisma.modeleAbonnement.create).toHaveBeenCalled();
    });
});
describe('Rattachement · le compte dépend de la nature du tiers ET du référentiel', () => {
    const CAP = client_1.TypeRegularisation.CHARGE_A_PAYER;
    const PAR = client_1.TypeRegularisation.PRODUIT_A_RECEVOIR;
    it('le 4181 du SYSCOHADA est la facture à établir · celui du SYCEBNL est l’appel de fonds', () => {
        expect(regularisation_service_1.RegularisationService.compteRattachement(client_1.Referentiel.SYSCOHADA, 'CLIENTS', PAR).racine).toBe('4181');
        expect(regularisation_service_1.RegularisationService.compteRattachement(client_1.Referentiel.SYCEBNL, 'CLIENTS', PAR).racine).toBe('4182');
    });
    it('les trois rattachements identiques le restent · personnel, organismes sociaux, État', () => {
        for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            expect(regularisation_service_1.RegularisationService.compteRattachement(referentiel, 'PERSONNEL', CAP).racine).toBe('4286');
            expect(regularisation_service_1.RegularisationService.compteRattachement(referentiel, 'PERSONNEL', PAR).racine).toBe('4287');
            expect(regularisation_service_1.RegularisationService.compteRattachement(referentiel, 'ORGANISMES_SOCIAUX', CAP).racine).toBe('4386');
            expect(regularisation_service_1.RegularisationService.compteRattachement(referentiel, 'ORGANISMES_SOCIAUX', PAR).racine).toBe('4387');
            expect(regularisation_service_1.RegularisationService.compteRattachement(referentiel, 'ETAT', CAP).racine).toBe('4486');
            expect(regularisation_service_1.RegularisationService.compteRattachement(referentiel, 'ETAT', PAR).racine).toBe('4487');
        }
    });
    it('une charge à payer sur fournisseur va au 408, des deux côtés', () => {
        for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            expect(regularisation_service_1.RegularisationService.compteRattachement(referentiel, 'FOURNISSEURS', CAP).racine).toBe('4081');
        }
    });
    it('refuse un produit à recevoir sur un fournisseur · le plan n’y prévoit aucun sous-compte', () => {
        expect(() => regularisation_service_1.RegularisationService.compteRattachement(client_1.Referentiel.SYSCOHADA, 'FOURNISSEURS', PAR)).toThrow(/créance sur fournisseur/);
    });
    it('refuse une charge à payer sur un client · une somme due à un client est une dette envers lui', () => {
        expect(() => regularisation_service_1.RegularisationService.compteRattachement(client_1.Referentiel.SYCEBNL, 'CLIENTS', CAP)).toThrow(/dette envers un client/);
    });
    it('aucun compte de rattachement ne sort de la classe 4', () => {
        const natures = ['FOURNISSEURS', 'CLIENTS', 'PERSONNEL', 'ORGANISMES_SOCIAUX', 'ETAT'];
        for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            for (const nature of natures) {
                for (const type of [CAP, PAR]) {
                    let racine = null;
                    try {
                        racine = regularisation_service_1.RegularisationService.compteRattachement(referentiel, nature, type).racine;
                    }
                    catch {
                        continue;
                    }
                    expect(racine.startsWith('4')).toBe(true);
                }
            }
        }
    });
});
describe('Rattachement · il ne se proratise pas', () => {
    it('le montant rattaché est le montant total · la charge est de cet exercice tout entière', () => {
        expect(regularisation_service_1.RegularisationService.montantRattache(client_1.TypeRegularisation.CHARGE_A_PAYER, 1_234_567.891)).toBe(1_234_567.89);
    });
    it('même quand la période se termine bien avant la clôture · c’est là que le prorata rendrait ZÉRO', () => {
        expect(regularisation_service_1.RegularisationService.prorataDiffere(900_000, d('2026-11-01'), d('2026-11-30'), d('2026-12-31'))).toBe(0);
        expect(regularisation_service_1.RegularisationService.montantRattache(client_1.TypeRegularisation.CHARGE_A_PAYER, 900_000)).toBe(900_000);
    });
});
describe('Rattachement · la contre-passation est à l’ouverture, des deux côtés', () => {
    const cible = { dateDebut: d('2027-01-01'), dateFin: d('2027-12-31') };
    it('une charge à payer et un produit à recevoir s’extournent à l’ouverture', () => {
        expect((0, regularisation_service_1.dateReprise)(client_1.TypeRegularisation.CHARGE_A_PAYER, cible)).toEqual(cible.dateDebut);
        expect((0, regularisation_service_1.dateReprise)(client_1.TypeRegularisation.PRODUIT_A_RECEVOIR, cible)).toEqual(cible.dateDebut);
    });
    it('le 476 et le 477 se reprennent à l’ouverture aussi, la subvention pluriannuelle seule à la fin', () => {
        expect((0, regularisation_service_1.dateReprise)(client_1.TypeRegularisation.CHARGE_CONSTATEE_AVANCE, cible)).toEqual(cible.dateDebut);
        expect((0, regularisation_service_1.dateReprise)(client_1.TypeRegularisation.PRODUIT_CONSTATE_AVANCE, cible)).toEqual(cible.dateDebut);
        expect((0, regularisation_service_1.dateReprise)(client_1.TypeRegularisation.SUBVENTION_PLURIANNUELLE, cible)).toEqual(cible.dateFin);
    });
});
describe('Rattachement · le sens s’inverse entre l’étalement et le rattachement', () => {
    it('une charge constatée d’avance CRÉDITE le 6x, une charge à payer le DÉBITE', () => {
        expect(regularisation_service_1.RegularisationService.debiteLeCompteDeGestion(client_1.TypeRegularisation.CHARGE_CONSTATEE_AVANCE)).toBe(false);
        expect(regularisation_service_1.RegularisationService.debiteLeCompteDeGestion(client_1.TypeRegularisation.CHARGE_A_PAYER)).toBe(true);
    });
    it('un produit constaté d’avance DÉBITE le 7x, un produit à recevoir le CRÉDITE', () => {
        expect(regularisation_service_1.RegularisationService.debiteLeCompteDeGestion(client_1.TypeRegularisation.PRODUIT_CONSTATE_AVANCE)).toBe(true);
        expect(regularisation_service_1.RegularisationService.debiteLeCompteDeGestion(client_1.TypeRegularisation.PRODUIT_A_RECEVOIR)).toBe(false);
    });
    it('la subvention pluriannuelle garde le sens du produit constaté d’avance', () => {
        expect(regularisation_service_1.RegularisationService.debiteLeCompteDeGestion(client_1.TypeRegularisation.SUBVENTION_PLURIANNUELLE)).toBe(true);
    });
    it('les cinq types sont couverts · un type ajouté sans décider de son sens fait tomber ce test', () => {
        const tous = Object.values(client_1.TypeRegularisation);
        expect(tous).toHaveLength(5);
        for (const type of tous)
            expect(typeof regularisation_service_1.RegularisationService.debiteLeCompteDeGestion(type)).toBe('boolean');
    });
});
describe('Reprise · l’inverse exact de la constatation, pour chaque type', () => {
    const CLASSE_GESTION = {
        CHARGE_CONSTATEE_AVANCE: 'CLASSE_6',
        CHARGE_A_PAYER: 'CLASSE_6',
        PRODUIT_CONSTATE_AVANCE: 'CLASSE_7',
        PRODUIT_A_RECEVOIR: 'CLASSE_7',
        SUBVENTION_PLURIANNUELLE: 'CLASSE_7',
    };
    const RATTACHEMENT = new Set([client_1.TypeRegularisation.CHARGE_A_PAYER, client_1.TypeRegularisation.PRODUIT_A_RECEVOIR]);
    function monde(type) {
        const exercices = {
            n: { id: 'n', statut: 'OUVERT', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') },
            n1: { id: 'n1', statut: 'OUVERT', dateDebut: d('2027-01-01'), dateFin: d('2027-12-31') },
            n0: { id: 'n0', statut: 'OUVERT', dateDebut: d('2025-01-01'), dateFin: d('2025-12-31') },
        };
        let enregistree = null;
        const ecritures = [];
        const prisma = {
            exercice: { findFirst: jest.fn(({ where }) => Promise.resolve(exercices[where.id] ?? null)) },
            compte: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.id === 'gestion'
                    ? { id: 'gestion', numero: CLASSE_GESTION[type] === 'CLASSE_6' ? '60500000' : '70100000', classe: CLASSE_GESTION[type] }
                    : ['4455', '4435'].includes(where.numero?.startsWith ?? '')
                        ? { id: 'tva', numero: `${where.numero.startsWith}0000`, classe: 'CLASSE_4' }
                        : { id: 'contrepartie', numero: '47600000', classe: 'CLASSE_4' })),
            },
            tenant: {
                findFirst: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }),
                findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }),
            },
            journal: { findMany: jest.fn().mockResolvedValue([{ id: 'od', code: 'OD', type: 'GENERAL' }]) },
            ecriture: {
                findFirst: jest.fn(({ where }) => {
                    const rang = Number(where.id.slice(1)) - 1;
                    return Promise.resolve(where.tenantId === 't1' && ecritures[rang] ? { lignes: ecritures[rang].lignes } : null);
                }),
            },
            regularisation: {
                create: jest.fn(({ data }) => {
                    enregistree = { id: 'r1', ecritureRepriseId: null, ...data };
                    return Promise.resolve(enregistree);
                }),
                findFirst: jest.fn(() => Promise.resolve(enregistree)),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                findFirstOrThrow: jest.fn().mockResolvedValue({}),
            },
        };
        const ecritureService = {
            creer: jest.fn((_t, _u, dto) => {
                ecritures.push(dto);
                return Promise.resolve({ id: `e${ecritures.length}` });
            }),
        };
        return { svc: new regularisation_service_1.RegularisationService(prisma, ecritureService), ecritures };
    }
    it.each(Object.values(client_1.TypeRegularisation))('%s · constatation plus reprise soldent chaque compte', async (type) => {
        const { svc, ecritures } = monde(type);
        await svc.creer('t1', 'u1', {
            exerciceId: 'n',
            type,
            libelle: 'Loyer',
            compteChargeProduitId: 'gestion',
            montantTotal: 1_200,
            periodeDebut: RATTACHEMENT.has(type) ? '2026-10-01' : '2026-07-01',
            periodeFin: RATTACHEMENT.has(type) ? '2026-12-31' : '2027-06-30',
            ...(RATTACHEMENT.has(type) ? { natureTiers: type === client_1.TypeRegularisation.CHARGE_A_PAYER ? 'FOURNISSEURS' : 'CLIENTS' } : {}),
        });
        await svc.reprendre('t1', 'u1', 'r1', 'n1');
        expect(ecritures).toHaveLength(2);
        const solde = {};
        for (const e of ecritures)
            for (const l of e.lignes)
                solde[l.compteId] = (solde[l.compteId] ?? 0) + (l.debit ?? 0) - (l.credit ?? 0);
        expect(ecritures[0].lignes.some((l) => (l.debit ?? 0) > 0)).toBe(true);
        expect(solde).toEqual({ gestion: 0, contrepartie: 0 });
    });
    it.each([
        [client_1.TypeRegularisation.CHARGE_A_PAYER, 'FOURNISSEURS', '44550000'],
        [client_1.TypeRegularisation.PRODUIT_A_RECEVOIR, 'CLIENTS', '44350000'],
    ])('%s · la TVA déclarée va au %s, le tiers porte le toutes taxes, et la reprise la contre-passe (passe R1, B4)', async (type, nature, compteTva) => {
        const { svc, ecritures } = monde(type);
        await svc.creer('t1', 'u1', {
            exerciceId: 'n',
            type,
            libelle: 'Électricité de décembre',
            compteChargeProduitId: 'gestion',
            montantTotal: 1_000,
            montantTva: 160,
            periodeDebut: '2026-12-01',
            periodeFin: '2026-12-31',
            natureTiers: nature,
        });
        const constatation = ecritures[0].lignes;
        const tva = constatation.find((l) => l.compteId === 'tva');
        const tiers = constatation.find((l) => l.compteId === 'contrepartie');
        expect(tva).toBeDefined();
        expect((tva.debit ?? 0) + (tva.credit ?? 0)).toBe(160);
        expect((tiers.debit ?? 0) + (tiers.credit ?? 0)).toBe(1_160);
        const gestion = constatation.find((l) => l.compteId === 'gestion');
        expect((gestion.debit ?? 0) + (gestion.credit ?? 0)).toBe(1_000);
        await svc.reprendre('t1', 'u1', 'r1', 'n1');
        const solde = {};
        for (const e of ecritures)
            for (const l of e.lignes)
                solde[l.compteId] = (solde[l.compteId] ?? 0) + (l.debit ?? 0) - (l.credit ?? 0);
        expect(solde).toEqual({ gestion: 0, contrepartie: 0, tva: 0 });
        expect(`${regularisation_service_1.RegularisationService.compteTvaRattachement(client_1.Referentiel.SYSCOHADA, nature, type)}0000`).toBe(compteTva);
    });
    it('la TVA est refusée là où la fiche ne la prévoit pas · ni au personnel, ni au SYCEBNL', async () => {
        expect(regularisation_service_1.RegularisationService.compteTvaRattachement(client_1.Referentiel.SYSCOHADA, 'PERSONNEL', client_1.TypeRegularisation.CHARGE_A_PAYER)).toBeNull();
        expect(regularisation_service_1.RegularisationService.compteTvaRattachement(client_1.Referentiel.SYCEBNL, 'FOURNISSEURS', client_1.TypeRegularisation.CHARGE_A_PAYER)).toBeNull();
        const { svc, ecritures } = monde(client_1.TypeRegularisation.CHARGE_A_PAYER);
        await expect(svc.creer('t1', 'u1', {
            exerciceId: 'n',
            type: client_1.TypeRegularisation.CHARGE_A_PAYER,
            libelle: 'Primes',
            compteChargeProduitId: 'gestion',
            montantTotal: 1_000,
            montantTva: 160,
            periodeDebut: '2026-12-01',
            periodeFin: '2026-12-31',
            natureTiers: 'PERSONNEL',
        })).rejects.toThrow(/4455/);
        expect(ecritures).toHaveLength(0);
    });
    it('la reprise est DATÉE par dateReprise · le 476 et le 477 à l’ouverture, la subvention à la fin', async () => {
        const cas = [
            [client_1.TypeRegularisation.CHARGE_CONSTATEE_AVANCE, '2027-01-01'],
            [client_1.TypeRegularisation.PRODUIT_CONSTATE_AVANCE, '2027-01-01'],
            [client_1.TypeRegularisation.SUBVENTION_PLURIANNUELLE, '2027-12-31'],
        ];
        for (const [type, attendue] of cas) {
            const { svc, ecritures } = monde(type);
            await svc.creer('t1', 'u1', {
                exerciceId: 'n',
                type,
                libelle: 'Loyer',
                compteChargeProduitId: 'gestion',
                montantTotal: 1_200,
                periodeDebut: '2026-07-01',
                periodeFin: '2027-06-30',
            });
            await svc.reprendre('t1', 'u1', 'r1', 'n1');
            expect([type, ecritures[1].date]).toEqual([type, attendue]);
        }
    });
    it('refuse la reprise sur le même exercice ou sur un exercice antérieur encore ouvert (audit final F79)', async () => {
        const { svc, ecritures } = monde(client_1.TypeRegularisation.CHARGE_CONSTATEE_AVANCE);
        await svc.creer('t1', 'u1', {
            exerciceId: 'n',
            type: client_1.TypeRegularisation.CHARGE_CONSTATEE_AVANCE,
            libelle: 'Loyer',
            compteChargeProduitId: 'gestion',
            montantTotal: 1_200,
            periodeDebut: '2026-07-01',
            periodeFin: '2027-06-30',
        });
        for (const cible of ['n0', 'n']) {
            await expect(svc.reprendre('t1', 'u1', 'r1', cible)).rejects.toThrow(/exercice ULTÉRIEUR/);
        }
        expect(ecritures).toHaveLength(1);
    });
});
describe('Simulation · le rattachement rend le montant entier et son compte', () => {
    function service() {
        const prisma = {
            exercice: {
                findFirst: jest.fn().mockResolvedValue({ id: 'n', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }),
            },
            tenant: { findFirst: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
            compte: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.tenantId === 't1' && where.numero.startsWith === '4081'
                    ? { id: 'c408', numero: '40810000', intitule: 'Fournisseurs, factures non parvenues' }
                    : null)),
            },
        };
        return new regularisation_service_1.RegularisationService(prisma, {});
    }
    const base = { exerciceId: 'n', libelle: 'Honoraires', compteChargeProduitId: 'c6', montantTotal: 900 };
    it('une charge à payer du dernier trimestre · 900 rattachés, sur le 4081', async () => {
        const r = await service().simuler('t1', {
            ...base,
            type: client_1.TypeRegularisation.CHARGE_A_PAYER,
            periodeDebut: '2026-10-01',
            periodeFin: '2026-12-31',
            natureTiers: 'FOURNISSEURS',
        });
        expect(r).toMatchObject({
            rattachement: true,
            montantDiffere: 900,
            montantExercice: 900,
            compteRattachement: { numero: '40810000' },
        });
    });
    it('sans nature du tiers, la simulation le demande comme la création', async () => {
        await expect(service().simuler('t1', { ...base, type: client_1.TypeRegularisation.CHARGE_A_PAYER, periodeDebut: '2026-10-01', periodeFin: '2026-12-31' })).rejects.toThrow(/nature du tiers est obligatoire/);
    });
    it('une charge constatée d’avance garde son prorata', async () => {
        const r = await service().simuler('t1', {
            ...base,
            type: client_1.TypeRegularisation.CHARGE_CONSTATEE_AVANCE,
            periodeDebut: '2026-07-01',
            periodeFin: '2027-06-30',
        });
        expect(r.rattachement).toBe(false);
        expect(r.montantDiffere).toBeGreaterThan(0);
        expect(r.montantDiffere).toBeLessThan(900);
        expect(r.compteRattachement).toBeNull();
    });
});
//# sourceMappingURL=regularisation.spec.js.map