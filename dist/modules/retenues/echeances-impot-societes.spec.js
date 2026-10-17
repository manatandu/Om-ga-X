"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const retenues_service_1 = require("./retenues.service");
const correspondance_retenues_1 = require("./correspondance-retenues");
const CLES_IS = ['declarationImpotSocietes', 'premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'];
function service(referentiel) {
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'e1',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel }) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
        ecriture: { findFirst: jest.fn().mockResolvedValue(null) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: {
            findMany: jest.fn().mockResolvedValue([{ premierExercice: 2026, nombreExercices: 3, refusDeProrogation: false }]),
        },
    };
    return new retenues_service_1.RetenuesService(prisma);
}
const echeances = async (referentiel, dateReference = '2026-01-15') => (await service(referentiel).echeancierFiscal('t1', { exerciceId: 'e1', dateReference })).echeances;
describe('Échéances de l’impôt sur les sociétés', () => {
    it('les quatre figurent à l’échéancier d’une société', async () => {
        const cles = (await echeances('SYSCOHADA')).map((e) => e.cle);
        for (const cle of CLES_IS)
            expect(cles).toContain(cle);
    });
    it('aucune n’est servie à une ASBL, que la loi en exempte', async () => {
        const cles = (await echeances('SYCEBNL')).map((e) => e.cle);
        for (const cle of CLES_IS)
            expect(cles).not.toContain(cle);
    });
    it('les acomptes tombent les 25 juillet, septembre et novembre · pas les 1er août, octobre et décembre', async () => {
        const parCle = new Map((await echeances('SYSCOHADA')).map((e) => [e.cle, e]));
        expect(parCle.get('premierAcompteIs').date.toISOString().slice(0, 10)).toBe('2026-07-25');
        expect(parCle.get('deuxiemeAcompteIs').date.toISOString().slice(0, 10)).toBe('2026-09-25');
        expect(parCle.get('troisiemeAcompteIs').date.toISOString().slice(0, 10)).toBe('2026-11-25');
    });
    it('la déclaration tombe le 30 avril', async () => {
        const d = (await echeances('SYSCOHADA')).find((e) => e.cle === 'declarationImpotSocietes');
        expect(d.date.toISOString().slice(0, 10)).toBe('2026-04-30');
    });
    it('une échéance passée bascule sur l’année suivante, sans disparaître', async () => {
        const parCle = new Map((await echeances('SYSCOHADA', '2026-12-01')).map((e) => [e.cle, e]));
        expect(parCle.get('premierAcompteIs').date.toISOString().slice(0, 10)).toBe('2027-07-26');
        expect(parCle.get('troisiemeAcompteIs').date.toISOString().slice(0, 10)).toBe('2027-11-25');
    });
    it('ce sont des DÉCLARATIONS sans montant · aucune ne se lit dans un solde de compte', async () => {
        for (const e of (await echeances('SYSCOHADA')).filter((x) => CLES_IS.includes(x.cle))) {
            expect(e.genre).toBe('DECLARATION');
            expect(e.montantDu).toBe(0);
            expect(e.contenu).toBeTruthy();
            expect(e.sourceDonnees).toBeTruthy();
        }
    });
    it('la base légale des acomptes nomme la loi de finances, sans inventer son numéro d’article', async () => {
        const a = (await echeances('SYSCOHADA')).find((e) => e.cle === 'premierAcompteIs');
        expect(a.baseLegale).toContain('57 bis');
        expect(a.baseLegale).toContain('25/060');
        expect(a.baseLegale).not.toMatch(/loi de finances[^.]*art(icle)?\.?\s*\d/i);
    });
    it('la table le dit aussi, hors de tout calcul de date', async () => {
        const syscohada = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)('SYSCOHADA').map((o) => o.cle);
        const sycebnl = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)('SYCEBNL').map((o) => o.cle);
        expect(CLES_IS.every((c) => syscohada.includes(c))).toBe(true);
        expect(CLES_IS.some((c) => sycebnl.includes(c))).toBe(false);
    });
});
describe('Calendrier de paiement de l’impôt · art. 57, al. 2 et 3', () => {
    const cles = (forme) => (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(client_1.Referentiel.SYSCOHADA, forme).map((o) => o.cle);
    const QUOTITES = ['premiereQuotitePetiteEntreprise', 'secondeQuotitePetiteEntreprise'];
    const ACOMPTES = ['premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'];
    it('NE SERT AUCUNE quotité à une personne morale · c’est l’impôt sur les sociétés', () => {
        for (const forme of [
            client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
        ]) {
            const servies = cles(forme);
            expect(servies).toEqual(expect.arrayContaining(ACOMPTES));
            expect(`${forme}: ${servies.filter((c) => QUOTITES.includes(c)).join(', ')}`).toBe(`${forme}: `);
        }
    });
    it('SERT les deux quotités à une personne physique · c’est le défaut corrigé', () => {
        for (const forme of [
            client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
            client_1.FormeJuridiqueSyscohada.ENTREPRENANT,
        ]) {
            const servies = cles(forme);
            expect(servies).toEqual(expect.arrayContaining(QUOTITES));
            expect(servies).toEqual(expect.arrayContaining(ACOMPTES));
        }
    });
    it('accompagne CHAQUE calendrier de sa condition quand la forme est physique', () => {
        const servies = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE);
        for (const cle of [...ACOMPTES, ...QUOTITES]) {
            const o = servies.find((x) => x.cle === cle);
            expect(`${cle}: ${o.reserve === null ? 'sans réserve' : 'avec réserve'}`).toBe(`${cle}: avec réserve`);
            expect(o.reserve).toMatch(/RÉGIME/);
        }
        expect(servies.find((x) => x.cle === 'premierAcompteIs').reserve).toContain('Résultat fiscal');
    });
    it('ne pose AUCUNE réserve à une personne morale, dont le régime est certain', () => {
        const servies = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        for (const cle of ACOMPTES)
            expect(servies.find((x) => x.cle === cle).reserve).toBeNull();
    });
    it('FORME NON RENSEIGNÉE · rien n’est retranché de ce qui était servi, rien n’est ajouté', () => {
        const servies = cles(null);
        expect(servies).toEqual(expect.arrayContaining(ACOMPTES));
        expect(servies.filter((c) => QUOTITES.includes(c))).toEqual([]);
    });
    it('date la première quotité au 31 janvier et la seconde au 30 avril, réserve du texte comprise', () => {
        const servies = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.ENTREPRENANT);
        const premiere = servies.find((o) => o.cle === 'premiereQuotitePetiteEntreprise');
        const seconde = servies.find((o) => o.cle === 'secondeQuotitePetiteEntreprise');
        expect([premiere.moisEcheance, premiere.jourEcheance]).toEqual([1, 31]);
        expect([seconde.moisEcheance, seconde.jourEcheance]).toEqual([4, 30]);
        expect(seconde.contenu).toContain('À CONFIRMER');
        expect(seconde.baseLegale).toContain('57 quater');
    });
});
describe('Procès-verbal de l’assemblée à la DGI (LPF art. 13 bis)', () => {
    it('compté depuis l’assemblée DÉCLARÉE sur l’exercice · dix jours, reportés au jour ouvrable', async () => {
        const svc = service('SYSCOHADA');
        const prisma = svc.prisma;
        prisma.exercice.findFirst.mockResolvedValue({
            id: 'e1',
            dateDebut: new Date('2026-01-01'),
            dateFin: new Date('2026-12-31'),
            dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
        });
        const pv = (await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' })).echeances.find((e) => e.cle === 'procesVerbalAssemblee');
        expect(pv.date.toISOString().slice(0, 10)).toBe('2027-03-30');
        expect(pv.echeance).toContain('assemblée déclarée tenue le 20/03/2027');
        const sans = (await echeances('SYSCOHADA', '2027-03-01')).find((e) => e.cle === 'procesVerbalAssemblee');
        expect(sans.date.toISOString().slice(0, 10)).toBe('2027-07-12');
    });
    it('ÉCHUE, elle n’est plus servie · le 07/10/2027, le 30/03/2027 cède la place à la prochaine occurrence', async () => {
        const svc = service('SYSCOHADA');
        const prisma = svc.prisma;
        prisma.exercice.findFirst.mockResolvedValue({
            id: 'e1',
            dateDebut: new Date('2026-01-01'),
            dateFin: new Date('2026-12-31'),
            dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
        });
        const pv = (await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-10-07' })).echeances.find((e) => e.cle === 'procesVerbalAssemblee');
        expect(pv.date.toISOString().slice(0, 10)).toBe('2028-07-10');
        expect(pv.echeance).not.toContain('assemblée déclarée');
        expect(pv.date.getTime()).toBeGreaterThanOrEqual(Date.UTC(2027, 9, 7));
    });
    it('entreprise du portefeuille sans assemblée déclarée · repère au 31 mars plus dix jours (10 avril), reporté', async () => {
        const svc = service('SYSCOHADA');
        const prisma = svc.prisma;
        prisma.tenant.findUniqueOrThrow.mockResolvedValue({
            referentiel: 'SYSCOHADA',
            formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
            entreprisePortefeuilleEtat: true,
        });
        const pv = (await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' })).echeances.find((e) => e.cle === 'procesVerbalAssemblee');
        expect(pv.date.toISOString().slice(0, 10)).toBe('2027-04-12');
        expect(pv.echeance).toContain('portefeuille de l’État');
        prisma.tenant.findUniqueOrThrow.mockResolvedValue({ referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_ANONYME', entreprisePortefeuilleEtat: false });
        const ordinaire = (await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' })).echeances.find((e) => e.cle === 'procesVerbalAssemblee');
        expect(ordinaire.date.toISOString().slice(0, 10)).toBe('2027-07-12');
    });
});
describe('Procès-verbal de la LPF art. 13 bis · seulement sous commissaire aux comptes', () => {
    const avecMandats = (mandats, tenant = { referentiel: 'SYSCOHADA' }) => {
        const svc = service('SYSCOHADA');
        const prisma = svc.prisma;
        prisma.mandatAuditeur.findMany.mockResolvedValue(mandats);
        prisma.tenant.findUniqueOrThrow.mockResolvedValue(tenant);
        return svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' });
    };
    it('aucun mandat, SARL · le procès-verbal n’est pas servi, et l’avertissement dit pourquoi', async () => {
        const r = await avecMandats([], { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
        expect(r.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
        expect(r.avertissements).toContain(retenues_service_1.AVERTISSEMENT_PV_SANS_COMMISSAIRE);
        expect(retenues_service_1.AVERTISSEMENT_PV_SANS_COMMISSAIRE).toContain('certifiés par les commissaires aux comptes');
        expect(r.echeances.find((e) => e.cle === 'declarationImpotSocietes')).toBeDefined();
    });
    it('aucun mandat, forme non renseignée · le procès-verbal reste servi « à confirmer » (la société peut être une SA)', async () => {
        const r = await avecMandats([]);
        const pv = r.echeances.find((e) => e.cle === 'procesVerbalAssemblee');
        expect(pv).toBeDefined();
        expect(pv.echeance).toContain(retenues_service_1.PV_A_CONFIRMER_SANS_FORME);
        expect(r.avertissements).not.toContain(retenues_service_1.AVERTISSEMENT_PV_SANS_COMMISSAIRE);
    });
    it('un mandat échu en 2025 ne couvre pas 2026, sauf prorogation de la SA (AUSCGIE art. 709)', async () => {
        const echu = [{ premierExercice: 2023, nombreExercices: 3, refusDeProrogation: false }];
        const sarl = await avecMandats(echu, { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' });
        expect(sarl.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
        const sa = await avecMandats(echu, { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
        expect(sa.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeDefined();
        expect(sa.avertissements).not.toContain(retenues_service_1.AVERTISSEMENT_PV_SANS_COMMISSAIRE);
        const refus = await avecMandats([{ ...echu[0], refusDeProrogation: true }], {
            referentiel: 'SYSCOHADA',
            formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
        });
        expect(refus.echeances.find((e) => e.cle === 'procesVerbalAssemblee')?.echeance).toContain(retenues_service_1.PV_A_CONFIRMER_SANS_MANDAT);
    });
    it('SA sans mandat enregistré · le commissaire existe par la loi (art. 694, 702), le procès-verbal reste servi « à confirmer »', async () => {
        const sa = await avecMandats([], { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_ANONYME' });
        const pv = sa.echeances.find((e) => e.cle === 'procesVerbalAssemblee');
        expect(pv?.echeance).toContain('à confirmer · mandat de commissaire non enregistré');
        expect(sa.avertissements).not.toContain(retenues_service_1.AVERTISSEMENT_PV_SANS_COMMISSAIRE);
        const couvert = await avecMandats([{ premierExercice: 2026, nombreExercices: 6, refusDeProrogation: false }], {
            referentiel: 'SYSCOHADA',
            formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
        });
        expect(couvert.echeances.find((e) => e.cle === 'procesVerbalAssemblee')?.echeance).not.toContain(retenues_service_1.PV_A_CONFIRMER_SANS_MANDAT);
    });
    it('un mandat terminé par anticipation couvre encore l’exercice clos avant sa fin, jamais celui clos après', async () => {
        const sarl = { referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE' };
        const mandat = { premierExercice: 2025, nombreExercices: 3, refusDeProrogation: false };
        const finApres = await avecMandats([{ ...mandat, finAnticipeeLe: new Date(Date.UTC(2027, 5, 30)) }], sarl);
        expect(finApres.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeDefined();
        const finAvant = await avecMandats([{ ...mandat, finAnticipeeLe: new Date(Date.UTC(2026, 5, 30)) }], sarl);
        expect(finAvant.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
        expect(finAvant.avertissements).toContain(retenues_service_1.AVERTISSEMENT_PV_SANS_COMMISSAIRE);
    });
    it('la forme de l’EXERCICE décide (formeApplicable) · une SARL devenue SA en 2027 reste lue SARL pour 2026', async () => {
        const r = await avecMandats([], {
            referentiel: 'SYSCOHADA',
            formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
            formeJuridiqueSyscohadaAnterieure: 'SOCIETE_RESPONSABILITE_LIMITEE',
            dateTransformationForme: new Date(Date.UTC(2027, 1, 1)),
        });
        expect(r.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
        expect(r.avertissements).toContain(retenues_service_1.AVERTISSEMENT_PV_SANS_COMMISSAIRE);
    });
    it('une association n’a ni procès-verbal ni avertissement · l’obligation ne la vise pas', async () => {
        const svc = service('SYCEBNL');
        const prisma = svc.prisma;
        prisma.mandatAuditeur.findMany.mockResolvedValue([]);
        const r = await svc.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2027-03-01' });
        expect(r.echeances.find((e) => e.cle === 'procesVerbalAssemblee')).toBeUndefined();
        expect(r.avertissements).not.toContain(retenues_service_1.AVERTISSEMENT_PV_SANS_COMMISSAIRE);
    });
});
describe('Échéancier d’une société dissoute', () => {
    function serviceDissoute() {
        const tenant = {
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            dateDissolution: new Date('2026-05-15'),
            dateClotureLiquidation: new Date('2026-09-10'),
            regimeLiquidation: 'AMIABLE_STATUTAIRE',
            associeUniquePersonneMorale: false,
            dateDeclarationCotisationActivite: null,
            dateDeclarationCotisationLiquidation: null,
        };
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-05-15') }) },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(tenant) },
            ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
            ecriture: { findFirst: jest.fn().mockResolvedValue(null) },
            compte: { findMany: jest.fn().mockResolvedValue([]) },
            mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return new retenues_service_1.RetenuesService(prisma);
    }
    it('ni déclaration annuelle de 2026, ni acompte après la dernière cotisation · les deux cotisations à leur place', async () => {
        const { echeances: liste } = await serviceDissoute().echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-06-01' });
        const parCle = new Map(liste.map((e) => [e.cle, e]));
        expect(parCle.has('declarationImpotSocietes')).toBe(false);
        expect(parCle.get('premierAcompteIs').reserve).toContain('57 bis');
        expect(parCle.has('deuxiemeAcompteIs')).toBe(true);
        expect(parCle.has('troisiemeAcompteIs')).toBe(false);
        const activite = parCle.get('cotisationSpecialeActivite');
        const liquidation = parCle.get('cotisationSpecialeLiquidation');
        expect([activite.periodicite, activite.genre]).toEqual(['PONCTUELLE', 'DECLARATION']);
        expect(activite.date.toISOString().slice(0, 10)).toBe('2026-06-15');
        expect(liquidation.date.toISOString().slice(0, 10)).toBe('2026-10-12');
    });
});
//# sourceMappingURL=echeances-impot-societes.spec.js.map