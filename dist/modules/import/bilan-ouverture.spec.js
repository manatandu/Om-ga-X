"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const import_service_1 = require("./import.service");
const import_dto_1 = require("./dto/import.dto");
const COMPTES = [
    { id: 'c52', numero: '52110000', typeCompte: 'DETAIL' },
    { id: 'c40', numero: '40110000', typeCompte: 'DETAIL' },
    { id: 'c10', numero: '10110000', typeCompte: 'DETAIL' },
    { id: 'c62', numero: '62210000', typeCompte: 'DETAIL' },
    { id: 'c70', numero: '70100000', typeCompte: 'DETAIL' },
];
function service() {
    const creerEcriture = jest.fn().mockResolvedValue({ id: 'e1' });
    const tx = {
        compte: {
            createMany: jest.fn(),
            findMany: jest.fn().mockResolvedValue(COMPTES.map((c) => ({ id: c.id, numero: c.numero }))),
        },
        ecriture: { create: creerEcriture },
    };
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't', longueurCompte: 8, referentiel: 'SYCEBNL' }) },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                statut: 'OUVERT',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        journal: { findMany: jest.fn().mockResolvedValue([{ id: 'j-od', code: 'OD', type: 'GENERAL' }]) },
        compte: { findMany: jest.fn().mockResolvedValue(COMPTES) },
        $transaction: jest.fn().mockImplementation((f) => f(tx)),
    };
    const ecritureService = { controlesDEntree: jest.fn().mockResolvedValue({}) };
    return { svc: new import_service_1.ImportService(prisma, ecritureService), creerEcriture };
}
function fichier(lignes) {
    const texte = ['numero;intitule;debit;credit', ...lignes.map((l) => l.join(';'))].join('\n');
    return Buffer.from(texte, 'utf8').toString('base64');
}
const MAPPING = { numero: 'numero', intitule: 'intitule', debit: 'debit', credit: 'credit' };
const BILAN = [
    ['52110000', 'Banque', '800000', '0'],
    ['40110000', 'Fournisseurs', '0', '300000'],
    ['10110000', 'Dotation', '0', '500000'],
];
async function importer(lignes, bilanDOuverture) {
    const { svc, creerEcriture } = service();
    const rapport = await svc.executer('t', 'u', {
        type: import_dto_1.TypeImport.BALANCE,
        nomFichier: 'balance.csv',
        contenuBase64: fichier(lignes),
        mapping: MAPPING,
        ...(bilanDOuverture === undefined ? {} : { bilanDOuverture }),
    });
    return { rapport, ecriture: creerEcriture.mock.calls[0]?.[0]?.data };
}
describe('Import d’un bilan d’ouverture', () => {
    it('produit une écriture d’À-NOUVEAU, pas un mouvement de l’exercice', async () => {
        const { rapport, ecriture } = await importer(BILAN);
        expect(rapport.anomalies).toEqual([]);
        expect(rapport.ecrituresCreees).toBe(1);
        expect(ecriture.estGenereeParCloture).toBe(true);
        expect(ecriture.libelle).toMatch(/Bilan d’ouverture|Bilan d'ouverture/);
    });
    it('la date par défaut est l’ouverture de l’exercice', async () => {
        const { ecriture } = await importer(BILAN);
        expect(ecriture.date.toISOString().slice(0, 10)).toBe('2026-01-01');
    });
    it('refuse les comptes de gestion, soldés sur le résultat à la clôture précédente', async () => {
        const { rapport, ecriture } = await importer([
            ...BILAN,
            ['62210000', 'Loyers', '200000', '0'],
            ['70100000', 'Ventes', '0', '200000'],
        ]);
        const refuses = rapport.anomalies.map((a) => a.message).join(' | ');
        expect(refuses).toMatch(/62210000/);
        expect(refuses).toMatch(/70100000/);
        expect(refuses).toMatch(/compte de gestion/i);
        expect(ecriture.lignes.createMany.data).toHaveLength(3);
    });
    it('accepte les comptes de gestion pour une reprise EN COURS d’exercice', async () => {
        const { rapport, ecriture } = await importer([...BILAN, ['62210000', 'Loyers', '200000', '0'], ['70100000', 'Ventes', '0', '200000']], false);
        expect(rapport.anomalies).toEqual([]);
        expect(ecriture.lignes.createMany.data).toHaveLength(5);
        expect(ecriture.estGenereeParCloture).toBe(false);
        expect(ecriture.libelle).toMatch(/Reprise de balance/);
    });
    it('un bilan déséquilibré n’écrit rien, et dit de combien', async () => {
        const { rapport } = await importer([
            ['52110000', 'Banque', '800000', '0'],
            ['10110000', 'Dotation', '0', '500000'],
        ]);
        expect(rapport.ecrituresCreees).toBe(0);
        expect(rapport.anomalies.map((a) => a.message).join(' ')).toMatch(/déséquilibrée de 300000\.00/);
    });
});
//# sourceMappingURL=bilan-ouverture.spec.js.map