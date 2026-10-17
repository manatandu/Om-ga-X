"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
function ligne(numero, date, montant, report = false, soldeDeGestion = false) {
    return {
        debit: montant > 0 ? montant : 0,
        credit: montant < 0 ? -montant : 0,
        compte: {
            id: `c-${numero}`,
            numero,
            intitule: `Compte ${numero}`,
            classe: client_1.ClasseCompte.CLASSE_6,
            typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        },
        ecriture: {
            date: new Date(date),
            estGenereeParCloture: report || soldeDeGestion,
            estSoldeDesComptesDeGestion: soldeDeGestion,
        },
    };
}
function service(lignes, exercice) {
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date(exercice.dateDebut),
                dateFin: new Date(exercice.dateFin),
            }),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const ANNEE_CIVILE = { dateDebut: '2026-01-01', dateFin: '2026-12-31' };
describe('évolution mensuelle par compte', () => {
    it('ouvre douze colonnes pour un exercice civil, dans l’ordre', async () => {
        const s = service([ligne('601000', '2026-03-10', 1000)], ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex');
        expect(r.mois).toHaveLength(12);
        expect(r.mois[0].cle).toBe('2026-01');
        expect(r.mois[11].cle).toBe('2026-12');
    });
    it('suit un exercice décalé, sans se caler sur l’année civile', async () => {
        const s = service([ligne('601000', '2026-10-05', 500)], { dateDebut: '2026-09-01', dateFin: '2026-12-31' });
        const r = await s.evolutionMensuelle('t', 'ex');
        expect(r.mois.map((m) => m.cle)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
        expect(r.comptes[0].valeurs).toEqual([0, 500, 0, 0]);
    });
    it('range le report à-nouveau à part, jamais dans janvier', async () => {
        const s = service([ligne('411000', '2026-01-01', 900_000, true), ligne('411000', '2026-01-20', 1_000)], ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex');
        const c = r.comptes[0];
        expect(c.report).toBe(900_000);
        expect(c.valeurs[0]).toBe(1_000);
        expect(c.cumul).toBe(1_000);
        expect(c.soldeFinal).toBe(901_000);
    });
    it('ne range l’écriture de solde des comptes de gestion ni en ouverture ni en décembre', async () => {
        const s = service([ligne('601000', '2026-03-10', 3_000), ligne('601000', '2026-12-31', -3_000, false, true)], ANNEE_CIVILE);
        const c = (await s.evolutionMensuelle('t', 'ex')).comptes[0];
        expect({ report: c.report, mars: c.valeurs[2], decembre: c.valeurs[11], solde: c.soldeFinal }).toEqual({
            report: 0,
            mars: 3_000,
            decembre: 0,
            solde: 3_000,
        });
    });
    it('somme les mouvements du même mois et signe le net', async () => {
        const s = service([ligne('601000', '2026-05-02', 3_000), ligne('601000', '2026-05-28', -500)], ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex');
        expect(r.comptes[0].valeurs[4]).toBe(2_500);
    });
    it('désigne le mois qui s’écarte le plus, quand il y a de quoi comparer', async () => {
        const lignes = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((m) => ligne('622000', `2026-${String(m).padStart(2, '0')}-15`, 1_000));
        lignes.push(ligne('622000', '2026-07-15', 12_000));
        const s = service(lignes, ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex');
        expect(r.comptes[0].moisAberrant).toBe('2026-07');
    });
    it('ne crie pas à l’anomalie sur un compte mouvementé une ou deux fois', async () => {
        const s = service([ligne('622000', '2026-02-15', 1_000), ligne('622000', '2026-08-15', 9_000)], ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex');
        expect(r.comptes[0].moisAberrant).toBeNull();
    });
    it('écarte les comptes restés sans mouvement ni report', async () => {
        const s = service([ligne('601000', '2026-03-10', 0)], ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex');
        expect(r.comptes).toHaveLength(0);
    });
    it('ignore les comptes Total, qui agrègent déjà leur racine', async () => {
        const l = ligne('600000', '2026-03-10', 5_000);
        l.compte.typeCompte = client_1.TypeCompteDetailTotal.TOTAL;
        const s = service([l], ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex');
        expect(r.comptes).toHaveLength(0);
    });
    it('totalise chaque colonne quand une classe est demandée', async () => {
        const s = service([ligne('601000', '2026-04-01', 1_000), ligne('602000', '2026-04-02', 2_000)], ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex', { classe: client_1.ClasseCompte.CLASSE_6 });
        expect(r.totaux).not.toBeNull();
        expect(r.totaux[3]).toBe(3_000);
    });
    it('ne totalise rien hors filtre de classe : la partie double ramènerait à zéro', async () => {
        const s = service([ligne('601000', '2026-04-01', 1_000), ligne('521000', '2026-04-01', -1_000)], ANNEE_CIVILE);
        const r = await s.evolutionMensuelle('t', 'ex');
        expect(r.totaux).toBeNull();
    });
});
//# sourceMappingURL=evolution-mensuelle.spec.js.map