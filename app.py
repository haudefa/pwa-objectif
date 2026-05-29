from flask import Flask, abort, flash, jsonify, redirect, render_template, request, send_file, send_from_directory, session, url_for
from io import BytesIO
import json
import os
import secrets
import tempfile
from supabase import create_client, Client
from dotenv import load_dotenv

from models import date_locale_aujourdhui, normaliser_date
from storage import LocalObjectifStorage


load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client | None = None

if SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = Flask(__name__, static_folder="static")
app.secret_key = os.environ.get("SECRET_KEY", "objectif-dev")
app.config["AUTH_PASSWORD"] = os.environ.get("OBJECTIF_PASSWORD", "objectif123")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


def chemin_donnees_par_defaut():
    chemin_local = os.path.join(app.root_path, "data.json")

    if os.access(app.root_path, os.W_OK):
        return chemin_local

    return os.path.join(tempfile.gettempdir(), "pwa_objectif", "data.json")


app.config["DATA_FILE"] = os.environ.get("OBJECTIF_DATA_FILE", chemin_donnees_par_defaut())

storage = LocalObjectifStorage(app.config["DATA_FILE"])

ETATS_SOUS_OBJECTIFS = {"en attente", "bloqué", "accompli"}
TYPES_SOUS_OBJECTIFS = {"maîtrisable", "aléatoire"}
PRIORITES_SOUS_OBJECTIFS = {"basse", "moyenne", "haute"}


def generer_csrf_token():
    token = session.get("_csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["_csrf_token"] = token

    return token


@app.context_processor
def injecter_csrf_token():
    return {"csrf_token": generer_csrf_token}


@app.before_request
def verifier_csrf():
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return

    token_session = session.get("_csrf_token")
    token_formulaire = request.form.get("_csrf_token") or request.headers.get("X-CSRF-Token")

    if not token_session or not token_formulaire or not secrets.compare_digest(token_session, token_formulaire):
        abort(400)


@app.before_request
def verifier_authentification():
    endpoints_publics = {"login", "static", "favicon", "service_worker", "api_health"}

    if request.endpoint in endpoints_publics:
        return

    if session.get("authentifie"):
        return

    if request.path.startswith("/api/"):
        return erreur_api("Session expirée.", 401)

    return redirect(url_for("login", next=request.full_path if request.query_string else request.path))


def mot_de_passe_valide(mot_de_passe):
    return secrets.compare_digest(mot_de_passe, app.config["AUTH_PASSWORD"])


def donnees_json():
    return request.get_json(silent=True) or {}


def erreur_api(message, statut=400):
    return jsonify(error=message), statut


def executer_supabase(requete):
    if not supabase:
        return None

    try:
        return requete.execute()
    except Exception as erreur:
        app.logger.warning("Supabase indisponible, utilisation du stockage local: %s", erreur)
        return None


def mode_local():
    return supabase is None


def dates_objectif_depuis_payload(data):
    start_date = normaliser_date(data.get("start_date")) or date_locale_aujourdhui()
    end_date = normaliser_date(data.get("end_date"))

    if end_date and start_date > end_date:
        return None, None, erreur_api("La date de fin doit être après la date de début.")

    return start_date, end_date, None


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        mot_de_passe = request.form.get("password", "")

        if mot_de_passe_valide(mot_de_passe):
            session["authentifie"] = True
            destination = request.args.get("next") or url_for("home")
            if not destination.startswith("/"):
                destination = url_for("home")

            return redirect(destination)

        flash("Mot de passe incorrect.", "error")

    return render_template("login.html")


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
def home():
    return render_template("index.html")


@app.get("/api/objectifs")
def api_lister_objectifs():
    if mode_local():
        return jsonify(storage.list_objectifs())

    resultat = executer_supabase(supabase.table("objectifs").select("*, sous_objectifs(*)"))
    if resultat is None:
        return jsonify(storage.list_objectifs())

    return jsonify(resultat.data or [])


@app.get("/api/progression")
def api_lister_progression():
    return jsonify(storage.list_progression())


@app.get("/api/health")
def api_health():
    return jsonify({
        "status": "ok",
        "storage_path": storage.path,
        "storage_writable": storage.is_writable(),
        "supabase_configured": supabase is not None,
        "mode": "local" if mode_local() else "supabase",
    })


@app.get("/api/export")
def api_exporter_donnees():
    payload = json.dumps(storage.export_data(), ensure_ascii=False, indent=2).encode("utf-8")
    return send_file(
        BytesIO(payload),
        mimetype="application/json",
        as_attachment=True,
        download_name="pwa-objectif-export.json",
    )


@app.post("/api/import")
def api_importer_donnees():
    data = donnees_json()

    try:
        objectifs = storage.import_data(data)
    except ValueError as erreur:
        return erreur_api(str(erreur))

    return jsonify(objectifs)


@app.post("/api/objectifs")
def api_creer_objectif():
    data = donnees_json()
    titre = data.get("titre", "").strip()
    categorie = data.get("categorie", "").strip()
    start_date, end_date, erreur_dates = dates_objectif_depuis_payload(data)

    if erreur_dates:
        return erreur_dates

    if not titre:
        return erreur_api("Le titre est obligatoire.")

    if mode_local():
        return jsonify(storage.create_objectif(titre, categorie, start_date, end_date)), 201

    resultat = executer_supabase(
        supabase.table("objectifs").insert({
            "titre": titre,
            "categorie": categorie,
            "archived": False,
            "start_date": start_date,
            "end_date": end_date,
        })
    )
    if resultat is None:
        return jsonify(storage.create_objectif(titre, categorie, start_date, end_date)), 201

    return jsonify(resultat.data[0] if resultat.data else {}), 201


@app.patch("/api/objectifs/<objectif_id>")
def api_modifier_objectif(objectif_id):
    data = donnees_json()
    updates = {}

    if "archived" in data:
        updates["archived"] = bool(data["archived"])

    if "start_date" in data:
        updates["start_date"] = normaliser_date(data.get("start_date")) or date_locale_aujourdhui()

    if "end_date" in data:
        updates["end_date"] = normaliser_date(data.get("end_date"))

    if updates.get("end_date") and updates.get("start_date") and updates["start_date"] > updates["end_date"]:
        return erreur_api("La date de fin doit être après la date de début.")

    if not updates:
        return erreur_api("Aucune donnée valide à modifier.")

    if mode_local():
        objectif = storage.update_objectif(objectif_id, updates)
        return jsonify(objectif or {})

    resultat = executer_supabase(supabase.table("objectifs").update(updates).eq("id", objectif_id))
    if resultat is None:
        objectif = storage.update_objectif(objectif_id, updates)
        return jsonify(objectif or {})

    return jsonify(resultat.data[0] if resultat.data else {})


@app.delete("/api/objectifs/<objectif_id>")
def api_supprimer_objectif(objectif_id):
    if mode_local():
        storage.delete_objectif(objectif_id)
        return "", 204

    resultat = executer_supabase(supabase.table("objectifs").delete().eq("id", objectif_id))
    if resultat is None:
        storage.delete_objectif(objectif_id)
        return "", 204

    return "", 204


@app.post("/api/objectifs/<objectif_id>/sous-objectifs")
def api_creer_sous_objectif(objectif_id):
    data = donnees_json()
    texte = data.get("texte", "").strip()

    if not texte:
        return erreur_api("Le sous-objectif est obligatoire.")

    if mode_local():
        sous_objectif = storage.create_sous_objectif(objectif_id, texte)
        if sous_objectif is None:
            return erreur_api("Cet objectif est gelé.")

        return jsonify(sous_objectif), 201

    resultat = executer_supabase(
        supabase.table("sous_objectifs").insert({
            "objectif_id": objectif_id,
            "texte": texte,
            "accompli": False,
            "temps": 0,
            "etat": "en attente",
            "type": "maîtrisable",
            "priorite": "moyenne",
            "archived": False,
        })
    )
    if resultat is None:
        sous_objectif = storage.create_sous_objectif(objectif_id, texte)
        if sous_objectif is None:
            return erreur_api("Cet objectif est gelé.")

        return jsonify(sous_objectif), 201

    return jsonify(resultat.data[0] if resultat.data else {}), 201


@app.patch("/api/sous-objectifs/<sous_objectif_id>")
def api_modifier_sous_objectif(sous_objectif_id):
    data = donnees_json()
    updates = {}

    if "accompli" in data:
        updates["accompli"] = bool(data["accompli"])
        updates["etat"] = "accompli" if updates["accompli"] else "en attente"

    if "temps" in data:
        try:
            temps = int(data["temps"])
        except (TypeError, ValueError):
            return erreur_api("Temps invalide.")

        updates["temps"] = max(0, temps)

    if "etat" in data and data["etat"] in ETATS_SOUS_OBJECTIFS:
        updates["etat"] = data["etat"]
        if data["etat"] == "accompli":
            updates["accompli"] = True
        elif "accompli" not in data:
            updates["accompli"] = False

    if "type" in data and data["type"] in TYPES_SOUS_OBJECTIFS:
        updates["type"] = data["type"]

    if "priorite" in data and data["priorite"] in PRIORITES_SOUS_OBJECTIFS:
        updates["priorite"] = data["priorite"]

    if "archived" in data:
        updates["archived"] = bool(data["archived"])

    if not updates:
        return erreur_api("Aucune donnée valide à modifier.")

    if mode_local():
        sous_objectif = storage.update_sous_objectif(sous_objectif_id, updates)
        return jsonify(sous_objectif or {})

    resultat = executer_supabase(supabase.table("sous_objectifs").update(updates).eq("id", sous_objectif_id))
    if resultat is None:
        sous_objectif = storage.update_sous_objectif(sous_objectif_id, updates)
        return jsonify(sous_objectif or {})

    return jsonify(resultat.data[0] if resultat.data else {})


@app.delete("/api/sous-objectifs/<sous_objectif_id>")
def api_supprimer_sous_objectif(sous_objectif_id):
    if mode_local():
        storage.delete_sous_objectif(sous_objectif_id)
        return "", 204

    resultat = executer_supabase(supabase.table("sous_objectifs").delete().eq("id", sous_objectif_id))
    if resultat is None:
        storage.delete_sous_objectif(sous_objectif_id)
        return "", 204

    return "", 204


@app.route("/favicon.ico")
def favicon():
    return send_from_directory("static/icons", "favicon.ico")


@app.route("/service-worker.js")
def service_worker():
    return send_from_directory("static", "service-worker.js")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
