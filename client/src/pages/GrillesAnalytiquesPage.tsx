import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import type { Compte, PlanAnalytique, SectionAnalytique } from '../lib/types';
import { enPointsDeBase, resumeDeLaGrille, type ListeGrillesAnalytiques } from '../lib/grille-analytique';

/**
 * GRILLES ANALYTIQUES DES COMPTES (fonction n° 48) · Structure → Grilles
 * analytiques. Sage rattache au compte général une grille qui répartit ses
 * lignes entre des sections ; la saisie la PROPOSE quand le compte est choisi,
 * jamais imposée. Une grille par compte et par axe, en pourcentages qui font
 * 100, sur des sections Détail actives.
 *
 * Une STRUCTURE du dossier · posée et retirée par l'administrateur, comme le
 * plan analytique ; la liste se lit par tous. Les refus sont ceux du serveur
 * (`motifRefusGrille`), dits tels quels.
 */

type LigneSaisie = { sectionId: string; pourcentage: string };

const LIGNE_VIDE: LigneSaisie = { sectionId: '', pourcentage: '' };

export function GrillesAnalytiquesPage() {
  const { estAdmin } = useAuth();
  // Toutes les listes partent de null · un refus ne se lit pas comme « aucune ».
  const [liste, setListe] = useState<ListeGrillesAnalytiques | null>(null);
  const [plans, setPlans] = useState<PlanAnalytique[] | null>(null);
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [sections, setSections] = useState<SectionAnalytique[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const [planId, setPlanId] = useState('');
  const [compteId, setCompteId] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([{ ...LIGNE_VIDE }]);

  const echec = (e: unknown, defaut: string) => setErreur(e instanceof ApiError ? e.message : defaut);

  const recharger = () =>
    api.get<ListeGrillesAnalytiques>('/analytique/grilles').then(setListe, (e) => echec(e, 'Les grilles n’ont pas pu être lues.'));

  useEffect(() => {
    void recharger();
    api.get<PlanAnalytique[]>('/analytique/plans').then(
      (ps) => {
        const actifs = ps.filter((p) => p.estActif);
        setPlans(actifs);
        // Un choix unique se présélectionne.
        if (actifs.length === 1) setPlanId(actifs[0].id);
      },
      (e) => echec(e, 'Les axes analytiques n’ont pas pu être lus.'),
    );
    if (estAdmin) {
      api
        .get<Compte[]>('/comptes?actifsSeuls=true&typeCompte=DETAIL&retenus=true')
        .then(setComptes, (e) => echec(e, 'Les comptes n’ont pas pu être lus.'));
    }
  }, [estAdmin]);

  useEffect(() => {
    if (!planId) {
      setSections(null);
      return;
    }
    setSections(null);
    api.get<SectionAnalytique[]>(`/analytique/plans/${planId}/sections`).then(
      (r) => setSections(r.filter((s) => s.type === 'DETAIL' && s.estActive)),
      (e) => echec(e, 'Les sections de l’axe n’ont pas pu être lues.'),
    );
  }, [planId]);

  const plan = plans?.find((p) => p.id === planId) ?? null;
  // Seuls les comptes des classes que l'axe ventile · le serveur refuserait les autres.
  const comptesDeLAxe = useMemo(() => {
    if (!plan || !comptes) return null;
    const classes = plan.classesVentilees.split(',');
    return comptes.filter((c) => classes.includes(c.classe.replace('CLASSE_', '')));
  }, [plan, comptes]);

  const totalPoints = lignes.reduce((t, l) => t + (enPointsDeBase(Number(l.pourcentage.replace(',', '.'))) ?? 0), 0);

  const modifier = (id: string) => {
    const g = liste?.grilles.find((x) => x.id === id);
    if (!g) return;
    setPlanId(g.plan.id);
    setCompteId(g.compte.id);
    setLignes(g.lignes.map((l) => ({ sectionId: l.sectionId, pourcentage: String(l.pourcentage).replace('.', ',') })));
    setInfo(null);
    setErreur(null);
  };

  const enregistrer = async () => {
    setErreur(null);
    setInfo(null);
    const corps = {
      compteId,
      planId,
      lignes: lignes
        .filter((l) => l.sectionId || l.pourcentage)
        .map((l) => ({ sectionId: l.sectionId, pourcentage: Number(l.pourcentage.replace(',', '.')) })),
    };
    setEnvoi(true);
    try {
      const r = await api.post<ListeGrillesAnalytiques>('/analytique/grilles', corps);
      setListe(r);
      setInfo('Grille enregistrée · la saisie la proposera pour ce compte sur cet axe.');
      setCompteId('');
      setLignes([{ ...LIGNE_VIDE }]);
    } catch (e) {
      echec(e, 'La grille n’a pas pu être enregistrée.');
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (id: string, nom: string) => {
    if (!window.confirm(`Retirer la grille ${nom} ? La saisie ne la proposera plus ; aucune écriture passée ne change.`)) return;
    setErreur(null);
    setInfo(null);
    try {
      await api.delete(`/analytique/grilles/${id}`);
      await recharger();
      setInfo('Grille retirée.');
    } catch (e) {
      echec(e, 'La grille n’a pas pu être retirée.');
    }
  };

  return (
    <div className="p-2 flex flex-col gap-2">
      <EnteteImpression titre="Grilles analytiques" />
      <div className="flex items-center gap-1.5 text-[11.5px] text-text-dim">
        <span>Répartition par défaut d'un compte entre les sections d'un axe</span>
        <Aide
          titre="Grille analytique"
          texte="Une grille dit comment les lignes d'un compte se répartissent entre les sections d'un axe, en pourcentages qui font exactement 100. À la saisie, quand ce compte est choisi, l'axe propose « Grille » · la ligne se répartit au centime, le centime qui reste allant à la section dont la part tronquée est la plus forte, à égalité par le code. La proposition se garde, se remplace par une section ou s'efface · elle n'est jamais imposée, et ni les modules ni les imports ne l'appliquent. Une section passée en sommeil suspend la grille, qui le dit. L'usage de l'analytique est laissé à l'initiative des entités (SYCEBNL, Partie 2 ch. 3, classe 9 ; AUDCIF, Titre VII, classe 9)."
          source="Convention d'OmegaX (Sage, grille analytique du compte)"
        />
      </div>

      {erreur && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 rounded-[3px] px-2.5 py-1.5">{erreur}</div>
      )}
      {info && (
        <div className="text-[11.5px] text-positive bg-positive-soft border border-positive/30 rounded-[3px] px-2.5 py-1.5">{info}</div>
      )}

      <div className="border border-border bg-surface rounded-[10px] overflow-x-auto">
        <div className="grid grid-cols-[110px_1fr_90px_1.4fr_150px] min-w-[820px] gap-2 px-4 py-1.5 bg-chrome-alt border-b border-border text-[11px] font-bold text-text-dim">
          <span>COMPTE</span>
          <span>Intitulé</span>
          <span>Axe</span>
          <span>Répartition</span>
          <span />
        </div>
        {!liste && !erreur && <div className="px-4 py-4 text-[11.5px] text-text-dim">Chargement…</div>}
        {liste?.grilles.map((g) => (
          <div
            key={g.id}
            className={`grid grid-cols-[110px_1fr_90px_1.4fr_150px] min-w-[820px] gap-2 px-4 py-1 text-[11.5px] border-b border-border/40 items-center ${
              g.inapplicable ? 'bg-warning-soft' : ''
            }`}
          >
            <span className="font-mono">{g.compte.numero}</span>
            <span className="truncate">{g.compte.intitule}</span>
            <span className="font-mono" title={g.plan.intitule}>
              {g.plan.code}
            </span>
            <span className="truncate" title={g.inapplicable ?? resumeDeLaGrille(g)}>
              {resumeDeLaGrille(g)}
              {g.inapplicable && <span className="ml-2 text-[11px] font-bold text-warning">suspendue · {g.inapplicable}</span>}
            </span>
            <span className="text-right flex gap-3 justify-end">
              {estAdmin && (
                <>
                  <button type="button" onClick={() => modifier(g.id)} className="text-sel hover:underline">
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => void retirer(g.id, `${g.compte.numero} / ${g.plan.code}`)}
                    className="text-danger hover:underline"
                  >
                    Retirer
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
        {liste && liste.grilles.length === 0 && (
          <div className="px-4 py-4 text-[11.5px] text-text-dim italic">Aucune grille dans ce dossier.</div>
        )}
        {liste?.tronque && (
          <div className="px-4 py-1 text-[11px] text-text-dim border-t border-border/40">
            {liste.grilles.length} premières grilles sur {liste.total.toLocaleString('fr-FR')}.
          </div>
        )}
      </div>

      {estAdmin && (
        <div className="border border-border bg-surface rounded-[10px] p-3 flex flex-col gap-2 text-[11.5px]">
          <div className="font-bold">Poser une grille</div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-dim">Axe</span>
              <select
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  setCompteId('');
                  setLignes([{ ...LIGNE_VIDE }]);
                }}
                className="border border-border rounded-[3px] bg-surface px-2 py-1 min-w-[180px]"
              >
                <option value="">{plans === null ? 'Chargement…' : plans.length === 0 ? 'Aucun axe actif' : 'Axe…'}</option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.intitule}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-dim">Compte</span>
              <select
                value={compteId}
                disabled={!plan}
                onChange={(e) => setCompteId(e.target.value)}
                className="border border-border rounded-[3px] bg-surface px-2 py-1 min-w-[280px] disabled:opacity-50"
              >
                <option value="">
                  {!plan
                    ? "Choisissez d'abord l'axe"
                    : comptesDeLAxe === null
                      ? 'Chargement…'
                      : comptesDeLAxe.length === 0
                        ? `Aucun compte personnalisé des classes ${plan.classesVentilees} · personnalisez-le dans Plan comptable`
                        : 'Compte…'}
                </option>
                {comptesDeLAxe?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.intitule}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {plan && (
            <div className="flex flex-col gap-1">
              {lignes.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={l.sectionId}
                    onChange={(e) => setLignes((prev) => prev.map((x, j) => (j === i ? { ...x, sectionId: e.target.value } : x)))}
                    className="border border-border rounded-[3px] bg-surface px-2 py-0.5 min-w-[260px]"
                  >
                    <option value="">
                      {sections === null ? 'Chargement…' : sections.length === 0 ? "Aucune section Détail active sur l'axe" : 'Section…'}
                    </option>
                    {sections?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.intitule}
                      </option>
                    ))}
                  </select>
                  <input
                    value={l.pourcentage}
                    inputMode="decimal"
                    onChange={(e) => setLignes((prev) => prev.map((x, j) => (j === i ? { ...x, pourcentage: e.target.value } : x)))}
                    placeholder="%"
                    aria-label={`Pourcentage de la ligne ${i + 1}`}
                    className="border border-border rounded-[3px] px-2 py-0.5 w-[80px] text-right"
                  />
                  <span className="text-text-dim">%</span>
                  {lignes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLignes((prev) => prev.filter((_, j) => j !== i))}
                      className="text-danger hover:underline"
                    >
                      Retirer la ligne
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLignes((prev) => [...prev, { ...LIGNE_VIDE }])}
                  className="border border-border px-2.5 py-0.5"
                >
                  Ajouter une section
                </button>
                <span className={totalPoints === 10_000 ? 'text-positive font-bold' : 'text-warning font-bold'}>
                  Total {(totalPoints / 100).toFixed(2).replace('.', ',')} %
                </span>
                <button
                  type="button"
                  disabled={envoi || !compteId}
                  onClick={() => void enregistrer()}
                  className="bg-sel text-white font-semibold px-4 py-1 rounded-full disabled:opacity-50"
                >
                  Enregistrer la grille
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
