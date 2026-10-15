import { BadRequestException } from '@nestjs/common';

/**
 * LES LISTES NUMÉROTÉES SE PAGINENT PAR LE NUMÉRO (relecture « échecs
 * silencieux » de sage-l7, m5) · les exports des modifications et les
 * impressions différées ne montraient que leurs cinquante plus récents, et un
 * envoi plus ancien ne se retéléchargeait plus. La page suivante prend les
 * numéros STRICTEMENT inférieurs au dernier montré (`avant`), et la liste dit
 * le numéro à partir duquel elle se poursuit (`plusAnciensAvant`).
 */
export function lireAvant(texte: string | undefined): number | undefined {
  if (texte === undefined || texte === '') return undefined;
  const n = Number(texte);
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestException("Le numéro à partir duquel lire les plus anciens est illisible · un entier positif est attendu.");
  }
  return n;
}

/** Une page lue avec un élément de plus que sa taille · le surplus dit qu'il en reste. */
export function pageDeNumeros<T extends { numero: number }>(lus: T[], taille: number): { page: T[]; plusAnciensAvant: number | null } {
  const page = lus.slice(0, taille);
  return { page, plusAnciensAvant: lus.length > taille ? page[page.length - 1].numero : null };
}
