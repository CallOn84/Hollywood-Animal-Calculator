function GetTagByKey(tagKey) {
  const tag = tagsByKey[tagKey];
  if (!tag) throw new Error("Unknown tag: " + tagKey);
  return tag;
}

function GetChosenTags() {
  const chosen = [];
  for (const entry of genreEntries) {
    if (entry.tag_key !== "" && entry.tag_key != null) {
      chosen.push({ tag: GetTagByKey(entry.tag_key), percentage: entry.percentage, isGenre: true });
    }
  }
  for (const field of [setting, protagonist, antagonist, finale]) {
    if (field.value !== "" && field.value != null) {
      chosen.push({ tag: GetTagByKey(field.value), percentage: null, isGenre: false });
    }
  }
  for (const entry of supportingEntries) {
    if (entry.value !== "" && entry.value != null) {
      chosen.push({ tag: GetTagByKey(entry.value), percentage: null, isGenre: false });
    }
  }
  for (const entry of themeEventEntries) {
    if (entry.value !== "" && entry.value != null) {
      chosen.push({ tag: GetTagByKey(entry.value), percentage: null, isGenre: false });
    }
  }
  return chosen;
}

function IsRequiredFilled() {
  return (
    genreEntries.some((entry) => entry.tag_key !== "" && entry.tag_key != null) &&
    setting.value !== "" && setting.value != null &&
    protagonist.value !== "" && protagonist.value != null
  );
}

function FetchPairScores(chosen) {
  const ids = chosen.map((c) => c.tag.tag_id);
  const placeholders = ids.map(() => "?").join(",");
  const sql = `SELECT tag_id, partner_id, score FROM pair_scores WHERE tag_id IN (${placeholders}) AND partner_id IN (${placeholders})`;
  const rows = db.exec(sql, ids.concat(ids));
  const scoreMap = {};
  if (rows.length > 0) {
    for (const row of rows[0].values) {
      scoreMap[row[0] + ":" + row[1]] = row[2];
    }
  }
  return scoreMap;
}

function GetScore(scoreMap, tagId, partnerId) {
  const key = tagId + ":" + partnerId;
  if (!(key in scoreMap)) {
    throw new Error("Missing pair score for " + tagId + " -> " + partnerId);
  }
  return scoreMap[key];
}

function Shrink(value, negativeBonusFraction) {
  const base = value / 9.9;
  if (value >= 0) {
    return base * (1 - negativeBonusFraction);
  } else {
    return base * (1 + negativeBonusFraction);
  }
}

function TruncateTo1Decimal(x) {
  const factor = 10;
  if (x >= 0) {
    return Math.floor(x * factor) / factor;
  } else {
    return Math.ceil(x * factor) / factor;
  }
}

function CLAMP(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function CalculateResults() {
  if (!IsRequiredFilled()) return null;
  const chosen = GetChosenTags();
  const scoreMap = FetchPairScores(chosen);
  const script = ScriptCompatibility(chosen, scoreMap);
  const appeal = FilmAppeal(chosen, scoreMap, script.negativeBonusFraction);
  return {
    compatibility: script.compatibility,
    scoreModifier: script.scoreModifier,
    art: appeal.art,
    commercial: appeal.commercial,
    leans: appeal.leans
  };
}