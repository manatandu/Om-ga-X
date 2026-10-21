"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const rapprochement_service_1 = require("./rapprochement.service");
const rapprochement_controller_1 = require("./rapprochement.controller");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
function correspond(objet, filtre) {
    const o = (objet ?? {});
    return Object.entries(filtre).every(([cle, v]) => {
        if (cle === 'OR')
            return v.some((f) => correspond(o, f));
        if (cle === 'AND')
            return (Array.isArray(v) ? v : [v]).every((f) => correspond(o, f));
        if (cle === 'NOT')
            return !(Array.isArray(v) ? v : [v]).some((f) => correspond(o, f));
        const valeur = o[cle];
        if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
            const op = v;
            if (Array.isArray(valeur) && ('none' in op || 'some' in op)) {
                const touche = valeur.some((x) => correspond(x, (op.none ?? op.some)));
                return 'none' in op ? !touche : touche;
            }
            const operateurs = ['in', 'not', 'gte', 'lte', 'lt', 'gt'].filter((k) => k in op);
            if (operateurs.length === 0)
                return correspond(valeur, op);
            const n = (x) => (x instanceof Date ? x.getTime() : x);
            return operateurs.every((k) => {
                if (k === 'in')
                    return op.in.includes(valeur);
                if (k === 'not')
                    return valeur !== op.not;
                if (valeur === null || valeur === undefined)
                    return false;
                if (k === 'gte')
                    return n(valeur) >= n(op.gte);
                if (k === 'lte')
                    return n(valeur) <= n(op.lte);
                if (k === 'lt')
                    return n(valeur) < n(op.lt);
                return n(valeur) > n(op.gt);
            });
        }
        return valeur === v;
    });
}
const D = (s) => new Date(`${s}T00:00:00Z`);
const ecr = (exerciceId, date, aNouveau = false) => ({
    tenantId: 't1',
    exerciceId,
    date: D(date),
    statut: 'VALIDEE',
    estGenereeParCloture: aNouveau,
    estSoldeDesComptesDeGestion: false,
    reference: null,
    libelle: aNouveau ? 'Report à-nouveau' : 'Opération',
    journal: { code: aNouveau ? 'AN' : 'BQ' },
});
const ligne = (id, e, debit, credit = 0, rapprochementId = null) => ({
    id,
    compteId: '521',
    debit,
    credit,
    libelle: null,
    rapprochementId,
    ligneReleveId: null,
    ecriture: e,
});
const rap = (id, r) => ({
    id,
    tenantId: 't1',
    compteId: '521',
    statut: 'EN_COURS',
    soldeReleve: 0,
    dateReleve: D('2026-02-28'),
    clotureAt: null,
    soldeDepartDeclare: null,
    dateDepart: null,
    rouvertAt: null,
    ...r,
});
function monter(options) {
    const exercices = [
        { id: 'ex2026', tenantId: 't1', dateDebut: D('2026-01-01'), dateFin: D('2026-12-31'), statut: 'OUVERT' },
        { id: 'ex2025', tenantId: 't1', dateDebut: D('2025-01-01'), dateFin: D('2025-12-31'), statut: options.clotureExerciceStatut ?? 'OUVERT' },
    ];
    const rapprochements = options.rapprochements;
    const lignes = options.lignes ?? [
        ligne('bo', ecr('ex2025', '2025-01-01', true), 1000),
        ligne('l25', ecr('ex2025', '2025-06-10'), 300),
        ligne('chq', ecr('ex2025', '2025-12-28'), 0, 100),
        ligne('ran26', ecr('ex2026', '2026-01-01', true), 1200),
        ligne('l26', ecr('ex2026', '2026-02-10'), 200),
    ];
    const encours = options.encours ?? [];
    const trier = (liste, orderBy) => {
        if (!orderBy)
            return [...liste];
        const [cle, sens] = Object.entries(orderBy)[0];
        const v = (x) => (x[cle] instanceof Date ? x[cle].getTime() : x[cle] ?? 0);
        return [...liste].sort((a, b) => (sens === 'asc' ? v(a) - v(b) : v(b) - v(a)));
    };
    const choisir = (where) => lignes.filter((l) => correspond(l, where));
    const updateMany = jest.fn(async ({ where, data }) => {
        const touchees = choisir(where);
        touchees.forEach((l) => Object.assign(l, data));
        return { count: touchees.length };
    });
    const majEncours = jest.fn(async ({ where, data }) => {
        const touchees = encours.filter((e) => correspond(e, where));
        touchees.forEach((e) => Object.assign(e, data));
        return { count: touchees.length };
    });
    const majRapprochement = jest.fn(async ({ where, data }) => {
        const r = rapprochements.find((x) => x.id === where.id);
        Object.assign(r, data);
        return r;
    });
    const prisma = {
        rapprochementBancaire: {
            findFirst: jest.fn(async ({ where, orderBy }) => {
                return trier(rapprochements.filter((r) => correspond(r, where)), orderBy)[0] ?? null;
            }),
            update: majRapprochement,
            delete: jest.fn(async () => ({})),
        },
        exercice: {
            findFirst: jest.fn(async ({ where, orderBy }) => {
                return trier(exercices.filter((e) => correspond(e, where)), orderBy)[0] ?? null;
            }),
        },
        cloture: { findMany: jest.fn(async () => []) },
        journal: { findMany: jest.fn(async () => []) },
        ligneReleveBancaire: { findMany: jest.fn(async () => []) },
        ligneEcriture: {
            findMany: jest.fn(async ({ where, take }) => choisir(where).slice(0, take)),
            count: jest.fn(async ({ where }) => choisir(where).length),
            aggregate: jest.fn(async ({ where }) => {
                const l = choisir(where);
                return { _sum: { debit: l.reduce((s, x) => s + x.debit, 0), credit: l.reduce((s, x) => s + x.credit, 0) } };
            }),
            updateMany,
        },
        encoursOuvertureRapprochement: {
            findMany: jest.fn(async ({ where }) => encours.filter((e) => correspond(e, where))),
            findFirst: jest.fn(async ({ where }) => encours.find((e) => correspond(e, where)) ?? null),
            count: jest.fn(async ({ where }) => encours.filter((e) => correspond(e, where)).length),
            create: jest.fn(async ({ data }) => {
                const e = { ...data, id: `enc${encours.length}`, declareSur: { compteId: '521' }, pointeSurId: null, ligneReleveId: null };
                encours.push(e);
                return e;
            }),
            updateMany: majEncours,
            delete: jest.fn(async () => ({})),
        },
        $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    return { service: new rapprochement_service_1.RapprochementService(prisma), updateMany, majEncours, majRapprochement, lignes, encours };
}
const chq = (declareSurId = 'rap1', pointeSurId = null) => ({
    id: 'e-chq',
    tenantId: 't1',
    declareSurId,
    declareSur: { compteId: '521' },
    pointeSurId,
    ligneReleveId: null,
    libelle: 'Chèque 0042 non présenté',
    date: D('2025-12-28'),
    debit: 0,
    credit: 100,
});
const premier = (r = {}) => rap('rap1', { soldeReleve: 1400, soldeDepartDeclare: 1300, dateDepart: D('2026-01-01'), ...r });
describe('premier rapprochement · le solde de départ déclaré remplace le zéro', () => {
    it('le départ est le solde déclaré, et ce qui précède la date de départ est fondu', async () => {
        const { service } = monter({ rapprochements: [premier()], encours: [chq()] });
        const r = await service.obtenir('t1', 'rap1');
        expect(r.premier).toBe(true);
        expect(r.soldeDepart).toBe(1300);
        expect(r.lignes.map((l) => l.id)).toEqual(['l26']);
        expect(r.aNouveauEcartes).toBe(2);
        expect(r.fonduesDansLeDepart).toBe(2);
        expect(r.encours.map((e) => e.id)).toEqual(['e-chq']);
    });
    it('sans solde déclaré, il n’y a ni départ ni écart · jamais zéro', async () => {
        const { service } = monter({ rapprochements: [rap('rap1', { soldeReleve: 200 })] });
        const r = await service.obtenir('t1', 'rap1');
        expect([r.soldeDepart, r.soldePointe, r.ecart, r.equilibre]).toEqual([null, null, null, false]);
    });
    it('sans solde déclaré, la clôture est refusée même quand un départ à zéro « bouclerait »', async () => {
        const { service, majRapprochement } = monter({
            rapprochements: [rap('rap1', { soldeReleve: 200 })],
            lignes: [ligne('l26', ecr('ex2026', '2026-02-10'), 200, 0, 'rap1')],
        });
        await expect(service.cloturer('t1', 'rap1')).rejects.toThrow(/déclarez le solde de départ/);
        expect(majRapprochement).not.toHaveBeenCalled();
    });
    it('l’écart d’ouverture suit la formule · livre à la veille = départ + en-cours', async () => {
        const { service } = monter({ rapprochements: [premier()], encours: [chq()] });
        const r = await service.obtenir('t1', 'rap1');
        expect(r.ouverture).toMatchObject({ soldeLivre: 1200, soldeDepart: 1300, encours: -100, ecart: 0, motif: null });
        expect((0, rapprochement_service_1.ecartDOuverture)(1200, 1300, -100)).toBe(0);
        expect((0, rapprochement_service_1.ecartDOuverture)(1200, 1350, -100)).toBe(-50);
    });
    it('en-cours et opération pointés, l’écart est nul et la clôture passe', async () => {
        const { service, majRapprochement } = monter({ rapprochements: [premier()], encours: [chq()] });
        await service.pointerEncours('t1', 'rap1', ['e-chq']);
        await service.pointer('t1', 'rap1', ['l26']);
        const r = await service.obtenir('t1', 'rap1');
        expect([r.soldePointe, r.ecart, r.equilibre]).toEqual([1400, 0, true]);
        await service.cloturer('t1', 'rap1');
        expect(majRapprochement).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ statut: 'CLOTURE' }) }));
    });
    it('un écart d’ouverture non nul refuse la clôture, même quand le pointage boucle', async () => {
        const { service, majRapprochement } = monter({
            rapprochements: [premier({ soldeDepartDeclare: 1350, soldeReleve: 1450 })],
            encours: [chq('rap1', 'rap1')],
            lignes: [
                ligne('bo', ecr('ex2025', '2025-01-01', true), 1000),
                ligne('l25', ecr('ex2025', '2025-06-10'), 300),
                ligne('chq', ecr('ex2025', '2025-12-28'), 0, 100),
                ligne('l26', ecr('ex2026', '2026-02-10'), 200, 0, 'rap1'),
            ],
        });
        const r = await service.obtenir('t1', 'rap1');
        expect(r.equilibre).toBe(true);
        expect(r.ouverture?.ecart).toBe(-50);
        await expect(service.cloturer('t1', 'rap1')).rejects.toThrow(/écart d'ouverture n'est pas nul \(-50\.00\)/);
        expect(majRapprochement).not.toHaveBeenCalled();
    });
    it('le livre de la veille ne lit que le livre-journal, et un seul exercice', async () => {
        const { service } = monter({
            rapprochements: [premier()],
            encours: [chq()],
            lignes: [
                ligne('bo', ecr('ex2025', '2025-01-01', true), 1000),
                ligne('l25', ecr('ex2025', '2025-06-10'), 300),
                ligne('chq', ecr('ex2025', '2025-12-28'), 0, 100),
                ligne('brouillon', { ...ecr('ex2025', '2025-12-30'), statut: 'BROUILLARD' }, 999),
                ligne('ran26', ecr('ex2026', '2026-01-01', true), 1200),
            ],
        });
        expect((await service.obtenir('t1', 'rap1')).ouverture?.soldeLivre).toBe(1200);
    });
    it('au premier jour du premier exercice, le livre de la veille est l’à-nouveau de ce jour', async () => {
        const { service } = monter({
            rapprochements: [premier({ dateDepart: D('2025-01-01'), soldeDepartDeclare: 1000 })],
            lignes: [ligne('bo', ecr('ex2025', '2025-01-01', true), 1000), ligne('l25', ecr('ex2025', '2025-06-10'), 300)],
        });
        expect((await service.obtenir('t1', 'rap1')).ouverture).toMatchObject({ soldeLivre: 1000, ecart: 0 });
    });
});
describe('le premier rapprochement ne pointe aucun à-nouveau, premier exercice compris', () => {
    it('le bilan d’ouverture du premier exercice est refusé au pointage', async () => {
        const { service, updateMany } = monter({ rapprochements: [premier({ dateDepart: D('2025-01-01') })] });
        await expect(service.pointer('t1', 'rap1', ['bo'])).rejects.toThrow(/premier rapprochement part du solde de départ/);
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('une ligne antérieure à la date de départ est refusée · elle est fondue', async () => {
        const { service, updateMany } = monter({ rapprochements: [premier()] });
        await expect(service.pointer('t1', 'rap1', ['l25'])).rejects.toThrow(/fondue dans le solde de départ/);
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('une correspondance composée à la main sur l’à-nouveau est refusée', async () => {
        const { service, updateMany } = monter({ rapprochements: [premier()] });
        service.prisma.ligneReleveBancaire.findMany =
            jest.fn(async () => [{ id: 'r0', libelle: 'Relevé', debit: 0, credit: 1200, lignesEcriture: [], encoursOuverture: [] }]);
        await expect(service.confirmer('t1', 'rap1', { correspondances: [{ ligneReleveId: 'r0', ligneEcritureIds: ['ran26'] }] })).rejects.toThrow(/compterait l'ouverture deux fois/);
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('une correspondance peut ne réunir que des en-cours · le chèque passé en janvier', async () => {
        const { service, majEncours } = monter({ rapprochements: [premier()], encours: [chq()] });
        service.prisma.ligneReleveBancaire.findMany =
            jest.fn(async () => [{ id: 'r0', libelle: 'CHQ 0042', debit: 100, credit: 0, lignesEcriture: [], encoursOuverture: [] }]);
        await service.confirmer('t1', 'rap1', { correspondances: [{ ligneReleveId: 'r0', ligneEcritureIds: [], encoursIds: ['e-chq'] }] });
        expect(majEncours).toHaveBeenCalledWith(expect.objectContaining({ data: { pointeSurId: 'rap1', ligneReleveId: 'r0' } }));
    });
});
describe('déclarer l’ouverture', () => {
    it('refusé quand un rapprochement clos précède · son solde de relevé sert de départ', async () => {
        const { service } = monter({
            rapprochements: [
                rap('rap0', { statut: 'CLOTURE', soldeReleve: 1400, clotureAt: D('2026-03-05'), soldeDepartDeclare: 1300, dateDepart: D('2026-01-01') }),
                rap('rap1', { soldeReleve: 1600, dateReleve: D('2026-03-31') }),
            ],
        });
        await expect(service.declarerDepart('t1', 'rap1', { soldeDepart: 1400, dateDepart: '2026-03-01' })).rejects.toThrow(/Un rapprochement clos précède celui-ci/);
    });
    it('refusé quand une ligne pointée ici précède la nouvelle date', async () => {
        const lignes = [ligne('l26', ecr('ex2026', '2026-02-10'), 200, 0, 'rap1')];
        const { service, majRapprochement } = monter({ rapprochements: [rap('rap1', { soldeReleve: 200 })], lignes });
        await expect(service.declarerDepart('t1', 'rap1', { soldeDepart: 0, dateDepart: '2026-02-15' })).rejects.toThrow(/précèdent le 2026-02-15/);
        expect(majRapprochement).not.toHaveBeenCalled();
        await service.declarerDepart('t1', 'rap1', { soldeDepart: 0, dateDepart: '2026-02-01' });
        expect(majRapprochement).toHaveBeenCalledWith({
            where: { id: 'rap1' },
            data: { soldeDepartDeclare: 0, dateDepart: D('2026-02-01') },
        });
    });
    it('un en-cours se situe avant la date de départ, et il faut la connaître', async () => {
        const { service } = monter({ rapprochements: [rap('rap1', { soldeReleve: 200 })] });
        await expect(service.declarerEncours('t1', 'u', 'rap1', { libelle: 'Chèque', date: '2025-12-28', montant: 100, sens: 'CREDIT' })).rejects.toThrow(/Déclarez d'abord le solde de départ/);
        const deux = monter({ rapprochements: [premier()] });
        await expect(deux.service.declarerEncours('t1', 'u', 'rap1', { libelle: 'Chèque', date: '2026-01-01', montant: 100, sens: 'CREDIT' })).rejects.toThrow(/ne précède pas la date de départ/);
        const cree = await deux.service.declarerEncours('t1', 'u', 'rap1', { libelle: ' Chèque ', date: '2025-12-28', montant: 100, sens: 'CREDIT' });
        expect(cree).toMatchObject({ libelle: 'Chèque', debit: 0, credit: 100, declareSurId: 'rap1' });
    });
});
describe('les rapprochements suivants', () => {
    const chaine = () => monter({
        rapprochements: [
            rap('rap0', {
                statut: 'CLOTURE',
                soldeReleve: 1400,
                dateReleve: D('2026-02-28'),
                clotureAt: D('2026-03-05'),
                soldeDepartDeclare: 1300,
                dateDepart: D('2026-01-01'),
            }),
            rap('rap1', { soldeReleve: 1450, dateReleve: D('2026-03-31') }),
        ],
        encours: [{ ...chq('rap0'), id: 'e-2', libelle: 'Chèque 0043', credit: 50 }],
        lignes: [
            ligne('l25', ecr('ex2025', '2025-06-10'), 300),
            ligne('ran26', ecr('ex2026', '2026-01-01', true), 1200),
            ligne('l26', ecr('ex2026', '2026-02-10'), 200, 0, 'rap0'),
            ligne('l26b', ecr('ex2026', '2026-03-10'), 100),
        ],
    });
    it('partent du solde du relevé clos, gardent la date de départ de la tête, et voient les en-cours libres', async () => {
        const { service } = chaine();
        const r = await service.obtenir('t1', 'rap1');
        expect([r.premier, r.soldeDepart, r.ouverture]).toEqual([false, 1400, null]);
        expect(r.lignes.map((l) => l.id)).toEqual(['l26b']);
        expect(r.fonduesDansLeDepart).toBe(1);
        expect(r.encours.map((e) => e.id)).toEqual(['e-2']);
        await service.pointerEncours('t1', 'rap1', ['e-2']);
        await service.pointer('t1', 'rap1', ['l26b']);
        const apres = await service.obtenir('t1', 'rap1');
        expect([apres.soldePointe, apres.equilibre]).toEqual([1450, true]);
    });
    it('une chaîne d’avant la règle ne fond rien · sa tête n’a pas de date de départ', async () => {
        const { service } = monter({
            rapprochements: [
                rap('rap0', { statut: 'CLOTURE', soldeReleve: 1300, clotureAt: D('2026-01-10'), dateReleve: D('2025-12-31') }),
                rap('rap1', { soldeReleve: 1500 }),
            ],
            lignes: [ligne('l25', ecr('ex2025', '2025-06-10'), 300), ligne('l26', ecr('ex2026', '2026-02-10'), 200)],
        });
        const r = await service.obtenir('t1', 'rap1');
        expect(r.lignes.map((l) => l.id)).toEqual(['l25', 'l26']);
        expect(r.fonduesDansLeDepart).toBe(0);
    });
});
describe('réouverture · le dernier rapprochement clos, par l’administrateur, motif à l’appui', () => {
    const deuxClos = (statutExercice = 'OUVERT') => monter({
        clotureExerciceStatut: statutExercice,
        rapprochements: [
            rap('rap0', { statut: 'CLOTURE', soldeReleve: 1400, dateReleve: D('2025-11-30'), clotureAt: D('2025-12-05'), soldeDepartDeclare: 1300, dateDepart: D('2025-11-01') }),
            rap('rap1', { statut: 'CLOTURE', soldeReleve: 1450, dateReleve: D('2025-12-31'), clotureAt: D('2026-01-05') }),
        ],
    });
    it('un rapprochement qui n’est pas le dernier ne se rouvre pas', async () => {
        const { service, majRapprochement } = deuxClos();
        await expect(service.rouvrir('t1', 'u', 'rap0', 'À-nouveau pointé')).rejects.toThrow(/Seul le dernier rapprochement clos/);
        expect(majRapprochement).not.toHaveBeenCalled();
    });
    it('le motif est obligatoire', async () => {
        const { service, majRapprochement } = deuxClos();
        await expect(service.rouvrir('t1', 'u', 'rap1', '   ')).rejects.toThrow(/motif de la réouverture est obligatoire/);
        expect(majRapprochement).not.toHaveBeenCalled();
    });
    it('le dernier se rouvre, et le motif reste sur la ligne', async () => {
        const { service, majRapprochement } = deuxClos();
        await service.rouvrir('t1', 'u', 'rap1', ' À-nouveau pointé avant la règle ');
        expect(majRapprochement).toHaveBeenCalledWith({
            where: { id: 'rap1' },
            data: expect.objectContaining({ statut: 'EN_COURS', clotureAt: null, rouvertBy: 'u', motifReouverture: 'À-nouveau pointé avant la règle' }),
        });
    });
    it('une réouverture ne franchit pas un exercice clôturé', async () => {
        const { service, majRapprochement } = deuxClos('CLOTURE');
        await expect(service.rouvrir('t1', 'u', 'rap1', 'Motif')).rejects.toThrow(/exercice est clôturé/);
        expect(majRapprochement).not.toHaveBeenCalled();
    });
    it('un rapprochement en cours sur le compte bloque la réouverture', async () => {
        const { service } = monter({
            rapprochements: [
                rap('rap0', { statut: 'CLOTURE', soldeReleve: 1400, dateReleve: D('2026-02-28'), clotureAt: D('2026-03-05') }),
                rap('rap1', { soldeReleve: 1500, dateReleve: D('2026-03-31') }),
            ],
        });
        await expect(service.rouvrir('t1', 'u', 'rap0', 'Motif')).rejects.toThrow(/en cours sur ce compte/);
    });
    it('un rapprochement rouvert ne s’annule pas', async () => {
        const { service } = monter({ rapprochements: [premier({ rouvertAt: D('2026-03-10') })] });
        await expect(service.annuler('t1', 'rap1')).rejects.toThrow(/il se reclôt/);
    });
    it('la route est réservée à l’administrateur', () => {
        const roles = Reflect.getMetadata(roles_decorator_1.ROLES_KEY, rapprochement_controller_1.RapprochementController.prototype.rouvrir);
        expect(roles).toEqual([client_1.RoleUtilisateur.ADMIN_CABINET]);
    });
});
describe('la règle, sous ses deux formes, dit la même chose', () => {
    const cas = [
        { nom: 'opération', e: { estGenereeParCloture: false, estSoldeDesComptesDeGestion: false, date: D('2026-02-10') } },
        { nom: 'opération antérieure au départ', e: { estGenereeParCloture: false, estSoldeDesComptesDeGestion: false, date: D('2025-06-10') } },
        { nom: 'à-nouveau du premier exercice', e: { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false, date: D('2025-01-01') } },
        { nom: 'à-nouveau d’un exercice suivant', e: { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false, date: D('2026-01-01') } },
        { nom: 'écriture qui solde la gestion', e: { estGenereeParCloture: true, estSoldeDesComptesDeGestion: true, date: D('2026-12-31') } },
    ];
    const regles = [
        { ancre: true, dateDepart: D('2026-01-01') },
        { ancre: false, dateDepart: null },
    ];
    it.each(regles)('règle %o · prédicat et filtre concordent', (regle) => {
        for (const c of cas) {
            expect([c.nom, (0, rapprochement_service_1.estEcarteeDuPointage)(c.e, regle)]).toEqual([c.nom, correspond(c.e, (0, rapprochement_service_1.filtreEcarteDuPointage)(regle))]);
        }
    });
    it('les verdicts attendus · aucun à-nouveau, jamais', () => {
        const [avecDate, sansDate] = regles;
        expect(cas.map((c) => (0, rapprochement_service_1.estEcarteeDuPointage)(c.e, avecDate))).toEqual([false, true, true, true, false]);
        expect(cas.map((c) => (0, rapprochement_service_1.estEcarteeDuPointage)(c.e, sansDate))).toEqual([false, false, true, true, false]);
    });
    it('un à-nouveau pointé en trop, à sa place dans la chaîne', () => {
        const bo = { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false, exerciceId: 'ex1' };
        const ran = { ...bo, exerciceId: 'ex2' };
        expect((0, rapprochement_service_1.aNouveauEnTrop)(bo, { ancre: false, departDeclare: false, premierExerciceId: 'ex1' })).toBe(false);
        expect((0, rapprochement_service_1.aNouveauEnTrop)(ran, { ancre: false, departDeclare: false, premierExerciceId: 'ex1' })).toBe(true);
        expect((0, rapprochement_service_1.aNouveauEnTrop)(bo, { ancre: false, departDeclare: true, premierExerciceId: 'ex1' })).toBe(true);
        expect((0, rapprochement_service_1.aNouveauEnTrop)(bo, { ancre: true, departDeclare: false, premierExerciceId: 'ex1' })).toBe(true);
    });
});
describe('la proposition lit la règle dans sa requête', () => {
    it('le filtre des candidates écarte en base ce que la chaîne ne pointe pas', () => {
        const src = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'rapprochement.service.ts'), 'utf8');
        const debut = src.indexOf('  async proposer(');
        const fin = src.indexOf('\n  async ', debut + 5);
        expect(src.slice(debut, fin)).toContain('NOT: filtreEcarteDuPointage(regle),');
    });
});
//# sourceMappingURL=a-nouveau-rapprochement.spec.js.map