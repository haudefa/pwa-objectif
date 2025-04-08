
// app.js - version frontend Supabase compacte avec affichage titre, tri/filtrage, suppression et archivage

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://bhxleyufbnmodrtvuube.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoeGxleXVmYm5tb2RydHZ1dWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MDYzNzMsImV4cCI6MjA1OTA4MjM3M30.Y3w1pg6Te9RblajnnK_zorAdbrfMEuRl720AWKOmbAU"
);

const timers = {};
let session = null;
let user = null;

let filtrePriorite = "toutes";
let filtreEtat = "tous";
let afficherArchives = false;

window.onload = async () => {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  user = session?.user || null;
  verifierConnexion();
  if (user) chargerObjectifs();

  document.getElementById('filtre-priorite').onchange = (e) => {
    filtrePriorite = e.target.value;
    chargerObjectifs();
  };

  document.getElementById('filtre-etat').onchange = (e) => {
    filtreEtat = e.target.value;
    chargerObjectifs();
  };

  document.getElementById('filtre-archive').onchange = (e) => {
    afficherArchives = e.target.checked;
    chargerObjectifs();
  };
};

function verifierConnexion() {
  document.getElementById('auth').classList.toggle('hidden', user !== null);
  document.getElementById('objectifs').classList.toggle('hidden', user === null);
  document.getElementById('logout').classList.toggle('hidden', user === null);
}

function logout() {
  supabase.auth.signOut().then(() => {
    user = null;
    verifierConnexion();
  });
}

async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) alert("Erreur inscription : " + error.message);
  else alert("Inscription réussie ! Vérifie ton email.");
}

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert("Erreur connexion : " + error.message);
  else {
    session = data.session;
    user = session.user;
    alert("Connexion réussie !");
    verifierConnexion();
    chargerObjectifs();
  }
}

async function ajouterObjectif() {
  const titre = document.getElementById('titre').value.trim();
  const categorie = document.getElementById('categorie').value;
  if (!titre || !user) return alert("Titre requis ou utilisateur non connecté");
  const { error } = await supabase.from("objectifs").insert({ titre, categorie, user_id: user.id });
  if (error) alert("Erreur ajout objectif : " + error.message);
  else {
    document.getElementById('titre').value = '';
    chargerObjectifs();
  }
}

async function ajouterSousObjectif(objectif_id, input) {
  const texte = input.value.trim();
  if (!texte) return input.classList.add("border-red-500");
  input.classList.remove("border-red-500");
  const { error } = await supabase.from("sous_objectifs").insert({
    texte, objectif_id, accompli: false, etat: "en attente", type: "maîtrisable", priorite: "moyenne", temps: 0
  });
  if (error) alert("Erreur ajout sous-objectif : " + error.message);
  else {
    input.value = '';
    chargerObjectifs();
  }
}

async function updateSous(sousId, field, value) {
  await supabase.from("sous_objectifs").update({ [field]: value }).eq("id", sousId);
}

async function supprimerObjectif(objectifId) {
  const { error } = await supabase.from("objectifs").delete().eq("id", objectifId);
  if (error) alert("Erreur suppression objectif : " + error.message);
  else chargerObjectifs();
}

async function supprimerSousObjectif(sousId) {
  const { error } = await supabase.from("sous_objectifs").delete().eq("id", sousId);
  if (error) alert("Erreur suppression sous-objectif : " + error.message);
  else chargerObjectifs();
}

async function archiverObjectif(id) {
  const { error } = await supabase.from("objectifs").update({ archived: true }).eq("id", id);
  if (error) alert("Erreur archivage : " + error.message);
  else chargerObjectifs();
}

async function archiverSousObjectif(id) {
  const { error } = await supabase.from("sous_objectifs").update({ archived: true }).eq("id", id);
  if (error) alert("Erreur archivage sous-objectif : " + error.message);
  else chargerObjectifs();
}

async function toggleSousObjectif(sousId) {
  const checkbox = document.getElementById(`check-${sousId}`);
  await updateSous(sousId, 'accompli', checkbox.checked);
  chargerObjectifs();
}

async function toggleTimer(sousId, btn) {
  const key = `timer-${sousId}`;
  if (timers[key]) {
    clearInterval(timers[key]);
    timers[key] = null;
    btn.textContent = 'Start';
  } else {
    const startTime = Date.now();
    timers[key] = setInterval(() => {
      const temps = Math.floor((Date.now() - startTime) / 1000);
      updateSous(sousId, 'temps', temps);
    }, 1000);
    btn.textContent = 'Stop';
  }
}

function changerChampsSousObjectif(sousId, field, value) {
  updateSous(sousId, field, value);
}

function chargerObjectifs() {
  supabase.from("objectifs").select("*, sous_objectifs(*)").then(({ data, error }) => {
    if (error) return console.error("Erreur récupération objectifs :", error);
    const liste = document.getElementById('liste');
    liste.innerHTML = '';

    data
      .filter(obj => afficherArchives || !obj.archived)
      .forEach((obj) => {
        const total = obj.sous_objectifs.length;
        const done = obj.sous_objectifs.filter(s => s.accompli).length;
        const percent = total ? Math.round((done / total) * 100) : 0;

        const card = document.createElement('div');
        card.className = 'border p-4 rounded-xl bg-zinc-900 text-white shadow space-y-4 text-sm';
        card.innerHTML = `
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-lg font-bold">${obj.titre}</h2>
              <p class="text-sm text-gray-400">Catégorie : ${obj.categorie}</p>
            </div>
            <div class="space-x-1">
              <button onclick="archiverObjectif('${obj.id}')" class="text-gray-400">📥</button>
              <button onclick="supprimerObjectif('${obj.id}')" class="text-red-500">🗑</button>
            </div>
          </div>
          <div class="flex justify-center">
            <svg class="w-16 h-16" viewBox="0 0 36 36">
              <path class="text-gray-700" stroke="currentColor" stroke-width="3.8" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="text-blue-500" stroke="currentColor" stroke-width="3.8" fill="none"
                stroke-dasharray="${percent}, 100" stroke-linecap="round"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <text x="18" y="20.35" class="text-sm fill-current text-white" text-anchor="middle">${percent}%</text>
            </svg>
          </div>
        `;

        obj.sous_objectifs
          .filter(s => (afficherArchives || !s.archived))
          .filter(s => (filtrePriorite === "toutes" || s.priorite === filtrePriorite))
          .filter(s => (filtreEtat === "tous" || s.etat === filtreEtat))
          .forEach((s) => {
            const sous = document.createElement('div');
            sous.className = 'bg-zinc-800 p-3 rounded-xl space-y-2 text-sm';
            sous.innerHTML = `
              <div class="flex justify-between items-center">
                <span class="font-semibold">• ${s.texte}</span>
                <div class="space-x-2">
                  <input id="check-${s.id}" type="checkbox" ${s.accompli ? 'checked' : ''} onchange="toggleSousObjectif('${s.id}')">
                  <button onclick="archiverSousObjectif('${s.id}')" class="text-gray-400">📥</button>
                  <button onclick="supprimerSousObjectif('${s.id}')" class="text-red-500">✖</button>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <select onchange="changerChampsSousObjectif('${s.id}', 'etat', this.value)" class="p-2 bg-zinc-700 text-white rounded">
                  <option value="en attente" ${s.etat === 'en attente' ? 'selected' : ''}>En attente</option>
                  <option value="bloqué" ${s.etat === 'bloqué' ? 'selected' : ''}>Bloqué</option>
                  <option value="accompli" ${s.etat === 'accompli' ? 'selected' : ''}>Accompli</option>
                </select>
                <select onchange="changerChampsSousObjectif('${s.id}', 'type', this.value)" class="p-2 bg-zinc-700 text-white rounded">
                  <option value="maîtrisable" ${s.type === 'maîtrisable' ? 'selected' : ''}>Maîtrisable</option>
                  <option value="aléatoire" ${s.type === 'aléatoire' ? 'selected' : ''}>Aléatoire</option>
                </select>
              </div>
              <div>
                <select onchange="changerChampsSousObjectif('${s.id}', 'priorite', this.value)" class="w-full p-2 bg-zinc-700 text-white rounded">
                  <option value="basse" ${s.priorite === 'basse' ? 'selected' : ''}>Basse</option>
                  <option value="moyenne" ${s.priorite === 'moyenne' ? 'selected' : ''}>Moyenne</option>
                  <option value="haute" ${s.priorite === 'haute' ? 'selected' : ''}>Haute</option>
                </select>
              </div>
              <div class="flex justify-between items-center">
                <span>⏱ ${s.temps || 0}s</span>
                <button onclick="toggleTimer('${s.id}', this)" class="px-3 py-1 bg-blue-500 text-white rounded">Start</button>
              </div>
            `;
            card.appendChild(sous);
          });

        const sousInput = document.createElement('div');
        sousInput.className = 'mt-2 flex gap-2';
        sousInput.innerHTML = `
          <input id="sous-${obj.id}" type="text" placeholder="Ajouter un sous-objectif..." class="flex-1 px-2 py-1 border rounded bg-zinc-800 text-white placeholder-gray-400 text-xs">
          <button onclick="ajouterSousObjectif('${obj.id}', document.getElementById('sous-${obj.id}'))" class="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600">Ajouter</button>
        `;
        card.appendChild(sousInput);
        liste.appendChild(card);
      });
  });
}

window.signup = signup;
window.login = login;
window.logout = logout;
window.ajouterObjectif = ajouterObjectif;
window.ajouterSousObjectif = ajouterSousObjectif;
window.supprimerObjectif = supprimerObjectif;
window.supprimerSousObjectif = supprimerSousObjectif;
window.archiverObjectif = archiverObjectif;
window.archiverSousObjectif = archiverSousObjectif;
window.toggleSousObjectif = toggleSousObjectif;
window.toggleTimer = toggleTimer;
window.changerChampsSousObjectif = changerChampsSousObjectif;