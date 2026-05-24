const timers = {};
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

let filtrePriorite = "toutes";
let filtreEtat = "tous";
let afficherArchives = false;
let filtreRecherche = "";
let triObjectifs = "recent";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function apiRequest(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (options.body && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  if ((options.method || "GET") !== "GET") {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Erreur serveur.");
  }

  if (response.status === 204) return null;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Session expirée.");
  }

  return response.json();
}

window.onload = () => {
  chargerObjectifs();
  document.getElementById("filtre-priorite").onchange = (e) => {
    filtrePriorite = e.target.value;
    chargerObjectifs();
  };

  document.getElementById("filtre-etat").onchange = (e) => {
    filtreEtat = e.target.value;
    chargerObjectifs();
  };

  document.getElementById("filtre-archive").onchange = (e) => {
    afficherArchives = e.target.checked;
    chargerObjectifs();
  };

  document.getElementById("filtre-recherche").oninput = (e) => {
    filtreRecherche = e.target.value.trim().toLowerCase();
    chargerObjectifs();
  };

  document.getElementById("tri-objectifs").onchange = (e) => {
    triObjectifs = e.target.value;
    chargerObjectifs();
  };

  document.getElementById("titre").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      ajouterObjectif();
    }
  });
};

async function ajouterObjectif() {
  const titre = document.getElementById("titre").value.trim();
  const categorie = document.getElementById("categorie").value.trim();

  if (!titre) {
    alert("Le titre est obligatoire.");
    return;
  }

  try {
    await apiRequest("/api/objectifs", {
      method: "POST",
      body: {
      titre,
      categorie,
      },
    });
  } catch (error) {
    alert("Erreur ajout objectif : " + error.message);
    return;
  }

  document.getElementById("titre").value = "";
  document.getElementById("categorie").value = "";

  chargerObjectifs();
}

async function ajouterSousObjectif(objectifId, input) {
  const texte = input.value.trim();

  if (!texte) {
    alert("Le sous-objectif est obligatoire.");
    return;
  }

  try {
    await apiRequest(`/api/objectifs/${objectifId}/sous-objectifs`, {
      method: "POST",
      body: {
      texte,
      },
    });
  } catch (error) {
    alert("Erreur ajout sous-objectif : " + error.message);
    return;
  }

  input.value = "";
  chargerObjectifs();
}

async function updateSous(sousId, field, value) {
  try {
    await apiRequest(`/api/sous-objectifs/${sousId}`, {
      method: "PATCH",
      body: { [field]: value },
    });
  } catch (error) {
    console.error("Erreur mise à jour sous-objectif :", error);
  }
}

async function supprimerObjectif(id) {
  const confirmation = confirm("Supprimer cet objectif ?");

  if (!confirmation) return;

  try {
    await apiRequest(`/api/objectifs/${id}`, { method: "DELETE" });
    chargerObjectifs();
  } catch (error) {
    alert("Erreur suppression objectif : " + error.message);
  }
}

async function supprimerSousObjectif(sousId) {
  const confirmation = confirm("Supprimer ce sous-objectif ?");

  if (!confirmation) return;

  try {
    await apiRequest(`/api/sous-objectifs/${sousId}`, { method: "DELETE" });
    chargerObjectifs();
  } catch (error) {
    alert("Erreur suppression sous-objectif : " + error.message);
  }
}

async function archiverObjectif(id) {
  try {
    await apiRequest(`/api/objectifs/${id}`, {
      method: "PATCH",
      body: { archived: true },
    });
    chargerObjectifs();
  } catch (error) {
    alert("Erreur archivage : " + error.message);
  }
}

async function archiverSousObjectif(id) {
  try {
    await apiRequest(`/api/sous-objectifs/${id}`, {
      method: "PATCH",
      body: { archived: true },
    });
    chargerObjectifs();
  } catch (error) {
    alert("Erreur archivage sous-objectif : " + error.message);
  }
}

async function toggleSousObjectif(sousId) {
  const checkbox = document.getElementById(`check-${sousId}`);

  await updateSous(sousId, "accompli", checkbox.checked);

  chargerObjectifs();
}

async function toggleTimer(sousId, btn) {
  const key = `timer-${sousId}`;

  if (timers[key]) {
    clearInterval(timers[key]);
    timers[key] = null;
    btn.textContent = "Démarrer";
  } else {
    const baseTime = Number(btn.dataset.time) || 0;
    const startTime = Date.now();

    timers[key] = setInterval(() => {
      const temps = baseTime + Math.floor((Date.now() - startTime) / 1000);
      btn.dataset.time = String(temps);
      const timeLabel = document.getElementById(`time-${sousId}`);
      if (timeLabel) timeLabel.textContent = formatDuration(temps);
      updateSous(sousId, "temps", temps);
    }, 1000);

    btn.textContent = "Arrêter";
  }
}

function changerChampsSousObjectif(sousId, field, value) {
  updateSous(sousId, field, value);
}

function formatDuration(seconds = 0) {
  const total = Number(seconds) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;

  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  return `${rest}s`;
}

function getPriorityClass(priority) {
  if (priority === "haute") return "border-red-400/40 bg-red-400/10 text-red-200";
  if (priority === "basse") return "border-neutral-600 bg-neutral-800 text-neutral-300";
  return "border-amber-300/40 bg-amber-300/10 text-amber-100";
}

function getStateClass(state) {
  if (state === "accompli") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (state === "bloqué") return "border-red-400/40 bg-red-400/10 text-red-200";
  return "border-neutral-600 bg-neutral-900 text-neutral-300";
}

function buildEmptyState(message) {
  return `
    <p class="border border-dashed border-neutral-700 bg-neutral-900 px-4 py-10 text-center text-sm text-neutral-400">
      ${message}
    </p>
  `;
}

function renderDashboard(objectifs) {
  const dashboard = document.getElementById("dashboard");

  const objectifsActifs = objectifs.filter((o) => !o.archived);
  const sousObjectifs = objectifsActifs.flatMap((o) => o.sous_objectifs || []);

  const totalSous = sousObjectifs.length;
  const totalDone = sousObjectifs.filter((s) => s.accompli).length;
  const totalTime = sousObjectifs.reduce(
    (acc, s) => acc + (Number(s.temps) || 0),
    0
  );

  const progress = totalSous ? Math.round((totalDone / totalSous) * 100) : 0;

  dashboard.innerHTML = `
    <div class="border border-neutral-800 bg-neutral-900 p-4">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Objectifs</p>
      <p class="mt-2 text-2xl font-semibold text-white">${objectifsActifs.length}</p>
    </div>

    <div class="border border-neutral-800 bg-neutral-900 p-4">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Tâches</p>
      <p class="mt-2 text-2xl font-semibold text-white">${totalDone}/${totalSous}</p>
    </div>

    <div class="border border-neutral-800 bg-neutral-900 p-4">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Progression</p>
      <p class="mt-2 text-2xl font-semibold text-emerald-300">${progress}%</p>
    </div>

    <div class="border border-neutral-800 bg-neutral-900 p-4">
      <p class="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Temps</p>
      <p class="mt-2 text-2xl font-semibold text-white">${formatDuration(totalTime)}</p>
    </div>
  `;
}

async function chargerObjectifs() {
  try {
      const data = await apiRequest("/api/objectifs");

      const liste = document.getElementById("liste");
      liste.innerHTML = "";

      const objectifs = (data || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );

      renderDashboard(objectifs);

      if (!objectifs.length) {
        liste.innerHTML = buildEmptyState(
          "Aucun objectif pour le moment."
        );
        return;
      }

      const objectifsVisibles = objectifs
        .filter((obj) => afficherArchives || !obj.archived)
        .filter((obj) => {
          const inTitre = obj.titre?.toLowerCase().includes(filtreRecherche);

          const inSous = (obj.sous_objectifs || []).some((s) =>
            s.texte?.toLowerCase().includes(filtreRecherche)
          );

          return !filtreRecherche || inTitre || inSous;
        });

      objectifsVisibles.sort((a, b) => {
        if (triObjectifs === "ancien") {
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        }

        if (triObjectifs === "progression") {
          const getP = (o) => {
            const total = o.sous_objectifs?.length || 0;
            const done = (o.sous_objectifs || []).filter(
              (s) => s.accompli
            ).length;

            return total ? done / total : 0;
          };

          return getP(b) - getP(a);
        }

        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      if (!objectifsVisibles.length) {
        liste.innerHTML = buildEmptyState(
          "Aucun objectif visible avec le filtre actuel."
        );
        return;
      }

      objectifsVisibles.forEach((obj) => {
        const total = obj.sous_objectifs.length;
        const done = obj.sous_objectifs.filter((s) => s.accompli).length;
        const percent = total ? Math.round((done / total) * 100) : 0;

        const card = document.createElement("div");
        card.className =
          "border border-neutral-800 bg-neutral-900 text-sm text-neutral-100 shadow-xl shadow-black/20";

        card.innerHTML = `
          <div class="grid gap-4 border-b border-neutral-800 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div class="min-w-0">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <span class="border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs font-medium text-neutral-300">
                  ${escapeHtml(obj.categorie)}
                </span>
                ${obj.archived ? '<span class="border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-400">Archive</span>' : ""}
              </div>
              <h2 class="break-words text-xl font-semibold leading-tight text-white">${escapeHtml(obj.titre)}</h2>
            </div>

            <div class="flex items-center justify-between gap-4 lg:justify-end">
              <div class="flex items-center gap-3">
                <svg class="h-16 w-16 shrink-0 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                  <path
                    class="text-neutral-800"
                    stroke="currentColor"
                    stroke-width="3.6"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />

                  <path
                    class="text-emerald-300"
                    stroke="currentColor"
                    stroke-width="3.6"
                    fill="none"
                    stroke-dasharray="${percent}, 100"
                    stroke-linecap="round"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div>
                  <p class="text-2xl font-semibold text-white">${percent}%</p>
                  <p class="text-xs text-neutral-500">${done}/${total} tâches</p>
                </div>
              </div>

              <div class="flex shrink-0 gap-2">
                <button onclick="archiverObjectif('${obj.id}')" title="Archiver" class="border border-neutral-700 px-2.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-amber-300 hover:text-amber-100">Archiver</button>
                <button onclick="supprimerObjectif('${obj.id}')" title="Supprimer" class="border border-neutral-700 px-2.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-red-300 hover:text-red-200">Supprimer</button>
              </div>
            </div>
          </div>
        `;

        const sousList = document.createElement("div");
        sousList.className = "divide-y divide-neutral-800";

        obj.sous_objectifs
          .filter((s) => afficherArchives || !s.archived)
          .filter(
            (s) =>
              filtrePriorite === "toutes" || s.priorite === filtrePriorite
          )
          .filter((s) => filtreEtat === "tous" || s.etat === filtreEtat)
          .forEach((s) => {
            const sous = document.createElement("div");
            sous.className = "grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_140px_140px_120px_160px]";

            sous.innerHTML = `
              <div class="flex min-w-0 items-start gap-3">
                <div class="pt-0.5">
                  <input
                    id="check-${s.id}"
                    type="checkbox"
                    ${s.accompli ? "checked" : ""}
                    onchange="toggleSousObjectif('${s.id}')"
                    class="h-4 w-4 accent-emerald-400"
                  >
                </div>
                <span class="min-w-0 break-words font-medium ${s.accompli ? "text-neutral-500 line-through" : "text-neutral-100"}">${escapeHtml(s.texte)}</span>
              </div>

              <select
                onchange="changerChampsSousObjectif('${s.id}', 'etat', this.value)"
                class="border px-2 py-2 text-xs outline-none transition focus:border-emerald-400 ${getStateClass(s.etat)}"
              >
                <option value="en attente" ${s.etat === "en attente" ? "selected" : ""}>En attente</option>
                <option value="bloqué" ${s.etat === "bloqué" ? "selected" : ""}>Bloqué</option>
                <option value="accompli" ${s.etat === "accompli" ? "selected" : ""}>Accompli</option>
              </select>

              <select
                onchange="changerChampsSousObjectif('${s.id}', 'type', this.value)"
                class="border border-neutral-700 bg-neutral-950 px-2 py-2 text-xs text-neutral-200 outline-none transition focus:border-emerald-400"
              >
                <option value="maîtrisable" ${s.type === "maîtrisable" ? "selected" : ""}>Maîtrisable</option>
                <option value="aléatoire" ${s.type === "aléatoire" ? "selected" : ""}>Aléatoire</option>
              </select>

              <select
                onchange="changerChampsSousObjectif('${s.id}', 'priorite', this.value)"
                class="border px-2 py-2 text-xs outline-none transition focus:border-emerald-400 ${getPriorityClass(s.priorite)}"
              >
                <option value="basse" ${s.priorite === "basse" ? "selected" : ""}>Basse</option>
                <option value="moyenne" ${s.priorite === "moyenne" ? "selected" : ""}>Moyenne</option>
                <option value="haute" ${s.priorite === "haute" ? "selected" : ""}>Haute</option>
              </select>

              <div class="flex items-center justify-between gap-2">
                <span id="time-${s.id}" class="font-mono text-xs text-neutral-400">${formatDuration(s.temps || 0)}</span>
                <button
                  onclick="toggleTimer('${s.id}', this)"
                  data-time="${Number(s.temps) || 0}"
                  class="border border-neutral-700 px-2.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-emerald-300 hover:text-emerald-100"
                >
                  Démarrer
                </button>
              </div>

              <div class="flex gap-2 lg:col-start-5">
                <button onclick="archiverSousObjectif('${s.id}')" title="Archiver" class="flex-1 border border-neutral-800 px-2 py-2 text-xs text-neutral-400 transition hover:border-amber-300 hover:text-amber-100">Archiver</button>
                <button onclick="supprimerSousObjectif('${s.id}')" title="Supprimer" class="flex-1 border border-neutral-800 px-2 py-2 text-xs text-neutral-400 transition hover:border-red-300 hover:text-red-200">Suppr.</button>
              </div>
            `;

            sousList.appendChild(sous);
          });

        card.appendChild(sousList);

        const sousInput = document.createElement("div");
        sousInput.className = "grid gap-2 border-t border-neutral-800 p-3 sm:grid-cols-[minmax(0,1fr)_auto]";

        sousInput.innerHTML = `
          <input
            id="sous-${obj.id}"
            type="text"
            placeholder="Ajouter un sous-objectif..."
            class="min-w-0 border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-emerald-400"
          >

          <button
            onclick="ajouterSousObjectif('${obj.id}', document.getElementById('sous-${obj.id}'))"
            class="bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300"
          >
            Ajouter
          </button>
        `;

        card.appendChild(sousInput);
        liste.appendChild(card);
      });
  } catch (error) {
    console.error("Erreur récupération objectifs :", error);
    const liste = document.getElementById("liste");
    liste.innerHTML = buildEmptyState("Impossible de charger les objectifs.");
  }
}

window.ajouterObjectif = ajouterObjectif;
window.ajouterSousObjectif = ajouterSousObjectif;
window.supprimerObjectif = supprimerObjectif;
window.supprimerSousObjectif = supprimerSousObjectif;
window.archiverObjectif = archiverObjectif;
window.archiverSousObjectif = archiverSousObjectif;
window.toggleSousObjectif = toggleSousObjectif;
window.toggleTimer = toggleTimer;
window.changerChampsSousObjectif = changerChampsSousObjectif;
