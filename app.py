from flask import Flask, abort, flash, jsonify, redirect, render_template, request, send_from_directory, session, url_for
import os
import secrets
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = Flask(__name__, static_folder='static')
app.secret_key = os.environ.get("SECRET_KEY", "objectif-dev")
app.config["AUTH_PASSWORD"] = os.environ.get("OBJECTIF_PASSWORD", "objectif123")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

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
    endpoints_publics = {"login", "static", "favicon", "service_worker"}

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
    try:
        return requete.execute()
    except Exception as erreur:
        return erreur_api(str(erreur), 502)


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
    resultat = executer_supabase(supabase.table("objectifs").select("*, sous_objectifs(*)"))
    if isinstance(resultat, tuple):
        return resultat

    return jsonify(resultat.data or [])


@app.post("/api/objectifs")
def api_creer_objectif():
    data = donnees_json()
    titre = data.get("titre", "").strip()
    categorie = data.get("categorie", "").strip()

    if not titre:
        return erreur_api("Le titre est obligatoire.")

    resultat = executer_supabase(
        supabase.table("objectifs").insert({
            "titre": titre,
            "categorie": categorie,
            "archived": False
        })
    )
    if isinstance(resultat, tuple):
        return resultat

    return jsonify(resultat.data[0] if resultat.data else {}), 201


@app.patch("/api/objectifs/<objectif_id>")
def api_modifier_objectif(objectif_id):
    data = donnees_json()
    updates = {}

    if "archived" in data:
        updates["archived"] = bool(data["archived"])

    if not updates:
        return erreur_api("Aucune donnée valide à modifier.")

    resultat = executer_supabase(supabase.table("objectifs").update(updates).eq("id", objectif_id))
    if isinstance(resultat, tuple):
        return resultat

    return jsonify(resultat.data[0] if resultat.data else {})


@app.delete("/api/objectifs/<objectif_id>")
def api_supprimer_objectif(objectif_id):
    resultat = executer_supabase(supabase.table("objectifs").delete().eq("id", objectif_id))
    if isinstance(resultat, tuple):
        return resultat

    return "", 204


@app.post("/api/objectifs/<objectif_id>/sous-objectifs")
def api_creer_sous_objectif(objectif_id):
    data = donnees_json()
    texte = data.get("texte", "").strip()

    if not texte:
        return erreur_api("Le sous-objectif est obligatoire.")

    resultat = executer_supabase(
        supabase.table("sous_objectifs").insert({
            "objectif_id": objectif_id,
            "texte": texte,
            "accompli": False,
            "temps": 0,
            "etat": "en attente",
            "type": "maîtrisable",
            "priorite": "moyenne",
            "archived": False
        })
    )
    if isinstance(resultat, tuple):
        return resultat

    return jsonify(resultat.data[0] if resultat.data else {}), 201


@app.patch("/api/sous-objectifs/<sous_objectif_id>")
def api_modifier_sous_objectif(sous_objectif_id):
    data = donnees_json()
    updates = {}

    if "accompli" in data:
        updates["accompli"] = bool(data["accompli"])

    if "temps" in data:
        try:
            temps = int(data["temps"])
        except (TypeError, ValueError):
            return erreur_api("Temps invalide.")

        updates["temps"] = max(0, temps)

    if "etat" in data and data["etat"] in ETATS_SOUS_OBJECTIFS:
        updates["etat"] = data["etat"]

    if "type" in data and data["type"] in TYPES_SOUS_OBJECTIFS:
        updates["type"] = data["type"]

    if "priorite" in data and data["priorite"] in PRIORITES_SOUS_OBJECTIFS:
        updates["priorite"] = data["priorite"]

    if "archived" in data:
        updates["archived"] = bool(data["archived"])

    if not updates:
        return erreur_api("Aucune donnée valide à modifier.")

    resultat = executer_supabase(supabase.table("sous_objectifs").update(updates).eq("id", sous_objectif_id))
    if isinstance(resultat, tuple):
        return resultat

    return jsonify(resultat.data[0] if resultat.data else {})


@app.delete("/api/sous-objectifs/<sous_objectif_id>")
def api_supprimer_sous_objectif(sous_objectif_id):
    resultat = executer_supabase(supabase.table("sous_objectifs").delete().eq("id", sous_objectif_id))
    if isinstance(resultat, tuple):
        return resultat

    return "", 204

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static/icons', 'favicon.ico')

@app.route('/service-worker.js')
def service_worker():
    return send_from_directory('static', 'service-worker.js')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
