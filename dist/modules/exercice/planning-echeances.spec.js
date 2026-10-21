"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const exercice_service_1 = require("./exercice.service");
const planning_cloture_1 = require("./planning-cloture");
function service(statut, ecritures, dateFin = new Date('2027-12-31T00:00:00.000Z'), dossier = {}) {
    const exercice = { id: 'ex', tenantId: 't', dateDebut: new Date('2027-01-01T00:00:00.000Z'), dateFin, statut };
    const count = jest.fn(({ where }) => Promise.resolve(ecritures.filter((e) => ['statut', 'estANouveauProvisoire', 'estGenereeParCloture'].every((cle) => !(cle in where) || where[cle] === e[cle])).length));
    const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue(exercice) },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYSCOHADA,
                formeJuridique: null,
                formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
                droitEtranger: false,
                ...dossier,
            }),
        },
        ecriture: { count },
        transcriptionInventaire: { count: jest.fn().mockResolvedValue(0) },
        rapportActivite: { count: jest.fn().mockResolvedValue(0) },
        donation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new exercice_service_1.ExerciceService(prisma, {});
}
const brouillard = (o = {}) => ({
    statut: client_1.StatutEcriture.BROUILLARD,
    estANouveauProvisoire: false,
    estGenereeParCloture: false,
    ...o,
});
describe('F77 · le brouillard que le planning réclame', () => {
    it('un exercice clos dont seule la clôture est au brouillard n’a rien à valider', async () => {
        const p = await service(client_1.StatutExercice.CLOTURE, [brouillard({ estGenereeParCloture: true })]).planningCloture('t', 'ex');
        const j = p.jalons.find((x) => x.observation?.libelle.includes('brouillard'));
        expect(j?.observation).toEqual({ libelle: 'Aucune écriture au brouillard', satisfait: true });
    });
    it('le report provisoire ne se réclame pas non plus, mais une pièce ordinaire si', async () => {
        const p = await service(client_1.StatutExercice.OUVERT, [
            brouillard({ estANouveauProvisoire: true, estGenereeParCloture: true }),
            brouillard(),
        ]).planningCloture('t', 'ex');
        const j = p.jalons.find((x) => x.observation?.libelle.includes('brouillard'));
        expect(j?.observation?.libelle).toMatch(/^1 écriture\(s\) encore au brouillard/);
    });
    it('la clôture d’un exercice encore ouvert se valide · elle reste réclamée', async () => {
        const p = await service(client_1.StatutExercice.OUVERT, [brouillard({ estGenereeParCloture: true })]).planningCloture('t', 'ex');
        const j = p.jalons.find((x) => x.observation?.libelle.includes('brouillard'));
        expect(j?.observation?.satisfait).toBe(false);
    });
});
describe('F81 · une échéance se lit au jour, et l’échéance fiscale se reporte', () => {
    const aLInstant = async (iso) => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
        jest.setSystemTime(new Date(iso));
        try {
            return await service(client_1.StatutExercice.OUVERT, []).planningCloture('t', 'ex');
        }
        finally {
            jest.useRealTimers();
        }
    };
    const fiscal = (p) => p.jalons.find((j) => j.etape === 15);
    const nonFiscal = (p) => p.jalons.find((j) => j.etape === 16);
    it('reporte la déclaration fiscale au premier jour ouvrable, et elle seule', async () => {
        const p = await aLInstant('2028-04-20T10:00:00.000Z');
        expect(fiscal(p).echeance.toISOString().slice(0, 10)).toBe('2028-05-02');
        expect(nonFiscal(p).echeance.toISOString().slice(0, 10)).toBe('2028-04-30');
    });
    it('n’est pas en retard le jour même de l’échéance', async () => {
        expect(fiscal(await aLInstant('2028-05-02T10:00:00.000Z')).enRetard).toBe(false);
        expect(nonFiscal(await aLInstant('2028-04-30T12:00:00.000Z')).enRetard).toBe(false);
    });
    it('l’est au lendemain, et le lendemain se lit à Kinshasa', async () => {
        expect(nonFiscal(await aLInstant('2028-05-01T09:00:00.000Z')).enRetard).toBe(true);
        expect(fiscal(await aLInstant('2028-05-02T23:30:00.000Z')).enRetard).toBe(true);
        expect(fiscal(await aLInstant('2028-05-02T22:30:00.000Z')).enRetard).toBe(false);
    });
});
describe('O1a-D3 · le planning suit la forme de l’EXERCICE (AUSCGIE art. 182 et 183)', () => {
    it('une SARL devenue SA après la clôture de 2027 garde, pour 2027, les jalons de la SARL', async () => {
        const p = await service(client_1.StatutExercice.OUVERT, [], undefined, {
            formeJuridiqueSyscohadaAnterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            dateTransformationForme: new Date('2028-03-15T00:00:00.000Z'),
        }).planningCloture('t', 'ex');
        const attendus = (0, planning_cloture_1.jalonsApplicables)({
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridique: null,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            droitEtranger: false,
        });
        expect(p.formeJuridiqueSyscohada).toBe(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(p.jalons.map((j) => `${j.etape} ${j.libelle}`)).toEqual(attendus.map((j) => `${j.etape} ${j.libelle}`));
    });
});
describe('O1b G6 · le planning lit l’associé unique déclaré du dossier', () => {
    it('une SASU déclarée voit l’approbation par l’associé unique au jalon 23', async () => {
        const p = await service(client_1.StatutExercice.OUVERT, [], undefined, {
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
            associeUnique: true,
        }).planningCloture('t', 'ex');
        expect(p.jalons.find((j) => j.etape === 23)?.libelle).toBe('Approbation des comptes par l’associé unique');
    });
});
//# sourceMappingURL=planning-echeances.spec.js.map