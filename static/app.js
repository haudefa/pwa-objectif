const timers = {};
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

let filtrePriorite = "toutes";
let filtreEtat = "tous";
let afficherArchives = false;
let filtreRecherche = "";
let triObjectifs = "recent";
let derniereProgressionSeries = [];

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
  const dateDebut = document.getElementById("date-debut");
  if (dateDebut) dateDebut.value = new Date().toISOString().slice(0, 10);

  chargerObjectifs();
  window.addEventListener("resize", () => {
    dessinerGraphiqueProgression(derniereProgressionSeries);
  });
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
  const startDate = document.getElementById("date-debut").value;
  const endDate = document.getElementById("date-fin").value;

  if (!titre) {
    alert("Le titre est obligatoire.");
    return;
  }

  if (endDate && startDate && startDate > endDate) {
    alert("La date de fin doit être après la date de début.");
    return;
  }

  try {
    await apiRequest("/api/objectifs", {
      method: "POST",
      body: {
        titre,
        categorie,
        start_date: startDate,
        end_date: endDate,
      },
    });
  } catch (error) {
    alert("Erreur ajout objectif : " + error.message);
    return;
  }

  document.getElementById("titre").value = "";
  document.getElementById("categorie").value = "";
  document.getElementById("date-debut").value = new Date().toISOString().slice(0, 10);
  document.getElementById("date-fin").value = "";

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

async function modifierDatesObjectif(id) {
  const startDate = document.getElementById(`date-debut-${id}`)?.value || "";
  const endDate = document.getElementById(`date-fin-${id}`)?.value || "";

  if (startDate && endDate && startDate > endDate) {
    alert("La date de fin doit être après la date de début.");
    return;
  }

  try {
    await apiRequest(`/api/objectifs/${id}`, {
      method: "PATCH",
      body: {
        start_date: startDate,
        end_date: endDate,
      },
    });
    chargerObjectifs();
  } catch (error) {
    alert("Erreur mise à jour des dates : " + error.message);
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

  if (checkbox.checked) {
    stopTimer(sousId);
  }

  await updateSous(sousId, "accompli", checkbox.checked);

  chargerObjectifs();
}

async function marquerSousObjectifAccompli(sousId) {
  stopTimer(sousId);
  await updateSous(sousId, "accompli", true);
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

function stopTimer(sousId) {
  const key = `timer-${sousId}`;

  if (!timers[key]) return;

  clearInterval(timers[key]);
  timers[key] = null;

  const btn = document.querySelector(`[data-timer-id="${sousId}"]`);
  if (btn) btn.textContent = "Démarrer";
}

async function changerChampsSousObjectif(sousId, field, value) {
  if (field === "etat" && value === "accompli") {
    stopTimer(sousId);
  }

  await updateSous(sousId, field, value);
  chargerObjectifs();
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

function isSousObjectifAccompli(sousObjectif) {
  return sousObjectif.accompli || sousObjectif.etat === "accompli";
}

function isObjectifGele(objectif, progression = null) {
  return objectif.frozen || (objectif.archived && progression === 100);
}

function getObjectifDateAjout(objectif) {
  return objectif.metadata?.date_ajout || objectif.created_at || "";
}

function getObjectifStartDate(objectif) {
  return objectif.metadata?.date_debut || objectif.start_date || objectif.created_at?.slice(0, 10) || "";
}

function getObjectifEndDate(objectif) {
  return objectif.metadata?.date_fin || objectif.end_date || "";
}

function parseLocalDate(value) {
  if (!value) return null;

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysBetween(from, to) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

function getDeadlineInfo(objectif, percent) {
  const startDate = parseLocalDate(getObjectifStartDate(objectif));
  const endDate = parseLocalDate(getObjectifEndDate(objectif));

  if (!endDate) {
    return {
      status: "none",
      label: "Sans limite",
      tone: "border-neutral-700 bg-neutral-950 text-neutral-400",
      expected: 0,
      remainingDays: null,
    };
  }

  const today = startOfToday();
  const remainingDays = daysBetween(today, endDate);
  const totalDays = startDate ? Math.max(1, daysBetween(startDate, endDate)) : 1;
  const elapsedDays = startDate ? Math.min(totalDays, Math.max(0, daysBetween(startDate, today))) : 0;
  const expected = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  if (percent >= 100) {
    return {
      status: "done",
      label: "Terminé dans le suivi",
      tone: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
      expected,
      remainingDays,
    };
  }

  if (remainingDays < 0) {
    return {
      status: "late",
      label: `${Math.abs(remainingDays)} j de retard`,
      tone: "border-red-400/50 bg-red-400/10 text-red-200",
      expected,
      remainingDays,
    };
  }

  if (percent + 15 < expected) {
    return {
      status: "behind",
      label: `Rythme à rattraper`,
      tone: "border-orange-300/50 bg-orange-300/10 text-orange-100",
      expected,
      remainingDays,
    };
  }

  if (remainingDays <= 2) {
    return {
      status: "urgent",
      label: `${remainingDays} j restant${remainingDays > 1 ? "s" : ""}`,
      tone: "border-amber-300/50 bg-amber-300/10 text-amber-100",
      expected,
      remainingDays,
    };
  }

  return {
    status: "ok",
    label: `${remainingDays} j restants`,
    tone: "border-sky-300/40 bg-sky-300/10 text-sky-100",
    expected,
    remainingDays,
  };
}

function getFocusScore(objectif, percent) {
  const deadline = getDeadlineInfo(objectif, percent);

  if (deadline.status === "late") return 400;
  if (deadline.status === "behind") return 300;
  if (deadline.status === "urgent") return 250;
  if (deadline.status === "ok") return 100 - percent;
  return 0;
}

function formatDateLongue(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Non définie";

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderTodayFocus(objectifs) {
  const container = document.getElementById("today-focus");
  const count = document.getElementById("today-focus-count");

  if (!container || !count) return;

  const focusItems = objectifs
    .filter((objectif) => !objectif.archived && !objectif.frozen)
    .map((objectif) => {
      const sousObjectifs = objectif.sous_objectifs || [];
      const total = sousObjectifs.length;
      const done = sousObjectifs.filter(isSousObjectifAccompli).length;
      const percent = total ? Math.round((done / total) * 100) : 0;
      const deadline = getDeadlineInfo(objectif, percent);
      const nextSousObjectif = sousObjectifs.find((s) => !isSousObjectifAccompli(s) && !s.archived);

      return {
        objectif,
        percent,
        deadline,
        nextSousObjectif,
        score: getFocusScore(objectif, percent),
      };
    })
    .filter((item) => item.nextSousObjectif && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  count.textContent = focusItems.length ? `${focusItems.length} priorité${focusItems.length > 1 ? "s" : ""}` : "";

  if (!focusItems.length) {
    container.innerHTML = `
      <p class="border border-dashed border-neutral-700 bg-neutral-950 px-3 py-4 text-sm text-neutral-400">
        Aucun objectif urgent pour aujourd'hui.
      </p>
    `;
    return;
  }

  container.innerHTML = focusItems.map((item) => `
        <div class="grid gap-2 border border-neutral-800 bg-neutral-950 p-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div class="min-w-0">
        <div class="mb-1 flex flex-wrap items-center gap-2">
          <span class="border px-2 py-1 text-xs font-medium ${item.deadline.tone}">${item.deadline.label}</span>
          <span class="text-xs text-neutral-500">${item.percent}% réalisé</span>
        </div>
        <p class="break-words font-medium text-white">${escapeHtml(item.objectif.titre)}</p>
        <p class="mt-1 break-words text-xs text-neutral-400">Prochaine action : ${escapeHtml(item.nextSousObjectif.texte)}</p>
      </div>
      <button onclick="marquerSousObjectifAccompli('${item.nextSousObjectif.id}')" class="w-full border border-emerald-300/60 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300 hover:text-neutral-950 md:w-auto">
        Marquer accompli
      </button>
    </div>
  `).join("");
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
  const totalDone = sousObjectifs.filter(isSousObjectifAccompli).length;
  const totalTime = sousObjectifs.reduce(
    (acc, s) => acc + (Number(s.temps) || 0),
    0
  );
  const objectifsSousPression = objectifsActifs.filter((objectif) => {
    const total = objectif.sous_objectifs?.length || 0;
    const done = (objectif.sous_objectifs || []).filter(isSousObjectifAccompli).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const deadline = getDeadlineInfo(objectif, percent);
    return ["late", "behind", "urgent"].includes(deadline.status);
  }).length;

  const progress = totalSous ? Math.round((totalDone / totalSous) * 100) : 0;

  dashboard.innerHTML = `
    <div class="border border-neutral-800 bg-neutral-900 p-3 sm:p-4">
      <p class="text-[11px] font-medium uppercase text-neutral-500 sm:text-xs">Objectifs</p>
      <p class="mt-1 text-xl font-semibold text-white sm:mt-2 sm:text-2xl">${objectifsActifs.length}</p>
    </div>

    <div class="border border-neutral-800 bg-neutral-900 p-3 sm:p-4">
      <p class="text-[11px] font-medium uppercase text-neutral-500 sm:text-xs">Tâches</p>
      <p class="mt-1 text-xl font-semibold text-white sm:mt-2 sm:text-2xl">${totalDone}/${totalSous}</p>
    </div>

    <div class="border border-neutral-800 bg-neutral-900 p-3 sm:p-4">
      <p class="text-[11px] font-medium uppercase text-neutral-500 sm:text-xs">Progression</p>
      <p class="mt-1 text-xl font-semibold text-emerald-300 sm:mt-2 sm:text-2xl">${progress}%</p>
    </div>

    <div class="border border-neutral-800 bg-neutral-900 p-3 sm:p-4">
      <p class="text-[11px] font-medium uppercase text-neutral-500 sm:text-xs">Temps</p>
      <p class="mt-1 text-xl font-semibold text-white sm:mt-2 sm:text-2xl">${formatDuration(totalTime)}</p>
    </div>

    <div class="border border-neutral-800 bg-neutral-900 p-3 sm:p-4">
      <p class="text-[11px] font-medium uppercase text-neutral-500 sm:text-xs">Échéances</p>
      <p class="mt-1 text-xl font-semibold sm:mt-2 sm:text-2xl ${objectifsSousPression ? "text-amber-300" : "text-emerald-300"}">${objectifsSousPression}</p>
    </div>
  `;
}

function formatDateCourte(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function dessinerGraphiqueProgression(series) {
  const canvas = document.getElementById("progression-chart");
  const resume = document.getElementById("progression-resume");
  const legend = document.getElementById("progression-legend");

  if (!canvas || !resume) return;

  const parent = canvas.parentElement;
  const width = parent.clientWidth;
  const height = parent.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const lignes = (series || [])
    .map((objectif) => ({
      ...objectif,
      points: (objectif.points || [])
        .map((point) => ({
          date: new Date(point.date),
          progression: Number(point.progression) || 0,
        }))
        .filter((point) => !Number.isNaN(point.date.getTime()))
        .sort((a, b) => a.date - b.date),
    }))
    .filter((objectif) => objectif.points.length);

  if (!lignes.length) {
    resume.textContent = "Aucune donnée";
    if (legend) legend.innerHTML = "";
    ctx.fillStyle = "#737373";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Le graphique apparaîtra après les premières progressions.", width / 2, height / 2);
    return;
  }

  const allPoints = lignes.flatMap((objectif) => objectif.points);
  const minDate = Math.min(...allPoints.map((point) => point.date.getTime()));
  const maxDate = Math.max(...allPoints.map((point) => point.date.getTime()));
  const dateRange = Math.max(1, maxDate - minDate);
  const padding = { top: 18, right: 18, bottom: 34, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const colors = ["#34d399", "#fbbf24", "#60a5fa", "#f87171", "#c084fc", "#2dd4bf"];

  if (legend) {
    legend.innerHTML = lignes.map((objectif, index) => {
      const color = colors[index % colors.length];
      const dernierPoint = objectif.points[objectif.points.length - 1];

      return `
        <span class="inline-flex max-w-full items-center gap-2 border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-300 sm:text-xs">
          <span class="h-2.5 w-2.5 shrink-0" style="background:${color}"></span>
          <span class="truncate">${escapeHtml(objectif.titre)}</span>
          <span class="text-neutral-500">${dernierPoint.progression}%</span>
        </span>
      `;
    }).join("");
  }

  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#a3a3a3";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  [0, 25, 50, 75, 100].forEach((value) => {
    const y = padding.top + chartHeight - (value / 100) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(`${value}%`, padding.left - 8, y);
  });

  lignes.forEach((objectif, index) => {
    const color = colors[index % colors.length];

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    objectif.points.forEach((point, pointIndex) => {
      const x = padding.left + ((point.date.getTime() - minDate) / dateRange) * chartWidth;
      const y = padding.top + chartHeight - (point.progression / 100) * chartHeight;

      if (pointIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    const dernierPoint = objectif.points[objectif.points.length - 1];
    const x = padding.left + ((dernierPoint.date.getTime() - minDate) / dateRange) * chartWidth;
    const y = padding.top + chartHeight - (dernierPoint.progression / 100) * chartHeight;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#737373";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(formatDateCourte(minDate), padding.left, height - 10);
  ctx.textAlign = "right";
  ctx.fillText(formatDateCourte(maxDate), width - padding.right, height - 10);

  resume.textContent = `${lignes.length} objectif${lignes.length > 1 ? "s" : ""} suivi${lignes.length > 1 ? "s" : ""}`;
}

async function chargerProgression() {
  try {
    const progression = await apiRequest("/api/progression");
    derniereProgressionSeries = progression;
    dessinerGraphiqueProgression(progression);
  } catch (error) {
    console.error("Erreur récupération progression :", error);
  }
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
      renderTodayFocus(objectifs);
      chargerProgression();

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
            const done = (o.sous_objectifs || []).filter(isSousObjectifAccompli).length;

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
        const done = obj.sous_objectifs.filter(isSousObjectifAccompli).length;
        const percent = total ? Math.round((done / total) * 100) : 0;
        const objectifGele = isObjectifGele(obj, percent);
        const disabledAttr = objectifGele ? "disabled" : "";
        const disabledClasses = objectifGele
          ? " disabled:cursor-not-allowed disabled:opacity-50"
          : "";
        const deadline = getDeadlineInfo(obj, percent);
        const dateAjout = formatDateLongue(getObjectifDateAjout(obj));
        const dateDebut = formatDateLongue(getObjectifStartDate(obj));
        const dateFin = formatDateLongue(getObjectifEndDate(obj));

        const card = document.createElement("div");
        card.className =
          "border border-neutral-800 bg-neutral-900 text-sm text-neutral-100 shadow-xl shadow-black/20";

        card.innerHTML = `
          <div class="grid gap-3 border-b border-neutral-800 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div class="min-w-0">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <span class="border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs font-medium text-neutral-300">
                  ${escapeHtml(obj.categorie)}
                </span>
                ${obj.archived ? '<span class="border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-400">Archive</span>' : ""}
                ${objectifGele ? '<span class="border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-xs font-medium text-emerald-100">Gelé</span>' : ""}
                <span class="border px-2 py-1 text-xs font-medium ${deadline.tone}">${deadline.label}</span>
              </div>
              <h2 class="break-words text-lg font-semibold leading-tight text-white sm:text-xl">${escapeHtml(obj.titre)}</h2>
              <div class="mt-3 grid gap-2 text-[11px] text-neutral-400 sm:grid-cols-2 sm:text-xs xl:grid-cols-4">
                <span class="border border-neutral-800 bg-neutral-950 px-2 py-1.5">Ajout : ${escapeHtml(dateAjout)}</span>
                <span class="border border-neutral-800 bg-neutral-950 px-2 py-1.5">Début : ${escapeHtml(dateDebut)}</span>
                <span class="border border-neutral-800 bg-neutral-950 px-2 py-1.5">Fin : ${escapeHtml(dateFin)}</span>
                <span class="border border-neutral-800 bg-neutral-950 px-2 py-1.5">Rythme attendu : ${deadline.expected}%</span>
              </div>
              <div class="mt-3 grid gap-2 sm:grid-cols-[140px_140px_auto]">
                <input id="date-debut-${obj.id}" type="date" value="${escapeHtml(getObjectifStartDate(obj))}" ${disabledAttr} class="border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-white outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                <input id="date-fin-${obj.id}" type="date" value="${escapeHtml(getObjectifEndDate(obj))}" ${disabledAttr} class="border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-white outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                <button onclick="modifierDatesObjectif('${obj.id}')" ${disabledAttr} class="border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-700 disabled:hover:text-neutral-300">Mettre à jour les dates</button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3 lg:justify-end">
              <div class="flex items-center gap-3">
                <svg class="h-14 w-14 shrink-0 -rotate-90 sm:h-16 sm:w-16" viewBox="0 0 36 36" aria-hidden="true">
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
                  <p class="text-xl font-semibold text-white sm:text-2xl">${percent}%</p>
                  <p class="text-xs text-neutral-500">${done}/${total} tâches</p>
                </div>
              </div>

              <div class="flex shrink-0 gap-2">
                <button onclick="archiverObjectif('${obj.id}')" title="Archiver" ${obj.archived ? "disabled" : ""} class="border border-neutral-700 px-2.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-700 disabled:hover:text-neutral-300">Archiver</button>
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
            sous.className = "grid gap-2 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_140px_140px_120px_160px] lg:gap-3";

            sous.innerHTML = `
              <div class="flex min-w-0 items-start gap-3 rounded-sm bg-neutral-950/60 p-2 lg:bg-transparent lg:p-0">
                <div class="pt-0.5">
                  <input
                    id="check-${s.id}"
                    type="checkbox"
                    ${isSousObjectifAccompli(s) ? "checked" : ""}
                    ${disabledAttr}
                    onchange="toggleSousObjectif('${s.id}')"
                    class="h-4 w-4 accent-emerald-400${disabledClasses}"
                  >
                </div>
                <span class="min-w-0 break-words text-sm font-medium ${isSousObjectifAccompli(s) ? "text-neutral-500 line-through" : "text-neutral-100"}">${escapeHtml(s.texte)}</span>
              </div>

              <select
                onchange="changerChampsSousObjectif('${s.id}', 'etat', this.value)"
                ${disabledAttr}
                class="w-full border px-2 py-2 text-xs outline-none transition focus:border-emerald-400 ${getStateClass(s.etat)}${disabledClasses}"
              >
                <option value="en attente" ${s.etat === "en attente" ? "selected" : ""}>En attente</option>
                <option value="bloqué" ${s.etat === "bloqué" ? "selected" : ""}>Bloqué</option>
                <option value="accompli" ${s.etat === "accompli" ? "selected" : ""}>Accompli</option>
              </select>

              <select
                onchange="changerChampsSousObjectif('${s.id}', 'type', this.value)"
                ${disabledAttr}
                class="w-full border border-neutral-700 bg-neutral-950 px-2 py-2 text-xs text-neutral-200 outline-none transition focus:border-emerald-400${disabledClasses}"
              >
                <option value="maîtrisable" ${s.type === "maîtrisable" ? "selected" : ""}>Maîtrisable</option>
                <option value="aléatoire" ${s.type === "aléatoire" ? "selected" : ""}>Aléatoire</option>
              </select>

              <select
                onchange="changerChampsSousObjectif('${s.id}', 'priorite', this.value)"
                ${disabledAttr}
                class="w-full border px-2 py-2 text-xs outline-none transition focus:border-emerald-400 ${getPriorityClass(s.priorite)}${disabledClasses}"
              >
                <option value="basse" ${s.priorite === "basse" ? "selected" : ""}>Basse</option>
                <option value="moyenne" ${s.priorite === "moyenne" ? "selected" : ""}>Moyenne</option>
                <option value="haute" ${s.priorite === "haute" ? "selected" : ""}>Haute</option>
              </select>

              <div class="flex items-center justify-between gap-2 rounded-sm bg-neutral-950/60 p-2 lg:bg-transparent lg:p-0">
                <span id="time-${s.id}" class="font-mono text-xs text-neutral-400">${formatDuration(s.temps || 0)}</span>
                <button
                  onclick="toggleTimer('${s.id}', this)"
                  data-timer-id="${s.id}"
                  data-time="${Number(s.temps) || 0}"
                  ${isSousObjectifAccompli(s) || objectifGele ? "disabled" : ""}
                  class="border border-neutral-700 px-2.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-700 disabled:hover:text-neutral-300"
                >
                  Démarrer
                </button>
              </div>

              <div class="grid grid-cols-2 gap-2 lg:col-start-5">
                <button onclick="archiverSousObjectif('${s.id}')" title="Archiver" ${disabledAttr} class="flex-1 border border-neutral-800 px-2 py-2 text-xs text-neutral-400 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-800 disabled:hover:text-neutral-400">Archiver</button>
                <button onclick="supprimerSousObjectif('${s.id}')" title="Supprimer" ${disabledAttr} class="flex-1 border border-neutral-800 px-2 py-2 text-xs text-neutral-400 transition hover:border-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-800 disabled:hover:text-neutral-400">Suppr.</button>
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
            ${disabledAttr}
            class="min-w-0 border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >

          <button
            onclick="ajouterSousObjectif('${obj.id}', document.getElementById('sous-${obj.id}'))"
            ${disabledAttr}
            class="w-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neutral-100 sm:w-auto"
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
window.modifierDatesObjectif = modifierDatesObjectif;
window.archiverSousObjectif = archiverSousObjectif;
window.toggleSousObjectif = toggleSousObjectif;
window.marquerSousObjectifAccompli = marquerSousObjectifAccompli;
window.toggleTimer = toggleTimer;
window.changerChampsSousObjectif = changerChampsSousObjectif;
