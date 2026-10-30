import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { EtatPersonnaliseDto } from './dto/etat-personnalise.dto';
import { calculerColonne, LigneDefinition, lireLesRacines, motifRefusDefinition, PLAFOND_EXERCICES } from './moteur-etat-personnalise';

/** Les comptes de détail que l'aide à la formule lit au plus · convention d'OmegaX. */
const PLAFOND_PLAN_LU = 20000;

/**
 * ÉTATS PERSONNALISÉS · définitions enregistrées, calculées à la demande sur
 * la balance de chaque exercice choisi (`EcritureService.balance`, la même que
 * la balance générale) · aucun chiffre n'est stocké, un état se recalcule
 * toujours sur les livres du moment.
 */
@Injectable()
export class EtatsPersonnalisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
  ) {}

  /**
   * L'AIDE À LA FORMULE (ligne dossier-l9, fonction 100) · les comptes de
   * DÉTAIL du plan du dossier qu'une rubrique lit, par la règle du calcul
   * (`lireLesRacines`). Bornée et dite · au plus cinquante comptes nommés par
   * liste, le nombre toujours.
   */
  async formule(tenantId: string, racines: unknown) {
    // Une chaîne seule · `?racines=a&racines=b` rend un tableau, qui tombait en
    // erreur 500 au premier appel de méthode de chaîne.
    if (typeof racines !== 'string') throw new BadRequestException('La formule se donne une fois, en texte (« 70 71 -709 »).');
    if (racines.length > 300) throw new BadRequestException('La formule tient en 300 caractères au plus.');
    const comptes = await this.prisma.compte.findMany({
      where: { tenantId, typeCompte: 'DETAIL' },
      orderBy: { numero: 'asc' },
      take: PLAFOND_PLAN_LU + 1,
      select: { numero: true, intitule: true },
    });
    // Au-delà du plafond, la lecture se REFUSE · une aide qui ne lirait qu'une
    // partie du plan dirait « aucun compte sous 79 » à tort.
    if (comptes.length > PLAFOND_PLAN_LU) {
      throw new BadRequestException(`Le plan du dossier compte plus de ${PLAFOND_PLAN_LU} comptes de détail · l'aide à la formule ne le lit pas en entier, et ne répond donc pas.`);
    }
    const lu = lireLesRacines(racines, comptes.map((c) => c.numero));
    const intitules = new Map(comptes.map((c) => [c.numero, c.intitule]));
    const nommer = (liste: string[]) => liste.slice(0, 50).map((numero) => ({ numero, intitule: intitules.get(numero) ?? '' }));
    return {
      motif: lu.motif,
      inclus: nommer(lu.inclus),
      nombreInclus: lu.inclus.length,
      exclus: nommer(lu.exclus),
      nombreExclus: lu.exclus.length,
      racinesSansCompte: lu.racinesSansCompte,
    };
  }

  lister(tenantId: string) {
    return this.prisma.etatPersonnalise.findMany({ where: { tenantId }, orderBy: { nom: 'asc' } });
  }

  private verifier(dto: EtatPersonnaliseDto): LigneDefinition[] {
    const lignes = dto.lignes.map((l) => ({
      cle: l.cle.trim().toUpperCase(),
      libelle: l.libelle.trim(),
      racines: l.racines?.trim() || undefined,
      mesure: l.mesure,
      sens: l.sens,
      total: l.total?.trim().toUpperCase() || undefined,
    }));
    const motif = motifRefusDefinition(lignes);
    if (motif) throw new BadRequestException(motif);
    return lignes;
  }

  private async doublon<T>(p: Promise<T>, nom: string): Promise<T> {
    try {
      return await p;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Un état « ${nom} » existe déjà dans ce dossier.`);
      }
      throw e;
    }
  }

  creer(tenantId: string, dto: EtatPersonnaliseDto) {
    const lignes = this.verifier(dto);
    return this.doublon(
      this.prisma.etatPersonnalise.create({ data: { tenantId, nom: dto.nom.trim(), lignes: lignes as unknown as Prisma.InputJsonValue } }),
      dto.nom.trim(),
    );
  }

  async modifier(tenantId: string, id: string, dto: EtatPersonnaliseDto) {
    await this.lire(tenantId, id);
    const lignes = this.verifier(dto);
    return this.doublon(
      this.prisma.etatPersonnalise.update({ where: { id }, data: { nom: dto.nom.trim(), lignes: lignes as unknown as Prisma.InputJsonValue } }),
      dto.nom.trim(),
    );
  }

  async supprimer(tenantId: string, id: string) {
    await this.lire(tenantId, id);
    await this.prisma.etatPersonnalise.delete({ where: { id } });
    return { supprime: true };
  }

  private async lire(tenantId: string, id: string) {
    const e = await this.prisma.etatPersonnalise.findFirst({ where: { id, tenantId } });
    if (!e) throw new NotFoundException('État introuvable');
    return e;
  }

  /**
   * Une colonne par exercice, dans l'ordre chronologique · jusqu'à cinq,
   * comme l'historique de l'Édition pilotée. La définition est REVÉRIFIÉE ·
   * enregistrée avant un correctif de la règle, elle ne doit pas se calculer
   * sur une lecture que la porte refuse aujourd'hui.
   */
  async calculer(tenantId: string, id: string, exerciceIds: string[], inclureBrouillard: boolean) {
    const etat = await this.lire(tenantId, id);
    const lignes = etat.lignes as unknown as LigneDefinition[];
    const motif = motifRefusDefinition(lignes);
    if (motif) throw new BadRequestException(`Définition à corriger · ${motif}`);
    const ids = [...new Set(exerciceIds)].filter(Boolean);
    if (ids.length === 0) throw new BadRequestException('Choisissez au moins un exercice.');
    if (ids.length > PLAFOND_EXERCICES) throw new BadRequestException(`Au plus ${PLAFOND_EXERCICES} exercices côte à côte.`);
    const exercices = await this.prisma.exercice.findMany({
      where: { tenantId, id: { in: ids } },
      orderBy: { dateDebut: 'asc' },
      select: { id: true, dateDebut: true, dateFin: true },
    });
    if (exercices.length !== ids.length) throw new NotFoundException('Exercice introuvable dans ce dossier.');
    const colonnes = await Promise.all(
      exercices.map(async (ex) => ({
        exerciceId: ex.id,
        dateDebut: ex.dateDebut,
        dateFin: ex.dateFin,
        valeurs: calculerColonne(lignes, (await this.ecritures.balance(tenantId, ex.id, inclureBrouillard)).lignes),
      })),
    );
    return { etat: { id: etat.id, nom: etat.nom, lignes }, inclureBrouillard, colonnes };
  }
}
