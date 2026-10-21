"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const impression_differee_service_1 = require("./impression-differee.service");
const impression_differee_1 = require("./impression-differee");
const DOSSIER = 'dossier-1';
const AUTRE = 'dossier-2';
const EXERCICE = 'exe-1';
function correspond(ligne, where) {
    if (!where)
        return true;
    return Object.entries(where).every(([cle, attendu]) => {
        const valeur = ligne[cle];
        if (attendu === undefined)
            return true;
        if (attendu === null)
            return valeur === null || valeur === undefined;
        if (typeof attendu === 'object' && !(attendu instanceof Date)) {
            const a = attendu;
            if ('in' in a)
                return (a.in ?? []).includes(valeur);
            if ('lt' in a && typeof a.lt === 'number')
                return typeof valeur === 'number' && valeur < a.lt;
            if ('lt' in a)
                return valeur instanceof Date && valeur.getTime() < a.lt.getTime();
            throw new Error(`Filtre non pris en charge par la doublure · ${cle}`);
        }
        return valeur === attendu;
    });
}
const choisir = (d, select) => select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, d[k] ?? null])) : { ...d };
function nouveauFaux(comportement = { contenu: 'CLASSEUR-COMPLET' }, options = {}) {
    const demandes = [];
    const impressionsJournal = [];
    let compteur = 0;
    const appels = [];
    const prisma = {
        exercice: {
            findFirst: async ({ where }) => where.id === EXERCICE && where.tenantId === DOSSIER
                ? { dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') }
                : null,
        },
        journal: {
            findFirst: async ({ where }) => (where.id === 'jnl-od' && where.tenantId === DOSSIER ? { code: 'OD' } : null),
        },
        user: { findMany: async () => [{ id: 'u1', email: 'comptable@cabinet.cd' }] },
        impressionDifferee: {
            aggregate: async ({ where }) => {
                const nums = demandes.filter((d) => correspond(d, where)).map((d) => d.numero);
                return { _max: { numero: nums.length ? Math.max(...nums) : null } };
            },
            create: async ({ data, select }) => {
                const d = {
                    id: `imp-${++compteur}`,
                    etat: client_1.EtatImpressionDifferee.EN_ATTENTE,
                    demandeLe: new Date(),
                    commenceLe: null,
                    produitLe: null,
                    motifEchec: null,
                    nomFichier: null,
                    taille: null,
                    empreinte: null,
                    contenu: null,
                    fichierRetireLe: null,
                    ...data,
                };
                demandes.push(d);
                return choisir(d, select);
            },
            count: async ({ where }) => demandes.filter((d) => correspond(d, where)).length,
            findFirst: async ({ where, select, orderBy }) => {
                const trouvees = demandes.filter((d) => correspond(d, where));
                if (orderBy)
                    trouvees.sort((a, b) => a.numero - b.numero);
                return trouvees[0] ? choisir(trouvees[0], select) : null;
            },
            findMany: async ({ where, select, take }) => demandes
                .filter((d) => correspond(d, where))
                .sort((a, b) => b.numero - a.numero)
                .slice(0, take)
                .map((d) => choisir(d, select)),
            update: async ({ where, data, select }) => {
                const d = demandes.find((x) => x.id === where.id);
                Object.assign(d, data);
                return choisir(d, select);
            },
        },
        impressionJournal: {
            aggregate: async () => ({ _max: { numero: impressionsJournal.length || null } }),
            create: async ({ data }) => {
                if (options.impressionJournalTombe)
                    throw new Error('verrou de la suite des impressions perdu');
                impressionsJournal.push(data);
                return data;
            },
        },
        $executeRaw: async () => 0,
        $queryRaw: async (_textes, id, tenantId) => {
            const d = demandes.find((x) => x.id === id && x.tenantId === tenantId);
            return d ? [{ etat: d.etat, commenceLe: d.commenceLe }] : [];
        },
    };
    prisma.$transaction = async (fn) => {
        const avant = demandes.map((d) => ({ ...d }));
        const impressionsAvant = impressionsJournal.length;
        try {
            return await fn(prisma);
        }
        catch (erreur) {
            demandes.splice(0, demandes.length, ...avant);
            impressionsJournal.length = impressionsAvant;
            throw erreur;
        }
    };
    const moteur = (nom) => async (...args) => {
        appels.push({ moteur: nom, args });
        const ouvrir = args.find((a) => typeof a === 'function');
        if ('refus' in comportement)
            throw new common_1.PayloadTooLargeException(comportement.refus);
        const sortie = ouvrir(`${nom}.xlsx`);
        if ('panneApres' in comportement) {
            sortie.write(Buffer.from(comportement.panneApres));
            throw new Error('connexion à la base perdue');
        }
        sortie.end(Buffer.from(comportement.contenu));
        return nom === 'journal' ? { lignes: 3, lecture: { instantLecture: INSTANT_LECTURE, nombreEcritures: 2 } } : { lignes: 3 };
    };
    const exportService = {
        journalExcelEnFlux: moteur('journal'),
        grandLivreCompletExcelEnFlux: moteur('grand-livre-plat'),
        impressionDuJournal: async (client, tenantId, filtres, imprimePar, lecture) => {
            expect(client).toBe(prisma);
            return {
                tenantId,
                exerciceId: filtres.exerciceId,
                journalId: filtres.journalId ?? null,
                imprimePar,
                nombreEcritures: lecture?.nombreEcritures ?? 3,
                imprimeAt: lecture?.instantLecture,
            };
        },
    };
    const exportFpm = { grandLivreEnFlux: moteur('grand-livre-fpm'), balanceGeneraleEnFlux: moteur('balance') };
    const service = new impression_differee_service_1.ImpressionDiffereeService(prisma, exportService, exportFpm);
    return { service, demandes, appels, impressionsJournal };
}
const INSTANT_LECTURE = new Date('2026-10-16T08:00:00Z');
describe('impression différée · demande, production, fichier', () => {
    it('la demande prend le numéro suivant du dossier, EN ATTENTE, son libellé figé · rien n’est produit', async () => {
        const f = nouveauFaux();
        const a = await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.GRAND_LIVRE, { exerciceId: EXERCICE });
        const b = await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.JOURNAL, {
            exerciceId: EXERCICE,
            journalId: 'jnl-od',
            dateDebut: '2026-03-01',
            dateFin: '2026-03-31',
            inclureBrouillard: false,
            champEtranger: 'jamais gardé',
        });
        expect([a.numero, a.etat, b.numero]).toEqual([1, client_1.EtatImpressionDifferee.EN_ATTENTE, 2]);
        expect(b.libelle).toBe('Journal · exercice du 01/01/2026 au 31/12/2026 · journal OD · du 01/03/2026 au 31/03/2026 · livre-journal seul');
        expect(f.demandes[1].criteres).toEqual({ exerciceId: EXERCICE, journalId: 'jnl-od', dateDebut: '2026-03-01', dateFin: '2026-03-31', inclureBrouillard: false });
        expect(f.appels).toEqual([]);
    });
    it('un exercice ou un journal d’un autre dossier, un critère illisible · refusés avant tout numéro', async () => {
        const f = nouveauFaux();
        await expect(f.service.demander(AUTRE, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE })).rejects.toThrow(/Exercice introuvable/);
        await expect(f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.JOURNAL, { exerciceId: EXERCICE, journalId: 'jnl-voisin' })).rejects.toThrow(/Journal introuvable/);
        await expect(f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.GRAND_LIVRE, { exerciceId: EXERCICE, format: 'pdf' })).rejects.toThrow(/Présentation du grand livre inconnue/);
        expect(f.demandes).toHaveLength(0);
    });
    it('traiter produit la plus ancienne demande par le moteur de son livre, et range le fichier entier avec son empreinte', async () => {
        const f = nouveauFaux({ contenu: 'BALANCE-ET-SES-FEUILLES' });
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE, grandsLivres: false });
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.GRAND_LIVRE, { exerciceId: EXERCICE, format: 'plat' });
        const r = await f.service.traiter(DOSSIER);
        expect(r.traitee).toMatchObject({ numero: 1, etat: client_1.EtatImpressionDifferee.PRETE, nomFichier: 'balance.xlsx', taille: 23 });
        expect(r.enAttente).toBe(1);
        expect([f.appels[0].moteur, ...f.appels[0].args.slice(0, 3)]).toEqual(['balance', DOSSIER, EXERCICE, false]);
        expect(r.traitee.empreinte).toBe((0, node_crypto_1.createHash)('sha256').update('BALANCE-ET-SES-FEUILLES').digest('hex'));
        const { contenu, nomFichier } = await f.service.fichier(DOSSIER, f.demandes[0].id);
        expect([nomFichier, contenu.toString()]).toEqual(['balance.xlsx', 'BALANCE-ET-SES-FEUILLES']);
        expect(contenu).toBe(f.demandes[0].contenu);
        const r2 = await f.service.traiter(DOSSIER);
        expect(r2.traitee).toMatchObject({ numero: 2, etat: client_1.EtatImpressionDifferee.PRETE });
        expect(f.appels[1].moteur).toBe('grand-livre-plat');
        expect((await f.service.traiter(DOSSIER)).traitee).toBeNull();
    });
    it('le journal produit s’enregistre comme imprimé au nom de qui l’a demandé, une fois son fichier RANGÉ (M4)', async () => {
        const f = nouveauFaux();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.JOURNAL, { exerciceId: EXERCICE });
        await f.service.traiter(DOSSIER);
        expect(f.appels[0].args[0]).toBe(DOSSIER);
        expect(f.appels[0].args[1]).toEqual({ exerciceId: EXERCICE, journalId: undefined, dateDebut: undefined, dateFin: undefined, inclureBrouillard: true });
        expect(f.appels[0].args).toHaveLength(3);
        expect(f.demandes[0].etat).toBe(client_1.EtatImpressionDifferee.PRETE);
        expect(f.impressionsJournal).toEqual([expect.objectContaining({ tenantId: DOSSIER, numero: 1, exerciceId: EXERCICE, imprimePar: 'u1' })]);
    });
    it('l’impression rangée est datée d’avant la lecture et compte ce que le fichier porte, jamais l’instant du rangement (relecture M2 de journal-sage)', async () => {
        const f = nouveauFaux();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.JOURNAL, { exerciceId: EXERCICE });
        await f.service.traiter(DOSSIER);
        expect(f.impressionsJournal).toEqual([expect.objectContaining({ imprimeAt: INSTANT_LECTURE, nombreEcritures: 2 })]);
    });
    it('une panne en production ne marque pas le journal imprimé (M4)', async () => {
        const f = nouveauFaux({ panneApres: 'DEBUT' });
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.JOURNAL, { exerciceId: EXERCICE });
        await f.service.traiter(DOSSIER);
        expect([f.demandes[0].etat, f.impressionsJournal]).toEqual([client_1.EtatImpressionDifferee.ECHOUEE, []]);
    });
    it('un rangement qui échoue rend la demande ÉCHOUÉE, motif nommé, sans fichier ni journal imprimé (M4, m4)', async () => {
        const f = nouveauFaux({ contenu: 'JOURNAL' }, { impressionJournalTombe: true });
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.JOURNAL, { exerciceId: EXERCICE });
        const r = await f.service.traiter(DOSSIER);
        expect(r.traitee).toMatchObject({ etat: client_1.EtatImpressionDifferee.ECHOUEE, motifEchec: impression_differee_1.MOTIF_NON_RANGEE });
        expect([f.demandes[0].contenu, f.demandes[0].nomFichier, f.impressionsJournal]).toEqual([null, null, []]);
    });
    it('des critères gardés qui ne se relisent plus rendent la demande ÉCHOUÉE, motif dit, sans appeler le moteur (mineur 7)', async () => {
        const f = nouveauFaux();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.GRAND_LIVRE, { exerciceId: EXERCICE, format: 'plat' });
        f.demandes[0].criteres = { exerciceId: EXERCICE, format: 'paysage' };
        const r = await f.service.traiter(DOSSIER);
        expect(r.traitee).toMatchObject({ etat: client_1.EtatImpressionDifferee.ECHOUEE, motifEchec: expect.stringMatching(/^Critères de la demande illisibles · Présentation du grand livre inconnue/) });
        expect(f.appels).toHaveLength(0);
    });
    it('le motif d’interruption n’affirme aucun redémarrage (M5)', () => {
        expect(impression_differee_1.MOTIF_INTERROMPUE).toMatch(/non terminée dans le délai de requête du serveur/);
        expect(impression_differee_1.MOTIF_INTERROMPUE).not.toMatch(/redémarr|arrêté/);
    });
    it('un refus de volume avant le premier octet rend la demande ÉCHOUÉE, le motif du moteur gardé tel quel', async () => {
        const motif = "Le grand livre porterait 250 000 lignes · au-delà du plafond, il est refusé plutôt qu'amputé.";
        const f = nouveauFaux({ refus: motif });
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.GRAND_LIVRE, { exerciceId: EXERCICE });
        const r = await f.service.traiter(DOSSIER);
        expect(r.traitee).toMatchObject({ etat: client_1.EtatImpressionDifferee.ECHOUEE, motifEchec: motif, nomFichier: null });
        await expect(f.service.fichier(DOSSIER, f.demandes[0].id)).rejects.toThrow(/n'est pas prête/);
    });
    it('une panne en route ne range JAMAIS le fichier à moitié écrit', async () => {
        const f = nouveauFaux({ panneApres: 'DEBUT-DU-LIVRE' });
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.GRAND_LIVRE, { exerciceId: EXERCICE });
        const r = await f.service.traiter(DOSSIER);
        expect(r.traitee).toMatchObject({ etat: client_1.EtatImpressionDifferee.ECHOUEE });
        expect(r.traitee.motifEchec).toMatch(/erreur inattendue du serveur, consignée/);
        expect(r.traitee.motifEchec).not.toContain('connexion à la base');
        expect([f.demandes[0].contenu, f.demandes[0].taille, f.demandes[0].empreinte]).toEqual([null, null, null]);
    });
    it('une production à la fois par dossier · une demande en cours fait attendre les autres', async () => {
        const f = nouveauFaux();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE });
        f.demandes[0].etat = client_1.EtatImpressionDifferee.EN_COURS;
        f.demandes[0].commenceLe = new Date();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE });
        const r = await f.service.traiter(DOSSIER);
        expect([r.traitee, r.enAttente, f.appels.length]).toEqual([null, 1, 0]);
    });
    it('une production commencée au-delà du délai est dite interrompue à la lecture, déclarée ÉCHOUÉE par le traitement', async () => {
        const f = nouveauFaux();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE });
        f.demandes[0].etat = client_1.EtatImpressionDifferee.EN_COURS;
        f.demandes[0].commenceLe = new Date(Date.now() - impression_differee_1.DELAI_PRODUCTION_MS - 60_000);
        const lue = await f.service.lister(DOSSIER);
        expect([lue.impressions[0].interrompue, f.demandes[0].etat]).toEqual([true, client_1.EtatImpressionDifferee.EN_COURS]);
        await f.service.traiter(DOSSIER);
        expect([f.demandes[0].etat, f.demandes[0].motifEchec]).toEqual([client_1.EtatImpressionDifferee.ECHOUEE, impression_differee_1.MOTIF_INTERROMPUE]);
    });
    it('une production qui finit après son interruption déclarée ne range rien', async () => {
        const f = nouveauFaux();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE });
        const balance = f.service.exportFpm;
        const origine = balance.balanceGeneraleEnFlux;
        balance.balanceGeneraleEnFlux = async (...a) => {
            const r = await origine(...a);
            Object.assign(f.demandes[0], { etat: client_1.EtatImpressionDifferee.ECHOUEE, motifEchec: impression_differee_1.MOTIF_INTERROMPUE });
            return r;
        };
        const r = await f.service.traiter(DOSSIER);
        expect([r.traitee?.etat, f.demandes[0].contenu]).toEqual([client_1.EtatImpressionDifferee.ECHOUEE, null]);
    });
    it('retirer le fichier garde la demande, son numéro et son empreinte · le fichier ne se sert plus', async () => {
        const f = nouveauFaux();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE });
        await f.service.traiter(DOSSIER);
        const empreinte = f.demandes[0].empreinte;
        const r = await f.service.retirerFichier(DOSSIER, f.demandes[0].id);
        expect([r.numero, r.empreinte, r.fichierRetireLe instanceof Date, f.demandes[0].contenu]).toEqual([1, empreinte, true, null]);
        await expect(f.service.fichier(DOSSIER, f.demandes[0].id)).rejects.toThrow(/a été retiré/);
        await expect(f.service.retirerFichier(DOSSIER, f.demandes[0].id)).rejects.toThrow(/déjà retiré/);
        await expect(f.service.fichier(AUTRE, f.demandes[0].id)).rejects.toThrow(/introuvable/);
    });
    it('la liste dit l’auteur en courriel, jamais le fichier, et ce qui attend', async () => {
        const f = nouveauFaux();
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE });
        await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE });
        await f.service.traiter(DOSSIER);
        const l = await f.service.lister(DOSSIER);
        expect(l.impressions.map((i) => [i.numero, i.etat, i.demandePar])).toEqual([
            [2, client_1.EtatImpressionDifferee.EN_ATTENTE, 'comptable@cabinet.cd'],
            [1, client_1.EtatImpressionDifferee.PRETE, 'comptable@cabinet.cd'],
        ]);
        expect(l.impressions.every((i) => !('contenu' in i))).toBe(true);
        expect([l.total, l.tronque, l.enAttente, l.plusAnciensAvant]).toEqual([2, false, 1, null]);
    });
    it('la liste se poursuit par le numéro · une demande ancienne se retrouve toujours (m5)', async () => {
        const f = nouveauFaux();
        for (let i = 0; i < 52; i++)
            await f.service.demander(DOSSIER, 'u1', client_1.NatureImpressionDifferee.BALANCE, { exerciceId: EXERCICE });
        const premiere = await f.service.lister(DOSSIER);
        expect([premiere.impressions.length, premiere.impressions[0].numero, premiere.plusAnciensAvant, premiere.tronque]).toEqual([50, 52, 3, true]);
        const suite = await f.service.lister(DOSSIER, premiere.plusAnciensAvant);
        expect([suite.impressions.map((i) => i.numero), suite.plusAnciensAvant]).toEqual([[2, 1], null]);
    });
});
describe('impression différée · règles pures', () => {
    it('les critères se ramènent à leur forme, défauts compris', () => {
        expect((0, impression_differee_1.criteresOuMotif)(client_1.NatureImpressionDifferee.JOURNAL, { exerciceId: 'e' })).toEqual({
            criteres: { exerciceId: 'e', journalId: null, dateDebut: null, dateFin: null, inclureBrouillard: true },
        });
        expect((0, impression_differee_1.criteresOuMotif)(client_1.NatureImpressionDifferee.GRAND_LIVRE, { exerciceId: 'e' })).toEqual({ criteres: { exerciceId: 'e', format: 'fpm' } });
        expect((0, impression_differee_1.criteresOuMotif)(client_1.NatureImpressionDifferee.BALANCE, { exerciceId: 'e' })).toEqual({ criteres: { exerciceId: 'e', grandsLivres: true } });
        expect((0, impression_differee_1.criteresOuMotif)(client_1.NatureImpressionDifferee.BALANCE, {})).toEqual({ motif: "L'exercice de l'édition est exigé." });
        expect((0, impression_differee_1.criteresOuMotif)(client_1.NatureImpressionDifferee.JOURNAL, { exerciceId: 'e', dateDebut: '2026-02-30x' })).toEqual({
            motif: 'Date de début illisible · une date AAAA-MM-JJ est attendue.',
        });
        expect((0, impression_differee_1.criteresOuMotif)(client_1.NatureImpressionDifferee.JOURNAL, { exerciceId: 'e', dateDebut: '2026-05-01', dateFin: '2026-04-01' })).toEqual({
            motif: 'La date de début suit la date de fin.',
        });
    });
    it('le libellé dit le livre, l’exercice et la présentation', () => {
        const exe = { dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') };
        expect((0, impression_differee_1.libelleDemande)(client_1.NatureImpressionDifferee.GRAND_LIVRE, { exerciceId: 'e', format: 'fpm' }, exe, null)).toBe('Grand livre · exercice du 01/01/2026 au 31/12/2026 · présentation du cabinet');
        expect((0, impression_differee_1.libelleDemande)(client_1.NatureImpressionDifferee.BALANCE, { exerciceId: 'e', grandsLivres: false }, exe, null)).toBe('Balance · exercice du 01/01/2026 au 31/12/2026 · balance seule');
    });
    it('le motif d’un refus nommé passe tel quel, une panne sans son détail', () => {
        expect((0, impression_differee_1.motifEchecDe)(new common_1.PayloadTooLargeException('Refusé plutôt qu’amputé.'))).toBe('Refusé plutôt qu’amputé.');
        expect((0, impression_differee_1.motifEchecDe)(new Error('ECONNRESET 10.0.0.3'))).not.toContain('ECONNRESET');
    });
    it('interrompue · en cours au-delà du délai seulement', () => {
        const maintenant = new Date('2026-10-15T12:00:00Z');
        expect((0, impression_differee_1.estInterrompue)('EN_COURS', new Date(maintenant.getTime() - impression_differee_1.DELAI_PRODUCTION_MS - 1), maintenant)).toBe(true);
        expect((0, impression_differee_1.estInterrompue)('EN_COURS', new Date(maintenant.getTime() - 1000), maintenant)).toBe(false);
        expect((0, impression_differee_1.estInterrompue)('PRETE', new Date(0), maintenant)).toBe(false);
    });
});
//# sourceMappingURL=impression-differee.spec.js.map