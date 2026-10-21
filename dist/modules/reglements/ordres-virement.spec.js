"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ordres_virement_service_1 = require("./ordres-virement.service");
const ribJournal = {
    id: 'rb',
    abrege: 'RAW-CDF',
    devise: 'CDF',
    codeBic: 'RAWBCDKI',
    codeBanque: null,
    codeGuichet: null,
    numeroCompte: '0001',
    cle: null,
    iban: null,
    banque: { intitule: 'Rawbank' },
    journal: { code: 'BQ' },
};
function comptes(ribs) {
    return [
        { id: 'c401', numero: '40110001', tiersCompte: { tiers: { id: 'tA', code: 'F001', nom: 'Fournisseur A', ribs: ribs.tA ?? [] } } },
        { id: 'c402', numero: '40110002', tiersCompte: { tiers: { id: 'tB', code: 'F002', nom: 'Fournisseur B', ribs: ribs.tB ?? [] } } },
        { id: 'c409', numero: '40110009', tiersCompte: null },
    ];
}
function monter(opts = {}) {
    const prisma = {
        tenant: { findUnique: jest.fn(async () => ({ visaRibs: opts.visaRibs === true })) },
        ribBanque: { findFirst: jest.fn(async () => (opts.rib === undefined ? ribJournal : opts.rib)) },
        journal: { findFirst: jest.fn(async () => ({ code: 'BQ' })) },
        compte: { findMany: jest.fn(async () => comptes(opts.ribs ?? {})) },
    };
    return { service: new ordres_virement_service_1.OrdresVirementService(prisma), prisma };
}
const principal = (extra = {}) => ({
    banque: 'Equity BCDC',
    titulaire: null,
    iban: null,
    codeBanque: '00011',
    codeGuichet: null,
    numeroCompte: '777',
    cle: '12',
    codeBic: null,
    ...extra,
});
describe("préparer l'ordre · le visa des RIB, quand le dossier l'exige (tiers/visa-rib.ts)", () => {
    const vise = { visePar: 'u2', viseLe: new Date('2026-10-21T10:00:00Z') };
    it("sans l'option, un RIB principal non visé part comme avant", async () => {
        const { service } = monter({ ribs: { tA: [principal()] } });
        const p = await service.preparer('t', 'bq', ['c401']);
        expect(p.beneficiaires.get('c401')?.banque).toBe('Equity BCDC');
    });
    it("avec l'option, refuse AVANT toute pièce et nomme chaque tiers dont le RIB principal n'est pas visé", async () => {
        const { service } = monter({ visaRibs: true, ribs: { tA: [principal()], tB: [principal({ ...vise })] } });
        await expect(service.preparer('t', 'bq', ['c401', 'c402'])).rejects.toThrow(/F001 · Fournisseur A n'est pas visé.*autre que celui qui l'a saisi.*fiche du tiers/);
        await expect(service.preparer('t', 'bq', ['c401', 'c402'])).rejects.not.toThrow(/F002/);
    });
    it("avec l'option, un RIB visé part, et l'ordre recopie ce qui a été visé", async () => {
        const { service } = monter({ visaRibs: true, ribs: { tA: [principal({ ...vise, titulaire: 'SARL A' })] } });
        const p = await service.preparer('t', 'bq', ['c401']);
        expect(p.beneficiaires.get('c401')).toMatchObject({ beneficiaire: 'SARL A', coordonnees: '00011 777 12' });
    });
    it("un dossier introuvable n'est pas un dossier qui n'exige rien · le contrôle se ferme", async () => {
        const { service, prisma } = monter({ ribs: { tA: [principal()] } });
        prisma.tenant.findUnique.mockResolvedValueOnce(null);
        await expect(service.preparer('t', 'bq', ['c401'])).rejects.toThrow(/Dossier introuvable/);
    });
    it("un visa à moitié posé (auteur sans date) n'est pas un visa", async () => {
        const { service } = monter({ visaRibs: true, ribs: { tA: [principal({ visePar: 'u2', viseLe: null })] } });
        await expect(service.preparer('t', 'bq', ['c401'])).rejects.toThrow(/n'est pas visé/);
    });
});
describe("préparer l'ordre · tout ce qu'il exige, avant la première pièce", () => {
    it('recopie le donneur (RIB du journal) et le RIB principal de chaque tiers', async () => {
        const { service, prisma } = monter({ ribs: { tA: [principal({ titulaire: 'SARL A' })], tB: [principal({ iban: 'GB82WEST12345698765432' })] } });
        const p = await service.preparer('t', 'bq', ['c401', 'c402']);
        expect(p.donneur).toEqual({ banque: 'Rawbank', coordonnees: '0001', codeBic: 'RAWBCDKI' });
        expect(p.beneficiaires.get('c401')).toMatchObject({ tiersId: 'tA', beneficiaire: 'SARL A', coordonnees: '00011 777 12' });
        expect(p.beneficiaires.get('c402')).toMatchObject({ beneficiaire: 'Fournisseur B', coordonnees: 'IBAN GB82 WEST 1234 5698 7654 32' });
        const select = prisma.compte.findMany.mock.calls[0][0];
        expect(select.select.tiersCompte.select.tiers.select.ribs).toEqual({ where: { tenantId: 't', estPrincipal: true }, orderBy: { createdAt: 'asc' } });
    });
    it("refuse un journal sans RIB · l'ordre n'aurait pas de compte à débiter", async () => {
        const { service } = monter({ rib: null, ribs: { tA: [principal()] } });
        await expect(service.preparer('t', 'bq', ['c401'])).rejects.toThrow(/Aucun RIB .* journal BQ/);
    });
    it('refuse un compte donneur tenu dans une autre monnaie que la monnaie de tenue', async () => {
        const { service } = monter({ rib: { ...ribJournal, devise: 'USD' }, ribs: { tA: [principal()] } });
        await expect(service.preparer('t', 'bq', ['c401'])).rejects.toThrow(/USD/);
    });
    it('nomme TOUS les tiers sans RIB principal et tout compte sans tiers, en un seul refus', async () => {
        const { service } = monter({ ribs: { tA: [principal()] } });
        await expect(service.preparer('t', 'bq', ['c401', 'c402', 'c409'])).rejects.toThrow(/F002 · Fournisseur B n'a pas de RIB principal ; le compte 40110009 n'est rattaché à aucun tiers/);
    });
});
describe("créer, imprimer, annuler", () => {
    function monterOrdre(statut) {
        const ordre = { id: 'o1', statut, lignes: [], journal: { code: 'BQ', intitule: 'Banque' } };
        const update = jest.fn(async () => ordre);
        const lignesUpdate = jest.fn(async () => ({ count: 2 }));
        const prisma = {
            ordreVirement: { findFirst: jest.fn(async () => ordre), update },
            ligneOrdreVirement: { updateMany: lignesUpdate },
            $transaction: jest.fn(async (fn) => fn(prisma)),
        };
        return { service: new ordres_virement_service_1.OrdresVirementService(prisma), update, lignesUpdate };
    }
    it("la PREMIÈRE impression passe l'ordre à IMPRIMÉ et en garde l'auteur ; une réimpression ne change que le compteur", async () => {
        const a = monterOrdre('A_IMPRIMER');
        await a.service.imprimer('t', 'o1', 'x@y.cd');
        expect(a.update).toHaveBeenCalledWith({
            where: { id: 'o1' },
            data: expect.objectContaining({ nombreImpressions: { increment: 1 }, statut: 'IMPRIME', premiereImpressionPar: 'x@y.cd' }),
        });
        const b = monterOrdre('IMPRIME');
        await b.service.imprimer('t', 'o1', 'z@y.cd');
        expect(b.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { nombreImpressions: { increment: 1 } } });
    });
    it('un ordre annulé ne se réimprime pas', async () => {
        const { service, update } = monterOrdre('ANNULE');
        await expect(service.imprimer('t', 'o1', 'x@y.cd')).rejects.toThrow(/annulé/);
        expect(update).not.toHaveBeenCalled();
    });
    it('annuler exige un motif et LIBÈRE les pièces sans les défaire', async () => {
        const sans = monterOrdre('IMPRIME');
        await expect(sans.service.annuler('t', 'o1', 'x@y.cd', ' ')).rejects.toThrow(/motif/);
        expect(sans.lignesUpdate).not.toHaveBeenCalled();
        const avec = monterOrdre('IMPRIME');
        await avec.service.annuler('t', 'o1', 'x@y.cd', 'rejet de la banque');
        expect(avec.lignesUpdate).toHaveBeenCalledWith({ where: { tenantId: 't', ordreId: 'o1' }, data: { ecritureId: null } });
        expect(avec.update).toHaveBeenCalledWith({
            where: { id: 'o1' },
            data: expect.objectContaining({ statut: 'ANNULE', annulePar: 'x@y.cd', motifAnnulation: 'rejet de la banque' }),
        });
    });
    it('numérote en continu par dossier et rejoue sur le numéro suivant quand deux créations se croisent', async () => {
        let dernier = 4;
        let collision = true;
        const create = jest.fn(async ({ data }) => {
            if (collision) {
                collision = false;
                dernier = 5;
                throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
            }
            return { id: 'o', numero: data.numero, total: data.total };
        });
        const tx = { ordreVirement: { aggregate: jest.fn(async () => ({ _max: { numero: dernier } })), create } };
        const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
        const service = new ordres_virement_service_1.OrdresVirementService(prisma);
        const preparation = {
            donneur: { banque: 'Rawbank', coordonnees: '0001', codeBic: null },
            beneficiaires: new Map([['c401', { tiersId: 'tA', salarieId: null, beneficiaire: 'A', banque: 'B', coordonnees: '1', codeBic: null }]]),
        };
        const r = await service.creer('t', 'x@y.cd', 'bq', '2026-09-25', preparation, [
            { compteId: 'c401', montant: 100.1, reference: null, ecritureId: 'e1', pieceReglement: 'BQ 7' },
            { compteId: 'c401', montant: 0.2, reference: null, ecritureId: 'e2', pieceReglement: 'BQ 8' },
        ]);
        expect(r.numero).toBe(6);
        expect(r.total).toBe(100.3);
        const lignes = create.mock.calls[1][0].data.lignes.create;
        expect(lignes.map((l) => [l.tiersId, l.ecritureId])).toEqual([['tA', 'e1'], ['tA', 'e2']]);
    });
});
describe('la liste des ordres est une tranche qui se dit', () => {
    function monterListe(nombre, aImprimer) {
        const tous = Array.from({ length: nombre }, (_, i) => ({
            id: `o${i + 1}`,
            tenantId: 't',
            numero: i + 1,
            statut: aImprimer.includes(i + 1) ? 'A_IMPRIMER' : 'IMPRIME',
        }));
        tous.push({ id: 'x', tenantId: 'autre', numero: 1, statut: 'A_IMPRIMER' });
        const garde = (where) => tous.filter((o) => o.tenantId === where.tenantId && (where.statut === undefined || o.statut === where.statut));
        const prisma = {
            ordreVirement: {
                findMany: jest.fn(async ({ where, orderBy, take }) => {
                    expect(orderBy).toEqual({ numero: 'desc' });
                    return [...garde(where)].sort((a, b) => b.numero - a.numero).slice(0, take);
                }),
                count: jest.fn(async ({ where }) => garde(where).length),
            },
        };
        return { service: new ordres_virement_service_1.OrdresVirementService(prisma), prisma };
    }
    it('au-delà du plafond · les plus récents, le total du dossier, et les ordres à imprimer restés hors de la tranche', async () => {
        const { service, prisma } = monterListe(ordres_virement_service_1.PLAFOND_ORDRES_LISTES + 2, [1, ordres_virement_service_1.PLAFOND_ORDRES_LISTES + 2]);
        const r = await service.lister('t');
        expect(prisma.ordreVirement.findMany.mock.calls[0][0].take).toBe(ordres_virement_service_1.PLAFOND_ORDRES_LISTES);
        expect(r.ordres).toHaveLength(ordres_virement_service_1.PLAFOND_ORDRES_LISTES);
        expect(r.ordres[0].numero).toBe(ordres_virement_service_1.PLAFOND_ORDRES_LISTES + 2);
        expect(r.total).toBe(ordres_virement_service_1.PLAFOND_ORDRES_LISTES + 2);
        expect(r.tronque).toBe(true);
        expect(r.ordres.some((o) => o.numero === 1)).toBe(false);
        expect(r.enAttenteImpression).toBe(2);
    });
    it('une liste entière ne se dit pas tronquée', async () => {
        const { service } = monterListe(3, [2]);
        const r = await service.lister('t');
        expect(r).toMatchObject({ total: 3, tronque: false, enAttenteImpression: 1, statut: null });
        expect(r.ordres.map((o) => o.numero)).toEqual([3, 2, 1]);
    });
    it('filtrée par état · la liste et son total ne portent que cet état, et le filtre est rendu', async () => {
        const { service, prisma } = monterListe(6, [2, 5]);
        const r = await service.lister('t', 'A_IMPRIMER');
        expect(prisma.ordreVirement.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't', statut: 'A_IMPRIMER' });
        expect(r.ordres.map((o) => o.numero)).toEqual([5, 2]);
        expect(r).toMatchObject({ total: 2, tronque: false, enAttenteImpression: 2, statut: 'A_IMPRIMER' });
    });
    it('un filtre qui ne garde qu’une partie du dossier ne se dit pas tronqué pour autant', async () => {
        const { service } = monterListe(ordres_virement_service_1.PLAFOND_ORDRES_LISTES + 2, [1, 3]);
        const r = await service.lister('t', 'A_IMPRIMER');
        expect(r.ordres.map((o) => o.numero)).toEqual([3, 1]);
        expect(r).toMatchObject({ total: 2, tronque: false });
    });
    it('filtrée au-delà du plafond · la tranche se dit, les ordres à imprimer restent comptés sur le dossier', async () => {
        const { service } = monterListe(ordres_virement_service_1.PLAFOND_ORDRES_LISTES + 3, [1]);
        const r = await service.lister('t', 'IMPRIME');
        expect(r.ordres).toHaveLength(ordres_virement_service_1.PLAFOND_ORDRES_LISTES);
        expect(r.ordres.every((o) => o.statut === 'IMPRIME')).toBe(true);
        expect(r).toMatchObject({ total: ordres_virement_service_1.PLAFOND_ORDRES_LISTES + 2, tronque: true, statut: 'IMPRIME' });
        expect(r.enAttenteImpression).toBe(1);
    });
    it('un état inconnu est refusé avant toute lecture, jamais ignoré', async () => {
        const { service, prisma } = monterListe(3, [2]);
        await expect(service.lister('t', 'INCONNU')).rejects.toThrow(/État d'ordre de virement inconnu : INCONNU/);
        expect(prisma.ordreVirement.findMany).not.toHaveBeenCalled();
        expect(prisma.ordreVirement.count).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=ordres-virement.spec.js.map