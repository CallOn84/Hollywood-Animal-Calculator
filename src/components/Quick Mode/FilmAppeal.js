function FilmAppealSide(chosen, scoreMap, negativeBonusFraction, valueField) {
  const genres = chosen.filter(c => c.isGenre);
  genres.sort((a, b) => b.percentage - a.percentage);
  const top = genres.length > 0 ? genres[0] : null;
  const second = genres.length > 1 ? genres[1] : null;

  let genreRaw = 0;
  if (top && second &&
      (top.percentage + second.percentage + 0.0001 >= 0.7) &&
      (second.percentage + 0.0001 >= 0.35)) {
    genreRaw = LookupGenrePair(top.tag.tag_id, second.tag.tag_id, valueField);
  } else if (top && top.percentage >= 0.5) {
    genreRaw = top.tag[valueField];
  } else {
    genreRaw = 0;
  }

  const genreBonus = Shrink(genreRaw, negativeBonusFraction);

  let settingSum = 0;
  for (const c of chosen) {
    if (c.tag.category === "Setting") {
      settingSum = settingSum + Shrink(c.tag[valueField], negativeBonusFraction);
    }
  }
  const settingBonus = CLAMP(settingSum, -0.084, 0.084);

  let contentSum = 0;
  for (const c of chosen) {
    if (c.tag.category !== "Genre" && c.tag.category !== "Setting") {
      contentSum = contentSum + Shrink(c.tag[valueField], negativeBonusFraction);
    }
  }
  const contentBonus = CLAMP(contentSum, -0.084, 0.084);

  const rawPoints = (genreBonus + settingBonus + contentBonus) * 10;
  return { raw: rawPoints, display: TruncateTo1Decimal(rawPoints) };
}

function LookupGenrePair(genreId, partnerId, valueField) {
  const rows = db.exec("SELECT art_value, commercial_value FROM genre_pairs WHERE genre_id = ? AND partner_id = ?",
                       [genreId, partnerId]);
  if (!rows || rows.length === 0) {
    throw new Error("Missing genre pair " + genreId + " -> " + partnerId);
  }
  const columnIndex = rows[0].columns.indexOf(valueField);
  return rows[0].values[0][columnIndex];
}

function FilmAppeal(chosen, scoreMap, negativeBonusFraction) {
  const art = FilmAppealSide(chosen, scoreMap, negativeBonusFraction, "art_value");
  const commercial = FilmAppealSide(chosen, scoreMap, negativeBonusFraction, "commercial_value");
  let leans;
  if (Math.abs(art.raw - commercial.raw) < 0.1) leans = "Balanced";
  else if (art.raw > commercial.raw) leans = "Art";
  else leans = "Commercial";
  return { art: art.display, commercial: commercial.display, leans: leans };
}