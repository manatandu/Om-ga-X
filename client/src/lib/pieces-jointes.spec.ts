import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADRESSES_PIECES,
  LONGUEUR_COMMENTAIRE_PIECE,
  TAILLE_MAX_PIECE,
  piecesDeLEcriture,
  refusAvantEnvoi,
  tailleLisible,
  type ObjetDesPieces,
} from './pieces-jointes';

/**
 * LES PIÈCES JOINTES À L'ÉCRAN (ligne sage-l6, fonction n° 22). Ce qui
 * casserait en silence · une adresse d'écran qui ne serait plus celle du
 * contrôleur (le volet dirait « illisible » sur chaque fiche), une borne
 * différente de celle du serveur, « aucune pièce » dit sur un décompte non lu,
 * un objet qui ne porterait plus son volet.
 */

const SERVEUR = join(__dirname, '../../../src');
const CLIENT = join(__dirname, '..');

const CONTROLEURS: Record<ObjetDesPieces, string> = {
  ECRITURE: 'modules/comptabilite/pieces-jointes-ecriture.controller.ts',
  SECTION: 'modules/analytique/pieces-jointes-section.controller.ts',
  IMMOBILISATION: 'modules/immobilisations/pieces-jointes-immobilisation.controller.ts',
  SALARIE: 'modules/personnel/pieces-jointes-salarie.controller.ts',
};

/** Les routes d'un contrôleur, préfixe compris, paramètres écrits `:p`. */
function routesDu(fichier: string): string[] {
  const source = readFileSync(join(SERVEUR, fichier), 'utf8');
  const prefixe = /@Controller\(\s*'([^']*)'\s*\)/.exec(source)?.[1] ?? '';
  return [...source.matchAll(/@(Get|Post|Patch|Delete)\(\s*'([^']*)'\s*\)/g)].map(
    (m) => `${m[1].toUpperCase()} /${[prefixe, m[2]].filter(Boolean).join('/')}`.replace(/:\w+/g, ':p'),
  );
}

const cheminAvec = (f: (id: string) => string) => f(':p');

describe('pièces jointes · les adresses de l’écran sont celles du serveur', () => {
  it.each(Object.keys(CONTROLEURS) as ObjetDesPieces[])('%s · liste, dépôt, fichier, commentaire et retrait', (objet) => {
    const routes = routesDu(CONTROLEURS[objet]);
    const { liste, piece } = ADRESSES_PIECES[objet];
    // `encodeURIComponent(':p')` rend `%3Ap` · on lit le motif, pas l'encodage.
    const l = cheminAvec(liste).replace('%3Ap', ':p');
    const p = cheminAvec(piece).replace('%3Ap', ':p');
    expect(routes).toEqual(expect.arrayContaining([`GET ${l}`, `POST ${l}`, `GET ${p}/fichier`, `PATCH ${p}`, `DELETE ${p}`]));
  });

  it('les deux lectures propres aux écritures existent au serveur', () => {
    const routes = routesDu(CONTROLEURS.ECRITURE);
    expect(routes).toEqual(expect.arrayContaining(['GET /pieces-jointes-ecritures/detachees', 'GET /pieces-jointes-ecritures/decompte']));
  });
});

describe('pièces jointes · les bornes et les refus immédiats', () => {
  it('les bornes sont celles du serveur · 5 Mo, 69 caractères', () => {
    const serveur = readFileSync(join(SERVEUR, 'common/pieces-jointes/pieces-jointes.ts'), 'utf8');
    expect(serveur).toContain('export const TAILLE_MAX_DOCUMENT = 5 * 1024 * 1024;');
    expect(serveur).toContain('export const LONGUEUR_MAX_COMMENTAIRE = 69;');
    expect(TAILLE_MAX_PIECE).toBe(5 * 1024 * 1024);
    expect(LONGUEUR_COMMENTAIRE_PIECE).toBe(69);
  });

  it('refuse avant l’envoi le vide et le trop gros, admet exactement 5 Mo', () => {
    expect(refusAvantEnvoi({ size: 0 })).toBe('Le fichier est vide.');
    expect(refusAvantEnvoi({ size: TAILLE_MAX_PIECE + 1 })).toContain('dépasse 5 Mo');
    expect(refusAvantEnvoi({ size: TAILLE_MAX_PIECE })).toBeNull();
  });

  it('la taille se lit en octets, Ko ou Mo', () => {
    expect(tailleLisible(900)).toBe('900 o');
    expect(tailleLisible(2048)).toBe('2 Ko');
    expect(tailleLisible(3 * 1024 * 1024 + 200_000)).toBe('3,2 Mo');
  });
});

describe('pièces jointes · un décompte non lu ne dit jamais « aucune »', () => {
  it('null tant que le décompte n’est pas lu', () => {
    expect(piecesDeLEcriture(null, 'e')).toBeNull();
  });
  it('lu entier, une écriture absente n’en porte aucune', () => {
    expect(piecesDeLEcriture({ parEcriture: { e: 2 }, tronque: false }, 'e')).toBe(2);
    expect(piecesDeLEcriture({ parEcriture: { e: 2 }, tronque: false }, 'f')).toBe(0);
  });
  it('tronqué, une écriture absente reste inconnue', () => {
    expect(piecesDeLEcriture({ parEcriture: { e: 2 }, tronque: true }, 'f')).toBeNull();
  });
});

describe('pièces jointes · chaque objet porte son volet, chez lui', () => {
  const lire = (f: string) => readFileSync(join(CLIENT, f), 'utf8');

  it('la saisie et le journal ouvrent les pièces d’une écriture, le journal aussi les pièces détachées', () => {
    for (const page of ['pages/SaisiePage.tsx', 'pages/JournalPage.tsx']) {
      const src = lire(page);
      expect([page, /<ModalePiecesEcriture[\s\S]*?peutEcrire=\{peutEcrire\}/.test(src)]).toEqual([page, true]);
      expect([page, /<BoutonPiecesEcriture/.test(src)]).toEqual([page, true]);
    }
    expect(lire('pages/JournalPage.tsx')).toMatch(/<ModalePiecesDetachees peutEcrire=\{peutEcrire\}/);
  });

  it('la section, le bien et le salarié portent le volet de leur objet', () => {
    expect(lire('pages/PlansAnalytiquesPage.tsx')).toMatch(/<VoletPiecesJointes key=\{section\.id\} objet="SECTION" objetId=\{section\.id\}/);
    expect(lire('components/FicheImmobilisation.tsx')).toMatch(/objet="IMMOBILISATION"\s+objetId=\{bien\.id\}/);
    expect(lire('pages/PersonnelPage.tsx')).toMatch(/<VoletPiecesJointes key=\{choisi\.id\} objet="SALARIE" objetId=\{choisi\.id\}/);
  });

  it('les boîtes passent par le portail et tiennent leur fermeture pendant un envoi', () => {
    const src = lire('components/PiecesJointes.tsx');
    expect(src).toContain('<PortailModale>');
    expect(src).toMatch(/ecouterEchap\(\(\) => \{\s*if \(!occupeRef\.current\) fermerRef\.current\(\);/);
    // Une réponse périmée est jetée · jamais la liste d'un autre objet sous celui-ci.
    expect(src).toMatch(/if \(mien === jeton\.current\) setListe\(r\)/);
  });
});
