import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useExercice } from '../lib/exercice';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import type {
  BalanceAnalytique,
  ControleCumuls,
  EtatBudgetaire,
  FiltreBalanceAnalytique,
  GrandLivreAnalytique,
  JournalAnalytique,
  LignesNonVentilees,
  OrigineJournalAnalytique,
  PlanAnalytique,
  SectionAnalytique,
} from '../lib/types';
import { montantOuVide as montant } from '../lib/montants';

/**
 * ÉTATS ANALYTIQUES ET BUDGÉTAIRES · État → États analytiques et État →
 * États budgétaires de Sage 100 i7, réunis dans une seule fenêtre à quatre
 * onglets parce qu'ils répondent à une même question posée sous quatre angles.
 *
 * L'onglet CONTRÔLE mérite un mot : c'est lui qui prouve que le total ventilé
 * par projet égale le total comptable, et qui liste les écritures restées sans
 * répartition. Un rapport d'exécution adressé à un bailleur sans cette preuve
 * ne tient pas devant un auditeur.
 *
 * Voir docs/analytique-et-budget.md.
 */

type Onglet = 'balance' | 'journal' | 'grand-livre' | 'controle' | 'budgetaire';

/**
 * Le choix « Lignes non ventilées » du grand livre (fonction n° 52) · ce n'est
 * pas une section, c'est ce que l'axe aurait dû recevoir et n'a pas reçu.
 */
const NON_VENTILEES = '__non_ventilees__';

const MOIS = ['Tous', 'janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function EtatsAnalytiquesPage() {
  const { exerciceCourant } = useExercice();
  // Bailleur, financeur et convention sont du vocabulaire d'EBNL · une
  // entreprise SYSCOHADA n'en a aucun. Le mot « projet », lui, reste : le
  // semis SYSCOHADA nomme lui-même son axe « Projets et programmes ».
  const { utilisateur, peutEcrire } = useAuth();
  const estSyscohada = utilisateur?.tenant.referentiel === 'SYSCOHADA';
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState<Onglet>('balance');
  const [plans, setPlans] = useState<PlanAnalytique[]>([]);
  const [planId, setPlanId] = useState('');
  const [sections, setSections] = useState<SectionAnalytique[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [mois, setMois] = useState(0);
  // Fonction n° 53 · toutes les sections, les mouvementées, les non soldées.
  const [filtreBalance, setFiltreBalance] = useState<FiltreBalanceAnalytique>('TOUTES');
  const [erreur, setErreur] = useState<string | null>(null);

  const [balance, setBalance] = useState<BalanceAnalytique | null>(null);
  const [grandLivre, setGrandLivre] = useState<GrandLivreAnalytique | null>(null);
  const [controle, setControle] = useState<ControleCumuls[] | null>(null);
  const [budgetaire, setBudgetaire] = useState<EtatBudgetaire | null>(null);
  // Fonction n° 52 · journal analytique et lignes non ventilées, partis de null.
  const [origineJournal, setOrigineJournal] = useState<OrigineJournalAnalytique>('TOUTES');
  const [journal, setJournal] = useState<JournalAnalytique | null>(null);
  const [nonVentilees, setNonVentilees] = useState<LignesNonVentilees | null>(null);

  const plan = plans.find((p) => p.id === planId) ?? null;

  // Ventilation d'une ligne restée sans répartition, depuis le contrôle des
  // cumuls · la ligne, l'axe et les sections Détail de cet axe.
  const [aVentiler, setAVentiler] = useState<{ ligneId: string; planId: string; debit: number; credit: number } | null>(
    null,
  );
  const [sectionsAVentiler, setSectionsAVentiler] = useState<SectionAnalytique[]>([]);
  const [sectionChoisie, setSectionChoisie] = useState('');
  const [rechargement, setRechargement] = useState(0);

  /**
   * Ventiler après coup (audit de l'interface du 2026-09-27, I11) · les deux
   * routes existaient sans geste. Le contrôle des cumuls listait les lignes à
   * ventiler et renvoyait au journal, où rien ne ventile une pièce passée :
   * l'écart restait à l'écran sans moyen de le fermer. La ligne est ventilée
   * en totalité sur UNE section de l'axe, comme à la saisie ; un partage entre
   * plusieurs sections se fait à la saisie ou par une OD analytique. Le serveur
   * refuse une ligne figée par une clôture, et le dit.
   */
  const ouvrirVentilation = (planIdLigne: string, l: { ligneId: string; debit: number; credit: number }) => {
    setAVentiler({ ligneId: l.ligneId, planId: planIdLigne, debit: l.debit, credit: l.credit });
    setSectionChoisie('');
    api.get<SectionAnalytique[]>(`/analytique/plans/${planIdLigne}/sections`).then(
      (r) => setSectionsAVentiler(r.filter((s) => s.type === 'DETAIL' && s.estActive)),
      () => setSectionsAVentiler([]),
    );
  };

  const ventiler = async () => {
    if (!aVentiler || !sectionChoisie) return;
    setErreur(null);
    try {
      await api.post(`/analytique/lignes/${aVentiler.ligneId}/ventilations`, {
        ventilations: [
          { sectionId: sectionChoisie, debit: aVentiler.debit || undefined, credit: aVentiler.credit || undefined },
        ],
      });
      setAVentiler(null);
      setRechargement((n) => n + 1);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Ventilation impossible');
    }
  };

  // L'effacement porte sur TOUS les axes de la ligne · c'est ce que fait la
  // route, et la confirmation le dit plutôt que de laisser croire qu'on ne
  // retire que cette section.
  const effacerVentilation = async (ligneEcritureId: string) => {
    if (!window.confirm('Effacer la ventilation de cette ligne, sur tous les axes ? Elle reviendra au contrôle des cumuls.'))
      return;
    setErreur(null);
    try {
      await api.delete(`/analytique/lignes/${ligneEcritureId}/ventilations`);
      setRechargement((n) => n + 1);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Effacement impossible');
    }
  };

  useEffect(() => {
    api.get<PlanAnalytique[]>('/analytique/plans').then(
      (r) => {
        setPlans(r);
        setPlanId((id) => id || r[0]?.id || '');
      },
      (e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
  }, []);

  useEffect(() => {
    if (!planId) return;
    api.get<SectionAnalytique[]>(`/analytique/plans/${planId}/sections`).then((r) => {
      setSections(r);
      setSectionId((id) =>
        id === NON_VENTILEES || r.some((s) => s.id === id) ? id : (r.find((s) => s.type === 'DETAIL')?.id ?? ''),
      );
    }, () => setSections([]));
  }, [planId]);

  useEffect(() => {
    if (!exerciceCourant || !planId) return;
    setErreur(null);
    const ex = exerciceCourant.id;
    const echec = (e: unknown) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible');

    if (onglet === 'balance') {
      setBalance(null);
      api
        .get<BalanceAnalytique>(`/analytique/etats/balance?planId=${planId}&exerciceId=${ex}&filtre=${filtreBalance}`)
        .then(setBalance, echec);
    } else if (onglet === 'journal') {
      setJournal(null);
      api
        .get<JournalAnalytique>(`/analytique/etats/journal?planId=${planId}&exerciceId=${ex}&origine=${origineJournal}`)
        .then(setJournal, echec);
    } else if (onglet === 'grand-livre' && sectionId === NON_VENTILEES) {
      setNonVentilees(null);
      api
        .get<LignesNonVentilees>(`/analytique/etats/non-ventilees?planId=${planId}&exerciceId=${ex}`)
        .then(setNonVentilees, echec);
    } else if (onglet === 'grand-livre' && sectionId) {
      api
        .get<GrandLivreAnalytique>(`/analytique/etats/grand-livre?sectionId=${sectionId}&exerciceId=${ex}`)
        .then(setGrandLivre, echec);
    } else if (onglet === 'controle') {
      api.get<ControleCumuls[]>(`/analytique/etats/controle-cumuls?exerciceId=${ex}`).then(setControle, echec);
    } else if (onglet === 'budgetaire') {
      api
        .get<EtatBudgetaire>(
          `/analytique/etats/budgetaire?planId=${planId}&exerciceId=${ex}${mois ? `&mois=${mois}` : ''}`,
        )
        .then(setBudgetaire, echec);
    }
  }, [onglet, planId, sectionId, mois, filtreBalance, origineJournal, exerciceCourant?.id, rechargement]);

  const ongletClasse = (o: Onglet) =>
    `px-4 py-1.5 text-[11.5px] font-bold ${onglet === o ? 'bg-surface border-x border-border' : 'text-text-dim'}`;

  return (
    <div className="p-2">
      <EnteteImpression titre="États analytiques" />
      <div className="flex items-end justify-end mb-1.5 gap-3 flex-wrap">
        <div className="flex items-end gap-2.5">
          <span className="pb-1.5">
            <Aide sujet="analytique" />
          </span>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">AXE</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px] min-w-[180px]"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.intitule}
                </option>
              ))}
            </select>
          </label>
          {onglet === 'balance' && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-dim">Sections</span>
              <select
                value={filtreBalance}
                onChange={(e) => setFiltreBalance(e.target.value as FiltreBalanceAnalytique)}
                className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px]"
              >
                <option value="TOUTES">Toutes</option>
                <option value="MOUVEMENTEES">Mouvementées</option>
                <option value="NON_SOLDEES">Non soldées</option>
              </select>
            </label>
          )}
          {onglet === 'grand-livre' && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-dim">Section</span>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px] min-w-[220px]"
              >
                {sections
                  .filter((s) => s.type === 'DETAIL')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.intitule}
                    </option>
                  ))}
                <option value={NON_VENTILEES}>Lignes non ventilées de l'axe</option>
              </select>
            </label>
          )}
          {onglet === 'journal' && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-dim">Lignes</span>
              <select
                value={origineJournal}
                onChange={(e) => setOrigineJournal(e.target.value as OrigineJournalAnalytique)}
                className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px]"
              >
                <option value="TOUTES">Toutes</option>
                <option value="OD">OD analytiques seules</option>
              </select>
            </label>
          )}
          {onglet === 'budgetaire' && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-dim">Période</span>
              <select
                value={mois}
                onChange={(e) => setMois(Number(e.target.value))}
                className="border border-border rounded-[3px] bg-surface px-2 py-1 text-[11.5px]"
              >
                {MOIS.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {erreur && (
        <div className="mb-2.5 text-[11.5px] text-danger bg-danger-soft border border-danger/30 rounded-[3px] px-2.5 py-1.5">
          {erreur}
        </div>
      )}

      <div className="flex bg-chrome border border-border border-b-0 rounded-t-[10px] overflow-hidden">
        <button onClick={() => setOnglet('balance')} className={ongletClasse('balance')}>
          Balance
        </button>
        <button onClick={() => setOnglet('journal')} className={ongletClasse('journal')}>
          Journal
        </button>
        <button onClick={() => setOnglet('grand-livre')} className={ongletClasse('grand-livre')}>
          Grand livre
        </button>
        <button onClick={() => setOnglet('controle')} className={ongletClasse('controle')}>
          Contrôle des cumuls
        </button>
        <button onClick={() => setOnglet('budgetaire')} className={ongletClasse('budgetaire')}>
          Budgétaire
        </button>
      </div>

      {onglet === 'balance' && (
        <div
          // `overflow-x-auto` ici, `min-w` sur les lignes · les 614 px de colonnes
          // incompressibles du tableau ne tiennent pas dans les ~326 px utiles d'une
          // fenêtre à 360 px, et sans conteneur le débordement remontait à la fenêtre,
          // qui emportait alors titre, onglets et boutons hors de l'écran. Le panneau
          // ROGNAIT jusqu'ici (`overflow-hidden`) : la page ne partait pas de côté,
          // mais la dernière colonne était simplement invisible.
          className="border border-border bg-surface rounded-b-[10px] overflow-x-auto"
        >
          <div className="grid grid-cols-[120px_1fr_140px_140px_150px] min-w-[770px] gap-2 px-4 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim">
            <span>Section</span>
            <span>Intitulé</span>
            <span className="text-right">Mouvement débit</span>
            <span className="text-right">Mouvement crédit</span>
            <span className="text-right">SOLDE</span>
          </div>
          {!balance && <div className="px-4 py-4 text-[11.5px] text-text-dim">Chargement…</div>}
          {balance?.lignes.map((l) => (
            <div
              key={l.sectionId}
              className={`grid grid-cols-[120px_1fr_140px_140px_150px] min-w-[770px] gap-2 px-4 py-1 text-[11.5px] border-b border-border/40 ${
                l.type === 'TOTAL' ? 'bg-chrome-alt font-bold' : ''
              }`}
            >
              <span className="font-mono">{l.code}</span>
              <span>{l.intitule}</span>
              <span className="text-right font-mono">{montant(l.debit)}</span>
              <span className="text-right font-mono">{montant(l.credit)}</span>
              <span className="text-right font-mono">{montant(l.solde)}</span>
            </div>
          ))}
          {balance && balance.lignes.length === 0 && (
            <div className="px-4 py-4 text-[11.5px] text-text-dim italic">
              {balance.masquees > 0 ? 'Aucune section ne répond au filtre.' : 'Aucune section sur cet axe.'}
            </div>
          )}
          {balance && balance.masquees > 0 && (
            <div className="px-4 py-1 text-[11px] text-text-dim border-t border-border/40 flex items-center gap-1.5">
              <span>
                {balance.masquees} section(s) masquée(s) par le filtre · leurs montants restent aux totaux.
              </span>
              <Aide
                titre="Filtre de la balance"
                texte="« Mouvementées » garde les sections qui ont reçu un débit ou un crédit sur la période, « Non soldées » celles dont le solde n'est pas nul au centime. Une rubrique se juge sur le total de ses sections. Le filtre masque des lignes · les totaux restent ceux de toutes les sections Détail de l'axe."
                source="Convention d'OmegaX (Sage, balance analytique)"
              />
            </div>
          )}
          {balance && (
            <div className="grid grid-cols-[120px_1fr_140px_140px_150px] min-w-[770px] gap-2 px-4 py-1.5 bg-chrome border-t border-border text-[11.5px] font-bold">
              <span />
              <span>Total des sections Détail</span>
              <span className="text-right font-mono">{montant(balance.totaux.debit)}</span>
              <span className="text-right font-mono">{montant(balance.totaux.credit)}</span>
              <span className="text-right font-mono">{montant(balance.totaux.solde)}</span>
            </div>
          )}
        </div>
      )}

      {onglet === 'journal' && (
        <div className="border border-border bg-surface rounded-b-[10px] overflow-x-auto">
          <div className="grid grid-cols-[90px_60px_70px_110px_110px_1fr_120px_120px] min-w-[960px] gap-2 px-4 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim">
            <span>DATE</span>
            <span>JAL</span>
            <span>Pièce</span>
            <span>Section</span>
            <span>COMPTE</span>
            <span className="flex items-center gap-1">
              Libellé
              <Aide
                titre="Journal analytique"
                texte="Les ventilations des lignes du grand livre et les OD analytiques de l'axe, dans l'ordre des dates, sur l'exercice. « OD analytiques seules » ne montre que les corrections passées par la saisie des OD analytiques, au journal « OD ANA », qui ne sont pas des pièces du livre-journal. Les écritures au brouillard sont en italique. Au-delà de deux mille lignes, la liste n'en montre que les premières et le dit · les totaux portent toujours sur tout l'exercice."
                source="Convention d'OmegaX (Sage, journal analytique)"
              />
            </span>
            <span className="text-right">Débit</span>
            <span className="text-right">Crédit</span>
          </div>
          {/* Un échec de lecture se dit (bandeau du haut), jamais « Chargement… » à vie. */}
          {!journal && !erreur && <div className="px-4 py-4 text-[11.5px] text-text-dim">Chargement…</div>}
          {!journal && erreur && <div className="px-4 py-4 text-[11.5px] text-danger">Journal analytique non lu · {erreur}</div>}
          {journal?.lignes.map((l) => (
            <div
              key={l.id}
              // Le brouillard en italique, comme au grand livre des non ventilées (AUDCIF art. 22, 2°).
              title={l.statut === 'BROUILLARD' ? 'Écriture au brouillard · pas encore au livre-journal' : undefined}
              className={`grid grid-cols-[90px_60px_70px_110px_110px_1fr_120px_120px] min-w-[960px] gap-2 px-4 py-1 text-[11.5px] border-b border-border/40 ${
                l.statut === 'BROUILLARD' ? 'italic' : ''
              }`}
            >
              <span className="font-mono">{l.date}</span>
              <span className="font-mono">{l.journal}</span>
              <span className="font-mono text-text-dim">{l.numeroPiece ?? ''}</span>
              <span className="font-mono" title={l.sectionIntitule}>
                {l.sectionCode}
              </span>
              <span className="font-mono" title={l.compteIntitule}>
                {l.compteNumero}
              </span>
              <span className="truncate">{l.libelle}</span>
              <span className="text-right font-mono">{montant(l.debit)}</span>
              <span className="text-right font-mono">{montant(l.credit)}</span>
            </div>
          ))}
          {journal && journal.lignes.length === 0 && (
            <div className="px-4 py-4 text-[11.5px] text-text-dim italic">
              {journal.origine === 'OD' ? 'Aucune OD analytique sur cet axe.' : 'Aucun mouvement analytique sur cet axe.'}
            </div>
          )}
          {journal && journal.tronque && (
            <div className="px-4 py-1 text-[11px] text-text-dim border-t border-border/40">
              {journal.lignes.length} premières lignes sur {journal.total.toLocaleString('fr-FR')} · les totaux portent sur toutes.
            </div>
          )}
          {journal && (
            <div className="grid grid-cols-[90px_60px_70px_110px_110px_1fr_120px_120px] min-w-[960px] gap-2 px-4 py-1.5 bg-chrome border-t border-border text-[11.5px] font-bold">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span>Total de l'axe</span>
              <span className="text-right font-mono">{montant(journal.totaux.debit)}</span>
              <span className="text-right font-mono">{montant(journal.totaux.credit)}</span>
            </div>
          )}
        </div>
      )}

      {onglet === 'grand-livre' && sectionId === NON_VENTILEES && (
        <div className="border border-border bg-surface rounded-b-[10px] overflow-x-auto">
          <div className="px-4 py-2 bg-chrome-alt border-b border-border text-[11.5px] flex items-center gap-1.5">
            <span className="font-bold">Lignes non ventilées</span>
            {nonVentilees && (
              <span className="text-text-dim">
                · classes {nonVentilees.plan.classesVentilees.split(',').join(', ')} restées sans répartition sur l'axe
              </span>
            )}
            <Aide
              titre="Lignes non ventilées"
              texte="Les lignes du grand livre des classes que l'axe ventile, sans répartition sur lui, brouillard compris · les mêmes que celles du contrôle des cumuls, où elles se ventilent. L'écriture qui solde les comptes de gestion à la clôture n'y figure pas. Au-delà de deux mille lignes, la liste n'en montre que les premières et le dit."
              source="Convention d'OmegaX (Sage, grand livre analytique)"
            />
          </div>
          <div className="grid grid-cols-[90px_60px_70px_110px_1fr_120px_120px_130px] min-w-[940px] gap-2 px-4 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim">
            <span>DATE</span>
            <span>JAL</span>
            <span>Pièce</span>
            <span>COMPTE</span>
            <span>Libellé</span>
            <span className="text-right">Débit</span>
            <span className="text-right">Crédit</span>
            <span className="text-right">SOLDE</span>
          </div>
          {!nonVentilees && !erreur && <div className="px-4 py-4 text-[11.5px] text-text-dim">Chargement…</div>}
          {!nonVentilees && erreur && <div className="px-4 py-4 text-[11.5px] text-danger">Lignes non ventilées non lues · {erreur}</div>}
          {nonVentilees?.lignes.map((l) => (
            <div
              key={l.ligneEcritureId}
              className={`grid grid-cols-[90px_60px_70px_110px_1fr_120px_120px_130px] min-w-[940px] gap-2 px-4 py-1 text-[11.5px] border-b border-border/40 ${
                l.statut === 'BROUILLARD' ? 'italic' : ''
              }`}
            >
              <span className="font-mono">{l.date}</span>
              <span className="font-mono">{l.journal}</span>
              <span className="font-mono text-text-dim">{l.numeroPiece ?? ''}</span>
              <span className="font-mono" title={l.compteIntitule}>
                {l.compteNumero}
              </span>
              <span className="truncate">{l.libelle}</span>
              <span className="text-right font-mono">{montant(l.debit)}</span>
              <span className="text-right font-mono">{montant(l.credit)}</span>
              <span className="text-right font-mono text-text-dim">{montant(l.soldeProgressif)}</span>
            </div>
          ))}
          {nonVentilees && nonVentilees.lignes.length === 0 && (
            <div className="px-4 py-4 text-[11.5px] text-text-dim italic">Toutes les lignes de l'axe sont ventilées.</div>
          )}
          {nonVentilees && nonVentilees.tronque && (
            <div className="px-4 py-1 text-[11px] text-text-dim border-t border-border/40">
              {nonVentilees.lignes.length} premières lignes sur {nonVentilees.total.toLocaleString('fr-FR')} · les totaux portent sur toutes.
            </div>
          )}
          {nonVentilees && (
            <div className="grid grid-cols-[90px_60px_70px_110px_1fr_120px_120px_130px] min-w-[940px] gap-2 px-4 py-1.5 bg-chrome border-t border-border text-[11.5px] font-bold">
              <span />
              <span />
              <span />
              <span />
              <span>Total non ventilé</span>
              <span className="text-right font-mono">{montant(nonVentilees.totaux.debit)}</span>
              <span className="text-right font-mono">{montant(nonVentilees.totaux.credit)}</span>
              <span className="text-right font-mono">{montant(nonVentilees.totaux.solde)}</span>
            </div>
          )}
        </div>
      )}

      {onglet === 'grand-livre' && sectionId !== NON_VENTILEES && (
        <div className="border border-border bg-surface rounded-b-[10px] overflow-x-auto">
          {grandLivre && (
            <div className="px-4 py-2 bg-chrome-alt border-b border-border text-[11.5px]">
              <span className="font-mono font-bold">{grandLivre.section.code}</span> {grandLivre.section.intitule}
              {grandLivre.section.dateDebut && (
                <span className="text-text-dim">
                  {' '}
                  · {estSyscohada ? 'période du' : 'convention du'}{' '}
                  {new Date(grandLivre.section.dateDebut).toLocaleDateString('fr-FR')} au{' '}
                  {grandLivre.section.dateFin ? new Date(grandLivre.section.dateFin).toLocaleDateString('fr-FR') : '…'}
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-[90px_60px_70px_110px_1fr_120px_120px_130px_60px] min-w-[1000px] gap-2 px-4 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim">
            <span>DATE</span>
            <span>JAL</span>
            <span>Pièce</span>
            <span>COMPTE</span>
            <span>Libellé</span>
            <span className="text-right">Débit</span>
            <span className="text-right">Crédit</span>
            <span className="text-right">SOLDE</span>
            <span />
          </div>
          {!grandLivre && <div className="px-4 py-4 text-[11.5px] text-text-dim">Chargement…</div>}
          {grandLivre?.lignes.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-[90px_60px_70px_110px_1fr_120px_120px_130px_60px] min-w-[1000px] gap-2 px-4 py-1 text-[11.5px] border-b border-border/40"
            >
              <span className="font-mono">{l.date}</span>
              <span className="font-mono">{l.journal}</span>
              <span className="font-mono text-text-dim">{l.numeroPiece ?? ''}</span>
              <span className="font-mono">{l.compteNumero}</span>
              <span className="truncate">{l.libelle}</span>
              <span className="text-right font-mono">{montant(l.debit)}</span>
              <span className="text-right font-mono">{montant(l.credit)}</span>
              <span className="text-right font-mono text-text-dim">{montant(l.soldeProgressif)}</span>
              <span className="text-right">
                {peutEcrire && l.ligneEcritureId && (
                  <button
                    type="button"
                    onClick={() => void effacerVentilation(l.ligneEcritureId!)}
                    className="text-danger hover:text-danger"
                  >
                    Effacer
                  </button>
                )}
              </span>
            </div>
          ))}
          {grandLivre && grandLivre.lignes.length === 0 && (
            <div className="px-4 py-4 text-[11.5px] text-text-dim italic">Aucun mouvement ventilé sur cette section.</div>
          )}
        </div>
      )}

      {onglet === 'controle' && (
        <div className="border border-border bg-surface rounded-b-[10px] overflow-hidden p-3 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-[11.5px] text-text-dim">
            <span>Ce que cet état prouve</span>
            <Aide sujet="controleCumuls" />
          </div>
          {!controle && <div className="text-[11.5px] text-text-dim">Chargement…</div>}
          {controle?.map((c) => {
            const equilibre = Math.abs(c.ecartDebit) < 0.005 && Math.abs(c.ecartCredit) < 0.005;
            return (
              <section key={c.planId} className="border border-border rounded-[4px] overflow-x-auto">
                <header
                  className={`px-3 py-2 text-[11.5px] font-bold flex items-center justify-between ${
                    equilibre ? 'bg-positive-soft text-positive' : 'bg-warning-soft text-warning'
                  }`}
                >
                  <span>
                    {c.planIntitule} <span className="font-mono text-[11px] opacity-70">{c.planCode}</span>
                  </span>
                  <span>{equilibre ? 'Cumuls concordants' : 'Écart à ventiler'}</span>
                </header>
                <div className="grid grid-cols-[1fr_140px_140px] min-w-[470px] gap-2 px-3 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim">
                  <span />
                  <span className="text-right">Débit</span>
                  <span className="text-right">Crédit</span>
                </div>
                {[
                  ['Mouvements généraux', c.mouvementsGenerauxDebit, c.mouvementsGenerauxCredit],
                  ['Mouvements ventilés', c.mouvementsAnalytiquesDebit, c.mouvementsAnalytiquesCredit],
                  ['Écart', c.ecartDebit, c.ecartCredit],
                ].map(([libelle, d, cr], i) => (
                  <div
                    key={libelle as string}
                    className={`grid grid-cols-[1fr_140px_140px] min-w-[470px] gap-2 px-3 py-1 text-[11.5px] ${
                      i === 2 ? 'font-bold border-t border-border' : 'border-b border-border/40'
                    }`}
                  >
                    <span>{libelle}</span>
                    <span className="text-right font-mono">{montant(d as number)}</span>
                    <span className="text-right font-mono">{montant(cr as number)}</span>
                  </div>
                ))}
                {c.lignesSansRepartition.length > 0 && (
                  <div className="border-t border-border">
                    {/* Une tranche se dit (audit final F186) · les cumuls
                        ci-dessus portent toute la période, la liste seulement
                        ses premières lignes. */}
                    <div className="px-3 py-1.5 bg-chrome text-[11px] font-bold text-text-dim">
                      {c.tronque
                        ? `${c.lignesSansRepartition.length} premières sur ${c.nombreSansRepartition.toLocaleString('fr-FR')} écriture(s) sans répartition`
                        : `${c.lignesSansRepartition.length} écriture(s) sans répartition`}
                    </div>
                    <div className="max-h-[240px] overflow-y-auto">
                      {c.lignesSansRepartition.map((l, i) => (
                        <div key={i} className="border-b border-border/40">
                          <div className="flex items-center">
                            <button
                              onClick={() => navigate('/journal')}
                              className="flex-1 grid grid-cols-[90px_60px_110px_1fr_110px_110px] gap-2 px-3 py-1 text-[11.5px] text-left hover:bg-chrome-alt"
                            >
                              <span className="font-mono">{l.date}</span>
                              <span className="font-mono">{l.journal}</span>
                              <span className="font-mono">{l.compteNumero}</span>
                              <span className="truncate">{l.libelle}</span>
                              <span className="text-right font-mono">{montant(l.debit)}</span>
                              <span className="text-right font-mono">{montant(l.credit)}</span>
                            </button>
                            {peutEcrire && (
                              <button
                                type="button"
                                onClick={() => ouvrirVentilation(c.planId, l)}
                                className="px-3 text-[11.5px] text-sel hover:underline"
                              >
                                Ventiler
                              </button>
                            )}
                          </div>
                          {aVentiler?.ligneId === l.ligneId && aVentiler.planId === c.planId && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-chrome-alt text-[11.5px]">
                              <select
                                value={sectionChoisie}
                                onChange={(e) => setSectionChoisie(e.target.value)}
                                className="border border-border bg-surface px-2 py-0.5 min-w-[220px]"
                              >
                                <option value="">Section…</option>
                                {sectionsAVentiler.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code} · {s.intitule}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!sectionChoisie}
                                onClick={() => void ventiler()}
                                className="bg-sel text-white font-semibold px-3 py-0.5 disabled:opacity-50"
                              >
                                Ventiler la ligne
                              </button>
                              <button type="button" onClick={() => setAVentiler(null)} className="border border-border px-2.5 py-0.5">
                                Abandonner
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {onglet === 'budgetaire' && (
        <div className="border border-border bg-surface rounded-b-[10px] overflow-x-auto">
          {plan && !plan.gererBudgets ? (
            <div className="px-4 py-4 text-[11.5px] text-text-dim">
              L'axe {plan.intitule} ne porte pas de budget.{' '}
              <Aide
                titre="Axe sans budget"
                texte={`Le budget se tient sur l'axe des projets : ${
                  estSyscohada
                    ? "un projet n'a pas un budget par source de financement, il a un budget et plusieurs sources."
                    : "un projet cofinancé n'a pas un budget par bailleur, il a un budget et plusieurs financeurs."
                }`}
                source="États analytiques et budgétaires"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[120px_1fr_140px_140px_140px_100px] min-w-[870px] gap-2 px-4 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim">
                <span>Section</span>
                <span>Intitulé</span>
                <span className="text-right">BUDGET</span>
                <span className="text-right">Réalisé</span>
                <span className="text-right flex items-center justify-end gap-1">
                  Écart
                  <Aide
                    titre="Écart budgétaire"
                    texte={`Une section mouvementée sans dotation apparaît en rouge, marquée « hors budget » : ${
                      estSyscohada ? 'pour la direction' : 'pour un financeur'
                    }, c'est la ligne la plus importante de l'état. Un écart négatif signale un dépassement.`}
                    source="États analytiques et budgétaires"
                  />
                </span>
                <span className="text-right">Consommé</span>
              </div>
              {!budgetaire && <div className="px-4 py-4 text-[11.5px] text-text-dim">Chargement…</div>}
              {budgetaire?.lignes.map((l) => (
                <div
                  key={l.sectionId}
                  /*
                    Une RUBRIQUE est un SOUS-TOTAL et se lit comme tel · elle
                    n'est ni dotée ni ventilée, elle additionne ses feuilles.
                    Sans cette distinction visuelle, ses montants se lisent
                    comme une ligne de plus et le tableau paraît compter deux
                    fois ce qu'il totalise une fois.
                  */
                  className={`grid grid-cols-[120px_1fr_140px_140px_140px_100px] min-w-[870px] gap-2 px-4 py-1 text-[11.5px] border-b border-border/40 ${
                    l.estRubrique
                      ? 'font-bold bg-surface-alt border-y border-border'
                      : l.horsBudget
                        ? 'bg-danger-soft'
                        : l.ecart < 0
                          ? 'bg-warning-soft'
                          : ''
                  }`}
                >
                  <span className="font-mono">{l.code}</span>
                  <span>
                    {l.intitule}
                    {l.horsBudget && <span className="ml-2 text-[11px] font-bold text-danger">hors budget</span>}
                  </span>
                  <span className="text-right font-mono">{montant(l.budget)}</span>
                  <span className="text-right font-mono">{montant(l.realise)}</span>
                  <span className={`text-right font-mono ${l.ecart < 0 ? 'text-danger font-bold' : ''}`}>
                    {montant(l.ecart)}
                  </span>
                  <span className="text-right font-mono text-text-dim">
                    {l.tauxConsommation !== null ? `${l.tauxConsommation.toFixed(0)} %` : ''}
                  </span>
                </div>
              ))}
              {budgetaire && (
                <div className="grid grid-cols-[120px_1fr_140px_140px_140px_100px] min-w-[870px] gap-2 px-4 py-1.5 bg-chrome border-t border-border text-[11.5px] font-bold">
                  <span />
                  <span>Total</span>
                  <span className="text-right font-mono">{montant(budgetaire.totaux.budget)}</span>
                  <span className="text-right font-mono">{montant(budgetaire.totaux.realise)}</span>
                  <span className="text-right font-mono">{montant(budgetaire.totaux.ecart)}</span>
                  <span className="text-right font-mono">
                    {budgetaire.totaux.tauxConsommation !== null
                      ? `${budgetaire.totaux.tauxConsommation.toFixed(0)} %`
                      : ''}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
