"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const courrier_service_1 = require("../courrier/courrier.service");
const relances_service_1 = require("./relances.service");
const DOSSIER = 'd-1';
const AGENT = 'u-1';
const JOUR = 86_400_000;
const MODELE = 'Cher {tiers},\n\nSauf erreur de notre part, la somme de {montant} demeure due à ce jour, {date}.\n\n{detail}\n\n{entite}';
const NIVEAU = {
    id: 'n-2',
    tenantId: DOSSIER,
    niveau: 2,
    libelle: 'Premier rappel',
    type: client_1.TypeRelance.RAPPEL,
    joursApresEcheance: 15,
    modeleTexte: MODELE,
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
            tiersCompte: tiers ? { tiers: { ...tiers, type: 'CLIENT' } } : null,
        },
        ecriture: { date: new Date(Date.now() - 90 * JOUR), libelle: 'Vente' },
    };
}
const sansTransport = () => ({ id: 'm-1', statut: client_1.StatutMessage.SANS_TRANSPORT, motif: null });
function service(lignes, repondre = sansTransport) {
    const ecrites = [];
    const relanceCreate = jest.fn((ligne) => ecrites.push(ligne));
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }),
            findUnique: jest.fn().mockResolvedValue({ nom: 'ONG Kin' }),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        niveauRelance: {
            findFirst: jest.fn().mockResolvedValue(NIVEAU),
            findMany: jest.fn().mockResolvedValue([]),
        },
        relance: {
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn(async ({ data }) => {
                data.forEach((ligne) => relanceCreate(ligne));
                return { count: data.length };
            }),
        },
        tiers: { findMany: jest.fn().mockResolvedValue([]) },
        $executeRaw: jest.fn(async () => 0),
        $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    const ecrireEnFileSansTenter = jest.fn(async (_tx, _dossier, lot) => lot.map(repondre));
    const remis = () => ecrireEnFileSansTenter.mock.calls.flatMap(([, dossier, lot]) => lot.map((message) => ({ dossier, message })));
    const courrier = { ecrireEnFileSansTenter };
    return { svc: new relances_service_1.RelancesService(prisma, courrier), ecrireEnFileSansTenter, remis, relanceCreate, ecrites };
}
const emettre = (svc, compteIds) => svc.emettre(DOSSIER, AGENT, { exerciceId: 'ex-1', niveauId: NIVEAU.id, compteIds });
describe('la lettre composée est remise, telle quelle', () => {
    it('part à l’adresse du tiers, avec le TEXTE ENREGISTRÉ mot pour mot', async () => {
        const { svc, remis, ecrites } = service([
            ligne('41100001', { id: 't-1', nom: 'Coopérative Lemba', email: 'tresorier@lemba.cd' }),
        ]);
        const resultat = await emettre(svc, ['c-41100001']);
        expect(remis()).toHaveLength(1);
        expect(ecrites).toHaveLength(1);
        const [{ dossier, message }] = remis();
        expect(dossier).toBe(DOSSIER);
        expect(message).toMatchObject({
            destinataire: 'tresorier@lemba.cd',
            destinataireNom: 'Coopérative Lemba',
            origine: courrier_service_1.ORIGINE_RELANCE,
            origineId: ecrites[0].id,
            createdBy: AGENT,
        });
        expect(message.corps).toBe(resultat.lettres[0].texte);
        expect(message.corps).toContain('Cher Coopérative Lemba,');
        expect(message.corps).toContain('Facture 41100001');
    });
    it('donne un objet au courriel sans toucher au corps', async () => {
        const { svc, remis } = service([
            ligne('41100001', { id: 't-1', nom: 'Coopérative Lemba', email: 'tresorier@lemba.cd' }),
        ]);
        await emettre(svc, ['c-41100001']);
        expect(remis()[0].message.sujet).toBe('Premier rappel · ONG Kin');
        expect(remis()[0].message.corps.startsWith('Cher ')).toBe(true);
    });
    it('rend le statut de la file · SANS_TRANSPORT n’est ni un envoi ni une perte', async () => {
        const { svc } = service([ligne('41100001', { id: 't-1', nom: 'Lemba', email: 'a@lemba.cd' })]);
        const resultat = await emettre(svc, ['c-41100001']);
        expect(resultat.lettres[0].remise).toMatchObject({
            destinataire: 'a@lemba.cd',
            statut: client_1.StatutMessage.SANS_TRANSPORT,
            messageId: 'm-1',
            motif: null,
        });
        expect(resultat).toMatchObject({ emises: 1, misesEnFile: 1, nonRemises: 0 });
    });
});
describe('sans adresse · le dire à l’émission, pas au recouvrement', () => {
    it('n’écrit RIEN dans la file et nomme le tiers qu’il faut compléter', async () => {
        const { svc, remis, relanceCreate } = service([
            ligne('41100002', { id: 't-2', nom: 'Établissements Nzita', email: null }),
        ]);
        const resultat = await emettre(svc, ['c-41100002']);
        expect(remis()).toEqual([]);
        expect(relanceCreate).toHaveBeenCalledTimes(1);
        expect(resultat).toMatchObject({ emises: 1, misesEnFile: 0, nonRemises: 1 });
        expect(resultat.lettres[0].remise.statut).toBeNull();
        expect(resultat.lettres[0].remise.motif).toContain('Établissements Nzita');
        expect(resultat.lettres[0].remise.motif).toContain("n'est partie à personne");
    });
    it('dans un lot mêlé, chaque lettre garde SA remise · la lettre sans adresse ne décale pas les autres', async () => {
        const repondre = (message) => ({ id: `m-${message.destinataire}`, statut: client_1.StatutMessage.EN_ATTENTE, motif: null });
        const { svc } = service([
            ligne('41100001', { id: 't-1', nom: 'Lemba', email: 'a@lemba.cd' }),
            ligne('41100002', { id: 't-2', nom: 'Nzita', email: null }),
            ligne('41100003', { id: 't-3', nom: 'Kasa', email: 'c@kasa.cd' }),
        ], repondre);
        const resultat = await emettre(svc, ['c-41100001', 'c-41100002', 'c-41100003']);
        expect(resultat.lettres.map((l) => [l.compteId, l.remise.destinataire, l.remise.messageId])).toEqual([
            ['c-41100001', 'a@lemba.cd', 'm-a@lemba.cd'],
            ['c-41100002', null, null],
            ['c-41100003', 'c@kasa.cd', 'm-c@kasa.cd'],
        ]);
    });
    it('distingue le tiers sans adresse du compte sans tiers', async () => {
        const { svc } = service([ligne('41100003', null)]);
        const resultat = await emettre(svc, ['c-41100003']);
        expect(resultat.lettres[0].remise.motif).toContain('Aucun tiers');
        expect(resultat.lettres[0].remise.motif).toContain('41100003');
    });
    it('rend l’adresse AVEC la position · la lacune se voit avant le clic', async () => {
        const { svc } = service([
            ligne('41100001', { id: 't-1', nom: 'Lemba', email: 'a@lemba.cd' }),
            ligne('41100002', { id: 't-2', nom: 'Nzita', email: null }),
        ]);
        const positions = await svc.positions(DOSSIER, { exerciceId: 'ex-1' });
        expect(new Map(positions.map((p) => [p.numero, p.tiersEmail]))).toEqual(new Map([
            ['41100001', 'a@lemba.cd'],
            ['41100002', null],
        ]));
    });
});
describe('un destinataire perdu n’emporte pas le lot', () => {
    it('les autres relances partent, et le refus est rendu pour celle-là', async () => {
        const repondre = (message) => message.destinataire === 'deux, adresses@nzita.cd'
            ? { id: null, statut: null, motif: 'Adresse de destinataire inutilisable · « deux, adresses@nzita.cd ».' }
            : { id: 'm-1', statut: client_1.StatutMessage.SANS_TRANSPORT, motif: null };
        const { svc, relanceCreate } = service([
            ligne('41100002', { id: 't-2', nom: 'Nzita', email: 'deux, adresses@nzita.cd' }),
            ligne('41100001', { id: 't-1', nom: 'Lemba', email: 'a@lemba.cd' }),
        ], repondre);
        const resultat = await emettre(svc, ['c-41100002', 'c-41100001']);
        expect(relanceCreate).toHaveBeenCalledTimes(2);
        expect(resultat).toMatchObject({ emises: 2, misesEnFile: 1, nonRemises: 1 });
        expect(resultat.lettres[0].remise).toMatchObject({ destinataire: 'deux, adresses@nzita.cd', statut: null, messageId: null });
        expect(resultat.lettres[0].remise.motif).toContain('inutilisable');
        expect(resultat.lettres[1].remise.statut).toBe(client_1.StatutMessage.SANS_TRANSPORT);
    });
});
describe('l’objet du courriel', () => {
    it('reprend le libellé du niveau et le nom du dossier', () => {
        expect((0, relances_service_1.objetDeLaRelance)('Mise en demeure préalable', 'ONG Kin')).toBe('Mise en demeure préalable · ONG Kin');
    });
    it('ne laisse jamais un objet vide · la file refuserait la lettre', () => {
        expect((0, relances_service_1.objetDeLaRelance)('   ', 'ONG Kin')).toBe('Rappel · ONG Kin');
        expect((0, relances_service_1.objetDeLaRelance)('Premier rappel', '')).toBe('Premier rappel');
    });
});
//# sourceMappingURL=remise-des-lettres.spec.js.map