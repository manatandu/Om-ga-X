"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const relances_dto_1 = require("./dto/relances.dto");
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
    modeleTexte: 'Cher {tiers}, {montant} au {date}.',
    estActif: true,
};
const AUTRE_NIVEAU = { ...NIVEAU, id: 'n-3', niveau: 3, libelle: 'Second rappel' };
function ligne(numero, email = `${numero}@client.cd`) {
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
            tiersCompte: { tiers: { id: `t-${numero}`, nom: `Client ${numero}`, type: 'CLIENT', email, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null } },
        },
        ecriture: { date: new Date(Date.now() - 90 * JOUR), libelle: 'Vente' },
    };
}
function service(lignes, options = {}) {
    const relances = [];
    const messages = [];
    const ordre = [];
    let verrou = Promise.resolve();
    const lireRelances = jest.fn(async (args) => {
        ordre.push('lecture');
        if (options.lectureLente)
            await new Promise((r) => setTimeout(r, 20));
        const w = args.where;
        return relances
            .filter((r) => !w.tenantId || r.tenantId === w.tenantId)
            .filter((r) => !w.niveauId || r.niveauId === w.niveauId)
            .filter((r) => !w.compteId || w.compteId.in.includes(r.compteId))
            .filter((r) => !w.dateRelance?.gte || r.dateRelance >= w.dateRelance.gte)
            .filter((r) => !w.dateRelance?.lt || r.dateRelance < w.dateRelance.lt)
            .map((r) => ({ ...r, niveauRelance: { niveau: r.niveauId === NIVEAU.id ? 2 : 3 } }));
    });
    const creer = jest.fn((ligne) => {
        relances.push(ligne);
    });
    const creerPlusieurs = jest.fn(async ({ data }) => {
        ordre.push('ecriture');
        data.forEach((ligne) => creer(ligne));
        return { count: data.length };
    });
    const lireMessages = jest.fn(async (args) => {
        const w = args.where;
        return messages
            .filter((m) => !w.tenantId || m.tenantId === w.tenantId)
            .filter((m) => !w.origine || m.origine === w.origine)
            .filter((m) => !w.origineId || w.origineId.in.includes(m.origineId))
            .filter((m) => !w.statut || w.statut.in.includes(m.statut))
            .map((m) => ({ origineId: m.origineId }));
    });
    const executeRaw = jest.fn();
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }),
            findUnique: jest.fn().mockResolvedValue({ nom: 'SARL Kin' }),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        niveauRelance: {
            findFirst: jest.fn(async (args) => [NIVEAU, AUTRE_NIVEAU].find((x) => x.id === args.where.id) ?? null),
            findMany: jest.fn().mockResolvedValue([NIVEAU, AUTRE_NIVEAU]),
        },
        relance: { findMany: lireRelances, createMany: creerPlusieurs },
        tiers: { findMany: jest.fn().mockResolvedValue([]) },
        message: { findMany: lireMessages },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn(async (fn) => {
            let liberer = () => undefined;
            let tenu = false;
            const tx = {
                ...prisma,
                estTransaction: true,
                $executeRaw: async (...args) => {
                    executeRaw(...args);
                    ordre.push('verrou');
                    const precedent = verrou;
                    verrou = new Promise((r) => (liberer = r));
                    tenu = true;
                    await precedent;
                    return 0;
                },
            };
            try {
                return await fn(tx);
            }
            finally {
                if (tenu)
                    liberer();
            }
        }),
    };
    const ecrireEnFileSansTenter = jest.fn(async (client, tenantId, lot) => {
        ordre.push(client.estTransaction ? 'message-dans-la-transaction' : 'message-hors-transaction');
        return lot.map((m) => {
            const id = `m-${messages.length + 1}`;
            messages.push({ id, tenantId, origine: m.origine, origineId: m.origineId, statut: client_1.StatutMessage.EN_ATTENTE });
            return { id, statut: client_1.StatutMessage.EN_ATTENTE, motif: null };
        });
    });
    const ecrits = () => ecrireEnFileSansTenter.mock.calls.flatMap(([, , lot]) => lot);
    const courrier = { ecrireEnFileSansTenter };
    return {
        svc: new relances_service_1.RelancesService(prisma, courrier),
        relances,
        messages,
        ecrireEnFileSansTenter,
        ecrits,
        creer,
        creerPlusieurs,
        executeRaw,
        ordre,
        lireRelances,
        prisma: prisma,
    };
}
const emettre = (svc, compteIds, sur = {}) => svc.emettre(DOSSIER, AGENT, { exerciceId: 'ex-1', niveauId: NIVEAU.id, compteIds, ...sur });
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
describe('F241 · la sélection est bornée, à la porte et dans le service', () => {
    it('le DTO refuse au-delà du plafond, en français, et admet le plafond lui-même', async () => {
        const trop = (0, class_transformer_1.plainToInstance)(relances_dto_1.EmettreRelancesDto, {
            exerciceId: uuid(0),
            niveauId: uuid(0),
            compteIds: Array.from({ length: relances_dto_1.PLAFOND_COMPTES_PAR_EMISSION + 1 }, (_, i) => uuid(i + 1)),
        });
        const erreurs = await (0, class_validator_1.validate)(trop);
        expect(erreurs.map((e) => Object.values(e.constraints ?? {})).flat()).toContain(`Au plus ${relances_dto_1.PLAFOND_COMPTES_PAR_EMISSION} comptes par émission · découpez la sélection.`);
        const juste = (0, class_transformer_1.plainToInstance)(relances_dto_1.EmettreRelancesDto, {
            exerciceId: uuid(0),
            niveauId: uuid(0),
            compteIds: Array.from({ length: relances_dto_1.PLAFOND_COMPTES_PAR_EMISSION }, (_, i) => uuid(i + 1)),
        });
        expect(await (0, class_validator_1.validate)(juste)).toEqual([]);
    });
    it('le DTO refuse un compte nommé deux fois', async () => {
        const double = (0, class_transformer_1.plainToInstance)(relances_dto_1.EmettreRelancesDto, { exerciceId: uuid(0), niveauId: uuid(0), compteIds: [uuid(1), uuid(1)] });
        const erreurs = await (0, class_validator_1.validate)(double);
        expect(erreurs.map((e) => Object.values(e.constraints ?? {})).flat()).toContain('Un même compte figure deux fois dans la sélection.');
    });
    it('le service revérifie le plafond avant toute lecture', async () => {
        const { svc, creer } = service([ligne('41100001')]);
        const ids = Array.from({ length: relances_dto_1.PLAFOND_COMPTES_PAR_EMISSION + 1 }, (_, i) => `c-${i}`);
        await expect(emettre(svc, ids)).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(creer).not.toHaveBeenCalled();
    });
    it('un compte nommé deux fois ne reçoit qu’une lettre, même sans passer par le DTO', async () => {
        const { svc, creer, ecrits } = service([ligne('41100001')]);
        const r = await emettre(svc, ['c-41100001', 'c-41100001']);
        expect(creer).toHaveBeenCalledTimes(1);
        expect(ecrits()).toHaveLength(1);
        expect(r.emises).toBe(1);
    });
});
describe('F241 · l’émission met en file, elle ne tente aucun envoi', () => {
    it('les lettres sont écrites pour la reprise, en UN lot, dans la transaction de l’émission', async () => {
        const { svc, ecrireEnFileSansTenter, ordre } = service([ligne('41100001'), ligne('41100002')]);
        const r = await emettre(svc, ['c-41100001', 'c-41100002']);
        expect(ecrireEnFileSansTenter).toHaveBeenCalledTimes(1);
        expect(ecrireEnFileSansTenter.mock.calls[0][1]).toBe(DOSSIER);
        expect(ordre.slice(ordre.indexOf('verrou'))).toEqual(['verrou', 'lecture', 'ecriture', 'message-dans-la-transaction']);
        expect(r.lettres.map((l) => l.remise.statut)).toEqual([client_1.StatutMessage.EN_ATTENTE, client_1.StatutMessage.EN_ATTENTE]);
        expect(r.lettres.map((l) => l.remise.messageId)).toEqual(['m-1', 'm-2']);
        expect(r.misesEnFile).toBe(2);
    });
    it('le lot s’écrit en UNE insertion, et chaque message renvoie à SA relance', async () => {
        const { svc, creerPlusieurs, relances, ecrits } = service([ligne('41100001'), ligne('41100002')]);
        await emettre(svc, ['c-41100001', 'c-41100002']);
        expect(creerPlusieurs).toHaveBeenCalledTimes(1);
        const origines = ecrits().map((m) => m.origineId);
        expect(origines).toEqual(relances.map((r) => r.id));
        expect(new Set(origines).size).toBe(2);
        expect(relances.map((r) => [r.compteId, r.tenantId, r.niveauId])).toEqual([
            ['c-41100001', DOSSIER, NIVEAU.id],
            ['c-41100002', DOSSIER, NIVEAU.id],
        ]);
    });
});
describe('F241 · une lettre identique ne part qu’une fois par jour', () => {
    it('le second clic n’écrit rien et le DIT, compte par compte', async () => {
        const { svc, creer, ecrits } = service([ligne('41100001'), ligne('41100002')]);
        const premier = await emettre(svc, ['c-41100001', 'c-41100002']);
        expect(premier.emises).toBe(2);
        expect(premier.dejaEmises).toEqual([]);
        const second = await emettre(svc, ['c-41100001', 'c-41100002']);
        expect(second.emises).toBe(0);
        expect(second.lettres).toEqual([]);
        expect(second.dejaEmises.map((d) => d.compteId)).toEqual(['c-41100001', 'c-41100002']);
        expect(second.dejaEmises[0].compte).toBe('41100001 · Client 41100001');
        expect(second.dejaEmises[0].motif).toContain('« Premier rappel » a déjà une lettre en file ou partie pour ce compte le');
        expect(creer).toHaveBeenCalledTimes(2);
        expect(ecrits()).toHaveLength(2);
    });
    it('une relance du jour SANS lettre ne bloque pas · le tiers dont on vient de compléter la fiche reçoit la sienne', async () => {
        const sansAdresse = service([ligne('41100001', null)]);
        const premier = await emettre(sansAdresse.svc, ['c-41100001']);
        expect(premier).toMatchObject({ emises: 1, misesEnFile: 0, nonRemises: 1 });
        expect(sansAdresse.ecrireEnFileSansTenter).not.toHaveBeenCalled();
        const complete = service([ligne('41100001')]);
        complete.relances.push(...sansAdresse.relances);
        const second = await emettre(complete.svc, ['c-41100001']);
        expect(second.dejaEmises).toEqual([]);
        expect(second).toMatchObject({ emises: 1, misesEnFile: 1 });
    });
    it('une lettre ABANDONNÉE ne bloque pas · elle n’est pas partie et ne partira plus', async () => {
        const { svc, messages } = service([ligne('41100001')]);
        await emettre(svc, ['c-41100001']);
        messages[0].statut = client_1.StatutMessage.ABANDONNE;
        expect((await emettre(svc, ['c-41100001'])).emises).toBe(1);
    });
    it('une lettre gardée faute de messagerie, ou en échec qui sera retenté, bloque · elle partira', async () => {
        for (const statut of [client_1.StatutMessage.SANS_TRANSPORT, client_1.StatutMessage.ECHEC, client_1.StatutMessage.ENVOYE]) {
            const { svc, messages } = service([ligne('41100001')]);
            await emettre(svc, ['c-41100001']);
            messages[0].statut = statut;
            expect([statut, (await emettre(svc, ['c-41100001'])).dejaEmises.length]).toEqual([statut, 1]);
        }
    });
    it('un compte nouveau dans la même sélection reçoit sa lettre, les autres non', async () => {
        const { svc } = service([ligne('41100001'), ligne('41100002')]);
        await emettre(svc, ['c-41100001']);
        const r = await emettre(svc, ['c-41100001', 'c-41100002']);
        expect(r.lettres.map((l) => l.compteId)).toEqual(['c-41100002']);
        expect(r.dejaEmises.map((d) => d.compteId)).toEqual(['c-41100001']);
    });
    it('un AUTRE niveau le même jour reste permis · c’est une autre lettre', async () => {
        const { svc, creer } = service([ligne('41100001')]);
        await emettre(svc, ['c-41100001']);
        const r = await emettre(svc, ['c-41100001'], { niveauId: AUTRE_NIVEAU.id });
        expect(r.emises).toBe(1);
        expect(creer).toHaveBeenCalledTimes(2);
    });
    it('le lendemain, la même relance s’écrit de nouveau', async () => {
        const { svc } = service([ligne('41100001')]);
        await emettre(svc, ['c-41100001'], { dateReference: '2026-10-05' });
        const lendemain = await emettre(svc, ['c-41100001'], { dateReference: '2026-10-06' });
        expect(lendemain.emises).toBe(1);
        const memeJour = await emettre(svc, ['c-41100001'], { dateReference: '2026-10-06T15:30:00Z' });
        expect(memeJour.emises).toBe(0);
    });
    it('le jour est celui de Kinshasa · 23 h 30 UTC appartient déjà au lendemain', async () => {
        const { svc } = service([ligne('41100001')]);
        await emettre(svc, ['c-41100001'], { dateReference: '2026-10-06T10:00:00Z' });
        const r = await emettre(svc, ['c-41100001'], { dateReference: '2026-10-06T23:30:00Z' });
        expect(r.emises).toBe(1);
    });
    it('le jour de Kinshasa commence à 23 h UTC la veille · une lettre de 23 h 30 UTC compte pour le lendemain', async () => {
        const { svc } = service([ligne('41100001')]);
        await emettre(svc, ['c-41100001'], { dateReference: '2026-10-06T23:30:00Z' });
        const r = await emettre(svc, ['c-41100001'], { dateReference: '2026-10-07T11:00:00Z' });
        expect(r.emises).toBe(0);
        expect(r.dejaEmises).toHaveLength(1);
    });
    it('une relance d’un jour POSTÉRIEUR ne bloque pas celle d’un jour antérieur', async () => {
        const { svc } = service([ligne('41100001')]);
        await emettre(svc, ['c-41100001'], { dateReference: '2026-10-07' });
        const r = await emettre(svc, ['c-41100001'], { dateReference: '2026-10-06' });
        expect(r.emises).toBe(1);
    });
    it('la relecture et l’écriture se font sous le verrou du dossier, verrou d’abord', async () => {
        const { svc, executeRaw, ordre } = service([ligne('41100001')]);
        await emettre(svc, ['c-41100001']);
        const gabarit = executeRaw.mock.calls[0][0];
        expect(gabarit.join('?')).toContain('pg_advisory_xact_lock(hashtext(');
        expect(executeRaw.mock.calls[0][1]).toBe(`relances:${DOSSIER}`);
        expect(ordre.slice(ordre.indexOf('verrou'))).toEqual(['verrou', 'lecture', 'ecriture', 'message-dans-la-transaction']);
    });
    it('deux requêtes qui se croisent n’écrivent qu’une lettre', async () => {
        const { svc, creer } = service([ligne('41100001')], { lectureLente: true });
        const [a, b] = await Promise.all([emettre(svc, ['c-41100001']), emettre(svc, ['c-41100001'])]);
        expect(creer).toHaveBeenCalledTimes(1);
        expect(a.emises + b.emises).toBe(1);
        expect(a.dejaEmises.length + b.dejaEmises.length).toBe(1);
    });
});
describe('AUDCG art. 59 · la correspondance d’une personne immatriculée porte son RCCM (passe O2)', () => {
    it('la signature {entite} porte la dénomination et, dessous, l’immatriculation', async () => {
        const { svc, ecrits, prisma } = service([ligne('41100001')]);
        prisma.tenant.findUnique.mockResolvedValue({
            nom: 'Ets Kin',
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: 'ENTREPRISE_INDIVIDUELLE',
            rccm: 'CD/KIN/RCCM/24-A-5',
        });
        prisma.niveauRelance.findFirst.mockResolvedValue({ ...NIVEAU, modeleTexte: 'Cher {tiers}.\n\n{entite}' });
        await emettre(svc, ['c-41100001']);
        expect(ecrits()[0].corps).toContain('Ets Kin\nRCCM CD/KIN/RCCM/24-A-5');
    });
});
//# sourceMappingURL=emission-bornee-f241.spec.js.map