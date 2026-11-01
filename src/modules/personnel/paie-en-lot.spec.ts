import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import {
  corpsPropose,
  inppDuMois,
  joursPayesDuMois,
  lireParametresPaie,
  manquesDesParametres,
  motifsNonEmissible,
  REGIMES_SALARIAUX_DU_DOSSIER,
  type ParametresPaieDossier,
  type PropositionAbsences,
} from './paie-en-lot';
import { messageDe, PaieEnLotService } from './paie-en-lot.service';

/**
 * LIGNE PAIE-LOT · ce qui casserait en silence. Un paramètre absent lu comme
 * une valeur, une déclaration INPP appliquée à un mois qu'elle ne régit pas,
 * les jours payés d'un dossier pris pour ceux d'un salarié, un salaire repris
 * dans la mauvaise monnaie, un salaire plein un mois de congé, une allocation
 * de congé laissée de côté, un bulletin vide émis en lot.
 */
const RIEN: ParametresPaieDossier = { natureEmployeurInpp: null, effectifInpp: null, inppDepuisMois: null, regimeSalarial: null };
const TOUT: ParametresPaieDossier = { natureEmployeurInpp: 'PRIVE', effectifInpp: 12, inppDepuisMois: '2026-01', regimeSalarial: 'BAREME_ARTICLE_118' };
const CONTRAT_CDF = { classeProfessionnelle: 5, deviseRemuneration: 'CDF', periodiciteRemuneration: 'MOIS', remunerationBase: 800_000 };
const SANS_ABSENCE: PropositionAbsences = {
  salaireDesJoursDus: 800_000,
  joursDeuxTiers: 0,
  indemniteDeuxTiers: null,
  joursPayesAPlein: 26,
  joursDeConge: 0,
  baseDuMois: 26,
  motifs: [],
};

describe('paramètres de paie · jamais présumés', () => {
  it('une colonne vide ou hors liste se lit « pas encore dit »', () => {
    expect(lireParametresPaie({ paieNatureEmployeurInpp: null, paieEffectifInpp: null, paieInppDepuisMois: null, paieRegimeSalarial: 'AUTRE' })).toEqual(RIEN);
  });

  it('sans mois d’effet lisible, ni nature ni effectif ne se reprennent', () => {
    expect(lireParametresPaie({ paieNatureEmployeurInpp: 'PRIVE', paieEffectifInpp: 12, paieInppDepuisMois: null, paieRegimeSalarial: null })).toEqual(RIEN);
  });

  it('le personnel domestique n’est pas un régime du dossier (art. 121, al. 2)', () => {
    expect(REGIMES_SALARIAUX_DU_DOSSIER).toEqual(['BAREME_ARTICLE_118', 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE']);
    expect(lireParametresPaie({ paieNatureEmployeurInpp: null, paieEffectifInpp: null, paieInppDepuisMois: null, paieRegimeSalarial: 'FORFAIT_PERSONNEL_DOMESTIQUE' }).regimeSalarial).toBeNull();
  });

  it('la déclaration INPP ne vaut qu’à partir de son mois d’effet, et le dit', () => {
    const p = { ...TOUT, inppDepuisMois: '2027-01' };
    expect(inppDuMois(p, '2026-12')).toEqual({ natureEmployeurInpp: null, effectifInpp: null, anterieur: true });
    expect(inppDuMois(p, '2027-01')).toMatchObject({ natureEmployeurInpp: 'PRIVE', effectifInpp: 12 });
    expect(manquesDesParametres(p, '2026-12').join(' ')).toMatch(/à partir de 01\/2027 · rien n'est repris pour 12\/2026/);
    const r = corpsPropose({ moisDePaie: '2026-12', parametres: p, contrat: CONTRAT_CDF, absences: SANS_ABSENCE, conges: [] });
    expect(r.corps).not.toHaveProperty('natureEmployeurInpp');
    expect(r.corps).not.toHaveProperty('effectif');
    expect(r.reprise).toEqual({ natureEmployeurInpp: null, effectifInpp: null, inppDepuisMois: '2027-01', regimeSalarial: 'BAREME_ARTICLE_118', source: 'Déclaré au dossier' });
  });

  it('chaque manque est nommé · nature, effectif du privé seulement, régime', () => {
    expect(manquesDesParametres(RIEN, '2026-03')).toHaveLength(2);
    expect(manquesDesParametres({ ...RIEN, natureEmployeurInpp: 'PRIVE', inppDepuisMois: '2026-01' }, '2026-03').join(' ')).toMatch(/tranche INPP/);
    expect(manquesDesParametres({ ...RIEN, natureEmployeurInpp: 'PUBLIC', inppDepuisMois: '2026-01', regimeSalarial: 'BAREME_ARTICLE_118' }, '2026-03')).toEqual([]);
  });

  it('le corps ne porte que les paramètres déclarés · un null n’en fait jamais une valeur', () => {
    const { corps } = corpsPropose({ moisDePaie: '2026-03', parametres: RIEN, contrat: CONTRAT_CDF, absences: SANS_ABSENCE, conges: [] });
    expect(corps).not.toHaveProperty('natureEmployeurInpp');
    expect(corps).not.toHaveProperty('effectif');
    expect(corps).not.toHaveProperty('regimeSalarial');
    const plein = corpsPropose({ moisDePaie: '2026-03', parametres: TOUT, contrat: CONTRAT_CDF, absences: SANS_ABSENCE, conges: [] }).corps;
    expect(plein).toMatchObject({ natureEmployeurInpp: 'PRIVE', effectif: 12, regimeSalarial: 'BAREME_ARTICLE_118', classeProfessionnelle: 5 });
  });
});

describe('les jours payés sont ceux du salarié et du mois (B1)', () => {
  it('mois entier · rien n’est envoyé, le calcul prend vingt-six', () => {
    expect(joursPayesDuMois(SANS_ABSENCE)).toEqual({ jours: null, manque: null });
    expect(corpsPropose({ moisDePaie: '2026-03', parametres: TOUT, contrat: CONTRAT_CDF, absences: SANS_ABSENCE, conges: [] }).corps).not.toHaveProperty('joursPayes');
  });

  it('dix jours non dus · seize jours payés, pas vingt-six', () => {
    const a = { ...SANS_ABSENCE, salaireDesJoursDus: 492_307.69, joursPayesAPlein: 16 };
    const r = corpsPropose({ moisDePaie: '2026-03', parametres: TOUT, contrat: CONTRAT_CDF, absences: a, conges: [] });
    expect(r.corps.joursPayes).toBe(16);
  });

  it('les jours de congé payés par l’allocation comptent', () => {
    expect(joursPayesDuMois({ ...SANS_ABSENCE, joursPayesAPlein: 20, joursDeConge: 4 })).toEqual({ jours: 24, manque: null });
  });

  it('des jours aux deux tiers · rien n’est envoyé, et c’est dit', () => {
    const r = joursPayesDuMois({ ...SANS_ABSENCE, joursPayesAPlein: 20, joursDeuxTiers: 6, indemniteDeuxTiers: 1 });
    expect(r.jours).toBeNull();
    expect(r.manque).toMatch(/deux tiers/);
  });
});

describe('le salaire du contrat, premier élément, dans sa monnaie', () => {
  it('en francs · montantFc, sans stipulation', () => {
    const r = corpsPropose({ moisDePaie: '2026-03', parametres: TOUT, contrat: CONTRAT_CDF, absences: SANS_ABSENCE, conges: [] });
    expect(r.salaireRepris).toBe(true);
    expect(r.corps.deviseStipulation).toBeUndefined();
    expect(r.corps.elements[0]).toEqual({ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire du contrat', montantFc: 800_000 });
  });

  it('en dollars · montantUsd et stipulation USD, jamais des francs', () => {
    const r = corpsPropose({
      moisDePaie: '2026-03',
      parametres: TOUT,
      contrat: { ...CONTRAT_CDF, deviseRemuneration: 'USD', remunerationBase: 600 },
      absences: { ...SANS_ABSENCE, salaireDesJoursDus: 600 },
      conges: [],
    });
    expect(r.corps.deviseStipulation).toBe('USD');
    expect(r.corps.elements[0]).toEqual({ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire du contrat', montantUsd: 600 });
  });

  it('le salaire des jours dus et l’allocation portée, un mois de congé', () => {
    const r = corpsPropose({
      moisDePaie: '2026-03',
      parametres: TOUT,
      contrat: CONTRAT_CDF,
      absences: { ...SANS_ABSENCE, salaireDesJoursDus: 676_923.08, joursPayesAPlein: 22, joursDeConge: 4 },
      conges: [{ id: 'c1', devise: 'CDF', montant: 150_000, portePar: null }],
    });
    expect(r.corps.elements[0]).toMatchObject({ libelle: 'Salaire des jours dus', montantFc: 676_923.08 });
    expect(r.corps.allocationsConge).toEqual([{ congeId: 'c1' }]);
    expect(r.bloquants).toEqual([]);
  });

  it('rien n’est deviné · monnaie absente, périodicité au jour, proposition non chiffrée', () => {
    for (const cas of [
      { contrat: { ...CONTRAT_CDF, deviseRemuneration: null }, attendu: /Monnaie/ },
      { contrat: { ...CONTRAT_CDF, periodiciteRemuneration: 'JOUR' }, attendu: /au jour/ },
      { contrat: { ...CONTRAT_CDF, remunerationBase: null }, attendu: /rémunération de base/ },
    ]) {
      const r = corpsPropose({ moisDePaie: '2026-03', parametres: TOUT, contrat: cas.contrat, absences: SANS_ABSENCE, conges: [] });
      expect(r.salaireRepris).toBe(false);
      expect(r.corps.elements).toEqual([]);
      expect(r.manques.join(' ')).toMatch(cas.attendu);
    }
  });
});

describe('une allocation de congé qui ne se porte pas bloque la ligne (B2)', () => {
  it('non chiffrée ou d’une autre monnaie · NON émissible, motif nommé ; déjà portée · rien', () => {
    const r = corpsPropose({
      moisDePaie: '2026-03',
      parametres: TOUT,
      contrat: CONTRAT_CDF,
      absences: SANS_ABSENCE,
      conges: [
        { id: 'porte', devise: 'CDF', montant: 1, portePar: 7 },
        { id: 'nul', devise: 'CDF', montant: null, portePar: null },
        { id: 'usd', devise: 'USD', montant: 10, portePar: null },
      ],
    });
    expect(r.corps.allocationsConge).toBeUndefined();
    expect(r.bloquants).toHaveLength(2);
    expect(motifsNonEmissible(r.corps, [], r.bloquants)).toHaveLength(2);
  });
});

describe('le lot n’émet jamais un bulletin vide', () => {
  it('sans élément, non émissible même si la simulation ne refuse rien', () => {
    expect(motifsNonEmissible({ moisDePaie: '2026-03', elements: [] }, [])).toHaveLength(1);
    expect(motifsNonEmissible({ moisDePaie: '2026-03', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 's', montantFc: 1 }] }, [])).toEqual([]);
  });

  it('le refus d’un salarié garde son motif et ses détails', () => {
    expect(messageDe(new BadRequestException({ message: 'Bulletin non émis', motifs: ['INPP'] }))).toBe('Bulletin non émis · INPP');
  });

  it('la proposition n’écrit rien · aucune écriture Prisma hors la déclaration', () => {
    const source = fs.readFileSync(path.join(__dirname, 'paie-en-lot.service.ts'), 'utf8');
    const ecritures = source.match(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g) ?? [];
    expect(ecritures).toEqual(['.update(']);
    expect(source).toMatch(/this\.prisma\.tenant\.update\(\{ where: \{ id: tenantId \}/);
    // Du service du personnel, la simulation seule est appelée · l'émission
    // reste le geste unitaire, bulletin par bulletin.
    expect([...new Set(source.match(/this\.personnel\.\w+/g))]).toEqual(['this.personnel.simulerPaie']);
  });
});

describe('déclarer nature et effectif INPP exige le mois d’effet (M1)', () => {
  const service = (ecrit: unknown[]) =>
    new PaieEnLotService(
      {
        tenant: {
          update: async (a: { data: Record<string, unknown> }) => {
            ecrit.push(a.data);
            return { paieNatureEmployeurInpp: null, paieEffectifInpp: null, paieInppDepuisMois: null, paieRegimeSalarial: null, ...Object.fromEntries(Object.entries(a.data)) };
          },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );

  it('sans mois · refus nommé, rien d’écrit', async () => {
    const ecrit: unknown[] = [];
    await expect(service(ecrit).modifierParametres('t', { natureEmployeurInpp: 'PRIVE', effectifInpp: 12 })).rejects.toThrow(/mois d'effet/);
    expect(ecrit).toEqual([]);
  });

  it('avec mois · les trois ensemble ; tout effacé · le mois aussi', async () => {
    const ecrit: unknown[] = [];
    const r = await service(ecrit).modifierParametres('t', { natureEmployeurInpp: 'PRIVE', effectifInpp: 12, inppDepuisMois: '2026-12' });
    expect(r).toMatchObject({ natureEmployeurInpp: 'PRIVE', effectifInpp: 12, inppDepuisMois: '2026-12' });
    await service(ecrit).modifierParametres('t', { natureEmployeurInpp: null, effectifInpp: null });
    expect(ecrit[1]).toEqual({ paieNatureEmployeurInpp: null, paieEffectifInpp: null, paieInppDepuisMois: null });
  });
});
