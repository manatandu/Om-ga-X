import { NotFoundException } from '@nestjs/common';
import { TypeCompteDetailTotal } from '@prisma/client';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import {
  brouillardDuPrecedentNonTenu,
  chargerOuverture,
  mentionExercicePrecedentVide,
  motifColonneN1NonTenue,
  trouverExerciceN1,
} from './etats-financiers.communs';

/**
 * `trouverExerciceN1` · la lecture commune du comparatif, et le REFUS d'un
 * exercice que le dossier ne porte pas (audit final F222). La balance ne
 * vérifie pas l'exercice qu'on lui passe : sans ce refus, un identifiant
 * inconnu, ou celui d'un autre dossier, rendait des états tout à zéro, dits
 * équilibrés.
 */
function exerciceService(exercices: Array<{ id: string; dateDebut: Date }>, tenant = 't1') {
  // Comme `ExerciceService.lister` · borné au dossier, trié par date de
  // début décroissante.
  return {
    lister: jest.fn().mockImplementation((tenantId: string) =>
      Promise.resolve(
        tenantId === tenant ? [...exercices].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime()) : [],
      ),
    ),
  } as unknown as ExerciceService;
}

const E2025 = { id: 'e2025', dateDebut: new Date('2025-01-01') };
const E2026 = { id: 'e2026', dateDebut: new Date('2026-01-01') };

describe('trouverExerciceN1', () => {
  it('rend l’exercice antérieur le plus récent', async () => {
    await expect(trouverExerciceN1(exerciceService([E2025, E2026]), 't1', 'e2026')).resolves.toBe('e2025');
  });

  it('rend null pour le premier exercice du dossier · le comparatif reste absent', async () => {
    await expect(trouverExerciceN1(exerciceService([E2025, E2026]), 't1', 'e2025')).resolves.toBeNull();
  });

  it('refuse un exercice inconnu du dossier par un 404 nommé', async () => {
    const promesse = trouverExerciceN1(exerciceService([E2025, E2026]), 't1', 'inconnu');
    await expect(promesse).rejects.toBeInstanceOf(NotFoundException);
    await expect(trouverExerciceN1(exerciceService([E2026]), 't1', 'inconnu')).rejects.toThrow(
      'Exercice introuvable dans ce dossier',
    );
  });

  it('refuse l’exercice d’un AUTRE dossier, même s’il existe ailleurs', async () => {
    await expect(trouverExerciceN1(exerciceService([E2025, E2026], 't1'), 't2', 'e2026')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

/**
 * PAQUET 1, A4 (reproduit sur vraie base le 2026-10-09) · l'ouverture d'un
 * exercice se lit AVANT ce que sa clôture y porte · la colonne report d'un
 * exercice clôturé contient aussi le virement du résultat antérieur non
 * affecté, daté de la fin de l'exercice. `chargerOuverture` le demande à la
 * balance du livre-journal, et rend des lignes déjà ramenées à l'ouverture.
 */
describe('chargerOuverture', () => {
  const ligneBalance = (
    numero: string,
    rd: number,
    rc: number,
    md: number,
    mc: number,
    typeCompte: TypeCompteDetailTotal = TypeCompteDetailTotal.DETAIL,
  ) => ({
    compteId: `id-${numero}`,
    numero,
    intitule: numero,
    classe: 'CLASSE_1',
    typeCompte,
    reportDebit: rd,
    reportCredit: rc,
    mouvementDebit: md,
    mouvementCredit: mc,
    clotureDebit: 0,
    clotureCredit: 0,
    totalDebit: rd + md,
    totalCredit: rc + mc,
    solde: rd + md - rc - mc,
  });
  const ecritureService = (lignes: unknown[]) =>
    ({ balance: jest.fn().mockResolvedValue({ lignes, totaux: { debit: 0, credit: 0 } }) }) as unknown as EcritureService & {
      balance: jest.Mock;
    };

  it('demande la balance du livre-journal avant la clôture, date d’arrêté transmise', async () => {
    const es = ecritureService([]);
    const arrete = new Date('2026-06-30');
    await chargerOuverture(es, 't1', 'e1', arrete);
    expect(es.balance).toHaveBeenCalledWith('t1', 'e1', false, arrete, { avantLaCloture: true });
  });

  it('rend les lignes à l’ouverture · le report tient lieu de solde, les comptes Total écartés', async () => {
    const es = ecritureService([
      ligneBalance('13100000', 0, 2_000_000, 0, 0),
      ligneBalance('52110000', 12_000_000, 0, 500_000, 0),
      ligneBalance('13', 0, 2_000_000, 0, 0, TypeCompteDetailTotal.TOTAL),
    ]);
    const lignes = await chargerOuverture(es, 't1', 'e1');
    expect(lignes.map((l) => [l.numero, l.solde, l.mouvementDebit, l.mouvementCredit])).toEqual([
      ['13100000', -2_000_000, 0, 0],
      ['52110000', 12_000_000, 0, 0],
    ]);
  });

  it('sans exercice, rien n’est lu', async () => {
    const es = ecritureService([]);
    await expect(chargerOuverture(es, 't1', null)).resolves.toEqual([]);
    expect(es.balance).not.toHaveBeenCalled();
  });
});

/**
 * PAQUET 1, A2 (reproduit sur vraie base le 2026-10-09) · un exercice
 * précédent qui ne tient rien au livre-journal est soit VIDE (importer sa
 * balance de clôture), soit tenu au BROUILLARD (valider ses écritures, AUDCIF
 * art. 22, 2°) · importer une balance doublerait ce qui attend sa validation.
 */
describe('l’exercice précédent qui ne tient rien · vide ou au brouillard', () => {
  it.each(['SYSCOHADA', 'SYCEBNL'] as const)('%s · au brouillard, les messages disent de valider, jamais d’importer', (referentiel) => {
    for (const ouvertureLue of [true, false]) {
      const m = mentionExercicePrecedentVide(referentiel, ouvertureLue, 2);
      expect(m).toContain("n'a que des écritures au brouillard (2)");
      expect(m).toContain('Validez-les (AUDCIF art. 22, 2°)');
      expect(m).not.toContain('Importez');
    }
    const motif = motifColonneN1NonTenue(referentiel, 2);
    expect(motif).toContain('Validez-les (AUDCIF art. 22, 2°)');
    expect(motif).not.toContain('Importez');
  });

  it.each(['SYSCOHADA', 'SYCEBNL'] as const)('%s · sans aucune écriture, les messages gardent l’issue de l’import', (referentiel) => {
    expect(mentionExercicePrecedentVide(referentiel, false)).toContain('Importez la balance de clôture');
    expect(mentionExercicePrecedentVide(referentiel, false, 0)).toBe(mentionExercicePrecedentVide(referentiel, false));
    expect(motifColonneN1NonTenue(referentiel)).toContain('Importez sa balance de clôture');
    expect(motifColonneN1NonTenue(referentiel)).not.toContain('brouillard');
  });

  it('le brouillard n’est compté que d’un exercice précédent qui ne tient rien', async () => {
    const es = { nombreAuBrouillard: jest.fn().mockResolvedValue(4) } as unknown as EcritureService & { nombreAuBrouillard: jest.Mock };
    await expect(brouillardDuPrecedentNonTenu(es, 't1', 'e0', true)).resolves.toBe(0);
    await expect(brouillardDuPrecedentNonTenu(es, 't1', null, false)).resolves.toBe(0);
    expect(es.nombreAuBrouillard).not.toHaveBeenCalled();
    await expect(brouillardDuPrecedentNonTenu(es, 't1', 'e0', false)).resolves.toBe(4);
    expect(es.nombreAuBrouillard).toHaveBeenCalledWith('t1', 'e0');
  });
});
