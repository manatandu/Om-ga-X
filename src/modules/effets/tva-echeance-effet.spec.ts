import { readFileSync } from 'fs';
import { join } from 'path';
import { TauxTvaService, dateDuReglement } from '../tva/taux-tva.service';

/**
 * L'ÉCHÉANCE DE L'EFFET EST LA DATE DU RÈGLEMENT (ligne sage-l3, fonction 39 ·
 * décret n° 011/42, art. 57 · « à la date de l'échéance de la traite, même si
 * elle a été remise à l'escompte » ; art. 96). Ce qui casserait en silence ·
 * (1) un règlement lu à la date de sa pièce quand elle porte une échéance ;
 * (2) une lecture de groupe qui ne sélectionne pas la colonne, et retombe sur
 * la date de la pièce sans un mot.
 */
const SOURCE = readFileSync(join(__dirname, '..', 'tva', 'taux-tva.service.ts'), 'utf8');

describe('dateDuReglement', () => {
  it("rend l'échéance de l'effet quand la pièce la porte, la date de la pièce sinon", () => {
    const d = new Date('2026-03-01T00:00:00.000Z');
    const e = new Date('2026-05-31T00:00:00.000Z');
    expect(dateDuReglement({ date: d, dateEncaissementEffet: e })).toBe(e);
    expect(dateDuReglement({ date: d, dateEncaissementEffet: null })).toBe(d);
    expect(dateDuReglement({ date: d })).toBe(d);
  });

  it("les règlements d'un groupe et le dernier règlement sont datés par l'échéance de l'effet", () => {
    const acceptation = { debit: 0, credit: 1160000, ecriture: { date: new Date('2026-03-01T00:00:00.000Z'), dateEncaissementEffet: new Date('2026-05-31T00:00:00.000Z') } };
    const facture = { debit: 1160000, credit: 0, ecriture: { date: new Date('2026-02-20T00:00:00.000Z') } };
    const S = TauxTvaService as unknown as {
      reglementsDuGroupe: (l: unknown[], s: number) => Array<{ date: Date; montant: number }>;
      dateDernierReglement: (l: unknown[], s: number) => Date | null;
    };
    expect(S.reglementsDuGroupe([facture, acceptation], 1)).toEqual([{ date: acceptation.ecriture.dateEncaissementEffet, montant: 1160000 }]);
    expect(S.dateDernierReglement([facture, acceptation], 1)).toEqual(acceptation.ecriture.dateEncaissementEffet);
  });
});

describe('taux-tva.service.ts · chaque lecture de groupe sélectionne la colonne', () => {
  it("toute sélection des lignes d'un groupe (reconnue à son décompte des avoirs) porte dateEncaissementEffet", () => {
    // Les sélections des lignes d'un groupe se reconnaissent à `_count` des
    // lignes d'avoir, que chacune porte ; chacune doit aussi sélectionner
    // l'échéance de l'effet, sinon `dateDuReglement` retombe sur la date de
    // la pièce en silence. Une sélection nouvelle qui oublierait la colonne
    // fait tomber ce test.
    const groupes = SOURCE.split('_count: { select: { lignes: { where: FILTRE_LIGNES_D_AVOIR } } }').length - 1;
    expect(groupes).toBeGreaterThanOrEqual(3);
    const blocs = SOURCE.split('ecriture: {\n').slice(1);
    const avecAvoirs = blocs.filter((b) => b.slice(0, 2500).includes('_count: { select: { lignes: { where: FILTRE_LIGNES_D_AVOIR } } }'));
    expect(avecAvoirs).toHaveLength(groupes);
    for (const b of avecAvoirs) expect(b.slice(0, 2500)).toContain('dateEncaissementEffet: true');
    // Et les lectures des paiements non rattachés et des lignes à relettrer.
    expect(SOURCE.split('dateEncaissementEffet: true').length - 1).toBeGreaterThanOrEqual(groupes + 3);
  });

  it("les quatre lecteurs d'un règlement passent par dateDuReglement, jamais par la date de la pièce", () => {
    for (const fonction of ['private static reglementsDuGroupe', 'private static dateDernierReglement', 'private static tranchesAuxDebits', 'static imputerLeGroupe', 'async imputerLesPaiementsNonRattaches']) {
      const debut = SOURCE.indexOf(`${fonction}(`);
      expect(debut).toBeGreaterThan(0);
      const corps = SOURCE.slice(debut, SOURCE.indexOf('\n  }\n', debut));
      expect(corps).toContain('dateDuReglement(');
    }
  });
});

describe("l'imputation déclarée lit la même date que le moteur (premier tour de relecture, M3)", () => {
  it('imputations-paiements.service.ts date les paiements par dateDuReglement aux deux endroits, jamais par la pièce', () => {
    const source = readFileSync(join(__dirname, '..', 'tva', 'imputations-paiements.service.ts'), 'utf8');
    expect(source).toMatch(/import \{[^}]*dateDuReglement[^}]*\} from '\.\/taux-tva\.service'/);
    expect(source.match(/date: dateDuReglement\((l|p)\.ecriture\)/g)?.length).toBe(2);
    expect(source).not.toMatch(/\.map\(\((l|p)\) => \(\{ id: (l|p)\.id, date: (l|p)\.ecriture\.date/);
  });
});
