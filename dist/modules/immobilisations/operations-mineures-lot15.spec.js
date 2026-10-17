"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const immobilisation_controller_1 = require("./immobilisation.controller");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const immobilisation_service_1 = require("./immobilisation.service");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
const acquisition_prix_aleatoire_1 = require("./acquisition-prix-aleatoire");
const materiel_recupere_1 = require("./materiel-recupere");
const reserve_propriete_1 = require("./reserve-propriete");
const racineDepot = (0, node_path_1.join)(__dirname, '..', '..', '..');
function semis(chemin) {
    const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(racineDepot, chemin), 'utf8');
    const paires = new Map();
    for (const motif of [/['"]([0-9]{2,8})['"],\s*'([^']*)'/g, /['"]([0-9]{2,8})['"],\s*"([^"]*)"/g]) {
        let t;
        while ((t = motif.exec(source)) !== null)
            if (!paires.has(t[1]))
                paires.set(t[1], t[2]);
    }
    return paires;
}
const SYCEBNL = semis('src/modules/comptes/compte-seed.ts');
const SYSCOHADA = semis('src/modules/comptes/compte-seed-syscohada.ts');
describe('les comptes du lot se relisent dans les deux semis · un numéro, deux sens', () => {
    it('1681 « Rentes viagères capitalisées » au SYSCOHADA ; au SYCEBNL le 168 est un FONDS, et aucun 1681', () => {
        expect(SYSCOHADA.get('16810000')).toBe('Rentes viagères capitalisées');
        expect(SYCEBNL.get('16800000')).toBe('Autres fonds affectés');
        expect([...SYCEBNL.keys()].some((n) => n.startsWith('1681'))).toBe(false);
    });
    it('4811, 831 et 841 sont ouverts au SYSCOHADA sous les intitulés que le texte écrit', () => {
        expect(SYSCOHADA.get('48110000')).toBe('Immobilisations incorporelles');
        expect(SYSCOHADA.get('83100000')).toBe('Charges HAO constatées');
        expect(SYSCOHADA.get('84100000')).toBe('Produits HAO constatés');
        expect(acquisition_prix_aleatoire_1.COMPTES_PRIX_ALEATOIRE.RENTE_VIAGERE).toMatchObject({ dette: '1681', produitHao: '841' });
        expect(acquisition_prix_aleatoire_1.COMPTES_PRIX_ALEATOIRE.REDEVANCES).toMatchObject({ dette: '4811', produitHao: '841', chargeHao: '831' });
    });
    it('le stock provenant d’immobilisations · 388 au SYSCOHADA, 378 au SYCEBNL, dont le 38 est autre chose', () => {
        expect((0, materiel_recupere_1.compteStockRecupere)(client_1.Referentiel.SYSCOHADA).racine).toBe('388');
        expect((0, materiel_recupere_1.compteStockRecupere)(client_1.Referentiel.SYCEBNL).racine).toBe('378');
        expect(SYSCOHADA.get('38800000')).toMatch(/^Stock provenant d.immobilisations mises hors service ou au rebut$/);
        expect(SYCEBNL.get('37800000')).toMatch(/^Stock provenant d.immobilisations mises hors services? ou au rebut$/);
        expect(SYCEBNL.has('38800000')).toBe(false);
        expect(SYCEBNL.get('38100000')).toMatch(/^Dons en nature H\.A\.O\./);
    });
    it('le 4816 de la réserve de propriété est ouvert aux deux plans', () => {
        expect(SYSCOHADA.get('48160000')).toMatch(/^Réserve de propriété/);
        expect(SYCEBNL.get('48162000')).toMatch(/réserve de propriété \(corporelles\)/);
    });
});
describe('1 · rente viagère · règle pure', () => {
    const base = {
        referentiel: client_1.Referentiel.SYSCOHADA,
        nature: 'RENTE_VIAGERE',
        numeroCompteBien: '23130000',
        numeroCompteDette: '16810000',
        comptant: 110_000_000,
        numeroCompteComptant: '52110000',
        valeur: 350_000_000,
        fondement: client_1.FondementValeurAleatoire.PRIX_STIPULE,
        source: 'Acte de vente du 01/10/N',
    };
    it('Application 43 · bouquet en trésorerie puis 240 000 000 au 1681, dans cet ordre', () => {
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)(base)).toBeNull();
        expect((0, acquisition_prix_aleatoire_1.lignesCreditAleatoire)({ valeur: 350_000_000, comptant: 110_000_000, compteDetteId: 'c1681', compteComptantId: 'c521' })).toEqual([
            { compteId: 'c521', montant: 110_000_000 },
            { compteId: 'c1681', montant: 240_000_000 },
        ]);
    });
    it('Application 43, hypothèse 1 · décès après cinq rentes de 20 000 000 · 140 000 000 du 1681 au 841', () => {
        expect((0, acquisition_prix_aleatoire_1.soldeDetteAleatoire)({ nature: 'RENTE_VIAGERE', detteInitiale: 240_000_000, versementsCumules: 100_000_000 })).toEqual({
            cas: 'EXTINCTION',
            montant: 140_000_000,
            debiteLaDette: true,
            compteContrepartie: '841',
        });
    });
    it('Application 43, hypothèse 2 · la dette est éteinte par les douze rentes · rien à solder, le 831 se passe avec le paiement', () => {
        const r = (0, acquisition_prix_aleatoire_1.soldeDetteAleatoire)({ nature: 'RENTE_VIAGERE', detteInitiale: 240_000_000, versementsCumules: 240_000_000 });
        expect('motif' in r && r.motif).toMatch(/831/);
    });
    it('refus nommés · SYCEBNL (aucun 1681, le 168 est un fonds), dette hors 1681, fondement des redevances, source vide, bouquet total, bouquet hors trésorerie', () => {
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, referentiel: client_1.Referentiel.SYCEBNL })).toMatch(/aucun compte 1681.*Autres fonds/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, numeroCompteDette: '16860000' })).toMatch(/1681/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, fondement: client_1.FondementValeurAleatoire.REDEVANCES_ACTUALISEES })).toMatch(/stipulation de prix/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, source: '  ' })).toMatch(/d'où vient la valeur/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, comptant: 350_000_000 })).toMatch(/aucune rente/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, numeroCompteComptant: '40110000' })).toMatch(/trésorerie/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, comptant: 0, numeroCompteComptant: null })).toBeNull();
    });
});
describe('4 · écart sur redevances · règle pure', () => {
    const base = {
        referentiel: client_1.Referentiel.SYSCOHADA,
        nature: 'REDEVANCES',
        numeroCompteBien: '21210000',
        numeroCompteDette: '48110000',
        comptant: 50_000,
        numeroCompteComptant: '52110000',
        valeur: 112_170,
        fondement: client_1.FondementValeurAleatoire.REDEVANCES_ACTUALISEES,
        source: '25 000 × [1 − 1,10^−3] / 0,10',
    };
    it('Application 26 · 50 000 en banque, 62 170 au 4811', () => {
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)(base)).toBeNull();
        expect((0, acquisition_prix_aleatoire_1.lignesCreditAleatoire)({ valeur: 112_170, comptant: 50_000, compteDetteId: 'c4811', compteComptantId: 'c521' }).at(-1)).toEqual({
            compteId: 'c4811',
            montant: 62_170,
        });
    });
    it('Application 26 · versements 32 500 + 22 500 + 20 000 · excédent 12 830 au 831, crédité au 4811', () => {
        expect((0, acquisition_prix_aleatoire_1.soldeDetteAleatoire)({ nature: 'REDEVANCES', detteInitiale: 62_170, versementsCumules: 32_500 + 22_500 + 20_000 })).toEqual({
            cas: 'EXCEDENT',
            montant: 12_830,
            debiteLaDette: false,
            compteContrepartie: '831',
        });
    });
    it('insuffisance · le reste du 4811 au 841 ; égalité · aucun écart', () => {
        expect((0, acquisition_prix_aleatoire_1.soldeDetteAleatoire)({ nature: 'REDEVANCES', detteInitiale: 62_170, versementsCumules: 60_000 })).toEqual({
            cas: 'INSUFFISANCE',
            montant: 2_170,
            debiteLaDette: true,
            compteContrepartie: '841',
        });
        expect('motif' in (0, acquisition_prix_aleatoire_1.soldeDetteAleatoire)({ nature: 'REDEVANCES', detteInitiale: 62_170, versementsCumules: 62_170 })).toBe(true);
    });
    it('refus nommés · bien corporel, dette hors 4811, fondement de la rente, SYCEBNL', () => {
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, numeroCompteBien: '24410000' })).toMatch(/incorporelle \(21\)/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, numeroCompteDette: '48120000' })).toMatch(/4811/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, fondement: client_1.FondementValeurAleatoire.PRIX_STIPULE })).toMatch(/droits d'enregistrement/);
        expect((0, acquisition_prix_aleatoire_1.motifRefusAcquisitionAleatoire)({ ...base, referentiel: client_1.Referentiel.SYCEBNL })).toMatch(/pas transposée/);
    });
});
describe('3 · matériel récupéré · règle pure', () => {
    const base = {
        referentiel: client_1.Referentiel.SYSCOHADA,
        cession: false,
        projetDeveloppement: false,
        numeroCompteBien: '24110000',
        numeroCompteStock: '38800000',
        valeur: 1_000,
        valeurNetteComptable: 6_000,
        source: 'Estimation du ferrailleur',
    };
    it('admis au 388 (SYSCOHADA) et au 378 (SYCEBNL), jusqu’à la valeur nette', () => {
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)(base)).toBeNull();
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, valeur: 6_000 })).toBeNull();
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, referentiel: client_1.Referentiel.SYCEBNL, numeroCompteStock: '37800000' })).toBeNull();
    });
    it('refus · le 388 au SYCEBNL, le 378 au SYSCOHADA (chaque plan son numéro)', () => {
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, referentiel: client_1.Referentiel.SYCEBNL })).toMatch(/au 378/);
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, numeroCompteStock: '37800000' })).toMatch(/au 388/);
    });
    it('refus · cession, projet de développement, incorporel, source absente, valeur au-delà de la valeur nette', () => {
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, cession: true })).toMatch(/cession/);
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, projetDeveloppement: true })).toMatch(/fonds affecté/);
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, numeroCompteBien: '21210000' })).toMatch(/corporelles/);
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, source: '' })).toMatch(/d'où vient la valeur/);
        expect((0, materiel_recupere_1.motifRefusMaterielRecupere)({ ...base, valeur: 6_000.01 })).toMatch(/dépasse la valeur nette/);
    });
});
describe('2 · réserve de propriété · règle pure', () => {
    const d = (s) => new Date(s);
    it('une dette au 4816 porte la clause · la fiche ne peut pas dire le contraire', () => {
        expect((0, reserve_propriete_1.contrepartieAReserveDePropriete)('48160000')).toBe(true);
        expect((0, reserve_propriete_1.contrepartieAReserveDePropriete)('48162000')).toBe(true);
        expect((0, reserve_propriete_1.contrepartieAReserveDePropriete)('48120000')).toBe(false);
        expect((0, reserve_propriete_1.motifRefusReserveDePropriete)({ reserveDePropriete: false, leveeLe: null, dateAcquisition: d('2026-01-02'), numeroContrepartie: '48160000' })).toMatch(/Réserve de propriété/);
    });
    it('règlement final · jamais avant l’acquisition, jamais sans clause', () => {
        expect((0, reserve_propriete_1.motifRefusReserveDePropriete)({ reserveDePropriete: true, leveeLe: d('2025-12-31'), dateAcquisition: d('2026-01-02') })).toMatch(/précéder/);
        expect((0, reserve_propriete_1.motifRefusReserveDePropriete)({ reserveDePropriete: false, leveeLe: d('2026-06-01'), dateAcquisition: d('2026-01-02') })).toMatch(/frappé de la clause/);
        expect((0, reserve_propriete_1.motifRefusReserveDePropriete)({ reserveDePropriete: true, leveeLe: d('2026-06-01'), dateAcquisition: d('2026-01-02') })).toBeNull();
    });
    it('frappé à la date · acquis, pas sorti, règlement final pas encore intervenu (Application 39 · R/P du 02/01 au 01/06)', () => {
        const bien = { reserveDePropriete: true, reserveProprieteLeveeLe: d('2026-06-01'), dateAcquisition: d('2026-01-02'), dateSortie: null };
        expect((0, reserve_propriete_1.frappeDeReserveALaDate)(bien, d('2026-03-31'))).toBe(true);
        expect((0, reserve_propriete_1.frappeDeReserveALaDate)(bien, d('2026-12-31'))).toBe(false);
        expect((0, reserve_propriete_1.frappeDeReserveALaDate)({ ...bien, reserveProprieteLeveeLe: null }, d('2026-12-31'))).toBe(true);
        expect((0, reserve_propriete_1.frappeDeReserveALaDate)({ ...bien, reserveProprieteLeveeLe: null, dateSortie: d('2026-11-30') }, d('2026-12-31'))).toBe(false);
        expect((0, reserve_propriete_1.frappeDeReserveALaDate)({ ...bien, reserveDePropriete: false }, d('2026-03-31'))).toBe(false);
    });
    it('la porte refuse null sur la case, qui n’admet pas null en base (FacultatifNonNul)', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(immobilisation_dto_1.CreerImmobilisationDto, {
            designation: 'x',
            dateAcquisition: '2026-01-02',
            valeurOrigine: 1,
            exerciceId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
            reserveDePropriete: null,
        });
        const erreurs = await (0, class_validator_1.validate)(dto);
        expect(erreurs.some((e) => e.property === 'reserveDePropriete')).toBe(true);
    });
});
const EXERCICE = { id: 'ex2026', statut: 'OUVERT', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const COMPTES = {
    c521: '52110000',
    c4816: '48160000',
    c4812: '48120000',
    c1681: '16810000',
    c388: '38800000',
    c378: '37800000',
    cimmo: '24420000',
    cbat: '23130000',
    c4811: '48110000',
    c249: '24910000',
};
function harnais(options = {}) {
    const creations = [];
    const mises = [];
    const ecrituresPostees = [];
    const prisma = {
        familleImmobilisation: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'f1',
                estActif: true,
                compteImmobilisationId: 'cimmo',
                compteAmortissementId: 'camort',
                compteDotationId: 'cdot',
                dureeAmortissementAns: 5,
            }),
        },
        exercice: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.id === EXERCICE.id && where.tenantId === 't1' ? EXERCICE : null)),
            findMany: jest.fn(({ where } = {}) => Promise.resolve((options.exercicesClos ?? []).filter((e) => (!where?.dateFin?.gte || e.dateFin >= where.dateFin.gte) &&
                (!where?.dateFin?.lt || e.dateFin < where.dateFin.lt)))),
        },
        compte: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.tenantId === 't1' && COMPTES[where.id] ? { id: where.id, numero: COMPTES[where.id] } : null)),
            findUnique: jest.fn(({ where }) => Promise.resolve({ id: `n${where.tenantId_numero.numero}`, numero: where.tenantId_numero.numero })),
            findMany: jest.fn().mockResolvedValue([]),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: options.referentiel ?? client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
                jeuEtatsFinanciersSycebnl: null,
            }),
        },
        ligneEcriture: {
            findFirst: jest
                .fn()
                .mockResolvedValue(options.ligneDette === undefined
                ? { compteId: 'c1681', compte: { numero: '16810000' } }
                : options.ligneDette && { compte: { numero: COMPTES[options.ligneDette.compteId] ?? '' }, ...options.ligneDette }),
            aggregate: jest.fn().mockResolvedValue({ _sum: options.mouvementsDette ?? { debit: 0, credit: 1_000_000_000 } }),
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        ecriture: { delete: jest.fn().mockResolvedValue({}) },
        immobilisation: {
            create: jest.fn(({ data }) => {
                creations.push(data);
                return Promise.resolve({ ...data, id: 'i1', valeurOrigine: 0, valeurResiduelle: 0, prixCession: null, dotations: [] });
            }),
            findFirst: jest.fn().mockResolvedValue(options.immo ?? null),
            findMany: jest.fn().mockResolvedValue(options.biensReserve ?? []),
            aggregate: jest.fn().mockResolvedValue({ _sum: { valeurOrigine: 0 } }),
            count: jest.fn().mockResolvedValue(0),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn(({ data }) => {
                mises.push(data);
                return Promise.resolve({ ...(options.immo ?? {}), ...data, valeurOrigine: 0, valeurResiduelle: 0, prixCession: null, dotations: [] });
            }),
        },
        dotationAmortissement: { create: jest.fn().mockResolvedValue({ id: 'dot1' }), delete: jest.fn() },
        ligneReevaluationBilan: { findMany: jest.fn().mockResolvedValue([]) },
    };
    let n = 0;
    const ecritures = {
        creer: jest.fn((_t, _u, dto) => {
            n += 1;
            ecrituresPostees.push(dto);
            return Promise.resolve({ id: `e${n}` });
        }),
    };
    return { prisma, svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures), creations, mises, ecrituresPostees };
}
const ACQUIS = {
    familleId: 'f1',
    designation: 'Matériel industriel',
    dateAcquisition: '2026-01-02',
    valeurOrigine: 50_000_000,
    exerciceId: 'ex2026',
    journalId: 'j1',
};
describe('2 · câblage de la réserve de propriété à la création', () => {
    it('une dette au 4816 pose la clause sur la fiche quand rien n’est dit (Application 39)', async () => {
        const { svc, creations } = harnais();
        await svc.creer('t1', 'u1', { ...ACQUIS, compteContrepartieId: 'c4816' });
        expect(creations[0].reserveDePropriete).toBe(true);
    });
    it('une dette ordinaire laisse la case à faux, la déclaration la pose', async () => {
        const ordinaire = harnais();
        await ordinaire.svc.creer('t1', 'u1', { ...ACQUIS, compteContrepartieId: 'c4812' });
        expect(ordinaire.creations[0].reserveDePropriete).toBe(false);
        const declaree = harnais();
        await declaree.svc.creer('t1', 'u1', { ...ACQUIS, compteContrepartieId: 'c4812', reserveDePropriete: true });
        expect(declaree.creations[0].reserveDePropriete).toBe(true);
    });
    it('une dette au 4816 déclarée sans clause est refusée AVANT l’écriture d’acquisition', async () => {
        const { svc, creations, ecrituresPostees } = harnais();
        await expect(svc.creer('t1', 'u1', { ...ACQUIS, compteContrepartieId: 'c4816', reserveDePropriete: false })).rejects.toThrow(/Réserve de propriété/);
        expect(ecrituresPostees).toHaveLength(0);
        expect(creations).toHaveLength(0);
    });
    it('la liste des biens frappés est bornée au dossier et filtre la clause, la sortie et le règlement final', async () => {
        const { svc, prisma } = harnais();
        const r = await svc.biensSousReserveDePropriete('t1', 'ex2026');
        const where = prisma.immobilisation.findMany.mock.calls[0][0].where;
        expect(where).toMatchObject({ tenantId: 't1', reserveDePropriete: true, dateAcquisition: { lte: EXERCICE.dateFin } });
        expect(JSON.stringify(where)).toMatch(/reserveProprieteLeveeLe/);
        expect(JSON.stringify(where)).toMatch(/dateSortie/);
        expect(r.source).toMatch(/AUDCIF, Titre VIII ch\. 9 § 3/);
    });
    it('un bien encore EN COURS à la clôture figure à son compte en cours, jamais au compte définitif', async () => {
        const commun = {
            designation: 'Entrepôt',
            dateAcquisition: new Date('2026-02-01'),
            dateSortie: null,
            valeurOrigine: 1000,
            reserveDePropriete: true,
            reserveProprieteLeveeLe: null,
            compteImmobilisationId: 'cdef',
            compteEnCoursId: 'cec',
            compteImmobilisation: { id: 'cdef', numero: '23110000' },
            compteEnCours: { id: 'cec', numero: '23900000' },
        };
        const { svc } = harnais({
            biensReserve: [
                { ...commun, id: 'enCours', dateMiseEnService: null },
                { ...commun, id: 'misEnService', dateMiseEnService: new Date('2026-06-01') },
            ],
        });
        const r = await svc.biensSousReserveDePropriete('t1', 'ex2026');
        expect(r.biens.find((b) => b.id === 'enCours')?.compte).toBe('23900000');
        expect(r.biens.find((b) => b.id === 'misEnService')?.compte).toBe('23110000');
    });
});
describe('1 et 4 · câblage de l’acquisition à prix aléatoire', () => {
    it('la rente viagère passe par `creer` avec bouquet et 1681 en lignes de crédit, et garde la dette capitalisée', async () => {
        const { svc } = harnais();
        const creer = jest.spyOn(svc, 'creer').mockResolvedValue({ id: 'i1' });
        await svc.acquerirAPrixAleatoire('t1', 'u1', {
            nature: 'RENTE_VIAGERE',
            compteImmobilisationId: 'cbat',
            designation: 'Immeuble',
            dateAcquisition: '2026-10-01',
            valeurOrigine: 350_000_000,
            fondement: client_1.FondementValeurAleatoire.PRIX_STIPULE,
            sourceValeur: 'Acte du 01/10/2026',
            compteDetteId: 'c1681',
            comptant: 110_000_000,
            compteComptantId: 'c521',
            exerciceId: 'ex2026',
            journalId: 'j1',
        });
        const interne = creer.mock.calls[0][3];
        expect(interne.lignesCredit).toEqual([
            { compteId: 'c521', montant: 110_000_000 },
            { compteId: 'c1681', montant: 240_000_000 },
        ]);
        expect(interne.acquisitionAleatoire).toMatchObject({ nature: 'RENTE_VIAGERE', detteInitiale: 240_000_000 });
    });
    it('au SYCEBNL, refus nommé avant toute fiche', async () => {
        const { svc } = harnais({ referentiel: client_1.Referentiel.SYCEBNL });
        const creer = jest.spyOn(svc, 'creer');
        await expect(svc.acquerirAPrixAleatoire('t1', 'u1', {
            nature: 'RENTE_VIAGERE',
            compteImmobilisationId: 'cbat',
            designation: 'Immeuble',
            dateAcquisition: '2026-10-01',
            valeurOrigine: 350_000_000,
            fondement: client_1.FondementValeurAleatoire.PRIX_STIPULE,
            sourceValeur: 'Acte',
            compteDetteId: 'c1681',
            exerciceId: 'ex2026',
            journalId: 'j1',
        })).rejects.toThrow(/aucun compte 1681/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('`creer` porte nature, fondement, source et dette capitalisée sur la fiche', async () => {
        const { svc, creations } = harnais();
        await svc.creer('t1', 'u1', ACQUIS, {
            lignesCredit: [{ compteId: 'c1681', montant: 50_000_000 }],
            acquisitionAleatoire: {
                nature: 'RENTE_VIAGERE',
                fondement: client_1.FondementValeurAleatoire.PRIX_STIPULE,
                source: 'prix stipulé au contrat · acte',
                detteInitiale: 50_000_000,
            },
        });
        expect(creations[0]).toMatchObject({
            natureAcquisitionAleatoire: 'RENTE_VIAGERE',
            fondementValeurAleatoire: 'PRIX_STIPULE',
            detteAleatoireInitiale: 50_000_000,
        });
    });
});
describe('1 et 4 · câblage du solde de la dette', () => {
    const bienViager = {
        id: 'i1',
        designation: 'Immeuble',
        statut: 'EN_SERVICE',
        dateAcquisition: new Date('2026-01-02'),
        natureAcquisitionAleatoire: 'RENTE_VIAGERE',
        detteAleatoireInitiale: 240_000_000,
        ecritureAcquisitionId: 'eAcq',
        ecritureSoldeDetteAleatoireId: null,
        compteImmobilisation: { numero: '23130000' },
        dotations: [],
        depreciations: [],
    };
    const dto = {
        exerciceId: 'ex2026',
        journalId: 'j1',
        date: '2026-12-15',
        versementsCumules: 100_000_000,
        sourceVersements: 'Relevés bancaires',
    };
    it('décès · D 1681 / C 841 pour le reste de la dette, l’écriture retenue sur la fiche', async () => {
        const { svc, ecrituresPostees, mises, prisma } = harnais({ immo: bienViager });
        await svc.solderDetteAleatoire('t1', 'u1', 'i1', dto);
        expect(ecrituresPostees[0].lignes).toEqual([
            { compteId: 'c1681', debit: 140_000_000, credit: 0 },
            { compteId: 'n84100000', debit: 0, credit: 140_000_000 },
        ]);
        expect(mises[0]).toMatchObject({ ecritureSoldeDetteAleatoireId: 'e1', versementsDetteAleatoire: 100_000_000 });
        const where = prisma.ligneEcriture.findFirst.mock.calls[0][0].where;
        expect(where).toMatchObject({ ecritureId: 'eAcq', compte: { numero: { startsWith: '1681' } } });
    });
    it('redevances · excédent D 831 / C 4811 (Application 26)', async () => {
        const { svc, ecrituresPostees } = harnais({
            immo: { ...bienViager, natureAcquisitionAleatoire: 'REDEVANCES', detteAleatoireInitiale: 62_170 },
            ligneDette: { compteId: 'c4811' },
        });
        await svc.solderDetteAleatoire('t1', 'u1', 'i1', { ...dto, versementsCumules: 75_000 });
        expect(ecrituresPostees[0].lignes).toEqual([
            { compteId: 'n83100000', debit: 12_830, credit: 0 },
            { compteId: 'c4811', debit: 0, credit: 12_830 },
        ]);
    });
    it('refus · bien ordinaire, dette déjà soldée, date hors exercice, dette introuvable', async () => {
        await expect(harnais({ immo: { ...bienViager, natureAcquisitionAleatoire: null } }).svc.solderDetteAleatoire('t1', 'u1', 'i1', dto)).rejects.toThrow(/pas de dette aléatoire/);
        await expect(harnais({ immo: { ...bienViager, ecritureSoldeDetteAleatoireId: 'eX' } }).svc.solderDetteAleatoire('t1', 'u1', 'i1', dto)).rejects.toThrow(/déjà soldée/);
        await expect(harnais({ immo: bienViager }).svc.solderDetteAleatoire('t1', 'u1', 'i1', { ...dto, date: '2027-01-02' })).rejects.toThrow(/dans l'exercice/);
        const sansDette = harnais({ immo: bienViager, ligneDette: null });
        await expect(sansDette.svc.solderDetteAleatoire('t1', 'u1', 'i1', dto)).rejects.toThrow(/introuvable/);
        expect(sansDette.ecrituresPostees).toHaveLength(0);
    });
});
describe('1 et 4 · l’extinction se borne au solde du compte de dette (relecture du lot 15a, § 10 bis)', () => {
    const bienViager = {
        id: 'i1',
        designation: 'Immeuble',
        statut: 'EN_SERVICE',
        dateAcquisition: new Date('2026-01-02'),
        natureAcquisitionAleatoire: 'RENTE_VIAGERE',
        detteAleatoireInitiale: 240_000_000,
        ecritureAcquisitionId: 'eAcq',
        ecritureSoldeDetteAleatoireId: null,
        compteImmobilisation: { numero: '23130000' },
        dotations: [],
        depreciations: [],
    };
    const dto = { exerciceId: 'ex2026', journalId: 'j1', date: '2026-12-15', versementsCumules: 100_000_000, sourceVersements: 'Relevés' };
    it('cumul déclaré trop bas · l’extinction (140 000 000) dépasse le solde du 1681 (120 000 000) · refus nommé, rien posté', async () => {
        const { svc, ecrituresPostees, mises } = harnais({ immo: bienViager, mouvementsDette: { credit: 240_000_000, debit: 120_000_000 } });
        await expect(svc.solderDetteAleatoire('t1', 'u1', 'i1', dto)).rejects.toThrow(/compte 16810000 .*ne porte plus que 120000000\.00 au crédit/);
        expect(ecrituresPostees).toHaveLength(0);
        expect(mises).toHaveLength(0);
    });
    it('le solde est lu sur tous les exercices jusqu’à la date, à-nouveaux exclus, au seul compte que l’acquisition a crédité', async () => {
        const { svc, prisma } = harnais({ immo: bienViager, mouvementsDette: { credit: 240_000_000, debit: 100_000_000 } });
        await svc.solderDetteAleatoire('t1', 'u1', 'i1', dto);
        const where = prisma.ligneEcriture.aggregate.mock.calls[0][0].where;
        expect(where).toEqual({
            compteId: 'c1681',
            ecriture: {
                tenantId: 't1',
                date: { lte: new Date('2026-12-15') },
                estGenereeParCloture: false,
                estANouveauProvisoire: false,
                statut: { not: 'SITUATION' },
            },
        });
    });
    it('un écart au 831 (excédent de redevances) crédite la dette · aucune borne', async () => {
        const { svc, ecrituresPostees } = harnais({
            immo: { ...bienViager, natureAcquisitionAleatoire: 'REDEVANCES', detteAleatoireInitiale: 62_170 },
            ligneDette: { compteId: 'c4811' },
            mouvementsDette: { credit: 0, debit: 0 },
        });
        await svc.solderDetteAleatoire('t1', 'u1', 'i1', { ...dto, versementsCumules: 75_000 });
        expect(ecrituresPostees).toHaveLength(1);
    });
});
describe('2 · la réserve de propriété ne se déclare ni sur un bien sorti ni sur un exercice clos (relecture du lot 15a)', () => {
    const presse = {
        id: 'i1',
        designation: 'Presse',
        statut: 'EN_SERVICE',
        dateAcquisition: new Date('2025-03-01'),
        dateSortie: null,
        reserveDePropriete: false,
        reserveProprieteLeveeLe: null,
        ecritureAcquisitionId: null,
        dotations: [],
    };
    it('bien sorti · refus, rien écrit', async () => {
        const { svc, mises } = harnais({ immo: { ...presse, statut: 'SORTI', dateSortie: new Date('2026-05-01') } });
        await expect(svc.declarerReservePropriete('t1', 'i1', { reserveDePropriete: true })).rejects.toThrow(/est sorti/);
        expect(mises).toHaveLength(0);
    });
    it('déclarer la clause d’un bien acquis en 2025 quand 2025 est clos · refus, la liste publiée ne change pas', async () => {
        const { svc, mises } = harnais({ immo: presse, exercicesClos: [{ dateFin: new Date('2025-12-31') }] });
        await expect(svc.declarerReservePropriete('t1', 'i1', { reserveDePropriete: true })).rejects.toThrow(/2025-12-31/);
        expect(mises).toHaveLength(0);
    });
    it('un exercice clos ANTÉRIEUR à l’acquisition ne bloque rien · admise', async () => {
        const { svc, mises } = harnais({ immo: presse, exercicesClos: [{ dateFin: new Date('2024-12-31') }] });
        await svc.declarerReservePropriete('t1', 'i1', { reserveDePropriete: true });
        expect(mises[0]).toMatchObject({ reserveDePropriete: true });
    });
    it('une levée datée dans l’exercice ouvert ne touche pas l’exercice clos · admise', async () => {
        const { svc, mises } = harnais({
            immo: { ...presse, reserveDePropriete: true },
            exercicesClos: [{ dateFin: new Date('2025-12-31') }],
        });
        await svc.declarerReservePropriete('t1', 'i1', { reserveDePropriete: true, leveeLe: '2026-06-01' });
        expect(mises[0]).toMatchObject({ reserveDePropriete: true, reserveProprieteLeveeLe: new Date('2026-06-01') });
    });
});
describe('3 · câblage du matériel récupéré à la sortie', () => {
    const bien = (numero = '24410000') => ({
        id: 'i1',
        designation: 'Presse',
        statut: 'EN_SERVICE',
        valeurOrigine: 12_000,
        valeurResiduelle: 0,
        dureeAmortissementAns: 5,
        dateMiseEnService: new Date('2024-01-01'),
        dateAcquisition: new Date('2023-06-01'),
        amortissementAnterieur: 0,
        amortissementsDetaches: 0,
        reprisesAmortissement: 0,
        modeAmortissement: 'LINEAIRE',
        compteImmobilisationId: 'cimmo',
        compteImmobilisation: { id: 'cimmo', numero, intitule: 'Matériel industriel' },
        compteDotationId: 'cd',
        compteAmortissementId: 'ca',
        dotations: [2_400, 2_400].map((m, i) => ({ montant: m, exerciceId: `exAnt${i}` })),
        depreciations: [],
    });
    const sortie = {
        dateSortie: '2026-06-30',
        type: 'MISE_HORS_SERVICE',
        exerciceId: 'ex2026',
        journalId: 'j1',
        valeurMaterielRecupere: 1_000,
        compteStockRecupereId: 'c388',
        sourceMaterielRecupere: 'Estimation du ferrailleur',
    };
    it('D 388 pour la valeur récupérée, D 81 pour le reste de la valeur nette, la reprise gardée sur la fiche', async () => {
        const { svc, ecrituresPostees, mises } = harnais({ immo: bien() });
        await svc.sortir('t1', 'u1', 'i1', sortie);
        const e = ecrituresPostees.find((x) => x.libelle.startsWith('Mise hors service'));
        expect(e.lignes).toEqual([
            { compteId: 'cimmo', debit: 0, credit: 12_000 },
            { compteId: 'ca', debit: 6_000, credit: 0 },
            { compteId: 'c388', debit: 1_000, credit: 0 },
            { compteId: 'n81200000', debit: 5_000, credit: 0 },
        ]);
        expect(mises.at(-1)).toMatchObject({ valeurMaterielRecupere: 1_000, sourceMaterielRecupere: 'Estimation du ferrailleur' });
    });
    it('refusé au-delà de la valeur nette et sur un compte d’un autre plan, AVANT le verrou du statut', async () => {
        const trop = harnais({ immo: bien() });
        await expect(trop.svc.sortir('t1', 'u1', 'i1', { ...sortie, valeurMaterielRecupere: 6_500 })).rejects.toThrow(/dépasse/);
        expect(trop.prisma.immobilisation.updateMany).not.toHaveBeenCalled();
        const autrePlan = harnais({ immo: bien() });
        await expect(autrePlan.svc.sortir('t1', 'u1', 'i1', { ...sortie, compteStockRecupereId: 'c378' })).rejects.toThrow(/au 388/);
        expect(autrePlan.ecrituresPostees).toHaveLength(0);
    });
    it('BIEN EN COURS · la sortie crédite le compte où le bien est INSCRIT (249), jamais son compte définitif', async () => {
        const enCours = {
            ...bien('24110000'),
            dateMiseEnService: null,
            dotations: [],
            compteEnCoursId: 'c249',
            compteEnCours: { id: 'c249', numero: '24910000', intitule: 'Matériel et outillage industriel et commercial en cours' },
        };
        const { svc, ecrituresPostees } = harnais({ immo: enCours });
        await svc.sortir('t1', 'u1', 'i1', sortie);
        const e = ecrituresPostees.find((x) => x.libelle.startsWith('Mise hors service'));
        expect(e.lignes[0]).toEqual({ compteId: 'c249', debit: 0, credit: 12_000 });
        expect(e.lignes.some((l) => l.compteId === 'cimmo')).toBe(false);
        expect(e.lignes).toContainEqual({ compteId: 'c388', debit: 1_000, credit: 0 });
    });
    it('sans matériel récupéré, la sortie reste celle d’avant · toute la valeur nette au 81', async () => {
        const { svc, ecrituresPostees } = harnais({ immo: bien() });
        await svc.sortir('t1', 'u1', 'i1', { dateSortie: '2026-06-30', type: 'MISE_HORS_SERVICE', exerciceId: 'ex2026', journalId: 'j1' });
        const e = ecrituresPostees.find((x) => x.libelle.startsWith('Mise hors service'));
        expect(e.lignes.at(-1)).toEqual({ compteId: 'n81200000', debit: 6_000, credit: 0 });
    });
});
describe('les routes du lot · cloisonnées au SYSCOHADA là où un seul texte écrit la règle, et réservées à qui écrit', () => {
    const meta = (cle, methode) => Reflect.getMetadata(cle, immobilisation_controller_1.ImmobilisationController.prototype[methode]);
    it('prix aléatoire et solde de la dette · SYSCOHADA seul (AUDCIF Titre VIII ch. 11 § 2 et ch. 2 § 11)', () => {
        expect(meta(referentiels_decorator_1.REFERENTIELS_KEY, 'acquerirAPrixAleatoire')).toEqual([client_1.Referentiel.SYSCOHADA]);
        expect(meta(referentiels_decorator_1.REFERENTIELS_KEY, 'solderDetteAleatoire')).toEqual([client_1.Referentiel.SYSCOHADA]);
    });
    it('réserve de propriété et matériel récupéré · aux deux référentiels', () => {
        expect(meta(referentiels_decorator_1.REFERENTIELS_KEY, 'declarerReservePropriete')).toBeUndefined();
        expect(meta(referentiels_decorator_1.REFERENTIELS_KEY, 'biensSousReserveDePropriete')).toBeUndefined();
        expect(meta(referentiels_decorator_1.REFERENTIELS_KEY, 'comptesMaterielRecupere')).toBeUndefined();
    });
    it('chaque écriture du lot porte @Roles', () => {
        for (const m of ['acquerirAPrixAleatoire', 'solderDetteAleatoire', 'declarerReservePropriete']) {
            expect(meta(roles_decorator_1.ROLES_KEY, m)).toEqual([client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE]);
        }
    });
});
//# sourceMappingURL=operations-mineures-lot15.spec.js.map