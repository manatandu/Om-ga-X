"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const documents_tiers_1 = require("./documents-tiers");
const documents_tiers_service_1 = require("./documents-tiers.service");
const documents_tiers_controller_1 = require("./documents-tiers.controller");
const extension_audit_1 = require("../../common/audit/extension-audit");
const PDF = Buffer.from('%PDF-1.7\n%contenu');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');
describe('Documents attachés aux tiers · le type se lit dans les octets', () => {
    it('admet chaque format de la liste quand signature et extension concordent', () => {
        expect((0, documents_tiers_1.identifierType)(PDF, 'statuts.pdf')).toEqual({ typeMime: 'application/pdf' });
        expect((0, documents_tiers_1.identifierType)(PNG, 'scan.PNG')).toEqual({ typeMime: 'image/png' });
        expect((0, documents_tiers_1.identifierType)(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'photo.jpeg')).toEqual({ typeMime: 'image/jpeg' });
        expect((0, documents_tiers_1.identifierType)(ZIP, 'contrat.docx')).toEqual({
            typeMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        expect((0, documents_tiers_1.identifierType)(ZIP, 'grille.xlsx')).toEqual({
            typeMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        expect((0, documents_tiers_1.identifierType)(OLE, 'ancien.doc')).toEqual({ typeMime: 'application/msword' });
        expect((0, documents_tiers_1.identifierType)(OLE, 'ancien.xls')).toEqual({ typeMime: 'application/vnd.ms-excel' });
    });
    it('refuse une page HTML renommée en .pdf · le nom ne fait pas le format', () => {
        const r = (0, documents_tiers_1.identifierType)(HTML, 'contrat.pdf');
        expect('refus' in r && r.refus).toContain('ne correspond pas à son extension .pdf');
    });
    it('refuse un format hors liste et nomme les formats acceptés', () => {
        const r = (0, documents_tiers_1.identifierType)(HTML, 'page.html');
        expect('refus' in r && r.refus).toContain('« .html » n\'est pas admis');
        expect('refus' in r && r.refus).toContain('.pdf');
        const sans = (0, documents_tiers_1.identifierType)(PDF, 'sansextension');
        expect('refus' in sans && sans.refus).toContain('« .? »');
    });
    it('refuse un fichier plus court que la signature', () => {
        expect('refus' in (0, documents_tiers_1.identifierType)(Buffer.from([0x25, 0x50]), 'court.pdf')).toBe(true);
    });
});
describe('Documents attachés aux tiers · les refus avant toute écriture', () => {
    it('refuse le vide, le trop gros, le commentaire trop long et le nom illisible', () => {
        expect((0, documents_tiers_1.motifRefusDocument)({ nom: 'a.pdf', contenu: Buffer.alloc(0) })).toBe('Le fichier est vide.');
        const gros = Buffer.alloc(documents_tiers_1.TAILLE_MAX_DOCUMENT + 1, 0x25);
        expect((0, documents_tiers_1.motifRefusDocument)({ nom: 'a.pdf', contenu: gros })).toContain('dépasse 5 Mo');
        expect((0, documents_tiers_1.motifRefusDocument)({ nom: 'a.pdf', contenu: PDF, commentaire: 'x'.repeat(documents_tiers_1.LONGUEUR_MAX_COMMENTAIRE + 1) })).toContain('69 caractères');
        expect((0, documents_tiers_1.motifRefusDocument)({ nom: '<>|', contenu: PDF })).toContain('pas de nom lisible');
    });
    it('admet exactement 5 Mo et exactement 69 caractères, bornes comprises', () => {
        const juste = Buffer.alloc(documents_tiers_1.TAILLE_MAX_DOCUMENT, 0x20);
        PDF.copy(juste);
        expect((0, documents_tiers_1.motifRefusDocument)({ nom: 'a.pdf', contenu: juste, commentaire: 'x'.repeat(69) })).toBeNull();
    });
    it('les deux bornes sont celles décidées · 5 Mo, et les 69 caractères de Sage', () => {
        expect(documents_tiers_1.TAILLE_MAX_DOCUMENT).toBe(5 * 1024 * 1024);
        expect(documents_tiers_1.LONGUEUR_MAX_COMMENTAIRE).toBe(69);
    });
});
describe('Documents attachés aux tiers · le nom et le téléchargement', () => {
    it('ne garde que le dernier segment d’un chemin et retire les caractères interdits', () => {
        expect((0, documents_tiers_1.nettoyerNomFichier)('C:\\Users\\x\\Statuts "ASBL".pdf')).toBe('Statuts ASBL.pdf');
        expect((0, documents_tiers_1.nettoyerNomFichier)('/tmp/a/b/rccm.pdf')).toBe('rccm.pdf');
    });
    it('borne la longueur en gardant l’extension', () => {
        const nom = (0, documents_tiers_1.nettoyerNomFichier)('x'.repeat(300) + '.pdf');
        expect(nom).toHaveLength(150);
        expect(nom.endsWith('.pdf')).toBe(true);
    });
    it('sert toujours en pièce jointe, nom accentué en UTF-8 et repli ASCII', () => {
        const d = (0, documents_tiers_1.dispositionTelechargement)('Société Démo.pdf');
        expect(d.startsWith('attachment;')).toBe(true);
        expect(d).toContain('filename="Societe Demo.pdf"');
        expect(d).toContain("filename*=UTF-8''Soci%C3%A9t%C3%A9%20D%C3%A9mo.pdf");
    });
    it('l’empreinte est le SHA-256 du contenu', () => {
        expect((0, documents_tiers_1.empreinteDocument)(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
    it('le contrôleur sert nosniff et la disposition calculée · jamais inline', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'documents-tiers.controller.ts'), 'utf8');
        expect(source).toContain("'X-Content-Type-Options': 'nosniff'");
        expect(source).toContain("'Content-Disposition': dispositionTelechargement(document.nomFichier)");
        expect(source).toContain('limits: { fileSize: TAILLE_MAX_DOCUMENT');
    });
});
function prismaFactice(opts = {}) {
    const appels = { findMany: [], create: [], update: [], delete: [], findFirst: [] };
    const prisma = {
        tiers: {
            findFirst: jest.fn(async (a) => (opts.tiers === false ? null : { id: a.where.id, code: 'F1' })),
        },
        documentTiers: {
            findMany: jest.fn(async (a) => {
                appels.findMany.push(a);
                return [];
            }),
            findFirst: jest.fn(async (a) => {
                appels.findFirst.push(a);
                return opts.document === false ? null : { id: 'doc', nomFichier: 'a.pdf', typeMime: 'application/pdf', contenu: PDF };
            }),
            create: jest.fn(async (a) => {
                appels.create.push(a);
                if (opts.conflit)
                    throw new client_1.Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
                return { id: 'doc' };
            }),
            update: jest.fn(async (a) => {
                appels.update.push(a);
                return { id: 'doc' };
            }),
            delete: jest.fn(async (a) => {
                appels.delete.push(a);
                return { id: 'doc' };
            }),
        },
    };
    return { prisma, appels };
}
describe('Documents attachés aux tiers · le service', () => {
    it('une liste ne transporte jamais le contenu, et reste bornée au dossier', async () => {
        const { prisma, appels } = prismaFactice();
        await new documents_tiers_service_1.DocumentsTiersService(prisma).lister('t', 'tiers-1');
        expect(appels.findMany[0].where).toEqual({ tenantId: 't', tiersId: 'tiers-1' });
        expect(appels.findMany[0].select.contenu).toBeUndefined();
        expect(appels.findMany[0].select.nomFichier).toBe(true);
        expect(prisma.tiers.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tiers-1', tenantId: 't' } }));
    });
    it('refuse un tiers d’un autre dossier', async () => {
        const { prisma } = prismaFactice({ tiers: false });
        await expect(new documents_tiers_service_1.DocumentsTiersService(prisma).lister('t', 'x')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
    it('dépose avec le type lu, l’empreinte, l’auteur, et rend la ligne sans contenu', async () => {
        const { prisma, appels } = prismaFactice();
        const nomLatin1 = Buffer.from('Société.pdf', 'utf8').toString('latin1');
        await new documents_tiers_service_1.DocumentsTiersService(prisma).deposer('t', 'tiers-1', { originalname: nomLatin1, buffer: PDF }, '  RCCM 2024  ', 'chef@cabinet.cd');
        const { data, select } = appels.create[0];
        expect(data).toMatchObject({
            tenantId: 't',
            tiersId: 'tiers-1',
            nomFichier: 'Société.pdf',
            typeMime: 'application/pdf',
            taille: PDF.length,
            empreinte: (0, documents_tiers_1.empreinteDocument)(PDF),
            commentaire: 'RCCM 2024',
            deposePar: 'chef@cabinet.cd',
        });
        expect(select.contenu).toBeUndefined();
    });
    it('refuse sans rien écrire une pièce dont le contenu contredit l’extension', async () => {
        const { prisma, appels } = prismaFactice();
        await expect(new documents_tiers_service_1.DocumentsTiersService(prisma).deposer('t', 'tiers-1', { originalname: 'a.pdf', buffer: HTML }, undefined, 'x')).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(appels.create).toHaveLength(0);
    });
    it('refuse l’envoi sans fichier', async () => {
        const { prisma } = prismaFactice();
        await expect(new documents_tiers_service_1.DocumentsTiersService(prisma).deposer('t', 'tiers-1', undefined, undefined, 'x')).rejects.toThrow('Aucun fichier reçu.');
    });
    it('une même pièce attachée deux fois au même tiers est un conflit nommé', async () => {
        const { prisma } = prismaFactice({ conflit: true });
        await expect(new documents_tiers_service_1.DocumentsTiersService(prisma).deposer('t', 'tiers-1', { originalname: 'a.pdf', buffer: PDF }, undefined, 'x')).rejects.toBeInstanceOf(common_1.ConflictException);
    });
    it('le téléchargement et la suppression cherchent la pièce DANS le dossier', async () => {
        const { prisma, appels } = prismaFactice();
        const s = new documents_tiers_service_1.DocumentsTiersService(prisma);
        await s.telecharger('t', 'doc');
        expect(appels.findFirst[0].where).toEqual({ id: 'doc', tenantId: 't' });
        expect(appels.findFirst[0].select.contenu).toBe(true);
        await s.supprimer('t', 'doc');
        expect(appels.findFirst[1].where).toEqual({ id: 'doc', tenantId: 't' });
        expect(appels.delete).toHaveLength(1);
    });
    it('une pièce d’un autre dossier est introuvable, et rien n’est supprimé', async () => {
        const { prisma, appels } = prismaFactice({ document: false });
        const s = new documents_tiers_service_1.DocumentsTiersService(prisma);
        await expect(s.telecharger('t', 'doc')).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect(s.supprimer('t', 'doc')).rejects.toBeInstanceOf(common_1.NotFoundException);
        expect(appels.delete).toHaveLength(0);
    });
    it('le commentaire se modifie, vidé il redevient null, trop long il est refusé', async () => {
        const { prisma, appels } = prismaFactice();
        const s = new documents_tiers_service_1.DocumentsTiersService(prisma);
        await s.modifierCommentaire('t', 'doc', '   ');
        expect(appels.update[0].data).toEqual({ commentaire: null });
        expect(appels.update[0].select.contenu).toBeUndefined();
        await expect(s.modifierCommentaire('t', 'doc', 'x'.repeat(70))).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(appels.update).toHaveLength(1);
    });
});
describe('Documents attachés aux tiers · corrections de l’audit', () => {
    it('ne coupe jamais un emoji en deux · le nom tronqué reste encodable au téléchargement', () => {
        const nom = (0, documents_tiers_1.nettoyerNomFichier)('a'.repeat(145) + '😀' + 'b'.repeat(20) + '.pdf');
        expect(Array.from(nom)).toHaveLength(150);
        expect(nom.endsWith('.pdf')).toBe(true);
        expect(() => (0, documents_tiers_1.dispositionTelechargement)(nom)).not.toThrow();
    });
    it('relit en UTF-8 le nom que multer a lu en latin1, et seulement lui', () => {
        const mutile = Buffer.from('Société.pdf', 'utf8').toString('latin1');
        expect((0, documents_tiers_1.decoderNomMultipart)(mutile)).toBe('Société.pdf');
        expect((0, documents_tiers_1.decoderNomMultipart)('Société.pdf')).toBe('Société.pdf');
        expect((0, documents_tiers_1.decoderNomMultipart)('Café 😀.pdf')).toBe('Café 😀.pdf');
        expect((0, documents_tiers_1.decoderNomMultipart)('rccm.pdf')).toBe('rccm.pdf');
    });
    function repondre(e) {
        const envoye = {};
        const reponse = {
            status(c) {
                envoye.statut = c;
                return this;
            },
            json(b) {
                envoye.corps = b;
            },
        };
        new documents_tiers_controller_1.RefusEnvoi().catch(e, { switchToHttp: () => ({ getResponse: () => reponse }) });
        return envoye;
    }
    it('redit en français les refus de multer, et laisse passer les 400 du service', () => {
        expect(repondre(new common_1.PayloadTooLargeException('File too large'))).toEqual({
            statut: 413,
            corps: expect.objectContaining({ message: expect.stringContaining('dépasse 5 Mo') }),
        });
        expect(repondre(new common_1.BadRequestException('Too many files')).corps).toEqual({
            statusCode: 400,
            message: documents_tiers_controller_1.REFUS_MULTER['Too many files'],
        });
        expect(repondre(new common_1.BadRequestException('Multipart: Unexpected end of form')).corps.message).toContain('mal formé');
        const propre = repondre(new common_1.BadRequestException('Le fichier est vide.'));
        expect(propre.statut).toBe(400);
        expect(propre.corps.message).toBe('Le fichier est vide.');
    });
    it('la pré-image d’audit ne relit jamais la colonne binaire, et ne restreint rien ailleurs', () => {
        const { select } = (0, extension_audit_1.selectPreImage)('DocumentTiers');
        expect(select).toBeDefined();
        expect(select.contenu).toBeUndefined();
        expect(select.nomFichier).toBe(true);
        expect(select.tenantId).toBe(true);
        expect((0, extension_audit_1.selectPreImage)('Tiers')).toEqual({});
    });
});
//# sourceMappingURL=documents-tiers.spec.js.map