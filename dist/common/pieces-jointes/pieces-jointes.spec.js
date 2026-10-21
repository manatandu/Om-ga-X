"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const constants_1 = require("@nestjs/common/constants");
const pieces_jointes_service_1 = require("./pieces-jointes.service");
const contexte_audit_1 = require("../audit/contexte-audit");
const refus_envoi_filter_1 = require("./refus-envoi.filter");
const pieces_jointes_1 = require("./pieces-jointes");
const table_des_pieces_1 = require("./table-des-pieces");
const extension_audit_1 = require("../audit/extension-audit");
const champs_audites_1 = require("../audit/champs-audites");
const modeles_cloisonnes_1 = require("../cloisonnement/modeles-cloisonnes");
const acces_roles_cantonnes_decorator_1 = require("../decorators/acces-roles-cantonnes.decorator");
const roles_decorator_1 = require("../decorators/roles.decorator");
const pieces_jointes_ecriture_1 = require("../../modules/comptabilite/pieces-jointes-ecriture");
const pieces_jointes_section_1 = require("../../modules/analytique/pieces-jointes-section");
const pieces_jointes_immobilisation_1 = require("../../modules/immobilisations/pieces-jointes-immobilisation");
const pieces_jointes_salarie_1 = require("../../modules/personnel/pieces-jointes-salarie");
const pieces_jointes_ecriture_controller_1 = require("../../modules/comptabilite/pieces-jointes-ecriture.controller");
const pieces_jointes_section_controller_1 = require("../../modules/analytique/pieces-jointes-section.controller");
const pieces_jointes_immobilisation_controller_1 = require("../../modules/immobilisations/pieces-jointes-immobilisation.controller");
const pieces_jointes_salarie_controller_1 = require("../../modules/personnel/pieces-jointes-salarie.controller");
const detenteurs_ecriture_1 = require("../../modules/comptabilite/detenteurs-ecriture");
const PDF = Buffer.from('%PDF-1.7\n%contenu');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');
function ecriture(partiel = {}) {
    return {
        statut: client_1.StatutEcriture.BROUILLARD,
        estANouveauProvisoire: false,
        numeroPiece: 12,
        date: new Date('2026-03-04T00:00:00Z'),
        libelle: 'Facture SNEL mars',
        journal: { code: 'ACH' },
        ...partiel,
    };
}
function tableFactice(lignes) {
    const appels = { findMany: [], findFirst: [], count: [], create: [], update: [], delete: [], deleteMany: [] };
    const cle = (a) => (l) => Object.entries(a.where ?? {}).every(([k, v]) => l[k] === v);
    return {
        appels,
        lignes,
        findMany: jest.fn(async (a) => (appels.findMany.push(a), lignes.filter(cle(a)))),
        findFirst: jest.fn(async (a) => (appels.findFirst.push(a), lignes.find(cle(a)) ?? null)),
        count: jest.fn(async (a) => (appels.count.push(a), lignes.filter(cle(a)).length)),
        create: jest.fn(async (a) => (appels.create.push(a), { id: 'nouvelle', ...a.data })),
        update: jest.fn(async (a) => (appels.update.push(a), { id: a.where.id })),
        delete: jest.fn(async (a) => (appels.delete.push(a), { id: a.where.id })),
        deleteMany: jest.fn(async (a) => (appels.deleteMany.push(a), { count: 0 })),
    };
}
function prismaFactice(opts = {}) {
    const ordre = [];
    const pieces = tableFactice(opts.pieces ?? []);
    const lirePiece = pieces.findFirst.getMockImplementation();
    pieces.findFirst.mockImplementation(async (a) => (ordre.push('piece'), lirePiece(a)));
    if (opts.conflit) {
        pieces.create.mockImplementation(async () => {
            throw new client_1.Prisma.PrismaClientKnownRequestError('x', { code: opts.conflit, clientVersion: 'x' });
        });
    }
    const client = {
        ecriture: {
            findFirst: jest.fn(async (a) => {
                ordre.push('lire');
                if (opts.ecritureExiste === false || a.where.tenantId !== 't')
                    return null;
                return {
                    ...ecriture({ statut: opts.statut ?? client_1.StatutEcriture.BROUILLARD, estANouveauProvisoire: !!opts.aNouveauProvisoire }),
                    journalId: opts.journalId ?? 'j-ach',
                };
            }),
        },
        $queryRaw: jest.fn(async () => {
            ordre.push('verrou');
            return [];
        }),
        pieceJointeEcriture: pieces,
        pieceJointeSection: tableFactice([]),
        pieceJointeImmobilisation: tableFactice([]),
        pieceJointeSalarie: tableFactice([]),
        evenementAudit: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})) },
    };
    client.$transaction = jest.fn(async (fn) => {
        ordre.push('transaction');
        return fn(client);
    });
    return { client, pieces, ordre };
}
describe('pièces jointes · la règle de l’écriture (AUDCIF art. 17, 22 et 24)', () => {
    it('une écriture validée ne laisse plus partir sa pièce, et le refus cite ses articles', () => {
        const motif = (0, pieces_jointes_ecriture_1.motifRefusRetraitEcriture)(ecriture({ statut: client_1.StatutEcriture.VALIDEE }));
        expect(motif).toContain('ACH n° 12');
        expect(motif).toContain('AUDCIF art. 22, 2° et 7° ; art. 24');
    });
    it('au brouillard et en situation, la pièce se retire · ni l’une ni l’autre n’est au livre-journal', () => {
        expect((0, pieces_jointes_ecriture_1.motifRefusRetraitEcriture)(ecriture({ statut: client_1.StatutEcriture.BROUILLARD }))).toBeNull();
        expect((0, pieces_jointes_ecriture_1.motifRefusRetraitEcriture)(ecriture({ statut: client_1.StatutEcriture.SITUATION }))).toBeNull();
    });
    it('toute écriture reçoit sa pièce, validée comprise · seul l’à-nouveau provisoire la refuse', () => {
        expect((0, pieces_jointes_ecriture_1.motifRefusDepotEcriture)(ecriture({ statut: client_1.StatutEcriture.VALIDEE }))).toBeNull();
        expect((0, pieces_jointes_ecriture_1.motifRefusDepotEcriture)(ecriture({ estANouveauProvisoire: true }))).toContain("l'écriture d'ouverture qui fait foi");
    });
    it('la description dit journal, numéro, date et libellé, bornée en points de code', () => {
        expect((0, pieces_jointes_ecriture_1.descriptionDeLEcriture)(ecriture())).toBe('ACH n° 12 du 04/03/2026 · Facture SNEL mars');
        expect((0, pieces_jointes_ecriture_1.descriptionDeLEcriture)(ecriture({ numeroPiece: null }))).toContain('sans numéro');
        const longue = (0, pieces_jointes_ecriture_1.descriptionDeLEcriture)(ecriture({ libelle: '😀'.repeat(400) }));
        expect(Array.from(longue)).toHaveLength(190);
        expect(() => encodeURIComponent(longue)).not.toThrow();
    });
});
describe('pièces jointes · le service commun', () => {
    it('une liste ne transporte jamais le contenu, reste au dossier, et dit ce que l’objet permet', async () => {
        const { client, pieces } = prismaFactice({ statut: client_1.StatutEcriture.VALIDEE });
        const r = await new pieces_jointes_service_1.PiecesJointesService(client).lister('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1');
        expect(pieces.appels.findMany[0].where).toEqual({ tenantId: 't', ecritureId: 'e-1' });
        expect(pieces.appels.findMany[0].select.contenu).toBeUndefined();
        expect(pieces.appels.findMany[0].take).toBeGreaterThan(0);
        expect(r).toMatchObject({ depot: { permis: true, motif: null }, retrait: { permis: false }, total: 0, tronque: false });
        expect(r.retrait.motif).toContain('validée');
        expect(client.ecriture.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e-1', tenantId: 't' } }));
    });
    it('un objet d’un autre dossier est introuvable', async () => {
        const { client } = prismaFactice({ ecritureExiste: false });
        await expect(new pieces_jointes_service_1.PiecesJointesService(client).lister('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'x')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
    it('le dépôt sur une écriture fige ce qu’elle justifie, avec le type lu, l’empreinte et l’auteur', async () => {
        const { client, pieces } = prismaFactice();
        await new pieces_jointes_service_1.PiecesJointesService(client).deposer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'facture.pdf', buffer: PDF }, ' mars ', 'a@b.cd');
        const { data, select } = pieces.appels.create[0];
        expect(data).toMatchObject({
            tenantId: 't',
            ecritureId: 'e-1',
            ecritureDecrite: 'ACH n° 12 du 04/03/2026 · Facture SNEL mars',
            nomFichier: 'facture.pdf',
            typeMime: 'application/pdf',
            empreinte: (0, pieces_jointes_1.empreinteDocument)(PDF),
            commentaire: 'mars',
            deposePar: 'a@b.cd',
        });
        expect(select.contenu).toBeUndefined();
    });
    it.each([
        ['ECRITURE', 'pieceJointeEcriture', { ecritureId: true, ecritureDecrite: true }],
        ['SECTION', 'pieceJointeSection', { sectionId: true }],
        ['IMMOBILISATION', 'pieceJointeImmobilisation', { immobilisationId: true }],
        ['SALARIE', 'pieceJointeSalarie', { salarieId: true }],
    ])('%s · le dépôt rend la colonne de son objet, que le journal d’audit garde (relecture sage-l6, M1)', async (objet, delegue, attendu) => {
        const appels = [];
        const client = { [delegue]: { create: async (a) => (appels.push(a), {}) } };
        await new pieces_jointes_service_1.PiecesJointesService(client).creer(objet, 'o-1', 'ACH n° 1', { tenantId: 't' });
        expect(appels[0].select).toMatchObject(attendu);
        expect(appels[0].select.contenu).toBeUndefined();
    });
    it('refuse sans rien écrire · à-nouveau provisoire, contenu qui contredit l’extension, envoi vide', async () => {
        const provisoire = prismaFactice({ aNouveauProvisoire: true });
        await expect(new pieces_jointes_service_1.PiecesJointesService(provisoire.client).deposer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'a.pdf', buffer: PDF }, null, 'x')).rejects.toBeInstanceOf(common_1.BadRequestException);
        const faux = prismaFactice();
        await expect(new pieces_jointes_service_1.PiecesJointesService(faux.client).deposer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'a.pdf', buffer: HTML }, null, 'x')).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(new pieces_jointes_service_1.PiecesJointesService(faux.client).deposer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1', undefined, null, 'x')).rejects.toThrow('Aucun fichier reçu.');
        expect(provisoire.pieces.appels.create).toHaveLength(0);
        expect(faux.pieces.appels.create).toHaveLength(0);
    });
    it('la même pièce deux fois au même objet est un conflit nommé, l’objet retiré pendant le dépôt aussi', async () => {
        for (const code of ['P2002', 'P2003']) {
            const { client } = prismaFactice({ conflit: code });
            await expect(new pieces_jointes_service_1.PiecesJointesService(client).deposer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'a.pdf', buffer: PDF }, null, 'x')).rejects.toBeInstanceOf(common_1.ConflictException);
        }
    });
    it('LE RETRAIT SE JUGE DANS SA TRANSACTION, APRÈS LE VERROU · validée, la pièce reste', async () => {
        const piece = { id: 'p-1', tenantId: 't', ecritureId: 'e-1' };
        const validee = prismaFactice({ statut: client_1.StatutEcriture.VALIDEE, pieces: [piece] });
        await expect(new pieces_jointes_service_1.PiecesJointesService(validee.client).retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'p-1')).rejects.toBeInstanceOf(common_1.ConflictException);
        expect(validee.ordre).toEqual(['transaction', 'piece', 'verrou', 'piece', 'lire']);
        expect(validee.pieces.appels.delete).toHaveLength(0);
        const brouillard = prismaFactice({ statut: client_1.StatutEcriture.BROUILLARD, pieces: [piece] });
        await new pieces_jointes_service_1.PiecesJointesService(brouillard.client).retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'p-1');
        expect(brouillard.pieces.appels.delete).toEqual([{ where: { id: 'p-1' }, select: { id: true } }]);
        expect(brouillard.pieces.appels.deleteMany).toHaveLength(0);
    });
    it('une pièce détachée (écriture retirée au brouillard) se retire sans objet à consulter', async () => {
        const { client, pieces, ordre } = prismaFactice({ pieces: [{ id: 'p-2', tenantId: 't', ecritureId: null }] });
        await new pieces_jointes_service_1.PiecesJointesService(client).retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'p-2');
        expect(ordre).toEqual(['transaction', 'piece']);
        expect(pieces.appels.delete).toEqual([{ where: { id: 'p-2' }, select: { id: true } }]);
    });
    it('une pièce d’un autre dossier est introuvable au téléchargement, au commentaire et au retrait', async () => {
        const { client, pieces } = prismaFactice({ pieces: [{ id: 'p-3', tenantId: 'autre', ecritureId: 'e-1' }] });
        const s = new pieces_jointes_service_1.PiecesJointesService(client);
        await expect(s.telecharger('t', 'ECRITURE', 'p-3')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.modifierCommentaire('t', 'ECRITURE', 'p-3', 'x')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'p-3')).rejects.toBeInstanceOf(common_1.NotFoundException);
        expect(pieces.appels.findFirst.every((a) => a.where.tenantId === 't')).toBe(true);
        expect(pieces.appels.delete).toHaveLength(0);
    });
    it('le téléchargement est la seule lecture qui porte le contenu', async () => {
        const { client, pieces } = prismaFactice({ pieces: [{ id: 'p-4', tenantId: 't', ecritureId: 'e-1' }] });
        await new pieces_jointes_service_1.PiecesJointesService(client).telecharger('t', 'ECRITURE', 'p-4');
        expect(pieces.appels.findFirst[0]).toEqual({ where: { id: 'p-4', tenantId: 't' }, select: { nomFichier: true, typeMime: true, contenu: true } });
    });
    it('le commentaire se retouche, vidé il redevient null, trop long il est refusé', async () => {
        const { client, pieces } = prismaFactice({ pieces: [{ id: 'p-5', tenantId: 't', ecritureId: 'e-1' }] });
        const s = new pieces_jointes_service_1.PiecesJointesService(client);
        await s.modifierCommentaire('t', 'ECRITURE', 'p-5', '   ');
        expect(pieces.appels.update[0].data).toEqual({ commentaire: null });
        await expect(s.modifierCommentaire('t', 'ECRITURE', 'p-5', 'x'.repeat(70))).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('les pièces détachées et le décompte restent au dossier, bornés', async () => {
        const { client, pieces } = prismaFactice();
        const groupBy = jest.fn(async () => [{ ecritureId: 'e-1', _count: { _all: 2 } }]);
        client.pieceJointeEcriture.groupBy = groupBy;
        const s = new pieces_jointes_service_1.PiecesJointesService(client);
        await s.listerDetachees('t');
        expect(pieces.appels.findMany[0].where).toEqual({ tenantId: 't', ecritureId: null });
        expect(pieces.appels.findMany[0].select.contenu).toBeUndefined();
        expect(await s.decompteParEcriture('t', 'ex-1')).toEqual({ parEcriture: { 'e-1': 2 }, tronque: false });
        expect(groupBy.mock.calls[0][0].where).toEqual({ tenantId: 't', ecriture: { is: { tenantId: 't', exerciceId: 'ex-1' } } });
    });
});
describe('pièces jointes · quatre objets, quatre tables, une règle chacun chez lui', () => {
    const regles = [pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, pieces_jointes_section_1.REGLE_PIECES_SECTION, pieces_jointes_immobilisation_1.REGLE_PIECES_IMMOBILISATION, pieces_jointes_salarie_1.REGLE_PIECES_SALARIE];
    it('chaque règle vise sa table et cherche son objet DANS le dossier', async () => {
        for (const regle of regles) {
            const vu = [];
            const db = new Proxy({}, { get: (_c, nom) => ({ findFirst: async (a) => (vu.push([nom, a.where]), null) }) });
            expect(await regle.lireObjet(db, 't', 'o-1')).toBeNull();
            expect(vu[0][1]).toEqual({ id: 'o-1', tenantId: 't' });
            expect(table_des_pieces_1.TABLES_DES_PIECES[regle.objet]).toBeDefined();
        }
    });
    it('section, bien et salarié · le document se dépose et se retire à tout moment', async () => {
        const lignes = {
            sectionAnalytique: { code: 'P01', intitule: 'Santé', plan: { code: 'PROJ' } },
            immobilisation: { designation: 'Véhicule', numeroInventaire: 'V-001' },
            salarie: { matricule: 'M-1', nom: 'KABILA', postNom: null, prenoms: 'Jean' },
        };
        const db = new Proxy({}, { get: (_c, nom) => ({ findFirst: async () => lignes[nom] }) });
        expect(await pieces_jointes_section_1.REGLE_PIECES_SECTION.lireObjet(db, 't', 'x')).toEqual({ description: 'PROJ · P01 Santé', motifRefusDepot: null, motifRefusRetrait: null });
        expect(await pieces_jointes_immobilisation_1.REGLE_PIECES_IMMOBILISATION.lireObjet(db, 't', 'x')).toEqual({ description: 'V-001 · Véhicule', motifRefusDepot: null, motifRefusRetrait: null });
        expect(await pieces_jointes_salarie_1.REGLE_PIECES_SALARIE.lireObjet(db, 't', 'x')).toEqual({ description: 'M-1 · KABILA Jean', motifRefusDepot: null, motifRefusRetrait: null });
    });
    it('les quatre tables sont cloisonnées, auditées sans le binaire, et le salarié sans son nom de fichier ni son commentaire', () => {
        for (const modele of ['PieceJointeEcriture', 'PieceJointeSection', 'PieceJointeImmobilisation', 'PieceJointeSalarie']) {
            expect([modele, modeles_cloisonnes_1.MODELES_CLOISONNES.has(modele)]).toEqual([modele, true]);
            expect([modele, champs_audites_1.MODELES_AUDITES.has(modele)]).toEqual([modele, true]);
            expect(champs_audites_1.COLONNES_EXCLUES_PAR_MODELE[modele]).toContain('contenu');
            expect((0, extension_audit_1.selectPreImage)(modele).select?.contenu).toBeUndefined();
        }
        expect(champs_audites_1.COLONNES_EXCLUES_PAR_MODELE.PieceJointeSalarie).toEqual(expect.arrayContaining(['nomFichier', 'commentaire']));
    });
    it('l’écriture laisse partir sa pièce, détachée · jamais un détenteur qui bloquerait la saisie', () => {
        expect(Object.keys(detenteurs_ecriture_1.ECRITURE_LAISSEE_PARTIR)).toContain('PieceJointeEcriture.ecritureId');
        expect(detenteurs_ecriture_1.COLONNES_QUI_RETIENNENT).not.toContain('PieceJointeEcriture.ecritureId');
    });
});
describe('pièces jointes · les routes', () => {
    const controleurs = [pieces_jointes_ecriture_controller_1.PiecesJointesEcritureController, pieces_jointes_section_controller_1.PiecesJointesSectionController, pieces_jointes_immobilisation_controller_1.PiecesJointesImmobilisationController, pieces_jointes_salarie_controller_1.PiecesJointesSalarieController];
    const metadonnee = (cle, cible) => Reflect.getMetadata(cle, cible);
    it('chaque dépôt passe par la même réception · 5 Mo en mémoire, refus en français', () => {
        for (const c of controleurs) {
            const deposer = c.prototype.deposer;
            expect([c.name, (metadonnee(constants_1.INTERCEPTORS_METADATA, deposer) ?? []).length]).toEqual([c.name, 1]);
            expect([c.name, metadonnee(constants_1.EXCEPTION_FILTERS_METADATA, deposer)]).toEqual([c.name, [refus_envoi_filter_1.RefusEnvoi]]);
        }
    });
    it('dépôt, commentaire et retrait portent un rôle · le salarié aux droits du registre', () => {
        for (const c of controleurs) {
            for (const m of ['deposer', 'commenter', 'retirer']) {
                expect([c.name, m, metadonnee(roles_decorator_1.ROLES_KEY, c.prototype[m])]).toEqual([
                    c.name,
                    m,
                    [client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE],
                ]);
            }
        }
        expect(metadonnee(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, pieces_jointes_salarie_controller_1.PiecesJointesSalarieController)).toEqual({ aideComptable: false, gestionnairePaie: true });
        for (const c of [pieces_jointes_ecriture_controller_1.PiecesJointesEcritureController, pieces_jointes_section_controller_1.PiecesJointesSectionController, pieces_jointes_immobilisation_controller_1.PiecesJointesImmobilisationController]) {
            expect([c.name, metadonnee(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, c)]).toEqual([c.name, undefined]);
        }
    });
    it('le téléchargement sert attachment, nosniff et aucun cache, jamais inline', () => {
        const entetes = (0, pieces_jointes_1.entetesTelechargement)({ nomFichier: 'Société.pdf', typeMime: 'application/pdf' });
        expect(entetes['X-Content-Type-Options']).toBe('nosniff');
        expect(entetes['Cache-Control']).toBe('private, no-store');
        expect(entetes['Content-Disposition']).toMatch(/^attachment; /);
        for (const fichier of [
            '../../modules/comptabilite/pieces-jointes-ecriture.controller.ts',
            '../../modules/analytique/pieces-jointes-section.controller.ts',
            '../../modules/immobilisations/pieces-jointes-immobilisation.controller.ts',
            '../../modules/personnel/pieces-jointes-salarie.controller.ts',
        ]) {
            const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, fichier), 'utf8');
            expect([fichier, /servirLaPiece\(res, await this\.pieces\.telecharger\(/.test(source)]).toEqual([fichier, true]);
        }
    });
});
function restreintA(journaux, geste) {
    return (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'caisse@asbl.cd', tenantId: 't', journauxAutorises: journaux }, geste);
}
describe('pièces jointes · joindre ou retirer la pièce d’une écriture est une SAISIE sur son journal (relecture sage-l6, mineur 6)', () => {
    it('hors du périmètre, dépôt et retrait refusés en 403 nommé · la liste ferme les deux gestes', async () => {
        const { client, pieces } = prismaFactice({ journalId: 'j-ach', pieces: [{ id: 'pj-1', tenantId: 't', ecritureId: 'e-1' }] });
        const service = new pieces_jointes_service_1.PiecesJointesService(client);
        const refus = restreintA(['j-caisse'], () => service.deposer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'f.pdf', buffer: PDF }, null, 'u'));
        await expect(refus).rejects.toBeInstanceOf(common_1.ForbiddenException);
        await expect(restreintA(['j-caisse'], () => service.deposer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'f.pdf', buffer: PDF }, null, 'u'))).rejects.toThrow(/au journal ACH, hors de votre périmètre de saisie/);
        await expect(restreintA(['j-caisse'], () => service.retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'pj-1'))).rejects.toBeInstanceOf(common_1.ForbiddenException);
        expect(pieces.create).not.toHaveBeenCalled();
        expect(pieces.delete).not.toHaveBeenCalled();
        const liste = await restreintA(['j-caisse'], () => service.lister('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1'));
        expect(liste.depot.permis).toBe(false);
        expect(liste.retrait.permis).toBe(false);
        expect(liste.depot.motif).toMatch(/hors de votre périmètre/);
    });
    it('la consultation et le téléchargement restent ouverts', async () => {
        const { client } = prismaFactice({ journalId: 'j-ach', pieces: [{ id: 'pj-1', tenantId: 't', ecritureId: 'e-1', nomFichier: 'f.pdf', typeMime: 'application/pdf', contenu: PDF }] });
        const service = new pieces_jointes_service_1.PiecesJointesService(client);
        await expect(restreintA(['j-caisse'], () => service.telecharger('t', 'ECRITURE', 'pj-1'))).resolves.toMatchObject({ nomFichier: 'f.pdf' });
    });
    it('dans le périmètre, ou sans restriction, rien ne change', async () => {
        const { client, pieces } = prismaFactice({ journalId: 'j-ach', pieces: [{ id: 'pj-1', tenantId: 't', ecritureId: 'e-1' }] });
        const service = new pieces_jointes_service_1.PiecesJointesService(client);
        await restreintA(['j-ach'], () => service.deposer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'e-1', { originalname: 'f.pdf', buffer: PDF }, null, 'u'));
        await restreintA(null, () => service.retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'pj-1'));
        expect(pieces.create).toHaveBeenCalledTimes(1);
        expect(pieces.delete).toHaveBeenCalledWith({ where: { id: 'pj-1' }, select: { id: true } });
    });
    it('une pièce DÉTACHÉE n’a plus de journal · seul un utilisateur sans restriction la retire', async () => {
        const { client, pieces } = prismaFactice({ pieces: [{ id: 'pj-d', tenantId: 't', ecritureId: null }] });
        const service = new pieces_jointes_service_1.PiecesJointesService(client);
        await expect(restreintA(['j-caisse'], () => service.retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'pj-d'))).rejects.toThrow(/écriture retirée depuis \(pièce détachée\), hors de votre périmètre/);
        await restreintA(null, () => service.retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'pj-d'));
        expect(pieces.delete).toHaveBeenCalledWith({ where: { id: 'pj-d' }, select: { id: true } });
    });
});
describe('pièces jointes · le retrait relit la pièce après le verrou (second tour, mineur 1)', () => {
    it('reportée sur l’écriture qui remplace entre la lecture et le verrou · 409 nommé, rien ne part', async () => {
        const { client, pieces } = prismaFactice({ pieces: [{ id: 'pj-1', tenantId: 't', ecritureId: 'e-1' }] });
        client.$queryRaw.mockImplementationOnce(async () => {
            pieces.lignes[0].ecritureId = 'e-neuve';
            return [];
        });
        await expect(new pieces_jointes_service_1.PiecesJointesService(client).retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'pj-1')).rejects.toThrow(/reportée ailleurs pendant le retrait/);
        expect(pieces.delete).not.toHaveBeenCalled();
    });
    it('détachée entre la lecture et le verrou · la règle de la pièce détachée s’applique', async () => {
        const monter = () => {
            const m = prismaFactice({ pieces: [{ id: 'pj-1', tenantId: 't', ecritureId: 'e-1' }] });
            m.client.$queryRaw.mockImplementationOnce(async () => {
                m.pieces.lignes[0].ecritureId = null;
                return [];
            });
            return m;
        };
        const restreint = monter();
        await expect(restreintA(['j-ach'], () => new pieces_jointes_service_1.PiecesJointesService(restreint.client).retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'pj-1'))).rejects.toThrow(/pièce détachée/);
        expect(restreint.pieces.delete).not.toHaveBeenCalled();
        const libre = monter();
        await new pieces_jointes_service_1.PiecesJointesService(libre.client).retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'pj-1');
        expect(libre.pieces.delete).toHaveBeenCalledTimes(1);
    });
});
describe('pièces jointes · un geste concurrent se dit, jamais une erreur technique (relecture sage-l6, mineur 4)', () => {
    const p2025 = () => new client_1.Prisma.PrismaClientKnownRequestError('Record to update not found.', { code: 'P2025', clientVersion: 'x' });
    it('le commentaire d’une pièce retirée entre la lecture et l’écriture · 409 nommé', async () => {
        const { client, pieces } = prismaFactice({ pieces: [{ id: 'pj-1', tenantId: 't', ecritureId: 'e-1' }] });
        pieces.update.mockRejectedValueOnce(p2025());
        await expect(new pieces_jointes_service_1.PiecesJointesService(client).modifierCommentaire('t', 'ECRITURE', 'pj-1', 'Facture')).rejects.toThrow(pieces_jointes_service_1.MOTIF_PIECE_RETIREE);
    });
    it('deux retraits simultanés · le second reçoit 409 nommé', async () => {
        const { client, pieces } = prismaFactice({ pieces: [{ id: 'pj-1', tenantId: 't', ecritureId: 'e-1' }] });
        pieces.delete.mockRejectedValueOnce(p2025());
        await expect(new pieces_jointes_service_1.PiecesJointesService(client).retirer('t', pieces_jointes_ecriture_1.REGLE_PIECES_ECRITURE, 'pj-1')).rejects.toBeInstanceOf(common_1.ConflictException);
    });
});
describe('pièces jointes · elles suivent leur écriture (relecture sage-l6, M1 et mineur 2)', () => {
    function tx(pieces, ecritures) {
        const table = tableFactice(pieces);
        table.findMany.mockImplementation(async (a) => pieces.filter((l) => l.tenantId === a.where.tenantId &&
            l.ecritureId === a.where.ecritureId &&
            (!a.where.NOT || l.ecritureDecrite !== a.where.NOT.ecritureDecrite)));
        table.update.mockImplementation(async (a) => {
            const l = pieces.find((x) => x.id === a.where.id);
            Object.assign(l, a.data);
            return l;
        });
        table.count.mockImplementation(async (a) => pieces.filter((l) => l.tenantId === a.where.tenantId && l.ecritureId === a.where.ecritureId).length);
        const ordre = [];
        for (const op of ['findMany', 'count', 'update']) {
            const avant = table[op].getMockImplementation();
            table[op].mockImplementation(async (a) => (ordre.push(`pieces.${op}`), avant(a)));
        }
        return {
            ordre,
            pieceJointeEcriture: table,
            ecriture: { findFirst: jest.fn(async (a) => (a.where.tenantId === 't' ? ecritures[a.where.id] ?? null : null)) },
            $queryRaw: jest.fn(async (_gabarit, ...valeurs) => (ordre.push(`verrou ${valeurs[0]}`), [])),
        };
    }
    const neuve = { ...ecriture({ numeroPiece: 1, date: new Date('2026-02-10T00:00:00Z'), libelle: 'Acquisition · Camion', journal: { code: 'OD' } }), journalId: 'j-od' };
    it('reportées de l’ancienne à la neuve, une à une, la description refaite', async () => {
        const pieces = [
            { id: 'pj-1', tenantId: 't', ecritureId: 'e-ancienne', nomFichier: 'a.pdf', ecritureDecrite: 'OD n° 4 du 01/01/2026 · Acquisition · Camion' },
            { id: 'pj-2', tenantId: 't', ecritureId: 'e-ancienne', nomFichier: 'b.pdf', ecritureDecrite: 'OD n° 4 du 01/01/2026 · Acquisition · Camion' },
            { id: 'pj-3', tenantId: 't', ecritureId: 'e-autre', nomFichier: 'c.pdf', ecritureDecrite: 'x' },
        ];
        const t = tx(pieces, { 'e-neuve': neuve });
        await expect((0, pieces_jointes_ecriture_1.reporterLesPieces)(t, 't', 'e-ancienne', 'e-neuve')).resolves.toBe(2);
        expect(pieces.map((p) => [p.id, p.ecritureId, p.ecritureDecrite])).toEqual([
            ['pj-1', 'e-neuve', 'OD n° 1 du 10/02/2026 · Acquisition · Camion'],
            ['pj-2', 'e-neuve', 'OD n° 1 du 10/02/2026 · Acquisition · Camion'],
            ['pj-3', 'e-autre', 'x'],
        ]);
        expect(t.pieceJointeEcriture.update).toHaveBeenCalledTimes(2);
        expect(t.pieceJointeEcriture.update.mock.calls[0][0].select).toEqual({ id: true, ecritureId: true, ecritureDecrite: true });
    });
    it('LE VERROU DE L’ANCIENNE ÉCRITURE AVANT TOUTE LECTURE DE SES PIÈCES (second tour, MAJEUR) · report et suppression', async () => {
        const pieces = [{ id: 'pj-1', tenantId: 't', ecritureId: 'e-ancienne', nomFichier: 'a.pdf', ecritureDecrite: 'x' }];
        const report = tx(pieces, { 'e-neuve': neuve });
        await (0, pieces_jointes_ecriture_1.reporterLesPieces)(report, 't', 'e-ancienne', 'e-neuve');
        expect(report.ordre[0]).toBe('verrou e-ancienne');
        expect(report.ordre.indexOf('verrou e-ancienne')).toBeLessThan(report.ordre.indexOf('pieces.findMany'));
        const suppression = tx([{ id: 'pj-2', tenantId: 't', ecritureId: 'e-neuve', ecritureDecrite: 'x' }], { 'e-neuve': neuve });
        await expect((0, pieces_jointes_ecriture_1.preparerLesPiecesADetacher)(suppression, 't', 'e-neuve')).resolves.toBe(1);
        expect(suppression.ordre[0]).toBe('verrou e-neuve');
        expect(suppression.ordre.indexOf('verrou e-neuve')).toBeLessThan(suppression.ordre.indexOf('pieces.count'));
    });
    it('la neuve porte déjà le même fichier · 409 qui le nomme, rien n’est modifié', async () => {
        const t = tx([{ id: 'pj-1', tenantId: 't', ecritureId: 'e-ancienne', nomFichier: 'facture.pdf' }], { 'e-neuve': neuve });
        t.pieceJointeEcriture.update.mockRejectedValueOnce(new client_1.Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'x' }));
        await expect((0, pieces_jointes_ecriture_1.reporterLesPieces)(t, 't', 'e-ancienne', 'e-neuve')).rejects.toThrow(/« facture\.pdf » est déjà jointe à l'écriture qui remplace/);
    });
    it('la neuve retirée entre-temps · 409, aucune pièce ne bouge', async () => {
        const t = tx([{ id: 'pj-1', tenantId: 't', ecritureId: 'e-ancienne', nomFichier: 'a.pdf' }], {});
        await expect((0, pieces_jointes_ecriture_1.reporterLesPieces)(t, 't', 'e-ancienne', 'e-neuve')).rejects.toBeInstanceOf(common_1.ConflictException);
        expect(t.pieceJointeEcriture.update).not.toHaveBeenCalled();
    });
    it('la description retouchée seulement où elle a changé ; sans pièce, l’écriture n’est pas relue', async () => {
        const pieces = [
            { id: 'pj-1', tenantId: 't', ecritureId: 'e-neuve', ecritureDecrite: 'OD n° 1 du 10/02/2026 · Acquisition · Camion' },
            { id: 'pj-2', tenantId: 't', ecritureId: 'e-neuve', ecritureDecrite: 'ancienne' },
        ];
        const t = tx(pieces, { 'e-neuve': neuve });
        await expect((0, pieces_jointes_ecriture_1.retoucherDescriptionDesPieces)(t, 't', 'e-neuve')).resolves.toBe(1);
        expect(t.pieceJointeEcriture.update).toHaveBeenCalledWith({
            where: { id: 'pj-2' },
            data: { ecritureDecrite: 'OD n° 1 du 10/02/2026 · Acquisition · Camion' },
            select: { id: true, ecritureId: true, ecritureDecrite: true },
        });
        const vide = tx([], { 'e-neuve': neuve });
        await expect((0, pieces_jointes_ecriture_1.retoucherDescriptionDesPieces)(vide, 't', 'e-neuve')).resolves.toBe(0);
        expect(vide.ecriture.findFirst).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=pieces-jointes.spec.js.map