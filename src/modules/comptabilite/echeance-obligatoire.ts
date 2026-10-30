import { TypeJournal } from '@prisma/client';
import { motifSansEcheancierDuModele } from '../tiers/echeancier-modele';

/**
 * L'ÉCHÉANCE OBLIGATOIRE SUR UNE LIGNE DE TIERS (ligne gl-saisie, fonction 2 ·
 * Sage i7, « date d'échéance obligatoire » en saisie). Une OPTION du dossier,
 * fausse par défaut (`Tenant.echeanceObligatoireTiers`).
 *
 * POURQUOI UNE OPTION, ET POURQUOI ELLE COMPTE. Aucun texte lu n'impose de
 * porter l'échéance sur la pièce · l'AUDCIF art. 17 et 19 demandent la pièce
 * et les livres, pas l'échéance de chaque créance. Mais la balance âgée, les
 * relances, l'échéancier et les notes par échéance (Partie 4, ch. 2 du
 * SYCEBNL ; AUDCIF Titre IX ch. 6, ventilation « à un an au plus ») la lisent ·
 * absente, la ligne tombe en « non ventilé » ou se range à la date de sa
 * pièce, et rien ne le dit au moment de la saisie. Le dossier qui veut que
 * l'échéance soit renseignée À LA SAISIE le déclare · l'imposer à tous
 * ferait ressaisir une date à la petite association qui n'en tient aucune.
 *
 * LA LIGNE JUGÉE EST CELLE DE LA FACTURE, celle-là même qui reçoit
 * l'échéancier du modèle de règlement (`motifSansEcheancierDuModele`, une
 * seule règle) · le fournisseur CRÉDITÉ d'une facture, le client DÉBITÉ
 * (fiches des comptes 40 et 41 des deux plans), hors 408 et 418 (facture non
 * parvenue ou à établir), 409 et 419 (avances, qui n'échoient pas), 416
 * (créance reclassée, dont la facture porte déjà l'échéance), et jamais dans
 * un journal de trésorerie, qui enregistre un règlement. Un règlement, un
 * avoir, une ligne de charge n'ont pas d'échéance à exiger.
 *
 * QUI EST JUGÉ · la SAISIE seule (création et modification du brouillard,
 * au contrôleur), comme le collectif et le sommeil. Les modules, la clôture et
 * les imports ne le sont pas · ils écrivent des pièces que personne ne tape,
 * et un import qui refuserait une balance d'ouverture sans échéance
 * enfermerait la reprise d'un dossier.
 */
export interface LigneJugee {
  numero: string;
  debit?: number | null;
  credit?: number | null;
  dateEcheance?: string | null;
}

/** La ligne doit-elle porter une échéance · une facture sur un 40 ou un 41. */
export function exigeUneEcheance(l: LigneJugee, typeJournal: TypeJournal | null): boolean {
  const debit = Number(l.debit ?? 0);
  const credit = Number(l.credit ?? 0);
  // Une ligne à zéro des deux côtés ne porte rien · la grille la refuse déjà.
  if (debit === 0 && credit === 0) return false;
  const sens = debit > 0 ? 'DEBIT' : 'CREDIT';
  return motifSansEcheancierDuModele({ numero: l.numero, sens, typeJournal }) === null;
}

/** Les numéros des lignes de facture sans échéance, dans l'ordre de la pièce. */
export function lignesSansEcheance(lignes: LigneJugee[], typeJournal: TypeJournal | null): string[] {
  return lignes.filter((l) => exigeUneEcheance(l, typeJournal) && !l.dateEcheance).map((l) => l.numero);
}

/** Le refus, qui nomme les comptes et l'issue · ou `null`. */
export function motifEcheanceManquante(lignes: LigneJugee[], typeJournal: TypeJournal | null): string | null {
  const manquants = [...new Set(lignesSansEcheance(lignes, typeJournal))];
  if (manquants.length === 0) return null;
  const liste = manquants.join(', ');
  return (
    `Le dossier exige l'échéance sur la ligne d'une facture de tiers · ` +
    `${manquants.length > 1 ? 'les lignes des comptes' : 'la ligne du compte'} ${liste} n'en ` +
    `${manquants.length > 1 ? 'portent' : 'porte'} pas. Renseignez la date d'échéance de la ligne ` +
    `(ou appliquez l'échéancier du modèle de règlement du tiers) · l'option se règle dans Paramètres du dossier.`
  );
}
