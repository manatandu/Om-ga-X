"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moteur_etat_personnalise_1 = require("./moteur-etat-personnalise");
const etats_personnalises_service_1 = require("./etats-personnalises.service");
const b = (numero, totalDebit, totalCredit, mouvementDebit = totalDebit, mouvementCredit = totalCredit) => ({
    numero,
    totalDebit,
    totalCredit,
    mouvementDebit,
    mouvementCredit,
});
const DEF = [
    { cle: 'CA', libelle: "Chiffre d'affaires", racines: '70 -709', mesure: 'MOUVEMENT', sens: 'CREDIT' },
    { cle: 'ACHATS', libelle: 'Achats', racines: '60', mesure: 'MOUVEMENT', sens: 'DEBIT' },
    { cle: 'MARGE', libelle: 'Marge', total: 'CA-ACHATS' },
    { cle: 'TRESO', libelle: 'Trésorerie', racines: '52 57', mesure: 'SOLDE', sens: 'DEBIT' },
];
describe('État personnalisé · la définition', () => {
    it('une définition bien formée passe', () => {
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)(DEF)).toBeNull();
    });
    it('un total ne cite qu’une ligne PRÉCÉDENTE', () => {
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([{ cle: 'T', libelle: 'T', total: 'A' }, { cle: 'A', libelle: 'A', racines: '6', mesure: 'MOUVEMENT', sens: 'DEBIT' }])).toMatch(/PRÉCÉDENTE/);
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([{ cle: 'T', libelle: 'T', total: 'T' }])).toMatch(/PRÉCÉDENTE/);
    });
    it('refuse racine doublée, clé doublée, ligne à la fois rubrique et total, racine non numérique', () => {
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([{ cle: 'A', libelle: 'A', racines: '70 70', mesure: 'SOLDE', sens: 'DEBIT' }])).toMatch(/deux fois/);
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([DEF[0], { ...DEF[0] }])).toMatch(/employée deux fois/);
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([{ cle: 'A', libelle: 'A', racines: '70', total: 'B', mesure: 'SOLDE', sens: 'DEBIT' }])).toMatch(/pas les deux/);
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([{ cle: 'A', libelle: 'A', racines: '7O', mesure: 'SOLDE', sens: 'DEBIT' }])).toMatch(/illisibles/);
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([{ cle: 'A', libelle: 'A', racines: '70' }])).toMatch(/mesure/);
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([])).toMatch(/au moins une ligne/);
    });
});
describe('État personnalisé · le calcul', () => {
    const balance = [
        b('70110000', 0, 1000),
        b('70910000', 50, 0),
        b('60110000', 400, 0),
        b('52110000', 900, 100, 300, 100),
        b('57110000', 70, 0),
        b('70120000', 500, 500, 0, 500),
    ];
    it('le sens, la racine négative, le total et les deux mesures', () => {
        expect((0, moteur_etat_personnalise_1.calculerColonne)(DEF, balance)).toEqual({ CA: 1500, ACHATS: 400, MARGE: 1100, TRESO: 870 });
        expect((0, moteur_etat_personnalise_1.calculerColonne)([{ ...DEF[0], racines: '70' }], balance).CA).toBe(1450);
    });
    it('la racine la plus longue décide, quel que soit l’ordre · « -709 70 » vaut « 70 -709 »', () => {
        expect((0, moteur_etat_personnalise_1.calculerColonne)([{ ...DEF[0], racines: '-709 70' }], balance).CA).toBe(1500);
        expect((0, moteur_etat_personnalise_1.calculerColonne)([{ ...DEF[0], racines: '70 -7011' }], balance).CA).toBe(450);
    });
    it('une rubrique faite d’exclusions seules est refusée', () => {
        expect((0, moteur_etat_personnalise_1.motifRefusDefinition)([{ cle: 'R', libelle: 'R', racines: '-709', mesure: 'MOUVEMENT', sens: 'DEBIT' }])).toMatch(/au moins une racine incluse/);
    });
    it('MOUVEMENT exclut la clôture, SOLDE la reprend', () => {
        const def = [
            { cle: 'M', libelle: 'M', racines: '70120000', mesure: 'MOUVEMENT', sens: 'CREDIT' },
            { cle: 'S', libelle: 'S', racines: '70120000', mesure: 'SOLDE', sens: 'CREDIT' },
        ];
        const v = (0, moteur_etat_personnalise_1.calculerColonne)(def, balance);
        expect(v).toEqual({ M: 500, S: 0 });
        expect(Object.is(v.S, -0)).toBe(false);
    });
});
describe('État personnalisé · le service', () => {
    const monter = (lignes = DEF) => {
        const balances = [];
        const prisma = {
            etatPersonnalise: { findFirst: async () => ({ id: 'e1', nom: 'Marge', lignes }) },
            exercice: {
                findMany: async ({ where }) => where.id.in.filter((i) => i.startsWith('x')).map((i, n) => ({ id: i, dateDebut: new Date(2025 + n, 0, 1), dateFin: new Date(2025 + n, 11, 31) })),
            },
        };
        const ecritures = {
            balance: async (_t, exerciceId, brouillard) => {
                balances.push(`${exerciceId}:${brouillard}`);
                return { lignes: [b('70110000', 0, exerciceId === 'x1' ? 100 : 200)] };
            },
        };
        return { svc: new etats_personnalises_service_1.EtatsPersonnalisesService(prisma, ecritures), balances };
    };
    it('une colonne par exercice, lue sur la balance générale', async () => {
        const { svc, balances } = monter();
        const r = await svc.calculer('t1', 'e1', ['x1', 'x2', 'x1'], false);
        expect(r.colonnes.map((c) => c.valeurs.CA)).toEqual([100, 200]);
        expect(balances).toEqual(['x1:false', 'x2:false']);
    });
    it('refuse plus de cinq exercices, un exercice étranger et une définition devenue invalide', async () => {
        await expect(monter().svc.calculer('t1', 'e1', ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'], false)).rejects.toThrow(/Au plus 5/);
        await expect(monter().svc.calculer('t1', 'e1', ['x1', 'autre'], false)).rejects.toThrow(/introuvable/);
        await expect(monter([{ cle: 'T', libelle: 'T', total: 'Z' }]).svc.calculer('t1', 'e1', ['x1'], false)).rejects.toThrow(/à corriger/);
    });
});
//# sourceMappingURL=etats-personnalises.spec.js.map