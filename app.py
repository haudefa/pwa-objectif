from flask import Flask, abort, flash, redirect, render_template, request, send_from_directory, session, url_for
from flask_cors import CORS
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
CORS(app)

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
    if request.method != "POST":
        return

    token_session = session.get("_csrf_token")
    token_formulaire = request.form.get("_csrf_token")

    if not token_session or not token_formulaire or not secrets.compare_digest(token_session, token_formulaire):
        abort(400)


@app.before_request
def verifier_authentification():
    endpoints_publics = {"login", "static", "favicon", "service_worker"}

    if request.endpoint in endpoints_publics:
        return

    if session.get("authentifie"):
        return

    return redirect(url_for("login", next=request.full_path if request.query_string else request.path))


def mot_de_passe_valide(mot_de_passe):
    return secrets.compare_digest(mot_de_passe, app.config["AUTH_PASSWORD"])


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

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static/icons', 'favicon.ico')

@app.route('/service-worker.js')
def service_worker():
    return send_from_directory('static', 'service-worker.js')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
