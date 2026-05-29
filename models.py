from datetime import datetime, timezone


def maintenant_iso():
    return datetime.now(timezone.utc).isoformat()


def date_locale_aujourdhui():
    return datetime.now(timezone.utc).date().isoformat()


def normaliser_date(valeur):
    if not valeur:
        return ""

    try:
        return datetime.fromisoformat(str(valeur)[:10]).date().isoformat()
    except ValueError:
        return ""


def sous_objectif_accompli(sous_objectif):
    return bool(sous_objectif.get("accompli")) or sous_objectif.get("etat") == "accompli"


def progression_objectif(objectif):
    sous_objectifs = objectif.get("sous_objectifs", [])
    total = len(sous_objectifs)

    if not total:
        return 0

    accomplis = sum(1 for sous_objectif in sous_objectifs if sous_objectif_accompli(sous_objectif))
    return round((accomplis / total) * 100)


def enregistrer_progression(objectif):
    progression = progression_objectif(objectif)
    historique = objectif.setdefault("progress_history", [])
    dernier_point = historique[-1] if historique else None

    if not dernier_point or dernier_point.get("progression") != progression:
        historique.append({
            "date": maintenant_iso(),
            "progression": progression,
        })

    objectif["progression"] = progression

    if progression == 100 and objectif.get("sous_objectifs"):
        objectif["archived"] = True
        objectif["frozen"] = True
        objectif.setdefault("completed_at", maintenant_iso())


def objectif_pour_api(objectif):
    objectif.setdefault("metadata", {})
    objectif["metadata"].setdefault("date_ajout", objectif.get("created_at") or maintenant_iso())
    objectif["metadata"].setdefault("date_debut", objectif.get("start_date") or objectif.get("created_at", "")[:10])
    objectif["metadata"].setdefault("date_fin", objectif.get("end_date") or "")
    objectif.setdefault("start_date", objectif["metadata"].get("date_debut") or date_locale_aujourdhui())
    objectif.setdefault("end_date", objectif["metadata"].get("date_fin") or "")
    objectif.setdefault("frozen", False)
    objectif.setdefault("progress_history", [])
    objectif.setdefault("sous_objectifs", [])
    enregistrer_progression(objectif)
    return objectif
