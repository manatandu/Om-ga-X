"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const personnel_service_1 = require("./personnel.service");
const avances_rubriques_service_1 = require("./avances-rubriques.service");
const baremes_dossier_1 = require("./baremes-dossier");
const bornes_registre_1 = require("./bornes-registre");
const personnel_dto_1 = require("./dto/personnel.dto");
const effectif_registre_1 = require("./effectif-registre");
const regles_contrat_travail_1 = require("./regles-contrat-travail");
const estNul = (v) => v === null || v === undefined;
function comparer(x, y) {
    const a = x instanceof Date ? x.getTime() : x;
    const b = y instanceof Date ? y.getTime() : y;
    return a < b ? -1 : a > b ? 1 : 0;
}
function vaut(v, filtre) {
    if (filtre === undefined)
        return true;
    if (filtre === null)
        return estNul(v);
    if (filtre instanceof Date)
        return v instanceof Date && v.getTime() === filtre.getTime();
    if (typeof filtre !== 'object')
        return v === filtre;
    return Object.entries(filtre).every(([op, x]) => {
        if (x === undefined)
            return true;
        switch (op) {
            case 'equals':
                return vaut(v, x);
            case 'not':
                return !vaut(v, x);
            case 'in':
                return x.some((y) => vaut(v, y));
            case 'lt':
                return !estNul(v) && comparer(v, x) < 0;
            case 'lte':
                return !estNul(v) && comparer(v, x) <= 0;
            case 'gt':
                return !estNul(v) && comparer(v, x) > 0;
            case 'gte':
                return !estNul(v) && comparer(v, x) >= 0;
            default:
                throw new Error(`Filtre de colonne que la doublure ne sait pas honorer : ${op}`);
        }
    });
}
function correspond(l, where = {}) {
    return Object.entries(where).every(([k, v]) => {
        if (v === undefined)
            return true;
        if (k === 'OR')
            return v.some((w) => correspond(l, w));
        if (k === 'AND')
            return (Array.isArray(v) ? v : [v]).every((w) => correspond(l, w));
        if (k === 'NOT')
            return !(Array.isArray(v) ? v : [v]).some((w) => correspond(l, w));
        const val = l[k];
        if (Array.isArray(val)) {
            return Object.entries(v).every(([op, w]) => {
                if (op === 'some')
                    return val.some((e) => correspond(e, w));
                if (op === 'every')
                    return val.every((e) => correspond(e, w));
                if (op === 'none')
                    return !val.some((e) => correspond(e, w));
                throw new Error(`Filtre de relation que la doublure ne sait pas honorer : ${op}`);
            });
        }
        return vaut(val, v);
    });
}
function trier(lignes, orderBy) {
    const cles = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []);
    return [...lignes].sort((a, b) => {
        for (const o of cles) {
            const [k, spec] = Object.entries(o)[0];
            const sens = typeof spec === 'string' ? spec : spec.sort;
            const nuls = typeof spec === 'object' && spec.nulls
                ? spec.nulls
                : sens === 'asc'
                    ? 'last'
                    : 'first';
            const x = a[k];
            const y = b[k];
            if (estNul(x) && estNul(y))
                continue;
            if (estNul(x))
                return nuls === 'first' ? -1 : 1;
            if (estNul(y))
                return nuls === 'first' ? 1 : -1;
            const c = comparer(x, y);
            if (c !== 0)
                return sens === 'asc' ? c : -c;
        }
        return 0;
    });
}
function projeter(ligne, include) {
    if (!include)
        return { ...ligne };
    const rendu = { ...ligne };
    for (const [k, spec] of Object.entries(include)) {
        if (k === '_count') {
            const select = spec.select;
            rendu._count = Object.fromEntries(Object.entries(select).map(([rel, s]) => {
                const tous = ligne[rel] ?? [];
                const where = typeof s === 'object' && s !== null ? s.where : undefined;
                return [rel, tous.filter((e) => correspond(e, where)).length];
            }));
            continue;
        }
        const valeur = ligne[k];
        if (!Array.isArray(valeur) || spec === true)
            continue;
        const s = spec;
        let r = trier(valeur.filter((e) => correspond(e, s.where)), s.orderBy);
        if (s.skip)
            r = r.slice(s.skip);
        if (s.take !== undefined)
            r = r.slice(0, s.take);
        rendu[k] = r;
    }
    return rendu;
}
function lecture(source) {
    return jest.fn(async (args = {}) => {
        const table = typeof source === 'function' ? source() : source;
        let r = trier(table.filter((l) => correspond(l, args.where)), args.orderBy);
        if (args.cursor)
            r = r.slice(r.findIndex((l) => l.id === args.cursor.id));
        if (args.skip)
            r = r.slice(args.skip);
        if (args.take !== undefined)
            r = r.slice(0, args.take);
        return r.map((l) => projeter(l, args.include));
    });
}
function compte(source) {
    return jest.fn(async (args = {}) => (typeof source === 'function' ? source() : source).filter((l) => correspond(l, args.where)).length);
}
const pasTrouvee = () => new client_1.Prisma.PrismaClientKnownRequestError('Record to update not found.', { code: 'P2025', clientVersion: '5' });
const pad = (n, l) => String(n).padStart(l, '0');
function contrat(over = {}) {
    return {
        id: 'c-1',
        tenantId: 't1',
        type: 'DUREE_INDETERMINEE',
        constateParEcrit: true,
        dateEntreeEnVigueur: new Date('2026-01-05T00:00:00Z'),
        dateConclusion: new Date('2026-01-02T00:00:00Z'),
        lieuConclusion: 'Kinshasa',
        dateFinPrevue: null,
        ouvrageDetermine: null,
        motifRemplacement: null,
        emploiPermanent: true,
        natureTravail: 'Gardiennage',
        lieuExecution: 'Kinshasa',
        categorieProfessionnelle: null,
        classeProfessionnelle: 1,
        periodiciteRemuneration: 'MOIS',
        manoeuvreSansSpecialite: false,
        remunerationBase: 1000,
        deviseRemuneration: 'USD',
        avantagesConvenus: 'Transport',
        clauseEssai: false,
        essaiConstateParEcrit: false,
        essaiDureeJours: null,
        dureePreavisJours: 14,
        viseParOnem: true,
        dateVisaOnem: null,
        renouvelleDeId: null,
        dateFin: null,
        motifFin: null,
        ...over,
    };
}
function enfant(over = {}) {
    return {
        id: 'e-1',
        tenantId: 't1',
        salarieId: 's-1',
        nom: 'Mukendi',
        postNom: null,
        prenoms: 'Grâce',
        dateNaissance: new Date('2015-06-01T00:00:00Z'),
        ...over,
    };
}
function salarie(over = {}) {
    return {
        id: 's-1',
        tenantId: 't1',
        matricule: null,
        nom: 'Mukendi',
        postNom: 'Tshibangu',
        prenoms: 'Jean',
        sexe: 'MASCULIN',
        numeroAffiliationCnss: 'CNSS-0099',
        dateNaissance: new Date('1990-04-12T00:00:00Z'),
        millesimeNaissance: null,
        lieuNaissance: 'Mbuji-Mayi',
        nationalite: 'Congolaise',
        nomConjoint: null,
        aptitudeConstateeLe: new Date('2026-01-02T00:00:00Z'),
        aptitudeProvisoire: false,
        declarationEngagementLe: new Date('2026-01-10T00:00:00Z'),
        declarationDepartLe: null,
        actif: true,
        enfants: [],
        contrats: [contrat()],
        ...over,
    };
}
function monterPersonnel(salaries, contrats = [], versions = []) {
    const salarieFindMany = lecture(salaries);
    const salarieCount = compte(salaries);
    const enfantsAPlat = () => salaries.flatMap((s) => s.enfants ?? []);
    const contratsAPlat = () => [...salaries.flatMap((s) => s.contrats ?? []), ...contrats];
    const create = jest.fn(async (args) => ({ id: 'c-neuf', ...args.data }));
    const updateMany = jest.fn(async (args) => {
        const touches = contrats.filter((c) => correspond(c, args.where));
        for (const c of touches)
            Object.assign(c, args.data);
        return { count: touches.length };
    });
    const update = jest.fn(async (args) => {
        const c = contrats.find((x) => correspond(x, args.where));
        if (!c)
            throw pasTrouvee();
        Object.assign(c, args.data);
        return { ...c };
    });
    const salarieUpdate = jest.fn(async (args) => {
        const s = salaries.find((x) => correspond(x, args.where));
        if (!s)
            throw pasTrouvee();
        Object.assign(s, args.data);
        return projeter(s, args.include);
    });
    const salarieUpdateMany = jest.fn(async (args) => {
        const touches = salaries.filter((s) => correspond(s, args.where));
        for (const s of touches)
            Object.assign(s, args.data);
        return { count: touches.length };
    });
    const salarieGroupBy = jest.fn(async (args) => {
        const groupes = new Map();
        for (const s of salaries.filter((x) => correspond(x, args.where))) {
            const cle = Object.fromEntries(args.by.map((k) => [k, s[k] ?? null]));
            const g = groupes.get(JSON.stringify(cle)) ?? { ...cle, _count: { _all: 0 } };
            g._count._all += 1;
            groupes.set(JSON.stringify(cle), g);
        }
        return [...groupes.values()];
    });
    const enfantDelete = jest.fn(async (args) => {
        for (const s of salaries) {
            const liste = s.enfants ?? [];
            const i = liste.findIndex((e) => correspond(e, args.where));
            if (i >= 0)
                return liste.splice(i, 1)[0];
        }
        throw pasTrouvee();
    });
    let neufs = 0;
    const enfantCreate = jest.fn(async (args) => {
        const s = salaries.find((x) => x.id === args.data.salarieId && x.tenantId === args.data.tenantId);
        if (!s)
            throw new Error('Salarié introuvable pour cet enfant.');
        neufs += 1;
        const e = { id: `e-neuf-${pad(neufs, 3)}`, ...args.data };
        s.enfants.push(e);
        return e;
    });
    const enfantDeleteMany = jest.fn(async (args) => {
        let n = 0;
        for (const s of salaries) {
            const garde = (s.enfants ?? []).filter((e) => !correspond(e, args.where));
            n += (s.enfants ?? []).length - garde.length;
            s.enfants = garde;
        }
        return { count: n };
    });
    const versionAggregate = jest.fn(async (args) => {
        const retenues = versions.filter((v) => correspond(v, args.where));
        const debuts = retenues.map((v) => v.aPartirDu).sort();
        return { _count: { _all: retenues.length }, _min: { aPartirDu: debuts[0] ?? null } };
    });
    const contratAggregate = jest.fn(async (args) => {
        const fins = contratsAPlat()
            .filter((c) => correspond(c, args.where))
            .map((c) => c.dateFin)
            .filter((d) => d instanceof Date);
        return { _max: { dateFin: fins.length ? new Date(Math.max(...fins.map((d) => d.getTime()))) : null } };
    });
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn(async () => ({ nom: 'ASBL Bomoko', numeroAffiliationCnssEmployeur: 'CNSS-EMP-4471' })),
        },
        versionBaremePaie: { findMany: lecture(versions), aggregate: versionAggregate },
        salarie: {
            findMany: salarieFindMany,
            count: salarieCount,
            findFirst: jest.fn(async (args) => salaries.find((s) => correspond(s, args.where)) ?? null),
            update: salarieUpdate,
            updateMany: salarieUpdateMany,
            groupBy: salarieGroupBy,
        },
        enfantACharge: {
            findMany: lecture(enfantsAPlat),
            delete: enfantDelete,
            create: enfantCreate,
            deleteMany: enfantDeleteMany,
        },
        contratTravail: {
            findFirst: jest.fn(async (args) => {
                const c = contrats.find((x) => correspond(x, args.where));
                return c ? { ...c } : null;
            }),
            aggregate: contratAggregate,
            count: compte(contratsAPlat),
            updateMany,
            update,
            create,
        },
        $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    return {
        svc: new personnel_service_1.PersonnelService(prisma),
        salarieFindMany,
        salarieCount,
        create,
        updateMany,
        update,
        salarieUpdate,
        salarieUpdateMany,
        enfantDelete,
        enfantCreate,
        enfantDeleteMany,
        salarieFindFirst: prisma.salarie.findFirst,
        contratCount: prisma.contratTravail.count,
        versionFindMany: prisma.versionBaremePaie.findMany,
        prisma: prisma,
        brut: prisma,
    };
}
const AUJOURDHUI = new Date('2026-03-15T10:00:00Z');
describe('F226 · la monnaie du contrat, jusqu’à la confrontation', () => {
    it('un salaire en dollars n’est jamais « en deçà » d’un minimum en francs', async () => {
        const { svc } = monterPersonnel([salarie()]);
        const r = await svc.confronter('t1', AUJOURDHUI);
        const v = r.fiches[0].remunerationMinimale;
        expect(v.conforme).toBeNull();
        expect(v.abstention).toBe('REMUNERATION_HORS_FRANC');
        expect(v.convenueFc).toBeNull();
        expect(v.manqueFc).toBeNull();
    });
    it('sans monnaie déclarée, le contrôle s’abstient et le dit', async () => {
        const { svc } = monterPersonnel([salarie({ contrats: [contrat({ deviseRemuneration: null })] })]);
        const v = (await svc.confronter('t1', AUJOURDHUI)).fiches[0].remunerationMinimale;
        expect(v.conforme).toBeNull();
        expect(v.abstention).toBe('DEVISE_NON_RENSEIGNEE');
    });
    it('en francs, le contrôle mord toujours', async () => {
        const { svc } = monterPersonnel([salarie({ contrats: [contrat({ deviseRemuneration: 'CDF' })] })]);
        const r = await svc.confronter('t1', AUJOURDHUI);
        expect(r.fiches[0].remunerationMinimale.conforme).toBe(false);
        expect(r.fiches[0].remunerationMinimale.manqueFc).toBe(559_000 - 1000);
    });
    it('la création du contrat écrit la monnaie, et null quand elle n’est pas dite', async () => {
        const { svc, create } = monterPersonnel([salarie()]);
        await svc.creerContrat('t1', 'u-1', 's-1', {
            type: 'DUREE_INDETERMINEE',
            dateEntreeEnVigueur: '2026-01-05',
            remunerationBase: 1000,
            deviseRemuneration: 'USD',
        });
        expect(create.mock.calls[0][0].data.deviseRemuneration).toBe('USD');
        await svc.creerContrat('t1', 'u-1', 's-1', { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-05' });
        expect(create.mock.calls[1][0].data.deviseRemuneration).toBeNull();
    });
    describe('déclarer la monnaie d’un contrat saisi sans elle', () => {
        it('la complète quand elle manque', async () => {
            const lignes = [contrat({ deviseRemuneration: null })];
            const { svc } = monterPersonnel([], lignes);
            const r = await svc.declarerDeviseRemuneration('t1', 'c-1', 'CDF');
            expect(lignes[0].deviseRemuneration).toBe('CDF');
            expect(r).toMatchObject({ id: 'c-1', deviseRemuneration: 'CDF' });
        });
        it('ne change jamais une monnaie déjà déclarée', async () => {
            const lignes = [contrat({ deviseRemuneration: 'CDF' })];
            const { svc, updateMany, update } = monterPersonnel([], lignes);
            await expect(svc.declarerDeviseRemuneration('t1', 'c-1', 'USD')).rejects.toBeInstanceOf(common_1.ConflictException);
            expect(lignes[0].deviseRemuneration).toBe('CDF');
            expect(update).not.toHaveBeenCalled();
            expect(updateMany).not.toHaveBeenCalled();
        });
        it('pose la condition « encore nulle » dans l’écriture même', async () => {
            const lignes = [contrat({ deviseRemuneration: 'USD' })];
            const { svc, prisma, update } = monterPersonnel([], lignes);
            prisma.contratTravail.findFirst.mockResolvedValueOnce({ id: 'c-1', deviseRemuneration: null });
            await expect(svc.declarerDeviseRemuneration('t1', 'c-1', 'CDF')).rejects.toBeInstanceOf(common_1.ConflictException);
            expect(lignes[0].deviseRemuneration).toBe('USD');
            expect(update.mock.calls[0][0].where).toEqual({ id: 'c-1', tenantId: 't1', deviseRemuneration: null });
        });
        it('écrit par une opération UNITAIRE, que le journal d’audit recopie avant et après', async () => {
            const lignes = [contrat({ deviseRemuneration: null })];
            const { svc, update, updateMany } = monterPersonnel([], lignes);
            await svc.declarerDeviseRemuneration('t1', 'c-1', 'USD');
            expect(updateMany).not.toHaveBeenCalled();
            expect(update).toHaveBeenCalledTimes(1);
            expect(update.mock.calls[0][0].data).toEqual({ deviseRemuneration: 'USD' });
        });
        it('une autre erreur de la base remonte telle quelle, jamais en faux conflit', async () => {
            const lignes = [contrat({ deviseRemuneration: null })];
            const { svc, update } = monterPersonnel([], lignes);
            const panne = new Error('connexion perdue');
            update.mockRejectedValueOnce(panne);
            await expect(svc.declarerDeviseRemuneration('t1', 'c-1', 'CDF')).rejects.toBe(panne);
        });
        it('une monnaie inconnue est refusée en français, aux deux portes', async () => {
            const complete = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(personnel_dto_1.DeviseRemunerationDto, { deviseRemuneration: 'EUR' }));
            expect(complete.find((e) => e.property === 'deviseRemuneration')?.constraints?.isEnum).toBe(personnel_dto_1.MOTIF_MONNAIE_REMUNERATION);
            const cree = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(personnel_dto_1.ContratTravailDto, {
                type: 'DUREE_INDETERMINEE',
                dateEntreeEnVigueur: '2026-01-05',
                deviseRemuneration: 'EUR',
            }));
            expect(cree.find((e) => e.property === 'deviseRemuneration')?.constraints?.isEnum).toBe(personnel_dto_1.MOTIF_MONNAIE_REMUNERATION);
            expect(await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(personnel_dto_1.DeviseRemunerationDto, { deviseRemuneration: 'USD' }))).toEqual([]);
        });
        it('un contrat d’un autre dossier n’existe pas', async () => {
            const lignes = [contrat({ tenantId: 't2', deviseRemuneration: null })];
            const { svc } = monterPersonnel([], lignes);
            await expect(svc.declarerDeviseRemuneration('t1', 'c-1', 'CDF')).rejects.toBeInstanceOf(common_1.NotFoundException);
            expect(lignes[0].deviseRemuneration).toBeNull();
        });
    });
    describe('la fin du contrat, au journal d’audit comme la monnaie', () => {
        it('écrit la date et le motif de fin par une opération UNITAIRE, bornée au dossier', async () => {
            const lignes = [contrat({ deviseRemuneration: 'CDF' })];
            const { svc, update, updateMany } = monterPersonnel([], lignes);
            const r = await svc.terminerContrat('t1', 'c-1', { dateFin: '2026-06-30', motifFin: ' Démission ' });
            expect(updateMany).not.toHaveBeenCalled();
            expect(update).toHaveBeenCalledTimes(1);
            expect(update.mock.calls[0][0]).toEqual({
                where: { id: 'c-1', tenantId: 't1' },
                data: { dateFin: new Date('2026-06-30'), motifFin: 'Démission' },
            });
            expect(lignes[0].dateFin).toEqual(new Date('2026-06-30'));
            expect(r).toMatchObject({ id: 'c-1', motifFin: 'Démission' });
        });
        it('un contrat d’un autre dossier n’est pas terminé', async () => {
            const lignes = [contrat({ tenantId: 't2' })];
            const { svc, update } = monterPersonnel([], lignes);
            await expect(svc.terminerContrat('t1', 'c-1', { dateFin: '2026-06-30' })).rejects.toBeInstanceOf(common_1.NotFoundException);
            expect(update).not.toHaveBeenCalled();
            expect(lignes[0].dateFin).toBeNull();
        });
    });
});
describe('F226, suite · la monnaie exigée à la création, les anciens contrats comptés', () => {
    const pipe = new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const passerAuPipe = (corps) => pipe.transform(corps, { type: 'body', metatype: personnel_dto_1.ContratTravailDto });
    const base = { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-05' };
    describe('à la porte, le corps de la requête', () => {
        it('refuse en 400 un montant sans monnaie, avec le motif nommé', async () => {
            for (const devise of [undefined, null]) {
                const refus = await passerAuPipe({ ...base, remunerationBase: 800, deviseRemuneration: devise }).catch((e) => e);
                expect(refus).toBeInstanceOf(common_1.BadRequestException);
                expect(refus.getStatus()).toBe(400);
                expect(refus.getResponse().message).toContain(regles_contrat_travail_1.MOTIF_MONNAIE_EXIGEE);
            }
        });
        it('un montant nul est un montant · la monnaie reste due', async () => {
            const refus = await passerAuPipe({ ...base, remunerationBase: 0 }).catch((e) => e);
            expect(refus).toBeInstanceOf(common_1.BadRequestException);
        });
        it('accepte un contrat sans rémunération, sans rien exiger', async () => {
            await expect(passerAuPipe({ ...base })).resolves.toBeInstanceOf(personnel_dto_1.ContratTravailDto);
        });
        it('accepte un montant avec sa monnaie, dans les deux monnaies', async () => {
            for (const devise of ['CDF', 'USD']) {
                await expect(passerAuPipe({ ...base, remunerationBase: 800, deviseRemuneration: devise })).resolves.toMatchObject({ remunerationBase: 800, deviseRemuneration: devise });
            }
        });
    });
    describe('au service, pour qui contournerait le corps', () => {
        it('refuse un montant sans monnaie avant toute lecture, et n’écrit rien', async () => {
            const { svc, create, salarieFindFirst } = monterPersonnel([salarie()]);
            const refus = await svc
                .creerContrat('t1', 'u-1', 's-1', { ...base, remunerationBase: 800 })
                .catch((e) => e);
            expect(refus).toBeInstanceOf(common_1.BadRequestException);
            expect(refus.message).toBe(regles_contrat_travail_1.MOTIF_MONNAIE_EXIGEE);
            expect(create).not.toHaveBeenCalled();
            expect(salarieFindFirst).not.toHaveBeenCalled();
        });
        it('écrit un contrat sans rémunération, et un montant avec sa monnaie', async () => {
            const { svc, create } = monterPersonnel([salarie()]);
            await svc.creerContrat('t1', 'u-1', 's-1', { ...base });
            await svc.creerContrat('t1', 'u-1', 's-1', { ...base, remunerationBase: 800, deviseRemuneration: 'USD' });
            expect(create).toHaveBeenCalledTimes(2);
            expect(create.mock.calls[1][0].data).toMatchObject({ remunerationBase: 800, deviseRemuneration: 'USD' });
        });
        it('la règle pure · due sur un montant, jamais sans montant', () => {
            expect((0, regles_contrat_travail_1.motifMonnaieExigee)(800, undefined)).toBe(regles_contrat_travail_1.MOTIF_MONNAIE_EXIGEE);
            expect((0, regles_contrat_travail_1.motifMonnaieExigee)(800, '')).toBe(regles_contrat_travail_1.MOTIF_MONNAIE_EXIGEE);
            expect((0, regles_contrat_travail_1.motifMonnaieExigee)(0, null)).toBe(regles_contrat_travail_1.MOTIF_MONNAIE_EXIGEE);
            expect((0, regles_contrat_travail_1.motifMonnaieExigee)(null, null)).toBeNull();
            expect((0, regles_contrat_travail_1.motifMonnaieExigee)(undefined, undefined)).toBeNull();
            expect((0, regles_contrat_travail_1.motifMonnaieExigee)(800, 'CDF')).toBeNull();
        });
    });
    describe('le registre compte les contrats à compléter', () => {
        const dossier = () => [
            salarie({ id: 's-a', nom: 'Amani', contrats: [contrat({ id: 'c-a', deviseRemuneration: null })] }),
            salarie({
                id: 's-b',
                nom: 'Bisimwa',
                actif: false,
                contrats: [contrat({ id: 'c-b', deviseRemuneration: null })],
            }),
            salarie({
                id: 's-c',
                nom: 'Chako',
                contrats: [
                    contrat({ id: 'c-c1', deviseRemuneration: 'CDF' }),
                    contrat({ id: 'c-c2', remunerationBase: null, deviseRemuneration: null }),
                ],
            }),
            salarie({ id: 's-x', tenantId: 't2', nom: 'Zola', contrats: [contrat({ id: 'c-x', tenantId: 't2', deviseRemuneration: null })] }),
        ];
        it('compte par la base, sur le dossier entier, inactifs compris', async () => {
            const { svc, contratCount } = monterPersonnel(dossier());
            const r = await svc.lister('t1');
            expect(r.contratsACompleter).toBe(2);
            expect(contratCount).toHaveBeenCalledWith({
                where: { tenantId: 't1', remunerationBase: { not: null }, deviseRemuneration: null },
            });
        });
        it('le filtre montre ces salariés-là et eux seuls, partis compris', async () => {
            const { svc } = monterPersonnel(dossier());
            const r = await svc.lister('t1', false, true);
            expect(r.salaries.map((s) => s.id)).toEqual(['s-a', 's-b']);
            expect(r.total).toBe(2);
            expect(r.contratsACompleter).toBe(2);
        });
        it('rien n’est rempli d’office · la lecture n’écrit aucune monnaie', async () => {
            const lignes = dossier();
            const { svc, update, updateMany } = monterPersonnel(lignes);
            await svc.lister('t1');
            await svc.confronter('t1', AUJOURDHUI);
            expect(update).not.toHaveBeenCalled();
            expect(updateMany).not.toHaveBeenCalled();
            expect(lignes[0].contrats[0].deviseRemuneration).toBeNull();
        });
    });
});
describe('F259 · le registre du personnel, une liste de travail bornée', () => {
    const registre = (n, over = () => ({})) => Array.from({ length: n }, (_, i) => salarie({ id: `s-${pad(i, 4)}`, nom: `S${pad(i, 4)}`, contrats: [], ...over(i) }));
    it('rend une tranche, et compte le registre ENTIER', async () => {
        const lignes = [...registre(personnel_service_1.PLAFOND_REGISTRE_PERSONNEL + 1), salarie({ id: 's-inactif', nom: 'Zola', actif: false, contrats: [] })];
        const { svc } = monterPersonnel(lignes);
        const r = await svc.lister('t1');
        expect(r.salaries).toHaveLength(personnel_service_1.PLAFOND_REGISTRE_PERSONNEL);
        expect(r.total).toBe(personnel_service_1.PLAFOND_REGISTRE_PERSONNEL + 1);
        expect(r.tronque).toBe(true);
        expect(r.plafond).toBe(personnel_service_1.PLAFOND_REGISTRE_PERSONNEL);
    });
    it('le total suit le même périmètre que la liste · les inactifs selon la case', async () => {
        const lignes = [...registre(2), salarie({ id: 's-inactif', nom: 'Zola', actif: false, contrats: [] })];
        const { svc } = monterPersonnel(lignes);
        const actifs = await svc.lister('t1');
        expect(actifs.total).toBe(2);
        expect(actifs.tronque).toBe(false);
        const tous = await svc.lister('t1', true);
        expect(tous.total).toBe(3);
        expect(tous.salaries).toHaveLength(3);
        expect(tous.tronque).toBe(false);
    });
    it('le contrat en cours et le nombre de contrats restent servis', async () => {
        const { svc } = monterPersonnel([salarie()]);
        const r = await svc.lister('t1');
        expect(r.salaries[0].contratEnCours).toMatchObject({ id: 'c-1' });
        expect(r.salaries[0].nombreContrats).toBe(1);
    });
    describe('la confrontation, lue par tranches', () => {
        const n = personnel_service_1.PLAFOND_CONFRONTATION + 1;
        const lignes = [
            ...Array.from({ length: n }, (_, i) => salarie({
                id: `s-${pad(9999 - i, 4)}`,
                nom: `S${pad(i, 4)}`,
                postNom: null,
                prenoms: null,
                contrats: [contrat({ id: `c-${pad(i, 4)}`, deviseRemuneration: 'CDF' })],
            })),
            salarie({ id: 's-0000', tenantId: 't2', nom: 'Autre dossier' }),
        ];
        it('rend les premières fiches dans l’ordre du nom, et le dit', async () => {
            const { svc } = monterPersonnel(lignes);
            const r = await svc.confronter('t1', AUJOURDHUI);
            expect(r.fiches).toHaveLength(personnel_service_1.PLAFOND_CONFRONTATION);
            expect(r.totalFiches).toBe(n);
            expect(r.tronque).toBe(true);
            expect(r.fiches[0].salarie).toBe('S0000');
            expect(r.fiches[personnel_service_1.PLAFOND_CONFRONTATION - 1].salarie).toBe(`S${pad(personnel_service_1.PLAFOND_CONFRONTATION - 1, 4)}`);
            expect(r.fiches.some((f) => f.salarie === `S${pad(n - 1, 4)}`)).toBe(false);
        });
        it('compte les signalements sur le registre ENTIER, pas sur la tranche', async () => {
            const { svc } = monterPersonnel(lignes);
            const r = await svc.confronter('t1', AUJOURDHUI);
            const f = r.fiches[0];
            const parFiche = f.mentionsManquantes.length +
                f.requalifications.length +
                f.declarations.filter((d) => d.enRetard).length +
                (f.remunerationMinimale.conforme === false ? 1 : 0);
            expect(parFiche).toBeGreaterThan(0);
            expect(r.totalSignalements).toBe(parFiche * n);
        });
        it('lit les salariés par lots bornés, chacun dans le dossier', async () => {
            const { svc, salarieFindMany } = monterPersonnel(lignes);
            await svc.confronter('t1', AUJOURDHUI);
            expect(salarieFindMany.mock.calls.length).toBe(Math.ceil(n / personnel_service_1.LOT_CONFRONTATION));
            for (const [args] of salarieFindMany.mock.calls) {
                expect(args?.where).toEqual({ tenantId: 't1' });
                expect(args?.take).toBe(personnel_service_1.LOT_CONFRONTATION);
            }
        });
        it('passe D2 · un apprentissage non visé relève de l’art. 21, jamais de l’art. 47', async () => {
            const { svc } = monterPersonnel([
                salarie({ contrats: [contrat({ type: 'APPRENTISSAGE', viseParOnem: false })] }),
            ]);
            const [f] = (await svc.confronter('t1', AUJOURDHUI)).fiches;
            expect(f.visaOnemManquant).toBe(false);
            expect(f.requalifications.map((r) => r.motif)).toContain('APPRENTISSAGE_NON_VISE');
            expect(f.mentionsManquantes).toEqual([]);
            const cdi = monterPersonnel([salarie({ contrats: [contrat({ viseParOnem: false })] })]);
            expect((await cdi.svc.confronter('t1', AUJOURDHUI)).fiches[0].visaOnemManquant).toBe(true);
        });
        it('passe D2 · les engagements d’un jour du registre font requalifier le vingt-troisième (art. 40 al. 2)', async () => {
            const jours = Array.from({ length: 22 }, (_, i) => {
                const d = new Date(Date.UTC(2026, 0, 12 + i));
                return contrat({ id: `j-${pad(i, 2)}`, type: 'JOUR_LE_JOUR', constateParEcrit: false, dateEntreeEnVigueur: d, dateFin: d });
            });
            const nouveau = contrat({
                id: 'j-99',
                type: 'JOUR_LE_JOUR',
                constateParEcrit: false,
                dateEntreeEnVigueur: new Date('2026-02-20T00:00:00Z'),
                dateFin: null,
            });
            const { svc } = monterPersonnel([salarie({ contrats: [...jours, nouveau] })]);
            const r = await svc.confronter('t1', AUJOURDHUI);
            const f = r.fiches.find((x) => x.contratId === 'j-99');
            expect(f.requalifications.map((x) => x.motif)).toEqual(['ENGAGEMENT_JOUR_LE_JOUR_REPETE']);
            expect(f.jourLeJourNonCompte).toBeNull();
            expect(r.fiches.find((x) => x.contratId === 'j-21').requalifications).toEqual([]);
            const flou = monterPersonnel([
                salarie({
                    contrats: [
                        contrat({ id: 'j-a', type: 'JOUR_LE_JOUR', constateParEcrit: false, dateEntreeEnVigueur: new Date('2026-02-01T00:00:00Z'), dateFin: new Date('2026-02-10T00:00:00Z') }),
                        nouveau,
                    ],
                }),
            ]);
            const g = (await flou.svc.confronter('t1', AUJOURDHUI)).fiches.find((x) => x.contratId === 'j-99');
            expect(g.jourLeJourNonCompte).toMatch(/article 40, alinéa 2 n'est pas examinée/);
        });
        it('une liste qui tient dans la borne n’est pas dite tronquée', async () => {
            const { svc } = monterPersonnel([salarie()]);
            const r = await svc.confronter('t1', AUJOURDHUI);
            expect(r.fiches).toHaveLength(1);
            expect(r.totalFiches).toBe(1);
            expect(r.tronque).toBe(false);
        });
    });
});
describe('F259, reste · les collections imbriquées d’une fiche, bornées et comptées', () => {
    const contrats = () => [
        contrat({ id: 'c-en-cours', dateEntreeEnVigueur: new Date(Date.UTC(2000, 0, 3)), dateFin: null }),
        ...Array.from({ length: 120 }, (_, i) => contrat({
            id: `c-${pad(i, 4)}`,
            dateEntreeEnVigueur: new Date(Date.UTC(2001 + Math.floor(i / 12), i % 12, 1)),
            dateFin: new Date(Date.UTC(2001 + Math.floor(i / 12), i % 12, 28)),
        })),
    ];
    const enfants = (n) => Array.from({ length: n }, (_, i) => enfant({ id: `e-${pad(i, 3)}`, prenoms: `E${pad(i, 3)}`, dateNaissance: new Date(Date.UTC(2000, 0, 1 + i)) }));
    it('les contrats · une tranche qui garde le contrat en cours, et le nombre compté par la base', async () => {
        const { svc } = monterPersonnel([salarie({ contrats: contrats() })]);
        const f = (await svc.lister('t1')).salaries[0];
        expect(f.contrats).toHaveLength(bornes_registre_1.PLAFOND_CONTRATS_PAR_FICHE);
        expect(f.contratEnCours).toMatchObject({ id: 'c-en-cours' });
        expect(f.nombreContrats).toBe(121);
        expect(f.contratsTronques).toBe(true);
        const ids = f.contrats.map((c) => c.id);
        expect(ids).toContain('c-0021');
        expect(ids).not.toContain('c-0020');
        expect(ids[0]).toBe('c-0119');
        expect(ids[ids.length - 1]).toBe('c-en-cours');
    });
    it('les enfants · une tranche, et le nombre compté par la base', async () => {
        const { svc } = monterPersonnel([salarie({ enfants: enfants(60) })]);
        const f = (await svc.lister('t1')).salaries[0];
        expect(f.enfants).toHaveLength(bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE);
        expect(f.nombreEnfants).toBe(60);
        expect(f.enfantsTronques).toBe(true);
        expect(f.enfants[0].id).toBe('e-000');
        expect(f.enfants.map((e) => e.id)).not.toContain('e-059');
    });
    it('sous la borne, rien ne change · tout est rendu, rien n’est dit tronqué', async () => {
        const deux = [
            contrat({ id: 'c-a', dateEntreeEnVigueur: new Date(Date.UTC(2024, 0, 1)), dateFin: new Date(Date.UTC(2025, 11, 31)) }),
            contrat({ id: 'c-b', dateEntreeEnVigueur: new Date(Date.UTC(2026, 0, 5)), dateFin: null }),
        ];
        const { svc } = monterPersonnel([salarie({ contrats: deux, enfants: enfants(3) })]);
        const f = (await svc.lister('t1')).salaries[0];
        expect(f.contrats.map((c) => c.id)).toEqual(['c-b', 'c-a']);
        expect(f.contratEnCours).toMatchObject({ id: 'c-b' });
        expect(f.nombreContrats).toBe(2);
        expect(f.contratsTronques).toBe(false);
        expect(f.enfants).toHaveLength(3);
        expect(f.nombreEnfants).toBe(3);
        expect(f.enfantsTronques).toBe(false);
    });
});
describe('F259, reste · la fiche se modifie par son identifiant, bornée au dossier', () => {
    const dto = (over = {}) => ({ nom: 'Mukendi', sexe: 'MASCULIN', nationalite: 'Belge', ...over });
    it('écrit par une opération UNITAIRE, jamais par `updateMany`', async () => {
        const lignes = [salarie({ enfants: [enfant()] })];
        const { svc, salarieUpdate, salarieUpdateMany, enfantDeleteMany } = monterPersonnel(lignes);
        const f = await svc.modifierSalarie('t1', 's-1', dto());
        expect(salarieUpdateMany).not.toHaveBeenCalled();
        expect(enfantDeleteMany).not.toHaveBeenCalled();
        expect(salarieUpdate).toHaveBeenCalledTimes(1);
        expect(salarieUpdate.mock.calls[0][0].where).toEqual({ id: 's-1', tenantId: 't1' });
        expect(lignes[0].nationalite).toBe('Belge');
        expect(f).toMatchObject({ id: 's-1', nationalite: 'Belge', nombreContrats: 1, nombreEnfants: 1 });
    });
    it('un salarié d’un autre dossier n’existe pas, et rien n’est écrit', async () => {
        const lignes = [salarie({ tenantId: 't2', enfants: [enfant({ tenantId: 't2' })] })];
        const { svc, salarieUpdate, salarieUpdateMany, enfantDelete, enfantCreate } = monterPersonnel(lignes);
        await expect(svc.modifierSalarie('t1', 's-1', dto({ enfants: [{ nom: 'Autre' }] }))).rejects.toBeInstanceOf(common_1.NotFoundException);
        expect(salarieUpdate).not.toHaveBeenCalled();
        expect(salarieUpdateMany).not.toHaveBeenCalled();
        expect(enfantDelete).not.toHaveBeenCalled();
        expect(enfantCreate).not.toHaveBeenCalled();
        expect(lignes[0].nationalite).toBe('Congolaise');
    });
    it('des enfants inchangés ne se réécrivent pas', async () => {
        const lignes = [salarie({ enfants: [enfant()] })];
        const { svc, enfantDelete, enfantCreate } = monterPersonnel(lignes);
        await svc.modifierSalarie('t1', 's-1', dto({ enfants: [{ nom: 'Mukendi', prenoms: 'Grâce', dateNaissance: '2015-06-01' }] }));
        expect(enfantDelete).not.toHaveBeenCalled();
        expect(enfantCreate).not.toHaveBeenCalled();
        expect(lignes[0].enfants.map((e) => e.id)).toEqual(['e-1']);
    });
    it('des enfants changés se remplacent un par un, chacun par son identifiant', async () => {
        const lignes = [salarie({ enfants: [enfant(), enfant({ id: 'e-2', prenoms: 'Paul' })] })];
        const { svc, enfantDelete, enfantCreate, enfantDeleteMany } = monterPersonnel(lignes);
        const f = await svc.modifierSalarie('t1', 's-1', dto({ enfants: [{ nom: 'Mukendi', prenoms: 'Grâce', dateNaissance: '2015-06-01' }, { nom: 'Mukendi', prenoms: 'Ruth' }] }));
        expect(enfantDeleteMany).not.toHaveBeenCalled();
        expect(enfantDelete.mock.calls.map(([a]) => a.where)).toEqual([
            { id: 'e-1', tenantId: 't1' },
            { id: 'e-2', tenantId: 't1' },
        ]);
        expect(enfantCreate.mock.calls.map(([a]) => a.data)).toEqual([
            { tenantId: 't1', salarieId: 's-1', nom: 'Mukendi', postNom: null, prenoms: 'Grâce', dateNaissance: new Date('2015-06-01') },
            { tenantId: 't1', salarieId: 's-1', nom: 'Mukendi', postNom: null, prenoms: 'Ruth', dateNaissance: null },
        ]);
        expect(f.nombreEnfants).toBe(2);
        expect(f.enfants.map((e) => e.prenoms).sort()).toEqual(['Grâce', 'Ruth']);
    });
    it('une fiche qui porte plus d’enfants que l’écran n’en montre ne se remplace pas', async () => {
        const lignes = [salarie({ enfants: Array.from({ length: bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE + 1 }, (_, i) => enfant({ id: `e-${pad(i, 3)}` })) })];
        const { svc, enfantDelete, enfantCreate, salarieUpdate } = monterPersonnel(lignes);
        await expect(svc.modifierSalarie('t1', 's-1', dto({ enfants: [{ nom: 'Seul' }] }))).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(enfantDelete).not.toHaveBeenCalled();
        expect(enfantCreate).not.toHaveBeenCalled();
        expect(salarieUpdate).not.toHaveBeenCalled();
        expect(lignes[0].enfants).toHaveLength(bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE + 1);
    });
    it('sans enfants dans la demande, les enfants ne sont pas même relus', async () => {
        const { svc, prisma } = monterPersonnel([salarie({ enfants: [enfant()] })]);
        await svc.modifierSalarie('t1', 's-1', dto());
        expect(prisma.enfantACharge.findMany).not.toHaveBeenCalled();
    });
    it('le corps de la requête ne porte pas plus d’enfants que la fiche n’en montre', async () => {
        const corps = (n) => (0, class_transformer_1.plainToInstance)(personnel_dto_1.SalarieDto, {
            nom: 'Mukendi',
            sexe: 'MASCULIN',
            enfants: Array.from({ length: n }, (_, i) => ({ nom: `E${i}` })),
        });
        const trop = (await (0, class_validator_1.validate)(corps(bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE + 1))).find((e) => e.property === 'enfants');
        expect(trop?.constraints?.arrayMaxSize).toContain(String(bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE));
        expect((await (0, class_validator_1.validate)(corps(bornes_registre_1.PLAFOND_ENFANTS_PAR_FICHE))).find((e) => e.property === 'enfants')).toBeUndefined();
    });
});
describe('F259, reste · la confrontation lit les grilles SMIG par une borne déclarée', () => {
    const AU = new Date('2046-06-15T10:00:00Z');
    const moisDe = (i) => {
        const d = new Date(Date.UTC(2026, 1 + i, 1));
        return d.toISOString().slice(0, 10);
    };
    const grille = (aPartirDu, smig, over = {}) => ({
        id: `v-${aPartirDu}`,
        tenantId: 't1',
        bareme: 'SMIG',
        aPartirDu,
        reference: `Arrêté ${aPartirDu}`,
        valeurs: { smigJournalierFc: smig },
        ...over,
    });
    const versions = () => [
        ...Array.from({ length: 245 }, (_, i) => grille(moisDe(i), 30_000 + i * 10)),
        grille('2046-09-01', 99_999),
        { id: 'v-onem', tenantId: 't1', bareme: 'ONEM', aPartirDu: '2026-03-01', reference: 'ONEM', valeurs: { taux: 0.01 } },
        grille('2030-01-01', 1, { id: 'v-autre', tenantId: 't2' }),
    ];
    const enFrancs = (over) => contrat({ deviseRemuneration: 'CDF', periodiciteRemuneration: 'MOIS', classeProfessionnelle: 1, remunerationBase: 1000, ...over });
    const contratsDuSalarie = () => [
        enFrancs({ id: 'c-janvier', dateEntreeEnVigueur: new Date(Date.UTC(2025, 6, 1)), dateFin: new Date(Date.UTC(2026, 0, 31)) }),
        enFrancs({ id: 'c-avril', dateEntreeEnVigueur: new Date(Date.UTC(2026, 1, 1)), dateFin: new Date(Date.UTC(2026, 3, 30)) }),
        enFrancs({ id: 'c-aout', dateEntreeEnVigueur: new Date(Date.UTC(2026, 4, 1)), dateFin: new Date(Date.UTC(2026, 7, 31)) }),
        enFrancs({ id: 'c-en-cours', dateEntreeEnVigueur: new Date(Date.UTC(2026, 8, 1)), dateFin: null }),
    ];
    const verdictDe = (r, id) => r.fiches.find((f) => f.contratId === id).remunerationMinimale;
    it('au-delà de la borne, s’abstient sur les seuls contrats qu’une grille non lue régirait', async () => {
        const { svc } = monterPersonnel([salarie({ contrats: contratsDuSalarie() })], [], versions());
        const r = await svc.confronter('t1', AU);
        const avril = verdictDe(r, 'c-avril');
        expect(avril.abstention).toBe('GRILLES_SMIG_NON_LUES');
        expect(avril.conforme).toBeNull();
        expect(avril.explication).toContain('2026-02');
        expect(avril.explication).toContain('2026-07');
        expect(verdictDe(r, 'c-janvier').minimumFc).toBe(21_500 * 26);
        expect(verdictDe(r, 'c-aout').minimumFc).toBe((30_000 + 6 * 10) * 26);
        expect(verdictDe(r, 'c-en-cours').minimumFc).toBe((30_000 + 244 * 10) * 26);
        expect(r.grillesSmig).toEqual({ lues: bornes_registre_1.PLAFOND_GRILLES_SMIG, total: 245, plafond: bornes_registre_1.PLAFOND_GRILLES_SMIG, tronque: true });
    });
    it('la requête est bornée, au dossier, au SMIG et au dernier mois qu’un contrat vise', async () => {
        const { svc, versionFindMany } = monterPersonnel([salarie({ contrats: contratsDuSalarie() })], [], versions());
        await svc.confronter('t1', AU);
        expect(versionFindMany).toHaveBeenCalledTimes(1);
        const args = versionFindMany.mock.calls[0][0];
        expect(args.take).toBe(bornes_registre_1.PLAFOND_GRILLES_SMIG);
        expect(args.where).toEqual({ tenantId: 't1', bareme: 'SMIG', aPartirDu: { lt: '2046-07-01' } });
        expect(args.orderBy).toEqual({ aPartirDu: 'desc' });
    });
    it('un contrat terminé APRÈS le mois courant recule la borne jusqu’à lui', async () => {
        const tardif = [enFrancs({ id: 'c-tardif', dateEntreeEnVigueur: new Date(Date.UTC(2046, 0, 1)), dateFin: new Date(Date.UTC(2046, 9, 31)) })];
        const { svc, versionFindMany } = monterPersonnel([salarie({ contrats: tardif })], [], versions());
        const r = await svc.confronter('t1', AU);
        expect(versionFindMany.mock.calls[0][0].where.aPartirDu).toEqual({ lt: '2046-11-01' });
        expect(verdictDe(r, 'c-tardif').minimumFc).toBe(99_999 * 26);
    });
    it('sous la borne, rien ne change · tout est lu, rien n’est dit tronqué', async () => {
        const trois = [grille('2026-02-01', 22_000), grille('2026-03-01', 23_000), grille('2026-04-01', 24_000)];
        const { svc } = monterPersonnel([salarie({ contrats: [enFrancs({ id: 'c-avril', dateFin: new Date(Date.UTC(2026, 3, 30)) })] })], [], trois);
        const r = await svc.confronter('t1', AU);
        expect(verdictDe(r, 'c-avril').minimumFc).toBe(24_000 * 26);
        expect(verdictDe(r, 'c-avril').abstention).toBeNull();
        expect(r.grillesSmig).toEqual({ lues: 3, total: 3, plafond: bornes_registre_1.PLAFOND_GRILLES_SMIG, tronque: false });
    });
});
describe('F259, reste · les enfants sans date de naissance, comptés par la base', () => {
    const situation = (r) => r.fiches[0].mentionsManquantes.find((m) => m.point === 'SITUATION_FAMILIALE');
    it('tous datés · aucun manque au point 7', async () => {
        const { svc } = monterPersonnel([salarie({ enfants: [enfant(), enfant({ id: 'e-2' }), enfant({ id: 'e-3' })] })]);
        expect(situation(await svc.confronter('t1', AUJOURDHUI))).toBeUndefined();
    });
    it('un seul sans date · le manque le compte, lui et lui seul', async () => {
        const { svc } = monterPersonnel([
            salarie({ enfants: [enfant(), enfant({ id: 'e-2', dateNaissance: null }), enfant({ id: 'e-3' })] }),
        ]);
        const m = situation(await svc.confronter('t1', AUJOURDHUI));
        expect(m?.motif.startsWith('1 enfant(s)')).toBe(true);
    });
});
describe('F259, reste · l’effectif, compté par la base', () => {
    const ALA = new Date('2026-06-30T00:00:00Z');
    const c = (id, over) => contrat({ id, dateEntreeEnVigueur: new Date('2026-01-05T00:00:00Z'), dateFin: null, ...over });
    const registre = () => [
        salarie({
            id: 's-a',
            nationalite: 'Congolaise',
            sexe: 'MASCULIN',
            contrats: [c('a-1', { type: 'DUREE_DETERMINEE' }), c('a-2', { type: 'DUREE_DETERMINEE' })],
        }),
        salarie({
            id: 's-b',
            nationalite: 'RDC ',
            sexe: 'FEMININ',
            contrats: [
                c('b-1', { type: 'DUREE_DETERMINEE', dateEntreeEnVigueur: new Date('2025-01-06T00:00:00Z'), dateFin: new Date('2025-12-31T00:00:00Z') }),
                c('b-2', { type: 'DUREE_INDETERMINEE' }),
            ],
        }),
        salarie({ id: 's-c', nationalite: 'Belge', contrats: [c('c-1', { dateFin: new Date('2026-03-31T00:00:00Z') })] }),
        salarie({ id: 's-d', contrats: [c('d-1', { dateEntreeEnVigueur: new Date('2026-09-01T00:00:00Z') })] }),
        salarie({ id: 's-e', tenantId: 't2', contrats: [c('e-1', { tenantId: 't2' })] }),
        salarie({ id: 's-f', nationalite: ' congolaise', sexe: 'MASCULIN', contrats: [c('f-1', { dateFin: ALA })] }),
        salarie({ id: 's-g', nationalite: 'Belge', sexe: 'FEMININ', contrats: [c('g-1', {})] }),
    ];
    it('une personne par salarié en vigueur, et les permanents par leur CDI', async () => {
        const { brut } = monterPersonnel(registre());
        const e = await (0, effectif_registre_1.effectifDuRegistre)(brut, 't1', ALA);
        expect(e).toMatchObject({ effectif: 4, hommes: 2, femmes: 2, permanents: 3, nationaux: 3, sansNationalite: 0 });
        expect(e.partMainOeuvreNationale).toBe(75);
        expect(e.reserve).toBeNull();
    });
    it('une nationalité manquante rend la part nulle, et le dit', async () => {
        const lignes = [...registre(), salarie({ id: 's-h', nationalite: null, contrats: [c('h-1', {})] })];
        const { brut } = monterPersonnel(lignes);
        const e = await (0, effectif_registre_1.effectifDuRegistre)(brut, 't1', ALA);
        expect(e.effectif).toBe(5);
        expect(e.sansNationalite).toBe(1);
        expect(e.partMainOeuvreNationale).toBeNull();
        expect(e.reserve).toContain('1 salarié(s)');
    });
});
describe('F259 · rubriques, bulletins modèles et avances, bornés', () => {
    function monter(tables) {
        const r = tables.rubriques ?? [];
        const m = tables.modeles ?? [];
        const a = tables.avances ?? [];
        return new avances_rubriques_service_1.AvancesRubriquesService({
            rubriquePaie: { findMany: lecture(r), count: compte(r) },
            modeleBulletin: { findMany: lecture(m), count: compte(m) },
            avanceSalaire: { findMany: lecture(a), count: compte(a) },
        });
    }
    const avance = (i, salarieId) => ({
        id: `a-${pad(i, 4)}`,
        tenantId: 't1',
        salarieId,
        salarie: { nom: 'Mukendi', postNom: null, prenoms: null, matricule: null },
        type: 'AVANCE',
        categoriePret: null,
        dateOctroi: new Date(Date.UTC(2026, 0, 1 + (i % 28))),
        montantFc: 100_000,
        retenueMensuelleFc: null,
        objet: 'Rentrée',
        pieceJustificative: 'Reconnaissance',
        retenues: [],
    });
    it('les avances · une tranche, et le total du périmètre demandé', async () => {
        const avances = [
            ...Array.from({ length: avances_rubriques_service_1.PLAFOND_LISTES_PAIE + 1 }, (_, i) => avance(i, 's1')),
            ...Array.from({ length: 3 }, (_, i) => avance(900 + i, 's2')),
        ];
        const s = monter({ avances });
        const tout = await s.listerAvances('t1');
        expect(tout.avances).toHaveLength(avances_rubriques_service_1.PLAFOND_LISTES_PAIE);
        expect(tout.total).toBe(avances_rubriques_service_1.PLAFOND_LISTES_PAIE + 4);
        expect(tout.tronque).toBe(true);
        const duSalarie = await s.listerAvances('t1', 's2');
        expect(duSalarie.avances).toHaveLength(3);
        expect(duSalarie.total).toBe(3);
        expect(duSalarie.tronque).toBe(false);
        expect(duSalarie.avances[0].soldeFc).toBe(100_000);
    });
    it('les rubriques · une tranche, les natures permises toujours servies', async () => {
        const rubriques = Array.from({ length: avances_rubriques_service_1.PLAFOND_LISTES_PAIE + 1 }, (_, i) => ({
            id: `r-${i}`,
            tenantId: 't1',
            code: `R${pad(i, 4)}`,
        }));
        const r = await monter({ rubriques }).listerRubriques('t1');
        expect(r.rubriques).toHaveLength(avances_rubriques_service_1.PLAFOND_LISTES_PAIE);
        expect(r.total).toBe(avances_rubriques_service_1.PLAFOND_LISTES_PAIE + 1);
        expect(r.tronque).toBe(true);
        expect(r.naturesPermises.length).toBeGreaterThan(0);
    });
    it('les bulletins modèles · une tranche qui le dit', async () => {
        const modeles = Array.from({ length: avances_rubriques_service_1.PLAFOND_LISTES_PAIE + 1 }, (_, i) => ({
            id: `m-${i}`,
            tenantId: 't1',
            nom: `M${pad(i, 4)}`,
        }));
        const r = await monter({ modeles }).listerModeles('t1');
        expect(r.modeles).toHaveLength(avances_rubriques_service_1.PLAFOND_LISTES_PAIE);
        expect(r.total).toBe(avances_rubriques_service_1.PLAFOND_LISTES_PAIE + 1);
        expect(r.tronque).toBe(true);
        const court = await monter({ modeles: modeles.slice(0, 2) }).listerModeles('t1');
        expect(court.tronque).toBe(false);
    });
});
describe('F227 · le refus de barème dit ce qui se saisit, SMIG compris', () => {
    it('nomme chaque barème servi parmi ceux qui se saisissent', () => {
        const motif = (0, baremes_dossier_1.motifRefusVersion)({ bareme: 'IRPP', aPartirDu: '2027-01-01', reference: 'Loi n° 99/2027', valeurs: {} }, []);
        expect(motif).toBe(baremes_dossier_1.MOTIF_BAREME_NON_SAISISSABLE);
        const seSaisit = baremes_dossier_1.MOTIF_BAREME_NON_SAISISSABLE.split(' · ')[0];
        for (const b of baremes_dossier_1.BAREMES_SERVIS)
            expect(seSaisit).toContain(b);
        expect(baremes_dossier_1.MOTIF_BAREME_NON_SAISISSABLE).toContain("barème de l'IRPP");
    });
    it('le corps de la requête reçoit le même refus, en français', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(personnel_dto_1.VersionBaremePaieDto, {
            bareme: 'IRPP',
            aPartirDu: '2027-01-01',
            reference: 'Loi n° 99/2027',
            valeurs: {},
        });
        const erreurs = await (0, class_validator_1.validate)(dto);
        const bareme = erreurs.find((e) => e.property === 'bareme');
        expect(bareme?.constraints?.isEnum).toBe(baremes_dossier_1.MOTIF_BAREME_NON_SAISISSABLE);
        const smig = (0, class_transformer_1.plainToInstance)(personnel_dto_1.VersionBaremePaieDto, {
            bareme: 'SMIG',
            aPartirDu: '2027-01-01',
            reference: 'Arrêté n° 99/2027',
            valeurs: { smigJournalierFc: 25_000 },
        });
        expect((await (0, class_validator_1.validate)(smig)).find((e) => e.property === 'bareme')).toBeUndefined();
    });
});
//# sourceMappingURL=registre-borne-et-devise.spec.js.map