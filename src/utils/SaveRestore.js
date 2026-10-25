// Optional hooks the UI layer can define (this file calls them only if they exist):
//   RefreshInputsFromState()  - redraw the inputs from genreEntries, setting, protagonist, ...
//   ShowResults(results)      - display a results object from CalculateResults()

function SaveState(results) {
  const state = {
    data_version: dataVersion,
    genres: genreEntries.map(entry => ({ tag_key: entry.tag_key, percentage: entry.percentage })),
    setting: setting.value,
    protagonist: protagonist.value,
    antagonist: antagonist.value,
    finale: finale.value,
    supporting: supportingEntries.map(entry => entry.value),
    themes_events: themeEventEntries.map(entry => entry.value),
    results: results,
    revealed: typeof resultsRevealed !== "undefined" && resultsRevealed === true   // the player has pressed Calculate
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // ignore storage errors
  }
}

function RestoreState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return;
    const state = JSON.parse(raw);
    if (!AllSavedTags(state)) return;
    if (state.data_version !== dataVersion) {
      RecalculateFromState(state);
      return;
    }
    ApplySavedSelections(state);
    if (state.revealed === true && typeof RevealResults === "function") RevealResults(true);   // they had calculated before: show it again
    if (state.revealed === true && state.results && typeof ShowResults === "function") ShowResults(state.results);
  } catch (error) {
    console.error("RestoreState failed:", error);
  }
}

function AllSavedTags(state) {
  const keys = [];
  for (const genre of state.genres || []) keys.push(genre.tag_key);
  keys.push(state.setting, state.protagonist, state.antagonist, state.finale);
  for (const key of state.supporting || []) keys.push(key);
  for (const key of state.themes_events || []) keys.push(key);
  return keys.every(key => key === "" || key == null || Object.prototype.hasOwnProperty.call(tagsByKey, key));
}

function SyncEntries(entries, savedItems, create, assign) {
  for (let i = 0; i < savedItems.length; i++) {
    if (i < entries.length) assign(entries[i], savedItems[i]);
    else entries.push(create(savedItems[i]));
  }
  entries.length = savedItems.length;
}

function ApplySavedSelections(state) {
  SyncEntries(genreEntries, state.genres || [],
    saved => ({ tag_key: saved.tag_key, percentage: saved.percentage }),
    (entry, saved) => { entry.tag_key = saved.tag_key; entry.percentage = saved.percentage; });
  setting.value = state.setting;
  protagonist.value = state.protagonist;
  antagonist.value = state.antagonist;
  finale.value = state.finale;
  SyncEntries(supportingEntries, state.supporting || [],
    saved => ({ value: saved }),
    (entry, saved) => { entry.value = saved; });
  SyncEntries(themeEventEntries, state.themes_events || [],
    saved => ({ value: saved }),
    (entry, saved) => { entry.value = saved; });
  if (typeof RefreshInputsFromState === "function") RefreshInputsFromState();
}

function RecalculateFromState(state) {
  ApplySavedSelections(state);
  if (state.revealed !== true) return;   // never calculated on this device: keep the results hidden
  if (typeof RevealResults === "function") RevealResults(true);
  const results = CalculateResults();
  if (results === null) return;
  if (typeof ShowResults === "function") ShowResults(results);
  SaveState(results);
}