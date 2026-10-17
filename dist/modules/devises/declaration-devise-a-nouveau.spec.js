"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const declaration_devise_a_nouveau_1 = require("./declaration-devise-a-nouveau");
const EXERCICE_OUVERT = { statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
function ligne(sur = {}, ecriture = {}) {
    return {
        numero: '41110101',
        debit: 3_200_000,
        credit: 0,
        deviseId: null,
        lettre: null,
        lettrageId: null,
        rapprochementId: null,
        aDesVentilations: false,
        ...sur,
        ecriture: {
            estGenereeParCloture: true,
            estANouveauProvisoire: false,
            estSoldeDesComptesDeGestion: false,
            statut: client_1.StatutEcriture.VALIDEE,
            exercice: EXERCICE_OUVERT,
            ...ecriture,
        },
    };
}
const LIBRE = {
    dejaDeclaree: false,
    reevaluationLue: null,
    exercicePrecedentOuvert: null,
    prolongeUneLigneDeclaree: false,
    reglementsEnFrancs: { lignes: [], total: 0 },
};
const S = client_1.Referentiel.SYSCOHADA;
const DEVISES = new Map([
    ['d-usd', { code: 'USD' }],
    ['d-cdf', { code: 'CDF' }],
]);
describe('Déclarer la devise d’un à-nouveau (AU3) · la ligne', () => {
    it('une ligne d’à-nouveau importée, libre, sur une créance, se déclare', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne(), S, LIBRE)).toBeNull();
    });
    it('REFUS · une ligne ordinaire (pas un à-nouveau) porte sa devise à la saisie', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({}, { estGenereeParCloture: false }), S, LIBRE)).toMatch(/Seule une ligne d'à-nouveau/);
    });
    it('REFUS · l’à-nouveau PROVISOIRE se recalcule · la déclaration va sur la ligne qu’il reporte', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({}, { estANouveauProvisoire: true }), S, LIBRE)).toMatch(/PROVISOIRE/);
    });
    it('REFUS · exercice clôturé, la déclaration va sur l’à-nouveau suivant', () => {
        const m = (0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({}, { exercice: { ...EXERCICE_OUVERT, statut: client_1.StatutExercice.CLOTURE } }), S, LIBRE);
        expect(m).toMatch(/clôturé/);
        expect(m).toMatch(/exercice suivant/);
    });
    it('REFUS · une ligne déjà en devise, ou déjà déclarée', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({ deviseId: 'd-usd' }), S, LIBRE)).toMatch(/porte déjà sa devise/);
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne(), S, { ...LIBRE, dejaDeclaree: true })).toMatch(/déjà été déclarée/);
    });
    it('REFUS · un compte qui ne se réévalue pas (immobilisation, fonds propres)', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({ numero: '24410000' }), S, LIBRE)).toMatch(/ni une créance, ni une dette.*immobilisation/);
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({ numero: '10110000', debit: 0, credit: 5 }), S, LIBRE)).toMatch(/fonds propres/);
    });
    it('REFUS · ligne LETTRÉE, ligne POINTÉE', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({ lettre: 'AA', lettrageId: 'g1' }), S, LIBRE)).toMatch(/lettrées/);
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({ rapprochementId: 'r1' }), S, LIBRE)).toMatch(/pointées/);
    });
    it('REFUS · une réévaluation non annulée de l’exercice l’a déjà lue · issue, l’annuler', () => {
        const m = (0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne(), S, {
            ...LIBRE,
            reevaluationLue: { date: new Date('2027-12-31'), exercice: '2027', memeExercice: true },
        });
        expect(m).toMatch(/réévaluation du 2027-12-31 \(exercice 2027\) a déjà lu ce compte, cette ligne en francs/);
        expect(m).toMatch(/Annulez les réévaluations/);
    });
    it('REFUS (M1) · une réévaluation d’un exercice POSTÉRIEUR a lu le report · annuler, déclarer, réévaluer dans l’ordre', () => {
        const m = (0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne(), S, {
            ...LIBRE,
            reevaluationLue: { date: new Date('2028-12-31'), exercice: '2028', memeExercice: false },
        });
        expect(m).toMatch(/exercice 2028\) a déjà lu ce compte, le report de cette ligne en francs/);
        expect(m).toMatch(/à partir de la plus récente/);
        expect(m).toMatch(/réévaluez dans l'ordre des exercices/);
    });
    it('REFUS (B1) · des règlements en francs non lettrés réduisent la position · nommés, deux issues', () => {
        const m = (0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({ numero: '40110101', debit: 0, credit: 3_200_000 }), S, {
            ...LIBRE,
            reglementsEnFrancs: { lignes: [{ piece: 12, date: new Date('2027-03-15'), montant: 2_150_000 }], total: 1 },
        });
        expect(m).toMatch(/1 mouvement\(s\) en francs de sens contraire/);
        expect(m).toMatch(/pièce 12 du 2027-03-15, 2150000/);
        expect(m).toMatch(/porter d’abord leur devise/);
        expect(m).toMatch(/les lettrer avec ces pièces/);
    });
    it('REFUS (B1) · au-delà des mouvements nommés, la liste le dit', () => {
        const m = (0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne(), S, {
            ...LIBRE,
            reglementsEnFrancs: { lignes: [{ piece: 1, date: new Date('2027-02-01'), montant: 10 }], total: 4 },
        });
        expect(m).toMatch(/^4 mouvement/);
        expect(m).toMatch(/ ; …\)/);
    });
    it('REFUS (M2) · le report d’une ligne déjà déclarée ne se redéclare pas', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne(), S, { ...LIBRE, prolongeUneLigneDeclaree: true })).toMatch(/déjà été déclarée/);
    });
    it('REFUS · l’exercice précédent encore ouvert · déclarer sur son bilan importé, ou le clôturer', () => {
        const m = (0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne(), S, { ...LIBRE, exercicePrecedentOuvert: { libelle: '2026' } });
        expect(m).toMatch(/2026 est encore ouvert/);
        expect(m).toMatch(/devise par devise/);
    });
    it('REFUS · une ligne ventilée', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusLigne)(ligne({ aDesVentilations: true }), S, LIBRE)).toMatch(/ventilée/);
    });
});
describe('Déclarer la devise d’un à-nouveau (AU3) · les parts', () => {
    it('le cas AU3 · 1 500 USD pour 3 200 000, cours déduit', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusParts)([{ deviseId: 'd-usd', montantDevise: 1500, montant: 3_200_000 }], 3_200_000, DEVISES)).toBeNull();
        const exactes = (0, declaration_devise_a_nouveau_1.lignesExactes)({ debit: 3_200_000, credit: 0 }, [{ deviseId: 'd-usd', montantDevise: 1500, montant: 3_200_000 }]);
        expect(exactes).toEqual([
            { montant: 3_200_000, deviseId: 'd-usd', montantDevise: 1500, coursApplique: 2133.333333, sensDebit: true },
        ]);
    });
    it('une part et un reste en francs · la somme est celle de la ligne, au centime, dans son sens', () => {
        const exactes = (0, declaration_devise_a_nouveau_1.lignesExactes)({ debit: 0, credit: 5_000_000 }, [{ deviseId: 'd-usd', montantDevise: 1500, montant: 3_200_000 }]);
        expect(exactes).toHaveLength(2);
        expect(exactes[1]).toEqual({ montant: 1_800_000, deviseId: null, montantDevise: null, coursApplique: null, sensDebit: false });
        expect(exactes.reduce((s, p) => s + p.montant, 0)).toBe(5_000_000);
    });
    it('REFUS · un cours qui ne rend pas la part au centime (2 133,33 rend 3 199 995)', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusParts)([{ deviseId: 'd-usd', montantDevise: 1500, coursApplique: 2133.33, montant: 3_200_000 }], 3_200_000, DEVISES)).toMatch(/Part 1 · .*3199995/);
    });
    it('REFUS · la monnaie de tenue n’est pas une devise ; une devise d’un autre dossier non plus', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusParts)([{ deviseId: 'd-cdf', montantDevise: 10, montant: 10 }], 10, DEVISES)).toMatch(/monnaie de tenue/);
        expect((0, declaration_devise_a_nouveau_1.motifRefusParts)([{ deviseId: 'ailleurs', montantDevise: 10, montant: 10 }], 10, DEVISES)).toMatch(/introuvable/);
    });
    it('REFUS · des parts au-delà de la ligne · la déclaration découpe, elle ne change pas le montant', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusParts)([{ deviseId: 'd-usd', montantDevise: 1500, montant: 3_200_001 }], 3_200_000, DEVISES)).toMatch(/ne change pas son montant/);
    });
    it('REFUS · une part nulle, et plus de parts que permis', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusParts)([{ deviseId: 'd-usd', montantDevise: 1, montant: 0 }], 10, DEVISES)).toMatch(/positif/);
        const trop = Array.from({ length: declaration_devise_a_nouveau_1.PARTS_MAXIMUM + 1 }, () => ({ deviseId: 'd-usd', montantDevise: 1, montant: 1 }));
        expect((0, declaration_devise_a_nouveau_1.motifRefusParts)(trop, 1000, DEVISES)).toMatch(/Au plus/);
    });
    it('aucune part · la ligne est en francs, rien à refuser', () => {
        expect((0, declaration_devise_a_nouveau_1.motifRefusParts)([], 3_200_000, DEVISES)).toBeNull();
        expect((0, declaration_devise_a_nouveau_1.lignesExactes)({ debit: 3_200_000, credit: 0 }, [])).toEqual([
            { montant: 3_200_000, deviseId: null, montantDevise: null, coursApplique: null, sensDebit: true },
        ]);
    });
});
describe('Déclarer la devise d’un à-nouveau (AU3) · l’appariement des reports (M2)', () => {
    const origine = { id: 'o1', compteId: 'c401', debit: 0, credit: 3_200_000, libelle: 'Fournisseur X', dateEcheance: null };
    const report = { id: 'r1', compteId: 'c401', debit: 0, credit: 3_200_000, libelle: 'RAN détail 40110101 · Fournisseur X', dateEcheance: null };
    it('le report au détail de la ligne importée hérite seul · la facture en francs du même compte n’hérite pas', () => {
        const facture = { ...report, id: 'r2', credit: 1_000_000, libelle: 'RAN détail 40110101 · Facture F-9' };
        const a = (0, declaration_devise_a_nouveau_1.apparierReports)([{ ligne: origine, cle: (0, declaration_devise_a_nouveau_1.cleDuReport)(origine, '40110101') }], [report, facture].map((r) => ({ ligne: r, cle: (0, declaration_devise_a_nouveau_1.cleDeLigne)(r) })));
        expect(a.herites.map((r) => r.id)).toEqual(['r1']);
        expect(a.nonRetrouvees).toEqual([]);
    });
    it('aucun report à sa clé (report au SOLDE) · l’origine est NOMMÉE', () => {
        const solde = { ...report, credit: 4_200_000, libelle: 'Report à-nouveau 40110101 · Fournisseurs' };
        const a = (0, declaration_devise_a_nouveau_1.apparierReports)([{ ligne: origine, cle: (0, declaration_devise_a_nouveau_1.cleDuReport)(origine, '40110101') }], [{ ligne: solde, cle: (0, declaration_devise_a_nouveau_1.cleDeLigne)(solde) }]);
        expect(a.herites).toEqual([]);
        expect(a.nonRetrouvees.map((o) => o.id)).toEqual(['o1']);
    });
    it('lignes identiques · autant de reports, appariés ; un nombre différent, ambigu', () => {
        const o2 = { ...origine, id: 'o2' };
        const r2 = { ...report, id: 'r2' };
        const cles = (os) => os.map((o) => ({ ligne: o, cle: (0, declaration_devise_a_nouveau_1.cleDuReport)(o, '40110101') }));
        expect((0, declaration_devise_a_nouveau_1.apparierReports)(cles([origine, o2]), [report, r2].map((r) => ({ ligne: r, cle: (0, declaration_devise_a_nouveau_1.cleDeLigne)(r) }))).herites).toHaveLength(2);
        const a = (0, declaration_devise_a_nouveau_1.apparierReports)(cles([origine, o2]), [{ ligne: report, cle: (0, declaration_devise_a_nouveau_1.cleDeLigne)(report) }]);
        expect(a.herites).toEqual([]);
        expect(a.ambigues.map((o) => o.id)).toEqual(['o1', 'o2']);
    });
    it('l’échéance et les montants au centime comptent dans la clé', () => {
        const autre = { ...report, dateEcheance: new Date('2027-06-30') };
        expect((0, declaration_devise_a_nouveau_1.cleDeLigne)(autre)).not.toBe((0, declaration_devise_a_nouveau_1.cleDuReport)(origine, '40110101'));
        expect((0, declaration_devise_a_nouveau_1.cleDeLigne)({ ...report, credit: 3_200_000.004 })).toBe((0, declaration_devise_a_nouveau_1.cleDuReport)(origine, '40110101'));
    });
});
//# sourceMappingURL=declaration-devise-a-nouveau.spec.js.map