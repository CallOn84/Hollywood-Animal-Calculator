// Quick Mode results: fills the result cards, the explanation and the floating summary bar.

const MINUS = "−";
const MODIFIER_SCALE_PERCENT = 50;   // the bar runs from -50% to +50%
const APPEAL_SCALE_POINTS = 2;       // the Art and Commercial bars run from -2 to +2
const LEAN_SCALE_POINTS = 1;         // the beam is full at a 1 point gap
const MAX_PAIRS_SHOWN = 5;
const EXAMPLE_WRITER_QUALITY = 5;    // a writer in the middle of the 0 to 10 scale, used to show what the percentage means in points

// The workbook's colour scale: red at the low end, white in the middle, green at the high end.
const SCALE_RED = [248, 105, 107];
const SCALE_WHITE = [255, 255, 255];
const SCALE_GREEN = [99, 190, 123];

let hasResults = false;
let resultsVisible = false;

// The results section stays hidden until the player presses Calculate for the first time (or comes back to a
// saved calculation). After that it is live: it updates as the choices change. Reset all hides it again.
let resultsRevealed = false;
const HIDE_DIVIDER_UNTIL_CALCULATED = true;   // the line under the Calculate button is hidden together with the results

function RevealResults(visible) {
  resultsRevealed = visible;
  $("results").hidden = !visible;
  $("ruleWrap").hidden = HIDE_DIVIDER_UNTIL_CALCULATED && !visible;
  document.body.classList.toggle("is-fresh", !visible);   // lets the footer sit close to the Calculate button while there is nothing below it
  if (!visible) ShowWaiting([], false);   // forget the old numbers so nothing stale (or the summary bar) is left behind
}

function Signed(value, digits, suffix) {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text + suffix;
  return (value < 0 ? MINUS : "+") + text + suffix;
}

function Clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function JoinWords(items) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

// Colour at `position` (0 to 1) along the red, white, green scale. Matches the dial and the modifier bar.
function ScaleColor(position) {
  const t = Clamp(position, 0, 1);
  const from = t <= 0.5 ? SCALE_RED : SCALE_WHITE;
  const to = t <= 0.5 ? SCALE_WHITE : SCALE_GREEN;
  const f = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
  return "rgb(" + from.map((v, i) => Math.round(v + (to[i] - v) * f)).join(", ") + ")";
}

function SetTrack(prefix, value, scale) {
  const position = 50 + Clamp(value / scale, -1, 1) * 50;
  const fill = $(prefix + "Fill");   // the score modifier bar has no fill: its whole length is the red to green scale
  if (fill) {
    fill.style.left = Math.min(50, position) + "%";
    fill.style.width = Math.abs(position - 50) + "%";
  }
  $(prefix + "Pin").style.left = position + "%";
  $(prefix + "Track").dataset.sign = value < 0 ? "neg" : "pos";
}

function SetDial(compatibility) {
  const fraction = Clamp((compatibility - 1) / 4, 0, 1);
  $("dialFill").style.strokeDasharray = fraction * 100 + " 100";
  $("dialKnob").style.transform = "rotate(" + fraction * 180 + "deg)";
}

function ClearTracks() {
  for (const prefix of ["mod", "art", "com"]) {
    const fill = $(prefix + "Fill");
    if (fill) fill.style.width = "0%";
    $(prefix + "Pin").style.left = "50%";
  }
  $("beamPin").style.left = "50%";
}

let liveTimer = 0;
function AnnounceResults(text) {
  window.clearTimeout(liveTimer);
  liveTimer = window.setTimeout(() => { $("resultsLive").textContent = text; }, 700);
}

// The compatibility and modifier numbers take the colour of the spot the dial and the bar are pointing at.
function PaintScaleNumbers(compatColor, modifierColor) {
  $("resCompat").style.color = compatColor;
  $("dkCompat").style.color = compatColor;
  $("resMod").style.color = modifierColor;
  $("dkMod").style.color = modifierColor;
}

// What the percentage means in points for a writer in the middle of the scale.
function DescribeModifierInPoints(scoreModifier) {
  const change = TruncateTo1Decimal(EXAMPLE_WRITER_QUALITY * scoreModifier);
  const start = EXAMPLE_WRITER_QUALITY.toFixed(1);
  if (change === 0) return "For a writer with a skill level of " + start + " out of 10, that is no change.";
  const amount = Math.abs(change).toFixed(1);
  const end = (EXAMPLE_WRITER_QUALITY + change).toFixed(1);
  return "In points it depends on the writer. A writer with a skill level of " + start + " out of 10 would " +
    (change > 0 ? "gain " : "lose ") + amount + (amount === "1.0" ? " point" : " points") + ", going from " + start + " to " + end + ".";
}

function ShowResults(results) {
  const compat = Number(results.compatibility.toFixed(1));
  const modifierPercent = results.scoreModifier * 100;
  const compatText = compat.toFixed(1);
  const modText = Signed(modifierPercent, 1, "%");
  const artText = Signed(results.art, 1, "");
  const comText = Signed(results.commercial, 1, "");
  const leanText = results.leans;

  $("results").dataset.state = "ready";
  $("resCompat").textContent = compatText;
  $("resMod").textContent = modText;
  $("resArt").textContent = artText;
  $("resCom").textContent = comText;
  $("resLean").textContent = leanText;
  $("dkCompat").textContent = compatText;
  $("dkMod").textContent = modText;
  $("dkArt").textContent = artText;
  $("dkCom").textContent = comText;
  $("results").dataset.lean = leanText.toLowerCase();

  SetDial(results.compatibility);
  PaintScaleNumbers(ScaleColor((results.compatibility - 1) / 4), ScaleColor(0.5 + Clamp(modifierPercent / MODIFIER_SCALE_PERCENT, -1, 1) / 2));
  SetTrack("mod", modifierPercent, MODIFIER_SCALE_PERCENT);
  SetTrack("art", results.art, APPEAL_SCALE_POINTS);
  SetTrack("com", results.commercial, APPEAL_SCALE_POINTS);
  const gap = Clamp((results.commercial - results.art) / LEAN_SCALE_POINTS, -1, 1);
  $("beamPin").style.left = 50 + gap * 50 + "%";

  let verdict = "Your tags are neutral together";
  if (compat > 3) verdict = "Your tags support each other";
  else if (compat < 3) verdict = "Your tags clash";
  $("explainVerdict").textContent = verdict;

  const body = $("explainBody");
  body.textContent = "";
  const lines = [
    "Script compatibility is " + compatText + " out of 5. A score of 3 is neutral: above it your tags help each other; below it, they get in each other's way. That changes the script's base quality by " + modText + ". " + DescribeModifierInPoints(results.scoreModifier)
  ];
  if (SHOW_DEBUG_NOTES) {
    const named = genreEntries.filter((e) => e.tag_key && tagsByKey[e.tag_key])
      .map((e) => ({ name: tagsByKey[e.tag_key].name, share: e.percentage }));
    lines.push("Genre bonus: " + DescribeGenreBonus(named).text);
  }
  for (const line of lines) body.appendChild(MakeEl("p", "", line));
  ShowAssumptions(true);

  RenderPairInsights();

  hasResults = true;
  UpdateDock();
  AnnounceResults("Script compatibility " + compatText + " out of 5. Score modifier " + modText.replace(MINUS, "minus ").replace("+", "plus ") + ". Art appeal " + artText.replace(MINUS, "minus ") + ". Commercial appeal " + comText.replace(MINUS, "minus ") + ". Leans towards " + leanText.toLowerCase() + ".");
}

function ShowAssumptions(visible) {
  $("assumptions").hidden = !visible;
}

function ShowWaiting(missing, emptyGenreRows) {
  $("results").dataset.state = "empty";
  delete $("results").dataset.lean;
  for (const id of ["resCompat", "resMod", "resArt", "resCom", "resLean", "dkCompat", "dkMod", "dkArt", "dkCom"]) $(id).textContent = "–";
  SetDial(1);
  ClearTracks();
  PaintScaleNumbers("", "");
  ShowAssumptions(false);
  const parts = [];
  if (missing.length) parts.push("Still needed: " + JoinWords(missing) + ".");
  if (emptyGenreRows) parts.push("Choose a genre in each genre row, or remove the empty ones.");
  $("explainVerdict").textContent = "Results appear here";
  const body = $("explainBody");
  body.textContent = "";
  body.appendChild(MakeEl("p", "", parts.join(" ") || "Pick a genre, a setting and a protagonist to see results."));
  $("pairs").hidden = true;
  hasResults = false;
  UpdateDock();
  $("resultsLive").textContent = "";
}

function ShowCalculationError() {
  ShowWaiting([], false);
  $("explainVerdict").textContent = "Couldn't work out the results";
  const body = $("explainBody");
  body.textContent = "";
  body.appendChild(MakeEl("p", "", "The game data has no value for one of these tags. Remove the tag you added last and try again."));
}

// ---------- weakest and strongest pairs ----------

function CategoryLabel(tag) {
  const text = tag.category.toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function PairRow(entry, scoreClass) {
  const item = MakeEl("li", "pair");
  const names = MakeEl("span", "pair-names");
  names.appendChild(MakeEl("strong", "", entry.a.name));
  names.appendChild(document.createTextNode(" with "));
  names.appendChild(MakeEl("strong", "", entry.b.name));
  names.appendChild(MakeEl("span", "pair-cats", CategoryLabel(entry.a) + " and " + entry.b.category.toLowerCase()));
  item.appendChild(names);
  item.appendChild(MakeEl("span", "pair-score " + scoreClass, entry.low + " of 5"));
  return item;
}

function FillPairList(list, entries, scoreClass, emptyText) {
  list.textContent = "";
  if (entries.length === 0) {
    list.appendChild(MakeEl("li", "pair-none", emptyText));
    return;
  }
  for (const entry of entries) list.appendChild(PairRow(entry, scoreClass));
}

// Each pair is scored in both directions in the data. We show the lower of the two.
function RenderPairInsights() {
  const chosen = GetChosenTags();
  const scoreMap = FetchPairScores(chosen);
  const pairs = [];
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      const a = chosen[i].tag;
      const b = chosen[j].tag;
      const forward = scoreMap[a.tag_id + ":" + b.tag_id];
      const backward = scoreMap[b.tag_id + ":" + a.tag_id];
      if (forward === undefined || backward === undefined) continue;
      pairs.push({ a, b, low: Math.min(forward, backward), high: Math.max(forward, backward) });
    }
  }
  const byName = (x, y) => x.a.name.localeCompare(y.a.name);
  const weak = pairs.filter((p) => p.low <= 2).sort((x, y) => x.low - y.low || x.high - y.high || byName(x, y)).slice(0, MAX_PAIRS_SHOWN);
  const strong = pairs.filter((p) => p.low >= 4).sort((x, y) => y.low - x.low || y.high - x.high || byName(x, y)).slice(0, MAX_PAIRS_SHOWN);
  FillPairList($("weakList"), weak, "is-weak", "No pair is rated 2 or lower.");
  FillPairList($("strongList"), strong, "is-strong", "No pair is rated 4 or higher both ways.");
  $("pairs").hidden = chosen.length < 2;
}

// ---------- floating summary bar ----------

function UpdateDock() {
  $("dock").hidden = !(hasResults && !resultsVisible);
}

function InitDock() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    resultsVisible = entries.some((entry) => entry.isIntersecting);
    UpdateDock();
  }, { threshold: [0] });
  observer.observe($("results"));
}
