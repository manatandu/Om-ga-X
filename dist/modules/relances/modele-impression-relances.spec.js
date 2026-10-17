"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const relances_service_1 = require("./relances.service");
const DOSSIER = 'd-1';
const JOUR = 86_400_000;
const niveau = (type) => ({
    id: `n-${type}`,
    tenantId: DOSSIER,
    niveau: 2,
    libelle: type === client_1.TypeRelance.RELEVE ? 'Relevé' : 'Premier rappel',
    type,
    joursApresEcheance: type === client_1.TypeRelance.RAPPEL ? 15 : 0,
    modeleTexte: 'Cher {tiers}, {montant} reste dû.\n{entite}',
    estActif: true,
});
function ligne(numero, tiersId, nom) {
    return {
        debit: 150_000,
        credit: 0,
        lettre: null,
        libelle: `Facture ${numero}`,
        dateEcheance: new Date(Date.now() - 60 * JOUR),
        compte: {
            id: `c-${numero}`,
            numero,
            intitule: 'Client',
            tiersCompte: { tiers: { id: tiersId, nom, type: 'CLIENT', email: `${tiersId}@client.cd`, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null } },
        },
        ecriture: { date: new Date(Date.now() - 90 * JOUR), libelle: 'Vente' },
    };
}
const FICHES = [
    {
        id: 't-1',
        nom: 'Brasserie du Fleuve',
        code: 'CLI-001',
        qualite: null,
        contact: 'Mme Mbuyi',
        adresse: null,
        boitePostale: null,
        ville: 'Kinshasa',
        pays: null,
        modeleImpressionExtraitId: 'm-extrait',
        modeleImpressionReglementId: null,
        modeleImpressionRappelId: 'm-rappel',
    },
    {
        id: 't-2',
        nom: 'Hôtel Kivu',
        code: 'CLI-002',
        qualite: null,
        contact: null,
        adresse: null,
        boitePostale: null,
        ville: null,
        pays: null,
        modeleImpressionExtraitId: null,
        modeleImpressionReglementId: null,
        modeleImpressionRappelId: null,
    },
];
const MODELES = [
    { id: 'm-rappel', nature: 'RAPPEL', intitule: 'Contrat cadre', texte: 'À l’attention de {contact}\n\n{document}\n\nRéf. contrat 2026-07' },
    { id: 'm-extrait', nature: 'EXTRAIT', intitule: 'Relevé contrat', texte: 'Relevé pour {tiers} ({code})\n{document}\nFin du relevé' },
];
function service(n) {
    const lignes = [ligne('41100001', 't-1', 'Brasserie du Fleuve'), ligne('41100002', 't-2', 'Hôtel Kivu')];
    const ecrites = [];
    const lireTiers = jest.fn(async ({ where }) => where.tenantId === DOSSIER ? FICHES.filter((f) => where.id.in.includes(f.id)) : []);
    const lireModeles = jest.fn(async ({ where }) => where.tenantId === DOSSIER ? MODELES.filter((m) => m.nature === where.nature && where.id.in.includes(m.id)) : []);
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }),
            findUnique: jest.fn().mockResolvedValue({ nom: 'SARL Kin' }),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        niveauRelance: { findFirst: jest.fn().mockResolvedValue(n), findMany: jest.fn().mockResolvedValue([n]) },
        relance: {
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn(async ({ data }) => {
                ecrites.push(...data);
                return { count: data.length };
            }),
        },
        compte: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(async ({ where }) => ({ id: where.id })) },
        tiers: { findMany: lireTiers },
        modeleImpressionTiers: { findMany: lireModeles },
        $executeRaw: jest.fn(async () => 0),
        $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    const ecrireEnFileSansTenter = jest.fn(async (_tx, _d, lot) => lot.map(() => ({ id: 'm-1', statut: client_1.StatutMessage.SANS_TRANSPORT, motif: null })));
    const svc = new relances_service_1.RelancesService(prisma, { ecrireEnFileSansTenter });
    return { svc, ecrites, ecrireEnFileSansTenter, lireModeles };
}
describe('le rappel habillé du modèle du tiers', () => {
    it('la lettre du niveau est le document · le modèle du tiers l’entoure, et l’historique garde la lettre qui part', async () => {
        const n = niveau(client_1.TypeRelance.RAPPEL);
        const { svc, ecrites, ecrireEnFileSansTenter, lireModeles } = service(n);
        const r = await svc.emettre(DOSSIER, 'u-1', { exerciceId: 'ex-1', niveauId: n.id, compteIds: ['c-41100001', 'c-41100002'] });
        const habillee = r.lettres.find((l) => l.compteId === 'c-41100001');
        expect(habillee.modeleImpression).toBe('Contrat cadre');
        expect(habillee.texte.startsWith('À l’attention de Mme Mbuyi\n\nCher Brasserie du Fleuve,')).toBe(true);
        expect(habillee.texte.endsWith('SARL Kin\n\nRéf. contrat 2026-07')).toBe(true);
        const nue = r.lettres.find((l) => l.compteId === 'c-41100002');
        expect(nue.modeleImpression).toBeNull();
        expect(nue.texte.startsWith('Cher Hôtel Kivu,')).toBe(true);
        expect(ecrites.find((e) => e.compteId === 'c-41100001')?.texte).toBe(habillee.texte);
        const lot = ecrireEnFileSansTenter.mock.calls[0][2];
        expect(lot.map((m) => m.corps)).toContain(habillee.texte);
        expect(lireModeles.mock.calls.every(([a]) => a.where.nature === 'RAPPEL')).toBe(true);
    });
    it('le relevé prend le modèle d’EXTRAIT du tiers, jamais celui du rappel', async () => {
        const n = niveau(client_1.TypeRelance.RELEVE);
        const { svc } = service(n);
        const r = await svc.emettre(DOSSIER, 'u-1', { exerciceId: 'ex-1', niveauId: n.id, compteIds: ['c-41100001'] });
        expect(r.lettres[0].modeleImpression).toBe('Relevé contrat');
        expect(r.lettres[0].texte).toMatch(/^Relevé pour Brasserie du Fleuve \(CLI-001\)\nCher Brasserie du Fleuve,[\s\S]*\nFin du relevé$/);
    });
    it('le relevé de compte imprimé à l’écran reçoit le cadre de l’extrait, coupé autour du tableau', async () => {
        const { svc } = service(niveau(client_1.TypeRelance.RELEVE));
        const r = await svc.releve(DOSSIER, 'c-41100001', 'ex-1');
        expect(r.cadre).toEqual({ modele: 'Relevé contrat', avant: 'Relevé pour Brasserie du Fleuve (CLI-001)\n', apres: '\nFin du relevé' });
        const sans = await svc.releve(DOSSIER, 'c-41100002', 'ex-1');
        expect(sans.cadre).toBeNull();
    });
});
//# sourceMappingURL=modele-impression-relances.spec.js.map