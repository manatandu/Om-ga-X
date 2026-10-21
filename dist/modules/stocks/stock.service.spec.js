"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const stock_service_1 = require("./stock.service");
const COMPTE_STOCK = { id: 'c-31', numero: '31100000', intitule: 'Marchandises A' };
function service(options = {}) {
    const creerEcriture = jest.fn().mockResolvedValue({ id: 'e-1', numeroPiece: 'OD-0001' });
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: options.referentiel ?? client_1.Referentiel.SYSCOHADA,
                methodeInventaireStocks: 'methode' in options ? options.methode : client_1.MethodeInventaireStocks.INTERMITTENT,
            }),
        },
        compte: {
            findMany: jest
                .fn()
                .mockResolvedValueOnce(options.comptes ?? [COMPTE_STOCK])
                .mockResolvedValue(options.comptesParNumero ?? [
                { id: 'c-31', numero: '31100000', typeCompte: 'DETAIL' },
                { id: 'c-6031', numero: '60310000', typeCompte: 'DETAIL' },
            ]),
        },
        campagneInventaire: {
            findFirst: jest
                .fn()
                .mockResolvedValue('campagne' in options
                ? options.campagne
                : { id: 'camp-1', libelle: 'Inventaire 2026', dateInventaire: new Date('2026-12-31') }),
        },
        ficheInventaire: {
            findMany: jest
                .fn()
                .mockResolvedValue(options.fiches ?? [{ compteId: 'c-31', valeurInventaire: 450_000 }]),
        },
        journal: {
            findFirst: jest.fn().mockResolvedValue('journal' in options ? options.journal : { id: 'j-1' }),
        },
    };
    const ecritures = {
        balance: jest.fn().mockResolvedValue({
            lignes: (options.soldes ?? [{ compteId: 'c-31', solde: 300_000 }]).map((s) => ({
                compteId: s.compteId,
                solde: s.solde,
            })),
            totaux: { debit: 0, credit: 0 },
        }),
        creer: creerEcriture,
    };
    return { svc: new stock_service_1.StockService(prisma, ecritures), prisma: prisma, creerEcriture };
}
describe('Stocks · les trois états du dossier, et deux ne sont pas des erreurs', () => {
    it('une méthode NON DÉCLARÉE rend une réserve, pas une liste vide', () => {
        return service({ methode: null })
            .svc.proposer('t-1', 'ex-1')
            .then((etat) => {
            expect(etat.methode).toBeNull();
            expect(etat.proposition).toBeNull();
            expect(etat.reserve).toContain('inventaire permanent');
            expect(etat.reserve).toContain('intermittent');
        });
    });
    it('un dossier en inventaire PERMANENT n’a AUCUNE variation à passer', async () => {
        const etat = await service({ methode: client_1.MethodeInventaireStocks.PERMANENT }).svc.proposer('t-1', 'ex-1');
        expect(etat.proposition).toBeNull();
        expect(etat.reserve).toContain('deux fois');
        expect(etat.reserve).toContain('PERMANENT');
    });
    it('un dossier en INTERMITTENT reçoit la proposition chiffrée', async () => {
        const etat = await service().svc.proposer('t-1', 'ex-1');
        expect(etat.reserve).toBeNull();
        expect(etat.proposition?.retenues).toHaveLength(1);
        expect(etat.proposition?.totaux.debit).toBe(etat.proposition?.totaux.credit);
    });
});
describe('Stocks · ce que le service LIT du dossier', () => {
    it('les comptes viennent du PLAN, pas de la balance', async () => {
        const { svc, prisma } = service({ soldes: [] });
        const etat = await svc.proposer('t-1', 'ex-1');
        const where = prisma.compte.findMany.mock
            .calls[0][0].where;
        expect(where).toEqual(expect.objectContaining({ tenantId: 't-1', classe: 'CLASSE_3', typeCompte: 'DETAIL' }));
        expect(etat.proposition?.retenues[0].soldeInitial).toBe(0);
        expect(etat.proposition?.retenues[0].stockFinal).toBe(450_000);
    });
    it('la SOURCE nomme la campagne d’inventaire et sa date', async () => {
        const etat = await service().svc.proposer('t-1', 'ex-1');
        expect(etat.proposition?.retenues[0].source).toContain('Inventaire 2026');
        expect(etat.proposition?.retenues[0].source).toContain('2026-12-31');
    });
    it('plusieurs fiches sur un même compte s’ADDITIONNENT', async () => {
        const etat = await service({
            fiches: [
                { compteId: 'c-31', valeurInventaire: 300_000 },
                { compteId: 'c-31', valeurInventaire: 150_000 },
            ],
        }).svc.proposer('t-1', 'ex-1');
        expect(etat.proposition?.retenues[0].stockFinal).toBe(450_000);
    });
    it('UNE SEULE FICHE NON VALORISÉE rend le compte entier « pas encore compté »', async () => {
        const etat = await service({
            fiches: [
                { compteId: 'c-31', valeurInventaire: 300_000 },
                { compteId: 'c-31', valeurInventaire: null },
            ],
        }).svc.proposer('t-1', 'ex-1');
        expect(etat.proposition?.retenues).toHaveLength(0);
        expect(etat.proposition?.refusees[0].motif).toBe('STOCK_FINAL_NON_COMPTE');
    });
    it('sans campagne d’inventaire, aucun stock final n’est inventé', async () => {
        const etat = await service({ campagne: null }).svc.proposer('t-1', 'ex-1');
        expect(etat.proposition?.refusees[0].motif).toBe('STOCK_FINAL_NON_COMPTE');
    });
    it('LE RÉFÉRENTIEL DU DOSSIER commande la nomenclature', async () => {
        const societe = await service({ referentiel: client_1.Referentiel.SYSCOHADA }).svc.proposer('t-1', 'ex-1');
        const association = await service({ referentiel: client_1.Referentiel.SYCEBNL }).svc.proposer('t-1', 'ex-1');
        expect(societe.proposition?.retenues[0].correspondance.intitule).toBe('Marchandises');
        expect(association.proposition?.retenues[0].correspondance.intitule).toBe("Biens liés à l'activité");
    });
});
describe('Stocks · l’enregistrement ne fait pas confiance au client', () => {
    it('REJOUE le calcul et poste ses PROPRES lignes', async () => {
        const { svc, creerEcriture } = service();
        await svc.enregistrer('t-1', 'u-1', {
            exerciceId: 'ex-1',
            journalId: 'j-1',
            date: '2026-12-31',
        });
        const dto = creerEcriture.mock.calls[0][2];
        expect(dto.lignes).toHaveLength(4);
        const debit = dto.lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
        const credit = dto.lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
        expect(debit).toBe(credit);
        expect(debit).toBe(750_000);
    });
    it('REFUSE sur un dossier en inventaire permanent, avec la même réserve', async () => {
        const { svc, creerEcriture } = service({ methode: client_1.MethodeInventaireStocks.PERMANENT });
        await expect(svc.enregistrer('t-1', 'u-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-12-31' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(creerEcriture).not.toHaveBeenCalled();
    });
    it('REFUSE une écriture VIDE plutôt que de la passer', async () => {
        const { svc, creerEcriture } = service({ campagne: null });
        await expect(svc.enregistrer('t-1', 'u-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-12-31' })).rejects.toThrow(/serait vide/);
        expect(creerEcriture).not.toHaveBeenCalled();
    });
    it('REFUSE un journal d’un autre dossier', async () => {
        const { svc } = service({ journal: null });
        await expect(svc.enregistrer('t-1', 'u-1', { exerciceId: 'ex-1', journalId: 'j-autre', date: '2026-12-31' })).rejects.toThrow(/Journal introuvable/);
    });
    it('REFUSE en NOMMANT le compte de variation que le dossier n’a pas ouvert', async () => {
        const { svc } = service({
            comptesParNumero: [{ id: 'c-31', numero: '31100000', typeCompte: 'DETAIL' }],
        });
        await expect(svc.enregistrer('t-1', 'u-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-12-31' })).rejects.toThrow(/6031/);
    });
    it('trouve le compte de variation SEMÉ à huit chiffres · la doublure honore le `where`', async () => {
        const { svc, prisma, creerEcriture } = service();
        const plan = [
            { id: 'c-31', numero: '31100000', typeCompte: 'DETAIL' },
            { id: 'c-6031', numero: '60310000', typeCompte: 'DETAIL' },
        ];
        prisma.compte.findMany = jest
            .fn()
            .mockResolvedValueOnce([COMPTE_STOCK])
            .mockImplementation(async ({ where }) => plan.filter((c) => where.numero.in.includes(c.numero)));
        await svc.enregistrer('t-1', 'u-1', { exerciceId: 'ex-1', journalId: 'j-1', date: '2026-12-31' });
        const comptesPostes = creerEcriture.mock.calls[0][2].lignes.map((l) => l.compteId);
        expect(comptesPostes).toContain('c-6031');
    });
    it('le libellé par défaut nomme le mode d’inventaire', async () => {
        const { svc, creerEcriture } = service();
        await svc.enregistrer('t-1', 'u-1', {
            exerciceId: 'ex-1',
            journalId: 'j-1',
            date: '2026-12-31',
        });
        expect(creerEcriture.mock.calls[0][2].libelle).toContain('intermittent');
    });
});
//# sourceMappingURL=stock.service.spec.js.map