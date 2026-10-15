import type { StatutAccuse } from '../../../src/modules/conditions-licence/acceptation-conditions';

/**
 * LES RÈGLES D'ÉCRAN DE L'ACCEPTATION DES CONDITIONS (ligne pages-legales,
 * second tour de relecture) · tirées du composant pour être éprouvées, le
 * composant ne fait que les afficher.
 */

/**
 * Le texte de CETTE page face à celui que le service tient en vigueur. Trois
 * écarts, trois issues (second tour, m-2 et mineur 3) · une page plus
 * ANCIENNE se recharge ; une page plus RÉCENTE que le service (mise en
 * production en cours) ne gagne rien à recharger, c'est le service qu'on
 * attend ; même numéro et autre texte, on recharge, faute de savoir lequel
 * est le plus récent.
 */
export type EcartDeTexte = 'A_JOUR' | 'PAGE_ANCIENNE' | 'SERVICE_EN_RETARD' | 'TEXTE_DIFFERENT';

export function ecartDeTexte(
  service: { numero: number; empreinte: string },
  affichee: { numero: number; empreinte: string },
): EcartDeTexte {
  if (service.numero > affichee.numero) return 'PAGE_ANCIENNE';
  if (service.numero < affichee.numero) return 'SERVICE_EN_RETARD';
  return service.empreinte === affichee.empreinte ? 'A_JOUR' : 'TEXTE_DIFFERENT';
}

/**
 * La phrase de l'écart, adressée à celui qui lit (second tour, mineur 6) ·
 * seul l'administrateur accepte, les autres rechargent pour LIRE.
 */
export function phraseEcartDeTexte(ecart: Exclude<EcartDeTexte, 'A_JOUR'>, numeroService: number, numeroAffiche: number, estAdmin: boolean): string {
  if (ecart === 'SERVICE_EN_RETARD') {
    return (
      `Cette page affiche la version ${numeroAffiche} des conditions, que le service ne tient pas encore (il est à la version ${numeroService}) · ` +
      'le service n’est pas encore à jour, réessayez dans quelques minutes.'
    );
  }
  const pourquoi = estAdmin ? 'avant d’accepter' : 'pour lire la version en vigueur';
  if (ecart === 'TEXTE_DIFFERENT') {
    return `Le texte affiché diffère de celui que le service tient pour la même version ${numeroService} · rechargez la page ${pourquoi}.`;
  }
  return `Le texte affiché (version ${numeroAffiche}) n’est pas celui que le service tient en vigueur (version ${numeroService}) · rechargez la page ${pourquoi}.`;
}

/**
 * Ce que devient l'accusé, dit comme le statut de la file le dit (relecture,
 * mineurs 5 et 14 ; second tour, M-b et mineur 6). Un accusé en ÉCHEC n'est
 * pas renvoyable · la file le retente d'elle-même ; seul l'abandonné ou celui
 * qui n'a jamais pu entrer en file se renvoie, par l'administrateur.
 */
export function phraseAccuse(statut: StatutAccuse | null, estAdmin: boolean): string {
  const renvoi = estAdmin ? 'il peut être renvoyé' : 'l’administrateur du dossier peut le renvoyer';
  switch (statut) {
    case 'ENVOYE':
      return 'Le courriel portant cet accusé et le texte accepté est parti.';
    case 'EN_ATTENTE':
      return (
        'Un courriel portant cet accusé et le texte accepté est en file, à l’adresse de l’auteur de l’acceptation · ' +
        'il part à la prochaine reprise de la file (Fichier > Courriers sortants, « Relancer les envois »).'
      );
    case 'SANS_TRANSPORT':
      return 'Un courriel portant cet accusé et le texte accepté est en file, mais aucune messagerie n’est configurée pour l’envoi · il ne partira qu’une fois une messagerie configurée (Fichier > Courriers sortants).';
    case 'ECHEC':
      return 'Le courriel portant cet accusé n’est pas parti au dernier essai · la file le retente d’elle-même (Fichier > Courriers sortants).';
    case 'ABANDONNE':
      return `La file a abandonné le courriel portant cet accusé · ${renvoi}.`;
    default:
      return `Le courriel d’accusé de réception n’a pas pu être mis en file · le texte reste téléchargeable ci-dessus, et ${estAdmin ? 'l’accusé peut être renvoyé' : 'l’administrateur du dossier peut renvoyer l’accusé'}.`;
  }
}

/** AAAA-MM-JJ en toutes lettres, « 1er octobre 2026 » (second tour, mineur 5) · lu au jour, sans fuseau qui le décale. */
export function dateEnLettres(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
  return d.replace(/^1 /, '1er ');
}
