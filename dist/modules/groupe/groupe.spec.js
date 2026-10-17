"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const groupe_service_1 = require("./groupe.service");
const EX_MERE = { id: 'ex-m', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const BALANCES = {
    mere: {
        lignes: [
            { numero: '52', intitule: 'BANQUES', typeCompte: 'TOTAL', totalDebit: 1000, totalCredit: 300, solde: 700 },
            { numero: '521000', intitule: 'Banque', typeCompte: 'DETAIL', totalDebit: 1000, totalCredit: 300, solde: 700 },
            { numero: '581000', intitule: 'Virements internes', typeCompte: 'DETAIL', totalDebit: 300, totalCredit: 0, solde: 300 },
            { numero: '701000', intitule: 'Cotisations', typeCompte: 'DETAIL', totalDebit: 0, totalCredit: 1000, solde: -1000 },
        ],
        totaux: { debit: 1300, credit: 1300 },
    },
    c1: {
        lignes: [
            { numero: '571000', intitule: 'Caisse', typeCompte: 'DETAIL', totalDebit: 300, totalCredit: 100, solde: 200 },
            { numero: '581000', intitule: 'Virements internes', typeCompte: 'DETAIL', totalDebit: 0, totalCredit: 300, solde: -300 },
            { numero: '601000', intitule: 'Achats', typeCompte: 'DETAIL', totalDebit: 100, totalCredit: 0, solde: 100 },
        ],
        totaux: { debit: 400, credit: 400 },
    },
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
const lectureDuGroupe = (balanceC1 = BALANCES.c1) => lectureDesBalances({
    mere: { exerciceId: 'ex-m', lignes: BALANCES.mere.lignes },
    c1: { exerciceId: 'ex-c1', lignes: balanceC1.lignes },
});
const service = (surcharges) => new groupe_service_1.GroupeService({
    ...lectureDuGroupe(surcharges?.balanceC1),
    exercice: { findFirst: async ({ where }) => (where.id === 'ex-m' && where.tenantId === 'mere' ? EX_MERE : null) },
    tiersCompte: { findMany: async () => [] },
    tenant: {
        findUnique: async () => ({ id: 'mere', nom: 'Église centrale' }),
        findMany: async ({ where }) => where.dossierMereId === 'mere'
            ? [
                { id: 'c1', nom: 'Cellule A', exercices: [{ id: 'ex-c1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }] },
                { id: 'c2', nom: 'Cellule B', exercices: [{ id: 'ex-c2', dateDebut: new Date('2024-01-01'), dateFin: new Date('2024-12-31') }] },
            ]
            : [],
    },
}, {}, undefined, undefined);
describe('GroupeService · balance agrégée', () => {
    it('agrège par numéro, comptes Détail seulement, et neutralise les 58 enregistrés des deux côtés', async () => {
        const a = await service().balanceAgregee('mere', 'ex-m');
        expect(a.lignes.find((l) => l.numero === '52')).toBeUndefined();
        const l58 = a.lignes.find((l) => l.numero === '581000');
        expect(l58.totalDebit).toBe(300);
        expect(l58.totalCredit).toBe(300);
        expect(a.controles.liaisonNeutralisee).toBe(true);
        expect(a.totaux.debit).toBe(1700);
        expect(a.totaux.credit).toBe(1700);
        expect(a.controles.tousEquilibres).toBe(true);
        expect(a.cellulesSansExercice).toEqual([{ id: 'c2', nom: 'Cellule B' }]);
        expect(a.detailParDossier.filter((d) => d.dossier === 'Cellule A')).toHaveLength(3);
    });
    it('un transfert enregistré d’un seul côté laisse un écart sur les 58, et il est dénoncé', async () => {
        const a = await service({
            balanceC1: {
                lignes: [
                    { numero: '571000', intitule: 'Caisse', typeCompte: 'DETAIL', totalDebit: 200, totalCredit: 100, solde: 100 },
                    { numero: '581000', intitule: 'Virements internes', typeCompte: 'DETAIL', totalDebit: 0, totalCredit: 200, solde: -200 },
                    { numero: '601000', intitule: 'Achats', typeCompte: 'DETAIL', totalDebit: 100, totalCredit: 0, solde: 100 },
                ],
                totaux: { debit: 300, credit: 300 },
            },
        }).balanceAgregee('mere', 'ex-m');
        expect(a.controles.liaisonNeutralisee).toBe(false);
        expect(a.controles.ecartLiaison).toBe(100);
    });
    it("refuse un exercice qui n'appartient pas au dossier appelant", async () => {
        await expect(service().balanceAgregee('mere', 'ex-etranger')).rejects.toThrow(common_1.NotFoundException);
    });
    it('refuse un dossier sans cellule · la fenêtre ne doit pas afficher un agrégat vide trompeur', async () => {
        const s = new groupe_service_1.GroupeService({
            exercice: { findFirst: async () => EX_MERE },
            tenant: { findUnique: async () => ({ id: 'seul', nom: 'Dossier seul' }), findMany: async () => [] },
            tiersCompte: { findMany: async () => [] },
        }, {}, undefined, undefined);
        await expect(s.balanceAgregee('seul', 'ex-m')).rejects.toThrow(common_1.BadRequestException);
    });
    it("l'export Excel garde la feuille « Balance agrégée » réimportable : quatre colonnes, pas de ligne de total", async () => {
        const classeur = await service().balanceAgregeeExcel('mere', 'ex-m');
        expect(classeur.nomFichier).toBe('balance-agregee-groupe-2026.xlsx');
        const { Workbook } = await Promise.resolve().then(() => require('exceljs'));
        const wb = new Workbook();
        await wb.xlsx.load(classeur.buffer);
        const feuille = wb.getWorksheet('Balance agrégée');
        expect([feuille.getCell('A1').value, feuille.getCell('B1').value, feuille.getCell('C1').value, feuille.getCell('D1').value]).toEqual([
            'Numéro',
            'Intitulé',
            'Débit',
            'Crédit',
        ]);
        const derniere = feuille.getRow(feuille.rowCount);
        expect(String(derniere.getCell(1).value)).toMatch(/^\d/);
        expect(wb.getWorksheet('Contrôles')).toBeDefined();
        expect(wb.getWorksheet('Par dossier')).toBeDefined();
    });
});
describe('GroupeService · création de cellules par le siège', () => {
    const service = (mere) => {
        const traces = { register: [], majTenant: [], majLicence: [], majUser: [] };
        const s = new groupe_service_1.GroupeService({
            tenant: {
                findUnique: async () => ({
                    id: 'mere',
                    dossierMereId: mere.dossierMereId ?? null,
                    plafondCellules: mere.plafondCellules ?? null,
                    referentiel: mere.referentiel ?? 'SYCEBNL',
                    licence: mere.licence ?? null,
                    _count: { cellules: mere.cellules ?? 0 },
                }),
                update: async (args) => {
                    traces.majTenant.push(args);
                    return {};
                },
            },
            licence: {
                update: async (args) => {
                    traces.majLicence.push(args);
                    return {};
                },
            },
            user: {
                update: async (args) => {
                    traces.majUser.push(args);
                    return {};
                },
            },
        }, undefined, {
            register: async (dto) => {
                traces.register.push(dto);
                return { tenant: { id: 't-cellule', nom: dto.nomEntite }, exercice: null, accessToken: 'jeton' };
            },
        }, undefined);
        return { s, traces };
    };
    it('rattachement forcé, licence héritée, jamais le jeton · les trois verrous en un seul appel', async () => {
        const echeance = new Date('2027-06-30');
        const { s, traces } = service({
            plafondCellules: 10,
            cellules: 3,
            licence: { type: 'ABONNEMENT', dateExpiration: echeance },
        });
        const resultat = await s.creerCellule('mere', { nom: 'Cellule Ngaliema 12', emailAdmin: 'tresorier@eglise.cd' });
        expect(traces.register[0].typeLicence).toBe('ABONNEMENT');
        expect(traces.majTenant[0]).toEqual({ where: { id: 't-cellule' }, data: { dossierMereId: 'mere' } });
        expect(traces.majLicence[0].data.dateExpiration).toBe(echeance);
        expect(resultat.motDePasseTemporaire.length).toBeGreaterThanOrEqual(16);
        expect(resultat).not.toHaveProperty('accessToken');
        expect(traces.majUser[0]).toEqual({ where: { email: 'tresorier@eglise.cd' }, data: { doitChangerMotDePasse: true } });
    });
    it('plafond nul = création désactivée · plafond atteint = refus · une cellule ne crée pas de cellules', async () => {
        await expect(service({ plafondCellules: null }).s.creerCellule('mere', { nom: 'X', emailAdmin: 'x@x.cd' })).rejects.toThrow(common_1.BadRequestException);
        await expect(service({ plafondCellules: 5, cellules: 5 }).s.creerCellule('mere', { nom: 'X', emailAdmin: 'x@x.cd' })).rejects.toThrow(common_1.BadRequestException);
        await expect(service({ dossierMereId: 'grand-mere', plafondCellules: 5 }).s.creerCellule('mere', { nom: 'X', emailAdmin: 'x@x.cd' })).rejects.toThrow(common_1.BadRequestException);
    });
    it('sous un siège SYSCOHADA, la succursale naît SYSCOHADA, au système du siège, sans jeu SYCEBNL', async () => {
        const { s, traces } = service({ plafondCellules: 5, referentiel: 'SYSCOHADA' });
        await s.creerCellule('mere', {
            nom: 'Succursale Lubumbashi',
            emailAdmin: 'x@x.cd',
            jeuEtatsFinanciersSycebnl: 'PROJETS_DEVELOPPEMENT',
        });
        const envoye = traces.register[0];
        expect(envoye.referentiel).toBe('SYSCOHADA');
        expect(envoye.systemeComptableSyscohada).toBe('NORMAL');
        expect(envoye.jeuEtatsFinanciersSycebnl).toBeUndefined();
    });
    it('sous un siège SYCEBNL, la cellule naît SYCEBNL avec son jeu, sans système SYSCOHADA', async () => {
        const { s, traces } = service({ plafondCellules: 5 });
        await s.creerCellule('mere', {
            nom: 'Cellule Matete',
            emailAdmin: 'x@x.cd',
            jeuEtatsFinanciersSycebnl: 'SYSTEME_MINIMAL_TRESORERIE',
        });
        const envoye = traces.register[0];
        expect(envoye.referentiel).toBe('SYCEBNL');
        expect(envoye.jeuEtatsFinanciersSycebnl).toBe('SYSTEME_MINIMAL_TRESORERIE');
        expect(envoye.systemeComptableSyscohada).toBeUndefined();
    });
});
describe('GroupeService · canevas de trésorerie', () => {
    const EX = { id: 'ex-c', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
    const prismaCanevas = (creees) => ({
        tenant: {
            findFirst: async () => ({ id: 'c1', nom: 'Cellule A' }),
            findMany: async () => [{ id: 'c1' }],
            findUnique: async () => ({ dossierCombinaisonId: null }),
        },
        exercice: { findFirst: async () => EX },
        ecriture: { findFirst: async () => null },
        compte: {
            findMany: async ({ where }) => where.numero.in.map((n) => ({ id: `cpt-${n}`, numero: n })),
        },
        journal: {
            findMany: async () => [
                { id: 'j-ca', code: 'CA' },
                { id: 'j-bq', code: 'BQ' },
            ],
        },
        $transaction: async (fn) => fn({
            ecriture: {
                create: async (args) => {
                    creees.push(args);
                    return {};
                },
            },
        }),
    });
    const ecritureCanevas = (refus) => ({
        controlesDEntree: jest.fn().mockImplementation(async () => {
            if (refus)
                throw refus;
            return {};
        }),
    });
    const remplir = async (buffer, lignes) => {
        const { Workbook } = await Promise.resolve().then(() => require('exceljs'));
        const wb = new Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.getWorksheet('Journal de trésorerie');
        lignes.forEach((l, i) => {
            const row = ws.getRow(6 + i);
            row.getCell(1).value = new Date(l[0]);
            row.getCell(2).value = l[1];
            row.getCell(3).value = l[2];
            if (l[3] !== '')
                row.getCell(4).value = l[3];
            if (l[4] !== '')
                row.getCell(5).value = l[4];
            row.getCell(6).value = l[5];
        });
        return Buffer.from(await wb.xlsx.writeBuffer());
    };
    it('aller-retour complet : le canevas généré, rempli, s’importe en écritures équilibrées de brouillard', async () => {
        const creees = [];
        const s = new groupe_service_1.GroupeService(prismaCanevas(creees), ecritureCanevas(), undefined, undefined);
        const canevas = await s.canevas('mere', 'c1');
        expect(canevas.nomFichier).toBe('canevas-cellule-a-2026.xlsx');
        const rempli = await remplir(canevas.buffer, [
            ['2026-03-01', 'Quête du dimanche', 'Dîmes, quêtes et assimilées', 500, '', 'Caisse'],
            ['2026-03-04', 'Transport réunion', 'Transports et déplacements', '', 30, 'Caisse'],
            ['2026-03-10', '', 'Transfert reçu du siège ou d’une cellule', 200, '', 'Banque'],
        ]);
        const rapport = await s.importerCanevas('mere', 'c1', 'user-siege', {
            nomFichier: 'canevas.xlsx',
            contenuBase64: rempli.toString('base64'),
        });
        expect(rapport.importe).toBe(true);
        expect(rapport.lignesImportees).toBe(3);
        expect(creees).toHaveLength(3);
        for (const e of creees) {
            const [l1, l2] = e.data.lignes.create;
            expect(l1.debit + l2.debit).toBeCloseTo(l1.credit + l2.credit);
        }
        expect(creees[2].data.journalId).toBe('j-bq');
        expect(creees[2].data.libelle).toBe('Transfert reçu du siège ou d’une cellule');
        expect(creees[0].data.reference).toMatch(/^CANEVAS [0-9a-f]{10}$/);
    });
    it('tout ou rien : une seule ligne fausse fait tout refuser, anomalies nommées ligne par ligne', async () => {
        const creees = [];
        const s = new groupe_service_1.GroupeService(prismaCanevas(creees), ecritureCanevas(), undefined, undefined);
        const canevas = await s.canevas('mere', 'c1');
        const rempli = await remplir(canevas.buffer, [
            ['2026-03-01', 'Bonne ligne', 'Dons et offrandes', 100, '', 'Caisse'],
            ['2026-03-02', 'Sens inversé', 'Dons et offrandes', '', 100, 'Caisse'],
            ['2025-01-15', 'Trop tôt', 'Dons et offrandes', 50, '', 'Caisse'],
        ]);
        const rapport = await s.importerCanevas('mere', 'c1', 'user-siege', {
            nomFichier: 'canevas.xlsx',
            contenuBase64: rempli.toString('base64'),
        });
        expect(rapport.importe).toBe(false);
        expect(creees).toHaveLength(0);
        expect(rapport.anomalies.map((a) => a.ligne)).toEqual([7, 8]);
    });
    it('les contrôles de la saisie sont joués AVANT la première pièce · un refus n’en laisse passer aucune (audit F3)', async () => {
        const creees = [];
        const ecriture = ecritureCanevas(new common_1.BadRequestException('Le journal BQ est en sommeil'));
        const s = new groupe_service_1.GroupeService(prismaCanevas(creees), ecriture, undefined, undefined);
        const canevas = await s.canevas('mere', 'c1');
        const rempli = await remplir(canevas.buffer, [
            ['2026-03-01', 'Quête', 'Dîmes, quêtes et assimilées', 500, '', 'Caisse'],
            ['2026-03-10', '', 'Transfert reçu du siège ou d’une cellule', 200, '', 'Banque'],
        ]);
        await expect(s.importerCanevas('mere', 'c1', 'u', { nomFichier: 'c.xlsx', contenuBase64: rempli.toString('base64') })).rejects.toThrow(/en sommeil/);
        expect(creees).toHaveLength(0);
        const [dossier, piece] = ecriture.controlesDEntree.mock.calls[0];
        expect([dossier, piece.exerciceId, piece.lignes.length]).toEqual(['c1', 'ex-c', 2]);
    });
    it('un fichier qui n’est pas le canevas officiel est refusé net', async () => {
        const s = new groupe_service_1.GroupeService(prismaCanevas([]), ecritureCanevas(), undefined, undefined);
        const { Workbook } = await Promise.resolve().then(() => require('exceljs'));
        const wb = new Workbook();
        wb.addWorksheet('Feuille1').getCell('A1').value = 'bonjour';
        const etranger = Buffer.from(await wb.xlsx.writeBuffer());
        await expect(s.importerCanevas('mere', 'c1', 'u', { nomFichier: 'x.xlsx', contenuBase64: etranger.toString('base64') })).rejects.toThrow(common_1.BadRequestException);
    });
});
describe('GroupeService · liasse du groupe en un clic', () => {
    const prismaCombinaison = (journalDeAppels, brouillard = {}, balanceC1 = BALANCES.c1) => {
        const lecture = lectureDuGroupe(balanceC1);
        return {
            ligneEcriture: {
                groupBy: lecture.ligneEcriture.groupBy,
                deleteMany: async () => {
                    journalDeAppels.push({ nom: 'lignes.deleteMany' });
                    return { count: 0 };
                },
            },
            exercice: {
                findFirst: async ({ where }) => {
                    if (where.id === 'ex-m' && where.tenantId === 'mere')
                        return EX_MERE;
                    return null;
                },
                create: async ({ data }) => {
                    journalDeAppels.push({ nom: 'exercice.create', args: data });
                    return { id: 'ex-comb' };
                },
            },
            tiersCompte: { findMany: async () => [] },
            tenant: {
                findUnique: async () => ({ id: 'mere', nom: 'Église centrale', dossierCombinaisonId: null }),
                findMany: async () => [
                    { id: 'c1', nom: 'Cellule A', exercices: [{ id: 'ex-c1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }] },
                ],
                create: async ({ data }) => {
                    journalDeAppels.push({ nom: 'tenant.create', args: data });
                    return { id: 't-comb' };
                },
                update: async ({ data }) => {
                    journalDeAppels.push({ nom: 'tenant.update', args: data });
                    return {};
                },
            },
            ecriture: {
                groupBy: async ({ where }) => {
                    journalDeAppels.push({ nom: 'ecriture.groupBy', args: where });
                    return where.OR.filter((c) => (brouillard[`${c.tenantId}|${c.exerciceId}`] ?? 0) > 0).map((c) => ({
                        tenantId: c.tenantId,
                        exerciceId: c.exerciceId,
                        statut: 'BROUILLARD',
                        estANouveauProvisoire: false,
                        _count: { _all: brouillard[`${c.tenantId}|${c.exerciceId}`] },
                        _max: { date: EX_MERE.dateFin },
                    }));
                },
                deleteMany: async () => {
                    journalDeAppels.push({ nom: 'ecritures.deleteMany' });
                    return { count: 0 };
                },
                create: async ({ data }) => {
                    journalDeAppels.push({ nom: 'ecriture.create', args: data });
                    return {};
                },
            },
            compte: {
                createMany: async ({ data }) => {
                    journalDeAppels.push({ nom: 'compte.createMany', args: data });
                    return { count: data.length };
                },
                findMany: async (args) => args.where.numero
                    ? args.where.numero.in.map((n) => ({ id: `cpt-${n}`, numero: n }))
                    : lecture.compte.findMany(args),
            },
            journal: {
                findFirst: async () => null,
                create: async () => ({ id: 'j-od' }),
            },
        };
    };
    it('reverse la balance agrégée dans le dossier de combinaison, régénéré, puis fait produire la liasse aux moteurs existants', async () => {
        const appels = [];
        let liasseDemandee;
        const s = new groupe_service_1.GroupeService(prismaCombinaison(appels), {}, undefined, {
            liasseCompleteExcel: async (tenantId, exerciceId) => {
                liasseDemandee = { tenantId, exerciceId };
                return { buffer: Buffer.from('xlsx'), nomFichier: 'liasse-sycebnl-2026.xlsx' };
            },
        });
        const classeur = await s.liasseGroupe('mere', 'ex-m', 'user-siege');
        expect(liasseDemandee).toEqual({ tenantId: 't-comb', exerciceId: 'ex-comb' });
        expect(classeur.nomFichier).toBe('groupe-liasse-sycebnl-2026.xlsx');
        const creation = appels.find((a) => a.nom === 'tenant.create').args;
        expect(creation.dossierMereId).toBeUndefined();
        expect(creation.jeuEtatsFinanciersSycebnl).toBe('ASSOCIATIONS_ORDRES_PROFESSIONNELS');
        const noms = appels.map((a) => a.nom);
        expect(noms.indexOf('lignes.deleteMany')).toBeLessThan(noms.indexOf('ecriture.create'));
        expect(noms.indexOf('ecritures.deleteMany')).toBeLessThan(noms.indexOf('ecriture.create'));
        const ecriture = appels.find((a) => a.nom === 'ecriture.create').args;
        const debits = ecriture.lignes.create.reduce((s2, l) => s2 + l.debit, 0);
        const credits = ecriture.lignes.create.reduce((s2, l) => s2 + l.credit, 0);
        expect(debits).toBeCloseTo(credits);
        expect(debits).toBeCloseTo(1700);
    });
    it('refuse tant qu’un contrôle est rouge · une liasse fausse à l’apparence officielle serait le pire des livrables', async () => {
        const s = new groupe_service_1.GroupeService(prismaCombinaison([], {}, {
            lignes: [
                { numero: '571000', intitule: 'Caisse', typeCompte: 'DETAIL', totalDebit: 200, totalCredit: 0, solde: 200 },
                { numero: '581000', intitule: 'Virements internes', typeCompte: 'DETAIL', totalDebit: 0, totalCredit: 200, solde: -200 },
            ],
            totaux: { debit: 200, credit: 200 },
        }), {}, undefined, {
            liasseCompleteExcel: async () => {
                throw new Error('ne doit jamais être appelé');
            },
        });
        await expect(s.liasseGroupe('mere', 'ex-m', 'u')).rejects.toThrow(/58/);
    });
    it('refuse tant qu’une cellule a du brouillard · il ne devient pas livre-journal par l’écriture de combinaison (audit F7)', async () => {
        const appels = [];
        const s = new groupe_service_1.GroupeService(prismaCombinaison(appels, { 'c1|ex-c1': 2 }), {}, undefined, {
            liasseCompleteExcel: async () => {
                throw new Error('ne doit jamais être appelé');
            },
        });
        await expect(s.liasseGroupe('mere', 'ex-m', 'u')).rejects.toThrow(/brouillard : Cellule A \(2 pièce\(s\)\)/);
        expect(appels.some((a) => a.nom === 'ecriture.create')).toBe(false);
        const comptages = appels.filter((a) => a.nom === 'ecriture.groupBy').map((a) => a.args);
        expect(comptages).toHaveLength(1);
        expect(comptages[0].OR).toEqual([
            { tenantId: 'mere', exerciceId: 'ex-m' },
            { tenantId: 'c1', exerciceId: 'ex-c1' },
        ]);
    });
});
//# sourceMappingURL=groupe.spec.js.map