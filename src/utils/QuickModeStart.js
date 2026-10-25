// Quick Mode page start-up: buttons, events and loading the database.

// sql.js looks for sql-wasm.wasm next to the page by default. It lives in assets/sql.js/, so say so.
const SQL_ASSET_FOLDER = "assets/sql.js/";
const startSqlJs = window.initSqlJs;
window.initSqlJs = (config) => startSqlJs(Object.assign({ locateFile: (file) => SQL_ASSET_FOLDER + file }, config));

function ResetAll() {
  genreEntries.length = 0;
  supportingEntries.length = 0;
  themeEventEntries.length = 0;
  for (const field of Object.values(SINGLE_FIELDS)) field.ref.value = "";
  try { window.localStorage.removeItem(STORAGE_KEY); } catch (error) { /* storage blocked: nothing to clear */ }
  $("tagSearch").value = "";
  CloseSearch();
  genreEntries.push({ tag_key: "", percentage: 1 });
  RevealResults(false);   // back to a fresh page: no results until Calculate is pressed again
  RenderAll();
  Announce("All selections cleared.");
  $("genre-0").focus();
}

function OnCalculate() {
  RevealResults(true);   // from now on the results stay on the page and update as the choices change
  const { missing, emptyGenreRows } = MissingInputs();
  Recalculate();
  const results = $("results");
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  results.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  if (missing.length || emptyGenreRows) {
    // The results section now says what is still needed. Put the keyboard on the first thing to fix.
    const emptyGenre = genreEntries.findIndex((e) => !e.tag_key);
    const target = emptyGenre >= 0 ? $("genre-" + emptyGenre)
      : !setting.value ? $("sel-setting") : $("sel-protagonist");
    if (target) target.focus({ preventScroll: true });
    return;
  }
  results.focus({ preventScroll: true });
}

// ---------- events ----------

// The player typed a percentage. Round to the nearest 5%, keep it inside the game's limits, and say so if it moved.
function CommitGenrePercentBox(box) {
  const index = Number(box.dataset.genrePct);
  const typed = parseInt(box.value, 10);
  if (Number.isNaN(typed)) { SyncGenreControls(); return; }
  SetGenreShare(index, typed);
  const result = GenreUnits()[index] * GENRE_UNITS_STEP_PERCENT;
  if (result !== typed) Announce("Genre " + (index + 1) + " is set to " + result + " percent, the nearest allowed step.");
}

function BindInputs() {
  document.addEventListener("change", (event) => {
    const box = event.target;
    if (box instanceof HTMLInputElement && box.dataset.genrePct !== undefined) {
      CommitGenrePercentBox(box);
      return;
    }
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    if (select.dataset.field) {
      SINGLE_FIELDS[select.dataset.field].ref.value = select.value;
    } else if (select.dataset.genre !== undefined) {
      genreEntries[Number(select.dataset.genre)].tag_key = select.value;
      SyncGenreControls();
      RefreshTakenOptions();
    } else if (select.dataset.list) {
      ListFor(select.dataset.list)[Number(select.dataset.index)].value = select.value;
      RefreshTakenOptions();
    } else {
      return;
    }
    RefreshAfterChange();
  });

  document.addEventListener("input", (event) => {
    const range = event.target;
    if (range instanceof HTMLInputElement && range.dataset.genrePct !== undefined) {
      range.value = range.value.replace(/\D/g, "").slice(0, 3);   // digits only while typing
      return;
    }
    if (!(range instanceof HTMLInputElement) || range.dataset.genreShare === undefined) return;
    SetGenreShare(Number(range.dataset.genreShare), Number(range.value));
  });

  document.addEventListener("keydown", (event) => {
    const box = event.target;
    if (!(box instanceof HTMLInputElement) || box.dataset.genrePct === undefined) return;
    const index = Number(box.dataset.genrePct);
    const current = GenreUnits()[index] * GENRE_UNITS_STEP_PERCENT;
    const max = GenreUnitsMax(genreEntries.length) * GENRE_UNITS_STEP_PERCENT;
    const min = GENRE_UNITS_MIN * GENRE_UNITS_STEP_PERCENT;
    const wanted = { ArrowUp: current + GENRE_UNITS_STEP_PERCENT, ArrowDown: current - GENRE_UNITS_STEP_PERCENT,
      PageUp: current + 2 * GENRE_UNITS_STEP_PERCENT, PageDown: current - 2 * GENRE_UNITS_STEP_PERCENT, Home: min, End: max }[event.key];
    if (wanted !== undefined) {
      event.preventDefault();
      SetGenreShare(index, wanted);
    } else if (event.key === "Enter") {
      event.preventDefault();
      CommitGenrePercentBox(box);
    } else if (event.key === "Escape") {
      SyncGenreControls();   // drop what was typed
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button) return;
    if (button.dataset.genreStep !== undefined) {
      const index = Number(button.dataset.genreStep);
      SetGenreShare(index, GenreUnits()[index] * GENRE_UNITS_STEP_PERCENT + Number(button.dataset.direction) * GENRE_UNITS_STEP_PERCENT);
    } else if (button.dataset.removeGenre !== undefined) {
      RemoveGenreRow(Number(button.dataset.removeGenre));
    } else if (button.dataset.removeFrom) {
      const entries = ListFor(button.dataset.removeFrom);
      const index = Number(button.dataset.index);
      entries.splice(index, 1);
      RenderLists();
      RefreshAfterChange();
      FocusAfter(() => {
        const next = document.querySelector('[data-list="' + button.dataset.removeFrom + '"][data-index="' + Math.min(index, entries.length - 1) + '"]');
        (next || $(button.dataset.removeFrom === "supportingList" ? "addSupporting" : "addTheme")).focus();
      });
    } else if (button.id === "addGenre") {
      if (AddGenreRow("")) FocusAfter(() => $("genre-" + (genreEntries.length - 1)).focus());
    } else if (button.id === "addSupporting") {
      if (AddListRow(supportingEntries, MAX_SUPPORTING)) FocusAfter(() => document.querySelector('[data-list="supportingList"][data-index="' + (supportingEntries.length - 1) + '"]').focus());
    } else if (button.id === "addTheme") {
      if (AddListRow(themeEventEntries, MAX_THEMES_EVENTS)) FocusAfter(() => document.querySelector('[data-list="themesList"][data-index="' + (themeEventEntries.length - 1) + '"]').focus());
    } else if (button.id === "resetBtn") {
      ResetAll();
    } else if (button.id === "calcBtn") {
      OnCalculate();
    }
  });
}

function ShowDataInfo() {
  const info = $("dataInfo");
  if (!isReady) { info.textContent = "Game data not loaded"; return; }
  info.textContent = "Game data " + dataVersion + " with " + Object.keys(tagsById).length + " tags";
}

document.addEventListener("DOMContentLoaded", async () => {
  BindInputs();
  InitSearch();
  InitDock();
  InitInfo();
  InitTerms();
  RevealResults(false);
  await LoadDatabase();
  ShowDataInfo();
});
