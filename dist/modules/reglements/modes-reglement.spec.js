"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const modes_reglement_1 = require("./modes-reglement");
const modes_reglement_service_1 = require("./modes-reglement.service");
const base = {
    sens: 'FOURNISSEUR',
    date: new Date('2026-05-10'),
    dossierAssujetti: true,
    nature: client_1.NatureModeReglement.ESPECES,
    source: 'MODE',
    compte: '40110001',
    factures: [{ reference: 'pièce 12', montant: 1_500_000 }],
};
describe('art. 59 bis · la liste fermée du texte', () => {
    it('chèque, virement et carte bancaire, et eux seuls', () => {
        expect([...modes_reglement_1.NATURES_ADMISES_ART_59_BIS].sort()).toEqual(['CARTE_BANCAIRE', 'CHEQUE', 'VIREMENT']);
    });
    it('une facture de 1 500 000 payée en espèces à un fournisseur · avertie, articles et issue nommés', () => {
        const a = (0, modes_reglement_1.avertissementArt59Bis)(base);
        expect(a).toContain('pièce 12');
        expect(a).toContain('art. 59 bis');
        expect(a).toContain('art. 74 bis');
        expect(a).toContain('par espèces');
    });
    it('le seuil se juge au centime · 999 999,99 ne dit rien, 1 000 000 avertit', () => {
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, factures: [{ reference: 'p', montant: 999_999.99 }] })).toBeNull();
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, factures: [{ reference: 'p', montant: 1_000_000 }] })).not.toBeNull();
    });
    it.each([client_1.NatureModeReglement.CHEQUE, client_1.NatureModeReglement.VIREMENT, client_1.NatureModeReglement.CARTE_BANCAIRE])('%s satisfait le texte', (nature) => {
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, nature })).toBeNull();
    });
    it('la monnaie électronique, que le texte ne nomme pas, est avertie', () => {
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, nature: client_1.NatureModeReglement.MONNAIE_ELECTRONIQUE })).not.toBeNull();
    });
    it.each([
        client_1.NatureModeReglement.PRELEVEMENT,
        client_1.NatureModeReglement.EFFET_DE_COMMERCE,
        client_1.NatureModeReglement.MONNAIE_ELECTRONIQUE,
        client_1.NatureModeReglement.AUTRE,
    ])('%s · averti SOUS RÉSERVE, le texte ne nommant que le chèque, le virement et la carte', (nature) => {
        const a = (0, modes_reglement_1.avertissementArt59Bis)({ ...base, nature });
        expect(a).toContain('Réserve');
        expect(a).toContain('ne cite que le chèque, le virement et la carte bancaire');
    });
    it('les espèces dérogent sans réserve', () => {
        expect((0, modes_reglement_1.avertissementArt59Bis)(base)).not.toContain('Réserve');
    });
    it('un CLIENT qui paie en espèces ne coûte rien au dossier · la sanction frappe celui qui déduit', () => {
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, sens: 'CLIENT' })).toBeNull();
    });
    it('un dossier DÉCLARÉ non assujetti n’est pas visé ; sans réponse, il est averti (sous condition)', () => {
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, dossierAssujetti: false })).toBeNull();
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, dossierAssujetti: null })).not.toBeNull();
    });
    it('avant l’entrée en vigueur (27 mai 2013), rien ne se reproche', () => {
        expect(modes_reglement_1.ENTREE_EN_VIGUEUR_ART_59_BIS.toISOString().slice(0, 10)).toBe('2013-05-27');
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, date: new Date('2013-05-26') })).toBeNull();
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, date: new Date('2013-05-27') })).not.toBeNull();
    });
    it('la pièce à plusieurs lignes est avertie SOUS CONDITION, l’à-nouveau sans origine NON JUGÉ', () => {
        const conditionnelle = (0, modes_reglement_1.avertissementArt59Bis)({ ...base, factures: [], sousCondition: [{ reference: 'pièce 8', montant: 1_200_000 }] });
        expect(conditionnelle).toMatch(/pièce 8 \(1\s200\s000,00, si ses lignes au compte sont les échéances d’une même facture\)/);
        const nonJugee = (0, modes_reglement_1.avertissementArt59Bis)({ ...base, factures: [], nonJugees: [{ reference: 'pièce 1', montant: 3_000_000 }] });
        expect(nonJugee).toContain('facture d’origine non retrouvée');
        expect(nonJugee).toContain('seuil de l’art. 59 bis non jugé');
        expect(nonJugee).not.toMatch(/est une transaction/);
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, factures: [], sousCondition: [{ reference: 'p', montant: 999_999.99 }] })).toBeNull();
    });
    it('sans mode ni compte qui dise la nature, rien n’est présumé', () => {
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, nature: null })).toBeNull();
    });
    it('la nature se lit sur le compte du journal · 57 espèces, 55 monnaie électronique, 52 rien', () => {
        expect((0, modes_reglement_1.natureLueSurLeCompte)('57110000')).toBe(client_1.NatureModeReglement.ESPECES);
        expect((0, modes_reglement_1.natureLueSurLeCompte)('55100000')).toBe(client_1.NatureModeReglement.MONNAIE_ELECTRONIQUE);
        expect((0, modes_reglement_1.natureLueSurLeCompte)('52110000')).toBeNull();
        expect((0, modes_reglement_1.natureLueSurLeCompte)(null)).toBeNull();
        expect((0, modes_reglement_1.avertissementArt59Bis)({ ...base, source: 'COMPTE' })).toContain('compte du journal');
    });
});
describe('identité d’un mode', () => {
    it('code court sans espace, intitulé de 35 caractères au plus', () => {
        expect((0, modes_reglement_1.motifRefusIdentiteMode)('CHQ', 'Chèque')).toBeNull();
        expect((0, modes_reglement_1.motifRefusIdentiteMode)('CH Q', 'Chèque')).toContain('sans espace');
        expect((0, modes_reglement_1.motifRefusIdentiteMode)('ABCDEFGHIJK', 'Chèque')).toContain('1 à 10');
        expect((0, modes_reglement_1.motifRefusIdentiteMode)('CHQ', '  ')).toContain('obligatoire');
        expect((0, modes_reglement_1.motifRefusIdentiteMode)('CHQ', 'x'.repeat(36))).toContain('35');
    });
});
function prismaFactice(modes, journaux = []) {
    const tx = {
        $executeRaw: jest.fn(async () => 1),
        modeReglement: {
            count: jest.fn(async ({ where }) => modes.filter((m) => m.tenantId === where.tenantId).length),
            findMany: jest.fn(async ({ where }) => modes.filter((m) => m.tenantId === where.tenantId &&
                (!where.intitule || m.intitule.toLocaleLowerCase('fr') === where.intitule.equals.toLocaleLowerCase('fr')) &&
                (!where.NOT || m.id !== where.NOT.id))),
            update: jest.fn(async ({ where, data }) => {
                const m = modes.find((x) => x.id === where.id);
                Object.assign(m, data);
                return m;
            }),
            create: jest.fn(async ({ data }) => {
                const m = { id: `m${modes.length + 1}`, estActif: true, journalId: data.journalId ?? null, ...data };
                modes.push(m);
                return m;
            }),
        },
    };
    const prisma = {
        ...tx,
        $transaction: jest.fn(async (fn) => fn(tx)),
        modeReglement: {
            ...tx.modeReglement,
            findFirst: jest.fn(async ({ where }) => modes.find((m) => m.id === where.id && m.tenantId === where.tenantId) ?? null),
            delete: jest.fn(async () => ({})),
        },
        journal: {
            findFirst: jest.fn(async ({ where }) => journaux.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null),
        },
    };
    return prisma;
}
describe('modeDuDossier · le mode désigné par une autre structure', () => {
    const modes = [
        { id: 'a', tenantId: 't', code: 'CHQ', intitule: 'Chèque', nature: client_1.NatureModeReglement.CHEQUE, estActif: true, journalId: null },
        { id: 'b', tenantId: 't', code: 'ESP', intitule: 'Espèces', nature: client_1.NatureModeReglement.ESPECES, estActif: false, journalId: null },
        { id: 'c', tenantId: 'autre', code: 'VIR', intitule: 'Virement', nature: client_1.NatureModeReglement.VIREMENT, estActif: true, journalId: null },
    ];
    const prisma = prismaFactice(modes);
    it('le mode d’un autre dossier est introuvable · la clé étrangère ne juge que l’existence', async () => {
        await expect((0, modes_reglement_service_1.modeDuDossier)(prisma, 't', 'c')).rejects.toThrow('introuvable');
    });
    it('un mode en sommeil ne se pose plus, et le refus dit l’issue', async () => {
        await expect((0, modes_reglement_service_1.modeDuDossier)(prisma, 't', 'b')).rejects.toThrow('en sommeil');
    });
    it('un mode actif du dossier passe', async () => {
        await expect((0, modes_reglement_service_1.modeDuDossier)(prisma, 't', 'a')).resolves.toMatchObject({ code: 'CHQ', nature: client_1.NatureModeReglement.CHEQUE });
    });
});
describe('ModesReglementService', () => {
    it('le journal proposé est un journal de trésorerie du dossier', async () => {
        const prisma = prismaFactice([], [{ id: 'ach', tenantId: 't', code: 'ACH', type: 'ACHATS' }]);
        const service = new modes_reglement_service_1.ModesReglementService(prisma);
        await expect(service.creer('t', 'u', { code: 'VIR', intitule: 'Virement', nature: client_1.NatureModeReglement.VIREMENT, journalId: 'ach' })).rejects.toThrow("n'est pas un journal de trésorerie");
    });
    it(`au-delà de ${modes_reglement_1.PLAFOND_MODES_REGLEMENT} modes, refusé · le plafond de Sage, compté sous le verrou du dossier`, async () => {
        const modes = Array.from({ length: modes_reglement_1.PLAFOND_MODES_REGLEMENT }, (_, i) => ({
            id: `x${i}`,
            tenantId: 't',
            code: `M${i}`,
            intitule: `Mode ${i}`,
            nature: client_1.NatureModeReglement.AUTRE,
            estActif: true,
            journalId: null,
        }));
        const prisma = prismaFactice(modes);
        const service = new modes_reglement_service_1.ModesReglementService(prisma);
        await expect(service.creer('t', 'u', { code: 'NEUF', intitule: 'Neuf', nature: client_1.NatureModeReglement.AUTRE })).rejects.toThrow(String(modes_reglement_1.PLAFOND_MODES_REGLEMENT));
        expect(prisma.$executeRaw).toHaveBeenCalled();
    });
    it('les modes usuels · ceux déjà présents ne sont pas recréés, et c’est dit', async () => {
        const modes = [
            { id: 'a', tenantId: 't', code: 'CHQ', intitule: 'Chèque', nature: client_1.NatureModeReglement.CHEQUE, estActif: true, journalId: null },
        ];
        const prisma = prismaFactice(modes);
        const service = new modes_reglement_service_1.ModesReglementService(prisma);
        const r = await service.creerUsuels('t', 'u');
        expect(r.dejaPresents).toEqual(['Chèque']);
        expect(r.crees).toHaveLength(modes_reglement_1.MODES_USUELS.length - 1);
        expect(modes.filter((m) => m.tenantId === 't')).toHaveLength(modes_reglement_1.MODES_USUELS.length);
    });
    it('l’intitulé est unique sans égard à la casse, à la création comme à la retouche, sous le verrou (second tour, m3)', async () => {
        const modes = [
            { id: 'a', tenantId: 't', code: 'ESP', intitule: 'Espèces', nature: client_1.NatureModeReglement.ESPECES, estActif: true, journalId: null },
            { id: 'b', tenantId: 't', code: 'CHQ', intitule: 'Chèque', nature: client_1.NatureModeReglement.CHEQUE, estActif: true, journalId: null },
        ];
        const prisma = prismaFactice(modes);
        const service = new modes_reglement_service_1.ModesReglementService(prisma);
        await expect(service.creer('t', 'u', { code: 'ESP2', intitule: '  espèces ', nature: client_1.NatureModeReglement.ESPECES })).rejects.toThrow('Un mode de règlement « Espèces » existe déjà dans ce dossier.');
        expect(prisma.modeReglement.create).not.toHaveBeenCalled();
        expect(prisma.modeReglement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't', intitule: { equals: 'espèces', mode: 'insensitive' } } }));
        await expect(service.modifier('t', 'b', { intitule: 'ESPÈCES' })).rejects.toThrow('existe déjà');
        await expect(service.modifier('t', 'a', { intitule: 'ESPÈCES' })).resolves.toMatchObject({ intitule: 'ESPÈCES' });
        const verrou = prisma.$executeRaw.mock.invocationCallOrder.at(-1);
        expect(verrou).toBeLessThan(prisma.modeReglement.findMany.mock.invocationCallOrder.at(-1));
    });
    it('le journal retiré entre son contrôle et l’écriture · un 409 qui le nomme, jamais une erreur 500 (second tour, m7)', async () => {
        const modes = [
            { id: 'a', tenantId: 't', code: 'VIR', intitule: 'Virement', nature: client_1.NatureModeReglement.VIREMENT, estActif: true, journalId: null },
        ];
        const prisma = prismaFactice(modes, [{ id: 'bq', tenantId: 't', code: 'BQ', type: 'TRESORERIE' }]);
        prisma.modeReglement.update.mockRejectedValueOnce(new client_1.Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x', meta: { field_name: 'modes_reglement_journalId_fkey (index)' } }));
        const service = new modes_reglement_service_1.ModesReglementService(prisma);
        const refus = service.modifier('t', 'a', { journalId: 'bq' });
        await expect(refus).rejects.toBeInstanceOf(common_1.ConflictException);
        await expect(refus).rejects.toThrow("Le journal choisi vient d'être retiré par une autre saisie");
        await expect(service.modifier('t', 'a', { journalId: 'bq' })).resolves.toMatchObject({ journalId: 'bq' });
    });
    it('un mode porté par une ligne ne se supprime pas · le refus nomme l’usage et renvoie à la mise en sommeil', async () => {
        const modes = [
            { id: 'a', tenantId: 't', code: 'CHQ', intitule: 'Chèque', nature: client_1.NatureModeReglement.CHEQUE, estActif: true, journalId: null },
        ];
        const prisma = {
            ...prismaFactice(modes),
            ligneEcriture: { count: jest.fn(async ({ where }) => (where.modeReglementId === 'a' ? 2 : 0)) },
            tiers: { count: jest.fn(async () => 0) },
            modeleReglement: { count: jest.fn(async () => 0) },
            echeanceReglement: { count: jest.fn(async () => 0) },
        };
        const service = new modes_reglement_service_1.ModesReglementService(prisma);
        await expect(service.supprimer('t', 'a')).rejects.toThrow(/lignes d'écriture portant ce mode \(2\).*sommeil/);
        expect(prisma.modeReglement.delete).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=modes-reglement.spec.js.map