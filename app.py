from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = Flask(__name__, static_folder='static')
CORS(app)

@app.route("/")
def home():
    return render_template("index.html")

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    try:
        user = supabase.auth.sign_up({"email": email, "password": password})
        return jsonify(success=True, user_id=user.user.id)
    except Exception as e:
        print("Erreur lors de l'inscription :", e)
        return jsonify(success=False, error=str(e)), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    try:
        user_session = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return jsonify(
            success=True,
            access_token=user_session.session.access_token,
            user={"id": user_session.user.id}
        )
    except Exception as e:
        print("Erreur lors de la connexion :", e)
        return jsonify(success=False, error=str(e)), 400

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
