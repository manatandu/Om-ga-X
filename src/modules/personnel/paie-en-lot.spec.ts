import * as fs from 'fs';
import * as path from 'path';
import { corpsPropose, lireParametresPaie, manquesDesParametres, motifsNonEmissible, type ParametresPaieDossier } from './paie-en-lot';
import { messageDe } from './paie-en-lot.service';
import { BadRequestException } from '@nestjs/common';

/**
 * LIGNE PAIE-LOT · ce qui casserait en silence. Un paramètre absent lu comme
 * une valeur, un salaire repris dans la mauvaise monnaie, un salaire plein
 * repris un mois de congé, un bulletin vide émis en lot.
 */
const RIEN: ParametresPaieDossier = { natureEmployeurInpp: null, regimeSalarial: null, effectifInpp: null, joursPayes: null };
const TOUT: ParametresPaieDossier = { natureEmployeurInpp: 'PRIVE', regimeSalarial: 'BAREME_ARTICLE_118', effectifInpp: 12, joursPayes: 26 };
const CONTRAT_CDF = { classeProfessionnelle: 5, deviseRemuneration: 'CDF', periodiciteRemuneration: 'MOIS', remunerationBase: 800_000 };
const SANS_ABSENCE = { salaireDesJoursDus: 800_000, joursDeuxTiers: 0, indemniteDeuxTiers: null, motifs: [] };

describe('paramètres de paie · jamais présumés', () => {
  it('une colonne vide ou hors liste se lit « pas encore dit »', () => {
    expect(lireParametresPaie({ paieNatureEmployeurInpp: null, paieRegimeSalarial: 'AUTRE', paieEffectifInpp: null, paieJoursPayes: null })).toEqual(RIEN);
  });

  it('chaque manque est nommé · nature, effectif du privé seulement, régime', () => {
    expect(manquesDesParametres(RIEN)).toHaveLength(2);
    expect(manquesDesParametres({ ...RIEN, natureEmployeurInpp: 'PRIVE' }).join(' ')).toMatch(/tranche INPP/);
    // Le public n'a pas de tranche d'effectif · aucun manque pour lui.
    expect(manquesDesParametres({ ...RIEN, natureEmployeurInpp: 'PUBLIC', regimeSalarial: 'BAREME_ARTICLE_118' })).toEqual([]);
  });

  it('le corps ne porte que les paramètres déclarés · un null n’en fait jamais une valeur', () => {
    const { corps } = corpsPropose({ moisDePaie: '2026-03', parametres: RIEN, contrat: CONTRAT_CDF, absences: SANS_ABSENCE, conges: [] });
    expect(corps).not.toHaveProperty('natureEmployeurInpp');
    expect(corps).not.toHaveProperty('effectif');
    expect(corps).not.toHaveProperty('regimeSalarial');
    expect(corps).not.toHaveProperty('joursPayes');
    const plein = corpsPropose({ moisDePaie: '2026-03', parametres: TOUT, contrat: CONTRAT_CDF, absences: SANS_ABSENCE, conges: [] }).corps;
    expect(plein).toMatchObject({ natureEmployeurInpp: 'PRIVE', effectif: 12, regimeSalarial: 'BAREME_ARTICLE_118', joursPayes: 26, classeProfessionnelle: 5 });
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
    expect(r.corps.elements[0]).not.toHaveProperty('montantFc');
  });

  it('le salaire des jours dus, jamais le salaire plein, un mois d’absence ou de congé', () => {
    const r = corpsPropose({
      moisDePaie: '2026-03',
      parametres: TOUT,
      contrat: CONTRAT_CDF,
      absences: { salaireDesJoursDus: 676_923.08, joursDeuxTiers: 0, indemniteDeuxTiers: null, motifs: [] },
      conges: [{ id: 'c1', devise: 'CDF', montant: 150_000, portePar: null }],
    });
    expect(r.corps.elements[0]).toMatchObject({ libelle: 'Salaire des jours dus', montantFc: 676_923.08 });
    expect(r.corps.allocationsConge).toEqual([{ congeId: 'c1' }]);
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
    const nonChiffre = corpsPropose({
      moisDePaie: '2026-03',
      parametres: TOUT,
      contrat: CONTRAT_CDF,
      absences: { salaireDesJoursDus: null, joursDeuxTiers: 0, indemniteDeuxTiers: null, motifs: ['arrêté manquant'] },
      conges: [],
    });
    expect(nonChiffre.corps.elements).toEqual([]);
    expect(nonChiffre.manques.join(' ')).toMatch(/arrêté manquant/);
  });

  it('une allocation déjà portée, non chiffrée ou d’une autre monnaie ne se porte pas', () => {
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
    expect(r.manques.filter((m) => /allocation de congé/.test(m))).toHaveLength(2);
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

  it('la proposition n’écrit rien · aucune écriture Prisma dans le service', () => {
    const source = fs.readFileSync(path.join(__dirname, 'paie-en-lot.service.ts'), 'utf8');
    const ecritures = source.match(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g) ?? [];
    // Une seule · la déclaration des paramètres, sur le dossier.
    expect(ecritures).toEqual(['.update(']);
    expect(source).toMatch(/this\.prisma\.tenant\.update\(\{ where: \{ id: tenantId \}/);
    // Du service du personnel, la simulation seule est appelée · l'émission
    // reste le geste unitaire, bulletin par bulletin.
    expect([...new Set(source.match(/this\.personnel\.\w+/g))]).toEqual(['this.personnel.simulerPaie']);
  });
});
