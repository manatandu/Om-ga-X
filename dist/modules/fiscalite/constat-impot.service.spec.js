"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const constat_impot_service_1 = require("./constat-impot.service");
function monter(options) {
    const calcul = {
        formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE',
        regime: 'IMPOT_SOCIETES',
        impotDu: 180,
        minimumApplique: false,
        explication: 'x',
        dateFin: new Date('2026-12-31'),
        acomptesVerses: 160,
        acomptesAu4492: 160,
        impotConstateAu89: 0,
        impotExerciceAu89: 0,
        reintegrationsImpot: 0,
        ...options.calcul,
    };
    const comptes = { '89110000': 'c8911', '89500000': 'c895', '44100000': 'c441', '44920000': 'c4492', '89940000': 'c8994' };
    const prisma = {
        constatImpotResultat: {
            findFirst: jest.fn().mockResolvedValue(options.enPlace ?? null),
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation(async ({ data }) => {
                if (options.creationEchoue)
                    throw options.creationEchoue;
                return { id: 'constat', ...data };
            }),
        },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                statut: client_1.StatutExercice.OUVERT,
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        ecriture: { count: jest.fn().mockResolvedValue(options.brouillard ?? 0) },
        compte: {
            findFirst: jest.fn().mockImplementation(async ({ where }) => comptes[where.numero] ? { id: comptes[where.numero], typeCompte: client_1.TypeCompteDetailTotal.DETAIL, estActif: true } : null),
        },
        journal: {
            findFirst: jest.fn().mockImplementation(async ({ where }) => options.sansOd ? (where.code === 'OD' ? null : { id: 'jgen', code: 'GEN' }) : { id: 'jod', code: 'OD' }),
        },
        tenant: { findUnique: jest.fn().mockResolvedValue({ formeJuridiqueSyscohada: calcul.formeJuridiqueSyscohada }) },
    };
    const fiscalite = { resultatFiscal: jest.fn().mockResolvedValue(calcul), tenantSyscohada: jest.fn().mockResolvedValue({}) };
    const ecritures = {
        creer: jest.fn().mockResolvedValue({ id: 'e1', numeroPiece: 7 }),
        retirerCompensation: options.retraitEchoue
            ? jest.fn().mockRejectedValue(new Error('panne'))
            : jest.fn().mockResolvedValue(undefined),
    };
    const service = new constat_impot_service_1.ConstatImpotService(prisma, fiscalite, ecritures);
    return { service, prisma, fiscalite, ecritures };
}
describe('ConstatImpotService.passer', () => {
    it('rejoue l’impôt et passe D 8911 / C 441 au brouillard, datée de la fin d’exercice, sans acompte retranché', async () => {
        const { service, ecritures, prisma } = monter({});
        await service.passer('t', 'u', 'ex', {});
        const dto = ecritures.creer.mock.calls[0][2];
        expect(dto.date).toBe('2026-12-31');
        expect(dto.journalId).toBe('jod');
        expect(dto.lignes).toEqual([
            expect.objectContaining({ compteId: 'c8911', debit: 180 }),
            expect.objectContaining({ compteId: 'c441', credit: 180 }),
        ]);
        expect(prisma.constatImpotResultat.create.mock.calls[0][0].data).toMatchObject({ ecritureId: 'e1', minimumApplique: false });
        expect(Number(prisma.constatImpotResultat.create.mock.calls[0][0].data.montantImpot)).toBe(180);
    });
    it('un montant glissé dans le corps est ignoré · seul le calcul fait foi', async () => {
        const { service, ecritures } = monter({});
        await service.passer('t', 'u', 'ex', { montantImpot: 1 });
        expect(ecritures.creer.mock.calls[0][2].lignes[0].debit).toBe(180);
    });
    it('l’imputation demandée ajoute D 441 / C 4492 pour les acomptes', async () => {
        const { service, ecritures } = monter({});
        await service.passer('t', 'u', 'ex', { imputerAcomptes: true });
        const lignes = ecritures.creer.mock.calls[0][2].lignes;
        expect(lignes).toHaveLength(4);
        expect(lignes[3]).toMatchObject({ compteId: 'c4492', credit: 160 });
    });
    it('sans journal OD, le repli sur le premier journal général par code est DIT dans la réponse', async () => {
        const { service, prisma } = monter({ sansOd: true });
        const r = await service.passer('t', 'u', 'ex', {});
        expect(r.journal).toEqual({ code: 'GEN', repli: expect.stringMatching(/Aucun journal de code OD/) });
        const appelGeneral = prisma.journal.findFirst.mock.calls.find((c) => c[0].where.type === 'GENERAL')[0];
        expect(appelGeneral.orderBy).toEqual([{ code: 'asc' }, { id: 'asc' }]);
    });
    it('avec un journal OD, aucun repli annoncé', async () => {
        const { service } = monter({});
        const r = await service.passer('t', 'u', 'ex', {});
        expect(r.journal).toEqual({ code: 'OD', repli: null });
    });
    it('second clic dont le retrait échoue · le 409 nomme la pièce orpheline', async () => {
        const { service } = monter({
            creationEchoue: new client_1.Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
            retraitEchoue: true,
        });
        await expect(service.passer('t', 'u', 'ex', {})).rejects.toThrow(/pièce n° 7 [^]*n'a pas pu être retirée/);
    });
    it('l’impôt minimum retenu va au 895', async () => {
        const { service, ecritures } = monter({ calcul: { minimumApplique: true, impotDu: 50 } });
        await service.passer('t', 'u', 'ex', {});
        expect(ecritures.creer.mock.calls[0][2].lignes[0]).toMatchObject({ compteId: 'c895', debit: 50 });
    });
    it('un refus n’écrit rien (personne physique, impôt non chiffré, brouillard de gestion)', async () => {
        for (const cas of [
            monter({ calcul: { formeJuridiqueSyscohada: 'ENTREPRISE_INDIVIDUELLE' } }),
            monter({ calcul: { impotDu: null } }),
            monter({ brouillard: 1 }),
        ]) {
            await expect(cas.service.passer('t', 'u', 'ex', {})).rejects.toBeInstanceOf(common_1.BadRequestException);
            expect(cas.ecritures.creer).not.toHaveBeenCalled();
        }
    });
    it('un constat déjà en place refuse en 409, sans créer d’écriture', async () => {
        const { service, ecritures } = monter({ enPlace: { id: 'c', ecriture: { numeroPiece: 3 } } });
        await expect(service.passer('t', 'u', 'ex', {})).rejects.toBeInstanceOf(common_1.ConflictException);
        expect(ecritures.creer).not.toHaveBeenCalled();
    });
    it('second clic simultané · l’index unique refuse, l’écriture créée est retirée, 409', async () => {
        const p2002 = new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
        const { service, ecritures } = monter({ creationEchoue: p2002 });
        await expect(service.passer('t', 'u', 'ex', {})).rejects.toBeInstanceOf(common_1.ConflictException);
        expect(ecritures.retirerCompensation).toHaveBeenCalledWith('t', 'e1');
    });
});
describe('ConstatImpotService.etat', () => {
    it('sert la proposition sans exiger l’attestation à la lecture', async () => {
        const { service } = monter({ calcul: { formeJuridiqueSyscohada: 'SOCIETE_NOM_COLLECTIF' } });
        const etat = await service.etat('t', 'ex');
        expect(etat.motifsRefus).toEqual([]);
        expect(etat.proposition?.conditionADeclarer).toMatch(/art\. 4/);
    });
    it('constat en place · dit l’écart avec l’impôt recalculé, jamais corrigé', async () => {
        const { service } = monter({
            calcul: { impotDu: 200 },
            enPlace: {
                id: 'c',
                montantImpot: new client_1.Prisma.Decimal(180),
                minimumApplique: false,
                montantImpute: new client_1.Prisma.Decimal(0),
                attestationRegime: null,
                ecriture: { id: 'e1', numeroPiece: 7, statut: client_1.StatutEcriture.VALIDEE, date: new Date() },
                createdAt: new Date(),
            },
        });
        const etat = await service.etat('t', 'ex');
        expect(etat.constat?.ecartAvecCalcul).toBe(20);
        expect(etat.proposition).toBeNull();
    });
});
describe('ConstatImpotService.annuler', () => {
    it('passe la barrière SYSCOHADA comme lire et passer · refusée avant toute lecture du constat', async () => {
        const { service, fiscalite, prisma } = monter({});
        fiscalite.tenantSyscohada.mockRejectedValue(new common_1.BadRequestException('SYSCOHADA seul'));
        await expect(service.annuler('t', 'u', 'ex', { motif: 'erreur de base' })).rejects.toThrow(/SYSCOHADA seul/);
        expect(prisma.constatImpotResultat.findFirst).not.toHaveBeenCalled();
    });
    it('ne relit pas le régime · un constat passé reste annulable même si la forme a changé depuis', async () => {
        const { service, fiscalite } = monter({ calcul: { formeJuridiqueSyscohada: 'ENTREPRISE_INDIVIDUELLE', regime: 'IRPP' } });
        await expect(service.annuler('t', 'u', 'ex', { motif: 'erreur de base' })).rejects.toThrow(/Aucun impôt constaté/);
        expect(fiscalite.resultatFiscal).not.toHaveBeenCalled();
    });
});
describe('ConstatImpotService · exercice de liquidation', () => {
    const totalisation = (t) => ({
        bilansSuccessifs: { role: 'SECONDE_COTISATION', calculable: true, motif: null, totalisation: { minimumApplique: false, ...t } },
    });
    it('trop-payé · D 441 / C 8994 seuls, montant rejoué, figé sur le constat', async () => {
        const { service, ecritures, prisma } = monter({ calcul: { impotDu: 999, ...totalisation({ cotisationDeLExercice: 0, tropPayePremiereCotisation: 600_000 }) } });
        await service.passer('t', 'u', 'ex', {});
        const dto = ecritures.creer.mock.calls[0][2];
        expect(dto.lignes).toEqual([
            expect.objectContaining({ compteId: 'c441', debit: 600_000 }),
            expect.objectContaining({ compteId: 'c8994', credit: 600_000 }),
        ]);
        expect(dto.libelle).toMatch(/Trop-payé de la première cotisation/);
        const data = prisma.constatImpotResultat.create.mock.calls[0][0].data;
        expect(Number(data.montantImpot)).toBe(0);
        expect(Number(data.tropPayeLiquidation)).toBe(600_000);
    });
    it('seconde cotisation positive · le 891 reçoit l’impôt totalisé moins la première, pas l’impôt de la seule liquidation', async () => {
        const { service, ecritures } = monter({ calcul: { impotDu: 999, ...totalisation({ cotisationDeLExercice: 1_500_000, tropPayePremiereCotisation: 0 }) } });
        await service.passer('t', 'u', 'ex', {});
        expect(ecritures.creer.mock.calls[0][2].lignes[0]).toMatchObject({ compteId: 'c8911', debit: 1_500_000 });
    });
    it('totalisation non calculée · refus nommé, rien écrit', async () => {
        const { service, ecritures } = monter({
            calcul: { bilansSuccessifs: { role: 'SECONDE_COTISATION', calculable: false, motif: 'Aucun exercice n’est arrêté.', totalisation: null } },
        });
        await expect(service.passer('t', 'u', 'ex', {})).rejects.toThrow(/seconde cotisation spéciale.*Aucun exercice n’est arrêté/);
        expect(ecritures.creer).not.toHaveBeenCalled();
    });
    it('la proposition dit le trop-payé · lignes D 441 / C 8994, jamais un remboursement', async () => {
        const { service } = monter({ calcul: { ...totalisation({ cotisationDeLExercice: 0, tropPayePremiereCotisation: 600_000 }) } });
        const etat = await service.etat('t', 'ex');
        expect(etat.proposition).toMatchObject({ impot: 0, tropPaye: 600_000 });
        expect(etat.proposition.lignes.map((l) => l.numero)).toEqual(['44100000', '89940000']);
    });
});
//# sourceMappingURL=constat-impot.service.spec.js.map