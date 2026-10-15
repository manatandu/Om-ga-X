import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CURSEUR_BORD,
  MARGES_ESPACE,
  estLeBoutonPrincipal,
  geometrieRedimensionnee,
  suivreGeste,
  type BordFenetre,
} from './redimensionnement-fenetre';

// Aucun import de « vitest » · convention du dépôt.

const LIMITES = { largeurMin: 380, hauteurMin: 220, largeurEspace: 1200, hauteurEspace: 700 };
const DEPART = { x: 200, y: 100, largeur: 600, hauteur: 400 };

describe('redimensionner une fenêtre par tous ses bords', () => {
  it('les bords droit et bas étirent sans déplacer', () => {
    expect(geometrieRedimensionnee(DEPART, 'e', 50, 999, LIMITES)).toEqual({ ...DEPART, largeur: 650 });
    expect(geometrieRedimensionnee(DEPART, 's', 999, 30, LIMITES)).toEqual({ ...DEPART, hauteur: 430 });
    expect(geometrieRedimensionnee(DEPART, 'se', 50, 30, LIMITES)).toEqual({ ...DEPART, largeur: 650, hauteur: 430 });
  });

  it('les bords gauche et haut déplacent la fenêtre, le bord opposé reste fixe', () => {
    const o = geometrieRedimensionnee(DEPART, 'o', -50, 0, LIMITES);
    expect(o).toEqual({ x: 150, y: 100, largeur: 650, hauteur: 400 });
    expect(o.x + o.largeur).toBe(DEPART.x + DEPART.largeur);

    const n = geometrieRedimensionnee(DEPART, 'n', 0, 40, LIMITES);
    expect(n).toEqual({ x: 200, y: 140, largeur: 600, hauteur: 360 });
    expect(n.y + n.hauteur).toBe(DEPART.y + DEPART.hauteur);

    const no = geometrieRedimensionnee(DEPART, 'no', -20, -20, LIMITES);
    expect(no).toEqual({ x: 180, y: 80, largeur: 620, hauteur: 420 });
  });

  it('les coins croisés ne mêlent pas leurs axes', () => {
    expect(geometrieRedimensionnee(DEPART, 'ne', 30, -10, LIMITES)).toEqual({ x: 200, y: 90, largeur: 630, hauteur: 410 });
    expect(geometrieRedimensionnee(DEPART, 'so', -30, 10, LIMITES)).toEqual({ x: 170, y: 100, largeur: 630, hauteur: 410 });
  });

  it('le minimum tient, et le bord opposé ne bouge toujours pas', () => {
    const o = geometrieRedimensionnee(DEPART, 'o', 500, 0, LIMITES);
    expect(o.largeur).toBe(380);
    expect(o.x + o.largeur).toBe(800);
    const n = geometrieRedimensionnee(DEPART, 'n', 0, 500, LIMITES);
    expect(n.hauteur).toBe(220);
    expect(n.y + n.hauteur).toBe(500);
    expect(geometrieRedimensionnee(DEPART, 'se', -900, -900, LIMITES)).toEqual({ ...DEPART, largeur: 380, hauteur: 220 });
  });

  it('le bord tiré s’arrête aux marges que le rendu applique', () => {
    const e = geometrieRedimensionnee(DEPART, 'e', 5000, 0, LIMITES);
    expect(e.x + e.largeur).toBe(LIMITES.largeurEspace - MARGES_ESPACE.droite);
    const o = geometrieRedimensionnee(DEPART, 'o', -5000, 0, LIMITES);
    expect(o.x).toBe(MARGES_ESPACE.gauche);
    const s = geometrieRedimensionnee(DEPART, 's', 0, 5000, LIMITES);
    expect(s.y + s.hauteur).toBe(LIMITES.hauteurEspace - MARGES_ESPACE.bas);
    const n = geometrieRedimensionnee(DEPART, 'n', 0, -5000, LIMITES);
    expect(n.y).toBe(MARGES_ESPACE.haut);
  });

  it('un espace plus petit que le minimum laisse le minimum', () => {
    const etroit = { ...LIMITES, largeurEspace: 300, hauteurEspace: 200 };
    const r = geometrieRedimensionnee({ x: 8, y: 0, largeur: 380, hauteur: 220 }, 'se', 100, 100, etroit);
    expect(r.largeur).toBe(380);
    expect(r.hauteur).toBe(220);
  });

  it('chaque bord a le curseur de Windows', () => {
    const bords: BordFenetre[] = ['n', 's', 'e', 'o', 'ne', 'no', 'se', 'so'];
    for (const b of bords) expect(CURSEUR_BORD[b]).toMatch(/-resize$/);
    expect(CURSEUR_BORD.ne).toBe(CURSEUR_BORD.so);
    expect(CURSEUR_BORD.no).toBe(CURSEUR_BORD.se);
  });

  it('les marges sont celles du rendu de la fenêtre restaurée', () => {
    const src = readFileSync(join(__dirname, '../components/chrome/Fenetre.tsx'), 'utf8');
    expect(src).toContain(`left: \`clamp(${MARGES_ESPACE.gauche}px,`);
    expect(src).toContain(`calc(100% - ${MARGES_ESPACE.droite}px - \${largeur}))\``);
    expect(src).toContain(`top: \`clamp(${MARGES_ESPACE.haut}px,`);
    expect(src).toContain(`calc(100% - ${MARGES_ESPACE.bas}px - \${hauteur}))\``);    // Les PLAFONDS de taille aussi · à 16 px en hauteur pour 8 px de marges
    // verticales, le bas d'une fenêtre tirée par le haut remontait de 8 px.
    expect(src).toContain(`calc(100% - ${MARGES_ESPACE.gauche + MARGES_ESPACE.droite}px))\``);
    expect(src).toContain(`calc(100% - ${MARGES_ESPACE.haut + MARGES_ESPACE.bas}px))\``);
  });

  it('tirée jusqu’en haut puis jusqu’en bas, la fenêtre remplit la hauteur que le rendu admet', () => {
    const n = geometrieRedimensionnee(DEPART, 'n', 0, -5000, LIMITES);
    const s = geometrieRedimensionnee(n, 's', 0, 5000, LIMITES);
    expect(s.y).toBe(0);
    expect(s.hauteur).toBe(LIMITES.hauteurEspace - MARGES_ESPACE.haut - MARGES_ESPACE.bas);
  });

  it('la fenêtre porte une poignée sur chacun des huit bords et coins', () => {
    const src = readFileSync(join(__dirname, '../components/chrome/Fenetre.tsx'), 'utf8');
    expect(src).toContain('geometrieRedimensionnee(');
    const poignees = src.slice(src.indexOf('const POIGNEES'), src.indexOf('];', src.indexOf('const POIGNEES')));
    for (const b of ['n', 's', 'e', 'o', 'ne', 'no', 'se', 'so']) expect(poignees).toContain(`bord: '${b}'`);
  });

  it('seul le bouton principal de la souris démarre un geste', () => {
    expect(estLeBoutonPrincipal('mouse', 0)).toBe(true);
    expect(estLeBoutonPrincipal('mouse', 2)).toBe(false);
    expect(estLeBoutonPrincipal('touch', 0)).toBe(true);
    expect(estLeBoutonPrincipal('pen', 0)).toBe(true);
  });

  it('un geste annulé ne rejoue plus rien au survol suivant', () => {
    for (const fin of ['pointercancel', 'lostpointercapture', 'pointerup']) {
      const cible = new EventTarget();
      let appels = 0;
      suivreGeste(cible, 1, () => {
        appels += 1;
      });
      cible.dispatchEvent(new Event('pointermove'));
      expect(appels).toBe(1);
      cible.dispatchEvent(new Event(fin));
      cible.dispatchEvent(new Event('pointermove'));
      expect(appels).toBe(1);
    }
  });
});
