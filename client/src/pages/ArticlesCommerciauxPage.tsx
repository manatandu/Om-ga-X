import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { montant } from '../lib/montants';
import { motifAucunCompteRetenu } from '../lib/comptes-proposes';
import type { Compte, TauxTva, Tiers } from '../lib/types';
import { lireNombre, type ArticleCommercial, type ListeArticlesCommerciaux, type ListeTarifs, type ModeArrondi } from '../lib/gestion-commerciale';

interface FicheStock {
  id: string;
  code: string;
  designation: string;
  uniteMesure: string;
  actif: boolean;
}

const message = (e: unknown, defaut: string) => (e instanceof ApiError ? e.message : defaut);

/**
 * ARTICLES ET TARIFS (ligne commercial-l8, étape a) · Structure > Gestion
 * commerciale. L'article nomme ce que le dossier vend ou achète, ses comptes
 * de vente et d'achat, son taux et, s'il est stocké, la fiche du magasin dont
 * il prend l'unité (les mouvements restent saisis au magasin). Les refus sont ceux du serveur,
 * affichés tels quels.
 */
export function ArticlesCommerciauxPage() {
  const { peutEcrire } = useAuth();
  const [liste, setListe] = useState<ListeArticlesCommerciaux | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [taux, setTaux] = useState<TauxTva[] | null>(null);
  const [fiches, setFiches] = useState<FicheStock[] | null>(null);
  const [modes, setModes] = useState<ModeArrondi[] | null>(null);
  const [modeArrondiId, setModeArrondiId] = useState('');
  const [erreurListes, setErreurListes] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const [reference, setReference] = useState('');
  const [designation, setDesignation] = useState('');
  const [unite, setUnite] = useState('');
  const [compteVenteId, setCompteVenteId] = useState('');
  const [compteAchatId, setCompteAchatId] = useState('');
  const [tauxTvaId, setTauxTvaId] = useState('');
  const [exonere, setExonere] = useState(false);
  const [prixVente, setPrixVente] = useState('');
  const [prixAchat, setPrixAchat] = useState('');
  const [articleStockId, setArticleStockId] = useState('');

  const charger = useCallback(async (r: string) => {
    const q = r.trim() ? `?recherche=${encodeURIComponent(r.trim())}` : '';
    setListe(await api.get<ListeArticlesCommerciaux>(`/commercial/articles${q}`));
    setErreurLecture(null);
  }, []);

  useEffect(() => {
    charger('').catch((e) => setErreurLecture(message(e, 'La liste des articles n’a pas pu être lue.')));
    Promise.all([
      api.get<Compte[]>('/comptes?actifsSeuls=true&typeCompte=DETAIL&retenus=true'),
      api.get<TauxTva[]>('/taux-tva'),
      api.get<{ articles: FicheStock[] }>('/magasin/articles'),
      api.get<{ modes: ModeArrondi[] }>('/commercial/modes-arrondi'),
    ]).then(
      ([c, t, f, m]) => {
        setModes(m.modes.filter((x) => x.actif));
        setComptes(c);
        setTaux(t.filter((x) => x.estActif));
        setFiches(f.articles.filter((x) => x.actif));
      },
      (e) => setErreurListes(message(e, 'serveur injoignable')),
    );
  }, [charger]);

  const ventes = useMemo(() => comptes?.filter((c) => c.classe === 'CLASSE_7') ?? null, [comptes]);
  const achats = useMemo(() => comptes?.filter((c) => c.classe === 'CLASSE_6' && !c.numero.startsWith('603')) ?? null, [comptes]);
  const fichesLibres = useMemo(
    () => fiches?.filter((f) => !liste?.articles.some((a) => a.articleStockId === f.id)) ?? null,
    [fiches, liste],
  );

  const agir = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setErreur(null);
    setInfo(null);
    setEnvoi(true);
    try {
      await fn();
    } catch (e) {
      setErreur(message(e, 'Le serveur n’a pas répondu.'));
      setEnvoi(false);
      return false;
    }
    try {
      await charger(recherche);
    } catch (e) {
      setInfo(`Fait · la liste n’a pas pu être relue (${message(e, 'serveur injoignable')}).`);
    }
    setEnvoi(false);
    return true;
  };

  const creer = (e: FormEvent) => {
    e.preventDefault();
    const pv = lireNombre(prixVente);
    const pa = lireNombre(prixAchat);
    if (pv === undefined || pa === undefined) {
      setErreur('Un prix se saisit en chiffres, la virgule pour les décimales (« 500.000 » est ambigu).');
      return;
    }
    void agir(async () => {
      await api.post('/commercial/articles', {
        reference: reference.trim(),
        designation: designation.trim(),
        unite: unite.trim(),
        ...(compteVenteId ? { compteVenteId } : {}),
        ...(compteAchatId ? { compteAchatId } : {}),
        ...(tauxTvaId ? { tauxTvaId } : {}),
        exonere,
        ...(pv === null ? {} : { prixVenteHT: pv }),
        ...(pa === null ? {} : { prixAchatHT: pa }),
        ...(articleStockId ? { articleStockId } : {}),
        ...(modeArrondiId ? { modeArrondiId } : {}),
      });
      setReference('');
      setDesignation('');
      setUnite('');
      setPrixVente('');
      setPrixAchat('');
      setArticleStockId('');
      setExonere(false);
    });
  };

  // L'unité d'un article stocké est celle de sa fiche · posée au choix.
  const choisirFiche = (id: string) => {
    setArticleStockId(id);
    const f = fiches?.find((x) => x.id === id);
    if (f) setUnite(f.uniteMesure);
  };

  return (
    <div className="p-2 max-w-[1180px]">
      <div className="flex items-center gap-2 mb-2">
        <input
          aria-label="Rechercher un article"
          placeholder="Référence ou désignation"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') charger(recherche).catch((x) => setErreurLecture(message(x, 'Recherche impossible.')));
          }}
          className="border border-border px-2 py-1 text-[11.5px] w-[260px]"
        />
        <div className="flex-1" />
        <Aide
          titre="Articles et tarifs"
          texte="L’article nomme ce que le dossier vend ou achète. Son compte de vente est un compte de produit de la classe 7, son compte d’achat un compte de charge de la classe 6 (le 603, qui porte la variation des stocks, n’est pas un achat) · tous deux personnalisés dans Plan comptable. Le taux est un taux du dossier ; une opération exonérée ne porte pas de taux, l’exonération n’étant pas un taux nul. Un article stocké renvoie à une fiche du magasin, dont il prend l’unité · les entrées et sorties se saisissent toujours au magasin, la facture ne les passe pas. Le prix de base et le tarif d’un client sont proposés à la ligne d’une facture, jamais imposés ; la remise y est portée et déduite. Quand toutes les lignes d’une facture portent des articles de même compte, ce compte se propose au passage de l’écriture, le cabinet le garde ou le change. Un article qui a servi se met en sommeil, il ne se supprime pas."
          source="AUDCIF Titre VII, comptes 60 et 70 · AUDCG art. 263 · O.-L. n° 10/001, art. 24 et 43"
        />
      </div>
      {erreurLecture && <div className="text-[11.5px] text-danger mb-2">{erreurLecture}</div>}
      {erreurListes && <div className="text-[11.5px] text-danger mb-2">Comptes, taux, fiches de stock ou modes d’arrondi illisibles · {erreurListes}</div>}
      {erreur && <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-3 py-1.5 mb-2">{erreur}</div>}
      {info && <div role="status" className="text-[11.5px] text-warning bg-warning-soft border border-warning/30 px-3 py-1.5 mb-2">{info}</div>}

      {peutEcrire && (
        <form onSubmit={creer} className="border border-border bg-surface p-2 mb-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11.5px]">
          <label className="flex flex-col">
            Référence
            <input required maxLength={18} value={reference} onChange={(e) => setReference(e.target.value)} className="border border-border px-1 py-0.5" />
          </label>
          <label className="flex flex-col md:col-span-2">
            Désignation
            <input required maxLength={120} value={designation} onChange={(e) => setDesignation(e.target.value)} className="border border-border px-1 py-0.5" />
          </label>
          <label className="flex flex-col">
            Unité
            <input required maxLength={20} value={unite} disabled={!!articleStockId} onChange={(e) => setUnite(e.target.value)} className="border border-border px-1 py-0.5" />
          </label>
          <label className="flex flex-col">
            Compte de vente
            <select value={compteVenteId} onChange={(e) => setCompteVenteId(e.target.value)} className="border border-border px-1 py-0.5 bg-surface">
              <option value="">Aucun</option>
              {ventes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} {c.intitule}
                </option>
              ))}
            </select>
            {motifAucunCompteRetenu(ventes, 'de produit (classe 7)') && <span className="text-text-dim">{motifAucunCompteRetenu(ventes, 'de produit (classe 7)')}</span>}
          </label>
          <label className="flex flex-col">
            Compte d’achat
            <select value={compteAchatId} onChange={(e) => setCompteAchatId(e.target.value)} className="border border-border px-1 py-0.5 bg-surface">
              <option value="">Aucun</option>
              {achats?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} {c.intitule}
                </option>
              ))}
            </select>
            {motifAucunCompteRetenu(achats, 'de charge (classe 6)') && <span className="text-text-dim">{motifAucunCompteRetenu(achats, 'de charge (classe 6)')}</span>}
          </label>
          <label className="flex flex-col">
            Taux de taxe
            <select value={tauxTvaId} disabled={exonere} onChange={(e) => setTauxTvaId(e.target.value)} className="border border-border px-1 py-0.5 bg-surface">
              <option value="">Aucun</option>
              {taux?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.taux} %
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 mt-4">
            <input
              type="checkbox"
              checked={exonere}
              onChange={(e) => {
                setExonere(e.target.checked);
                if (e.target.checked) setTauxTvaId('');
              }}
            />
            Opération exonérée
          </label>
          <label className="flex flex-col">
            Prix de vente HT
            <input inputMode="decimal" value={prixVente} onChange={(e) => setPrixVente(e.target.value)} className="border border-border px-1 py-0.5 text-right" />
          </label>
          <label className="flex flex-col">
            Prix d’achat HT
            <input inputMode="decimal" value={prixAchat} onChange={(e) => setPrixAchat(e.target.value)} className="border border-border px-1 py-0.5 text-right" />
          </label>
          <label className="flex flex-col md:col-span-2">
            Fiche de stock (article stocké)
            <select value={articleStockId} onChange={(e) => choisirFiche(e.target.value)} className="border border-border px-1 py-0.5 bg-surface">
              <option value="">Non stocké</option>
              {fichesLibres?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} · {f.designation} ({f.uniteMesure})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            Arrondi du prix net
            <select value={modeArrondiId} onChange={(e) => setModeArrondiId(e.target.value)} className="border border-border px-1 py-0.5 bg-surface">
              <option value="">Au centime</option>
              {modes?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.intitule}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3 flex justify-end">
            <button type="submit" disabled={envoi} className="bg-sel text-white px-4 py-1 rounded-full disabled:opacity-50">
              Créer l’article
            </button>
          </div>
        </form>
      )}

      {liste === null && !erreurLecture && <div className="text-[11.5px] text-text-dim">Lecture des articles…</div>}
      {liste && (
        <>
          {liste.tronque && (
            <div className="text-[11.5px] text-warning mb-1">
              {liste.articles.length} articles montrés sur {liste.total} · précisez la recherche.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px] min-w-[900px]">
              <thead>
                <tr>
                  <th className="text-left w-[110px]">Référence</th>
                  <th className="text-left">Désignation</th>
                  <th className="text-left w-[60px]">Unité</th>
                  <th className="text-left w-[140px]">Vente</th>
                  <th className="text-left w-[140px]">Achat</th>
                  <th className="text-left w-[90px]">Taxe</th>
                  <th className="text-right w-[110px]">Prix de vente HT</th>
                  <th className="text-left w-[110px]">Stock</th>
                  <th className="text-center w-[60px]">Actif</th>
                  <th className="w-[150px]" />
                </tr>
              </thead>
              <tbody>
                {liste.articles.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-text-dim">
                      Aucun article {recherche.trim() ? 'ne répond à cette recherche' : 'dans ce dossier'}.
                    </td>
                  </tr>
                )}
                {liste.articles.map((a) => (
                  <LigneArticle
                    key={a.id}
                    article={a}
                    peutEcrire={peutEcrire}
                    envoi={envoi}
                    ouvert={ouvert === a.id}
                    basculer={() => setOuvert(ouvert === a.id ? null : a.id)}
                    agir={agir}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function LigneArticle(p: {
  article: ArticleCommercial;
  peutEcrire: boolean;
  envoi: boolean;
  ouvert: boolean;
  basculer: () => void;
  agir: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const a = p.article;
  return (
    <>
      <tr className={a.actif ? '' : 'text-text-dim'}>
        <td className="font-semibold">{a.reference}</td>
        <td>{a.designation}</td>
        <td>{a.unite}</td>
        <td>{a.compteVente ? `${a.compteVente.numero}` : '·'}</td>
        <td>{a.compteAchat ? `${a.compteAchat.numero}` : '·'}</td>
        <td>{a.exonere ? 'Exonérée' : a.tauxTva ? `${a.tauxTva.code}` : '·'}</td>
        <td className="text-right">{montant(a.prixVenteHT)}</td>
        <td>{a.articleStock ? a.articleStock.code : 'Non stocké'}</td>
        <td className="text-center">
          <input
            type="checkbox"
            aria-label={`Article ${a.reference} actif`}
            checked={a.actif}
            disabled={!p.peutEcrire || p.envoi}
            onChange={(e) => void p.agir(() => api.patch(`/commercial/articles/${a.id}`, { actif: e.target.checked }))}
          />
        </td>
        <td className="text-right whitespace-nowrap">
          <button type="button" onClick={p.basculer} className="border border-border-dark bg-chrome hover:bg-chrome-alt px-2 py-0.5 mr-1">
            Tarifs
          </button>
          {p.peutEcrire && (
            <button
              type="button"
              disabled={p.envoi}
              onClick={() => void p.agir(() => api.delete(`/commercial/articles/${a.id}`))}
              className="border border-border-dark bg-chrome hover:bg-chrome-alt px-2 py-0.5 disabled:opacity-50"
            >
              Supprimer
            </button>
          )}
        </td>
      </tr>
      {p.ouvert && (
        <tr>
          <td colSpan={10} className="bg-fenetre">
            <TarifsArticle article={a} peutEcrire={p.peutEcrire} />
          </td>
        </tr>
      )}
    </>
  );
}

function TarifsArticle({ article, peutEcrire }: { article: ArticleCommercial; peutEcrire: boolean }) {
  const [tarifs, setTarifs] = useState<ListeTarifs | null>(null);
  const [clients, setClients] = useState<Tiers[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tiersId, setTiersId] = useState('');
  const [prix, setPrix] = useState('');
  const [remise, setRemise] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const relire = useCallback(() => api.get<ListeTarifs>(`/commercial/articles/${article.id}/tarifs`).then(setTarifs), [article.id]);
  useEffect(() => {
    relire().catch((e) => setErreur(message(e, 'Les tarifs n’ont pas pu être lus.')));
    api.get<Tiers[]>('/tiers?actifsSeuls=true').then(
      (t) => setClients(t.filter((x) => x.type === 'CLIENT' || x.type === 'ADHERENT')),
      (e) => setErreur(message(e, 'Les clients n’ont pas pu être lus.')),
    );
  }, [relire]);

  const poser = async (e: FormEvent) => {
    e.preventDefault();
    const p = lireNombre(prix);
    const r = lireNombre(remise);
    if (p === undefined || r === undefined) {
      setErreur('Prix et remise se saisissent en chiffres.');
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await api.put('/commercial/tarifs', { articleId: article.id, tiersId, prixHT: p, remisePourcent: r });
      setPrix('');
      setRemise('');
      await relire();
    } catch (x) {
      setErreur(message(x, 'Le tarif n’a pas été posé.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (id: string) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api.delete(`/commercial/tarifs/${id}`);
      await relire();
    } catch (x) {
      setErreur(message(x, 'Le tarif n’a pas été retiré.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="p-2 text-[11.5px]">
      {erreur && <div className="text-danger mb-1">{erreur}</div>}
      {tarifs === null && !erreur && <div className="text-text-dim">Lecture des tarifs…</div>}
      {tarifs && tarifs.tarifs.length === 0 && <div className="text-text-dim mb-1">Aucun tarif propre · le prix de base s’applique à tous les clients.</div>}
      {tarifs && tarifs.tarifs.length > 0 && (
        <table className="w-full max-w-[640px] mb-2">
          <thead>
            <tr>
              <th className="text-left">Client</th>
              <th className="text-right w-[120px]">Prix HT</th>
              <th className="text-right w-[90px]">Remise</th>
              <th className="w-[80px]" />
            </tr>
          </thead>
          <tbody>
            {tarifs.tarifs.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.tiers.code} · {t.tiers.nom}
                </td>
                <td className="text-right">{montant(t.prixHT)}</td>
                <td className="text-right">{t.remisePourcent === null ? '·' : `${t.remisePourcent} %`}</td>
                <td className="text-right">
                  {peutEcrire && (
                    <button type="button" disabled={envoi} onClick={() => void retirer(t.id)} className="border border-border-dark bg-chrome px-2 py-0.5 disabled:opacity-50">
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {peutEcrire && (
        <form onSubmit={poser} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            Client
            <select required value={tiersId} onChange={(e) => setTiersId(e.target.value)} className="border border-border px-1 py-0.5 bg-surface min-w-[220px]">
              <option value="">Choisir</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.nom}
                </option>
              ))}
            </select>
            {clients !== null && clients.length === 0 && <span className="text-text-dim">Aucun client actif · créez-le dans Plan des tiers.</span>}
          </label>
          <label className="flex flex-col">
            Prix HT propre
            <input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} className="border border-border px-1 py-0.5 text-right w-[120px]" />
          </label>
          <label className="flex flex-col">
            Remise (%)
            <input inputMode="decimal" value={remise} onChange={(e) => setRemise(e.target.value)} className="border border-border px-1 py-0.5 text-right w-[80px]" />
          </label>
          <button type="submit" disabled={envoi || !tiersId} className="bg-sel text-white px-3 py-1 rounded-full disabled:opacity-50">
            Poser le tarif
          </button>
        </form>
      )}
    </div>
  );
}
