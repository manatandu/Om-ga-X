"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const commercial_service_1 = require("./commercial.service");
const commercial_controller_1 = require("./commercial.controller");
const devis_dto_1 = require("./dto/devis.dto");
const valeur = (x) => (x instanceof Date ? x.getTime() : x);
function correspond(l, ou) {
    return Object.entries(ou).every(([cle, attendu]) => {
        const x = l[cle];
        if (attendu && typeof attendu === 'object' && !(attendu instanceof Date)) {
            const bornes = attendu;
            const inconnus = Object.keys(bornes).filter((k) => !['gte', 'lt'].includes(k));
            if (inconnus.length)
                throw new Error(`Opérateur non servi par la doublure : ${inconnus.join(', ')}`);
            if (x === null || x === undefined)
                return false;
            const v = valeur(x);
            return (!bornes.gte || v >= bornes.gte.getTime()) && (!bornes.lt || v < bornes.lt.getTime());
        }
        return valeur(x) === valeur(attendu);
    });
}
function trier(lignes, ordre) {
    return [...lignes].sort((a, b) => {
        for (const o of ordre) {
            const [cle, sens] = Object.entries(o)[0];
            const x = valeur(a[cle]);
            const y = valeur(b[cle]);
            if (x === y)
                continue;
            return (x < y ? -1 : 1) * (sens === 'asc' ? 1 : -1);
        }
        return 0;
    });
}
const devis = (id, jour, sur = {}) => ({
    id,
    tenantId: 't',
    emetteur: 'DOSSIER',
    numero: `DV-${id}`,
    dateEmission: new Date(`${jour}T00:00:00.000Z`),
    dateReception: null,
    delaiJours: null,
    declareeIrrevocable: false,
    destinataireDetermine: true,
    volonteDEtreLie: true,
    nature: client_1.NatureOperationVente.MARCHANDISES,
    tiersId: null,
    clientNom: 'Client SARL',
    objet: null,
    mentionsSocieteEmetteur: null,
    natureReponse: null,
    dateReponse: null,
    detailReponse: null,
    revoqueLe: null,
    motifRevocation: null,
    contrePropositionDeId: null,
    contreProposition: null,
    lignes: [{ id: `l-${id}`, ordre: 1, designation: 'Ciment', quantite: 1, prixUnitaire: 100, montantHT: 100 }],
    ...sur,
});
function harnais(tous) {
    const findMany = jest.fn(async (a) => trier(tous.filter((d) => correspond(d, a.where)), a.orderBy)
        .slice(0, a.take ?? Infinity)
        .map((d) => {
        const { contreProposition, ...reste } = d;
        return a.include?.contreProposition ? { ...reste, contreProposition } : reste;
    }));
    const count = jest.fn(async (a) => tous.filter((d) => correspond(d, a.where)).length);
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel: client_1.Referentiel.SYSCOHADA }) },
        devis: { findMany, count },
    };
    return { svc: new commercial_service_1.CommercialService(prisma), prisma };
}
describe('F188 · les devis se lisent sur une période, et leur tranche se dit', () => {
    it('sans période et sous le plafond, la liste est celle d’avant · même ordre, rien de coupé', async () => {
        const { svc } = harnais([
            devis('a', '2025-03-01'),
            devis('b', '2026-09-10', { numero: 'DV-0002' }),
            devis('c', '2026-09-10', { numero: 'DV-0009' }),
            devis('v', '2026-09-11', { tenantId: 'voisin' }),
        ]);
        const r = await svc.lister('t', { dateReference: '2026-09-28' });
        expect(r.devis.map((d) => d.numero)).toEqual(['DV-0009', 'DV-0002', 'DV-a']);
        expect([r.total, r.tronque, r.periode]).toEqual([3, false, { du: null, au: null }]);
    });
    it('la période borne la DATE D’ÉMISSION, ses deux jours compris, et le total la compte', async () => {
        const { svc, prisma } = harnais([
            devis('avant', '2025-12-31'),
            devis('premier', '2026-01-01'),
            devis('dernier', '2026-12-31'),
            devis('apres', '2027-01-01'),
        ]);
        const r = await svc.lister('t', { du: '2026-01-01', au: '2026-12-31' });
        expect(r.devis.map((d) => d.id)).toEqual(['dernier', 'premier']);
        expect([r.total, r.tronque]).toEqual([2, false]);
        expect(prisma.devis.count.mock.calls[0][0].where).toEqual(prisma.devis.findMany.mock.calls[0][0].where);
    });
    it('au-delà du plafond, les plus récents sont rendus et la tranche le DIT', async () => {
        const tous = Array.from({ length: commercial_service_1.PLAFOND_LISTE_DEVIS + 1 }, (_, i) => devis(String(i).padStart(4, '0'), '2026-01-01', { dateEmission: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000) }));
        const { svc } = harnais(tous);
        const r = await svc.lister('t');
        expect(r.devis).toHaveLength(commercial_service_1.PLAFOND_LISTE_DEVIS);
        expect([r.total, r.tronque, r.plafond]).toEqual([commercial_service_1.PLAFOND_LISTE_DEVIS + 1, true, commercial_service_1.PLAFOND_LISTE_DEVIS]);
        expect(r.devis[0].id).toBe(String(commercial_service_1.PLAFOND_LISTE_DEVIS).padStart(4, '0'));
        expect(r.devis.some((d) => d.id === '0000')).toBe(false);
    });
    it('la contre-proposition se lit sur la ligne du devis rejeté, même émise hors de la période', async () => {
        const { svc } = harnais([
            devis('origine', '2026-12-15', {
                natureReponse: client_1.NatureReponseDevis.MODIFICATION_SUBSTANTIELLE,
                dateReponse: new Date('2026-12-20'),
                detailReponse: 'Prix revu',
                contreProposition: { id: 'suite' },
            }),
            devis('suite', '2027-01-05', { emetteur: 'CLIENT', contrePropositionDeId: 'origine' }),
        ]);
        const r = await svc.lister('t', { du: '2026-01-01', au: '2026-12-31', dateReference: '2027-01-10' });
        expect(r.devis.map((d) => [d.id, d.contrePropositionId])).toEqual([['origine', 'suite']]);
    });
    it('une date illisible est REFUSÉE avant toute lecture, jamais ignorée', async () => {
        const { svc, prisma } = harnais([devis('a', '2026-01-01')]);
        await expect(svc.lister('t', { au: '2026-02-30' })).rejects.toThrow(common_1.BadRequestException);
        expect(prisma.devis.findMany).not.toHaveBeenCalled();
        expect(prisma.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
    });
});
describe('F188 · la porte transmet la période, et le DTO la déclare', () => {
    it('le contrôleur passe la date de référence et les deux dates au service', async () => {
        const lister = jest.fn().mockResolvedValue({});
        const ctl = new commercial_controller_1.CommercialController({ lister });
        await ctl.lister({ tenantId: 't' }, { dateReference: '2026-09-28', du: '2026-01-01', au: '2026-12-31' });
        expect(lister).toHaveBeenCalledWith('t', { dateReference: '2026-09-28', du: '2026-01-01', au: '2026-12-31' });
    });
    it('le filtre global admet du et au, et refuse une date de référence illisible', async () => {
        const ok = (0, class_transformer_1.plainToInstance)(devis_dto_1.ListerDevisDto, { dateReference: '2026-09-28', du: '2026-01-01', au: '2026-12-31' });
        expect(await (0, class_validator_1.validate)(ok, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
        const illisible = (0, class_transformer_1.plainToInstance)(devis_dto_1.ListerDevisDto, { dateReference: 'hier' });
        expect(await (0, class_validator_1.validate)(illisible, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
    });
});
//# sourceMappingURL=liste-bornee-f188.spec.js.map