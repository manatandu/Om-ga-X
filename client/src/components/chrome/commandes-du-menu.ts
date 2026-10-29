import { estGroupe, type MenuDef } from './menu-groupes';

/**
 * ALLER À UNE FONCTION PAR SON NOM (ligne gl-saisie, fonction 97 · Sage i7,
 * touche F7). Plus de deux cents commandes vivent dans la barre de menus ·
 * celui qui sait ce qu'il cherche le tape, au lieu de le chercher de menu en
 * menu.
 *
 * LA LISTE EST CELLE DU MENU QUE L'UTILISATEUR VOIT, jamais une seconde table.
 * Elle se tire des menus déjà filtrés par le référentiel, le profil, les
 * modules, le rôle et le logiciel choisi (AppShell) · une commande absente du
 * menu est absente ici, et une fenêtre nouvelle y entre en entrant au menu.
 * MASQUER N'EST PAS REFUSER · l'ouverture passe par le même `onClick` que le
 * menu, et donc par le même aiguillage, qui refuse ce que le dossier n'ouvre
 * pas.
 *
 * Le menu « Fenêtre » n'y est pas · ses commandes agissent sur les fenêtres
 * ouvertes, et la liste de ces fenêtres change à chaque instant.
 */
export interface CommandeDuMenu {
  /** Le libellé de la commande, tel que le menu l'écrit. */
  libelle: string;
  /** Où elle vit · « Traitement › Tiers et trésorerie ». */
  chemin: string;
  executer: () => void;
}

/** Les menus qui ne se parcourent pas · voir l'en-tête. */
const MENUS_ECARTES = new Set(['Fenêtre']);

/** Les points de suspension de Sage (« Mon compte… ») ne font pas partie du nom. */
const nettoyer = (libelle: string) => libelle.replace(/…$/, '').trim();

export function commandesDuMenu(menus: MenuDef[]): CommandeDuMenu[] {
  const commandes: CommandeDuMenu[] = [];
  for (const menu of menus) {
    if (MENUS_ECARTES.has(menu.titre)) continue;
    for (const entree of menu.items) {
      if (estGroupe(entree)) {
        for (const item of entree.items) {
          if (item.onClick && !item.disabled) {
            commandes.push({ libelle: nettoyer(item.label), chemin: `${menu.titre} › ${entree.titre}`, executer: item.onClick });
          }
        }
      } else if (entree.onClick && !entree.disabled) {
        commandes.push({ libelle: nettoyer(entree.label), chemin: menu.titre, executer: entree.onClick });
      }
    }
  }
  return commandes;
}

/** Minuscules, sans accents ni apostrophes typographiques · « État » se trouve en tapant « etat ». */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * LE RANG D'UNE COMMANDE POUR CE QUI EST TAPÉ · `null` si elle ne répond pas.
 * Chaque mot tapé doit se trouver dans le libellé ou dans son chemin ; le
 * libellé qui COMMENCE par la frappe passe d'abord, puis celui dont un mot
 * commence par elle, puis le reste · à rang égal, l'ordre du menu.
 */
export function rangDeLaCommande(c: CommandeDuMenu, frappe: string): number | null {
  const f = normaliser(frappe);
  if (!f) return null;
  const libelle = normaliser(c.libelle);
  const tout = `${libelle} ${normaliser(c.chemin)}`;
  const mots = f.split(' ');
  if (!mots.every((m) => tout.includes(m))) return null;
  if (libelle.startsWith(f)) return 0;
  if (libelle.split(/[^a-z0-9]+/).some((m) => m.startsWith(mots[0]))) return 1;
  if (libelle.includes(mots[0])) return 2;
  return 3;
}

export const COMMANDES_PROPOSEES = 12;

/** Les commandes qui répondent à la frappe, les meilleures d'abord, bornées. */
export function rechercherCommandes(commandes: CommandeDuMenu[], frappe: string): CommandeDuMenu[] {
  return commandes
    .map((c, ordre) => ({ c, ordre, rang: rangDeLaCommande(c, frappe) }))
    .filter((x): x is { c: CommandeDuMenu; ordre: number; rang: number } => x.rang !== null)
    .sort((a, b) => a.rang - b.rang || a.ordre - b.ordre)
    .slice(0, COMMANDES_PROPOSEES)
    .map((x) => x.c);
}
