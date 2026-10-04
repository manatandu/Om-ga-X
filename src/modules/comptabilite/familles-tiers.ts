import { Referentiel } from '@prisma/client';

/**
 * LES FAMILLES DE TIERS D'UNE BALANCE ET D'UN GRAND LIVRE DES TIERS (ligne
 * FPM, 2026-10-04) · un type par classeur, comme les éditions de Sage que le
 * cabinet retravaille (« Balance des tiers · Fournisseur », « Grand-livre des
 * tiers · Client »).
 *
 * LA FAMILLE SE LIT SUR LE NUMÉRO DU COMPTE, JAMAIS SUR `Tiers.type`. Les deux
 * plans rangent les tiers par compte divisionnaire de la classe 4 · 40
 * « Fournisseurs et comptes rattachés », 41 « Clients » (AUDCIF) ou
 * « Adhérents, clients-usagers » (SYCEBNL), 42 « Personnel ». Un type de tiers
 * déclaré sur la fiche n'entre pas dans la balance générale · un compte 401
 * rattaché à un tiers déclaré « Autre » resterait un fournisseur à la balance
 * générale, et la ligne de contrôle des deux balances ne bouclerait plus.
 * Aucun type n'est inventé · les quatre familles sont les trois comptes
 * divisionnaires et le reste de la classe 4.
 *
 * CE QUI ENTRE DANS CHAQUE FAMILLE, et pourquoi la dernière diffère :
 *  · 40, 41 et 42 · TOUT compte du divisionnaire, rattaché ou non. Un 411
 *    mouvementé sans tiers est la ligne la plus utile de l'état, celle que la
 *    circularisation manquera (règle de la balance auxiliaire, `sansTiers`) ;
 *  · AUTRES · les comptes de la classe 4 hors 40, 41 et 42 RATTACHÉS à un
 *    tiers. Le 44 (État), le 47 (débiteurs et créditeurs divers) ou le 48 ne
 *    sont pas des comptes de tiers par nature ; seul le rattachement fait d'un
 *    4711 le compte d'un tiers. Les comptes non rattachés des mêmes collectifs
 *    restent à la balance générale, et la ligne de contrôle en dit l'écart.
 */
export const FAMILLES_TIERS = ['FOURNISSEURS', 'CLIENTS', 'SALARIES', 'AUTRES'] as const;
export type FamilleTiers = (typeof FAMILLES_TIERS)[number];

/** Le divisionnaire de chaque famille · AUTRES n'en a pas, il est le reste. */
const DIVISIONNAIRE: Record<Exclude<FamilleTiers, 'AUTRES'>, string> = {
  FOURNISSEURS: '40',
  CLIENTS: '41',
  SALARIES: '42',
};

export function estFamilleTiers(v: unknown): v is FamilleTiers {
  return typeof v === 'string' && (FAMILLES_TIERS as readonly string[]).includes(v);
}

/**
 * Le compte appartient-il à la famille ? `rattache` dit si un tiers le porte
 * (`TiersCompte`) · il ne compte que pour AUTRES.
 */
export function compteDeLaFamille(famille: FamilleTiers, numero: string, rattache: boolean): boolean {
  if (famille !== 'AUTRES') return numero.startsWith(DIVISIONNAIRE[famille]);
  return numero.startsWith('4') && !Object.values(DIVISIONNAIRE).some((r) => numero.startsWith(r)) && rattache;
}

/**
 * Le sous-titre du cartouche. « Client » au SYSCOHADA ; au SYCEBNL le 411 est
 * « Adhérents » et le 412 « Clients-usagers » (plan SYCEBNL, Partie 2 ch. 2,
 * compte 41) · servir « Client » à une association rangerait ses adhérents
 * sous un mot qui n'est pas le leur. Un numéro, deux sens.
 */
export function sousTitreFamille(famille: FamilleTiers, referentiel: Referentiel): string {
  switch (famille) {
    case 'FOURNISSEURS':
      return 'Fournisseur';
    case 'CLIENTS':
      return referentiel === Referentiel.SYCEBNL ? 'Adhérent et client-usager' : 'Client';
    case 'SALARIES':
      return 'Salarié';
    case 'AUTRES':
      return 'Autre';
  }
}
