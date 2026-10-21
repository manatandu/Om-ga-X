"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const assiettes_paie_1 = require("./assiettes-paie");
const rubriques_paie_1 = require("./rubriques-paie");
const avances_salaire_1 = require("./avances-salaire");
const avances_rubriques_service_1 = require("./avances-rubriques.service");
const passation_paie_1 = require("./passation-paie");
const cotisations_paie_1 = require("./cotisations-paie");
const comptabilisation_paie_1 = require("./comptabilisation-paie");
const personnel_service_1 = require("./personnel.service");
const SEMIS = (0, node_path_1.join)(__dirname, '..', 'comptes');
const SEMIS_SYCEBNL = (0, node_fs_1.readFileSync)((0, node_path_1.join)(SEMIS, 'compte-seed.ts'), 'utf8');
const SEMIS_SYSCOHADA = (0, node_fs_1.readFileSync)((0, node_path_1.join)(SEMIS, 'compte-seed-syscohada.ts'), 'utf8');
describe('rubriques de paie du cabinet · la rubrique nomme, la nature décide', () => {
    it("n'offre aucune des cinq exclusions de l'article 7, ni la participation aux bénéfices", () => {
        for (const n of assiettes_paie_1.HORS_REMUNERATION_ARTICLE_7)
            expect(rubriques_paie_1.NATURES_DES_RUBRIQUES).not.toContain(n);
        expect(rubriques_paie_1.NATURES_DES_RUBRIQUES).not.toContain('PARTICIPATION_AUX_BENEFICES');
        expect(rubriques_paie_1.NATURES_DES_RUBRIQUES).toContain('PRIME');
        expect(rubriques_paie_1.NATURES_DES_RUBRIQUES).toHaveLength(9);
    });
    it('refuse une prime baptisée transport, et une rubrique sans fondement', () => {
        const base = { code: 'PANC', libelle: "Prime d'ancienneté", nature: 'PRIME', fondement: 'CCE art. 12' };
        expect((0, rubriques_paie_1.motifRefusRubrique)(base)).toBeNull();
        expect((0, rubriques_paie_1.motifRefusRubrique)({ ...base, nature: 'INDEMNITE_DE_TRANSPORT' })).toMatch(/cinq exclusions/);
        expect((0, rubriques_paie_1.motifRefusRubrique)({ ...base, fondement: ' ' })).toMatch(/fondement/);
        expect((0, rubriques_paie_1.motifRefusRubrique)({ ...base, nature: 'PARTICIPATION_AUX_BENEFICES' })).toMatch(/refusée/);
    });
});
describe('avances et prêts · le compte que les deux plans écrivent', () => {
    it('avance au 4211, acompte au 4212, prêt au 272 selon sa catégorie', () => {
        expect((0, avances_salaire_1.compteDeLAvance)('AVANCE', null).compte).toBe('42110000');
        expect((0, avances_salaire_1.compteDeLAvance)('ACOMPTE', null).compte).toBe('42120000');
        expect((0, avances_salaire_1.compteDeLAvance)('PRET', 'IMMOBILIER').compte).toBe('27210000');
        expect((0, avances_salaire_1.compteDeLAvance)('PRET', 'MOBILIER_ET_INSTALLATION').compte).toBe('27220000');
        expect((0, avances_salaire_1.compteDeLAvance)('PRET', 'AUTRE').compte).toBe('27280000');
        expect(avances_salaire_1.LITTERA_ARTICLE_112).toEqual({ AVANCE: 'c', ACOMPTE: 'c', PRET: 'f', SAISIE_ARRET: 'g' });
    });
    it('chaque compte est RÉELLEMENT ouvert dans les deux semis', () => {
        const tous = [
            (0, avances_salaire_1.compteDeLAvance)('AVANCE', null),
            (0, avances_salaire_1.compteDeLAvance)('ACOMPTE', null),
            (0, avances_salaire_1.compteDeLAvance)('PRET', 'IMMOBILIER'),
            (0, avances_salaire_1.compteDeLAvance)('PRET', 'MOBILIER_ET_INSTALLATION'),
            (0, avances_salaire_1.compteDeLAvance)('PRET', 'AUTRE'),
            (0, avances_salaire_1.compteDeLAvance)('SAISIE_ARRET', null),
        ];
        for (const { compte } of tous) {
            expect(SEMIS_SYCEBNL).toContain(`'${compte}'`);
            expect(SEMIS_SYSCOHADA).toContain(`'${compte}'`);
        }
    });
    it('un prêt exige sa catégorie, une avance la refuse, la pièce est obligatoire', () => {
        const a = { type: 'AVANCE', montantFc: 100_000, objet: 'Rentrée scolaire', pieceJustificative: 'Reconnaissance du 02/09' };
        expect((0, avances_salaire_1.motifRefusAvance)(a)).toBeNull();
        expect((0, avances_salaire_1.motifRefusAvance)({ ...a, categoriePret: 'AUTRE' })).toMatch(/prêt/);
        expect((0, avances_salaire_1.motifRefusAvance)({ ...a, type: 'PRET' })).toMatch(/catégorie/);
        expect((0, avances_salaire_1.motifRefusAvance)({ ...a, pieceJustificative: '' })).toMatch(/pièce/);
        expect((0, avances_salaire_1.motifRefusAvance)({ ...a, retenueMensuelleFc: 200_000 })).toMatch(/dépasser/);
    });
    it("le solde ignore les retenues d'un bulletin annulé, et une retenue ne dépasse jamais le solde", () => {
        const solde = (0, avances_salaire_1.soldeAvance)(300_000, [
            { montantFc: 100_000, bulletinAnnule: false },
            { montantFc: 100_000, bulletinAnnule: true },
        ]);
        expect(solde).toBe(200_000);
        expect((0, avances_salaire_1.motifRefusRetenue)(200_000, solde, 'Avance')).toBeNull();
        expect((0, avances_salaire_1.motifRefusRetenue)(200_000.01, solde, 'Avance')).toMatch(/dépasse le solde/);
    });
});
describe("la retenue sur le bulletin vire le 422 vers le compte de l'avance", () => {
    const entree = (over = {}) => ({
        referentiel: 'SYCEBNL',
        elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 }],
        cotisations: [{ cle: 'cnss-pension-travailleur', charge: 'TRAVAILLEUR', montantFc: 50_000 }],
        abstentionsCotisations: [],
        irppFc: 100_000,
        netAPayerFc: (0, cotisations_paie_1.netAPayer)(1_000_000, 50_000, 100_000, 150_000).netAPayerFc,
        retenuesAvances: [
            { type: 'AVANCE', categoriePret: null, libelle: 'Avance', montantFc: 100_000 },
            { type: 'PRET', categoriePret: 'IMMOBILIER', libelle: 'Prêt', montantFc: 50_000 },
        ],
        ...over,
    });
    it('le net baisse des retenues, et le 422 solde exactement au net', () => {
        expect(entree().netAPayerFc).toBe(700_000);
        const v = (0, passation_paie_1.passationPaie)(entree());
        expect(v.refus).toEqual([]);
        expect(v.equilibree).toBe(true);
        const ligne = (compte) => v.lignes.find((l) => l.compte === compte && l.bloc === 'RETENUES');
        expect(ligne('42110000')).toMatchObject({ sens: 'CREDIT', montantFc: 100_000 });
        expect(ligne('27210000')).toMatchObject({ sens: 'CREDIT', montantFc: 50_000 });
        expect(ligne('42200000')).toMatchObject({ sens: 'DEBIT', montantFc: 300_000 });
    });
    it('une retenue oubliée par la passation est un refus, pas une écriture fausse', () => {
        const v = (0, passation_paie_1.passationPaie)(entree({ retenuesAvances: [] }));
        expect(v.refus.map((r) => r.motif)).toContain('ECRITURE_DESEQUILIBREE');
    });
    it('P9 relit les retenues figées sur le bulletin', () => {
        const e = (0, comptabilisation_paie_1.entreeDuBulletin)({
            id: 'b', numero: 1, nomComplet: 'X', statut: 'EMIS', ecritureId: null, netAPayerFc: 700_000,
            entree: { elements: entree().elements },
            calcul: {
                cotisations: { lignes: entree().cotisations, abstentions: [] },
                retenue: { retenueFc: 100_000 },
                net: { netAPayerFc: 700_000 },
                retenuesAvances: entree().retenuesAvances,
            },
        }, 'SYCEBNL');
        expect((0, passation_paie_1.passationPaie)(e).equilibree).toBe(true);
    });
});
describe('la saisie relue au serveur', () => {
    const avance = (over = {}) => ({
        id: 'av1', salarieId: 's1', type: 'PRET', categoriePret: 'AUTRE', dateOctroi: new Date('2026-09-01'),
        montantFc: 300_000, objet: 'Moto',
        retenues: [{ montantFc: 250_000, bulletin: { statut: 'EMIS' } }, { montantFc: 100_000, bulletin: { statut: 'ANNULE' } }], ...over,
    });
    const monter = (rubriques = [], avances = [avance()]) => new personnel_service_1.PersonnelService({
        rubriquePaie: { findMany: jest.fn(async () => rubriques) },
        avanceSalaire: { findMany: jest.fn(async () => avances) },
    });
    const dto = (over = {}) => ({ moisDePaie: '2026-10', elements: [{ nature: 'INDEMNITE_DE_TRANSPORT', libelle: '', montantFc: 10, rubriqueId: 'r1' }], ...over });
    it('la rubrique impose sa nature, quelle que soit celle que le client envoie', async () => {
        const s = monter([{ id: 'r1', code: 'PANC', libelle: "Prime d'ancienneté", nature: 'PRIME', actif: true }]);
        const r = await s.resoudreSaisie('t', null, dto());
        expect(r.dto.elements[0]).toMatchObject({ nature: 'PRIME', libelle: "Prime d'ancienneté" });
    });
    it('refuse une rubrique désactivée ou inconnue', async () => {
        await expect(monter([{ id: 'r1', code: 'X', libelle: 'X', nature: 'PRIME', actif: false }]).resoudreSaisie('t', null, dto())).rejects.toThrow(/désactivée/);
        await expect(monter([]).resoudreSaisie('t', null, dto())).rejects.toThrow(/introuvable/);
    });
    it("le type et la catégorie de la retenue viennent du registre, et le solde la borne", async () => {
        const base = { elements: [], retenuesAvances: [{ avanceId: 'av1', montantFc: 50_000 }] };
        const r = await monter().resoudreSaisie('t', 's1', dto(base));
        expect(r.retenuesAvances[0]).toMatchObject({ type: 'PRET', categoriePret: 'AUTRE', littera: 'f', soldeAvantFc: 50_000 });
        await expect(monter().resoudreSaisie('t', 's1', dto({ elements: [], retenuesAvances: [{ avanceId: 'av1', montantFc: 50_001 }] }))).rejects.toThrow(/dépasse le solde/);
    });
    it("refuse l'avance d'un autre salarié, et une retenue sans salarié", async () => {
        const base = { elements: [], retenuesAvances: [{ avanceId: 'av1', montantFc: 10 }] };
        await expect(monter().resoudreSaisie('t', 's2', dto(base))).rejects.toThrow(/salarié/);
        await expect(monter().resoudreSaisie('t', null, dto(base))).rejects.toThrow(/salarié/);
    });
});
describe('la saisie-arrêt notifiée · le registre, le bulletin et la passation', () => {
    const saisie = {
        type: 'SAISIE_ARRET',
        montantFc: 600_000,
        objet: 'Créance Banque X',
        pieceJustificative: 'Acte de saisie notifié',
        referenceActe: 'RH 1234/2026',
        greffe: 'Tripaix Gombe',
        destinataire: 'Greffe du Tripaix Gombe',
    };
    it('retient au 42320000 « Personnel, saisies-arrêts », au litera g) de l’article 112', () => {
        expect((0, avances_salaire_1.compteDeLAvance)('SAISIE_ARRET', null)).toEqual({ compte: '42320000', intitule: 'Personnel, saisies-arrêts' });
        expect(avances_salaire_1.LITTERA_ARTICLE_112.SAISIE_ARRET).toBe('g');
    });
    it('exige la référence de l’acte, le greffe et le destinataire, et les refuse à une avance', () => {
        expect((0, avances_salaire_1.motifRefusAvance)(saisie)).toBeNull();
        expect((0, avances_salaire_1.motifRefusAvance)({ ...saisie, referenceActe: ' ' })).toMatch(/référence de l'acte/);
        expect((0, avances_salaire_1.motifRefusAvance)({ ...saisie, greffe: '' })).toMatch(/greffe/);
        expect((0, avances_salaire_1.motifRefusAvance)({ ...saisie, destinataire: undefined })).toMatch(/art\. 188/);
        expect((0, avances_salaire_1.motifRefusAvance)({ ...saisie, categoriePret: 'AUTRE' })).toMatch(/prêt/);
        const avance = { type: 'AVANCE', montantFc: 100, objet: 'x', pieceJustificative: 'y' };
        expect((0, avances_salaire_1.motifRefusAvance)({ ...avance, referenceActe: 'RH 1' })).toMatch(/saisie-arrêt/);
    });
    it('ne mord que de la notification (art. 187) à la mainlevée (art. 201), mois entamés compris', () => {
        const notif = new Date('2026-09-15');
        expect((0, avances_salaire_1.motifRefusMoisSaisie)('2026-08', notif, null)).toMatch(/art\. 187/);
        expect((0, avances_salaire_1.motifRefusMoisSaisie)('2026-09', notif, null)).toBeNull();
        const fin = new Date('2026-11-10');
        expect((0, avances_salaire_1.motifRefusMoisSaisie)('2026-11', notif, fin)).toBeNull();
        expect((0, avances_salaire_1.motifRefusMoisSaisie)('2026-12', notif, fin)).toMatch(/art\. 201/);
    });
    it('la mainlevée se déclare une fois, jamais avant la notification, et sur une saisie seulement', () => {
        const a = { type: 'SAISIE_ARRET', dateOctroi: new Date('2026-09-15'), dateFin: null };
        expect((0, avances_salaire_1.motifRefusFinSaisie)(a, new Date('2026-12-01'))).toBeNull();
        expect((0, avances_salaire_1.motifRefusFinSaisie)(a, new Date('2026-09-01'))).toMatch(/précéder/);
        expect((0, avances_salaire_1.motifRefusFinSaisie)({ ...a, dateFin: new Date('2026-10-01') }, new Date('2026-12-01'))).toMatch(/déjà/);
        expect((0, avances_salaire_1.motifRefusFinSaisie)({ ...a, type: 'PRET' }, new Date('2026-12-01'))).toMatch(/Seule une saisie/);
    });
    it('confronte la retenue à la quotité, sans la refuser (art. 188)', () => {
        expect((0, avances_salaire_1.reserveQuotiteSaisies)(0, 10)).toBeNull();
        expect((0, avances_salaire_1.reserveQuotiteSaisies)(100, 100)).toBeNull();
        expect((0, avances_salaire_1.reserveQuotiteSaisies)(100.01, 100)).toMatch(/dépasse la quotité/);
        expect((0, avances_salaire_1.reserveQuotiteSaisies)(100, null)).toMatch(/pas chiffrée/);
    });
    it('la passation vire le 422 au 42320000, et le 422 solde au net', () => {
        const v = (0, passation_paie_1.passationPaie)({
            referentiel: 'SYSCOHADA',
            elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 }],
            cotisations: [],
            abstentionsCotisations: [],
            irppFc: 0,
            netAPayerFc: (0, cotisations_paie_1.netAPayer)(1_000_000, 0, 0, 120_000).netAPayerFc,
            retenuesAvances: [{ type: 'SAISIE_ARRET', categoriePret: null, libelle: 'Saisie', montantFc: 120_000 }],
        });
        expect(v.equilibree).toBe(true);
        expect(v.lignes.find((l) => l.compte === '42320000')).toMatchObject({ bloc: 'RETENUES', sens: 'CREDIT', montantFc: 120_000 });
    });
    const monterSaisie = (dateFin) => {
        const lignes = [
            {
                id: 'sa1', tenantId: 't', salarieId: 's1', type: 'SAISIE_ARRET', categoriePret: null,
                dateOctroi: new Date('2026-09-15'), dateFin, montantFc: 600_000, objet: 'Créance', referenceActe: 'RH 1',
                retenues: [],
            },
        ];
        return new personnel_service_1.PersonnelService({
            rubriquePaie: { findMany: jest.fn(async () => []) },
            avanceSalaire: {
                findMany: jest.fn(async ({ where }) => lignes.filter((l) => l.tenantId === where.tenantId && where.id.in.includes(l.id))),
            },
        });
    };
    const dtoSaisie = (mois) => ({ moisDePaie: mois, elements: [], retenuesAvances: [{ avanceId: 'sa1', montantFc: 50_000 }] });
    it('le serveur refuse la retenue hors de la période de la saisie, et la nomme au litera g)', async () => {
        const r = await monterSaisie(null).resoudreSaisie('t', 's1', dtoSaisie('2026-10'));
        expect(r.retenuesAvances[0]).toMatchObject({ type: 'SAISIE_ARRET', littera: 'g' });
        expect(r.retenuesAvances[0].libelle).toContain('acte RH 1');
        await expect(monterSaisie(null).resoudreSaisie('t', 's1', dtoSaisie('2026-08'))).rejects.toThrow(/art\. 187/);
        await expect(monterSaisie(new Date('2026-10-31')).resoudreSaisie('t', 's1', dtoSaisie('2026-11'))).rejects.toThrow(/art\. 201/);
    });
    it('le registre recopie l’acte sur une saisie, et ne l’écrit jamais sur une avance', async () => {
        const create = jest.fn(async (a) => a);
        const svc = new avances_rubriques_service_1.AvancesRubriquesService({
            salarie: { findFirst: jest.fn(async ({ where }) => (where.tenantId === 't' ? { id: where.id } : null)) },
            avanceSalaire: { create },
        });
        await svc.creerAvance('t', 'x@y', 's1', { ...saisie, dateOctroi: '2026-09-15' });
        expect(create.mock.calls[0][0].data).toMatchObject({
            type: 'SAISIE_ARRET',
            referenceActe: 'RH 1234/2026',
            greffe: 'Tripaix Gombe',
            destinataire: 'Greffe du Tripaix Gombe',
        });
        await svc.creerAvance('t', 'x@y', 's1', { type: 'AVANCE', montantFc: 100, objet: 'x', pieceJustificative: 'y', dateOctroi: '2026-09-15' });
        expect(create.mock.calls[1][0].data).toMatchObject({ referenceActe: null, greffe: null, destinataire: null });
    });
    it('la mainlevée passe par une écriture unitaire, refusée sur une avance', async () => {
        const lignes = {
            sa1: { id: 'sa1', tenantId: 't', type: 'SAISIE_ARRET', dateOctroi: new Date('2026-09-15'), dateFin: null },
            av1: { id: 'av1', tenantId: 't', type: 'AVANCE', dateOctroi: new Date('2026-09-15'), dateFin: null },
        };
        const update = jest.fn(async (a) => a);
        const svc = new avances_rubriques_service_1.AvancesRubriquesService({
            avanceSalaire: {
                findFirst: jest.fn(async ({ where }) => lignes[where.id]?.tenantId === where.tenantId ? lignes[where.id] : null),
                update,
            },
        });
        await svc.terminerSaisie('t', 'sa1', { dateFin: '2026-12-01' });
        expect(update).toHaveBeenCalledWith({ where: { id: 'sa1' }, data: { dateFin: new Date('2026-12-01') } });
        await expect(svc.terminerSaisie('t', 'av1', { dateFin: '2026-12-01' })).rejects.toThrow(/Seule une saisie/);
        await expect(svc.terminerSaisie('autre', 'sa1', { dateFin: '2026-12-01' })).rejects.toThrow(/introuvable/);
    });
});
describe('la simulation confronte la saisie à la quotité · le câblage (O4-C2)', () => {
    it('rend la réserve de l’art. 188 dès qu’une retenue de saisie est portée, et rien sans elle', async () => {
        const svc = new personnel_service_1.PersonnelService({
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA', ville: null }) },
            versionBaremePaie: { findFirst: jest.fn().mockResolvedValue(null) },
        });
        const dtoSim = { moisDePaie: '2026-10', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 }] };
        const retenue = { avanceId: 'sa1', type: 'SAISIE_ARRET', categoriePret: null, littera: 'g', libelle: 'Saisie', montantFc: 50_000, soldeAvantFc: 600_000 };
        jest.spyOn(svc, 'resoudreSaisie').mockImplementation(async (_t, _s, d) => ({ dto: d, retenuesAvances: [retenue] }));
        const avec = await svc.simulerPaie('t', null, dtoSim);
        expect(avec.reserveSaisies).toMatch(/art\. 188/);
        jest.spyOn(svc, 'resoudreSaisie').mockImplementation(async (_t, _s, d) => ({
            dto: d,
            retenuesAvances: [{ ...retenue, type: 'AVANCE', littera: 'c' }],
        }));
        expect((await svc.simulerPaie('t', null, dtoSim)).reserveSaisies).toBeNull();
    });
});
//# sourceMappingURL=avances-rubriques.spec.js.map