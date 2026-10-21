"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const relances_service_1 = require("./relances.service");
const DOSSIER = 'd-1';
const AGENT = 'u-1';
const JOUR = 86_400_000;
const NIVEAU = {
    id: 'n-2',
    tenantId: DOSSIER,
    niveau: 2,
    libelle: 'Premier rappel',
    type: client_1.TypeRelance.RAPPEL,
    joursApresEcheance: 15,
    modeleTexte: 'Cher {tiers}, la somme de {montant} demeure due au {date}.\n{detail}\n{entite}',
    estActif: true,
};
function ligne(numero, tiers) {
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
            tiersCompte: {
                tiers: {
                    id: tiers.id,
                    nom: tiers.nom,
                    type: 'CLIENT',
                    email: 'client@example.cd',
                    horsRelance: tiers.horsRelance,
                    motifHorsRelance: tiers.motifHorsRelance ?? null,
                    horsRelanceDepuis: tiers.horsRelance ? new Date('2026-03-01') : null,
                },
            },
        },
        ecriture: { date: new Date(Date.now() - 90 * JOUR), libelle: 'Vente' },
    };
}
function service(lignes, tiersEnBase) {
    const relanceCreate = jest.fn();
    const tiersUpdate = jest.fn(async ({ data }) => data);
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }),
            findUnique: jest.fn().mockResolvedValue({ nom: 'ONG Kin' }),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        niveauRelance: {
            findFirst: jest.fn().mockResolvedValue(NIVEAU),
            findMany: jest.fn().mockResolvedValue([NIVEAU]),
        },
        relance: {
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn(async ({ data }) => {
                data.forEach((ligne) => relanceCreate(ligne));
                return { count: data.length };
            }),
        },
        tiers: {
            findFirst: jest.fn().mockResolvedValue(tiersEnBase === undefined ? { id: 'ti-1', tenantId: DOSSIER } : tiersEnBase),
            update: tiersUpdate,
            findMany: jest.fn().mockResolvedValue([]),
        },
        $executeRaw: jest.fn(async () => 0),
        $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    const courrier = {
        ecrireEnFileSansTenter: jest.fn(async (_tx, _dossier, lot) => lot.map(() => ({ id: 'm-1', statut: client_1.StatutMessage.SANS_TRANSPORT, motif: null }))),
    };
    return { svc: new relances_service_1.RelancesService(prisma, courrier), relanceCreate, tiersUpdate };
}
describe('Exclusion d’un tiers du circuit de relance', () => {
    it('LAISSE la position dans la liste, montant intact · l’exclusion ne solde rien', async () => {
        const { svc } = service([ligne('41100001', { id: 'ti-1', nom: 'SARL Amani', horsRelance: true, motifHorsRelance: 'Litige confié à Me Kabeya' })]);
        const positions = await svc.positions(DOSSIER, { exerciceId: 'ex-1' });
        expect(positions).toHaveLength(1);
        expect(positions[0].montantDu).toBe(150_000);
        expect(positions[0].horsRelance).toBe(true);
        expect(positions[0].motifHorsRelance).toBe('Litige confié à Me Kabeya');
        expect(positions[0].horsRelanceDepuis).toBe('2026-03-01');
    });
    it('ne suggère AUCUN niveau à un tiers exclu, alors que le seuil est franchi', async () => {
        const exclu = service([ligne('41100001', { id: 'ti-1', nom: 'SARL Amani', horsRelance: true, motifHorsRelance: 'Litige' })]);
        const ordinaire = service([ligne('41100002', { id: 'ti-2', nom: 'SARL Bomoko', horsRelance: false })]);
        expect((await ordinaire.svc.positions(DOSSIER, { exerciceId: 'ex-1' }))[0].niveauSuggere).toBe(2);
        expect((await exclu.svc.positions(DOSSIER, { exerciceId: 'ex-1' }))[0].niveauSuggere).toBeNull();
    });
    it('n’écrit AUCUNE lettre à un tiers exclu, même désigné expressément', async () => {
        const { svc, relanceCreate } = service([
            ligne('41100001', { id: 'ti-1', nom: 'SARL Amani', horsRelance: true, motifHorsRelance: 'Échéancier convenu au 30/06' }),
        ]);
        const r = await svc.emettre(DOSSIER, AGENT, { exerciceId: 'ex-1', niveauId: NIVEAU.id, compteIds: ['c-41100001'] });
        expect(relanceCreate).not.toHaveBeenCalled();
        expect(r.emises).toBe(0);
        expect(r.exclues).toEqual([
            { compteId: 'c-41100001', tiers: 'SARL Amani', motif: 'Échéancier convenu au 30/06' },
        ]);
    });
    it('le tiers exclu n’emporte pas le lot · les autres lettres partent', async () => {
        const { svc, relanceCreate } = service([
            ligne('41100001', { id: 'ti-1', nom: 'SARL Amani', horsRelance: true, motifHorsRelance: 'Litige' }),
            ligne('41100002', { id: 'ti-2', nom: 'SARL Bomoko', horsRelance: false }),
        ]);
        const r = await svc.emettre(DOSSIER, AGENT, {
            exerciceId: 'ex-1',
            niveauId: NIVEAU.id,
            compteIds: ['c-41100001', 'c-41100002'],
        });
        expect(r.emises).toBe(1);
        expect(r.exclues).toHaveLength(1);
        expect(relanceCreate).toHaveBeenCalledTimes(1);
        expect(r.lettres[0].tiers).toBe('SARL Bomoko');
    });
    it('refuse une exclusion sans motif · une case seule ne se relit pas', async () => {
        const { svc, tiersUpdate } = service([]);
        await expect(svc.definirHorsRelance(DOSSIER, 'ti-1', { horsRelance: true })).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(svc.definirHorsRelance(DOSSIER, 'ti-1', { horsRelance: true, motif: '   ' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(tiersUpdate).not.toHaveBeenCalled();
    });
    it('exclut avec son motif et sa date, et la date vient du SERVEUR', async () => {
        const { svc, tiersUpdate } = service([]);
        await svc.definirHorsRelance(DOSSIER, 'ti-1', { horsRelance: true, motif: '  Tiers en liquidation  ' });
        const data = tiersUpdate.mock.calls[0][0].data;
        expect(data.horsRelance).toBe(true);
        expect(data.motifHorsRelance).toBe('Tiers en liquidation');
        expect(data.horsRelanceDepuis).toBeInstanceOf(Date);
    });
    it('remettre dans le circuit EFFACE le motif et la date', async () => {
        const { svc, tiersUpdate } = service([]);
        await svc.definirHorsRelance(DOSSIER, 'ti-1', { horsRelance: false });
        expect(tiersUpdate.mock.calls[0][0].data).toEqual({
            horsRelance: false,
            motifHorsRelance: null,
            horsRelanceDepuis: null,
        });
    });
});
//# sourceMappingURL=hors-relance.spec.js.map