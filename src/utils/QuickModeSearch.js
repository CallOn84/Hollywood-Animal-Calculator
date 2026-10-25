// Quick tag search: type a tag name, pick it, and it goes into the right field.

const SEARCH_MAX_RESULTS = 8;
let searchResults = [];
let searchActive = -1;

const CATEGORY_TARGET = {
  "Genre": "genre",
  "Setting": "setting",
  "Protagonist": "protagonist",
  "Antagonist": "antagonist",
  "Supporting Character": "supporting character",
  "Theme": "theme",
  "Event": "event",
  "Finale": "finale"
};

function SearchTags(query) {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];
  const scored = [];
  for (const tag of Object.values(tagsByKey)) {
    const name = tag.name.toLowerCase();
    const at = name.indexOf(needle);
    if (at < 0) continue;
    const wordStart = at === 0 || name.charAt(at - 1) === " ";
    scored.push({ tag, rank: at === 0 ? 0 : wordStart ? 1 : 2 });
  }
  scored.sort((a, b) => a.rank - b.rank || a.tag.name.localeCompare(b.tag.name) || a.tag.sort_order - b.tag.sort_order);
  return scored.slice(0, SEARCH_MAX_RESULTS).map((entry) => entry.tag);
}

function RenderSearch() {
  const input = $("tagSearch");
  const list = $("searchList");
  list.textContent = "";
  const query = input.value.trim();
  if (query === "") { CloseSearch(); return; }
  searchResults = SearchTags(query);
  searchActive = searchResults.length ? 0 : -1;
  if (searchResults.length === 0) {
    const none = MakeEl("li", "search-none", "No tag matches “" + query + "”.");
    none.setAttribute("role", "presentation");
    list.appendChild(none);
  }
  searchResults.forEach((tag, i) => {
    const item = MakeEl("li", "search-item");
    item.id = "searchOpt" + i;
    item.setAttribute("role", "option");
    item.dataset.index = String(i);
    item.appendChild(MakeEl("span", "search-name", tag.name));
    item.appendChild(MakeEl("span", "chip chip-quiet", tag.category));
    list.appendChild(item);
  });
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  MarkActive();
}

function MarkActive() {
  const input = $("tagSearch");
  document.querySelectorAll("#searchList [role=option]").forEach((item, i) => {
    item.setAttribute("aria-selected", i === searchActive ? "true" : "false");
  });
  if (searchActive >= 0) {
    input.setAttribute("aria-activedescendant", "searchOpt" + searchActive);
    const active = $("searchOpt" + searchActive);
    if (active) active.scrollIntoView({ block: "nearest" });
  } else {
    input.removeAttribute("aria-activedescendant");
  }
}

function CloseSearch() {
  const list = $("searchList");
  list.hidden = true;
  list.textContent = "";
  searchResults = [];
  searchActive = -1;
  const input = $("tagSearch");
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
}

function Flash(node) {
  if (!node) return;
  node.classList.remove("flash");
  void node.offsetWidth;
  node.classList.add("flash");
}

// Puts the tag in the right place. Returns the sentence to announce.
function PlaceTag(tag) {
  const category = tag.category;
  const target = CATEGORY_TARGET[category];
  if (category === "Genre") {
    if (genreEntries.some((e) => e.tag_key === tag.tag_key)) return tag.name + " is already one of your genres.";
    const empty = genreEntries.findIndex((e) => !e.tag_key);
    if (empty >= 0) {
      genreEntries[empty].tag_key = tag.tag_key;
      RenderGenres();
      RefreshAfterChange();
      Flash($("genre-" + empty).parentElement);
    } else if (AddGenreRow(tag.tag_key)) {
      Flash($("genre-" + (genreEntries.length - 1)).parentElement);
    } else {
      return "You already have " + MAX_GENRES + " genres. Remove one to add " + tag.name + ".";
    }
    return "Added " + tag.name + " as a genre.";
  }
  const single = { Setting: "setting", Protagonist: "protagonist", Antagonist: "antagonist", Finale: "finale" }[category];
  if (single) {
    const field = SINGLE_FIELDS[single];
    field.ref.value = tag.tag_key;
    RenderSingles();
    RefreshAfterChange();
    Flash($("sel-" + single).parentElement);
    return "Set the " + target + " to " + tag.name + ".";
  }
  const isSupporting = category === "Supporting Character";
  const entries = isSupporting ? supportingEntries : themeEventEntries;
  const limit = isSupporting ? MAX_SUPPORTING : MAX_THEMES_EVENTS;
  if (entries.some((e) => e.value === tag.tag_key)) return tag.name + " is already in your script.";
  const empty = entries.findIndex((e) => !e.value);
  if (empty >= 0) entries[empty].value = tag.tag_key;
  else if (entries.length < limit) entries.push({ value: tag.tag_key });
  else return "You already have " + limit + " " + (isSupporting ? "supporting characters" : "themes and events") + ". Remove one to add " + tag.name + ".";
  RenderLists();
  RefreshAfterChange();
  const listId = isSupporting ? "supportingList" : "themesList";
  const index = empty >= 0 ? empty : entries.length - 1;
  Flash(document.querySelector('[data-list="' + listId + '"][data-index="' + index + '"]').parentElement);
  return "Added " + tag.name + " as a " + target + ".";
}

function PickSearchResult(index) {
  const tag = searchResults[index];
  if (!tag) return;
  const message = PlaceTag(tag);
  Announce(message);
  $("searchHelp").textContent = message;
  const input = $("tagSearch");
  input.value = "";
  CloseSearch();
  input.focus();
}

function InitSearch() {
  const input = $("tagSearch");
  const list = $("searchList");
  input.addEventListener("input", RenderSearch);
  input.addEventListener("keydown", (event) => {
    const open = !list.hidden && searchResults.length > 0;
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      searchActive = (searchActive + 1) % searchResults.length;
      MarkActive();
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      searchActive = (searchActive - 1 + searchResults.length) % searchResults.length;
      MarkActive();
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      PickSearchResult(searchActive);
    } else if (event.key === "Escape") {
      if (!list.hidden) event.preventDefault();
      CloseSearch();
    }
  });
  list.addEventListener("mousedown", (event) => event.preventDefault());
  list.addEventListener("click", (event) => {
    const item = event.target.closest("[role=option]");
    if (item) PickSearchResult(Number(item.dataset.index));
  });
  input.addEventListener("blur", () => window.setTimeout(CloseSearch, 120));
}
