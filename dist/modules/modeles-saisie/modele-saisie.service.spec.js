"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const modele_saisie_service_1 = require("./modele-saisie.service");
function service(options = {}) {
    const cree = jest.fn().mockResolvedValue({ id: 'm-1' });
    const supprime = jest.fn().mockResolvedValue({ id: 'm-1' });
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        ligneModeleSaisie: {
            findMany: jest.fn().mockResolvedValue(options.lignesEnregistrees ?? []),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        compte: {
            findMany: jest.fn(async ({ where } = {}) => where?.estRetenu === false
                ? (options.comptes ?? []).filter((c) => c.estRetenu === false).map((c) => ({ intitule: '', ...c }))
                : (options.comptes ?? [])),
        },
        journal: { findFirst: jest.fn().mockResolvedValue('journal' in options ? options.journal : { id: 'j-1' }) },
        modeleSaisie: {
            findFirst: jest.fn().mockResolvedValue('modele' in options ? options.modele : null),
            findMany: jest.fn().mockResolvedValue([]),
            create: cree,
            update: jest.fn().mockResolvedValue({ id: 'm-1' }),
            delete: supprime,
        },
    };
    prisma.$transaction = (fn) => fn(prisma);
    const client = new Proxy(prisma, {
        get: (cible, nom) => {
            if (!(nom in cible))
                return { groupBy: jest.fn(async () => []) };
            const d = cible[nom];
            if (d && typeof d === 'object' && !('groupBy' in d))
                d.groupBy = jest.fn(async () => []);
            return d;
        },
    });
    return { svc: new modele_saisie_service_1.ModeleSaisieService(client), prisma: prisma, cree, supprime };
}
const DETAIL = (id, numero) => ({ id, numero, typeCompte: 'DETAIL' });
const deuxLignes = [
    { compteId: 'c-1', sens: client_1.SensModeleSaisie.DEBIT },
    { compteId: 'c-2', sens: client_1.SensModeleSaisie.CREDIT },
];
describe('création d’un modèle de saisie', () => {
    it('accepte un squelette à un débit et un crédit', async () => {
        const { svc, cree } = service({ comptes: [DETAIL('c-1', '60110000'), DETAIL('c-2', '40110000')] });
        await svc.creer('t-1', 'u-1', { intitule: 'Achat de marchandises', lignes: deuxLignes });
        expect(cree).toHaveBeenCalledTimes(1);
    });
    it('REFUSE un compte non personnalisé · porté par le modèle, il le deviendrait d’office', async () => {
        const { svc, cree } = service({
            comptes: [DETAIL('c-1', '60110000'), { ...DETAIL('c-2', '62210000'), estRetenu: false, intitule: 'Locations de terrains' }],
        });
        await expect(svc.creer('t-1', 'u-1', { intitule: 'Loyer', lignes: deuxLignes })).rejects.toThrow(/Compte non personnalisé : 62210000 Locations de terrains · un modèle de saisie ne se fait que sur un compte personnalisé/);
        expect(cree).not.toHaveBeenCalled();
    });
    it('REFUSE un compte de totalisation', async () => {
        const { svc } = service({ comptes: [DETAIL('c-1', '60110000'), { id: 'c-2', numero: '40', typeCompte: 'TOTAL' }] });
        await expect(svc.creer('t-1', 'u-1', { intitule: 'Achat', lignes: deuxLignes })).rejects.toThrow(/totalisation/);
    });
    it('REFUSE un modèle qui n’a que des débits', async () => {
        const { svc } = service({ comptes: [DETAIL('c-1', '60110000'), DETAIL('c-2', '60210000')] });
        await expect(svc.creer('t-1', 'u-1', {
            intitule: 'Deux achats',
            lignes: [
                { compteId: 'c-1', sens: client_1.SensModeleSaisie.DEBIT },
                { compteId: 'c-2', sens: client_1.SensModeleSaisie.DEBIT },
            ],
        })).rejects.toThrow(/débit et un crédit/);
    });
    it('REFUSE un compte qui n’est pas du dossier', async () => {
        const { svc } = service({ comptes: [DETAIL('c-1', '60110000')] });
        await expect(svc.creer('t-1', 'u-1', { intitule: 'Achat', lignes: deuxLignes })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('REFUSE un journal étranger au dossier', async () => {
        const { svc } = service({ comptes: [DETAIL('c-1', '6'), DETAIL('c-2', '4')], journal: null });
        await expect(svc.creer('t-1', 'u-1', { intitule: 'Achat', journalId: 'j-autre', lignes: deuxLignes })).rejects.toThrow(/Journal introuvable/);
    });
    it('numérote les lignes dans l’ordre reçu', async () => {
        const { svc, cree } = service({ comptes: [DETAIL('c-1', '6'), DETAIL('c-2', '4')] });
        await svc.creer('t-1', 'u-1', { intitule: 'Achat', lignes: deuxLignes });
        const lignes = cree.mock.calls[0][0].data.lignes.create;
        expect(lignes.map((l) => l.ordre)).toEqual([0, 1]);
    });
    it('un montant absent reste ABSENT · ce n’est pas zéro', async () => {
        const { svc, cree } = service({ comptes: [DETAIL('c-1', '6'), DETAIL('c-2', '4')] });
        await svc.creer('t-1', 'u-1', { intitule: 'Achat', lignes: deuxLignes });
        const lignes = cree.mock.calls[0][0].data.lignes.create;
        expect(lignes.every((l) => l.montant === null)).toBe(true);
    });
});
describe('modification et suppression', () => {
    it('un modèle d’un autre dossier est INTROUVABLE, pas refusé', async () => {
        const { svc } = service({ modele: null });
        await expect(svc.modifier('t-1', 'm-autre', { estActif: false })).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(svc.supprimer('t-1', 'm-autre')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
    it('supprime franchement · un modèle n’est rattaché à aucune écriture', async () => {
        const { svc, supprime } = service({ modele: { id: 'm-1' } });
        await expect(svc.supprimer('t-1', 'm-1')).resolves.toEqual({ supprime: true });
        expect(supprime).toHaveBeenCalledWith({ where: { id: 'm-1' } });
    });
});
describe('diagnostic du tiers · les trois portes le servent', () => {
    const achatSurBanque = [
        { sens: 'DEBIT', compte: { numero: '60110000' } },
        { sens: 'CREDIT', compte: { numero: '52100000' } },
    ];
    it('`lister` rend l’avertissement sur un modèle déjà enregistré', async () => {
        const { svc, prisma } = service();
        prisma.modeleSaisie.findMany.mockResolvedValue([
            {
                id: 'm-1',
                intitule: 'Achat',
                journalId: null,
                journal: null,
                estActif: true,
                lignes: achatSurBanque.map((l, ordre) => ({
                    ordre,
                    compteId: `c-${ordre}`,
                    compte: { id: `c-${ordre}`, numero: l.compte.numero, intitule: '' },
                    sens: l.sens,
                    libelle: null,
                    montant: null,
                })),
            },
        ]);
        const liste = await svc.lister('t-1');
        expect(liste[0].avertissements).toHaveLength(1);
        expect(liste[0].avertissements[0]).toContain('DIRECTEMENT');
    });
    it('`creer` rend l’avertissement avec l’identifiant', async () => {
        const { svc } = service({
            comptes: [DETAIL('c-1', '60110000'), DETAIL('c-2', '52100000')],
            lignesEnregistrees: achatSurBanque,
        });
        const cree = await svc.creer('t-1', 'u-1', {
            intitule: 'Achat',
            lignes: [
                { compteId: 'c-1', sens: client_1.SensModeleSaisie.DEBIT },
                { compteId: 'c-2', sens: client_1.SensModeleSaisie.CREDIT },
            ],
        });
        expect(cree.avertissements).toHaveLength(1);
    });
    it('`modifier` relit les lignes ENREGISTRÉES, même quand le DTO n’en porte aucune', async () => {
        const { svc } = service({ modele: { id: 'm-1' }, lignesEnregistrees: achatSurBanque });
        const modifie = await svc.modifier('t-1', 'm-1', { intitule: 'Achat comptant' });
        expect(modifie.avertissements).toHaveLength(1);
    });
});
//# sourceMappingURL=modele-saisie.service.spec.js.map