import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';

/**
 * LES DÉCLARATIONS DE MOUVEMENT DU TRAVAILLEUR ET D'ÉTABLISSEMENT (art. 216
 * et 217 du Code du travail ; arrêté du 24 février 2023, arrêtés n° 006 et
 * 008/CAB/PVPM/ETPS/2010),
 * remplies par le serveur (`declarations-travail.ts`), rien n'est recalculé
 * ici. Le formulaire s'imprime · les réglages ne s'impriment pas
 * (`ecran-seul`). Un champ que le registre ne tient pas reste vide et nommé.
 */

type Champ = { libelle: string; valeur: string | null };

type Mouvement = {
  employeur: Champ[];
  travailleur: Champ[];
  motif: { code: string; rang: number; libelle: string; le: string };
  offreAPreciser: boolean;
  manquants: string[];
  echeance: string;
  faiteLe: string | null;
  enRetard: boolean | null;
  etatNonTenu: string | null;
  destinataires: string;
  delai: string;
  exemplaires: string;
  formulaire: string;
  redevance: string;
  derogation: string | null;
  fondement: string;
};

type Etablissement = {
  declarant: Champ[];
  manquants: string[];
  nature: string | null;
  natureLibelle: string | null;
  date: string | null;
  fenetre: { du: string; au: string } | null;
  position: 'AVANT' | 'DANS' | 'APRES' | null;
  exemplaires: string;
  formulaire: string;
  redevance: string;
  fondement: string;
};

type ContratMin = { id: string; type: string; dateEntreeEnVigueur: string; dateFin: string | null };
type SalarieAvecContrats = { id: string; nom: string; postNom: string | null; prenoms: string | null; contrats: ContratMin[] };

const MOTIFS = [
  { code: 'EMBAUCHE', libelle: '(1) Embauche' },
  { code: 'EXPIRATION_NORMALE', libelle: '(2) Expiration normale du contrat' },
  { code: 'LICENCIEMENT', libelle: '(3) Licenciement' },
  { code: 'DEMISSION', libelle: '(4) Démission' },
  { code: 'DECES', libelle: '(5) Décès' },
];

const champ = 'border border-border bg-transparent px-1.5 py-0.5';
const jour = (s: string) => s.slice(0, 10);
const nomDe = (s: SalarieAvecContrats) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');

function Lignes({ champs }: { champs: Champ[] }) {
  return (
    <table className="w-full">
      <tbody>
        {champs.map((c) => (
          <tr key={c.libelle}>
            <td className="px-2 py-0.5 w-[260px]">{c.libelle}</td>
            <td className="px-2 py-0.5">{c.valeur ?? <span className="text-text-dim">……………………</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DeclarationMouvementTravailleur({
  salaries,
  inactifsInclus,
  tronque,
}: {
  salaries: SalarieAvecContrats[] | null;
  inactifsInclus: boolean;
  tronque: boolean;
}) {
  const [contratId, setContratId] = useState('');
  const [motif, setMotif] = useState('EMBAUCHE');
  const [donnees, setDonnees] = useState<Mouvement | null>(null);
  const [erreur, setErreur] = useState('');
  const [lecture, setLecture] = useState(false);

  async function remplir() {
    setErreur('');
    setDonnees(null);
    setLecture(true);
    try {
      setDonnees(await api.get<Mouvement>(`/personnel/contrats/${contratId}/declaration-mouvement?motif=${encodeURIComponent(motif)}`));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Lecture impossible.');
    } finally {
      setLecture(false);
    }
  }

  const contrats = (salaries ?? []).flatMap((s) =>
    s.contrats.map((c) => ({ id: c.id, libelle: `${nomDe(s)} · contrat du ${jour(c.dateEntreeEnVigueur)}${c.dateFin ? ` au ${jour(c.dateFin)}` : ''}` })),
  );

  return (
    <div className="max-w-[900px] text-[11.5px] space-y-2">
      <div className="ecran-seul space-y-2">
        <div className="font-semibold flex items-center gap-1.5">
          Déclaration de mouvement du travailleur
          <Aide
            titre="Embauche et départ"
            texte="Chaque engagement et chaque départ, pour quelque cause que ce soit, se déclarent dans les quinze jours, à Kinshasa à la Direction de l'Emploi, ailleurs à la Division provinciale de l'Emploi et du Travail, et à la Direction provinciale de l'Office national de l'emploi, sur le formulaire officiel, en quatre exemplaires. OmegaX remplit le formulaire depuis le registre ; il se date, se signe et se dépose. La date de la déclaration faite s'enregistre sur la fiche du salarié."
            source="Code du travail, art. 217 ; arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023 ; arrêté ministériel n° 006/CAB/PVPM/ETPS/2010 du 1er avril 2010"
          />
        </div>
        {salaries === null && <div className="text-text-dim">Lecture du registre…</div>}
        {salaries && contrats.length === 0 && (
          <div className="text-text-dim">Aucun contrat au registre · enregistrez d’abord le salarié et son contrat dans l’onglet Registre.</div>
        )}
        {contrats.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Contrat"
              value={contratId}
              onChange={(e) => {
                setContratId(e.target.value);
                setDonnees(null);
              }}
              className={champ}
            >
              <option value="">Choisir le contrat</option>
              {contrats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>
            <select
              aria-label="Motif de la déclaration"
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                setDonnees(null);
              }}
              className={champ}
            >
              {MOTIFS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.libelle}
                </option>
              ))}
            </select>
            <button type="button" disabled={!contratId || lecture} onClick={() => void remplir()} className="bg-sel text-white font-semibold px-3 py-1">
              Remplir le formulaire
            </button>
          </div>
        )}
        {salaries && !inactifsInclus && (
          <div className="text-text-dim">Un salarié parti n’est proposé qu’en cochant « Inclure les inactifs » dans l’onglet Registre.</div>
        )}
        {tronque && <div className="text-warning">Le registre lu est tronqué · un contrat qui n’y figure pas ne se propose pas ici.</div>}
        {erreur && <div className="text-danger">{erreur}</div>}
      </div>
      {donnees && (
        <div className="border border-border px-4 py-3 space-y-2 eviter-coupure" aria-label="Déclaration de mouvement du travailleur">
          <div className="font-semibold">Déclaration de mouvement du travailleur</div>
          <div className="text-text-dim">{donnees.fondement}</div>
          <div className="font-semibold">1. Identification de l’employeur</div>
          <Lignes champs={donnees.employeur} />
          <div className="font-semibold">2. Identification du travailleur</div>
          <Lignes champs={donnees.travailleur} />
          <div className="font-semibold">3. Motif de la déclaration</div>
          <div>
            ({donnees.motif.rang}) {donnees.motif.libelle} · le {donnees.motif.le}, à ……………………
          </div>
          {donnees.offreAPreciser && (
            <>
              <div className="font-semibold">4. Offre d’emploi en cas de cessation de travail</div>
              <div>
                Le soussigné se propose · ne se propose pas · de remplacer le travailleur objet de la présente déclaration aux mêmes
                conditions de rémunération de base, contrat à durée déterminée ou à durée indéterminée, au salaire de ……………………,
                offre valable jusqu’au ……………………
              </div>
            </>
          )}
          <div className="font-semibold">{donnees.offreAPreciser ? '5' : '4'}. Signature de l’employeur</div>
          <div>À ……………………, le ……………………</div>
          <div className="text-text-dim">{donnees.exemplaires}</div>
          <div className="ecran-seul space-y-1 pt-1">
            <div>
              À déposer au plus tard le {donnees.echeance} {donnees.destinataires}.
              {donnees.faiteLe ? ` Déclaration faite le ${donnees.faiteLe}.` : donnees.enRetard ? ' Délai couru, non déclarée au registre.' : ''}
            </div>
            {donnees.etatNonTenu && <div className="text-text-dim">{donnees.etatNonTenu}</div>}
            <div className="text-text-dim">{donnees.formulaire}</div>
            <div className="text-text-dim">{donnees.redevance}</div>
            <div className="text-text-dim">{donnees.delai}</div>
            {donnees.derogation && <div className="text-text-dim">{donnees.derogation}</div>}
            {donnees.manquants.length > 0 && <div className="text-warning">À compléter à la main · {donnees.manquants.join(' ; ')}.</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => window.print()} className="bg-sel text-white font-semibold px-3 py-1">
                Imprimer la déclaration
              </button>
              <button type="button" onClick={() => setDonnees(null)} className="border border-border px-3 py-1">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeclarationEtablissement() {
  const [nature, setNature] = useState('OUVERTURE');
  const [date, setDate] = useState('');
  const [donnees, setDonnees] = useState<Etablissement | null>(null);
  const [erreur, setErreur] = useState('');
  const [lecture, setLecture] = useState(false);

  async function remplir() {
    setErreur('');
    setDonnees(null);
    setLecture(true);
    try {
      const q = new URLSearchParams({ nature, ...(date ? { date } : {}) });
      setDonnees(await api.get<Etablissement>(`/personnel/declaration-etablissement?${q.toString()}`));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Lecture impossible.');
    } finally {
      setLecture(false);
    }
  }

  return (
    <div className="max-w-[900px] text-[11.5px] space-y-2">
      <div className="ecran-seul space-y-2">
        <div className="font-semibold flex items-center gap-1.5">
          Déclaration d’établissement
          <Aide
            titre="Ouverture, fermeture, changement"
            texte="Exercer ou cesser une activité qui emploie des travailleurs se déclare à la Direction de l'Emploi (Kinshasa) ou à la Division provinciale de l'Emploi et du Travail, et à la Direction provinciale de l'Office national de l'emploi, dans la quinzaine qui précède l'ouverture ou la fermeture ; une modification des éléments déclarés, dans le même délai. Le formulaire officiel se dépose en quatre exemplaires. OmegaX remplit l'identité du déclarant depuis la fiche du dossier ; le reste se complète à la main."
            source="Code du travail, art. 216 ; arrêté ministériel n° CAB.MIN/ETPS/CNM/NTA-MKH/JBI/087/02/2023 du 24 février 2023 ; arrêté ministériel n° 008/CAB/PVPM/ETPS/2010 du 1er avril 2010"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Nature de la déclaration"
            value={nature}
            onChange={(e) => {
              setNature(e.target.value);
              setDonnees(null);
            }}
            className={champ}
          >
            <option value="OUVERTURE">Ouverture</option>
            <option value="FERMETURE">Fermeture</option>
            <option value="REOUVERTURE">Réouverture</option>
            <option value="TRANSITOIRE">Déclaration à titre transitoire</option>
            <option value="CHANGEMENT">Changement divers</option>
          </select>
          <label className="flex items-center gap-1">
            Date de l’événement
            <input
              type="date"
              aria-label="Date de l’événement"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDonnees(null);
              }}
              className={champ}
            />
          </label>
          <button type="button" disabled={lecture} onClick={() => void remplir()} className="bg-sel text-white font-semibold px-3 py-1">
            Remplir le formulaire
          </button>
        </div>
        {erreur && <div className="text-danger">{erreur}</div>}
      </div>
      {donnees && (
        <div className="border border-border px-4 py-3 space-y-2 eviter-coupure" aria-label="Déclaration d’établissement">
          <div className="font-semibold">Déclaration d’établissement</div>
          <div className="text-text-dim">{donnees.fondement}</div>
          <div className="font-semibold">1. Identification du déclarant</div>
          <Lignes champs={donnees.declarant} />
          <div>
            Forme · propriété individuelle ; société ; service public ; paraétatique ; libérale ; association sans but lucratif ;
            syndicat ; établissement public ou privé de bienfaisance (cocher)
          </div>
          <div className="font-semibold">
            2. {donnees.nature === 'CHANGEMENT' ? 'Déclaration de changement' : 'Déclaration d’ouverture · de fermeture · de réouverture'}
          </div>
          <div>
            {donnees.natureLibelle ?? '……………………'}
            {donnees.date ? ` · le ${donnees.date}` : ' · le ……………………'}
          </div>
          <div className="font-semibold">3. Déclaration de changement divers</div>
          <div>
            Changement d’activité définitif ou temporaire, date de la cessation d’activité, nouvelle activité principale, nouveau statut
            juridique, nouveau chef d’établissement, nouvel emplacement · ……………………
          </div>
          <div className="font-semibold">4. Effectifs des travailleurs à embaucher · à licencier</div>
          <div>Par catégorie de la classification générale des emplois (1re à 7e), cadres de direction · nationaux, étrangers, effectif général · ……………………</div>
          <div className="font-semibold">5. Signature du déclarant</div>
          <div>À ……………………, le ……………………</div>
          <div className="text-text-dim">{donnees.exemplaires}</div>
          <div className="ecran-seul space-y-1 pt-1">
            <div className="text-text-dim">{donnees.formulaire}</div>
            <div className="text-text-dim">{donnees.redevance}</div>
            {donnees.fenetre ? (
              <div>
                À déposer du {donnees.fenetre.du} au {donnees.fenetre.au}, dans la quinzaine qui précède l’événement.
                {donnees.position === 'APRES' ? ' Le délai est couru.' : donnees.position === 'AVANT' ? ' La quinzaine n’est pas encore ouverte.' : ''}
              </div>
            ) : (
              <div className="text-text-dim">Saisissez la date de l’événement pour lire la quinzaine où la déclaration se dépose.</div>
            )}
            {donnees.manquants.length > 0 && <div className="text-warning">À compléter à la main · {donnees.manquants.join(' ; ')}.</div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => window.print()} className="bg-sel text-white font-semibold px-3 py-1">
                Imprimer la déclaration
              </button>
              <button type="button" onClick={() => setDonnees(null)} className="border border-border px-3 py-1">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
