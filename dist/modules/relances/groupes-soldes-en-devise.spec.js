"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const groupes_soldes_en_devise_1 = require("./groupes-soldes-en-devise");
const relances_service_1 = require("./relances.service");
const ligne = (id, debit, credit, lettrageId, devise) => ({ id, debit, credit, lettrageId, deviseId: devise?.deviseId ?? null, montantDevise: devise?.montantDevise ?? null });
const usd = (montantDevise) => ({ deviseId: 'usd', montantDevise });
describe('groupes soldés dans leur devise · la règle', () => {
    it('soldé en devise, non en francs · un gain (négatif) ou une perte (positive), signés comme `ecartDuGroupe`', () => {
        const gain = (0, groupes_soldes_en_devise_1.candidatsSoldesEnDevise)([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_900_000, 'g', usd(1_000))]);
        expect(gain.get('g')).toEqual({ lignes: 2, ecart: -100_000 });
        const perte = (0, groupes_soldes_en_devise_1.candidatsSoldesEnDevise)([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_700_000, 'g', usd(1_000))]);
        expect(perte.get('g')).toEqual({ lignes: 2, ecart: 100_000 });
    });
    it('un groupe réglé en partie dans sa devise reste à la règle commune', () => {
        expect((0, groupes_soldes_en_devise_1.candidatsSoldesEnDevise)([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 1_450_000, 'g', usd(500))]).size).toBe(0);
    });
    it('une ligne en francs seuls dans le groupe · son reste ne serait plus le seul écart', () => {
        const lues = [ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_900_000, 'g', usd(1_000)), ligne('f2', 500_000, 0, 'g', null)];
        expect((0, groupes_soldes_en_devise_1.candidatsSoldesEnDevise)(lues).size).toBe(0);
    });
    it('deux devises, ou rien en francs à constater, ou une ligne seule · rien', () => {
        const eur = { deviseId: 'eur', montantDevise: 1_000 };
        expect((0, groupes_soldes_en_devise_1.candidatsSoldesEnDevise)([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_900_000, 'g', eur)]).size).toBe(0);
        expect((0, groupes_soldes_en_devise_1.candidatsSoldesEnDevise)([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_800_000, 'g', usd(1_000))]).size).toBe(0);
        expect((0, groupes_soldes_en_devise_1.candidatsSoldesEnDevise)([ligne('f', 2_800_000, 0, 'g', usd(1_000))]).size).toBe(0);
    });
    it('le libellé dit le gain ou la perte, son montant, et l’article', () => {
        expect((0, groupes_soldes_en_devise_1.libelleEcartNonPasse)(-100_000)).toMatch(/^Gain de change réalisé de 100 000,00 non passé .*AUDCIF art\. 55/);
        expect((0, groupes_soldes_en_devise_1.libelleEcartNonPasse)(100_000)).toMatch(/^Perte de change réalisée de 100 000,00 non passé/);
    });
});
function lettrages(groupes) {
    return {
        findMany: jest.fn(async (a) => a.where.lettrageReconduitId
            ? []
            : groupes
                .filter((g) => (g.tenantId ?? 't') === a.where.tenantId && (!a.where.id || a.where.id.in.includes(g.id)))
                .map((g) => ({ id: g.id, code: g.code, compteId: g.compteId, _count: { lignes: g.lignesEnBase } }))),
    };
}
describe('groupes soldés dans leur devise · lus en entier', () => {
    const lues = [ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_900_000, 'g', usd(1_000))];
    it('toutes ses lignes lues · retenu, avec son code et son compte', async () => {
        const r = await (0, groupes_soldes_en_devise_1.groupesSoldesEnDevise)({ lettrage: lettrages([{ id: 'g', code: 'AB', compteId: 'c6', lignesEnBase: 2 }]) }, 't', lues);
        expect(r.get('g')).toMatchObject({ code: 'ab', compteId: 'c6', ecart: -100_000 });
    });
    it('une ligne du groupe hors de la lecture (autre exercice) · la règle commune', async () => {
        const r = await (0, groupes_soldes_en_devise_1.groupesSoldesEnDevise)({ lettrage: lettrages([{ id: 'g', code: 'AB', compteId: 'c6', lignesEnBase: 3 }]) }, 't', lues);
        expect(r.size).toBe(0);
    });
    it('un groupe d’un autre dossier n’est pas rendu', async () => {
        const r = await (0, groupes_soldes_en_devise_1.groupesSoldesEnDevise)({ lettrage: lettrages([{ id: 'g', code: 'AB', compteId: 'c6', lignesEnBase: 2, tenantId: 'autre' }]) }, 't', lues);
        expect(r.size).toBe(0);
    });
    it('aucun candidat · rien n’est lu', async () => {
        const l = lettrages([]);
        await (0, groupes_soldes_en_devise_1.groupesSoldesEnDevise)({ lettrage: l }, 't', [ligne('f', 500_000, 0, null, null)]);
        expect(l.findMany).not.toHaveBeenCalled();
    });
});
describe('groupes soldés dans leur devise · les positions de relance', () => {
    const tiers = (id) => ({ id, nom: id, type: 'CLIENT', email: null, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null });
    const compte = (id) => ({ id, numero: id, intitule: id, tiersCompte: { tiers: tiers(`t-${id}`) } });
    const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
    const lue = (id, compteId, debit, credit, date, lettrageId, echeance, devise) => ({
        id,
        debit,
        credit,
        lettrageId,
        lettre: null,
        libelle: id,
        dateEcheance: echeance ? d(echeance) : null,
        deviseId: devise?.deviseId ?? null,
        montantDevise: devise?.montantDevise ?? null,
        compte: compte(compteId),
        ecriture: { date: d(date), libelle: 'Pièce', estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
    });
    const lignes = [
        lue('c6-f', 'c6', 2_800_000, 0, '2027-01-05', 'g6', '2027-01-31', usd(1_000)),
        lue('c6-r', 'c6', 0, 2_900_000, '2027-02-10', 'g6', null, usd(1_000)),
        lue('c6-f2', 'c6', 500_000, 0, '2027-01-10', null, '2027-01-31', null),
        lue('c6b-f', 'c6b', 2_800_000, 0, '2027-01-05', 'g6b', '2027-01-31', usd(1_000)),
        lue('c6b-r', 'c6b', 0, 2_700_000, '2027-02-10', 'g6b', null, usd(1_000)),
        lue('c6b-f2', 'c6b', 300_000, 0, '2027-01-10', null, '2027-01-31', null),
        lue('c6c-f', 'c6c', 2_800_000, 0, '2027-01-05', 'g6c', '2027-01-31', usd(1_000)),
        lue('c6c-r', 'c6c', 0, 2_700_000, '2027-02-10', 'g6c', null, usd(1_000)),
    ];
    const prisma = () => ({
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }) },
        ligneEcriture: {
            findMany: jest.fn(async (a) => (a.cursor ? [] : lignes)),
            groupBy: jest.fn(async (a) => (a.where.lettrageId?.in ?? []).map((id) => ({ lettrageId: id, _count: { _all: lignes.filter((l) => l.lettrageId === id).length } }))),
        },
        lettrage: lettrages([
            { id: 'g6', code: 'AA', compteId: 'c6', lignesEnBase: 2 },
            { id: 'g6b', code: 'AB', compteId: 'c6b', lignesEnBase: 2 },
            { id: 'g6c', code: 'AC', compteId: 'c6c', lignesEnBase: 2 },
        ]),
        imputationPaiement: { findMany: jest.fn(async () => []) },
        niveauRelance: { findMany: jest.fn().mockResolvedValue([]) },
        relance: { findMany: jest.fn().mockResolvedValue([]) },
    });
    it('la facture soldée dans sa devise n’est ni réclamée ni retranchée, et l’écart est nommé', async () => {
        const positions = await new relances_service_1.RelancesService(prisma(), {}).positions('t', {
            exerciceId: 'ex',
            type: client_1.TypeRelance.RAPPEL,
            dateReference: '2027-03-15',
        });
        const p6 = positions.find((p) => p.compteId === 'c6');
        expect(p6?.montantDu).toBe(500_000);
        expect(p6?.lignes.map((l) => l.montant)).toEqual([500_000]);
        expect(p6?.ecartsChangeNonPasses).toEqual([{ code: 'aa', ecart: -100_000, libelle: (0, groupes_soldes_en_devise_1.libelleEcartNonPasse)(-100_000) }]);
        expect(p6?.groupesLusLigneALigne.total).toBe(0);
        const p6b = positions.find((p) => p.compteId === 'c6b');
        expect(p6b?.montantDu).toBe(300_000);
        expect(p6b?.ecartsChangeNonPasses.map((e) => e.ecart)).toEqual([100_000]);
        expect(positions.some((p) => p.compteId === 'c6c')).toBe(false);
    });
    it('la lettre n’imprime pas l’écart · seules les lignes réclamées entrent au détail', () => {
        const src = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'relances.service.ts'), 'utf8');
        expect(src).toMatch(/if \(l\.lettrageId && soldesEnDevise\.has\(l\.lettrageId\)\) return;/);
        expect(src).toMatch(/lignes: position\.lignes,\n\s*\}\);/);
    });
});
//# sourceMappingURL=groupes-soldes-en-devise.spec.js.map