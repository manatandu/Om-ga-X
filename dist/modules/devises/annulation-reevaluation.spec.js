"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const devises_service_1 = require("./devises.service");
const libre = { lettre: null, lettrageId: null, rapprochementId: null, compte: { numero: '65910000' } };
const provisionLignes = [libre, { ...libre, compte: { numero: '49910000' } }];
const ecr = (id, statut, exercice = client_1.StatutExercice.OUVERT, lignes = [libre, libre]) => ({
    id,
    statut,
    numeroPiece: 7,
    exercice: { statut: exercice },
    lignes,
});
function monter(p) {
    const reeval = {
        id: 'r1',
        tenantId: 't',
        exerciceId: 'ex',
        dateReevaluation: new Date('2026-12-31'),
        annuleeLe: p.annuleeLe ?? null,
        exercice: { statut: p.exercice ?? client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
        ecritureEcarts: p.ecarts === undefined ? ecr('ecarts', client_1.StatutEcriture.VALIDEE) : p.ecarts,
        ecritureProvision: p.provision === undefined ? ecr('prov', client_1.StatutEcriture.BROUILLARD, client_1.StatutExercice.OUVERT, provisionLignes) : p.provision,
        ecritureExtourne: p.extourne ?? null,
        contrePassationDeclareeId: p.declaree ? 'od' : null,
    };
    const tx = {
        reevaluation: {
            update: jest.fn().mockResolvedValue({ id: 'r1' }),
            findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'r1', annuleeLe: new Date() }),
        },
        ligneEcriture: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            findMany: jest.fn().mockResolvedValue([{ lettre: null, lettrageId: null, rapprochementId: null }]),
        },
        ecriture: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
        reevaluation: {
            findFirst: jest.fn(async ({ where }) => where.id ? reeval : (p.posterieure ?? null)),
        },
        provisionChangeOuverture: { findMany: jest.fn(async () => (p.versions ?? (p.version ? [p.version] : []))) },
        verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
        $transaction: jest.fn(async (fn) => fn(tx)),
    };
    const inscrire = jest.fn(async (_t, _u, id) => ({ id: `neg-${id}`, numeroPiece: 99, date: new Date('2026-12-31') }));
    const service = new devises_service_1.DevisesService(prisma, { inscrireEnNegatifPourAnnulation: inscrire });
    return { service, prisma, tx, inscrire };
}
describe('annuler une réévaluation des devises (D6)', () => {
    it('validée · inscrite en négatif ; au brouillard · supprimée ; l’enregistrement est MARQUÉ, jamais supprimé', async () => {
        const { service, tx, inscrire } = monter({});
        await service.annulerReevaluation('t', 'u', 'r1', 'Cours du 31/12 corrigé');
        expect(inscrire).toHaveBeenCalledTimes(1);
        expect(inscrire).toHaveBeenCalledWith('t', 'u', 'ecarts', 'Cours du 31/12 corrigé', tx);
        expect(tx.ecriture.deleteMany).toHaveBeenCalledWith({ where: { id: 'prov', tenantId: 't', statut: client_1.StatutEcriture.BROUILLARD } });
        expect(tx.ligneEcriture.deleteMany).toHaveBeenCalledWith({
            where: { ecritureId: 'prov', ecriture: { tenantId: 't', statut: client_1.StatutEcriture.BROUILLARD } },
        });
        expect(tx.ecriture.deleteMany).toHaveBeenCalledTimes(1);
        const marque = tx.reevaluation.update.mock.calls[0][0];
        expect(marque.where).toEqual({ id: 'r1', tenantId: 't', annuleeLe: null });
        expect(marque.data).toMatchObject({ annuleePar: 'u', motifAnnulation: 'Cours du 31/12 corrigé', annuleeLe: expect.any(Date) });
        expect(marque.data.annulation).toEqual([
            expect.objectContaining({ role: 'ECARTS', traitement: 'INSCRITE_EN_NEGATIF', negatifId: 'neg-ecarts' }),
            expect.objectContaining({ role: 'PROVISION', traitement: 'SUPPRIMEE' }),
        ]);
    });
    it('le brouillard validé PENDANT l’annulation · 409 nommé, rien n’est annulé (relecture sage-l6, mineur 8 · AUDCIF art. 22, 2°)', async () => {
        const { service, tx } = monter({});
        tx.ecriture.deleteMany.mockResolvedValueOnce({ count: 0 });
        await expect(service.annulerReevaluation('t', 'u', 'r1', 'motif')).rejects.toThrow(/L'écriture de provision n° .* a été validée ou retirée pendant l'annulation · rien n'est annulé/);
        expect(tx.reevaluation.findFirstOrThrow).not.toHaveBeenCalled();
    });
    it('avec la contre-passation en N+1 · elle est annulée aussi', async () => {
        const { service, inscrire } = monter({ extourne: ecr('ext', client_1.StatutEcriture.VALIDEE), provision: ecr('prov', client_1.StatutEcriture.VALIDEE) });
        await service.annulerReevaluation('t', 'u', 'r1', 'motif');
        expect(inscrire.mock.calls.map((c) => c[2])).toEqual(['ecarts', 'prov', 'ext']);
    });
    it('le motif est obligatoire', async () => {
        const { service } = monter({});
        await expect(service.annulerReevaluation('t', 'u', 'r1', '  ')).rejects.toThrow(/motif de l'annulation est obligatoire/);
    });
    it('refus nommés · exercice clôturé, contre-passation dans un exercice clos, déjà annulée', async () => {
        await expect(monter({ exercice: client_1.StatutExercice.CLOTURE }).service.annulerReevaluation('t', 'u', 'r1', 'm')).rejects.toThrow(/exercice de cette réévaluation est clôturé.*art\. 20, al\. 3/);
        await expect(monter({ extourne: ecr('ext', client_1.StatutEcriture.VALIDEE, client_1.StatutExercice.CLOTURE) }).service.annulerReevaluation('t', 'u', 'r1', 'm')).rejects.toThrow(/contre-passation .* exercice clôturé/);
        await expect(monter({ annuleeLe: new Date('2027-01-10') }).service.annulerReevaluation('t', 'u', 'r1', 'm')).rejects.toThrow(/déjà annulée/);
    });
    it('refus · une réévaluation postérieure non annulée, ou une version d’ouverture qui s’appuie sur celle-ci · rien n’est écrit', async () => {
        const posterieure = monter({ posterieure: { dateReevaluation: new Date('2027-12-31') } });
        await expect(posterieure.service.annulerReevaluation('t', 'u', 'r1', 'm')).rejects.toThrow(/2027-12-31, postérieure, n'est pas annulée/);
        expect(posterieure.prisma.$transaction).not.toHaveBeenCalled();
        const version = monter({ version: { compteProvision: '4991', dateReference: new Date('2027-01-01') } });
        await expect(version.service.annulerReevaluation('t', 'u', 'r1', 'm')).rejects.toThrow(/déclarée au 2027-01-01 \(compte 4991\) s’appuie/);
        expect(version.prisma.$transaction).not.toHaveBeenCalled();
    });
    it('A5 ter · l’issue du refus de version LÈVE le refus · retirer, jamais « une nouvelle version », et toutes nommées', async () => {
        const deux = monter({
            versions: [
                { compteProvision: '4991', dateReference: new Date('2027-01-01') },
                { compteProvision: '4991', dateReference: new Date('2028-01-01') },
            ],
        });
        const refus = deux.service.annulerReevaluation('t', 'u', 'r1', 'm');
        await expect(refus).rejects.toThrow(/au 2027-01-01 \(compte 4991\), au 2028-01-01 \(compte 4991\) s’appuient/);
        await expect(deux.service.annulerReevaluation('t', 'u', 'r1', 'm')).rejects.toThrow(/retirez-les \(Devises, « Dossier repris », « Retirer »\), annulez la réévaluation/);
        await expect(deux.service.annulerReevaluation('t', 'u', 'r1', 'm')).rejects.toThrow(/Une version nouvelle ne lève pas ce refus/);
        const litige = monter({ versions: [{ compteProvision: '599', dateReference: new Date('2027-01-01') }] });
        await litige.service.annulerReevaluation('t', 'u', 'r1', 'm');
        expect(litige.prisma.$transaction).toHaveBeenCalled();
        const sansProvision = monter({ provision: null, versions: [{ compteProvision: '4991', dateReference: new Date('2027-01-01') }] });
        await sansProvision.service.annulerReevaluation('t', 'u', 'r1', 'm');
        expect(sansProvision.prisma.$transaction).toHaveBeenCalled();
        const apres = monter({ versions: [] });
        await apres.service.annulerReevaluation('t', 'u', 'r1', 'm');
        expect(apres.prisma.$transaction).toHaveBeenCalled();
    });
    it('troisième tour · contre-passée À LA MAIN et déclarée · refus nommé, l’issue dite (retirer la déclaration, puis corriger l’écriture manuelle), rien écrit', async () => {
        const { service, prisma } = monter({ declaree: true });
        await expect(service.annulerReevaluation('t', 'u', 'r1', 'm')).rejects.toThrow(/contre-passée par une écriture manuelle déclarée · retirez la déclaration[\s\S]*inscription en négatif \(AUDCIF art\. 20, al\. 2\)/);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
    it('les lectures « la réévaluation de l’exercice » écartent les annulées · la réévaluation EXACTE peut suivre', () => {
        const { readFileSync } = jest.requireActual('node:fs');
        const { join } = jest.requireActual('node:path');
        const devises = readFileSync(join(__dirname, 'devises.service.ts'), 'utf8');
        const corps = (debut) => devises.slice(devises.indexOf(debut), devises.indexOf('\n  }\n', devises.indexOf(debut)));
        expect(corps('const dejaFaite = await this.prisma.reevaluation.findFirst({')).toContain('annuleeLe: null');
        expect(corps('private async reevaluationUtilisatrice(')).toContain('annuleeLe: null');
        expect(corps('private async motifRefusOrdre(')).toContain('annuleeLe: null');
        const ecritures = readFileSync(join(__dirname, '../comptabilite/ecriture.service.ts'), 'utf8');
        expect(ecritures).toContain("where: { tenantId, annuleeLe: null, OR: [{ ecritureEcartsId: ecritureId }");
        const a6 = readFileSync(join(__dirname, '../reglements/reevaluation-et-ecart-realise.ts'), 'utf8');
        expect(a6.split('annuleeLe: null').length - 1).toBe(2);
    });
    it('D5 · la réévaluation passée GARDE le cours retenu par devise', () => {
        const { readFileSync } = jest.requireActual('node:fs');
        const { join } = jest.requireActual('node:path');
        const devises = readFileSync(join(__dirname, 'devises.service.ts'), 'utf8');
        const creation = devises.slice(devises.indexOf('reevaluation = await this.prisma.reevaluation.create({'), devises.indexOf('} catch (e) {', devises.indexOf('reevaluation = await this.prisma.reevaluation.create({')));
        expect(creation).toContain('coursUtilises: rapport.coursUtilises');
    });
    it('une ligne lettrée ou pointée · refus nommé AVANT la transaction, issue « délettrer puis annuler »', async () => {
        const lettree = monter({
            ecarts: ecr('ecarts', client_1.StatutEcriture.VALIDEE, client_1.StatutExercice.OUVERT, [{ lettre: 'C', lettrageId: 'g', rapprochementId: null }, libre]),
            extourne: ecr('ext', client_1.StatutEcriture.BROUILLARD, client_1.StatutExercice.OUVERT, [{ lettre: 'C', lettrageId: 'g', rapprochementId: null }, libre]),
        });
        await expect(lettree.service.annulerReevaluation('t', 'u', 'r1', 'motif')).rejects.toThrow(/1 ligne\(s\) de l'écriture d'écarts n° 7 sont lettrées \(C\).*Délettrez-les d’abord, puis annulez la réévaluation/);
        expect(lettree.prisma.$transaction).not.toHaveBeenCalled();
        expect(lettree.inscrire).not.toHaveBeenCalled();
        const partielle = monter({ provision: ecr('prov', client_1.StatutEcriture.BROUILLARD, client_1.StatutExercice.OUVERT, [{ lettre: null, lettrageId: 'p', rapprochementId: null, compte: { numero: '49910000' } }]) });
        await expect(partielle.service.annulerReevaluation('t', 'u', 'r1', 'motif')).rejects.toThrow(/provision n° 7 sont lettrées \(lettrage partiel\)/);
        const pointee = monter({ ecarts: ecr('ecarts', client_1.StatutEcriture.VALIDEE, client_1.StatutExercice.OUVERT, [{ lettre: null, lettrageId: null, rapprochementId: 'r' }]) });
        await expect(pointee.service.annulerReevaluation('t', 'u', 'r1', 'motif')).rejects.toThrow(/pointées dans un rapprochement bancaire.*puis annulez la réévaluation/);
    });
    it('B1 · le refus est UNE règle, servie à la correction et à l’annulation', () => {
        const { readFileSync } = jest.requireActual('node:fs');
        const { join } = jest.requireActual('node:path');
        const ecritures = readFileSync(join(__dirname, '../comptabilite/ecriture.service.ts'), 'utf8');
        expect(ecritures).toContain("motifLignesTenues(e.lignes, 'cette écriture', 'corriger')");
        expect(ecritures).toContain('motifLignesTenues(origine.lignes,');
        expect(ecritures).not.toContain('sont pointées dans un rapprochement bancaire');
    });
    it('M2 · une annulation concurrente (P2025) · 409 nommé', async () => {
        const { Prisma } = jest.requireActual('@prisma/client');
        const { service, tx } = monter({});
        tx.reevaluation.update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('absente', { code: 'P2025', clientVersion: 'x' }));
        await expect(service.annulerReevaluation('t', 'u', 'r1', 'motif')).rejects.toMatchObject({ status: 409 });
    });
    it('un lettrage posé pendant le geste · relu dans la transaction, refus, ni négatif ni suppression', async () => {
        const { service, tx, inscrire } = monter({});
        tx.ligneEcriture.findMany.mockResolvedValueOnce([{ lettre: null, lettrageId: 'g', rapprochementId: null }]);
        await expect(service.annulerReevaluation('t', 'u', 'r1', 'motif')).rejects.toThrow(/sont lettrées \(lettrage partiel\)/);
        expect(inscrire).not.toHaveBeenCalled();
        expect(tx.ecriture.deleteMany).not.toHaveBeenCalled();
        expect(tx.reevaluation.update).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=annulation-reevaluation.spec.js.map