import copy
import json
import os
import uuid

from models import (
    date_locale_aujourdhui,
    enregistrer_progression,
    maintenant_iso,
    objectif_pour_api,
    progression_objectif,
)


class LocalObjectifStorage:
    def __init__(self, path):
        self.path = path

    def _read_raw(self):
        if not os.path.exists(self.path):
            return {"version": 1, "objectifs": []}

        with open(self.path, "r", encoding="utf-8") as fichier:
            donnees = json.load(fichier)

        if isinstance(donnees, list):
            return {"version": 1, "objectifs": donnees}

        if isinstance(donnees, dict):
            donnees.setdefault("version", 1)
            donnees.setdefault("objectifs", [])
            return donnees

        return {"version": 1, "objectifs": []}

    def _write_raw(self, donnees):
        with open(self.path, "w", encoding="utf-8") as fichier:
            json.dump(donnees, fichier, ensure_ascii=False, indent=2)

    def _read_objectifs(self):
        donnees = self._read_raw()
        objectifs = donnees.get("objectifs", [])

        for objectif in objectifs:
            objectif_pour_api(objectif)

        return donnees, objectifs

    def list_objectifs(self):
        _, objectifs = self._read_objectifs()
        return copy.deepcopy(objectifs)

    def list_progression(self):
        series = []

        for objectif in self.list_objectifs():
            points = objectif.get("progress_history") or [{
                "date": objectif.get("created_at") or maintenant_iso(),
                "progression": progression_objectif(objectif),
            }]

            series.append({
                "id": objectif.get("id"),
                "titre": objectif.get("titre") or "Objectif",
                "archived": bool(objectif.get("archived")),
                "points": points,
            })

        return series

    def create_objectif(self, titre, categorie, start_date="", end_date=""):
        donnees, objectifs = self._read_objectifs()
        created_at = maintenant_iso()
        start_date = start_date or date_locale_aujourdhui()
        objectif = {
            "id": str(uuid.uuid4()),
            "titre": titre,
            "categorie": categorie,
            "archived": False,
            "frozen": False,
            "created_at": created_at,
            "metadata": {
                "date_ajout": created_at,
                "date_debut": start_date,
                "date_fin": end_date,
            },
            "start_date": start_date,
            "end_date": end_date,
            "sous_objectifs": [],
            "progress_history": [],
            "progression": 0,
        }

        enregistrer_progression(objectif)
        objectifs.append(objectif)
        donnees["objectifs"] = objectifs
        self._write_raw(donnees)
        return copy.deepcopy(objectif)

    def update_objectif(self, objectif_id, updates):
        donnees, objectifs = self._read_objectifs()

        for objectif in objectifs:
            if str(objectif.get("id")) == str(objectif_id):
                objectif.update(updates)
                metadata = objectif.setdefault("metadata", {})
                metadata.setdefault("date_ajout", objectif.get("created_at") or maintenant_iso())

                if "start_date" in updates:
                    metadata["date_debut"] = updates["start_date"]

                if "end_date" in updates:
                    metadata["date_fin"] = updates["end_date"]

                enregistrer_progression(objectif)
                donnees["objectifs"] = objectifs
                self._write_raw(donnees)
                return copy.deepcopy(objectif)

        return None

    def delete_objectif(self, objectif_id):
        donnees, objectifs = self._read_objectifs()
        donnees["objectifs"] = [
            objectif for objectif in objectifs
            if str(objectif.get("id")) != str(objectif_id)
        ]
        self._write_raw(donnees)

    def create_sous_objectif(self, objectif_id, texte):
        donnees, objectifs = self._read_objectifs()

        for objectif in objectifs:
            if str(objectif.get("id")) == str(objectif_id):
                if objectif.get("frozen"):
                    return None

                sous_objectif = {
                    "id": str(uuid.uuid4()),
                    "objectif_id": objectif_id,
                    "texte": texte,
                    "accompli": False,
                    "temps": 0,
                    "etat": "en attente",
                    "type": "maîtrisable",
                    "priorite": "moyenne",
                    "archived": False,
                    "created_at": maintenant_iso(),
                }
                objectif.setdefault("sous_objectifs", []).append(sous_objectif)
                enregistrer_progression(objectif)
                donnees["objectifs"] = objectifs
                self._write_raw(donnees)
                return copy.deepcopy(sous_objectif)

        return None

    def update_sous_objectif(self, sous_objectif_id, updates):
        donnees, objectifs = self._read_objectifs()

        for objectif in objectifs:
            for sous_objectif in objectif.get("sous_objectifs", []):
                if str(sous_objectif.get("id")) == str(sous_objectif_id):
                    if objectif.get("frozen"):
                        return copy.deepcopy(sous_objectif)

                    sous_objectif.update(updates)
                    enregistrer_progression(objectif)
                    donnees["objectifs"] = objectifs
                    self._write_raw(donnees)
                    return copy.deepcopy(sous_objectif)

        return None

    def delete_sous_objectif(self, sous_objectif_id):
        donnees, objectifs = self._read_objectifs()

        for objectif in objectifs:
            if objectif.get("frozen"):
                continue

            objectif["sous_objectifs"] = [
                sous_objectif for sous_objectif in objectif.get("sous_objectifs", [])
                if str(sous_objectif.get("id")) != str(sous_objectif_id)
            ]
            enregistrer_progression(objectif)

        donnees["objectifs"] = objectifs
        self._write_raw(donnees)
