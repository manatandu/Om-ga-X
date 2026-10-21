"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const compte_service_1 = require("./compte.service");
const compte_en_saisie_1 = require("./compte-en-saisie");
const subdivisions_du_plan_1 = require("./subdivisions-du-plan");
const collectifs_tiers_1 = require("../tiers/collectifs-tiers");
const DETAIL_ACTIF = { typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true };
describe('compte créé en saisie · le motif', () => {
    const base = {
        referentiel: client_1.Referentiel.SYSCOHADA,
        numero: '62210005',
        longueurCompte: 8,
        existe: false,
        numeroDuPlan: (0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '62210005'),
        compteDuPlan: { numero: '62210000', intitule: 'Intitulé du plan', ...DETAIL_ACTIF },
    };
    it('le numéro subdivise le compte d’imputation du plan qui le préfixe le plus longuement', () => {
        expect(base.numeroDuPlan).toBe('62210000');
        expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)(base)).toBeNull();
    });
    it('refuse un compte existant, un numéro trop long, hors plan, un compte du plan absent, total ou en sommeil', () => {
        expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)({ ...base, existe: true })).toMatch(/existe déjà dans ce dossier/);
        expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)({ ...base, numero: '622100051' })).toMatch(/dépasse la longueur .* \(8 chiffres\)/);
        expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)({ ...base, numeroDuPlan: null })).toMatch(/ne subdivise aucun compte d'imputation du plan/);
        expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)({ ...base, compteDuPlan: null })).toMatch(/n'existe plus dans ce dossier/);
        expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)({ ...base, compteDuPlan: { ...base.compteDuPlan, typeCompte: client_1.TypeCompteDetailTotal.TOTAL } })).toMatch(/n'est pas un compte d'imputation/);
        expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)({ ...base, compteDuPlan: { ...base.compteDuPlan, estActif: false } })).toMatch(/est en sommeil/);
        expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)({ ...base, numero: '6221A' })).toMatch(/chiffres seuls/);
    });
    it('un numéro semé n’est la subdivision d’aucun compte · il se personnalise au Plan comptable', () => {
        expect((0, subdivisions_du_plan_1.compteSemeSubdivise)(client_1.Referentiel.SYSCOHADA, '62210000')).toBeNull();
    });
    it('jamais sous un collectif de tiers, aux deux référentiels · tout compte de chaque panoplie', () => {
        for (const referentiel of [client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL]) {
            for (const panoplie of Object.values(collectifs_tiers_1.PANOPLIES_TIERS[referentiel])) {
                for (const c of panoplie ?? []) {
                    const numero = `${c.collectif.slice(0, 7)}9`;
                    const numeroDuPlan = (0, subdivisions_du_plan_1.compteSemeSubdivise)(referentiel, numero);
                    expect({ numero, numeroDuPlan }).toEqual({ numero, numeroDuPlan: c.collectif });
                    expect((0, compte_en_saisie_1.collectifDeTiers)(referentiel, c.collectif)).toBe(c.collectif);
                    expect((0, compte_en_saisie_1.motifRefusCompteEnSaisie)({
                        referentiel,
                        numero,
                        longueurCompte: 8,
                        existe: false,
                        numeroDuPlan,
                        compteDuPlan: { numero: c.collectif, intitule: 'x', ...DETAIL_ACTIF },
                    })).toMatch(new RegExp(`sous le collectif ${c.collectif} des tiers · le compte d'un tiers naît avec sa fiche`));
                }
            }
        }
    });
});
describe('compte créé en saisie · le service', () => {
    function monde(options = {}) {
        const create = jest.fn(async ({ data }) => {
            if (options.conflit)
                throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
            return { id: 'nouveau', ...data };
        });
        const p = {
            tenant: {
                findUniqueOrThrow: jest.fn(async () => ({
                    id: 't1',
                    referentiel: client_1.Referentiel.SYSCOHADA,
                    longueurCompte: 8,
                    creationCompteEnSaisie: options.option ?? true,
                })),
            },
            compte: {
                findUnique: jest.fn(async ({ where }) => {
                    const n = where.tenantId_numero.numero;
                    if (n === '62210000')
                        return { id: 'plan', numero: n, intitule: 'Intitulé du plan', ...DETAIL_ACTIF, lettrable: false };
                    if (n === '62210005' && options.existe)
                        return { id: 'deja' };
                    return null;
                }),
                create,
            },
            natureCompte: { findMany: jest.fn(async () => []), createMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 7) },
        };
        return { svc: new compte_service_1.CompteService(p), create };
    }
    it('la proposition nomme le compte du plan et reprend son intitulé, sans rien créer', async () => {
        const { svc, create } = monde();
        expect(await svc.propositionEnSaisie('t1', ' 62210005 ')).toEqual({
            numero: '62210005',
            intitule: 'Intitulé du plan',
            compteDuPlan: { numero: '62210000', intitule: 'Intitulé du plan' },
            motif: null,
        });
        expect(create).not.toHaveBeenCalled();
    });
    it('sans l’option du dossier · 403 nommé, rien n’est créé, et la proposition le dit', async () => {
        const { svc, create } = monde({ option: false });
        await expect(svc.creerEnSaisie('t1', { numero: '62210005', intitule: 'Terrain du dépôt' })).rejects.toBeInstanceOf(common_1.ForbiddenException);
        expect((await svc.propositionEnSaisie('t1', '62210005')).motif).toBe(compte_en_saisie_1.MOTIF_OPTION_FERMEE);
        expect(create).not.toHaveBeenCalled();
    });
    it('crée par la création ordinaire · DÉTAIL, réglages repris du compte du plan, personnalisé par défaut', async () => {
        const { svc, create } = monde();
        const c = await svc.creerEnSaisie('t1', { numero: '62210005', intitule: '  Terrain du dépôt ' });
        expect(c).toMatchObject({ id: 'nouveau', numero: '62210005', intitule: 'Terrain du dépôt', typeCompte: 'DETAIL' });
        expect(create.mock.calls[0][0].data).not.toHaveProperty('estRetenu');
        expect(create.mock.calls[0][0].data.lettrable).toBe(false);
    });
    it('refuse un numéro existant, un intitulé vide, et dit le conflit de deux créations simultanées', async () => {
        await expect(monde({ existe: true }).svc.creerEnSaisie('t1', { numero: '62210005', intitule: 'x' })).rejects.toThrow(/existe déjà/);
        await expect(monde().svc.creerEnSaisie('t1', { numero: '62210005', intitule: '   ' })).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(monde({ conflit: true }).svc.creerEnSaisie('t1', { numero: '62210005', intitule: 'x' })).rejects.toBeInstanceOf(common_1.ConflictException);
    });
});
//# sourceMappingURL=compte-en-saisie.spec.js.map