// Quick Mode inputs. Owns the state the business layer reads (see CLAUDE.md, "The contract between the layers").

const genreEntries = [];          // { tag_key, percentage }  percentage is a fraction: 0.6 = 60%
const setting = { value: "" };
const protagonist = { value: "" };
const antagonist = { value: "" };
const finale = { value: "" };
const supportingEntries = [];     // { value }
const themeEventEntries = [];     // { value }

const optionsByCategory = {};     // category -> [{ value: tag_key, label: name }]

const SINGLE_FIELDS = {
  setting:     { ref: setting,     category: "Setting",     placeholder: "Select a setting" },
  protagonist: { ref: protagonist, category: "Protagonist", placeholder: "Select a protagonist" },
  antagonist:  { ref: antagonist,  category: "Antagonist",  placeholder: "Select an antagonist" },
  finale:      { ref: finale,      category: "Finale",      placeholder: "Select a finale" }
};

const ICON_REMOVE = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';

const ICON_UP = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="m2.5 7.5 3.5-3.5 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

// Notes that help us check the calculator but mean little to a player (which genre bonus applied).
// Add ?debug to the page address to show them.
const SHOW_DEBUG_NOTES = new URLSearchParams(window.location.search).has("debug");

const $ = (id) => document.getElementById(id);

function Announce(message) {
  const live = $("statusLive");
  live.textContent = "";
  window.setTimeout(() => { live.textContent = message; }, 30);
}

// ---------- hooks called by EagerLoading.js and SaveRestore.js ----------

function FillDropdownsForCategory(category, options) {
  optionsByCategory[category] = options;
  ScheduleRender();
}

function HideLoadError() {
  $("loadError").hidden = true;
}

function ShowLoadError(message, retry) {
  $("loadErrorText").textContent = "Couldn't load the game data. Check your connection and try again.";
  console.error(message);
  $("loadError").hidden = false;
  $("main").setAttribute("aria-busy", "false");
  const button = $("retryBtn");
  button.onclick = () => { $("loadError").hidden = true; retry(); };
}

function RefreshInputsFromState() {
  NormalizeGenreEntries();
  RenderAll();
}

let renderQueued = false;
function ScheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => { renderQueued = false; RenderAll(); });
}

// ---------- small DOM helpers ----------

function MakeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function OptionsFor(select, placeholder, groups, selected, taken) {
  select.textContent = "";
  const empty = MakeEl("option", "", placeholder);
  empty.value = "";
  select.appendChild(empty);
  for (const group of groups) {
    const parent = group.label ? MakeEl("optgroup") : select;
    if (group.label) { parent.label = group.label; select.appendChild(parent); }
    for (const option of group.options) {
      const node = MakeEl("option", "", option.label);
      node.value = option.value;
      if (taken && taken.has(option.value) && option.value !== selected) node.disabled = true;
      parent.appendChild(node);
    }
  }
  select.value = selected || "";
}

function ThemeEventGroups() {
  return [
    { label: "Themes", options: optionsByCategory.Theme || [] },
    { label: "Events", options: optionsByCategory.Event || [] }
  ];
}

function FocusAfter(callback) {
  window.requestAnimationFrame(callback);
}

// ---------- genres ----------

function GenreUnits() {
  return genreEntries.map((entry) => Math.round(entry.percentage * GENRE_UNITS_TOTAL));
}

function ApplyGenreUnits(units) {
  units.forEach((u, i) => { genreEntries[i].percentage = u / GENRE_UNITS_TOTAL; });
}

function NormalizeGenreEntries() {
  if (genreEntries.length > MAX_GENRES) genreEntries.length = MAX_GENRES;
  if (genreEntries.length === 0) genreEntries.push({ tag_key: "", percentage: 1 });
  const units = GenreUnitsFromFractions(genreEntries.map((entry) => entry.percentage));
  const seen = new Set();
  genreEntries.forEach((entry, i) => {
    if (entry.tag_key && seen.has(entry.tag_key)) entry.tag_key = "";
    if (entry.tag_key) seen.add(entry.tag_key);
    entry.percentage = units[i] / GENRE_UNITS_TOTAL;
  });
}

function TakenKeys(entries, keyOf) {
  return new Set(entries.map(keyOf).filter(Boolean));
}

function RenderGenres() {
  const grid = $("genreGrid");
  grid.textContent = "";
  const genreOptions = [{ options: optionsByCategory.Genre || [] }];
  const taken = TakenKeys(genreEntries, (e) => e.tag_key);
  genreEntries.forEach((entry, i) => {
    const field = MakeEl("div", "field genre-field");
    field.style.setProperty("--genre", "var(--genre-" + (i + 1) + ")");
    const head = MakeEl("div", "field-head");
    const label = MakeEl("label");
    label.htmlFor = "genre-" + i;
    const swatch = MakeEl("span", "swatch");
    swatch.setAttribute("aria-hidden", "true");
    label.appendChild(swatch);
    label.appendChild(document.createTextNode("Genre " + (i + 1)));
    head.appendChild(label);
    if (i === 0) head.appendChild(MakeEl("span", "hint", "Required"));
    field.appendChild(head);

    const wrap = MakeEl("div", "select-wrap has-action");
    const select = MakeEl("select");
    select.id = "genre-" + i;
    select.dataset.genre = String(i);
    OptionsFor(select, "Select a genre", genreOptions, entry.tag_key, taken);
    wrap.appendChild(select);
    const remove = MakeEl("button", "icon-btn");
    remove.type = "button";
    remove.dataset.removeGenre = String(i);
    remove.innerHTML = ICON_REMOVE;
    wrap.appendChild(remove);
    field.appendChild(wrap);

    const row = MakeEl("div", "share-row");
    const slider = MakeEl("div", "slider");
    const range = MakeEl("input");
    range.type = "range";
    range.step = String(GENRE_UNITS_STEP_PERCENT);
    range.dataset.genreShare = String(i);
    range.setAttribute("aria-label", "Share of genre " + (i + 1));
    slider.appendChild(range);
    const scale = MakeEl("div", "slider-scale");
    scale.appendChild(MakeEl("span", "slider-min"));
    scale.appendChild(MakeEl("span", "slider-max"));
    slider.appendChild(scale);
    row.appendChild(slider);

    // Type a percentage, or use the small up and down buttons to move in 5% steps.
    const pct = MakeEl("div", "pct");
    const input = MakeEl("input", "pct-input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "spinbutton");
    input.setAttribute("aria-label", "Percentage of genre " + (i + 1));
    input.dataset.genrePct = String(i);
    pct.appendChild(input);
    const unit = MakeEl("span", "pct-unit", "%");
    unit.setAttribute("aria-hidden", "true");
    pct.appendChild(unit);
    const steps = MakeEl("span", "pct-steps");
    for (const direction of [1, -1]) {
      const button = MakeEl("button", "pct-btn");
      button.type = "button";
      button.tabIndex = -1;
      button.dataset.genreStep = String(i);
      button.dataset.direction = String(direction);
      button.setAttribute("aria-label", (direction > 0 ? "Add " : "Take ") + GENRE_UNITS_STEP_PERCENT + " percent " + (direction > 0 ? "to" : "from") + " genre " + (i + 1));
      button.innerHTML = direction > 0 ? ICON_UP : ICON_DOWN;
      steps.appendChild(button);
    }
    pct.appendChild(steps);
    row.appendChild(pct);
    field.appendChild(row);
    grid.appendChild(field);
  });
  if (genreEntries.length < MAX_GENRES) {
    const add = MakeEl("button", "add-cell");
    add.type = "button";
    add.id = "addGenre";
    add.appendChild(MakeEl("span", "add-plus", "+"));
    add.appendChild(MakeEl("span", "add-title", "Add genre"));
    add.appendChild(MakeEl("span", "add-sub"));
    grid.appendChild(add);
  }
  SyncGenreControls();
}

// Updates everything that depends on the shares without rebuilding the rows (keeps keyboard focus).
function SyncGenreControls() {
  const count = genreEntries.length;
  const max = GenreUnitsMax(count) * GENRE_UNITS_STEP_PERCENT;
  const min = GENRE_UNITS_MIN * GENRE_UNITS_STEP_PERCENT;
  const units = GenreUnits();
  document.querySelectorAll("[data-genre-share]").forEach((range) => {
    const i = Number(range.dataset.genreShare);
    const percent = units[i] * GENRE_UNITS_STEP_PERCENT;
    range.min = String(min);
    range.max = String(max);
    range.value = String(percent);
    range.disabled = count === 1;
    range.style.setProperty("--p", String((percent - min) / Math.max(1, max - min)));
    range.setAttribute("aria-valuetext", percent + " percent");
    const scale = range.parentElement.querySelector(".slider-scale");
    scale.querySelector(".slider-min").textContent = count === 1 ? "" : min + "%";
    scale.querySelector(".slider-max").textContent = count === 1 ? "" : max + "%";
  });
  document.querySelectorAll("[data-genre-pct]").forEach((input) => {
    const percent = units[Number(input.dataset.genrePct)] * GENRE_UNITS_STEP_PERCENT;
    input.value = String(percent);
    input.disabled = count === 1;
    input.setAttribute("aria-valuenow", String(percent));
    input.setAttribute("aria-valuemin", String(min));
    input.setAttribute("aria-valuemax", String(max));
    input.setAttribute("aria-valuetext", percent + " percent");
  });
  document.querySelectorAll("[data-genre-step]").forEach((button) => {
    const percent = units[Number(button.dataset.genreStep)] * GENRE_UNITS_STEP_PERCENT;
    const direction = Number(button.dataset.direction);
    button.disabled = count === 1 || (direction > 0 ? percent >= max : percent <= min);
  });
  document.querySelectorAll("[data-remove-genre]").forEach((button) => {
    const i = Number(button.dataset.removeGenre);
    const clears = count === 1;
    button.hidden = clears && !genreEntries[i].tag_key;
    button.setAttribute("aria-label", clears ? "Clear genre" : "Remove genre " + (i + 1));
  });
  const addSub = document.querySelector("#addGenre .add-sub");
  if (addSub) addSub.textContent = count + " of " + MAX_GENRES + " and the shares split to fit";
  const bar = $("shareBar");
  bar.textContent = "";
  units.forEach((u, i) => {
    const segment = MakeEl("span", "share-seg");
    segment.style.flexGrow = String(u);
    segment.style.setProperty("--genre", "var(--genre-" + (i + 1) + ")");
    const tag = genreEntries[i].tag_key && tagsByKey[genreEntries[i].tag_key];
    segment.title = (tag ? tag.name : "Genre " + (i + 1)) + " " + u * GENRE_UNITS_STEP_PERCENT + "%";
    bar.appendChild(segment);
  });
  UpdateGenreNote();
}

function UpdateGenreNote() {
  $("genreNote").hidden = !SHOW_DEBUG_NOTES;
  if (!SHOW_DEBUG_NOTES) return;
  const named = genreEntries.filter((e) => e.tag_key && tagsByKey[e.tag_key])
    .map((e) => ({ name: tagsByKey[e.tag_key].name, share: e.percentage }));
  $("genreNote").textContent = DescribeGenreBonus(named).text;
}

// The player asks for a share, by slider, typing or the step buttons. Snaps to 5% and keeps the total at 100%.
function SetGenreShare(index, percent) {
  const wanted = Math.round(percent / GENRE_UNITS_STEP_PERCENT);
  ApplyGenreUnits(GenreUnitsAfterSlide(GenreUnits(), index, wanted));
  SyncGenreControls();
  RefreshAfterChange();
}

function AddGenreRow(tagKey) {
  const next = GenreUnitsAfterAdd(GenreUnits());
  if (!next) return false;
  genreEntries.push({ tag_key: tagKey || "", percentage: 0 });
  ApplyGenreUnits(next);
  RenderGenres();
  RefreshAfterChange();
  return true;
}

function RemoveGenreRow(index) {
  if (genreEntries.length === 1) {
    genreEntries[0].tag_key = "";
    RenderGenres();
    RefreshAfterChange();
    FocusAfter(() => $("genre-0").focus());
    return;
  }
  const next = GenreUnitsAfterRemove(GenreUnits(), index);
  genreEntries.splice(index, 1);
  ApplyGenreUnits(next);
  RenderGenres();
  RefreshAfterChange();
  FocusAfter(() => {
    const target = $("genre-" + Math.min(index, genreEntries.length - 1)) || $("addGenre");
    if (target) target.focus();
  });
}

// ---------- single fields and lists ----------

function RenderSingles() {
  for (const [name, field] of Object.entries(SINGLE_FIELDS)) {
    const select = $("sel-" + name);
    OptionsFor(select, field.placeholder, [{ options: optionsByCategory[field.category] || [] }], field.ref.value);
    select.disabled = !isReady;
  }
}

function RenderList(entries, listId, placeholder, groups, ariaNoun) {
  const list = $(listId);
  list.textContent = "";
  const taken = TakenKeys(entries, (e) => e.value);
  entries.forEach((entry, i) => {
    const wrap = MakeEl("div", "select-wrap has-action");
    const select = MakeEl("select");
    select.dataset.list = listId;
    select.dataset.index = String(i);
    select.setAttribute("aria-label", ariaNoun + " " + (i + 1));
    OptionsFor(select, placeholder, groups, entry.value, taken);
    wrap.appendChild(select);
    const remove = MakeEl("button", "icon-btn");
    remove.type = "button";
    remove.dataset.removeFrom = listId;
    remove.dataset.index = String(i);
    remove.setAttribute("aria-label", "Remove " + ariaNoun.toLowerCase() + " " + (i + 1));
    remove.innerHTML = ICON_REMOVE;
    wrap.appendChild(remove);
    list.appendChild(wrap);
  });
}

function RenderLists() {
  RenderList(supportingEntries, "supportingList", "Select a supporting character",
    [{ options: optionsByCategory["Supporting Character"] || [] }], "Supporting character");
  RenderList(themeEventEntries, "themesList", "Select a theme or event", ThemeEventGroups(), "Theme or event");
  $("supportingCount").textContent = supportingEntries.length ? supportingEntries.length + " of " + MAX_SUPPORTING : "";
  $("themesCount").textContent = themeEventEntries.length ? themeEventEntries.length + " of " + MAX_THEMES_EVENTS : "";
  $("addSupporting").disabled = !isReady || supportingEntries.length >= MAX_SUPPORTING;
  $("addTheme").disabled = !isReady || themeEventEntries.length >= MAX_THEMES_EVENTS;
}

function ListFor(listId) {
  return listId === "supportingList" ? supportingEntries : themeEventEntries;
}

function AddListRow(entries, limit, value) {
  if (entries.length >= limit) return false;
  entries.push({ value: value || "" });
  RenderLists();
  RefreshAfterChange();
  return true;
}

// Greys out tags already used in the same list, without rebuilding the selects (keeps keyboard focus).
function RefreshTakenOptions() {
  const groups = [
    { selector: "select[data-genre]", entries: genreEntries, keyOf: (e) => e.tag_key },
    { selector: 'select[data-list="supportingList"]', entries: supportingEntries, keyOf: (e) => e.value },
    { selector: 'select[data-list="themesList"]', entries: themeEventEntries, keyOf: (e) => e.value }
  ];
  for (const group of groups) {
    const taken = TakenKeys(group.entries, group.keyOf);
    document.querySelectorAll(group.selector).forEach((select) => {
      for (const option of select.querySelectorAll("option")) {
        option.disabled = option.value !== "" && taken.has(option.value) && option.value !== select.value;
      }
    });
  }
}

// ---------- rendering and change handling ----------

function RenderAll() {
  if (!isReady) return;
  NormalizeGenreEntries();
  $("main").setAttribute("aria-busy", "false");
  $("tagSearch").disabled = false;
  RenderSingles();
  RenderGenres();
  RenderLists();
  RefreshAfterChange();
}

let calcQueued = false;
function RefreshAfterChange() {
  if (calcQueued) return;
  calcQueued = true;
  window.requestAnimationFrame(() => { calcQueued = false; Recalculate(); });
}

function MissingInputs() {
  const named = genreEntries.filter((e) => e.tag_key);
  const missing = [];
  if (named.length === 0) missing.push("a genre");
  if (!setting.value) missing.push("a setting");
  if (!protagonist.value) missing.push("a protagonist");
  const emptyRows = genreEntries.length - named.length;
  return { missing, emptyGenreRows: named.length > 0 && emptyRows > 0 };
}

function Recalculate() {
  if (!isReady) return;
  if (!resultsRevealed) { SaveState(null); return; }   // nothing is shown until the first Calculate press; the choices are still saved
  const { missing, emptyGenreRows } = MissingInputs();
  let results = null;
  if (missing.length === 0 && !emptyGenreRows) {
    try {
      results = CalculateResults();
    } catch (error) {
      console.error(error);
      ShowCalculationError();
      return;
    }
  }
  if (results) ShowResults(results);
  else ShowWaiting(missing, emptyGenreRows);
  SaveState(results);
}
