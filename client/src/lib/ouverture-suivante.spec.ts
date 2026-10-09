import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { issueSansDeclaration, libellesChoix, negatifsTardifsLisibles, titreDeclaration, type ApercuOuverture } from './ouverture-suivante';

/**
 * SECOND TOUR DE RELECTURE DU PAQUET 1, BLOQUANT 1 · une ouverture du premier
 * jour annulée par un négatif inscrit le 15/03, l'ouverture exacte ressaisie
 * le même jour · l'écran promettait « le report entier sera passé », et la
 * clôture comptait l'ouverture deux fois. AUDCIF art. 20, al. 2 ; art. 34.
 */
const apercu = (p: Partial<ApercuOuverture>): ApercuOuverture => ({
  pieces: 'OD n° 1, OD n° 2',
  auBrouillard: false,
  ouvertureNulle: false,
  exerciceSansEcriture: false,
  declarationRequise: false,
  total: 0,
  ...p,
});
const tardif = [{ piece: 'OD n° 2', date: '2027-03-15' }];

describe('ouverture annulée hors du premier jour · l’écran ne promet plus le report entier', () => {
  it('nulle avec un négatif tardif et déclaration demandée · aucune ligne « report entier », le cadre nomme le négatif et sa date', () => {
    const o = apercu({ ouvertureNulle: true, declarationRequise: true, total: 2, negatifsTardifs: tardif });
    expect(issueSansDeclaration(o)).toBeNull();
    expect(titreDeclaration(o)).toBe('Ouverture du premier jour (OD n° 1, OD n° 2) annulée après le premier jour (OD n° 2 du 15/03/2027)');
    const { rectifier, conserver } = libellesChoix(o);
    expect(rectifier).toMatch(/n'a pas été ressaisie.*report entier/);
    expect(conserver).toMatch(/ressaisie après le premier jour.*rien n'est passé/);
  });

  it('nulle avec un négatif tardif et rien à reporter · dit, sans promettre de report', () => {
    const o = apercu({ ouvertureNulle: true, negatifsTardifs: tardif });
    expect(issueSansDeclaration(o)).toBe(
      "Écritures du premier jour de l'exercice suivant (OD n° 1, OD n° 2) annulées après le premier jour (OD n° 2 du 15/03/2027) · cet exercice n'a rien à reporter.",
    );
  });

  it('nulle sans négatif tardif (ou serveur antérieur) · le report entier, comme avant', () => {
    expect(issueSansDeclaration(apercu({ ouvertureNulle: true }))).toMatch(/soldées à zéro · le report entier sera passé/);
    expect(issueSansDeclaration(apercu({ ouvertureNulle: true, negatifsTardifs: [] }))).toMatch(/le report entier sera passé/);
  });

  it('les autres cas gardent leurs mots', () => {
    expect(issueSansDeclaration(apercu({}))).toMatch(/concordante, aucun report ne sera ajouté/);
    expect(issueSansDeclaration(apercu({ total: 3 }))).toMatch(/aucune écriture, elle fait foi/);
    expect(issueSansDeclaration(apercu({ auBrouillard: true }))).toBeNull();
    expect(titreDeclaration(apercu({ total: 3, declarationRequise: true }))).toMatch(/différente du bilan de clôture/);
    expect(libellesChoix(null).rectifier).toBe("Rectifier l'import (les livres de cet exercice sont dans OmegaX)");
    expect(negatifsTardifsLisibles([...tardif, ...tardif, ...tardif, ...tardif, ...tardif, ...tardif])).toMatch(/et 1 autre\(s\)$/);
  });

  it('l’écran passe par ces fonctions · il ne réécrit pas « le report entier sera passé »', () => {
    const page = readFileSync(join(__dirname, '../pages/ExercicePage.tsx'), 'utf-8');
    expect(page).toMatch(/issueSansDeclaration\(ouverture\)/);
    expect(page).toMatch(/titreDeclaration\(ouverture\)/);
    expect(page).toMatch(/libellesChoix\(ouverture\)\.rectifier/);
    expect(page).toMatch(/libellesChoix\(ouverture\)\.conserver/);
  });
});
