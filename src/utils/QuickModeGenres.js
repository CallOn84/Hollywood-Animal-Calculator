// Genre share maths. No DOM access here.
//
// Shares are counted in "units" of 5% (20 units = 100%) so there is never a rounding error.
// The rules come from the game's own settings (GameVariables.json) and its script editor
// (MovieScriptEditorView.AddGenre):
//   genre_fraction_step 0.05, min_genre_fraction 0.1, genre_new_added_steps 4,
//   genres_reduced_new_added_steps 2, ..._threshold 5, ..._take_from_above 0.1.

const GENRE_UNITS_TOTAL = 20;
const GENRE_UNITS_MIN = 2;
const GENRE_UNITS_STEP_PERCENT = 5;
const GENRE_ADD_STEPS = 4;
const GENRE_ADD_STEPS_REDUCED = 2;
const GENRE_REDUCED_THRESHOLD = 5;

// Share each genre may have at most, given how many genres there are.
function GenreUnitsMax(count) {
  return GENRE_UNITS_TOTAL - GENRE_UNITS_MIN * (count - 1);
}

// Split `total` units between genres in proportion to `weights`, never going below `min`,
// using whole units only (largest remainder wins the leftover units).
function GenreAllocate(total, weights, min) {
  const count = weights.length;
  const result = new Array(count).fill(0);
  const pinned = new Array(count).fill(false);
  let ideal = new Array(count).fill(0);
  for (let pass = 0; pass <= count; pass++) {
    const freeIndexes = weights.map((w, i) => i).filter((i) => !pinned[i]);
    const pinnedCount = count - freeIndexes.length;
    const budget = total - min * pinnedCount;
    const weightSum = freeIndexes.reduce((sum, i) => sum + weights[i], 0);
    ideal = ideal.map((v, i) => (pinned[i] ? min : (budget * weights[i]) / weightSum));
    const tooSmall = freeIndexes.filter((i) => ideal[i] < min);
    if (tooSmall.length === 0) break;
    tooSmall.forEach((i) => { pinned[i] = true; });
  }
  let used = 0;
  for (let i = 0; i < count; i++) {
    result[i] = pinned[i] ? min : Math.max(min, Math.floor(ideal[i]));
    used += result[i];
  }
  const byRemainder = weights.map((w, i) => i)
    .filter((i) => !pinned[i])
    .sort((a, b) => (ideal[b] - Math.floor(ideal[b])) - (ideal[a] - Math.floor(ideal[a])) || a - b);
  let guard = 0;
  while (used < total && byRemainder.length > 0 && guard++ < 1000) {
    result[byRemainder[(guard - 1) % byRemainder.length]] += 1;
    used += 1;
  }
  return result;
}

// Units for a list that came from outside (saved session, old version). Always returns a valid split.
function GenreUnitsFromFractions(fractions) {
  const count = fractions.length;
  if (count === 0) return [];
  const units = fractions.map((f) => Math.round((Number(f) || 0) * GENRE_UNITS_TOTAL));
  const sum = units.reduce((a, b) => a + b, 0);
  const valid = count <= MAX_GENRES && sum === GENRE_UNITS_TOTAL && units.every((u) => u >= GENRE_UNITS_MIN);
  if (valid) return units;
  return GenreAllocate(GENRE_UNITS_TOTAL, units.map((u) => Math.max(u, 1)), GENRE_UNITS_MIN);
}

// A genre is added at the end of the list. Returns the new units (new genre last), or null if it cannot fit.
function GenreUnitsAfterAdd(units) {
  const count = units.length;
  if (count === 0) return [GENRE_UNITS_TOTAL];
  if (count >= MAX_GENRES) return null;
  const next = units.slice();
  let gained = 0;
  if (count < GENRE_REDUCED_THRESHOLD) {
    // Take 4 steps (20%) from the biggest genre(s). The game lists newest first, so ties go newest first.
    const newestFirst = units.map((u, i) => i).reverse().sort((a, b) => units[b] - units[a]);
    const biggest = units[newestFirst[0]];
    const group = newestFirst.filter((i) => biggest - units[i] < 1);
    let taken = 0;
    for (let guard = 0; guard < 1000 && taken < GENRE_ADD_STEPS; guard++) {
      for (const i of group) {
        if (taken >= GENRE_ADD_STEPS) break;
        if (next[i] > 1) { next[i] -= 1; gained += 1; taken += 1; }
      }
    }
  } else {
    // Take 2 steps (10%), starting with the oldest genre that is above the minimum.
    let taken = 0;
    for (let guard = 0; guard < 1000 && taken < GENRE_ADD_STEPS_REDUCED; guard++) {
      let progressed = false;
      for (let i = 0; i < count && taken < GENRE_ADD_STEPS_REDUCED; i++) {
        if (next[i] >= GENRE_UNITS_MIN) {
          const k = Math.min(GENRE_ADD_STEPS_REDUCED - taken, next[i] - GENRE_UNITS_MIN);
          if (k > 0) { next[i] -= k; gained += k; taken += k; progressed = true; }
        }
      }
      if (!progressed) break;
    }
  }
  if (gained < GENRE_UNITS_MIN) return null;
  next.push(gained);
  return next;
}

// The player moves genre `index` to `wanted` units. The other genres give or take the difference in proportion.
function GenreUnitsAfterSlide(units, index, wanted) {
  const count = units.length;
  if (count === 1) return [GENRE_UNITS_TOTAL];
  const value = Math.min(GenreUnitsMax(count), Math.max(GENRE_UNITS_MIN, wanted));
  const others = units.map((u, i) => i).filter((i) => i !== index);
  const shares = GenreAllocate(GENRE_UNITS_TOTAL - value, others.map((i) => units[i]), GENRE_UNITS_MIN);
  const next = units.slice();
  next[index] = value;
  others.forEach((i, n) => { next[i] = shares[n]; });
  return next;
}

// A genre is removed. The others share its percentage in proportion to what they have.
function GenreUnitsAfterRemove(units, index) {
  const rest = units.filter((u, i) => i !== index);
  if (rest.length === 0) return [];
  if (rest.length === 1) return [GENRE_UNITS_TOTAL];
  return GenreAllocate(GENRE_UNITS_TOTAL, rest, GENRE_UNITS_MIN);
}

// Which genre bonus applies? Same thresholds as FilmAppeal.js (pair: top two 70%+ with second 35%+;
// single: top 50%+). `genres` is a list of { name, share } with share as a fraction.
function DescribeGenreBonus(genres) {
  const sorted = genres.slice().sort((a, b) => b.share - a.share);
  const top = sorted[0];
  const second = sorted[1];
  if (!top) return { mode: "none", text: "Choose a genre to see which genre bonus applies." };
  if (second && top.share + second.share + 0.0001 >= 0.7 && second.share + 0.0001 >= 0.35) {
    return { mode: "pair", text: top.name + " and " + second.name + " count as a pair, so the game's pair values apply." };
  }
  if (top.share >= 0.5) {
    return { mode: "single", text: top.name + " is 50% or more, so its own values apply." };
  }
  return { mode: "none", text: "No genre bonus. Give one genre 50% or more, or two genres 70% together with the second at 35% or more." };
}
