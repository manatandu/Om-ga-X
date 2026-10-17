"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const facturation_service_1 = require("./facturation.service");
const facturation_controller_1 = require("./facturation.controller");
const facture_dto_1 = require("./dto/facture.dto");
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
const piece = (id, jour, sur = {}) => ({
    id,
    tenantId: 't',
    sens: client_1.SensFacture.VENTE,
    nature: client_1.NatureFacture.FACTURE,
    numeroSerie: `FV-${id}`,
    dateFacture: new Date(`${jour}T00:00:00.000Z`),
    emetteurNom: 'Le dossier',
    emetteurAdresse: 'Kinshasa',
    emetteurNumeroImpot: 'A0000000A',
    contrepartieNom: 'Client SARL',
    contrepartieAdresse: 'Kinshasa',
    contrepartieNumeroImpot: 'B0000000B',
    mentionTvaDebits: false,
    mentionsSocieteEmetteur: null,
    autresImpotsEtTaxes: 0,
    ecritureId: null,
    tiers: null,
    factureAnnulee: null,
    noteDeCredit: null,
    lignes: [{ id: `l-${id}`, ordre: 1, designation: 'Conseil', quantite: 1, prixUnitaire: 100, montantHT: 100, imposable: true, tauxApplique: 16, montantTva: 16 }],
    ...sur,
});
function harnais(pieces) {
    const findMany = jest.fn(async (a) => trier(pieces.filter((p) => correspond(p, a.where)), a.orderBy).slice(0, a.take ?? Infinity));
    const count = jest.fn(async (a) => pieces.filter((p) => correspond(p, a.where)).length);
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                id: 't',
                nom: 'Le dossier',
                formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE',
                regimeExigibiliteTva: null,
            }),
        },
        facture: { findMany, count },
    };
    return { svc: new facturation_service_1.FacturationService(prisma), prisma };
}
describe('F188 · le facturier se lit sur une période, et sa tranche se dit', () => {
    it('sans période et sous le plafond, la liste est celle d’avant · même ordre, rien de coupé', async () => {
        const { svc } = harnais([
            piece('a', '2025-03-01'),
            piece('b', '2026-09-10', { numeroSerie: 'FV-0002' }),
            piece('c', '2026-09-10', { numeroSerie: 'FV-0009' }),
            piece('v', '2026-09-11', { tenantId: 'voisin' }),
        ]);
        const r = await svc.lister('t');
        expect(r.factures.map((f) => f.numeroSerie)).toEqual(['FV-0009', 'FV-0002', 'FV-a']);
        expect([r.total, r.tronque, r.periode]).toEqual([3, false, { du: null, au: null }]);
    });
    it('la période borne la DATE DE LA PIÈCE, ses deux jours compris, et le total la compte', async () => {
        const { svc } = harnais([
            piece('avant', '2025-12-31'),
            piece('premier', '2026-01-01'),
            piece('dernier', '2026-12-31'),
            piece('apres', '2027-01-01'),
        ]);
        const r = await svc.lister('t', { du: '2026-01-01', au: '2026-12-31' });
        expect(r.factures.map((f) => f.id)).toEqual(['dernier', 'premier']);
        expect([r.total, r.tronque]).toEqual([2, false]);
        expect(r.periode).toEqual({ du: '2026-01-01', au: '2026-12-31' });
    });
    it('au-delà du plafond, les plus récentes sont rendues et la tranche le DIT, total compté sur la période', async () => {
        const pieces = Array.from({ length: facturation_service_1.PLAFOND_LISTE_FACTURES + 1 }, (_, i) => piece(String(i).padStart(4, '0'), new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString().slice(0, 10), {
            dateFacture: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000),
        }));
        const { svc, prisma } = harnais(pieces);
        const r = await svc.lister('t');
        expect(r.factures).toHaveLength(facturation_service_1.PLAFOND_LISTE_FACTURES);
        expect([r.total, r.tronque, r.plafond]).toEqual([facturation_service_1.PLAFOND_LISTE_FACTURES + 1, true, facturation_service_1.PLAFOND_LISTE_FACTURES]);
        expect(r.factures[0].id).toBe(String(facturation_service_1.PLAFOND_LISTE_FACTURES).padStart(4, '0'));
        expect(r.factures.some((f) => f.id === '0000')).toBe(false);
        expect(prisma.facture.count.mock.calls[0][0].where).toEqual(prisma.facture.findMany.mock.calls[0][0].where);
    });
    it('le sens et la période se cumulent, dans la lecture comme dans le décompte', async () => {
        const { svc, prisma } = harnais([
            piece('v1', '2026-05-01'),
            piece('a1', '2026-05-02', { sens: client_1.SensFacture.ACHAT }),
            piece('a0', '2025-05-02', { sens: client_1.SensFacture.ACHAT }),
        ]);
        const r = await svc.lister('t', { sens: client_1.SensFacture.ACHAT, du: '2026-01-01' });
        expect(r.factures.map((f) => f.id)).toEqual(['a1']);
        expect(r.total).toBe(1);
        expect(prisma.facture.count.mock.calls[0][0].where).toEqual(prisma.facture.findMany.mock.calls[0][0].where);
    });
    it('une date illisible est REFUSÉE avant toute lecture, jamais ignorée', async () => {
        const { svc, prisma } = harnais([piece('a', '2026-01-01')]);
        await expect(svc.lister('t', { du: '2026-02-30' })).rejects.toThrow(common_1.BadRequestException);
        await expect(svc.lister('t', { au: 'demain' })).rejects.toThrow(/illisible/);
        expect(prisma.facture.findMany).not.toHaveBeenCalled();
        expect(prisma.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
    });
});
describe('F188 · la porte transmet la période, et le DTO la déclare', () => {
    it('le contrôleur passe le sens et les deux dates au service', async () => {
        const lister = jest.fn().mockResolvedValue({});
        const ctl = new facturation_controller_1.FacturationController({ lister }, {});
        await ctl.lister({ tenantId: 't' }, { sens: client_1.SensFacture.VENTE, du: '2026-01-01', au: '2026-12-31' });
        expect(lister).toHaveBeenCalledWith('t', { sens: client_1.SensFacture.VENTE, du: '2026-01-01', au: '2026-12-31' });
    });
    it('le filtre global, qui refuse tout paramètre inconnu, admet du et au', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(facture_dto_1.ListerFacturesDto, { sens: 'VENTE', du: '2026-01-01', au: '2026-12-31' });
        expect(await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
        const intrus = (0, class_transformer_1.plainToInstance)(facture_dto_1.ListerFacturesDto, { depuis: '2026-01-01' });
        expect(await (0, class_validator_1.validate)(intrus, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
    });
});
//# sourceMappingURL=liste-bornee-f188.spec.js.map