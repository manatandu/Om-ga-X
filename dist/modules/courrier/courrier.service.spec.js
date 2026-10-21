"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const extension_cloisonnement_1 = require("../../common/cloisonnement/extension-cloisonnement");
const courrier_service_1 = require("./courrier.service");
const report_tentatives_1 = require("./report-tentatives");
function correspond(ligne, filtre) {
    if (!filtre)
        return true;
    for (const [cle, attendu] of Object.entries(filtre)) {
        if (cle === 'OR') {
            if (!attendu.some((sous) => correspond(ligne, sous)))
                return false;
            continue;
        }
        const actuel = ligne[cle];
        if (attendu === null) {
            if (actuel !== null && actuel !== undefined)
                return false;
            continue;
        }
        if (attendu instanceof Date) {
            if (!(actuel instanceof Date) || actuel.getTime() !== attendu.getTime())
                return false;
            continue;
        }
        if (typeof attendu === 'object') {
            const operateur = attendu;
            if ('lte' in operateur) {
                if (!(actuel instanceof Date) || actuel.getTime() > operateur.lte.getTime())
                    return false;
                continue;
            }
            throw new Error(`opérateur non simulé · ${JSON.stringify(attendu)}`);
        }
        if (actuel !== attendu)
            return false;
    }
    return true;
}
function baseMemoire(initiales = []) {
    const table = initiales.map((l) => ({ ...l }));
    const filtres = [];
    let compteur = 0;
    let lectureRetardee = null;
    const trier = (lignes, orderBy) => {
        if (!orderBy?.createdAt)
            return lignes;
        const sens = orderBy.createdAt === 'asc' ? 1 : -1;
        return [...lignes].sort((a, b) => sens * (a.createdAt.getTime() - b.createdAt.getTime()));
    };
    const prisma = {
        message: {
            create: jest.fn(async ({ data }) => {
                compteur += 1;
                const ligne = {
                    id: `m-${compteur}`,
                    statut: client_1.StatutMessage.EN_ATTENTE,
                    tentatives: 0,
                    destinataireNom: null,
                    origineId: null,
                    createdBy: null,
                    dernierEssaiAt: null,
                    prochainEssaiAt: null,
                    erreur: null,
                    envoyeAt: null,
                    createdAt: new Date(),
                    ...data,
                };
                table.push(ligne);
                return { ...ligne };
            }),
            createMany: jest.fn(async ({ data }) => {
                for (const d of data) {
                    table.push({
                        statut: client_1.StatutMessage.EN_ATTENTE,
                        tentatives: 0,
                        destinataireNom: null,
                        origineId: null,
                        createdBy: null,
                        dernierEssaiAt: null,
                        prochainEssaiAt: null,
                        erreur: null,
                        envoyeAt: null,
                        createdAt: new Date(),
                        ...d,
                    });
                }
                return { count: data.length };
            }),
            updateMany: jest.fn(async ({ where, data }) => {
                filtres.push(where);
                const vises = table.filter((l) => correspond(l, where));
                for (const ligne of vises)
                    Object.assign(ligne, data);
                return { count: vises.length };
            }),
            findMany: jest.fn(async ({ where, orderBy, take, select }) => {
                filtres.push(where);
                if (lectureRetardee)
                    await lectureRetardee;
                const retenues = trier(table.filter((l) => correspond(l, where)), orderBy).slice(0, take ?? undefined);
                if (!select)
                    return retenues.map((l) => ({ ...l }));
                return retenues.map((l) => Object.fromEntries(Object.keys(select).map((champ) => [champ, l[champ]])));
            }),
            findFirst: jest.fn(async ({ where }) => {
                filtres.push(where);
                const trouvee = table.find((l) => correspond(l, where));
                return trouvee ? { ...trouvee } : null;
            }),
            count: jest.fn(async ({ where }) => {
                filtres.push(where);
                return table.filter((l) => correspond(l, where)).length;
            }),
            groupBy: jest.fn(async ({ where }) => {
                filtres.push(where);
                const parStatut = new Map();
                for (const ligne of table.filter((l) => correspond(l, where))) {
                    parStatut.set(ligne.statut, (parStatut.get(ligne.statut) ?? 0) + 1);
                }
                return [...parStatut].map(([statut, total]) => ({ statut, _count: { _all: total } }));
            }),
        },
    };
    return {
        prisma: prisma,
        table,
        filtres,
        retarderLecture: (promesse) => {
            lectureRetardee = promesse;
        },
    };
}
function transportFactice(options) {
    const envoyer = options.envoyer ?? jest.fn(async () => undefined);
    return {
        etat: jest.fn(() => ({
            configure: options.configure,
            manques: options.configure ? [] : [{ variable: 'SMTP_HOST', raison: 'variable absente' }],
            expediteur: options.configure ? 'omegax@vmg-consulting.cd' : null,
        })),
        envoyer,
    };
}
const DOSSIER = 'd-1';
const RELANCE = {
    destinataire: 'tresorier@ong-kin.cd',
    destinataireNom: 'Trésorier · ONG Kin',
    sujet: 'Rappel · cotisation 2026',
    corps: 'Madame, Monsieur,\n\nNos livres font apparaître…',
    origine: courrier_service_1.ORIGINE_RELANCE,
    origineId: 'relance-7',
    createdBy: 'u-1',
};
const ilYA = (minutes) => new Date(Date.now() - minutes * 60_000);
describe('sans transport · ni mentir, ni perdre, ni refuser', () => {
    it('ÉCRIT le message, le marque SANS_TRANSPORT, et ne lève pas', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        const resultat = await service.mettreEnFile(DOSSIER, RELANCE);
        expect(resultat.statut).toBe(client_1.StatutMessage.SANS_TRANSPORT);
        expect(memoire.table).toHaveLength(1);
        expect(memoire.table[0]).toMatchObject({
            tenantId: DOSSIER,
            statut: client_1.StatutMessage.SANS_TRANSPORT,
            corps: RELANCE.corps,
            origine: courrier_service_1.ORIGINE_RELANCE,
            origineId: 'relance-7',
            createdBy: 'u-1',
            envoyeAt: null,
        });
    });
    it('ne consomme AUCUNE tentative · elles n’ont jamais eu leur chance', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        await service.mettreEnFile(DOSSIER, RELANCE);
        expect(memoire.table[0].tentatives).toBe(0);
        expect(memoire.table[0].prochainEssaiAt).toBeNull();
        expect(memoire.table[0].erreur).toBeNull();
    });
    it('la reprise sans transport ne tente rien et le DIT', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        await service.mettreEnFile(DOSSIER, RELANCE);
        const bilan = await service.reprendre(DOSSIER);
        expect(bilan).toMatchObject({ transportConfigure: false, examines: 0, envoyes: 0, restants: 1 });
        expect(bilan.manques[0].variable).toBe('SMTP_HOST');
        expect(memoire.table[0].tentatives).toBe(0);
    });
    it('LE JOUR OÙ LES IDENTIFIANTS SONT POSÉS, le message repart tel quel', async () => {
        const memoire = baseMemoire();
        const sansTransport = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        await sansTransport.mettreEnFile(DOSSIER, RELANCE);
        const transport = transportFactice({ configure: true });
        const bilan = await new courrier_service_1.CourrierService(memoire.prisma, transport).reprendre(DOSSIER);
        expect(bilan).toMatchObject({ examines: 1, envoyes: 1, restants: 0 });
        expect(transport.envoyer).toHaveBeenCalledWith({
            destinataire: RELANCE.destinataire,
            destinataireNom: RELANCE.destinataireNom,
            sujet: RELANCE.sujet,
            corps: RELANCE.corps,
            pieceJointe: null,
        });
        expect(memoire.table[0]).toMatchObject({ statut: client_1.StatutMessage.ENVOYE, tentatives: 1 });
        expect(memoire.table[0].envoyeAt).toBeInstanceOf(Date);
    });
});
describe('ce qui est refusé À L’ÉCRITURE', () => {
    it('une adresse vide ou invalide ne rentre pas dans la file', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        await expect(service.mettreEnFile(DOSSIER, { ...RELANCE, destinataire: '  ' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(service.mettreEnFile(DOSSIER, { ...RELANCE, destinataire: 'tresorier-chez-ong' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(memoire.table).toHaveLength(0);
    });
    it('un message sans objet, sans corps ou sans origine est refusé', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        await expect(service.mettreEnFile(DOSSIER, { ...RELANCE, sujet: ' ' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(service.mettreEnFile(DOSSIER, { ...RELANCE, corps: '\n\n' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(service.mettreEnFile(DOSSIER, { ...RELANCE, origine: '' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(memoire.table).toHaveLength(0);
    });
});
describe('le corps n’est tronqué NULLE PART', () => {
    it('un rappel de 60 000 caractères est écrit, remis et relu entier', async () => {
        const memoire = baseMemoire();
        const transport = transportFactice({ configure: true });
        const service = new courrier_service_1.CourrierService(memoire.prisma, transport);
        const corps = `Relevé détaillé\n${'ligne de facture impayée · 1 250 000 CDF\n'.repeat(1_500)}`;
        expect(corps.length).toBeGreaterThan(60_000);
        const { id } = await service.mettreEnFile(DOSSIER, { ...RELANCE, corps });
        expect(memoire.table[0].corps).toBe(corps);
        expect(transport.envoyer.mock.calls[0][0].corps).toBe(corps);
        expect((await service.lire(DOSSIER, id)).corps).toBe(corps);
    });
    it('la liste OMET le corps au lieu de l’abréger, la fiche le rend entier', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        const { id } = await service.mettreEnFile(DOSSIER, RELANCE);
        const file = await service.lister(DOSSIER);
        expect(file.messages[0]).not.toHaveProperty('corps');
        expect(file.messages[0]).toMatchObject({ sujet: RELANCE.sujet, statut: client_1.StatutMessage.SANS_TRANSPORT });
        expect(file).toMatchObject({ total: 1, tronque: false });
        expect((await service.lire(DOSSIER, id)).corps).toBe(RELANCE.corps);
    });
});
describe('reprise sur échec', () => {
    const transportQuiEchoue = (message) => transportFactice({
        configure: true,
        envoyer: jest.fn(async () => {
            throw new Error(message);
        }),
    });
    it('le premier échec laisse un ECHEC daté à cinq minutes, avec son erreur', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportQuiEchoue('421 service indisponible'));
        const resultat = await service.mettreEnFile(DOSSIER, RELANCE);
        expect(resultat.statut).toBe(client_1.StatutMessage.ECHEC);
        expect(resultat.erreur).toContain('421 service indisponible');
        const ligne = memoire.table[0];
        expect(ligne.tentatives).toBe(1);
        expect(ligne.prochainEssaiAt.getTime() - ligne.dernierEssaiAt.getTime()).toBe(5 * 60_000);
    });
    it('un échec dont l’heure n’est pas venue n’est PAS repris', async () => {
        const memoire = baseMemoire([
            {
                id: 'm-attente',
                tenantId: DOSSIER,
                ...RELANCE,
                statut: client_1.StatutMessage.ECHEC,
                tentatives: 1,
                dernierEssaiAt: ilYA(1),
                prochainEssaiAt: new Date(Date.now() + 4 * 60_000),
                erreur: '421',
                envoyeAt: null,
                createdAt: ilYA(1),
            },
        ]);
        const transport = transportFactice({ configure: true });
        const bilan = await new courrier_service_1.CourrierService(memoire.prisma, transport).reprendre(DOSSIER);
        expect(bilan).toMatchObject({ examines: 0, envoyes: 0, restants: 0 });
        expect(transport.envoyer).not.toHaveBeenCalled();
    });
    it('au cinquième échec le message est ABANDONNÉ, GARDE son erreur, et sort de la file', async () => {
        const memoire = baseMemoire([
            {
                id: 'm-fin',
                tenantId: DOSSIER,
                ...RELANCE,
                statut: client_1.StatutMessage.ECHEC,
                tentatives: report_tentatives_1.PLAFOND_TENTATIVES - 1,
                dernierEssaiAt: ilYA(300),
                prochainEssaiAt: ilYA(60),
                erreur: 'échec précédent',
                envoyeAt: null,
                createdAt: ilYA(600),
            },
        ]);
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportQuiEchoue('550 boîte inconnue'));
        const bilan = await service.reprendre(DOSSIER);
        expect(bilan).toMatchObject({ examines: 1, abandonnes: 1, restants: 0 });
        const ligne = memoire.table[0];
        expect(ligne.statut).toBe(client_1.StatutMessage.ABANDONNE);
        expect(ligne.tentatives).toBe(report_tentatives_1.PLAFOND_TENTATIVES);
        expect(ligne.erreur).toContain('550 boîte inconnue');
        expect(ligne.prochainEssaiAt).toBeNull();
    });
    it('un ABANDONNE ne repart jamais, même relancé', async () => {
        const memoire = baseMemoire([
            {
                id: 'm-abandon',
                tenantId: DOSSIER,
                ...RELANCE,
                statut: client_1.StatutMessage.ABANDONNE,
                tentatives: report_tentatives_1.PLAFOND_TENTATIVES,
                dernierEssaiAt: ilYA(600),
                prochainEssaiAt: null,
                erreur: '550 boîte inconnue',
                envoyeAt: null,
                createdAt: ilYA(900),
            },
        ]);
        const transport = transportFactice({ configure: true });
        await new courrier_service_1.CourrierService(memoire.prisma, transport).reprendre(DOSSIER);
        expect(transport.envoyer).not.toHaveBeenCalled();
        expect(memoire.table[0].statut).toBe(client_1.StatutMessage.ABANDONNE);
    });
    it('un message ORPHELIN d’une instance morte est rattrapé, un envoi en cours ne l’est pas', async () => {
        const memoire = baseMemoire([
            {
                id: 'm-orphelin',
                tenantId: DOSSIER,
                ...RELANCE,
                statut: client_1.StatutMessage.EN_ATTENTE,
                tentatives: 0,
                dernierEssaiAt: null,
                prochainEssaiAt: null,
                erreur: null,
                envoyeAt: null,
                createdAt: ilYA(30),
            },
            {
                id: 'm-en-cours',
                tenantId: DOSSIER,
                ...RELANCE,
                statut: client_1.StatutMessage.EN_ATTENTE,
                tentatives: 0,
                dernierEssaiAt: null,
                prochainEssaiAt: null,
                erreur: null,
                envoyeAt: null,
                createdAt: new Date(Date.now() - 10_000),
            },
        ]);
        const transport = transportFactice({ configure: true });
        const bilan = await new courrier_service_1.CourrierService(memoire.prisma, transport).reprendre(DOSSIER);
        expect(bilan).toMatchObject({ examines: 1, envoyes: 1 });
        expect(memoire.table.find((l) => l.id === 'm-orphelin').statut).toBe(client_1.StatutMessage.ENVOYE);
        expect(memoire.table.find((l) => l.id === 'm-en-cours').statut).toBe(client_1.StatutMessage.EN_ATTENTE);
    });
    it('DEUX reprises qui se croisent n’envoient qu’une fois', async () => {
        const memoire = baseMemoire([
            {
                id: 'm-unique',
                tenantId: DOSSIER,
                ...RELANCE,
                statut: client_1.StatutMessage.SANS_TRANSPORT,
                tentatives: 0,
                dernierEssaiAt: null,
                prochainEssaiAt: null,
                erreur: null,
                envoyeAt: null,
                createdAt: ilYA(60),
            },
        ]);
        const transport = transportFactice({ configure: true });
        const service = new courrier_service_1.CourrierService(memoire.prisma, transport);
        let debloquer;
        memoire.retarderLecture(new Promise((resoudre) => (debloquer = resoudre)));
        const premier = service.reprendre(DOSSIER);
        const second = service.reprendre(DOSSIER);
        await new Promise((suite) => setImmediate(suite));
        memoire.retarderLecture(null);
        debloquer();
        const [a, b] = await Promise.all([premier, second]);
        expect(transport.envoyer).toHaveBeenCalledTimes(1);
        expect(a.examines + b.examines).toBe(1);
        expect(a.ignores + b.ignores).toBe(1);
        expect(memoire.table[0].statut).toBe(client_1.StatutMessage.ENVOYE);
    });
});
describe('ce que l’écran lit', () => {
    it('les cinq états sont rendus MÊME À ZÉRO, et aRelancer ne compte que l’actionnable', async () => {
        const memoire = baseMemoire([
            { id: 'a', tenantId: DOSSIER, ...RELANCE, statut: client_1.StatutMessage.ENVOYE, tentatives: 1, dernierEssaiAt: ilYA(60), prochainEssaiAt: null, erreur: null, envoyeAt: ilYA(60), createdAt: ilYA(60) },
            { id: 'b', tenantId: DOSSIER, ...RELANCE, statut: client_1.StatutMessage.SANS_TRANSPORT, tentatives: 0, dernierEssaiAt: null, prochainEssaiAt: null, erreur: null, envoyeAt: null, createdAt: ilYA(50) },
            { id: 'c', tenantId: DOSSIER, ...RELANCE, statut: client_1.StatutMessage.ECHEC, tentatives: 2, dernierEssaiAt: ilYA(40), prochainEssaiAt: ilYA(10), erreur: '421', envoyeAt: null, createdAt: ilYA(40) },
            { id: 'd', tenantId: DOSSIER, ...RELANCE, statut: client_1.StatutMessage.ECHEC, tentatives: 1, dernierEssaiAt: ilYA(1), prochainEssaiAt: new Date(Date.now() + 240_000), erreur: '421', envoyeAt: null, createdAt: ilYA(1) },
            { id: 'e', tenantId: 'AUTRE-DOSSIER', ...RELANCE, statut: client_1.StatutMessage.ECHEC, tentatives: 1, dernierEssaiAt: ilYA(1), prochainEssaiAt: ilYA(1), erreur: '421', envoyeAt: null, createdAt: ilYA(1) },
        ]);
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: true }));
        const compteurs = await service.compterParStatut(DOSSIER);
        expect(compteurs).toEqual({
            EN_ATTENTE: 0,
            SANS_TRANSPORT: 1,
            ENVOYE: 1,
            ECHEC: 2,
            ABANDONNE: 0,
            aRelancer: 2,
        });
    });
    it('la liste et les compteurs s’arrêtent au dossier', async () => {
        const memoire = baseMemoire([
            { id: 'ici', tenantId: DOSSIER, ...RELANCE, statut: client_1.StatutMessage.ENVOYE, tentatives: 1, dernierEssaiAt: null, prochainEssaiAt: null, erreur: null, envoyeAt: null, createdAt: ilYA(2) },
            { id: 'ailleurs', tenantId: 'AUTRE-DOSSIER', ...RELANCE, statut: client_1.StatutMessage.ENVOYE, tentatives: 1, dernierEssaiAt: null, prochainEssaiAt: null, erreur: null, envoyeAt: null, createdAt: ilYA(1) },
        ]);
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: true }));
        const file = await service.lister(DOSSIER);
        expect(file.messages.map((m) => m.id)).toEqual(['ici']);
        expect(file.total).toBe(1);
        await expect(service.lire(DOSSIER, 'ailleurs')).rejects.toThrow('introuvable');
    });
    it('le filtre par état ne desserre jamais la borne de dossier', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        await service.lister(DOSSIER, { statut: client_1.StatutMessage.ECHEC, limite: 10 });
        expect(memoire.filtres.every((filtre) => (0, extension_cloisonnement_1.filtreBorne)(filtre))).toBe(true);
    });
});
describe('cloisonnement · la borne est posée aux DEUX bouts', () => {
    it('AUCUNE requête du module ne part sans son tenantId', async () => {
        const memoire = baseMemoire();
        const transport = transportFactice({ configure: true });
        const service = new courrier_service_1.CourrierService(memoire.prisma, transport);
        const { id } = await service.mettreEnFile(DOSSIER, RELANCE);
        await service.lister(DOSSIER);
        await service.lire(DOSSIER, id);
        await service.compterParStatut(DOSSIER);
        await service.reprendre(DOSSIER);
        expect(memoire.filtres.length).toBeGreaterThan(5);
        expect(memoire.filtres.filter((filtre) => !(0, extension_cloisonnement_1.filtreBorne)(filtre))).toEqual([]);
    });
    it('la création porte le dossier dans ses données', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false }));
        await service.mettreEnFile(DOSSIER, RELANCE);
        expect(memoire.prisma.message.create.mock.calls[0][0].data.tenantId).toBe(DOSSIER);
    });
});
describe('pièce jointe · écrite avec le message, remise au transport', () => {
    it('le fichier est gardé en file et part à la tentative', async () => {
        const memoire = baseMemoire();
        const transport = transportFactice({ configure: true });
        const service = new courrier_service_1.CourrierService(memoire.prisma, transport);
        await service.mettreEnFile(DOSSIER, { ...RELANCE, pieceJointe: { nom: 'licence.omegax', texte: 'contenu signé' } });
        expect(memoire.table[0]).toMatchObject({ pieceJointeNom: 'licence.omegax', pieceJointeTexte: 'contenu signé' });
        expect(transport.envoyer).toHaveBeenCalledWith(expect.objectContaining({ pieceJointe: { nom: 'licence.omegax', texte: 'contenu signé' } }));
    });
    it('une pièce vide est refusée avant toute écriture', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: true }));
        await expect(service.mettreEnFile(DOSSIER, { ...RELANCE, pieceJointe: { nom: 'licence.omegax', texte: '  ' } })).rejects.toThrow(/Pièce jointe/);
        expect(memoire.table).toHaveLength(0);
    });
});
describe('un lot écrit pour la reprise · `ecrireEnFileSansTenter` (audit final F241)', () => {
    const tx = (m) => m.prisma;
    it('avec une messagerie, chaque message attend EN_ATTENTE sans aucune tentative, en UNE insertion', async () => {
        const memoire = baseMemoire();
        const transport = transportFactice({ configure: true });
        const service = new courrier_service_1.CourrierService(memoire.prisma, transport);
        const resultats = await service.ecrireEnFileSansTenter(tx(memoire), DOSSIER, [
            RELANCE,
            { ...RELANCE, destinataire: 'autre@lemba.cd' },
        ]);
        expect(resultats.map((r) => [r.statut, r.motif])).toEqual([
            [client_1.StatutMessage.EN_ATTENTE, null],
            [client_1.StatutMessage.EN_ATTENTE, null],
        ]);
        expect(resultats.map((r) => r.id)).toEqual(memoire.table.map((l) => l.id));
        expect(new Set(resultats.map((r) => r.id)).size).toBe(2);
        expect(memoire.prisma.message.createMany).toHaveBeenCalledTimes(1);
        expect(memoire.prisma.message.create).not.toHaveBeenCalled();
        expect(transport.envoyer).not.toHaveBeenCalled();
        expect(memoire.table[0]).toMatchObject({ tenantId: DOSSIER, statut: client_1.StatutMessage.EN_ATTENTE, tentatives: 0, dernierEssaiAt: null });
        expect(memoire.table[0].prochainEssaiAt).toBeInstanceOf(Date);
    });
    it('écrit par le client de la TRANSACTION reçue, jamais par le sien', async () => {
        const propre = baseMemoire();
        const transaction = baseMemoire();
        const service = new courrier_service_1.CourrierService(propre.prisma, transportFactice({ configure: true }));
        await service.ecrireEnFileSansTenter(tx(transaction), DOSSIER, [RELANCE]);
        expect(transaction.table).toHaveLength(1);
        expect(propre.table).toHaveLength(0);
    });
    it('la reprise le prend AU PASSAGE SUIVANT, sans attendre le délai des orphelins', async () => {
        const memoire = baseMemoire();
        const transport = transportFactice({ configure: true });
        const service = new courrier_service_1.CourrierService(memoire.prisma, transport);
        await service.ecrireEnFileSansTenter(tx(memoire), DOSSIER, [RELANCE]);
        expect((await service.compterParStatut(DOSSIER)).aRelancer).toBe(1);
        const bilan = await service.reprendre(DOSSIER);
        expect(bilan).toMatchObject({ examines: 1, envoyes: 1, restants: 0 });
        expect(transport.envoyer).toHaveBeenCalledTimes(1);
        expect(memoire.table[0]).toMatchObject({ statut: client_1.StatutMessage.ENVOYE, tentatives: 1, prochainEssaiAt: null });
    });
    it('un message différé déjà revendiqué par une reprise en cours n’est pas repris par une autre', async () => {
        const memoire = baseMemoire([
            {
                id: 'm-revendique',
                tenantId: DOSSIER,
                ...RELANCE,
                statut: client_1.StatutMessage.EN_ATTENTE,
                tentatives: 0,
                dernierEssaiAt: new Date(Date.now() - 5_000),
                prochainEssaiAt: ilYA(1),
                erreur: null,
                envoyeAt: null,
                createdAt: ilYA(1),
            },
        ]);
        const transport = transportFactice({ configure: true });
        const bilan = await new courrier_service_1.CourrierService(memoire.prisma, transport).reprendre(DOSSIER);
        expect(bilan).toMatchObject({ examines: 0, envoyes: 0 });
        expect(transport.envoyer).not.toHaveBeenCalled();
    });
    it('sans messagerie, il est écrit SANS_TRANSPORT, comme un envoi immédiat l’aurait marqué', async () => {
        const memoire = baseMemoire();
        const transport = transportFactice({ configure: false });
        const service = new courrier_service_1.CourrierService(memoire.prisma, transport);
        const [resultat] = await service.ecrireEnFileSansTenter(tx(memoire), DOSSIER, [RELANCE]);
        expect(resultat.statut).toBe(client_1.StatutMessage.SANS_TRANSPORT);
        expect(memoire.table[0].statut).toBe(client_1.StatutMessage.SANS_TRANSPORT);
        expect(transport.envoyer).not.toHaveBeenCalled();
    });
    it('un message refusé à l’écriture revient avec son motif, et n’emporte pas le lot', async () => {
        const memoire = baseMemoire();
        const service = new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: true }));
        const resultats = await service.ecrireEnFileSansTenter(tx(memoire), DOSSIER, [
            { ...RELANCE, destinataire: 'deux, adresses@nzita.cd' },
            RELANCE,
        ]);
        expect(resultats[0]).toMatchObject({ id: null, statut: null });
        expect(resultats[0].motif).toContain('inutilisable');
        expect(resultats[1]).toMatchObject({ statut: client_1.StatutMessage.EN_ATTENTE, motif: null });
        expect(memoire.table).toHaveLength(1);
        expect(memoire.table[0].destinataire).toBe(RELANCE.destinataire);
    });
    it('un message isolé part toujours dans la requête · avis, factures, licences', async () => {
        const memoire = baseMemoire();
        const transport = transportFactice({ configure: true });
        const service = new courrier_service_1.CourrierService(memoire.prisma, transport);
        const resultat = await service.mettreEnFile(DOSSIER, RELANCE);
        expect(resultat.statut).toBe(client_1.StatutMessage.ENVOYE);
        expect(transport.envoyer).toHaveBeenCalledTimes(1);
    });
});
describe('un secret ne s’écrit pas dans la file (2026-10-09)', () => {
    const SECRET = { ...RELANCE, sujet: 'Votre mot de passe provisoire', corps: 'Mot de passe · Xy7kPq2mZt9wRb4n' };
    const GARDE = 'Mot de passe · [remis au seul destinataire, non conservé]';
    it('le secret part par le transport, la file ne garde que le texte sans lui', async () => {
        const memoire = baseMemoire();
        const transport = transportFactice({ configure: true });
        const resultat = await new courrier_service_1.CourrierService(memoire.prisma, transport).envoyerUnSecret(DOSSIER, SECRET, GARDE);
        expect(resultat.statut).toBe(client_1.StatutMessage.ENVOYE);
        expect(transport.envoyer.mock.calls[0][0].corps).toBe(SECRET.corps);
        expect(memoire.table).toHaveLength(1);
        expect(memoire.table[0]).toMatchObject({ corps: GARDE, statut: client_1.StatutMessage.ENVOYE });
        expect(JSON.stringify(memoire.table)).not.toContain('Xy7kPq2mZt9wRb4n');
    });
    it('sans transport, refus et rien d’écrit · la reprise n’aurait que le texte gardé', async () => {
        const memoire = baseMemoire();
        await expect(new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: false })).envoyerUnSecret(DOSSIER, SECRET, GARDE)).rejects.toThrow(/Aucune messagerie/);
        expect(memoire.table).toHaveLength(0);
    });
    it('un envoi qui échoue refuse et n’écrit rien', async () => {
        const memoire = baseMemoire();
        const envoyer = jest.fn(async () => {
            throw new Error('connexion refusée');
        });
        await expect(new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: true, envoyer })).envoyerUnSecret(DOSSIER, SECRET, GARDE)).rejects.toThrow(/pas parti/);
        expect(memoire.table).toHaveLength(0);
    });
    it('un texte gardé qui reprend le message entier est refusé', async () => {
        const memoire = baseMemoire();
        await expect(new courrier_service_1.CourrierService(memoire.prisma, transportFactice({ configure: true })).envoyerUnSecret(DOSSIER, SECRET, `${SECRET.corps}\n`)).rejects.toThrow(/secret serait écrit/);
        expect(memoire.table).toHaveLength(0);
    });
});
//# sourceMappingURL=courrier.service.spec.js.map