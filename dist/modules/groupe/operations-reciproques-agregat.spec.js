"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const groupe_service_1 = require("./groupe.service");
const EX = { id: 'ex-m', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const EX_C1 = { id: 'ex-c1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const statutRetenu = (l, f) => {
    const statut = l.statut ?? 'VALIDEE';
    if (f === undefined)
        return true;
    return typeof f === 'string' ? statut === f : statut !== f.not;
};
const retenue = (l, f) => f.OR.some((o) => o.tenantId === l.tenantId && o.exerciceId === l.exerciceId) &&
    f.estGenereeParCloture !== true &&
    f.estSoldeDesComptesDeGestion !== true &&
    statutRetenu(l, f.statut);
function service(lignes, rattachements, options) {
    const comptes = [...new Map(lignes.map((l) => [l.compteId, l])).values()].map((l) => ({
        id: l.compteId,
        tenantId: l.tenantId,
        numero: l.numero,
        intitule: l.intitule,
        classe: `CLASSE_${l.numero[0]}`,
        typeCompte: 'DETAIL',
    }));
    return new groupe_service_1.GroupeService({
        compte: {
            findMany: async ({ where }) => comptes.filter((c) => where.tenantId.in.includes(c.tenantId)).sort((a, b) => (a.numero < b.numero ? -1 : 1)),
        },
        exercice: {
            findFirst: async ({ where }) => where.id === 'ex-m' && where.tenantId === 'mere' ? EX : null,
        },
        ecriture: { groupBy: async () => [] },
        tenant: {
            findUnique: async () => ({ id: 'mere', nom: 'Siège', dossierCombinaisonId: 't-comb', referentiel: options?.referentiel ?? 'SYCEBNL' }),
            update: async () => ({}),
            findMany: async ({ where }) => where.dossierMereId === 'mere'
                ? [{ id: 'c1', nom: 'Antenne Matete', exercices: options?.exercicesCellule ?? [EX_C1] }]
                : [],
        },
        tiersCompte: {
            findMany: async ({ where }) => rattachements
                .filter((r) => where.tiers.tenantId.in.includes(r.tenantId))
                .map((r) => ({
                compteId: r.compteId,
                tiers: { tenantId: r.tenantId, code: r.code, nom: r.nom, celluleGroupeId: r.celluleGroupeId },
            })),
        },
        ligneEcriture: {
            groupBy: async ({ where }) => {
                const sommes = new Map();
                for (const l of lignes.filter((x) => retenue(x, where.ecriture))) {
                    const s = sommes.get(l.compteId) ?? { debit: 0, credit: 0 };
                    sommes.set(l.compteId, { debit: s.debit + l.debit, credit: s.credit + l.credit });
                }
                return [...sommes].map(([compteId, _sum]) => ({ compteId, _sum }));
            },
            findMany: async ({ where, }) => {
                const f = where.ecriture;
                const retenues = lignes.filter((l) => f.tenantId.in.includes(l.tenantId) && f.exerciceId.in.includes(l.exerciceId) && statutRetenu(l, f.statut));
                const internes = new Set(retenues.filter((l) => f.lignes.some.compteId.in.includes(l.compteId)).map((l) => l.ecritureId));
                return retenues
                    .filter((l) => internes.has(l.ecritureId))
                    .map((l) => ({
                    ecritureId: l.ecritureId,
                    compteId: l.compteId,
                    debit: l.debit,
                    credit: l.credit,
                    ecriture: { tenantId: l.tenantId },
                    compte: { numero: l.numero, intitule: l.intitule },
                }));
            },
        },
    }, {}, undefined, {
        liasseCompleteExcel: async () => {
            throw new Error("la liasse ne doit pas être produite sur un agrégat dont l'élimination ne boucle pas");
        },
    });
}
const ligne = (ecritureId, tenantId, exerciceId, compteId, numero, intitule, debit, credit) => ({ ecritureId, tenantId, exerciceId, compteId, numero, intitule, debit, credit });
const VENTE_INTERNE = [
    ligne('e-cotis', 'mere', 'ex-m', 'cpt-521', '52110000', 'Banque', 2_000_000, 0),
    ligne('e-cotis', 'mere', 'ex-m', 'cpt-701', '70100000', 'Cotisations', 0, 2_000_000),
    ligne('e-fact', 'mere', 'ex-m', 'cpt-411ant', '41110000', 'Antenne Matete', 1_000_000, 0),
    ligne('e-fact', 'mere', 'ex-m', 'cpt-706', '70600000', 'Prestations de services', 0, 1_000_000),
    ligne('e-dons', 'c1', 'ex-c1', 'cpt-571', '57100000', 'Caisse', 500_000, 0),
    ligne('e-dons', 'c1', 'ex-c1', 'cpt-758', '75800000', 'Dons', 0, 500_000),
    ligne('e-achat', 'c1', 'ex-c1', 'cpt-605', '60500000', 'Autres achats', 1_000_000, 0),
    ligne('e-achat', 'c1', 'ex-c1', 'cpt-401sie', '40110000', 'Siège', 0, 1_000_000),
];
const DEUX_COTES = [
    { compteId: 'cpt-411ant', tenantId: 'mere', code: 'CLI-ANT', nom: 'Antenne Matete', celluleGroupeId: 'c1' },
    { compteId: 'cpt-401sie', tenantId: 'c1', code: 'FRS-SIE', nom: 'Siège', celluleGroupeId: 'mere' },
];
describe('agrégat du groupe · les opérations réciproques sortent, et on voit ce qui sort', () => {
    it('la vente du siège à son antenne ne fait plus de chiffre d’affaires au groupe', async () => {
        const a = await service(VENTE_INTERNE, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(a.totaux.debit).toBe(2_500_000);
        expect(a.totaux.credit).toBe(2_500_000);
        expect(a.lignes.find((l) => l.numero === '70600000')).toBeUndefined();
        expect(a.lignes.find((l) => l.numero === '60500000')).toBeUndefined();
        expect(a.lignes.find((l) => l.numero === '70100000').totalCredit).toBe(2_000_000);
        expect(a.lignes.find((l) => l.numero === '75800000').totalCredit).toBe(500_000);
        expect(a.lignes.find((l) => l.numero === '41110000')).toBeUndefined();
        expect(a.lignes.find((l) => l.numero === '40110000')).toBeUndefined();
        expect(a.lignes.find((l) => l.numero === '52110000').totalDebit).toBe(2_000_000);
        expect(a.lignes.find((l) => l.numero === '57100000').totalDebit).toBe(500_000);
    });
    it('rend ce qu’il a retiré · sinon l’agrégat ne se rapproche plus des balances', async () => {
        const a = await service(VENTE_INTERNE, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(a.totauxEliminations).toEqual({ debit: 2_000_000, credit: 2_000_000 });
        expect(a.controles.eliminationsSymetriques).toBe(true);
        expect(a.controles.ecartElimination).toBe(0);
        expect(a.eliminations.map((e) => `${e.dossier} ${e.numero} ${e.motif} ${e.debit}/${e.credit} vs ${e.contrepartie}`)).toEqual([
            'Antenne Matete 40110000 Créance ou dette réciproque 0/1000000 vs Siège',
            'Antenne Matete 60500000 Charge ou produit réciproque 1000000/0 vs Siège',
            'Siège 41110000 Créance ou dette réciproque 1000000/0 vs Antenne Matete',
            'Siège 70600000 Charge ou produit réciproque 0/1000000 vs Antenne Matete',
        ]);
        const brut = a.detailParDossier.reduce((s, l) => ({ debit: s.debit + l.totalDebit, credit: s.credit + l.totalCredit }), { debit: 0, credit: 0 });
        expect(brut.debit - a.totauxEliminations.debit).toBe(a.totaux.debit);
        expect(brut.credit - a.totauxEliminations.credit).toBe(a.totaux.credit);
    });
    it('une SIMULATION d’opération interne ne sort rien de l’agrégat · la balance ne l’a jamais lue (relecture B2)', async () => {
        const simulation = [
            { ...ligne('e-sim', 'mere', 'ex-m', 'cpt-411ant', '41110000', 'Antenne Matete', 300_000, 0), statut: 'SITUATION' },
            { ...ligne('e-sim', 'mere', 'ex-m', 'cpt-706', '70600000', 'Prestations de services', 0, 300_000), statut: 'SITUATION' },
        ];
        const sans = await service(VENTE_INTERNE, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        const avec = await service([...VENTE_INTERNE, ...simulation], DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(avec.totauxEliminations).toEqual(sans.totauxEliminations);
        expect(avec.totaux).toEqual(sans.totaux);
        expect(avec.lignes).toEqual(sans.lignes);
        expect(avec.ecartsReciprocite).toEqual([]);
    });
    it('la réciprocité se boucle · la créance chez l’un est la dette chez l’autre', async () => {
        const a = await service(VENTE_INTERNE, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(a.ecartsReciprocite).toEqual([]);
        expect(a.controles.reciprocitesEquilibrees).toBe(true);
        expect(a.avertissements).toEqual([]);
    });
});
describe('agrégat du groupe · le règlement interne déplace la trésorerie, il ne l’efface pas', () => {
    const AVEC_REGLEMENT = [
        ...VENTE_INTERNE,
        ligne('e-regl', 'mere', 'ex-m', 'cpt-521', '52110000', 'Banque', 400_000, 0),
        ligne('e-regl', 'mere', 'ex-m', 'cpt-411ant', '41110000', 'Antenne Matete', 0, 400_000),
        ligne('e-regl2', 'c1', 'ex-c1', 'cpt-401sie', '40110000', 'Siège', 400_000, 0),
        ligne('e-regl2', 'c1', 'ex-c1', 'cpt-571', '57100000', 'Caisse', 0, 400_000),
    ];
    it('la classe 5 reste dans l’agrégat, et les deux mouvements s’y compensent', async () => {
        const a = await service(AVEC_REGLEMENT, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(a.lignes.find((l) => l.numero === '52110000').totalDebit).toBe(2_400_000);
        expect(a.lignes.find((l) => l.numero === '57100000').totalCredit).toBe(400_000);
        expect(a.eliminations.some((e) => e.numero.startsWith('5'))).toBe(false);
        expect(a.eliminations.find((e) => e.numero === '41110000')).toMatchObject({
            debit: 1_000_000,
            credit: 400_000,
        });
        expect(a.eliminations.find((e) => e.numero === '40110000')).toMatchObject({
            debit: 400_000,
            credit: 1_000_000,
        });
        expect(a.controles.eliminationsSymetriques).toBe(true);
        expect(a.controles.reciprocitesEquilibrees).toBe(true);
        expect(a.totaux.debit).toBe(a.totaux.credit);
    });
});
describe('agrégat du groupe · l’écart de réciprocité est NOMMÉ, jamais corrigé', () => {
    const UN_SEUL_COTE = VENTE_INTERNE.filter((l) => l.ecritureId !== 'e-achat');
    const RATTACHEMENT_SIEGE = [DEUX_COTES[0]];
    it('dit les deux soldes en présence et leur écart, sans en réécrire aucun', async () => {
        const a = await service(UN_SEUL_COTE, RATTACHEMENT_SIEGE).balanceAgregee('mere', 'ex-m');
        expect(a.controles.reciprocitesEquilibrees).toBe(false);
        expect(a.ecartsReciprocite).toEqual([
            {
                dossier: 'Antenne Matete',
                contrepartie: 'Siège',
                solde: 0,
                soldeContrepartie: 1_000_000,
                ecart: 1_000_000,
            },
        ]);
        const chezLeSiege = a.detailParDossier.find((d) => d.dossier === 'Siège' && d.numero === '41110000');
        expect(chezLeSiege.totalDebit).toBe(1_000_000);
        expect(a.detailParDossier.some((d) => d.dossier === 'Antenne Matete' && d.numero === '40110000')).toBe(false);
    });
    it('la liasse du groupe refuse, nomme les deux dossiers et cite les deux soldes', async () => {
        const promesse = service(UN_SEUL_COTE, RATTACHEMENT_SIEGE).liasseGroupe('mere', 'ex-m', 'u-1');
        await expect(promesse).rejects.toThrow(common_1.BadRequestException);
        const message = await promesse.catch((e) => e.message);
        expect(message).toContain('Siège');
        expect(message).toContain('Antenne Matete');
        expect(message).toContain('1000000.00');
        expect(message).toContain('0.00');
        expect(message).toMatch(/ne choisit pas lequel des deux dossiers a raison/);
    });
});
describe('agrégat du groupe · une élimination boiteuse ne passe pas en liasse', () => {
    const TRAVAUX_IMMOBILISES = [
        ligne('e-fact', 'mere', 'ex-m', 'cpt-411ant', '41110000', 'Antenne Matete', 1_000_000, 0),
        ligne('e-fact', 'mere', 'ex-m', 'cpt-706', '70600000', 'Prestations de services', 0, 1_000_000),
        ligne('e-immo', 'c1', 'ex-c1', 'cpt-239', '23900000', 'Bâtiments en cours', 1_000_000, 0),
        ligne('e-immo', 'c1', 'ex-c1', 'cpt-401sie', '40110000', 'Siège', 0, 1_000_000),
    ];
    it('nomme l’écart d’élimination alors même que la réciprocité se boucle', async () => {
        const a = await service(TRAVAUX_IMMOBILISES, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(a.controles.reciprocitesEquilibrees).toBe(true);
        expect(a.controles.eliminationsSymetriques).toBe(false);
        expect(a.totauxEliminations).toEqual({ debit: 1_000_000, credit: 2_000_000 });
        expect(a.controles.ecartElimination).toBe(-1_000_000);
    });
    it('la liasse du groupe refuse et renvoie à la feuille des éliminations', async () => {
        const promesse = service(TRAVAUX_IMMOBILISES, DEUX_COTES).liasseGroupe('mere', 'ex-m', 'u-1');
        await expect(promesse).rejects.toThrow(common_1.BadRequestException);
        const message = await promesse.catch((e) => e.message);
        expect(message).toContain('non symétrique');
        expect(message).toContain('-1000000.00');
        expect(message).toContain('Éliminations');
    });
});
describe('agrégat du groupe · un rattachement hors groupe n’élimine rien', () => {
    const HORS_GROUPE = [
        { compteId: 'cpt-411ant', tenantId: 'mere', code: 'CLI-X', nom: 'Société X', celluleGroupeId: 'autre-dossier' },
    ];
    it('laisse la vente dans l’agrégat et nomme le rattachement', async () => {
        const a = await service(VENTE_INTERNE, HORS_GROUPE).balanceAgregee('mere', 'ex-m');
        expect(a.totaux.debit).toBe(4_500_000);
        expect(a.totaux.credit).toBe(4_500_000);
        expect(a.eliminations).toEqual([]);
        expect(a.controles.rattachementsValides).toBe(false);
        expect(a.rattachementsRefuses).toEqual([
            {
                dossier: 'Siège',
                codeTiers: 'CLI-X',
                nomTiers: 'Société X',
                motif: 'le dossier désigné n’appartient pas à ce groupe',
            },
        ]);
    });
    it('refuse aussi un tiers qui désigne son propre dossier', async () => {
        const a = await service(VENTE_INTERNE, [
            { compteId: 'cpt-411ant', tenantId: 'mere', code: 'CLI-Y', nom: 'Nous-mêmes', celluleGroupeId: 'mere' },
        ]).balanceAgregee('mere', 'ex-m');
        expect(a.rattachementsRefuses[0].motif).toBe('le tiers désigne son propre dossier');
        expect(a.eliminations).toEqual([]);
    });
    it('la liasse du groupe refuse et dit quel tiers corriger', async () => {
        const promesse = service(VENTE_INTERNE, HORS_GROUPE).liasseGroupe('mere', 'ex-m', 'u-1');
        await expect(promesse).rejects.toThrow(common_1.BadRequestException);
        const message = await promesse.catch((e) => e.message);
        expect(message).toContain('CLI-X');
        expect(message).toContain('Société X');
    });
});
describe('agrégat du groupe · ce que l’élimination ne sait pas faire, elle le dit', () => {
    const CESSION_INTERNE = [
        ligne('e-cess', 'mere', 'ex-m', 'cpt-411ant', '41110000', 'Antenne Matete', 3_000_000, 0),
        ligne('e-cess', 'mere', 'ex-m', 'cpt-82', '82000000', 'Produits des cessions d’immobilisations', 0, 3_000_000),
        ligne('e-acq', 'c1', 'ex-c1', 'cpt-245', '24500000', 'Matériel de transport', 3_000_000, 0),
        ligne('e-acq', 'c1', 'ex-c1', 'cpt-401sie', '40110000', 'Siège', 0, 3_000_000),
    ];
    it('avertit sur la cession interne d’immobilisation au lieu d’inventer sa neutralisation', async () => {
        const a = await service(CESSION_INTERNE, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(a.lignes.find((l) => l.numero === '82000000').totalCredit).toBe(3_000_000);
        expect(a.lignes.find((l) => l.numero === '24500000').totalDebit).toBe(3_000_000);
        expect(a.lignes.find((l) => l.numero === '41110000')).toBeUndefined();
        expect(a.avertissements).toHaveLength(1);
        expect(a.avertissements[0]).toContain('82000000');
        expect(a.avertissements[0]).toContain('valeur brute');
        expect(a.avertissements[0]).toContain('postulat de l’entité');
        expect(a.avertissements[0]).not.toContain('D4C');
    });
    it('au SYSCOHADA, le fondement est la fiche du compte 18, le D4C n’étant qu’une méthode empruntée', async () => {
        const a = await service(CESSION_INTERNE, DEUX_COTES, { referentiel: 'SYSCOHADA' }).balanceAgregee('mere', 'ex-m');
        const cession = a.avertissements.find((x) => x.includes('82000000'));
        expect(cession).toContain('compte 18');
        expect(cession).toContain('référence empruntée');
    });
    it('avertit sur la marge interne restée dans les stocks', async () => {
        const AVEC_STOCK = [
            ...VENTE_INTERNE,
            ligne('e-stock', 'c1', 'ex-c1', 'cpt-32', '32000000', 'Stocks de fournitures', 800_000, 0),
            ligne('e-stock', 'c1', 'ex-c1', 'cpt-603', '60300000', 'Variation de stocks', 0, 800_000),
        ];
        const a = await service(AVEC_STOCK, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(a.avertissements).toHaveLength(1);
        expect(a.avertissements[0]).toContain('800000.00');
        expect(a.avertissements[0]).toContain('postulat de l’entité');
        expect(a.avertissements[0]).toContain('stock de clôture');
    });
    it('ne dit rien quand il n’y a rien à dire · un avertissement qui s’affiche toujours ne se lit plus', async () => {
        const a = await service(VENTE_INTERNE, DEUX_COTES).balanceAgregee('mere', 'ex-m');
        expect(a.avertissements).toEqual([]);
    });
});
describe('agrégat du groupe · aucun tiers-cellule, aucun changement', () => {
    it('rend au centime l’agrégat d’avant · c’est l’état de tous les dossiers existants', async () => {
        const a = await service(VENTE_INTERNE, []).balanceAgregee('mere', 'ex-m');
        expect(a.totaux.debit).toBe(4_500_000);
        expect(a.totaux.credit).toBe(4_500_000);
        expect(a.lignes.find((l) => l.numero === '70600000').totalCredit).toBe(1_000_000);
        expect(a.lignes.find((l) => l.numero === '41110000').totalDebit).toBe(1_000_000);
        expect(a.eliminations).toEqual([]);
        expect(a.totauxEliminations).toEqual({ debit: 0, credit: 0 });
        expect(a.ecartsReciprocite).toEqual([]);
        expect(a.rattachementsRefuses).toEqual([]);
        expect(a.avertissements).toEqual([]);
        expect(a.controles.reciprocitesEquilibrees).toBe(true);
        expect(a.controles.eliminationsSymetriques).toBe(true);
        expect(a.controles.rattachementsValides).toBe(true);
    });
    it('le classeur n’a alors PAS de feuille « Éliminations » · rien à montrer, rien de montré', async () => {
        const classeur = await service(VENTE_INTERNE, []).balanceAgregeeExcel('mere', 'ex-m');
        const { Workbook } = await Promise.resolve().then(() => require('exceljs'));
        const wb = new Workbook();
        await wb.xlsx.load(classeur.buffer);
        expect(wb.getWorksheet('Éliminations')).toBeUndefined();
    });
});
describe('classeur de la balance agrégée · la feuille « Éliminations »', () => {
    it('porte chaque ligne retirée et un total qui boucle avec les deux autres feuilles', async () => {
        const classeur = await service(VENTE_INTERNE, DEUX_COTES).balanceAgregeeExcel('mere', 'ex-m');
        const { Workbook } = await Promise.resolve().then(() => require('exceljs'));
        const wb = new Workbook();
        await wb.xlsx.load(classeur.buffer);
        const elim = wb.getWorksheet('Éliminations');
        expect(elim.rowCount).toBe(1 + 4 + 1);
        const total = elim.getRow(elim.rowCount);
        expect(total.getCell(1).value).toBe('TOTAL ÉLIMINÉ');
        expect(total.getCell(6).value).toBe(2_000_000);
        expect(total.getCell(7).value).toBe(2_000_000);
        const controles = wb.getWorksheet('Contrôles');
        let pont = [];
        let totalControles = [];
        controles.eachRow((row) => {
            if (String(row.getCell(1).value) === 'Éliminations des opérations réciproques') {
                pont = [row.getCell(2).value, row.getCell(3).value];
            }
            if (String(row.getCell(1).value) === 'TOTAL AGRÉGÉ') {
                totalControles = [row.getCell(2).value, row.getCell(3).value];
            }
        });
        expect(pont).toEqual([-2_000_000, -2_000_000]);
        expect(totalControles).toEqual([2_500_000, 2_500_000]);
        const agregee = wb.getWorksheet('Balance agrégée');
        const numeros = [];
        agregee.eachRow((row, i) => {
            if (i > 1)
                numeros.push(String(row.getCell(1).value));
        });
        expect(numeros.sort()).toEqual(['52110000', '57100000', '70100000', '75800000']);
    });
    it('la feuille « Contrôles » ne tait ni l’écart de réciprocité ni le rattachement refusé', async () => {
        const UN_SEUL_COTE = VENTE_INTERNE.filter((l) => l.ecritureId !== 'e-achat');
        const classeur = await service(UN_SEUL_COTE, [DEUX_COTES[0]]).balanceAgregeeExcel('mere', 'ex-m');
        const { Workbook } = await Promise.resolve().then(() => require('exceljs'));
        const wb = new Workbook();
        await wb.xlsx.load(classeur.buffer);
        const controles = wb.getWorksheet('Contrôles');
        let dit = '';
        controles.eachRow((row) => {
            const v = String(row.getCell(5).value ?? '');
            if (!v.includes('ÉCART DE RÉCIPROCITÉ'))
                return;
            dit = `${String(row.getCell(1).value)} | ${row.getCell(2).value} | ${row.getCell(3).value} | ${v}`;
        });
        expect(dit).toContain('Antenne Matete');
        expect(dit).toContain('Siège');
        expect(dit).toContain('1000000.00');
        expect(dit).toContain('| 0 | 1000000 |');
    });
});
//# sourceMappingURL=operations-reciproques-agregat.spec.js.map