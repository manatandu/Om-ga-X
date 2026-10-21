"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const groupe_service_1 = require("./groupe.service");
const EX_MERE = { id: 'ex-m', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const BALANCE_MERE = {
    lignes: [
        { numero: '521000', intitule: 'Banque', typeCompte: 'DETAIL', totalDebit: 1000, totalCredit: 300, solde: 700 },
        { numero: '581000', intitule: 'Virements internes', typeCompte: 'DETAIL', totalDebit: 300, totalCredit: 0, solde: 300 },
        { numero: '701000', intitule: 'Cotisations', typeCompte: 'DETAIL', totalDebit: 0, totalCredit: 1000, solde: -1000 },
    ],
    totaux: { debit: 1300, credit: 1300 },
};
const BALANCE_CELLULE = {
    lignes: [
        { numero: '571000', intitule: 'Caisse', typeCompte: 'DETAIL', totalDebit: 300, totalCredit: 100, solde: 200 },
        { numero: '581000', intitule: 'Virements internes', typeCompte: 'DETAIL', totalDebit: 0, totalCredit: 300, solde: -300 },
        { numero: '601000', intitule: 'Achats', typeCompte: 'DETAIL', totalDebit: 100, totalCredit: 0, solde: 100 },
    ],
    totaux: { debit: 400, credit: 400 },
};
function lectureDesBalances(parDossier) {
    const comptes = Object.entries(parDossier).flatMap(([tenantId, { lignes }]) => lignes.map((l) => ({
        id: `${tenantId}:${l.numero}`,
        tenantId,
        numero: l.numero,
        intitule: l.intitule,
        classe: `CLASSE_${l.numero[0]}`,
        typeCompte: l.typeCompte,
        sommes: { debit: l.totalDebit, credit: l.totalCredit },
    })));
    return {
        compte: {
            findMany: async ({ where }) => comptes.filter((c) => where.tenantId.in.includes(c.tenantId)).sort((a, b) => (a.numero < b.numero ? -1 : 1)),
        },
        ligneEcriture: {
            groupBy: async ({ where }) => where.ecriture.estGenereeParCloture !== false
                ? []
                : comptes
                    .filter((c) => where.ecriture.OR.some((o) => o.tenantId === c.tenantId && o.exerciceId === parDossier[c.tenantId].exerciceId))
                    .map((c) => ({ compteId: c.id, _sum: c.sommes })),
        },
    };
}
const LECTURE = lectureDesBalances({
    mere: { exerciceId: 'ex-m', lignes: BALANCE_MERE.lignes },
    c1: { exerciceId: 'ex-c1', lignes: BALANCE_CELLULE.lignes },
});
const service = (exercicesCellule) => new groupe_service_1.GroupeService({
    ...LECTURE,
    exercice: {
        findFirst: async ({ where }) => where.id === 'ex-m' && where.tenantId === 'mere' ? EX_MERE : null,
    },
    ecriture: { groupBy: async () => [] },
    tiersCompte: { findMany: async () => [] },
    tenant: {
        findUnique: async () => ({ id: 'mere', nom: 'Église centrale', dossierCombinaisonId: 't-comb' }),
        update: async () => ({}),
        findMany: async ({ where }) => where.dossierMereId === 'mere' ? [{ id: 'c1', nom: 'Cellule Matete', exercices: exercicesCellule }] : [],
    },
}, {}, undefined, {
    liasseCompleteExcel: async () => {
        throw new Error('la liasse ne doit jamais être produite sur un agrégat de périodes différentes');
    },
});
const DECALE = [{ id: 'ex-c1', dateDebut: new Date('2026-07-01'), dateFin: new Date('2027-06-30') }];
const CONCORDANT = [{ id: 'ex-c1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }];
describe('agrégat du groupe · une seule période, ou rien', () => {
    it('n’additionne pas une cellule décalée, et la nomme avec ses dates', async () => {
        const a = await service(DECALE).balanceAgregee('mere', 'ex-m');
        expect(a.totaux.debit).toBe(1300);
        expect(a.totaux.credit).toBe(1300);
        expect(a.lignes.find((l) => l.numero === '601000')).toBeUndefined();
        expect(a.detailParDossier.some((d) => d.dossier === 'Cellule Matete')).toBe(false);
        expect(a.controles.periodesConcordantes).toBe(false);
        expect(a.cellulesPeriodeDiscordante).toEqual([
            {
                id: 'c1',
                nom: 'Cellule Matete',
                dateDebut: new Date('2026-07-01'),
                dateFin: new Date('2027-06-30'),
            },
        ]);
    });
    it('une cellule décalée n’est pas une cellule « sans exercice » · les deux manques appellent deux gestes', async () => {
        const decalee = await service(DECALE).balanceAgregee('mere', 'ex-m');
        expect(decalee.cellulesSansExercice).toEqual([]);
        const absente = await service([
            { id: 'ex-c1', dateDebut: new Date('2024-01-01'), dateFin: new Date('2024-12-31') },
        ]).balanceAgregee('mere', 'ex-m');
        expect(absente.cellulesSansExercice).toEqual([{ id: 'c1', nom: 'Cellule Matete' }]);
        expect(absente.cellulesPeriodeDiscordante).toEqual([]);
        expect(absente.controles.periodesConcordantes).toBe(true);
    });
    it('la même période, elle, s’agrège toujours · l’égalité se juge sur les valeurs des dates', async () => {
        const a = await service(CONCORDANT).balanceAgregee('mere', 'ex-m');
        expect(a.controles.periodesConcordantes).toBe(true);
        expect(a.cellulesPeriodeDiscordante).toEqual([]);
        expect(a.totaux.debit).toBe(1700);
        expect(a.totaux.credit).toBe(1700);
        expect(a.controles.liaisonNeutralisee).toBe(true);
    });
    it('la liasse du groupe refuse, nomme la cellule et dit d’où l’écart peut venir', async () => {
        const promesse = service(DECALE).liasseGroupe('mere', 'ex-m', 'user-siege');
        await expect(promesse).rejects.toThrow(common_1.BadRequestException);
        const message = await promesse.catch((e) => e.message);
        expect(message).toContain('Cellule Matete');
        expect(message).toContain('2026-07-01');
        expect(message).toContain('2027-06-30');
        expect(message).toContain('2026-01-01');
        expect(message).toContain('art. 7');
        expect(message).toMatch(/PREMIER exercice/);
        expect(message).toMatch(/LIQUIDATION/);
    });
    it('la feuille « Contrôles » du classeur ne tait pas la cellule écartée', async () => {
        const classeur = await service(DECALE).balanceAgregeeExcel('mere', 'ex-m');
        const { Workbook } = await Promise.resolve().then(() => require('exceljs'));
        const wb = new Workbook();
        await wb.xlsx.load(classeur.buffer);
        const controles = wb.getWorksheet('Contrôles');
        let trouvee = '';
        controles.eachRow((row) => {
            if (String(row.getCell(1).value ?? '').includes('Cellule Matete')) {
                trouvee = String(row.getCell(5).value ?? '');
            }
        });
        expect(trouvee).toContain('PÉRIODE DISCORDANTE');
        expect(trouvee).toContain('2026-07-01');
        const feuille = wb.getWorksheet('Balance agrégée');
        expect(feuille.rowCount).toBe(1 + 3);
    });
});
describe('supervision · une cellule décalée n’est jamais annoncée « prête »', () => {
    const superviseur = (exercicesCellule) => new groupe_service_1.GroupeService({
        ...LECTURE,
        exercice: { findFirst: async () => EX_MERE },
        tenant: {
            findMany: async () => [
                {
                    id: 'c1',
                    nom: 'Cellule Matete',
                    jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
                    exercices: exercicesCellule,
                },
            ],
            findUnique: async () => ({ dossierCombinaisonId: null }),
        },
        ecriture: {
            groupBy: async ({ where }) => where.OR.map((c) => ({
                tenantId: c.tenantId,
                exerciceId: c.exerciceId,
                statut: 'VALIDEE',
                estANouveauProvisoire: false,
                _count: { _all: 12 },
                _max: { date: new Date('2026-11-30') },
            })),
        },
    }, {}, undefined, undefined);
    it('décalée : l’activité reste visible, mais l’écran ne dira pas « PRÊTE »', async () => {
        const s = await superviseur(DECALE).supervision('mere', 'ex-m');
        const ligne = s.cellules[0];
        expect(ligne.exerciceId).toBe('ex-c1');
        expect(ligne.periodeDiscordante).toEqual({
            dateDebut: new Date('2026-07-01'),
            dateFin: new Date('2027-06-30'),
        });
        expect(ligne.prete).toBe(false);
    });
    it('concordante et équilibrée : « prête » comme avant', async () => {
        const s = await superviseur(CONCORDANT).supervision('mere', 'ex-m');
        expect(s.cellules[0].periodeDiscordante).toBeNull();
        expect(s.cellules[0].prete).toBe(true);
    });
});
//# sourceMappingURL=meme-periode-agregat.spec.js.map