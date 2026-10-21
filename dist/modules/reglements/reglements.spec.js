"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const reglement_tiers_1 = require("./reglement-tiers");
const reglements_service_1 = require("./reglements.service");
describe('ce qui se règle', () => {
    it('une dette fournisseur au 40, une créance client au 41', () => {
        expect((0, reglement_tiers_1.estEcheanceAReglerSur)('40110000', 'FOURNISSEUR')).toBe(true);
        expect((0, reglement_tiers_1.estEcheanceAReglerSur)('41110000', 'CLIENT')).toBe(true);
        expect((0, reglement_tiers_1.estEcheanceAReglerSur)('41110000', 'FOURNISSEUR')).toBe(false);
    });
    it('ni estimations de clôture ni avances · 408, 409, 418, 419', () => {
        for (const n of ['40800000', '40910000', '41810000', '41900000']) {
            expect((0, reglement_tiers_1.estEcheanceAReglerSur)(n, n.startsWith('40') ? 'FOURNISSEUR' : 'CLIENT')).toBe(false);
        }
    });
    it('A7 ter, mineur 1 · le 416 ne se règle pas ici · le refus renvoie au « Recouvrement » du module', () => {
        expect((0, reglement_tiers_1.estEcheanceAReglerSur)('41620000', 'CLIENT')).toBe(false);
        expect((0, reglement_tiers_1.estEcheanceAReglerSur)('41610000', 'CLIENT')).toBe(false);
        expect((0, reglement_tiers_1.motifHorsEcheance)('41620000')).toMatch(/41620000 \(créance litigieuse ou douteuse\) se règle par « Recouvrement » dans « Créances douteuses ou litigieuses »/);
        expect((0, reglement_tiers_1.motifHorsEcheance)('40910000')).toMatch(/ne porte pas d'échéance à régler/);
    });
    it('le dû se lit dans le sens de l’échéance', () => {
        expect((0, reglement_tiers_1.montantDu)({ debit: 0, credit: 1180 }, 'FOURNISSEUR')).toBe(1180);
        expect((0, reglement_tiers_1.montantDu)({ debit: 500, credit: 0 }, 'CLIENT')).toBe(500);
    });
});
describe('l’écriture du règlement', () => {
    it('fournisseur · débit du 40, crédit de la trésorerie', () => {
        expect((0, reglement_tiers_1.lignesDuReglement)({ sens: 'FOURNISSEUR', compteTiersId: '401', compteTresorerieId: '521', montant: 100, libelle: 'x' })).toEqual([
            { compteId: '401', debit: 100, libelle: 'x' },
            { compteId: '521', credit: 100, libelle: 'x' },
        ]);
    });
    it('client · débit de la trésorerie, crédit du 41', () => {
        expect((0, reglement_tiers_1.lignesDuReglement)({ sens: 'CLIENT', compteTiersId: '411', compteTresorerieId: '521', montant: 100, libelle: 'x' })).toEqual([
            { compteId: '521', debit: 100, libelle: 'x' },
            { compteId: '411', credit: 100, libelle: 'x' },
        ]);
    });
    it('partiel admis, excédent refusé, zéro refusé', () => {
        expect((0, reglement_tiers_1.motifRefusMontant)(40, 100)).toBeNull();
        expect((0, reglement_tiers_1.motifRefusMontant)(100, 100)).toBeNull();
        expect((0, reglement_tiers_1.motifRefusMontant)(100.01, 100)).toMatch(/avance ou un trop-perçu/);
        expect((0, reglement_tiers_1.motifRefusMontant)(0, 100)).toMatch(/positif/);
    });
});
function monter(clotures = [], creancesReclassees = [], reclassements = {}, groupes = []) {
    const lignes = [
        { id: 'f1', compteId: 'c401', debit: 0, credit: 600, lettrageId: null, compte: { numero: '40110000', intitule: 'Fournisseur A', lettrable: true }, ecriture: { exerciceId: 'ex', date: new Date('2026-03-01'), journalId: 'jACH', journal: { code: 'ACH' }, exercice: { statut: 'OUVERT' } } },
        { id: 'f2', compteId: 'c401', debit: 0, credit: 400, lettrageId: null, compte: { numero: '40110000', intitule: 'Fournisseur A', lettrable: true }, ecriture: { exerciceId: 'ex', date: new Date('2026-03-01'), journalId: 'jACH', journal: { code: 'ACH' }, exercice: { statut: 'OUVERT' } } },
        { id: 'k1', compteId: 'c411', debit: 500, credit: 0, lettrageId: null, compte: { numero: '41110000', intitule: 'Client K', lettrable: true }, ecriture: { exerciceId: 'ex', date: new Date('2026-03-01'), journalId: 'jVEN', journal: { code: 'VEN' }, exercice: { statut: 'OUVERT' } } },
        { id: 'g1', compteId: 'c402', debit: 0, credit: 300, lettrageId: null, compte: { numero: '40120000', intitule: 'Fournisseur B', lettrable: true }, ecriture: { exerciceId: 'ex', date: new Date('2026-03-01'), journalId: 'jACH', journal: { code: 'ACH' }, exercice: { statut: 'OUVERT' } } },
    ];
    const prisma = {
        journal: { findFirst: jest.fn(async () => ({ id: 'bq', code: 'BQ', type: 'TRESORERIE', compteTresorerieId: 'c521' })) },
        ligneEcriture: {
            findMany: jest.fn(async ({ where }) => lignes.filter((l) => where.id.in.includes(l.id))),
            groupBy: jest.fn(async ({ where }) => {
                const parCle = new Map();
                const piece = (x) => x.ecritureId;
                for (const l of lignes.filter((x) => piece(x) !== undefined && where.ecritureId.in.includes(piece(x)))) {
                    const cle = `${piece(l)}:${l.compteId}`;
                    const g = parCle.get(cle) ?? { ecritureId: piece(l), compteId: l.compteId, _sum: { debit: 0, credit: 0 } };
                    g._sum.debit += l.debit;
                    g._sum.credit += l.credit;
                    parCle.set(cle, g);
                }
                return [...parCle.values()];
            }),
            aggregate: jest.fn(async ({ where }) => {
                const siennes = lignes.filter((l) => l.compteId === where.compteId);
                return {
                    _sum: {
                        debit: siennes.reduce((t, l) => t + l.debit, 0),
                        credit: siennes.reduce((t, l) => t + l.credit, 0) + (reclassements[where.compteId] ?? 0),
                    },
                };
            }),
        },
        cloture: { findMany: jest.fn(async () => clotures) },
        lettrage: {
            findMany: jest.fn(async ({ where }) => where.tenantId !== 't'
                ? []
                : groupes
                    .filter((g) => where.id.in.includes(g.id))
                    .map((g) => ({
                    ...g,
                    verrouille: g.verrouille ?? false,
                    compteId: lignes.find((l) => l.lettrageId === g.id)?.compteId,
                    lignes: lignes.filter((l) => l.lettrageId === g.id).map((l) => ({ id: l.id, debit: l.debit, credit: l.credit, deviseId: null, montantDevise: null, ecriture: l.ecriture })),
                }))),
        },
        ribBanque: { findFirst: jest.fn(async () => null) },
        tenant: { findFirst: jest.fn(async () => ({ assujettiTva: false, assujettissementTvaRepondu: true })) },
        modeReglement: {
            findFirst: jest.fn(async ({ where }) => [
                { id: 'esp', tenantId: 't', code: 'ESP', intitule: 'Espèces', nature: 'ESPECES', estActif: true, journalId: null },
                { id: 'vir', tenantId: 't', code: 'VIR', intitule: 'Virement', nature: 'VIREMENT', estActif: true, journalId: null },
            ].find((m) => m.id === where.id && m.tenantId === where.tenantId) ?? null),
        },
        creanceDouteuse: {
            findMany: jest.fn(async ({ where }) => creancesReclassees.filter((c) => where.compteCreanceId.in.includes(c.compteCreanceId))),
        },
    };
    let n = 0;
    const creer = jest.fn(async (_t, _u, dto) => {
        n += 1;
        return { id: 'e' + n, lignes: dto.lignes.map((l, i) => ({ ...l, id: `p${n}-${i}` })) };
    });
    const lettrerManuel = jest.fn(async () => ({ lettre: 'A' }));
    const completer = jest.fn(async () => ({ lettre: 'B', statut: 'SOLDE', solde: 0, nombreLignes: 3 }));
    const ordre = jest.fn();
    const ordres = {
        preparer: jest.fn(async () => {
            ordre('preparer');
            return { donneur: { banque: 'B', coordonnees: 'X', codeBic: null }, beneficiaires: new Map() };
        }),
        creer: jest.fn(async () => ({ id: 'o1', numero: 1, total: 0 })),
    };
    creer.mockImplementation(async (_t, _u, dto) => {
        ordre('piece');
        n += 1;
        return { id: 'e' + n, lignes: dto.lignes.map((l, i) => ({ ...l, id: `p${n}-${i}` })) };
    });
    const retirerCompensation = jest.fn(async () => undefined);
    const delettrer = jest.fn(async () => undefined);
    const service = new reglements_service_1.ReglementsService(prisma, { creer, retirerCompensation, verifierCaisseProvisionnee: jest.fn() }, { lettrerManuel, delettrer, completer }, ordres);
    return { service, creer, lettrerManuel, delettrer, completer, lignes, ordres, ordre, retirerCompensation, prisma };
}
const base = { sens: 'FOURNISSEUR', exerciceId: 'ex', journalId: 'bq', date: '2026-09-25' };
describe('enregistrer', () => {
    it('une pièce par tiers, et le lettrage des factures avec leur règlement', async () => {
        const { service, creer, lettrerManuel } = monter();
        await service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1', 'f2'] }, { compteId: 'c402', ligneIds: ['g1'] }] });
        expect(creer).toHaveBeenCalledTimes(2);
        expect(creer.mock.calls[0][2].lignes).toEqual([
            expect.objectContaining({ compteId: 'c401', debit: 1000 }),
            expect.objectContaining({ compteId: 'c521', credit: 1000 }),
        ]);
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c401', ['f1', 'f2', 'p1-0'], 'u', { autoriserPartiel: false });
    });
    it('un règlement partiel pose un lettrage partiel', async () => {
        const { service, lettrerManuel } = monter();
        await service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'], montant: 250 }] });
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c401', ['f1', 'p1-0'], 'u', { autoriserPartiel: true });
    });
    it('refuse un compte non lettrable AVANT toute pièce', async () => {
        const { service, creer, lignes } = monter();
        lignes.filter((l) => l.compteId === 'c402').forEach((l) => (l.compte.lettrable = false));
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }, { compteId: 'c402', ligneIds: ['g1'] }] })).rejects.toThrow(/40120000 n'est pas déclaré lettrable/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('un lettrage refusé malgré tout retire la pièce qu’il devait accompagner', async () => {
        const { service, lettrerManuel, retirerCompensation } = monter();
        lettrerManuel.mockRejectedValueOnce(new Error('Une des lignes a été lettrée entre-temps'));
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] })).rejects.toThrow(/entre-temps/);
        expect(retirerCompensation).toHaveBeenCalledWith('t', 'e1');
    });
    it('une facture d’un journal de situation n’est pas due · refusée AVANT toute pièce, nommée (ligne sage-l1, relecture M1)', async () => {
        const { service, creer, lignes } = monter();
        const g1 = lignes.find((l) => l.id === 'g1');
        Object.assign(g1.ecriture, { statut: 'SITUATION', numeroPiece: 31 });
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }, { compteId: 'c402', ligneIds: ['g1'] }] })).rejects.toThrow(/La pièce n° 31 \(40120000\) est une écriture de situation/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('un seul refus arrête le lot AVANT toute écriture', async () => {
        const { service, creer } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }, { compteId: 'c402', ligneIds: ['g1'], montant: 999 }] })).rejects.toThrow(/trop-perçu/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('refuse une facture figée par une clôture totale AVANT toute pièce · le lettrage suivrait la pièce et la refuserait', async () => {
        const { service, creer } = monter([{ granularite: 'TOTALE', journalId: 'jACH', dateLimite: new Date('2026-12-31') }]);
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] })).rejects.toThrow(/régler.*clôturé totalement/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('refuse une facture déjà lettrée (groupe SOLDÉ), ou sur un autre compte', async () => {
        const { service, lignes } = monter([], [], {}, [{ id: 'L', code: 'A', statut: 'SOLDE' }]);
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['g1'] }] })).rejects.toThrow(/compte du tiers/);
        lignes[0].lettrageId = 'L';
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] })).rejects.toThrow(/déjà lettrée/);
    });
    it('A7 ter, mineur 1 · le règlement d’un compte qui porte une créance reclassée avertit, sans refuser', async () => {
        const { service, creer } = monter([], [{ compteCreanceId: 'c411', dateReclassement: new Date('2026-11-15'), compte416: { numero: '41620000' } }]);
        const r = await service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['k1'] }] });
        expect(creer).toHaveBeenCalledTimes(1);
        expect(r.avertissements).toEqual([
            expect.stringMatching(/41110000 porte une créance reclassée au 41620000 le 2026-11-15.*passez-le par « Recouvrement » dans ce module.*une autre facture du client paraît impayée/),
        ]);
        const f = monter([], [{ compteCreanceId: 'c401', dateReclassement: new Date('2026-11-15'), compte416: { numero: '41620000' } }]);
        const rf = await f.service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] });
        expect(rf.avertissements).toEqual([]);
    });
    it('m-d · au-delà du solde net d’un compte qui porte une créance reclassée, refus nommé AVANT toute pièce', async () => {
        const reclassee = [{ compteCreanceId: 'c411', dateReclassement: new Date('2026-11-15'), compte416: { numero: '41620000' } }];
        const { service, creer } = monter([], reclassee, { c411: 500 });
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['k1'] }] })).rejects.toThrow(/41110000 porte une créance reclassée au 41620000 le 2026-11-15 · son solde net n'est que de 0\.00.*Réglez ici au plus 0\.00.*« Recouvrement ».*pièce au journal/);
        expect(creer).not.toHaveBeenCalled();
        const partiel = monter([], reclassee, { c411: 200 });
        await expect(partiel.service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['k1'], montant: 301 }] })).rejects.toThrow(/solde net n'est que de 300\.00.*Réglez ici au plus 300\.00/);
        await expect(partiel.service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['k1'], montant: 301 }] })).rejects.not.toThrow(/ne réglez que les autres factures/);
        expect((0, reglement_tiers_1.avertissementCreanceReclassee)('41110000', '41620000', '2026-11-15')).not.toMatch(/devient créditeur/);
        await partiel.service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['k1'], montant: 300 }] });
        expect(partiel.creer).toHaveBeenCalledTimes(1);
    });
    it('le contrôleur réserve l’enregistrement aux rôles qui écrivent', () => {
        const src = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'reglements.controller.ts'), 'utf8');
        expect(src).toContain('@Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)\n  @Post()');
    });
});
describe('ordre de virement préparé avec les règlements', () => {
    it('se vérifie AVANT la première pièce, puis naît sur les pièces passées', async () => {
        const { service, ordres, ordre } = monter();
        const r = await service.enregistrer('t', 'u', { ...base, ordreVirement: true, reglements: [{ compteId: 'c401', ligneIds: ['f1', 'f2'], reference: 'VIR 12' }, { compteId: 'c402', ligneIds: ['g1'] }] }, 'compta@exemple.cd');
        expect(ordre.mock.calls.map((c) => c[0])).toEqual(['preparer', 'piece', 'piece']);
        expect(ordres.preparer).toHaveBeenCalledWith('t', 'bq', ['c401', 'c402']);
        expect(ordres.creer).toHaveBeenCalledWith('t', 'compta@exemple.cd', 'bq', '2026-09-25', expect.anything(), [
            { compteId: 'c401', montant: 1000, reference: 'VIR 12', ecritureId: 'e1', pieceReglement: 'BQ' },
            { compteId: 'c402', montant: 300, reference: null, ecritureId: 'e2', pieceReglement: 'BQ' },
        ]);
        expect(r.ordre).toEqual({ id: 'o1', numero: 1, total: 0 });
    });
    it('un tiers sans RIB refuse le lot entier · aucune pièce passée', async () => {
        const { service, ordres, creer } = monter();
        ordres.preparer.mockRejectedValueOnce(new Error('pas de RIB'));
        await expect(service.enregistrer('t', 'u', { ...base, ordreVirement: true, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] })).rejects.toThrow('pas de RIB');
        expect(creer).not.toHaveBeenCalled();
    });
    it("l'encaissement d'un client ne s'ordonne pas", async () => {
        const { service, creer, ordres } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', ordreVirement: true, reglements: [{ compteId: 'c411', ligneIds: ['k1'] }] })).rejects.toThrow(/paie un fournisseur/);
        expect(ordres.preparer).not.toHaveBeenCalled();
        expect(creer).not.toHaveBeenCalled();
    });
    it("sans la case, aucun ordre n'est préparé", async () => {
        const { service, ordres } = monter();
        const r = await service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] });
        expect(ordres.preparer).not.toHaveBeenCalled();
        expect(ordres.creer).not.toHaveBeenCalled();
        expect(r.ordre).toBeNull();
    });
});
function echeancier(lignes, reevaluations = [], groupes = []) {
    const prisma = {
        lettrage: {
            findMany: jest.fn(async ({ where }) => {
                const exerciceDe = where.lignes.some.ecriture.exerciceId;
                return groupes
                    .map((g) => ({ ...g, verrouille: g.verrouille ?? false, lignes: lignes.filter((l) => l.lettrageId === g.id) }))
                    .filter((g) => where.tenantId === 't' &&
                    g.statut === where.statut &&
                    g.verrouille === where.verrouille &&
                    g.lignes.some((l) => l.compte.numero.startsWith(where.compte.numero.startsWith)) &&
                    g.lignes.some((l) => l.ecriture.exerciceId === exerciceDe) &&
                    !g.lignes.some((l) => l.ecriture.exerciceId !== where.NOT.lignes.some.ecriture.exerciceId.not))
                    .map((g) => ({ ...g, lignes: g.lignes.map((l) => ({ id: l.id, debit: l.debit, credit: l.credit, deviseId: l.deviseId, montantDevise: l.montantDevise, ecriture: l.ecriture })) }));
            }),
        },
        creanceDouteuse: { findMany: jest.fn(async () => []) },
        reevaluation: {
            findMany: jest.fn(async ({ where }) => where.tenantId === 't' ? reevaluations.map((r) => ({ ecritureEcartsId: r.ecritureEcartsId ?? null, ecritureExtourneId: r.ecritureExtourneId ?? null })) : []),
        },
        exercice: { findFirst: jest.fn(async () => ({ id: 'ex', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') })) },
        ligneEcriture: {
            findMany: jest.fn(async ({ where, cursor, take }) => {
                const toutes = lignes
                    .filter((l) => {
                    if (where.id?.in)
                        return where.id.in.includes(l.id);
                    if (where.ecritureId?.in && !where.ecritureId.in.includes(l.ecritureId))
                        return false;
                    if (where.deviseId === null && l.deviseId !== null)
                        return false;
                    if (where.lettre === null && (l.lettre ?? null) !== null)
                        return false;
                    if (where.compteId?.in && !where.compteId.in.includes(l.compteId))
                        return false;
                    const e = where.ecriture;
                    if (e?.exerciceId && l.ecriture.exerciceId !== e.exerciceId)
                        return false;
                    if (e?.date?.lt && !(l.ecriture.date < e.date.lt))
                        return false;
                    if (e?.OR && !e.OR.some((c) => Object.entries(c).every(([k, v]) => (l.ecriture[k] ?? false) === v)))
                        return false;
                    if (where.lettrageId === null && l.lettrageId !== null)
                        return false;
                    if (where.lettrageId?.not === null && l.lettrageId === null)
                        return false;
                    if (where.lettrageId?.in && !where.lettrageId.in.includes(l.lettrageId))
                        return false;
                    if (where.compte?.numero?.startsWith && !l.compte.numero.startsWith(where.compte.numero.startsWith))
                        return false;
                    if (where.compte?.id?.in && !where.compte.id.in.includes(l.compteId))
                        return false;
                    const anterieure = where.lettrage?.lignes?.some?.ecriture?.date?.lt;
                    if (anterieure && !lignes.some((x) => x.lettrageId !== null && x.lettrageId === l.lettrageId && x.ecriture.date < anterieure))
                        return false;
                    if (where.credit?.gt !== undefined && !(l.credit > where.credit.gt))
                        return false;
                    if (where.debit?.gt !== undefined && !(l.debit > where.debit.gt))
                        return false;
                    return true;
                })
                    .map((l) => ({ ...l, lettre: l.lettre ?? null, lettrage: l.lettrageId ? { code: 'A' } : null }));
                const depart = cursor ? toutes.findIndex((l) => l.id === cursor.id) + 1 : 0;
                return take ? toutes.slice(depart, depart + take) : toutes.slice(depart);
            }),
        },
        cloture: { findMany: jest.fn(async () => []) },
        ribBanque: { findFirst: jest.fn(async () => null) },
        journal: { findFirst: jest.fn(async () => ({ id: 'bq', code: 'BQ', type: 'TRESORERIE', compteTresorerieId: 'c521' })) },
        tenant: { findFirst: jest.fn(async () => ({ assujettiTva: false, assujettissementTvaRepondu: true })) },
    };
    const creer = jest.fn(async (_t, _u, dto) => ({
        id: 'e1',
        lignes: dto.lignes.map((l, i) => ({ ...l, id: `p-${i}` })),
    }));
    const lettrerManuel = jest.fn(async () => ({ lettre: 'b' }));
    const service = new reglements_service_1.ReglementsService(prisma, { creer, retirerCompensation: jest.fn(), verifierCaisseProvisionnee: jest.fn() }, { lettrerManuel }, {});
    return { service, creer, lettrerManuel, prisma };
}
function ligneEcheance(id, credit, ecriture = {}, enPlus = {}) {
    return {
        id,
        compteId: 'c401',
        debit: 0,
        credit,
        lettrageId: null,
        dateEcheance: null,
        deviseId: null,
        montantDevise: null,
        coursApplique: null,
        libelle: null,
        compte: { id: 'c401', numero: '40110000', intitule: 'Fournisseur A', lettrable: true, tiersCompte: null, modeReportANouveau: 'DETAIL' },
        ecriture: {
            exerciceId: 'ex',
            date: new Date('2027-01-01'),
            libelle: 'Facture',
            reference: null,
            numeroPiece: 1,
            journal: { code: 'AN' },
            journalId: 'jAN',
            exercice: { statut: 'OUVERT' },
            estANouveauProvisoire: false,
            ...ecriture,
        },
        ...enPlus,
    };
}
describe('les échéances · l’à-nouveau provisoire écarté et dit (A6 bis, second tour, m6)', () => {
    it('écartées de la liste, comptées sur leur compte · un compte qui n’a qu’elles reste nommé', async () => {
        const { service } = echeancier([
            ligneEcheance('ranP', 600, { estANouveauProvisoire: true }),
            ligneEcheance('fx', 400, { date: new Date('2027-02-01'), journal: { code: 'ACH' } }),
            { ...ligneEcheance('ranQ', 300, { estANouveauProvisoire: true }), compteId: 'c402', compte: { id: 'c402', numero: '40120000', intitule: 'Fournisseur B', lettrable: true, tiersCompte: null } },
        ]);
        const r = await service.echeances('t', 'ex', 'FOURNISSEUR');
        expect(r.map((g) => [g.numero, g.lignes.map((l) => l.id), g.aNouveauProvisoireEcartees])).toEqual([
            ['40110000', ['fx'], 1],
            ['40120000', [], 1],
        ]);
    });
    it('un à-nouveau définitif reste dû, et rien n’est écarté', async () => {
        const { service } = echeancier([ligneEcheance('ranD', 600, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false })]);
        const r = await service.echeances('t', 'ex', 'FOURNISSEUR');
        expect(r).toEqual([expect.objectContaining({ numero: '40110000', aNouveauProvisoireEcartees: 0, lignes: [expect.objectContaining({ id: 'ranD', montant: 600 })] })]);
    });
    it('choisi malgré tout · refusé avant toute pièce, l’issue nommée', async () => {
        const { service, creer } = echeancier([ligneEcheance('ranP', 600, { estANouveauProvisoire: true })]);
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['ranP'] }] })).rejects.toThrow(/40110000 · la ligne d'à-nouveau choisie est PROVISOIRE[\s\S]*Attendez sa clôture, ou saisissez le règlement au journal de trésorerie/);
        expect(creer).not.toHaveBeenCalled();
    });
});
describe('les échéances · l’écart d’une réévaluation n’est pas une facture (A6 ter)', () => {
    const ecartAnterieur = { ...ligneEcheance('eR1', 50_000, { exerciceId: 'n0', date: new Date('2026-12-31') }), ecritureId: 'eR' };
    it('la contre-passation d’une réévaluation chez un client · écartée', async () => {
        const extourne = { ...ligneEcheance('ext', 0, { date: new Date('2027-01-01'), journal: { code: 'OD' } }), ecritureId: 'eX', debit: 50_000, compteId: 'c411', compte: { id: 'c411', numero: '41110000', intitule: 'Client', lettrable: true, tiersCompte: null } };
        const facture = { ...ligneEcheance('fc', 0), debit: 2_800_000, compteId: 'c411', compte: { id: 'c411', numero: '41110000', intitule: 'Client', lettrable: true, tiersCompte: null } };
        const { service } = echeancier([extourne, facture], [{ ecritureExtourneId: 'eX' }]);
        const r = await service.echeances('t', 'ex', 'CLIENT');
        expect(r.map((g) => g.lignes.map((l) => l.id))).toEqual([['fc']]);
    });
    it('reportée à l’à-nouveau ou passée dans l’exercice · écartée, la vraie facture reportée reste due', async () => {
        const { service } = echeancier([
            ecartAnterieur,
            ligneEcheance('ranR', 50_000, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }),
            ligneEcheance('ranF', 600, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false }),
            { ...ligneEcheance('reev', 30_000, { date: new Date('2027-12-31'), journal: { code: 'OD' } }), ecritureId: 'eR27' },
        ], [{ ecritureEcartsId: 'eR' }, { ecritureEcartsId: 'eR27' }]);
        const r = await service.echeances('t', 'ex', 'FOURNISSEUR');
        expect(r.map((g) => [g.numero, g.lignes.map((l) => l.id)])).toEqual([['40110000', ['ranF']]]);
    });
    it('sans réévaluation antérieure, un à-nouveau en francs du même montant reste dû', async () => {
        const { service } = echeancier([ecartAnterieur, ligneEcheance('ranR', 50_000, { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false })]);
        const r = await service.echeances('t', 'ex', 'FOURNISSEUR');
        expect(r.map((g) => g.lignes.map((l) => l.id))).toEqual([['ranR']]);
    });
});
describe('les échéances et le règlement · la paire à cheval se compense (A6 bis, second tour, m1)', () => {
    const N = { exerciceId: 'n', date: new Date('2026-12-15'), journal: { code: 'ACH' } };
    const CLOTURE = { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false };
    const scene = (reglementUsd, reglementFrancs) => [
        ligneEcheance('f0', 1_948_800, N, { lettrageId: 'G', deviseId: 'usd', montantDevise: 1160, libelle: 'Facture NZUZI' }),
        ligneEcheance('ran', 1_948_800, CLOTURE, { deviseId: 'usd', montantDevise: 1160, libelle: 'RAN détail 40110000 · Facture NZUZI' }),
        { ...ligneEcheance('p1', 0, { date: new Date('2027-02-10'), journal: { code: 'BQ' } }, { lettrageId: 'G', deviseId: 'usd', montantDevise: reglementUsd }), debit: reglementFrancs },
    ];
    it('soldée par le groupe · absente des échéances, refusée si choisie, l’issue nommée', async () => {
        const { service, creer } = echeancier(scene(1160, 1_948_800));
        expect(await service.echeances('t', 'ex', 'FOURNISSEUR')).toEqual([]);
        await expect(service.enregistrer('t', 'u', { ...base, exerciceId: 'ex', reglements: [{ compteId: 'c401', ligneIds: ['ran'], montantDevise: 1160, coursReglement: 1750 }] })).rejects.toThrow(/40110000 · la ligne d'à-nouveau choisie est déjà réglée par le lettrage A à cheval de deux exercices[\s\S]*Elle n'est plus due/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('réglée en partie, en francs · le règlement ne paie que le reste, son lettrage reste partiel, et c’est dit', async () => {
        const { service, creer, lettrerManuel } = echeancier([
            ligneEcheance('f0', 1_000_000, N, { lettrageId: 'G', libelle: 'Facture NZUZI' }),
            ligneEcheance('ran', 1_000_000, CLOTURE, { libelle: 'RAN détail 40110000 · Facture NZUZI' }),
            { ...ligneEcheance('p1', 0, { date: new Date('2027-02-10'), journal: { code: 'BQ' } }, { lettrageId: 'G' }), debit: 600_000 },
        ]);
        const r = await service.enregistrer('t', 'u', { ...base, exerciceId: 'ex', reglements: [{ compteId: 'c401', ligneIds: ['ran'] }] });
        expect(creer.mock.calls[0][2].lignes).toEqual([
            expect.objectContaining({ compteId: 'c401', debit: 400_000 }),
            expect.objectContaining({ compteId: 'c521', credit: 400_000 }),
        ]);
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c401', ['ran', 'p-0'], 'u', { autoriserPartiel: true });
        expect(r.avertissements).toEqual([expect.stringMatching(/réglée en partie par le lettrage A à cheval de deux exercices · seul son reste est dû/)]);
        await expect(service.enregistrer('t', 'u', { ...base, exerciceId: 'ex', reglements: [{ compteId: 'c401', ligneIds: ['ran'], montant: 400_000.01 }] })).rejects.toThrow(/40110000 ·/);
    });
    it('réglée en partie · seul son reste est dû, en francs et en devise, et le groupe qui la règle est dit', async () => {
        const { service } = echeancier(scene(600, 1_008_000));
        const [g] = await service.echeances('t', 'ex', 'FOURNISSEUR');
        expect(g.lignes).toEqual([
            expect.objectContaining({ id: 'ran', montant: 940_800, montantDevise: 560, regleParLettrageACheval: { groupe: 'A', montant: 1_008_000 } }),
        ]);
    });
});
describe('règlement fournisseur imputé par le dossier (art. 151)', () => {
    const avecPieces = () => {
        const m = monter();
        for (const l of m.lignes)
            Object.assign(l.ecriture, { numeroPiece: l.id === 'f1' ? 'ACH-12' : 'ACH-15', libelle: `Facture ${l.id}` });
        return m;
    };
    const impute = (imputation, montant = 500, pieceImputation = 'Lettre L-14') => ({
        ...base,
        reglements: [{ compteId: 'c401', ligneIds: ['f1', 'f2'], montant, imputation, ...(pieceImputation !== null ? { pieceImputation } : {}) }],
    });
    it('une ligne au 40 par facture, à sa part, puis la trésorerie · chacune lettrée avec SA facture', async () => {
        const { service, creer, lettrerManuel } = avecPieces();
        lettrerManuel.mockResolvedValueOnce({ lettre: 'A' }).mockResolvedValueOnce({ lettre: 'b' });
        const r = await service.enregistrer('t', 'u', impute([{ ligneId: 'f2', montant: 400 }, { ligneId: 'f1', montant: 100 }]));
        expect(creer.mock.calls[0][2].lignes).toEqual([
            { compteId: 'c401', debit: 400, libelle: 'Règlement Fournisseur A · pièce ACH-15' },
            { compteId: 'c401', debit: 100, libelle: 'Règlement Fournisseur A · pièce ACH-12' },
            { compteId: 'c521', credit: 500, libelle: 'Règlement Fournisseur A' },
        ]);
        expect(lettrerManuel).toHaveBeenNthCalledWith(1, 't', 'c401', ['f2', 'p1-0'], 'u', { autoriserPartiel: false });
        expect(lettrerManuel).toHaveBeenNthCalledWith(2, 't', 'c401', ['f1', 'p1-1'], 'u', { autoriserPartiel: true });
        expect(r.reglements).toEqual([expect.objectContaining({ compte: '40110000', montant: 500, partiel: true, lettre: 'A, b' })]);
        expect(r.avertissements).toEqual([]);
        expect(creer.mock.calls[0][2].reference).toBe('imputation notifiée · Lettre L-14');
    });
    it('M6 · sans ordre de virement ni pièce qui la notifie, l’imputation est refusée AVANT toute pièce (art. 151)', async () => {
        const { service, creer } = avecPieces();
        await expect(service.enregistrer('t', 'u', impute([{ ligneId: 'f2', montant: 400 }, { ligneId: 'f1', montant: 100 }], 500, null))).rejects.toThrow('préparez l’ordre de virement, qui imprime chaque facture et sa part, ou donnez la référence de la pièce');
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'], pieceImputation: 'Lettre L-14' }] })).rejects.toThrow('n’a d’objet qu’avec la part désignée');
        expect(creer).not.toHaveBeenCalled();
    });
    it('M6 · avec l’ordre de virement, l’imputation (factures et parts) est recopiée pour être IMPRIMÉE', async () => {
        const { service, ordres } = avecPieces();
        await service.enregistrer('t', 'u', { ...impute([{ ligneId: 'f2', montant: 400 }, { ligneId: 'f1', montant: 100 }], 500, null), ordreVirement: true });
        const lignes = ordres.creer.mock.calls[0][5];
        expect(lignes[0].imputationDeclaree).toBe('Factures payées · pièce ACH-15 : 400,00 ; pièce ACH-12 : 100,00');
    });
    it('refus nommés AVANT toute pièce · somme différente du montant, part au-delà du dû, facture sans part, côté client', async () => {
        const { service, creer } = avecPieces();
        await expect(service.enregistrer('t', 'u', impute([{ ligneId: 'f2', montant: 400 }, { ligneId: 'f1', montant: 50 }]))).rejects.toThrow('La somme des parts (450.00) diffère du montant réglé (500.00)');
        await expect(service.enregistrer('t', 'u', impute([{ ligneId: 'f2', montant: 450 }, { ligneId: 'f1', montant: 50 }]))).rejects.toThrow('dépasse le dû de sa facture (400.00)');
        await expect(service.enregistrer('t', 'u', impute([{ ligneId: 'f2', montant: 400 }], 400))).rejects.toThrow('ne reçoit aucune part');
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['k1'], imputation: [{ ligneId: 'k1', montant: 500 }] }] })).rejects.toThrow('jamais celle du cabinet qui encaisse');
        expect(creer).not.toHaveBeenCalled();
    });
    it('le second lettrage refusé · le premier groupe est défait, la pièce retirée, l’erreur d’origine remonte', async () => {
        const { service, lettrerManuel, delettrer, retirerCompensation } = avecPieces();
        lettrerManuel.mockResolvedValueOnce({ lettre: 'A' }).mockRejectedValueOnce(new Error('Une des lignes a été lettrée entre-temps'));
        await expect(service.enregistrer('t', 'u', impute([{ ligneId: 'f2', montant: 400 }, { ligneId: 'f1', montant: 100 }]))).rejects.toThrow(/entre-temps/);
        expect(delettrer).toHaveBeenCalledWith('t', 'c401', 'A');
        expect(retirerCompensation).toHaveBeenCalledWith('t', 'e1');
    });
    it('sans parts, un règlement partiel de plusieurs factures suit l’art. 154, et c’est DIT', async () => {
        const { service, lettrerManuel } = avecPieces();
        const r = await service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1', 'f2'], montant: 500 }] });
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c401', ['f1', 'f2', 'p1-0'], 'u', { autoriserPartiel: true });
        expect(r.avertissements).toEqual([expect.stringContaining('la déduction de leur TVA suit l’imputation légale (Code civil, Livre III, art. 154')]);
    });
});
describe('Règlement d’une facture d’un lettrage partiel', () => {
    const N1 = { exerciceId: 'ex', date: new Date('2027-01-01'), journalId: 'jOD', journal: { code: 'OD' }, exercice: { statut: 'OUVERT' } };
    const monterPartiel = (groupe = {}) => {
        const m = monter([], [], {}, [{ id: 'G', code: 'B', statut: groupe.statut ?? 'PARTIEL', verrouille: groupe.verrouille }]);
        m.lignes.push({ id: 'xF', compteId: 'c411', debit: 34_800_000, credit: 0, lettrageId: 'G', compte: { numero: '41110000', intitule: 'Client K', lettrable: true }, ecriture: N1 }, { id: 'xA', compteId: 'c411', debit: 0, credit: 20_000_000, lettrageId: 'G', compte: { numero: '41110000', intitule: 'Client K', lettrable: true }, ecriture: N1 });
        return m;
    };
    const client = { ...base, sens: 'CLIENT' };
    it('34 800 000 pour 14 800 000 dus · REFUSÉ, le groupe et ce qu’il a réglé nommés, aucune pièce', async () => {
        const { service, creer } = monterPartiel();
        await expect(service.enregistrer('t', 'u', { ...client, reglements: [{ compteId: 'c411', ligneIds: ['xF'], montant: 34_800_000 }] })).rejects.toThrow(/dépasse le reste dû \(14800000\.00\).*lettrage partiel b, qui en a déjà réglé 20000000\.00/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('14 800 000 · ACCEPTÉ, et le règlement COMPLÈTE le groupe au lieu d’en ouvrir un second', async () => {
        const { service, creer, completer, lettrerManuel } = monterPartiel();
        const r = await service.enregistrer('t', 'u', { ...client, reglements: [{ compteId: 'c411', ligneIds: ['xF'], montant: 14_800_000 }] });
        const piece = creer.mock.calls[0][2];
        expect(piece.lignes.find((l) => l.compteId === 'c411')).toMatchObject({ credit: 14_800_000 });
        expect(completer).toHaveBeenCalledWith('t', 'G', [`p1-${piece.lignes.findIndex((l) => l.compteId === 'c411')}`], {
            borne: { soldeAttendu: 14_800_000, sensDesFactures: 'DEBIT', deviseId: null },
        });
        expect(lettrerManuel).not.toHaveBeenCalled();
        expect(r.reglements[0]).toMatchObject({ montant: 14_800_000, partiel: false, lettre: 'B' });
    });
    it('sans montant, le dû servi est le RESTE · 14 800 000, jamais la facture entière', async () => {
        const { service, creer } = monterPartiel();
        await service.enregistrer('t', 'u', { ...client, reglements: [{ compteId: 'c411', ligneIds: ['xF'] }] });
        const piece = creer.mock.calls[0][2];
        expect(piece.lignes.find((l) => l.compteId === 'c411')).toMatchObject({ credit: 14_800_000 });
    });
    it('l’acompte du groupe n’est pas une facture · rien n’y est dû', async () => {
        const { service } = monterPartiel();
        await expect(service.enregistrer('t', 'u', { ...client, reglements: [{ compteId: 'c411', ligneIds: ['xA'] }] })).rejects.toThrow(/Rien n'est dû/);
    });
    it('un groupe verrouillé, ou à cheval de deux exercices · refus nommé avec son issue', async () => {
        const verrouille = monterPartiel({ verrouille: true });
        await expect(verrouille.service.enregistrer('t', 'u', { ...client, reglements: [{ compteId: 'c411', ligneIds: ['xF'] }] })).rejects.toThrow(/lettrage partiel b, verrouillé · déverrouillez-le/);
        const aCheval = monterPartiel();
        aCheval.lignes.find((l) => l.id === 'xA').ecriture = { ...N1, exerciceId: 'avant' };
        await expect(aCheval.service.enregistrer('t', 'u', { ...client, reglements: [{ compteId: 'c411', ligneIds: ['xF'] }] })).rejects.toThrow(/touche un autre exercice.*Interrogation et lettrage/);
    });
    it('l’imputation légale portera le règlement sur une autre facture du groupe · avertissement nommé', async () => {
        const m = monter([], [], {}, [{ id: 'K', code: 'D', statut: 'PARTIEL' }]);
        const ecr = (date, libelle) => ({ ...N1, date: new Date(date), libelle });
        m.lignes.push({ id: 'F1', compteId: 'c411', debit: 10_000, credit: 0, lettrageId: 'K', compte: { numero: '41110000', intitule: 'Client K', lettrable: true }, ecriture: ecr('2026-01-10', 'Facture F1') }, { id: 'F2', compteId: 'c411', debit: 5_000, credit: 0, lettrageId: 'K', compte: { numero: '41110000', intitule: 'Client K', lettrable: true }, ecriture: ecr('2026-02-10', 'Facture F2') }, { id: 'AC', compteId: 'c411', debit: 0, credit: 8_000, lettrageId: 'K', compte: { numero: '41110000', intitule: 'Client K', lettrable: true }, ecriture: ecr('2026-03-10', 'Acompte') });
        const r = await m.service.enregistrer('t', 'u', { ...client, reglements: [{ compteId: 'c411', ligneIds: ['F2'], montant: 5_000 }] });
        expect(r.avertissements.join(' ')).toMatch(/lettrage partiel d · le règlement s’inscrit d’abord .*2000\.00 sur « Facture F1 » du 2026-01-10, avant la facture choisie/);
        expect(r.avertissements.join(' ')).toMatch(/art\. 154.*qui porte 2000\.00 sur « Facture F1 » du 2026-01-10 de ce règlement/);
    });
    it('fournisseur · l’ordre de virement imprime le reste du lettrage partiel', async () => {
        const m = monter([], [], {}, [{ id: 'H', code: 'C', statut: 'PARTIEL' }]);
        m.lignes.push({ id: 'yF', compteId: 'c401', debit: 0, credit: 1_000_000, lettrageId: 'H', compte: { numero: '40110000', intitule: 'Fournisseur A', lettrable: true }, ecriture: N1 }, { id: 'yA', compteId: 'c401', debit: 400_000, credit: 0, lettrageId: 'H', compte: { numero: '40110000', intitule: 'Fournisseur A', lettrable: true }, ecriture: N1 });
        await m.service.enregistrer('t', 'u', { ...base, ordreVirement: true, reglements: [{ compteId: 'c401', ligneIds: ['yF'] }] }, 'compta@exemple.cd');
        expect(m.ordres.creer).toHaveBeenCalledWith('t', 'compta@exemple.cd', 'bq', '2026-09-25', expect.anything(), [
            expect.objectContaining({ compteId: 'c401', montant: 600_000 }),
        ]);
        expect(m.completer).toHaveBeenCalledWith('t', 'H', [expect.any(String)], { borne: { soldeAttendu: -600_000, sensDesFactures: 'CREDIT', deviseId: null } });
    });
});
describe('Échéances · une facture d’un lettrage partiel est servie pour son reste', () => {
    it('le reste et ce que le groupe a réglé, pour le client de la simulation', async () => {
        const facture = ligneEcheance('xF', 0, { journal: { code: 'OD' } }, {
            compteId: 'c411',
            debit: 34_800_000,
            lettrageId: 'G',
            compte: { id: 'c411', numero: '41110000', intitule: 'Client K', lettrable: true, tiersCompte: null, modeReportANouveau: 'DETAIL' },
        });
        const acompte = ligneEcheance('xA', 0, { journal: { code: 'OD' } }, {
            compteId: 'c411',
            credit: 20_000_000,
            lettrageId: 'G',
            compte: { id: 'c411', numero: '41110000', intitule: 'Client K', lettrable: true, tiersCompte: null, modeReportANouveau: 'DETAIL' },
        });
        const { service } = echeancier([facture, acompte], [], [{ id: 'G', code: 'B', statut: 'PARTIEL', compteId: 'c411' }]);
        const [g] = await service.echeances('t', 'ex', 'CLIENT');
        expect(g.lignes).toHaveLength(1);
        expect(g.lignes[0]).toMatchObject({ id: 'xF', montant: 14_800_000, regleParLettragePartiel: { groupe: 'b', montant: 20_000_000 } });
    });
});
describe('le mode de règlement du lot (ligne sage-l2, fonction 1)', () => {
    it('posé sur chaque ligne de chaque pièce, le tiers soldé comme la trésorerie', async () => {
        const { service, creer } = monter();
        await service.enregistrer('t', 'u', { ...base, modeReglementId: 'vir', reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] });
        expect(creer.mock.calls[0][2].lignes).toEqual([
            expect.objectContaining({ compteId: 'c401', debit: 600, modeReglementId: 'vir' }),
            expect.objectContaining({ compteId: 'c521', credit: 600, modeReglementId: 'vir' }),
        ]);
    });
    it('le mode d’un autre dossier est refusé AVANT toute pièce', async () => {
        const { service, creer } = monter();
        await expect(service.enregistrer('t', 'u', { ...base, modeReglementId: 'inconnu', reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] })).rejects.toThrow('introuvable');
        expect(creer).not.toHaveBeenCalled();
    });
    it('art. 59 bis · une facture de 1 500 000 payée en espèces par un dossier assujetti est AVERTIE, jamais refusée', async () => {
        const { service, creer, lignes, prisma } = monter();
        lignes.find((l) => l.id === 'f1').credit = 1_500_000;
        prisma.tenant.findFirst.mockResolvedValue({ assujettiTva: true, assujettissementTvaRepondu: true });
        const r = await service.enregistrer('t', 'u', { ...base, modeReglementId: 'esp', reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] });
        expect(creer).toHaveBeenCalledTimes(1);
        expect(r.avertissements.join(' ')).toMatch(/art\. 59 bis.*art\. 74 bis/);
    });
    it('art. 59 bis · deux échéances sous le seuil se lisent sur leur PIÈCE, SOUS CONDITION, nommées une fois (M3)', async () => {
        const { service, lignes, prisma } = monter();
        for (const id of ['f1', 'f2']) {
            const l = lignes.find((x) => x.id === id);
            l.credit = 600_000;
            l.ecritureId = 'eA';
        }
        prisma.tenant.findFirst.mockResolvedValue({ assujettiTva: true, assujettissementTvaRepondu: true });
        const r = await service.enregistrer('t', 'u', { ...base, modeReglementId: 'esp', reglements: [{ compteId: 'c401', ligneIds: ['f1', 'f2'] }] });
        const dit = r.avertissements.join(' ');
        expect(dit).toMatch(/1\s200\s000,00, si ses lignes au compte sont les échéances d’une même facture/);
        expect(dit).toMatch(/est une transaction/);
        expect(dit.match(/art\. 59 bis/g)).toHaveLength(1);
    });
    it('art. 59 bis · la même facture payée par virement ne dit rien', async () => {
        const { service, lignes, prisma } = monter();
        lignes.find((l) => l.id === 'f1').credit = 1_500_000;
        prisma.tenant.findFirst.mockResolvedValue({ assujettiTva: true, assujettissementTvaRepondu: true });
        const r = await service.enregistrer('t', 'u', { ...base, modeReglementId: 'vir', reglements: [{ compteId: 'c401', ligneIds: ['f1'] }] });
        expect(r.avertissements.join(' ')).not.toMatch(/59 bis/);
    });
});
describe('l’escompte et l’écart de règlement (ligne sage-l2, fonction 36)', () => {
    const PLAN = [
        { id: 'c773', numero: '77300000', intitule: 'Escomptes obtenus' },
        { id: 'c673', numero: '67300000', intitule: 'Escomptes accordés' },
        { id: 'c6588', numero: '65880000', intitule: 'Autres charges diverses' },
    ];
    function avecDossier(seuil, plan = PLAN, assujetti = true) {
        const m = monter();
        m.prisma.tenant.findFirst.mockResolvedValue({
            referentiel: 'SYSCOHADA',
            seuilEcartReglement: seuil,
            assujettiTva: assujetti,
            assujettissementTvaRepondu: true,
        });
        m.prisma.compte = {
            findMany: jest.fn(async ({ where }) => where.tenantId === 't' ? plan.filter((c) => c.numero.startsWith(where.numero.startsWith)) : []),
        };
        return m;
    }
    it('escompte obtenu · le 401 soldé de 600, 588 payés, 12 au 773 ; le lettrage est complet', async () => {
        const { service, creer, lettrerManuel } = avecDossier(null);
        const r = await service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'], escompte: 12 }] });
        expect(creer.mock.calls[0][2].lignes).toEqual([
            expect.objectContaining({ compteId: 'c401', debit: 600 }),
            expect.objectContaining({ compteId: 'c521', credit: 588 }),
            expect.objectContaining({ compteId: 'c773', credit: 12 }),
        ]);
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c401', ['f1', 'p1-0'], 'u', { autoriserPartiel: false });
        expect(r.reglements[0]).toEqual(expect.objectContaining({ montant: 588, escompte: 12, partiel: false }));
        expect(r.avertissements.join(' ')).toMatch(/l'escompte de 12\.00 ne sort de la base.*art\. 29, 1°/);
    });
    it('le mode du règlement va au tiers et à la trésorerie, jamais à l’escompte (second tour, m2)', async () => {
        const { service, creer } = avecDossier(null);
        await service.enregistrer('t', 'u', { ...base, modeReglementId: 'vir', reglements: [{ compteId: 'c401', ligneIds: ['f1'], escompte: 12 }] });
        const lignes = creer.mock.calls[0][2].lignes;
        expect(lignes.map((l) => [l.compteId, l.modeReglementId ?? null])).toEqual([
            ['c401', 'vir'],
            ['c521', 'vir'],
            ['c773', null],
        ]);
    });
    it('un dossier déclaré non assujetti n’a aucune taxe à dire', async () => {
        const { service } = avecDossier(null, PLAN, false);
        const r = await service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'], escompte: 12 }] });
        expect(r.avertissements.join(' ')).not.toMatch(/TVA|base/);
    });
    it('le reste qu’un client ne paie pas, sous le seuil · 0,50 au 6588, le 411 soldé de 500', async () => {
        const { service, creer, lettrerManuel } = avecDossier(1);
        const r = await service.enregistrer('t', 'u', {
            ...base,
            sens: 'CLIENT',
            reglements: [{ compteId: 'c411', ligneIds: ['k1'], montant: 499.5, solderEcart: true }],
        });
        expect(creer.mock.calls[0][2].lignes.map((l) => [l.compteId, l.debit ?? 0, l.credit ?? 0])).toEqual([
            ['c521', 499.5, 0],
            ['c6588', 0.5, 0],
            ['c411', 0, 500],
        ]);
        expect(lettrerManuel).toHaveBeenCalledWith('t', 'c411', ['k1', 'p1-2'], 'u', { autoriserPartiel: false });
        expect(r.reglements[0]).toEqual(expect.objectContaining({ montant: 499.5, ecartReglement: 0.5 }));
        expect(r.avertissements.join(' ')).toMatch(/l'écart de 0\.50 abandonné au client ne réduit pas la TVA facturée/);
    });
    it('trop-payé au fournisseur soldé · l’ordre de virement porte le payé, pas la dette', async () => {
        const { service, creer, ordres } = avecDossier(1);
        await service.enregistrer('t', 'u', { ...base, ordreVirement: true, reglements: [{ compteId: 'c401', ligneIds: ['f1'], montant: 600.3, solderEcart: true }] });
        expect(creer.mock.calls[0][2].lignes.map((l) => [l.compteId, l.debit ?? 0, l.credit ?? 0])).toEqual([
            ['c401', 600, 0],
            ['c6588', 0.3, 0],
            ['c521', 0, 600.3],
        ]);
        expect(ordres.creer.mock.calls[0][5]).toEqual([expect.objectContaining({ compteId: 'c401', montant: 600.3 })]);
    });
    it('sans seuil fixé, l’écart est refusé AVANT toute pièce, le geste nommé', async () => {
        const { service, creer } = avecDossier(null);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['k1'], montant: 499.5, solderEcart: true }] })).rejects.toThrow(/41110000 · Aucun seuil d'écart de règlement n'est fixé pour ce dossier · fixez-le dans Paramètres du dossier/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('deux comptes d’escompte possibles · le choix est demandé avant toute pièce, puis honoré', async () => {
        const plan = [...PLAN, { id: 'c7731', numero: '77300001', intitule: 'Escomptes · banque' }, { id: 'c7732', numero: '77300002', intitule: 'Escomptes · caisse' }];
        const { service, creer } = avecDossier(null, plan);
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'], escompte: 12 }] })).rejects.toThrow(/Plusieurs comptes sous le 773 pour l'escompte obtenu \(77300001, 77300002\)/);
        expect(creer).not.toHaveBeenCalled();
        await service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'], escompte: 12, compteEscompteId: 'c7732' }] });
        expect(creer.mock.calls[0][2].lignes).toContainEqual(expect.objectContaining({ compteId: 'c7732', credit: 12 }));
    });
    it('jamais avec la part désignée de chaque facture, ni un compte sans son geste', async () => {
        const { service, creer } = avecDossier(1);
        await expect(service.enregistrer('t', 'u', {
            ...base,
            ordreVirement: true,
            reglements: [{ compteId: 'c401', ligneIds: ['f1', 'f2'], montant: 990, escompte: 10, imputation: [{ ligneId: 'f1', montant: 600 }, { ligneId: 'f2', montant: 390 }] }],
        })).rejects.toThrow(/ne se passe pas avec la part désignée/);
        await expect(service.enregistrer('t', 'u', { ...base, reglements: [{ compteId: 'c401', ligneIds: ['f1'], compteEcartId: 'c6588' }] })).rejects.toThrow(/n’a d’objet qu’avec « Solder l’écart »/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('le trop-perçu d’un client reste refusé, même avec « Solder l’écart » (Code civil, Livre III, art. 252)', async () => {
        const { service, creer } = avecDossier(1);
        await expect(service.enregistrer('t', 'u', { ...base, sens: 'CLIENT', reglements: [{ compteId: 'c411', ligneIds: ['k1'], montant: 500.4, solderEcart: true }] })).rejects.toThrow(/art\. 252/);
        expect(creer).not.toHaveBeenCalled();
    });
});
describe('le mode de règlement sur les seules lignes qui paient', () => {
    it('le tiers et la trésorerie le reçoivent, l’escompte et l’écart non', () => {
        const lignes = (0, reglements_service_1.avecLeMode)('vir', ['c401', 'c521'], [
            { compteId: 'c401', debit: 1000 },
            { compteId: 'c521', credit: 980 },
            { compteId: 'c773', credit: 20 },
            { compteId: 'c6588', debit: 0.5 },
        ]);
        expect(lignes.map((l) => [l.compteId, l.modeReglementId ?? null])).toEqual([
            ['c401', 'vir'],
            ['c521', 'vir'],
            ['c773', null],
            ['c6588', null],
        ]);
        expect((0, reglements_service_1.avecLeMode)(null, ['c401'], [{ compteId: 'c401' }])).toEqual([{ compteId: 'c401' }]);
    });
});
//# sourceMappingURL=reglements.spec.js.map