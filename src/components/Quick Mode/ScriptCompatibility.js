function ScriptCompatibility(chosen, scoreMap) {
    let genreScore = 0;
    for (const c of chosen) {
        if (c.isGenre) genreScore += c.percentage;
    }
    const tagCount = chosen.length;
    let genreCount = 0;
    for (const c of chosen) {
        if (c.isGenre) genreCount++;
    }
    const maxGainPerTag = genreScore * 0.05;
    const maxLossPerTag = genreScore * 0.9 / tagCount;

    const averages = {};
    for (const R of chosen) {
        let totalPW = 0;
        let totalW = 0;
        for (const P of chosen) {
            if (P.tag.tag_id === R.tag.tag_id) continue;
            const score = GetScore(scoreMap, R.tag.tag_id, P.tag.tag_id);
            const p = (score - 3) / 2;
            let weight;
            if (P.isGenre) {
                if (p >= 0) weight = genreCount * P.percentage;
                else weight = 20 * P.percentage;
            } else {
                if (p >= 0) weight = 1;
                else if (P.tag.category === "Setting") weight = 5;
                else weight = 3;
            }
            totalPW = totalPW + (p * weight);
            totalW = totalW + weight;
        }
        if (tagCount === 1) averages[R.tag.tag_id] = 0;
        else averages[R.tag.tag_id] = totalPW / totalW;
    }

    const tagChanges = {};
    for (const R of chosen) {
        const avg = averages[R.tag.tag_id];
        let tagWeight;
        if (R.isGenre) tagWeight = genreCount * R.percentage;
        else tagWeight = 1;
        let base;
        if (avg >= 0) base = maxGainPerTag;
        else base = maxLossPerTag;
        tagChanges[R.tag.tag_id] = base * avg * tagWeight;
    }

    let totalChange = 0;
    let negativeSum = 0;
    for (const key in tagChanges) {
        const v = tagChanges[key];
        totalChange += v;
        if (v < 0) negativeSum += v;
    }

    let negativeBonusFraction;
    if (negativeSum < 0) {
        negativeBonusFraction = (-negativeSum) / (genreScore * 0.9);
    } else {
        negativeBonusFraction = 0;
    }

    let scoreModifier;
    if (totalChange >= 0) scoreModifier = totalChange * 0.9;
    else scoreModifier = totalChange * 1.25;

    let weightedAvgSum = 0;
    for (const R of chosen) {
        let tagWeight;
        if (R.isGenre) tagWeight = genreCount * R.percentage;
        else tagWeight = 1;
        weightedAvgSum = weightedAvgSum + (averages[R.tag.tag_id] * tagWeight);
    }
    const compatibility = 3 + 2 * (weightedAvgSum / tagCount);

    return {
        compatibility: compatibility,
        scoreModifier: scoreModifier,
        negativeBonusFraction: negativeBonusFraction
    };
}