import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useExercice } from '../lib/exercice';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import { GroupesLusLigneALigne } from '../components/GroupesLusLigneALigne';
import { TableauBalanceAgee, type BalanceAgee } from '../components/TableauBalanceAgee';

/**
 * BALANCE ÂGÉE · l'antériorité des créances et dettes non lettrées, tiers par
 * tiers, dans la présentation des dossiers de révision réels.
 *
 * L'écran ventilait en tranches glissantes de trente jours (1 à 30, 31 à 60,
 * 61 à 90, + 90) depuis une date de référence. Un réviseur qui veut retrouver
 * la facture derrière un montant doit alors refaire les dates de tête. Les
 * colonnes sont désormais des PÉRIODES CALENDAIRES, avec l'âge rappelé
 * au-dessus · cinq mois entiers un par un, le reste de l'exercice en un bloc,
 * et l'antérieur à l'ouverture à part.
 *
 * Les tiers dont le solde est à l'envers ne sont pas ventilés : un client
 * créditeur n'a pas d'antériorité de créance, un fournisseur débiteur pas de
 * retard de paiement. « À l'envers » se lit sur le sens NORMAL du périmètre,
 * servi par le serveur (lot M, D1 · une dette fournisseur se ventile). Trois
 * populations, débiteurs et créditeurs ventilés, soldes en sens inverse, et
 * le solde net des trois recoupe la balance auxiliaire.
 */

type TypeTiers =
  | 'TOUS'
  | 'CLIENTS_41'
  | 'FOURNISSEURS'
  | 'PERSONNEL_42'
  | 'SOCIAL_43'
  | 'ETAT_44'
  | 'DIVERS_47';

/**
 * Le compte 41 porte le même NUMÉRO dans les deux plans et pas le même
 * INTITULÉ · « Adhérents, clients-usagers et comptes rattachés » au SYCEBNL,
 * « Clients et comptes rattachés » à l'AUDCIF. Les quatre périmètres ajoutés
 * le 2026-09-06 portent en revanche le même intitulé des deux côtés.
 */
const LIBELLE_TYPE_SYCEBNL: Record<TypeTiers, string> = {
  TOUS: 'Crédit commercial (40 et 41)',
  CLIENTS_41: 'Adhérents, clients-usagers (41)',
  FOURNISSEURS: 'Fournisseurs (40)',
  PERSONNEL_42: 'Personnel (42)',
  SOCIAL_43: 'Organismes sociaux (43)',
  ETAT_44: 'État (44), hors TVA',
  DIVERS_47: 'Débiteurs et créditeurs divers (47)',
};

const LIBELLE_TYPE_SYSCOHADA: Record<TypeTiers, string> = {
  TOUS: 'Crédit commercial (40 et 41)',
  CLIENTS_41: 'Clients et comptes rattachés (41)',
  FOURNISSEURS: 'Fournisseurs (40)',
  PERSONNEL_42: 'Personnel (42)',
  SOCIAL_43: 'Organismes sociaux (43)',
  ETAT_44: 'État (44), hors TVA',
  DIVERS_47: 'Débiteurs et créditeurs divers (47)',
};

export function BalanceAgeePage() {
  const { exerciceCourant } = useExercice();
  const { utilisateur } = useAuth();
  const libelleType =
    utilisateur?.tenant.referentiel === 'SYSCOHADA' ? LIBELLE_TYPE_SYSCOHADA : LIBELLE_TYPE_SYCEBNL;
  const [type, setType] = useState<TypeTiers>('TOUS');
  const [dateReference, setDateReference] = useState(new Date().toISOString().slice(0, 10));
  const [donnees, setDonnees] = useState<BalanceAgee | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!exerciceCourant) return;
    let annule = false;
    setErreur(null);
    api
      .get<BalanceAgee>(
        `/ecritures/balance-agee?exerciceId=${exerciceCourant.id}&dateReference=${dateReference}&type=${type}`,
      )
      .then(
        // Un serveur encore à l'ancienne révision (Cloud Run garde la
        // précédente quand la nouvelle ne démarre pas) ne sert ni
        // `sensInverse` ni ses totaux · lus vides plutôt que de faire
        // tomber la fenêtre.
        (r) =>
          !annule &&
          setDonnees({
            ...r,
            sensInverse: r.sensInverse ?? [],
            soldesNuls: r.soldesNuls ?? [],
            totaux: {
              ...r.totaux,
              parTrancheCrediteurs: r.totaux.parTrancheCrediteurs ?? [],
              sensInverse: r.totaux.sensInverse ?? 0,
            },
          }),
        (e) => !annule && setErreur(e instanceof ApiError ? e.message : 'Chargement impossible'),
      );
    return () => {
      annule = true;
    };
  }, [exerciceCourant?.id, dateReference, type]);

  const exporter = () => {
    if (!exerciceCourant) return;
    void api.telechargerOuSignaler(
      `/exports/balance-agee?exerciceId=${exerciceCourant.id}&dateReference=${dateReference}&type=${type}`,
      'balance-agee.xlsx',
      setErreur,
    );
  };

  return (
    <div className="p-2">
      <EnteteImpression titre="Balance âgée" />
      <div className="flex items-end justify-end mb-1.5 gap-3 flex-wrap">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1">
            {/* CE QUE L'ANTÉRIORITÉ VEUT DIRE ICI · la phrase vient du serveur, une
                par périmètre. Sur un compte de personnel, d'organismes sociaux ou
                d'État, un solde à la clôture est la situation normale, et le
                tableau se lirait comme un retard de règlement sans elle. */}
            <span className="text-[11px] font-bold text-text-dim flex items-center gap-1.5">
              Type de tiers
              {donnees?.lecture && (
                <Aide titre={donnees.libellePerimetre} texte={donnees.lecture} source="Balance âgée · lecture du périmètre" />
              )}
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TypeTiers)}
              className="border border-border-dark bg-surface px-2 py-1 text-[11.5px] min-w-[190px]"
            >
              {(Object.keys(libelleType) as TypeTiers[]).map((t) => (
                <option key={t} value={t}>
                  {libelleType[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Date de référence</span>
            <input
              type="date"
              value={dateReference}
              onChange={(e) => setDateReference(e.target.value)}
              className="border border-border-dark bg-surface px-2 py-1 text-[11.5px] font-mono"
            />
          </label>
          <button
            type="button"
            onClick={exporter}
            className="border border-border-dark bg-surface-alt px-3 py-1 text-[11.5px] font-semibold"
          >
            Exporter en Excel
          </button>
          <span className="flex items-center gap-1.5 pb-1">
            <Aide sujet="balanceAgee" />
            <Aide
              titre="Lecture de la balance âgée"
              texte="Une ligne par tiers, pas par compte : un tiers qui porte plusieurs comptes rattachés (un compte d'exploitation et un compte douteux, par exemple) présente ici son exposition entière. Une échéance non renseignée en saisie est rattachée à la date de l'écriture. Les lignes lettrées, soldées par définition, n'apparaissent pas. Seul un solde dans le sens normal du compte se ventile : une créance client, une dette fournisseur, et dans les deux sens les comptes du personnel, des organismes sociaux, de l'État et des débiteurs et créditeurs divers. Un client créditeur ou un fournisseur débiteur est rendu à part, sans antériorité. Un tiers dont les pièces ouvertes se compensent (solde nul) est rendu à part lui aussi, sans antériorité ni total, même quand elles tombent dans la même tranche ; une dette et une créance portées sur deux comptes du même tiers se compensent sans se lettrer entre elles. Le solde net doit recouper celui de la balance auxiliaire des mêmes comptes."
              source="Balance âgée"
            />
          </span>
        </div>
      </div>

      {erreur && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-3 py-2 mb-2.5">{erreur}</div>
      )}

      <div className="border border-border bg-surface shadow-posee overflow-x-auto">
        {donnees && <TableauBalanceAgee donnees={donnees} />}
      </div>
      {/* Paquet 1, B5 · les groupes lus ligne à ligne · leur total est dans les
          tranches, leur répartition par ancienneté ne l'est pas. */}
      <GroupesLusLigneALigne groupes={donnees?.groupesLusLigneALigne} className="mt-1.5" />

    </div>
  );
}
