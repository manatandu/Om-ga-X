"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const exonerations_service_1 = require("./exonerations.service");
const exonerations_controller_1 = require("./exonerations.controller");
const exoneration_dto_1 = require("./dto/exoneration.dto");
const correspondance_exonerations_1 = require("./correspondance-exonerations");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const JOUR = 24 * 60 * 60 * 1000;
const REFERENCE = '2026-06-01';
const valeur = (x) => (x instanceof Date ? x.getTime() : x);
function correspond(l, ou) {
    return Object.entries(ou).every(([cle, attendu]) => {
        if (cle === 'OR')
            return attendu.some((o) => correspond(l, o));
        const x = l[cle];
        if (attendu && typeof attendu === 'object' && !(attendu instanceof Date)) {
            const bornes = attendu;
            const inconnus = Object.keys(bornes).filter((k) => !['gte', 'lt', 'lte'].includes(k));
            if (inconnus.length)
                throw new Error(`Opérateur non servi par la doublure : ${inconnus.join(', ')}`);
            if (x === null || x === undefined)
                return false;
            const v = valeur(x);
            return ((!bornes.gte || v >= bornes.gte.getTime()) &&
                (!bornes.lt || v < bornes.lt.getTime()) &&
                (!bornes.lte || v <= bornes.lte.getTime()));
        }
        return valeur(x) === valeur(attendu);
    });
}
function trier(lignes, ordre) {
    const cles = Array.isArray(ordre) ? ordre : [ordre];
    return [...lignes].sort((a, b) => {
        for (const o of cles) {
            const [cle, sens] = Object.entries(o)[0];
            const x = valeur(a[cle]);
            const y = valeur(b[cle]);
            if (x === y)
                continue;
            if (x === null)
                return sens === 'asc' ? 1 : -1;
            if (y === null)
                return sens === 'asc' ? -1 : 1;
            return (x < y ? -1 : 1) * (sens === 'asc' ? 1 : -1);
        }
        return 0;
    });
}
const dossier = (id, sur = {}) => ({
    id,
    tenantId: 't1',
    type: client_1.TypeDemandeExoneration.PREVISIONNEL,
    statut: client_1.StatutExoneration.EN_PREPARATION,
    objet: `Dossier ${id}`,
    referenceArrete: null,
    dateArrete: null,
    dateDebutValidite: null,
    dateFinValidite: null,
    lettreTransport: null,
    valeurBiens: null,
    franchiseDouaniere: null,
    piecesFournies: [],
    observations: null,
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    createdBy: 'u1',
    updatedAt: new Date('2026-03-01T10:00:00.000Z'),
    ...sur,
});
const complet = correspondance_exonerations_1.MODELES_DEMANDE.find((m) => m.type === 'PREVISIONNEL')
    .pieces.filter((p) => !p.conditionnelle)
    .map((p) => p.cle);
function harnais(tous) {
    const findMany = jest.fn(async (a) => {
        let rendus = trier(tous.filter((d) => correspond(d, a.where)), a.orderBy);
        if (a.cursor)
            rendus = rendus.slice(rendus.findIndex((d) => d.id === a.cursor.id) + (a.skip ?? 0));
        rendus = rendus.slice(0, a.take ?? Infinity);
        const choix = a.select;
        return choix ? rendus.map((d) => Object.fromEntries(Object.keys(choix).filter((k) => choix[k]).map((k) => [k, d[k]]))) : rendus;
    });
    const count = jest.fn(async (a) => tous.filter((d) => correspond(d, a.where)).length);
    const prisma = { exoneration: { findMany, count } };
    return { svc: new exonerations_service_1.ExonerationsService(prisma), prisma };
}
describe('F188 · le registre se lit sur une période, et sa tranche se dit', () => {
    it('sans période et sous le plafond, la liste et les compteurs sont ceux d’avant', async () => {
        const { svc } = harnais([
            dossier('sans-fin'),
            dossier('loin', { statut: client_1.StatutExoneration.ACCORDE, dateFinValidite: new Date('2027-01-15'), piecesFournies: complet }),
            dossier('bientot', { statut: client_1.StatutExoneration.ACCORDE, dateFinValidite: new Date('2026-07-15'), piecesFournies: complet }),
            dossier('perime', { statut: client_1.StatutExoneration.ACCORDE, dateFinValidite: new Date('2026-05-01'), piecesFournies: complet }),
            dossier('voisin', { tenantId: 'autre', statut: client_1.StatutExoneration.ACCORDE, dateFinValidite: new Date('2026-05-01') }),
        ]);
        const r = await svc.lister('t1', REFERENCE);
        expect(r.dossiers.map((d) => d.id)).toEqual(['perime', 'bientot', 'loin', 'sans-fin']);
        expect([r.aRenouveler, r.expires, r.incomplets]).toEqual([1, 1, 1]);
        expect([r.total, r.tronque, r.periode]).toEqual([4, false, { du: null, au: null }]);
    });
    it('la période borne l’OUVERTURE du dossier, mais un titre en alerte reste listé, et les compteurs voient tout', async () => {
        const { svc } = harnais([
            dossier('recent', { createdAt: new Date('2026-04-01T08:00:00.000Z') }),
            dossier('ancien-muet', { createdAt: new Date('2024-01-10T08:00:00.000Z') }),
            dossier('ancien-incomplet', { createdAt: new Date('2024-02-10T08:00:00.000Z') }),
            dossier('ancien-a-renouveler', {
                createdAt: new Date('2024-07-01T08:00:00.000Z'),
                statut: client_1.StatutExoneration.ACCORDE,
                dateFinValidite: new Date('2026-07-15'),
                piecesFournies: complet,
            }),
            dossier('ancien-perime', {
                createdAt: new Date('2023-01-01T08:00:00.000Z'),
                statut: client_1.StatutExoneration.ACCORDE,
                dateFinValidite: new Date('2025-01-01'),
                piecesFournies: complet,
            }),
        ]);
        const r = await svc.lister('t1', REFERENCE, { du: '2026-01-01', au: '2026-12-31' });
        expect(r.dossiers.map((d) => d.id)).toEqual(['ancien-perime', 'ancien-a-renouveler', 'recent']);
        expect([r.total, r.tronque]).toEqual([3, false]);
        expect([r.aRenouveler, r.expires, r.incomplets]).toEqual([1, 1, 3]);
    });
    it('la frontière de l’alerte en requête est EXACTEMENT celle d’enrichir', async () => {
        const limite = new Date(new Date(REFERENCE).getTime() + correspondance_exonerations_1.JOURS_ALERTE_RENOUVELLEMENT * JOUR);
        const hors = { createdAt: new Date('2020-01-01T00:00:00.000Z'), statut: client_1.StatutExoneration.ACCORDE, piecesFournies: complet };
        const { svc } = harnais([
            dossier('au-seuil', { ...hors, dateFinValidite: limite }),
            dossier('juste-apres', { ...hors, dateFinValidite: new Date(limite.getTime() + 1) }),
        ]);
        const r = await svc.lister('t1', REFERENCE, { du: '2026-01-01' });
        expect(r.dossiers.map((d) => [d.id, d.alerte, d.joursAvantExpiration])).toEqual([['au-seuil', 'A_RENOUVELER', correspondance_exonerations_1.JOURS_ALERTE_RENOUVELLEMENT]]);
        expect(r.aRenouveler).toBe(1);
    });
    it('au-delà du plafond, la tranche le DIT, et les compteurs portent sur tout le registre', async () => {
        const tous = Array.from({ length: exonerations_service_1.PLAFOND_LISTE_EXONERATIONS + 1 }, (_, i) => dossier(`d${String(i).padStart(4, '0')}`, { createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000) }));
        const { svc } = harnais(tous);
        const r = await svc.lister('t1', REFERENCE);
        expect(r.dossiers).toHaveLength(exonerations_service_1.PLAFOND_LISTE_EXONERATIONS);
        expect([r.total, r.tronque, r.plafond]).toEqual([exonerations_service_1.PLAFOND_LISTE_EXONERATIONS + 1, true, exonerations_service_1.PLAFOND_LISTE_EXONERATIONS]);
        expect(r.incomplets).toBe(exonerations_service_1.PLAFOND_LISTE_EXONERATIONS + 1);
        expect(r.dossiers[0].id).toBe(`d${String(exonerations_service_1.PLAFOND_LISTE_EXONERATIONS).padStart(4, '0')}`);
    });
    it('les compteurs se lisent par TRANCHES, sans perdre ni recompter la ligne du curseur', async () => {
        const tous = Array.from({ length: lecture_par_lots_1.LOT_LECTURE + 2 }, (_, i) => dossier(`c${String(i).padStart(5, '0')}`));
        const { svc, prisma } = harnais(tous);
        const r = await svc.lister('t1', REFERENCE);
        expect(r.incomplets).toBe(lecture_par_lots_1.LOT_LECTURE + 2);
        const tranches = prisma.exoneration.findMany.mock.calls.filter((c) => c[0].select);
        expect(tranches).toHaveLength(2);
        expect(tranches.every((c) => c[0].take === lecture_par_lots_1.LOT_LECTURE && c[0].where.tenantId === 't1')).toBe(true);
    });
    it('une date illisible est REFUSÉE avant toute lecture, jamais ignorée', async () => {
        const { svc, prisma } = harnais([dossier('a')]);
        await expect(svc.lister('t1', REFERENCE, { du: '2026-13-01' })).rejects.toThrow(common_1.BadRequestException);
        expect(prisma.exoneration.findMany).not.toHaveBeenCalled();
    });
});
describe('F188 · la porte transmet la période, et le DTO la déclare', () => {
    it('le contrôleur passe la date de référence et les deux dates au service', async () => {
        const lister = jest.fn().mockResolvedValue({});
        const ctl = new exonerations_controller_1.ExonerationsController({ lister });
        await ctl.lister({ tenantId: 't1' }, { dateReference: REFERENCE, du: '2026-01-01', au: '2026-12-31' });
        expect(lister).toHaveBeenCalledWith('t1', REFERENCE, { du: '2026-01-01', au: '2026-12-31' });
    });
    it('le filtre global admet du et au, et refuse une date de référence illisible', async () => {
        const ok = (0, class_transformer_1.plainToInstance)(exoneration_dto_1.ListerExonerationsDto, { dateReference: REFERENCE, du: '2026-01-01', au: '2026-12-31' });
        expect(await (0, class_validator_1.validate)(ok, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
        const illisible = (0, class_transformer_1.plainToInstance)(exoneration_dto_1.ListerExonerationsDto, { dateReference: 'hier' });
        expect(await (0, class_validator_1.validate)(illisible, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
    });
});
//# sourceMappingURL=liste-bornee-f188.spec.js.map