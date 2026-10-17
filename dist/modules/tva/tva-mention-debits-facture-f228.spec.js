"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const taux_tva_service_1 = require("./taux-tva.service");
const TAUX = {
    id: 'tx16',
    code: 'TVA16',
    intitule: 'TVA 16 %',
    taux: 16,
    compteCollecteId: 'c443',
    compteDeductibleId: 'c445',
};
function achat(opts) {
    return {
        id: `l-${opts.date}-${opts.tva}`,
        tauxTvaId: TAUX.id,
        compteId: 'c4454',
        compte: { numero: '44540000' },
        debit: opts.tva,
        credit: 0,
        piece: opts.piece,
        ecriture: {
            date: new Date(opts.date),
            lignes: [
                {
                    debit: 0,
                    credit: opts.tva * 7.25,
                    compte: {
                        numero: '40110001',
                        classe: 'CLASSE_4',
                        tiersCompte: {
                            tiers: {
                                autoriseTvaDebits: opts.fournisseur.autorise,
                                referenceAutorisationDebits: opts.fournisseur.reference ?? null,
                            },
                        },
                    },
                    lettrage: { statut: 'PARTIEL', solde: opts.tva * 7.25, soldeAt: null, lignes: [] },
                },
                { debit: opts.tva * 6.25, credit: 0, compte: { numero: '62400000', classe: 'CLASSE_6', tiersCompte: null }, lettrage: null },
            ],
        },
    };
}
function service(lignesTva) {
    const findMany = jest.fn().mockImplementation(({ where, select }) => {
        const compte = where.compte;
        if (!compte?.OR)
            return Promise.resolve([]);
        const colonnes = select?.ecriture?.select?.facture?.select;
        return Promise.resolve(lignesTva.map(({ piece, ...l }) => ({
            ...l,
            ecriture: {
                ...l.ecriture,
                facture: colonnes && piece
                    ? Object.fromEntries(Object.entries(piece).filter(([cle]) => colonnes[cle]))
                    : null,
            },
        })));
    });
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
        tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: {
            findMany,
            aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    return { s: new taux_tva_service_1.TauxTvaService(prisma, {}), findMany };
}
const MARS = new Date('2026-03-01');
const FIN_MARS = new Date('2026-03-31T23:59:59.999Z');
const AUTORISE = { autorise: true, reference: 'DGI/DIR.GEN/2025/1142' };
const NON_RENSEIGNE = { autorise: false };
const ACHAT_AVEC_MENTION = { sens: client_1.SensFacture.ACHAT, mentionTvaDebits: true, nature: client_1.NatureFacture.FACTURE };
const ACHAT_SANS_MENTION = { sens: client_1.SensFacture.ACHAT, mentionTvaDebits: false, nature: client_1.NatureFacture.FACTURE };
const VENTE_AVEC_MENTION = { sens: client_1.SensFacture.VENTE, mentionTvaDebits: true, nature: client_1.NatureFacture.FACTURE };
describe('F228 · la mention de l’art. 60 se LIT sur la facture d’achat enregistrée', () => {
    it('la requête de la déclaration demande le sens de la pièce et sa mention des débits', async () => {
        const { s, findMany } = service([achat({ date: '2026-03-10', tva: 160_000, fournisseur: AUTORISE, piece: null })]);
        await s.declaration('t1', MARS, FIN_MARS);
        const appel = findMany.mock.calls.find(([arg]) => arg.where?.compte?.OR);
        expect(appel?.[0].select.ecriture.select.facture.select).toEqual({
            nature: true,
            sens: true,
            mentionTvaDebits: true,
            dateFacture: true,
            dateReception: true,
        });
    });
    it('une anticipation dont la facture d’achat PORTE la mention est dite prouvée par la pièce', async () => {
        const { s } = service([achat({ date: '2026-03-10', tva: 160_000, fournisseur: AUTORISE, piece: ACHAT_AVEC_MENTION })]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        const p = d.mentionExigibilite;
        expect(p).toContain('FOURNISSEURS AUTORISÉS AUX DÉBITS');
        expect(p).toContain('qu’OmegaX lit sur la facture d’achat enregistrée et rattachée à l’écriture');
        expect(p).toContain('Chacune de ces écritures est rattachée à une facture d’achat enregistrée qui la porte.');
        expect(d.totalDeductible).toBe(160_000);
    });
    it('une anticipation SANS facture qui porte la mention nomme le montant à vérifier sur la pièce', async () => {
        const { s } = service([
            achat({ date: '2026-03-10', tva: 160_000, fournisseur: AUTORISE, piece: ACHAT_AVEC_MENTION }),
            achat({ date: '2026-03-12', tva: 48_000, fournisseur: AUTORISE, piece: ACHAT_SANS_MENTION }),
            achat({ date: '2026-03-14', tva: 32_000, fournisseur: AUTORISE, piece: null }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        const p = d.mentionExigibilite;
        expect(p).toContain(`${(80_000).toLocaleString('fr-FR')} CDF ne reposent sur aucune facture d’achat enregistrée où la mention soit cochée`);
        expect(d.totalDeductible).toBe(240_000);
    });
    it('la mention d’une facture de VENTE ne prouve rien du fournisseur', async () => {
        const { s } = service([achat({ date: '2026-03-10', tva: 160_000, fournisseur: AUTORISE, piece: VENTE_AVEC_MENTION })]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        expect(d.mentionExigibilite).toContain(`${(160_000).toLocaleString('fr-FR')} CDF ne reposent sur aucune facture d’achat enregistrée`);
    });
    it('une déduction DIFFÉRÉE dont la facture d’achat porte la mention invite à renseigner la fiche, sans rien avancer', async () => {
        const { s } = service([
            achat({ date: '2026-03-10', tva: 160_000, fournisseur: NON_RENSEIGNE, piece: ACHAT_AVEC_MENTION }),
            achat({ date: '2026-03-12', tva: 48_000, fournisseur: NON_RENSEIGNE, piece: null }),
        ]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        const p = d.mentionExigibilite;
        expect(p).toContain('DÉDUCTION SUR SERVICES');
        expect(p).toContain(`Dont ${(160_000).toLocaleString('fr-FR')} CDF sur une facture d’achat enregistrée qui PORTE la mention`);
        expect(p).toContain('la déduction naîtra alors à la facture (décret art. 61 et 96)');
        expect(d.totalDeductible).toBe(0);
    });
    it('sans facture qui porte la mention, la déduction différée ne s’en invente pas', async () => {
        const { s } = service([achat({ date: '2026-03-12', tva: 48_000, fournisseur: NON_RENSEIGNE, piece: ACHAT_SANS_MENTION })]);
        const d = await s.declaration('t1', MARS, FIN_MARS);
        const p = d.mentionExigibilite;
        expect(p).toContain('OmegaX ne PEUT pas avancer la déduction');
        expect(p).not.toContain('qui PORTE la mention');
    });
});
describe('F228 · un commentaire qui cite du code se vérifie contre ce code', () => {
    it('le commentaire du prorata cite une condition qui existe dans le fichier qu’il nomme', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'taux-tva.service.ts'), 'utf8');
        const debut = source.indexOf("TROIS AGRÉGATS PLUTÔT QU'UN FILTRE NÉGATIF UNIQUE.");
        expect(debut).toBeGreaterThan(0);
        const bloc = source.slice(debut, source.indexOf('*/', debut));
        const cites = [...bloc.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
        const fichiers = cites.filter((c) => /^(client\/)?src\/.+\.tsx?$/.test(c));
        const conditions = cites.filter((c) => c.includes('(') && !fichiers.includes(c));
        expect(fichiers.length).toBeGreaterThan(0);
        expect(conditions.length).toBeGreaterThan(0);
        const racine = (0, path_1.join)(__dirname, '..', '..', '..');
        const textes = fichiers.map((f) => (0, fs_1.readFileSync)((0, path_1.join)(racine, f), 'utf8'));
        for (const condition of conditions) {
            expect({ condition, trouvee: textes.some((t) => t.includes(condition)) }).toEqual({ condition, trouvee: true });
        }
    });
});
//# sourceMappingURL=tva-mention-debits-facture-f228.spec.js.map