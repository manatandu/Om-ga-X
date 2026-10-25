import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { EnteteImpression } from '../components/chrome/EnteteImpression';
import { montant } from '../lib/montants';
import { montantSaisi } from '../lib/montant-saisi';
import { LIBELLES_ETAT_CHEQUE, type EtatChequeLu } from '../lib/cheques-emis';

/**
 * REGISTRE DES CHÈQUES ÉMIS (ligne microfina-m2, idée 9). Le carnet reçu de
 * la banque, chaque numéro servi, et son état · l'encaissement n'est jamais
 * saisi, il se LIT au rapprochement bancaire (la ligne de la pièce au compte
 * de la banque pointée face au relevé). Le serveur juge seul.
 */

interface RibLu {
  id: string;
  abrege: string;
  journal: { id: string; code: string } | null;
}
interface BanqueLue {
  intitule: string;
  ribs: RibLu[];
}
interface Chequier {
  id: string;
  rib: { id: string; abrege: string; banque: { intitule: string } };
  debutImprime: string;
  finImprime: string;
  numeroDebut: number;
  numeroFin: number;
  largeur: number;
  barre: boolean;
  dateReception: string;
  emis: number;
  annules: number;
  disponibles: number;
  prochainLibre: number | null;
}
interface ChequeLu {
  id: string;
  chequierId: string;
  compte: string;
  numero: number;
  numeroImprime: string;
  etat: EtatChequeLu;
  dateEmission: string | null;
  beneficiaire: string | null;
  montant: number | null;
  pieceDecrite: string | null;
  pieceAuBrouillard: boolean;
  pieceRetiree: boolean;
  encaisseLe: string | null;
  motifAnnulation: string | null;
}
interface PieceProposee {
  id: string;
  date: string;
  numeroPiece: number | null;
  libelle: string;
  statut: string;
  montant: number;
}

const jourFr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '·');
const aujourdhui = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);

export function ChequesEmisPage() {
  const { peutEcrire, peutValider } = useAuth();
  const [banques, setBanques] = useState<BanqueLue[] | null>(null);
  const [chequiers, setChequiers] = useState<{ chequiers: Chequier[]; total: number; tronque: boolean } | null>(null);
  const [registre, setRegistre] = useState<{ cheques: ChequeLu[]; total: number; tronque: boolean; enCirculation: { nombre: number; montant: number } } | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [carnetId, setCarnetId] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string[] | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const [nouveauCarnet, setNouveauCarnet] = useState({ ribId: '', debut: '', fin: '', largeur: '7', dateReception: aujourdhui(), barre: true });
  const [emission, setEmission] = useState({ numero: '', dateEmission: aujourdhui(), beneficiaire: '', montant: '', ecritureId: '' });
  const [pieces, setPieces] = useState<{ pieces: PieceProposee[]; total: number; tronque: boolean; motif: string | null } | null>(null);
  const [relierPour, setRelierPour] = useState<string | null>(null);

  // Le registre d'un autre carnet, arrivé tard, est jeté (jeton).
  const jeton = useRef(0);
  const charger = useCallback(async () => {
    const j = ++jeton.current;
    try {
      const [b, c, r] = await Promise.all([
        api.get<BanqueLue[]>('/banques'),
        api.get<{ chequiers: Chequier[]; total: number; tronque: boolean }>('/cheques/chequiers'),
        api.get<{ cheques: ChequeLu[]; total: number; tronque: boolean; enCirculation: { nombre: number; montant: number } }>(`/cheques${carnetId ? `?chequierId=${carnetId}` : ''}`),
      ]);
      if (j !== jeton.current) return;
      setBanques(b);
      setChequiers(c);
      setRegistre(r);
      setErreurLecture(null);
    } catch (e) {
      if (j !== jeton.current) return;
      setRegistre(null);
      setErreurLecture(e instanceof ApiError ? e.message : 'Registre illisible.');
    }
  }, [carnetId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    // Le prochain numéro libre du carnet choisi se propose · jamais deviné ailleurs.
    const c = chequiers?.chequiers.find((x) => x.id === carnetId);
    setEmission((e) => ({ ...e, numero: c?.prochainLibre ? String(c.prochainLibre) : '', ecritureId: '' }));
    setPieces(null);
  }, [carnetId, chequiers]);

  async function geste(f: () => Promise<unknown>, succes: string) {
    setErreur(null);
    setInfo(null);
    setEnvoi(true);
    try {
      const r = (await f()) as { avertissements?: string[] } | undefined;
      setInfo([succes, ...(r?.avertissements ?? [])]);
      await charger();
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Geste impossible.');
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  async function chargerPieces() {
    if (!carnetId) return;
    try {
      setPieces(await api.get<{ pieces: PieceProposee[]; total: number; tronque: boolean; motif: string | null }>(`/cheques/chequiers/${carnetId}/pieces-proposees`));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Pièces illisibles.');
    }
  }

  async function onCarnet(e: FormEvent) {
    e.preventDefault();
    const debut = montantSaisi(nouveauCarnet.debut);
    const fin = montantSaisi(nouveauCarnet.fin);
    const largeur = montantSaisi(nouveauCarnet.largeur);
    if (debut === null || fin === null || largeur === null) {
      setErreur('Les numéros et la largeur sont des entiers.');
      return;
    }
    const ok = await geste(
      () => api.post('/cheques/chequiers', { ribId: nouveauCarnet.ribId, numeroDebut: debut, numeroFin: fin, largeur, barre: nouveauCarnet.barre, dateReception: nouveauCarnet.dateReception }),
      'Chéquier enregistré.',
    );
    if (ok) setNouveauCarnet((n) => ({ ...n, debut: '', fin: '' }));
  }

  async function onEmettre(e: FormEvent) {
    e.preventDefault();
    const numero = montantSaisi(emission.numero);
    const m = montantSaisi(emission.montant);
    if (numero === null || m === null) {
      setErreur('Le numéro et le montant sont illisibles.');
      return;
    }
    const ok = await geste(
      () =>
        api.post('/cheques', {
          chequierId: carnetId,
          numero,
          dateEmission: emission.dateEmission,
          beneficiaire: emission.beneficiaire,
          montant: m,
          ...(emission.ecritureId ? { ecritureId: emission.ecritureId } : {}),
        }),
      'Chèque inscrit au registre.',
    );
    if (ok) {
      setEmission((x) => ({ ...x, beneficiaire: '', montant: '', ecritureId: '' }));
      setPieces(null);
    }
  }

  function choisirPiece(id: string) {
    const p = pieces?.pieces.find((x) => x.id === id);
    setEmission((x) => ({ ...x, ecritureId: id, montant: p && !x.montant ? String(p.montant) : x.montant }));
  }

  async function onAnnuler(c: ChequeLu) {
    const motif = window.prompt(`Motif de l'annulation du chèque ${c.numeroImprime} :`);
    if (motif === null) return;
    await geste(() => api.post(`/cheques/${c.id}/annulation`, { motif }), 'Chèque annulé · il reste au registre.');
  }

  async function onAnnulerNumero() {
    const numero = montantSaisi(emission.numero);
    if (numero === null) {
      setErreur('Le numéro est illisible.');
      return;
    }
    const motif = window.prompt(`Motif de l'annulation du numéro ${numero} (feuillet gâché, perdu, refait) :`);
    if (motif === null) return;
    await geste(() => api.post('/cheques/numeros/annulation', { chequierId: carnetId, numero, motif }), 'Numéro annulé.');
  }

  const ribs = (banques ?? []).flatMap((b) => b.ribs.map((r) => ({ ...r, banque: b.intitule })));

  return (
    <div className="flex flex-col gap-3 p-3">
      <EnteteImpression titre="Chèques émis" sousTitre="Registre des chéquiers et des chèques tirés sur les comptes du dossier" />

      <div className="ecran-seul flex items-center justify-end gap-2">
        <Aide
          titre="Le registre des chèques émis"
          texte={
            "Chaque carnet reçu de la banque porte une plage de numéros ; chaque numéro sert une fois, émis ou annulé. Le chèque émis se relie à " +
            "la pièce du journal de la banque qui le porte (règlement des tiers ou saisie), du même montant. Il est « en circulation » tant que la " +
            "banque ne l'a pas débité, et « encaissé » quand la ligne de sa pièce est pointée au rapprochement bancaire · cet état ne se saisit pas. " +
            "Une pièce payée par un ordre de virement n'est pas un chèque. Annuler un chèque délie sa pièce, qui reste au journal."
          }
          source="CPCC, ch. 1 § 1.1.1 (souches ou talons de chéquiers) ; Guide SYSCOHADA, Partie 1 ch. 4 § 2.2 (enregistré dès l'émission, chèques en circulation)"
        />
      </div>

      {erreur && <div className="ecran-seul border border-danger bg-danger/10 px-3 py-1.5 text-[11.5px]">{erreur}</div>}
      {info && (
        <div className="ecran-seul border border-border bg-surface-alt px-3 py-1.5 text-[11.5px]">
          {info.map((m, i) => (
            <div key={i}>{m}</div>
          ))}
        </div>
      )}
      {erreurLecture && <div className="border border-danger bg-danger/10 px-3 py-1.5 text-[11.5px]">{erreurLecture}</div>}

      {chequiers === null && !erreurLecture && <div className="text-[11.5px] text-text-dim">Lecture du registre…</div>}
      {chequiers && (
        <table className="w-full min-w-[800px] text-[11.5px]">
          <thead>
            <tr>
              <th className="text-left">Compte</th>
              <th className="text-left">Numéros</th>
              <th className="text-left">Reçu le</th>
              <th className="text-right">Émis</th>
              <th className="text-right">Annulés</th>
              <th className="text-right">Disponibles</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {chequiers.chequiers.map((c) => (
              <tr key={c.id} onClick={() => setCarnetId(c.id)} className={`cursor-pointer ${carnetId === c.id ? 'bg-a-50' : ''}`}>
                <td>
                  {c.rib.abrege} · {c.rib.banque.intitule}
                </td>
                <td>
                  {c.debutImprime} à {c.finImprime}
                  {c.barre ? ' · barrés' : ''}
                </td>
                <td>{jourFr(c.dateReception)}</td>
                <td className="text-right">{c.emis}</td>
                <td className="text-right">{c.annules}</td>
                <td className="text-right">{c.disponibles}</td>
                <td>
                  {peutEcrire && c.emis + c.annules === 0 && (
                    <button type="button" onClick={(ev) => { ev.stopPropagation(); void geste(() => api.delete(`/cheques/chequiers/${c.id}`), 'Chéquier retiré.'); }} className="ecran-seul border border-border px-1">
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {chequiers.chequiers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-text-dim">
                  Aucun chéquier enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {peutEcrire && banques && (
        <form onSubmit={(e) => void onCarnet(e)} className="ecran-seul flex flex-wrap items-end gap-2 border border-border bg-surface px-3 py-2 text-[11.5px]">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Compte bancaire</span>
            <select value={nouveauCarnet.ribId} onChange={(e) => setNouveauCarnet((n) => ({ ...n, ribId: e.target.value }))} required className="w-[240px] border border-border-dark bg-surface px-2 py-1">
              <option value="">Choisir…</option>
              {ribs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.abrege} · {r.banque}
                </option>
              ))}
            </select>
            {ribs.length === 0 && <span className="text-[11px] text-warning">Aucun compte bancaire · déclarez la banque et son RIB (Structure &gt; Banques).</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Premier numéro</span>
            <input value={nouveauCarnet.debut} onChange={(e) => setNouveauCarnet((n) => ({ ...n, debut: e.target.value }))} inputMode="numeric" className="w-[110px] border border-border-dark bg-surface px-2 py-1 text-right" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Dernier numéro</span>
            <input value={nouveauCarnet.fin} onChange={(e) => setNouveauCarnet((n) => ({ ...n, fin: e.target.value }))} inputMode="numeric" className="w-[110px] border border-border-dark bg-surface px-2 py-1 text-right" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim" title="Le nombre de chiffres imprimés sur le feuillet">
              Chiffres
            </span>
            <input value={nouveauCarnet.largeur} onChange={(e) => setNouveauCarnet((n) => ({ ...n, largeur: e.target.value }))} inputMode="numeric" className="w-[60px] border border-border-dark bg-surface px-2 py-1 text-right" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Reçu le</span>
            <input type="date" value={nouveauCarnet.dateReception} max={aujourdhui()} onChange={(e) => setNouveauCarnet((n) => ({ ...n, dateReception: e.target.value }))} className="border border-border-dark bg-surface px-2 py-1" />
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={nouveauCarnet.barre} onChange={(e) => setNouveauCarnet((n) => ({ ...n, barre: e.target.checked }))} />
            <span>Chèques barrés</span>
          </label>
          <button type="submit" disabled={envoi} className="border border-border-dark px-3 py-1 disabled:opacity-60">
            Enregistrer le chéquier
          </button>
        </form>
      )}

      {peutEcrire && carnetId && (
        <form onSubmit={(e) => void onEmettre(e)} className="ecran-seul flex flex-wrap items-end gap-2 border border-border bg-surface px-3 py-2 text-[11.5px]">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Numéro</span>
            <input value={emission.numero} onChange={(e) => setEmission((x) => ({ ...x, numero: e.target.value }))} inputMode="numeric" className="w-[110px] border border-border-dark bg-surface px-2 py-1 text-right" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Émis le</span>
            <input type="date" value={emission.dateEmission} max={aujourdhui()} onChange={(e) => setEmission((x) => ({ ...x, dateEmission: e.target.value }))} className="border border-border-dark bg-surface px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Bénéficiaire</span>
            <input value={emission.beneficiaire} onChange={(e) => setEmission((x) => ({ ...x, beneficiaire: e.target.value }))} maxLength={150} className="w-[220px] border border-border-dark bg-surface px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Montant</span>
            <input value={emission.montant} onChange={(e) => setEmission((x) => ({ ...x, montant: e.target.value }))} inputMode="decimal" className="w-[130px] border border-border-dark bg-surface px-2 py-1 text-right" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-text-dim">Pièce de la banque</span>
            {pieces === null ? (
              <button type="button" onClick={() => void chargerPieces()} className="border border-border-dark px-2 py-1">
                Choisir la pièce
              </button>
            ) : (
              <select value={emission.ecritureId} onChange={(e) => choisirPiece(e.target.value)} className="w-[360px] border border-border-dark bg-surface px-2 py-1">
                <option value="">Sans pièce pour l'instant</option>
                {pieces.pieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {jourFr(p.date)} · pièce {p.numeroPiece ?? '·'} · {p.libelle} · {montant(p.montant)}
                    {p.statut === 'BROUILLARD' ? ' (brouillard)' : ''}
                  </option>
                ))}
              </select>
            )}
            {pieces?.motif && <span className="text-[11px] text-warning">{pieces.motif}</span>}
            {pieces?.tronque && <span className="text-[11px] text-warning">{pieces.pieces.length} pièces affichées sur {pieces.total}.</span>}
          </label>
          <button type="submit" disabled={envoi} className="bg-sel px-3 py-1 font-bold text-white disabled:opacity-60">
            Inscrire le chèque
          </button>
          <button type="button" disabled={envoi} onClick={() => void onAnnulerNumero()} className="border border-border-dark px-2 py-1 disabled:opacity-60">
            Annuler ce numéro
          </button>
        </form>
      )}

      {registre && (
        <div className="overflow-x-auto">
          <div className="text-[11.5px] font-semibold">
            En circulation · {registre.enCirculation.nombre} chèque(s) · {montant(registre.enCirculation.montant)}
          </div>
          <table className="w-full min-w-[900px] text-[11.5px]">
            <thead>
              <tr>
                <th className="text-left">Compte</th>
                <th className="text-left">N°</th>
                <th className="text-left">Émis le</th>
                <th className="text-left">Bénéficiaire</th>
                <th className="text-right">Montant</th>
                <th className="text-left">État</th>
                <th className="text-left">Pièce</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {registre.cheques.map((c) => (
                <tr key={c.id} className={c.etat === 'ANNULE' ? 'text-text-dim line-through' : ''}>
                  <td>{c.compte}</td>
                  <td>{c.numeroImprime}</td>
                  <td>{jourFr(c.dateEmission)}</td>
                  <td>{c.beneficiaire ?? '·'}</td>
                  <td className="text-right">{montant(c.montant)}</td>
                  <td>
                    {LIBELLES_ETAT_CHEQUE[c.etat]}
                    {c.encaisseLe ? ` le ${jourFr(c.encaisseLe)}` : ''}
                    {c.etat === 'ANNULE' && c.motifAnnulation ? ` · ${c.motifAnnulation}` : ''}
                  </td>
                  <td className="max-w-[300px] truncate">
                    {c.pieceDecrite ?? '·'}
                    {c.pieceAuBrouillard ? ' (brouillard)' : ''}
                    {c.pieceRetiree ? ' (retirée du journal)' : ''}
                  </td>
                  <td className="ecran-seul flex gap-1">
                    {peutEcrire && c.etat === 'EMIS_SANS_PIECE' && (
                      <button type="button" onClick={() => { setCarnetId(c.chequierId); setRelierPour(c.id); void api.get<{ pieces: PieceProposee[]; total: number; tronque: boolean; motif: string | null }>(`/cheques/chequiers/${c.chequierId}/pieces-proposees`).then(setPieces, (e) => setErreur(e instanceof ApiError ? e.message : 'Pièces illisibles.')); }} className="border border-border px-1">
                        Relier
                      </button>
                    )}
                    {peutValider && (c.etat === 'EN_CIRCULATION' || c.etat === 'EMIS_SANS_PIECE') && (
                      <button type="button" onClick={() => void onAnnuler(c)} className="border border-border px-1">
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {registre.cheques.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-text-dim">
                    Aucun chèque inscrit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {registre.tronque && <div className="text-[11px] text-warning">{registre.cheques.length} chèques affichés sur {registre.total} · les plus récents d'abord.</div>}
        </div>
      )}

      {relierPour && pieces && (
        <div className="ecran-seul flex flex-wrap items-end gap-2 border border-border bg-surface px-3 py-2 text-[11.5px]">
          <select onChange={(e) => e.target.value && void geste(() => api.patch(`/cheques/${relierPour}/piece`, { ecritureId: e.target.value }), 'Pièce reliée.').then((ok) => ok && setRelierPour(null))} className="w-[420px] border border-border-dark bg-surface px-2 py-1" defaultValue="">
            <option value="">Choisir la pièce qui paie ce chèque…</option>
            {pieces.pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {jourFr(p.date)} · pièce {p.numeroPiece ?? '·'} · {p.libelle} · {montant(p.montant)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setRelierPour(null)} className="border border-border-dark px-2 py-1">
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
