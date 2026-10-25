import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { Aide } from '../components/chrome/Aide';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import type {
  BonCommandeDetail,
  BonCommandeResume,
  FactureExecutable,
  PlanAnalytique,
  SectionAnalytique,
  StatutBonCommande,
  Tiers,
} from '../lib/types';
import { montant } from '../lib/montants';
import { montantSaisi } from '../lib/montant-saisi';
import { corpsDesLignes, ligneVierge, partProposee, totalLigneCentimes, type LigneSaisie } from '../lib/bon-commande';

/**
 * BONS DE COMMANDE FOURNISSEUR (ligne microfina-m2, idée 2).
 *
 * Le bon remis FAIT NAÎTRE l'engagement de dépense de chacune de ses lignes
 * budgétaires (SYCEBNL, Guide d'application, ch. 7, Application 22, règle
 * (d)) ; la facture d'achat passée au journal l'exécute. Aucune écriture à la
 * commande. Le serveur juge seul · l'écran lit, propose, et dit les refus.
 */

const STATUTS: Record<StatutBonCommande, string> = { BROUILLON: 'Brouillon', REMIS: 'Remis', CLOS: 'Clos' };

const jourFr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '·');

export function BonsCommandePage() {
  const { peutEcrire } = useAuth();
  const { exerciceCourant } = useExercice();
  const exerciceId = exerciceCourant?.id;
  const modifiable = peutEcrire && exerciceCourant?.statut !== 'CLOTURE';

  // null tant que rien n'est lu · « aucun bon » ne se dit que sur une liste lue.
  const [registre, setRegistre] = useState<{ bons: BonCommandeResume[]; total: number; tronque: boolean } | null>(null);
  const [erreurRegistre, setErreurRegistre] = useState<string | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Tiers[] | null>(null);
  const [sections, setSections] = useState<SectionAnalytique[] | null>(null);
  const [erreurListes, setErreurListes] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [detail, setDetail] = useState<BonCommandeDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Une réponse arrivée après un changement d'exercice ou de bon est jetée.
  const jeton = useRef(0);

  // Formulaire du brouillon (création ou retouche).
  const [edition, setEdition] = useState<{ id: string | null } | null>(null);
  const [tiersId, setTiersId] = useState('');
  const [objet, setObjet] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVierge()]);

  // Gestes sur le bon choisi.
  const [dateRemise, setDateRemise] = useState('');
  const [motifCloture, setMotifCloture] = useState('');
  const [factures, setFactures] = useState<{ factures: FactureExecutable[]; total: number; tronque: boolean } | null>(null);
  const [factureId, setFactureId] = useState('');
  const [parts, setParts] = useState<Record<string, string>>({});

  const chargerRegistre = useCallback(async () => {
    if (!exerciceId) return;
    const j = ++jeton.current;
    try {
      const r = await api.get<{ bons: BonCommandeResume[]; total: number; tronque: boolean }>(`/bons-commande?exerciceId=${exerciceId}`);
      if (j === jeton.current) {
        setRegistre(r);
        setErreurRegistre(null);
      }
    } catch (e) {
      if (j === jeton.current) setErreurRegistre(e instanceof ApiError ? e.message : 'Registre illisible.');
    }
  }, [exerciceId]);

  const chargerDetail = useCallback(async (id: string) => {
    try {
      setDetail(await api.get<BonCommandeDetail>(`/bons-commande/${id}`));
    } catch (e) {
      setDetail(null);
      setErreur(e instanceof ApiError ? e.message : 'Bon illisible.');
    }
  }, []);

  useEffect(() => {
    setRegistre(null);
    setChoisi(null);
    setDetail(null);
    void chargerRegistre();
  }, [chargerRegistre]);

  useEffect(() => {
    // Fournisseurs et lignes budgétaires partent ensemble · deux appels indépendants.
    (async () => {
      try {
        const [tiers, plans] = await Promise.all([api.get<Tiers[]>('/tiers?actifsSeuls=true'), api.get<PlanAnalytique[]>('/analytique/plans')]);
        setFournisseurs(tiers.filter((t) => t.type === 'FOURNISSEUR'));
        const budgetaires = plans.filter((p) => p.gererBudgets && p.estActif);
        const listes = await Promise.all(budgetaires.map((p) => api.get<SectionAnalytique[]>(`/analytique/plans/${p.id}/sections`)));
        setSections(listes.flat().filter((s) => s.estActive && s.type === 'DETAIL'));
      } catch (e) {
        setFournisseurs([]);
        setSections([]);
        setErreurListes(e instanceof ApiError ? e.message : 'Fournisseurs ou lignes budgétaires illisibles.');
      }
    })();
  }, []);

  useEffect(() => {
    setFactures(null);
    setFactureId('');
    setParts({});
    setMotifCloture('');
    if (choisi) void chargerDetail(choisi);
    else setDetail(null);
  }, [choisi, chargerDetail]);

  function ouvrirCreation() {
    setEdition({ id: null });
    setTiersId(fournisseurs?.length === 1 ? fournisseurs[0].id : '');
    setObjet('');
    setLignes([ligneVierge()]);
  }

  function ouvrirRetouche(d: BonCommandeDetail) {
    setEdition({ id: d.id });
    setTiersId(d.tiers.id);
    setObjet(d.objet);
    setLignes(
      d.lignes.map((l) => ({
        designation: l.designation,
        quantite: String(l.quantite),
        prixUnitaire: String(l.prixUnitaire),
        montantTva: l.montantTva ? String(l.montantTva) : '',
        sectionId: l.section.id,
      })),
    );
  }

  async function geste(f: () => Promise<unknown>, succes: string) {
    setErreur(null);
    setInfo(null);
    setEnvoi(true);
    try {
      const r = (await f()) as { avertissements?: string[] } | undefined;
      setInfo([succes, ...(r?.avertissements ?? [])].join(' '));
      await chargerRegistre();
      if (choisi) await chargerDetail(choisi);
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Geste impossible.');
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  async function onEnregistrer(e: FormEvent) {
    e.preventDefault();
    const corps = corpsDesLignes(lignes);
    if ('motif' in corps) {
      setErreur(corps.motif);
      return;
    }
    const id = edition?.id;
    const ok = await geste(
      () =>
        id
          ? api.put(`/bons-commande/${id}`, { tiersId, objet, lignes: corps.lignes })
          : api.post<{ id: string }>('/bons-commande', { exerciceId, tiersId, objet, lignes: corps.lignes }).then((r) => {
              setChoisi(r.id);
              return r;
            }),
      'Brouillon enregistré · il n’engage rien tant qu’il n’est pas remis.',
    );
    if (ok) setEdition(null);
  }

  async function chargerFactures() {
    if (!detail) return;
    try {
      const r = await api.get<{ factures: FactureExecutable[]; total: number; tronque: boolean }>(`/bons-commande/${detail.id}/factures-executables`);
      setFactures(r);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Factures illisibles.');
    }
  }

  function choisirFacture(id: string) {
    setFactureId(id);
    const f = factures?.factures.find((x) => x.id === id);
    const p = detail && f ? partProposee(detail.parSection, f.disponible) : null;
    setParts(p !== null && detail?.parSection[0]?.section ? { [detail.parSection[0].section.id]: String(p) } : {});
  }

  async function onExecuter(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const lues = Object.entries(parts)
      .filter(([, v]) => v.trim() !== '')
      .map(([sectionId, v]) => ({ sectionId, montant: montantSaisi(v) }));
    if (lues.some((p) => p.montant === null)) {
      setErreur('Une part est illisible.');
      return;
    }
    const ok = await geste(
      () => api.post(`/bons-commande/${detail.id}/executions`, { factureId, parts: lues }),
      'Facture rattachée · le reste à facturer a baissé d’autant.',
    );
    if (ok) {
      setFactures(null);
      setFactureId('');
      setParts({});
    }
  }

  const totalSaisi = lignes.reduce<number | null>((s, l) => {
    const t = totalLigneCentimes(l);
    return s === null || t === null ? null : s + t;
  }, 0);

  return (
    <div className="flex flex-col gap-3 p-3">
      <EnteteImpression titre="Bons de commande fournisseur" sousTitre="Engagements de dépense nés des bons remis, exécutés par les factures d'achat" />

      <div className="ecran-seul flex items-center justify-end gap-2">
        {modifiable && (
          <button type="button" onClick={ouvrirCreation} className="bg-sel px-3 py-1 text-[11.5px] font-bold text-white">
            Nouveau bon
          </button>
        )}
        <Aide
          titre="Le bon de commande et l'engagement"
          texte={
            "Un bon au brouillon n'engage rien. À sa remise au fournisseur, il est numéroté et fait naître un engagement par ligne " +
            "budgétaire, pour le montant toutes taxes prévu · c'est le terme « bons de commande remis, non exécutés » de la colonne " +
            "Engagement. La facture d'achat du même fournisseur, passée au journal et validée, l'exécute pour la part de chaque ligne " +
            "que vous déclarez · la dépense quitte alors la colonne Engagement en entrant au compte 40. Une facture d'un exercice " +
            "suivant réduit le reste à facturer sans toucher l'engagement de l'exercice du bon. Aucune écriture n'est passée à la commande."
          }
          source="SYCEBNL, Guide d'application, ch. 7, Application 22, règle (d) ; fiche du compte 40 ; CPCC, ch. 1 § 1.1.1 et § 1.2"
        />
      </div>

      {erreur && <div className="ecran-seul border border-danger bg-danger/10 px-3 py-1.5 text-[11.5px]">{erreur}</div>}
      {info && <div className="ecran-seul border border-border bg-surface-alt px-3 py-1.5 text-[11.5px]">{info}</div>}
      {erreurListes && <div className="ecran-seul border border-danger bg-danger/10 px-3 py-1.5 text-[11.5px]">{erreurListes}</div>}

      {edition && (
        <form onSubmit={(e) => void onEnregistrer(e)} className="ecran-seul flex flex-col gap-2 border border-border bg-surface px-3 py-2">
          <div className="text-[11.5px] font-bold">{edition.id ? 'Brouillon du bon' : 'Nouveau bon de commande'}</div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-dim">Fournisseur</span>
              <select value={tiersId} onChange={(e) => setTiersId(e.target.value)} required className="w-[260px] border border-border-dark bg-surface px-2 py-1 text-[11.5px]">
                <option value="">Choisir un fournisseur…</option>
                {(fournisseurs ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {t.nom}
                  </option>
                ))}
              </select>
              {fournisseurs?.length === 0 && !erreurListes && (
                <span className="text-[11px] text-warning">Aucun fournisseur actif · créez-le d'abord (Structure &gt; Plan tiers).</span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-dim">Objet</span>
              <input value={objet} onChange={(e) => setObjet(e.target.value)} required maxLength={300} className="w-[320px] border border-border-dark bg-surface px-2 py-1 text-[11.5px]" />
            </label>
          </div>
          {sections?.length === 0 && !erreurListes && (
            <span className="text-[11px] text-warning">
              Aucune ligne budgétaire · déclarez un plan analytique qui gère les budgets, avec ses sections de détail (Structure &gt; Plans analytiques).
            </span>
          )}
          <table className="w-full max-w-[1100px] text-[11.5px]">
            <thead>
              <tr>
                <th className="text-left">Désignation</th>
                <th className="text-right">Quantité</th>
                <th className="text-right">Prix unitaire</th>
                <th className="text-right" title="La taxe que portera la facture · saisie, aucun taux n'est deviné">Taxe prévue</th>
                <th className="text-left">Ligne budgétaire</th>
                <th className="text-right">Total TTC</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => {
                const maj = (champ: keyof LigneSaisie, v: string) => setLignes((p) => p.map((x, k) => (k === i ? { ...x, [champ]: v } : x)));
                const t = totalLigneCentimes(l);
                return (
                  <tr key={i}>
                    <td>
                      <input value={l.designation} onChange={(e) => maj('designation', e.target.value)} maxLength={300} className="w-full border border-border-dark bg-surface px-1 py-0.5" />
                    </td>
                    <td>
                      <input value={l.quantite} onChange={(e) => maj('quantite', e.target.value)} inputMode="decimal" className="w-[80px] border border-border-dark bg-surface px-1 py-0.5 text-right" />
                    </td>
                    <td>
                      <input value={l.prixUnitaire} onChange={(e) => maj('prixUnitaire', e.target.value)} inputMode="decimal" className="w-[120px] border border-border-dark bg-surface px-1 py-0.5 text-right" />
                    </td>
                    <td>
                      <input value={l.montantTva} onChange={(e) => maj('montantTva', e.target.value)} inputMode="decimal" className="w-[110px] border border-border-dark bg-surface px-1 py-0.5 text-right" />
                    </td>
                    <td>
                      <select value={l.sectionId} onChange={(e) => maj('sectionId', e.target.value)} className="w-[230px] border border-border-dark bg-surface px-1 py-0.5">
                        <option value="">Choisir…</option>
                        {(sections ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} · {s.intitule}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right">{t === null ? '·' : montant(t / 100)}</td>
                    <td>
                      {lignes.length > 1 && (
                        <button type="button" onClick={() => setLignes((p) => p.filter((_, k) => k !== i))} className="border border-border px-1">
                          Retirer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setLignes((p) => [...p, ligneVierge()])} className="border border-border-dark px-2 py-0.5 text-[11.5px]">
              Ajouter une ligne
            </button>
            <span className="text-[11.5px] text-text-dim">Total TTC prévu · {totalSaisi === null ? '·' : montant(totalSaisi / 100)}</span>
            <span className="flex-1" />
            <button type="button" onClick={() => setEdition(null)} className="border border-border-dark px-3 py-1 text-[11.5px]">
              Annuler
            </button>
            <button type="submit" disabled={envoi} className="bg-sel px-3 py-1 text-[11.5px] font-bold text-white disabled:opacity-60">
              Enregistrer le brouillon
            </button>
          </div>
        </form>
      )}

      {erreurRegistre && <div className="border border-danger bg-danger/10 px-3 py-1.5 text-[11.5px]">{erreurRegistre}</div>}
      {registre === null && !erreurRegistre && <div className="text-[11.5px] text-text-dim">Lecture du registre…</div>}
      {registre && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[11.5px]">
            <thead>
              <tr>
                <th className="text-left">N°</th>
                <th className="text-left">Remis le</th>
                <th className="text-left">Fournisseur</th>
                <th className="text-left">Objet</th>
                <th className="text-right">Montant TTC</th>
                <th className="text-right">Reste à facturer</th>
                <th className="text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {registre.bons.map((b) => (
                <tr key={b.id} onClick={() => setChoisi(b.id)} className={`cursor-pointer ${choisi === b.id ? 'bg-a-50' : ''}`}>
                  <td>{b.numero ?? '·'}</td>
                  <td>{jourFr(b.dateRemise)}</td>
                  <td>{b.fournisseurNom ?? '·'}</td>
                  <td className="max-w-[320px] truncate">{b.objet}</td>
                  <td className="text-right">{montant(b.montantTTC)}</td>
                  <td className={`text-right ${b.statut === 'CLOS' ? 'text-text-dim line-through' : 'font-semibold'}`}>{montant(b.statut === 'CLOS' ? b.resteAvantCloture : b.resteAFacturer)}</td>
                  <td>{STATUTS[b.statut]}</td>
                </tr>
              ))}
              {registre.bons.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-text-dim">
                    Aucun bon de commande sur cet exercice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {registre.tronque && (
            <div className="text-[11px] text-warning">
              {registre.bons.length} bons affichés sur {registre.total} · les plus récents d'abord.
            </div>
          )}
        </div>
      )}

      {detail && (
        <div className="flex flex-col gap-2 border border-border bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
            <span className="font-bold">
              {detail.numero ? `Bon n° ${detail.numero}` : 'Bon au brouillon'} · {detail.fournisseurNom ?? detail.tiers.nom}
            </span>
            <span>{STATUTS[detail.statut]}</span>
            {detail.dateRemise && <span>Remis le {jourFr(detail.dateRemise)}</span>}
            {detail.statut === 'CLOS' && detail.motifCloture && <span className="text-text-dim">Clos · {detail.motifCloture}</span>}
          </div>
          <div className="text-[11.5px]">{detail.objet}</div>
          <table className="w-full max-w-[1000px] text-[11.5px]">
            <thead>
              <tr>
                <th className="text-left">Désignation</th>
                <th className="text-right">Quantité</th>
                <th className="text-right">Prix unitaire</th>
                <th className="text-right">Montant HT</th>
                <th className="text-right">Taxe prévue</th>
                <th className="text-left">Ligne budgétaire</th>
              </tr>
            </thead>
            <tbody>
              {detail.lignes.map((l) => (
                <tr key={l.id}>
                  <td>{l.designation}</td>
                  <td className="text-right">{l.quantite}</td>
                  <td className="text-right">{montant(l.prixUnitaire)}</td>
                  <td className="text-right">{montant(l.montantHT)}</td>
                  <td className="text-right">{montant(l.montantTva)}</td>
                  <td>
                    {l.section.code} · {l.section.intitule}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {detail.statut !== 'BROUILLON' && (
            <table className="w-full max-w-[800px] text-[11.5px]">
              <thead>
                <tr>
                  <th className="text-left">Ligne budgétaire</th>
                  <th className="text-left">Engagement</th>
                  <th className="text-right">Engagé TTC</th>
                  <th className="text-right">Reste à facturer</th>
                </tr>
              </thead>
              <tbody>
                {detail.parSection.map((p, i) => (
                  <tr key={p.section?.id ?? i}>
                    <td>{p.section ? `${p.section.code} · ${p.section.intitule}` : '·'}</td>
                    <td>{p.engagement ? `${p.engagement.reference}${p.engagement.statut === 'CLOS' ? ' (clos)' : ''}` : '·'}</td>
                    <td className="text-right">{montant(p.engage)}</td>
                    <td className="text-right font-semibold">{montant(p.resteAFacturer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {detail.factures.length > 0 && (
            <div className="flex flex-col gap-1 text-[11.5px]">
              {detail.factures.map((f) => (
                <div key={f.factureId} className="flex flex-wrap items-center gap-2">
                  <span>
                    Facture {f.numeroSerie} du {jourFr(f.dateFacture)} · pièce {f.numeroPiece ?? '·'}
                  </span>
                  <span className="text-text-dim">{f.parts.map((p) => `${p.section} ${montant(p.montant)}`).join(' · ')}</span>
                  {!f.engagementExecute && <span className="text-text-dim">exercice suivant · engagement inchangé</span>}
                  {modifiable && (
                    <button
                      type="button"
                      disabled={envoi}
                      onClick={() => void geste(() => api.delete(`/bons-commande/${detail.id}/executions/${f.factureId}`), 'Facture retirée · le reste à facturer remonte d’autant.')}
                      className="ecran-seul border border-border px-1"
                    >
                      Retirer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {modifiable && (
            <div className="ecran-seul flex flex-wrap items-end gap-2 border-t border-border pt-2">
              {detail.statut === 'BROUILLON' && (
                <>
                  <button type="button" onClick={() => ouvrirRetouche(detail)} className="border border-border-dark px-2 py-1 text-[11.5px]">
                    Modifier
                  </button>
                  <button
                    type="button"
                    disabled={envoi}
                    onClick={() => void geste(() => api.delete(`/bons-commande/${detail.id}`), 'Brouillon supprimé.').then((ok) => ok && setChoisi(null))}
                    className="border border-border-dark px-2 py-1 text-[11.5px]"
                  >
                    Supprimer
                  </button>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text-dim">Remis le</span>
                    <input
                      type="date"
                      value={dateRemise}
                      onChange={(e) => setDateRemise(e.target.value)}
                      min={exerciceCourant?.dateDebut?.slice(0, 10)}
                      max={exerciceCourant?.dateFin?.slice(0, 10)}
                      className="border border-border-dark bg-surface px-2 py-1 text-[11.5px]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={envoi || !dateRemise}
                    onClick={() => void geste(() => api.post(`/bons-commande/${detail.id}/remise`, { dateRemise }), 'Bon remis · il engage désormais le budget de ses lignes.')}
                    className="bg-sel px-3 py-1 text-[11.5px] font-bold text-white disabled:opacity-60"
                  >
                    Remettre au fournisseur
                  </button>
                </>
              )}
              {detail.statut === 'REMIS' && (
                <>
                  {factures === null ? (
                    <button type="button" onClick={() => void chargerFactures()} className="border border-border-dark px-2 py-1 text-[11.5px]">
                      Rattacher une facture
                    </button>
                  ) : (
                    <form onSubmit={(e) => void onExecuter(e)} className="flex flex-wrap items-end gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-text-dim" title="Factures d'achat du fournisseur, passées au journal et validées">
                          Facture d'achat
                        </span>
                        <select value={factureId} onChange={(e) => choisirFacture(e.target.value)} required className="w-[340px] border border-border-dark bg-surface px-2 py-1 text-[11.5px]">
                          <option value="">Choisir une facture…</option>
                          {factures.factures.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.numeroSerie} du {jourFr(f.dateFacture)} · {montant(f.montantTTC)} · disponible {montant(f.disponible)}
                            </option>
                          ))}
                        </select>
                        {factures.factures.length === 0 && (
                          <span className="text-[11px] text-warning">Aucune facture de ce fournisseur n'est passée au journal et validée · passez-la depuis Facturation.</span>
                        )}
                        {factures.tronque && <span className="text-[11px] text-warning">{factures.factures.length} factures affichées sur {factures.total}.</span>}
                      </label>
                      {detail.parSection.map((p) =>
                        p.section ? (
                          <label key={p.section.id} className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold text-text-dim">Part · {p.section.code}</span>
                            <input
                              value={parts[p.section.id] ?? ''}
                              onChange={(e) => setParts((x) => ({ ...x, [p.section!.id]: e.target.value }))}
                              inputMode="decimal"
                              placeholder={`reste ${montant(p.resteAFacturer)}`}
                              className="w-[140px] border border-border-dark bg-surface px-2 py-1 text-right text-[11.5px]"
                            />
                          </label>
                        ) : null,
                      )}
                      <button type="submit" disabled={envoi || !factureId} className="bg-sel px-3 py-1 text-[11.5px] font-bold text-white disabled:opacity-60">
                        Rattacher
                      </button>
                    </form>
                  )}
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-text-dim">Motif de clôture</span>
                    <input value={motifCloture} onChange={(e) => setMotifCloture(e.target.value)} maxLength={500} className="w-[260px] border border-border-dark bg-surface px-2 py-1 text-[11.5px]" />
                  </label>
                  <button
                    type="button"
                    disabled={envoi || motifCloture.trim().length < 3}
                    onClick={() => void geste(() => api.patch(`/bons-commande/${detail.id}/cloture`, { motif: motifCloture }), 'Bon clos · son reste ne pèse plus sur le budget.')}
                    className="border border-border-dark px-2 py-1 text-[11.5px] disabled:opacity-60"
                  >
                    Clore le bon
                  </button>
                </>
              )}
              {detail.statut === 'CLOS' && (
                <button
                  type="button"
                  disabled={envoi}
                  onClick={() => void geste(() => api.patch(`/bons-commande/${detail.id}/reouverture`), 'Bon rouvert · son reste repèse sur le budget.')}
                  className="border border-border-dark px-2 py-1 text-[11.5px]"
                >
                  Rouvrir
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
