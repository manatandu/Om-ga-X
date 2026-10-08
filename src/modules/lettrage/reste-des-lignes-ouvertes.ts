import { restesDesFactures, type LigneDeGroupe } from './reconduction-lettrage';

/**
 * UNE LIGNE OUVERTE D'UN GROUPE DE LETTRAGE PÈSE CE QU'ELLE DOIT ENCORE
 * (simulation du logiciel complet du 2026-10-08, lot M, D2 et D3).
 *
 * Une facture de 3 480 000 réglée de 1 000 000, les deux lettrées en partiel,
 * restent ouvertes l'une et l'autre · lues ligne à ligne, la facture portait
 * 3 480 000 à son échéance et le règlement, sans échéance, − 1 000 000 hors de
 * toute colonne. La NOTE 7 rendait 9 280 000 « à un an au plus » pour un solde
 * de 8 280 000, le reste en « non ventilé » négatif, et la balance âgée rangeait
 * la facture entière dans sa tranche et le règlement en négatif dans la sienne.
 *
 * LE LETTRAGE DIT CE QUE LE RÈGLEMENT ÉTEINT · une somme lettrée avec une
 * facture la règle, et ce qui reste dû l'est sur ELLE, à son échéance. Le
 * reste de chaque facture se lit par la règle du Règlement des tiers et de la
 * clôture (`restesDesFactures`, les plus anciennes d'abord, chaque somme dans
 * l'ordre de son inscription) · une seule lecture du reste d'une facture dans
 * tout le logiciel. Les factures sont les lignes du sens du solde du groupe
 * (débit pour une créance, crédit pour une dette) ; les autres lignes du
 * groupe ne pèsent plus rien, leur montant est dans le reste des factures.
 *
 * Le groupe se lit sur les SEULES lignes reçues · l'appelant passe celles de
 * l'état (exercice, date d'arrêté), et un règlement postérieur n'y entre pas.
 * Si les restes ne rendent pas le solde du groupe au centime (devise que la
 * règle ne sait pas suivre), le groupe garde la lecture ligne à ligne · son
 * total reste exact, seule sa répartition entre les colonnes est celle
 * d'avant.
 */
export interface LigneOuverte {
  id: string;
  debit: unknown;
  credit: unknown;
  lettrageId: string | null;
  dateEcheance: Date | null;
  deviseId: string | null;
  montantDevise: unknown;
  ecriture: { date: Date };
}

const centimes = (x: unknown) => Math.round(Number(x ?? 0) * 100);

/**
 * Le poids des lignes d'un groupe de lettrage, signé débit moins crédit, en
 * unités · seules les lignes dont le poids n'est pas leur montant y figurent
 * (une ligne hors groupe, ou seule de son groupe parmi les lignes reçues, se
 * lit à son montant, et l'appelant la range ainsi).
 */
export function poidsDesLignesOuvertes(lignes: readonly LigneOuverte[]): Map<string, number> {
  const poids = new Map<string, number>();
  const groupes = new Map<string, LigneOuverte[]>();
  for (const l of lignes) {
    if (!l.lettrageId) continue;
    const membres = groupes.get(l.lettrageId);
    if (membres) membres.push(l);
    else groupes.set(l.lettrageId, [l]);
  }
  for (const membres of groupes.values()) {
    if (membres.length < 2) continue;
    const net = membres.reduce((t, l) => t + centimes(l.debit) - centimes(l.credit), 0);
    if (net === 0) {
      for (const l of membres) poids.set(l.id, 0);
      continue;
    }
    const sens = net > 0 ? 'DEBIT' : 'CREDIT';
    const restes = restesDesFactures(
      membres.map(
        (l): LigneDeGroupe => ({
          id: l.id,
          cle: l.id,
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          deviseId: l.deviseId,
          montantDevise: l.montantDevise === null || l.montantDevise === undefined ? null : Number(l.montantDevise),
          date: l.ecriture.date,
          dateEcheance: l.dateEcheance,
        }),
      ),
      sens,
    );
    const totalRestes = [...restes.values()].reduce((t, r) => t + centimes(r.francs), 0);
    if (totalRestes !== Math.abs(net)) continue;
    const signe = sens === 'DEBIT' ? 1 : -1;
    for (const l of membres) poids.set(l.id, restes.has(l.id) ? signe * restes.get(l.id)!.francs : 0);
  }
  return poids;
}
