"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const import_service_1 = require("./import.service");
const import_dto_1 = require("./dto/import.dto");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const SYCEBNL = new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c.intitule]));
const SYSCOHADA = new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => [c.numero, c.intitule]));
function memesMots(a, b) {
    const mots = (t) => t
        .replace(/\[\d+\]/g, ' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    return mots(a) === mots(b);
}
const COMMUNS = [...SYCEBNL.entries()]
    .filter(([numero]) => SYSCOHADA.has(numero))
    .map(([numero, sycebnl]) => ({ numero, sycebnl, syscohada: SYSCOHADA.get(numero) }));
describe('import · confrontation de l’intitulé lu au plan du référentiel', () => {
    it('tout numéro que les deux plans nomment DIFFÉREMMENT est reconnu, dans les deux sens', () => {
        const divergents = COMMUNS.filter((c) => !memesMots(c.sycebnl, c.syscohada));
        expect(divergents.length).toBeGreaterThan(400);
        const manques = divergents.filter((c) => !(0, import_service_1.intituleDUnAutreReferentiel)(c.numero, c.syscohada, client_1.Referentiel.SYCEBNL) ||
            !(0, import_service_1.intituleDUnAutreReferentiel)(c.numero, c.sycebnl, client_1.Referentiel.SYSCOHADA));
        expect(manques.map((c) => `${c.numero} · ${c.sycebnl} / ${c.syscohada}`)).toEqual([]);
    });
    it('l’intitulé officiel du dossier lui-même n’est JAMAIS refusé', () => {
        const faussesAlertes = [
            ...[...SYCEBNL.entries()].filter(([n, i]) => (0, import_service_1.intituleDUnAutreReferentiel)(n, i, client_1.Referentiel.SYCEBNL)),
            ...[...SYSCOHADA.entries()].filter(([n, i]) => (0, import_service_1.intituleDUnAutreReferentiel)(n, i, client_1.Referentiel.SYSCOHADA)),
        ];
        expect(faussesAlertes.map(([n, i]) => `${n} · ${i}`)).toEqual([]);
    });
    it('un numéro que les deux plans nomment PAREIL ne déclenche rien', () => {
        const identiques = COMMUNS.filter((c) => memesMots(c.sycebnl, c.syscohada));
        expect(identiques.length).toBeGreaterThan(200);
        const alertes = identiques.filter((c) => (0, import_service_1.intituleDUnAutreReferentiel)(c.numero, c.syscohada, client_1.Referentiel.SYCEBNL));
        expect(alertes.map((c) => c.numero)).toEqual([]);
        expect((0, import_service_1.intituleDUnAutreReferentiel)('40130000', 'Fournisseurs sous-traitants', client_1.Referentiel.SYCEBNL)).toBeNull();
    });
    it('un intitulé librement rédigé par le cabinet passe · AUDCIF art. 18, alinéa 3', () => {
        expect((0, import_service_1.intituleDUnAutreReferentiel)('10300000', 'Droits d’entrée 2026', client_1.Referentiel.SYCEBNL)).toBeNull();
        expect((0, import_service_1.intituleDUnAutreReferentiel)('41100001', 'Adhérent Mukendi', client_1.Referentiel.SYCEBNL)).toBeNull();
        expect((0, import_service_1.intituleDUnAutreReferentiel)('10300000', '', client_1.Referentiel.SYCEBNL)).toBeNull();
    });
    it('la comparaison ignore accents, casse et renvois de bas de page du plan SYSCOHADA', () => {
        expect((0, import_service_1.intituleDUnAutreReferentiel)('70110000', 'dans la region', client_1.Referentiel.SYCEBNL)).not.toBeNull();
        expect((0, import_service_1.intituleDUnAutreReferentiel)('10300000', 'CAPITAL PERSONNEL', client_1.Referentiel.SYCEBNL)).not.toBeNull();
    });
});
const COMPTES = [
    { id: 'c52', numero: '52110000', typeCompte: 'DETAIL' },
    { id: 'c40', numero: '40110000', typeCompte: 'DETAIL' },
    { id: 'c10', numero: '10110000', typeCompte: 'DETAIL' },
    { id: 'c103', numero: '10300000', typeCompte: 'DETAIL' },
    { id: 'c131', numero: '13100000', typeCompte: 'DETAIL' },
];
function service(referentiel = client_1.Referentiel.SYCEBNL) {
    const creerEcriture = jest.fn().mockResolvedValue({ id: 'e1' });
    const creerComptes = jest.fn();
    const tx = {
        compte: {
            createMany: creerComptes,
            findMany: jest.fn().mockResolvedValue(COMPTES.map((c) => ({ id: c.id, numero: c.numero }))),
        },
        ecriture: { create: creerEcriture },
    };
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't', longueurCompte: 8, referentiel }) },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                statut: 'OUVERT',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        journal: { findMany: jest.fn().mockResolvedValue([{ id: 'j-od', code: 'OD', type: 'GENERAL' }]) },
        compte: { findMany: jest.fn().mockResolvedValue(COMPTES), createMany: creerComptes },
        $transaction: jest.fn().mockImplementation((f) => f(tx)),
    };
    const ecritureService = { controlesDEntree: jest.fn().mockResolvedValue({}) };
    return { svc: new import_service_1.ImportService(prisma, ecritureService), creerEcriture, creerComptes };
}
function csv(entete, lignes) {
    return Buffer.from([entete, ...lignes.map((l) => l.join(';'))].join('\n'), 'utf8').toString('base64');
}
describe('import d’un PLAN DE COMPTES venu de l’autre référentiel', () => {
    it('refuse la ligne, ne crée pas le compte, et dit d’où vient l’intitulé', async () => {
        const { svc, creerComptes } = service(client_1.Referentiel.SYCEBNL);
        const rapport = await svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.PLAN_COMPTES,
            nomFichier: 'plan.csv',
            contenuBase64: csv('numero;intitule', [
                ['52200000', 'Banques autres États région'],
                ['41100001', 'Adhérent Mukendi'],
            ]),
            mapping: { numero: 'numero', intitule: 'intitule' },
        });
        const refus = rapport.anomalies.map((a) => a.message).join(' | ');
        expect(refus).toMatch(/52200000/);
        expect(refus).toMatch(/SYSCOHADA/);
        expect(refus).toMatch(/AUDCIF art\. 17, 7°/);
        expect(rapport.comptesCrees).toBe(1);
        expect(creerComptes).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ numero: '41100001' })] }));
    });
    it('refuse AUSSI la ligne dont le compte existe déjà · le cas muet', async () => {
        const { svc } = service(client_1.Referentiel.SYCEBNL);
        const rapport = await svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.PLAN_COMPTES,
            nomFichier: 'plan.csv',
            contenuBase64: csv('numero;intitule', [['10300000', 'Capital personnel']]),
            mapping: { numero: 'numero', intitule: 'intitule' },
        });
        expect(rapport.comptesReconnus).toBe(0);
        expect(rapport.anomalies).toHaveLength(1);
        expect(rapport.anomalies[0].message).toMatch(/Droit d’entrée|Droit d'entrée/);
    });
    it('joue dans l’autre sens · un fichier SYCEBNL dans un dossier SYSCOHADA', () => {
        const ecart = (0, import_service_1.intituleDUnAutreReferentiel)('13100000', 'Excédent de l’exercice', client_1.Referentiel.SYSCOHADA);
        expect(ecart?.autre).toBe(client_1.Referentiel.SYCEBNL);
        expect(ecart?.intituleDuDossier).toBe('Résultat net : bénéfice');
    });
});
describe('import d’une BALANCE venue de l’autre référentiel', () => {
    it('écarte les lignes transposées et laisse passer le reste du bilan', async () => {
        const { svc, creerEcriture } = service(client_1.Referentiel.SYCEBNL);
        const rapport = await svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.BALANCE,
            nomFichier: 'balance.csv',
            contenuBase64: csv('numero;intitule;debit;credit', [
                ['52110000', 'Banque', '800000', '0'],
                ['40110000', 'Fournisseurs', '0', '300000'],
                ['10110000', 'Dotation', '0', '500000'],
                ['10300000', 'Capital personnel', '300000', '0'],
                ['13100000', 'Résultat net : bénéfice', '0', '300000'],
            ]),
            mapping: { numero: 'numero', intitule: 'intitule', debit: 'debit', credit: 'credit' },
        });
        const refus = rapport.anomalies.map((a) => a.message).join(' | ');
        expect(rapport.anomalies).toHaveLength(2);
        expect(refus).toMatch(/10300000/);
        expect(refus).toMatch(/13100000/);
        expect(refus).toMatch(/SYCEBNL art\. 16, 1°/);
        const ecriture = creerEcriture.mock.calls[0]?.[0]?.data;
        expect(ecriture.lignes.createMany.data).toHaveLength(3);
        expect(rapport.ecrituresCreees).toBe(1);
    });
    it('une balance sans colonne Intitulé n’est pas gênée · il n’y a rien à confronter', async () => {
        const { svc, creerEcriture } = service(client_1.Referentiel.SYCEBNL);
        const rapport = await svc.executer('t', 'u', {
            type: import_dto_1.TypeImport.BALANCE,
            nomFichier: 'balance.csv',
            contenuBase64: csv('numero;debit;credit', [
                ['52110000', '800000', '0'],
                ['10110000', '0', '800000'],
            ]),
            mapping: { numero: 'numero', debit: 'debit', credit: 'credit' },
        });
        expect(rapport.anomalies).toEqual([]);
        expect(creerEcriture.mock.calls[0][0].data.lignes.createMany.data).toHaveLength(2);
    });
});
//# sourceMappingURL=referentiel-import.spec.js.map