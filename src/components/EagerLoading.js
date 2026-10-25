const DB_FILE = "db/GameVariables.db";
const STORAGE_KEY = "hollywood_animal";
const MAX_GENRES = 10;
const MAX_SUPPORTING = 7;
const MAX_THEMES_EVENTS = 7;
const CATEGORIES = ["Genre","Setting","Protagonist","Antagonist","Supporting Character","Theme","Event","Finale"];

let db = null;
let tagsById = {};
let tagsByCategory = {};
let tagsByKey = {};
let dataVersion = null;
let isReady = false;
let isCalculating = false;

async function LoadDatabase() {
    try {
        const response = await fetch(DB_FILE);
        if (!response.ok) throw new Error("fetch failed");
        const buffer = await response.arrayBuffer();
        const SQL = await initSqlJs();
        db = new SQL.Database(new Uint8Array(buffer));
        const result = db.exec("SELECT value FROM meta WHERE key = 'data_version'");
        if (!result.length || !result[0].values.length) throw new Error("missing data_version");
        dataVersion = result[0].values[0][0];
        const rowsResult = db.exec("SELECT tag_id, tag_key, name, category, sort_order, art_value, commercial_value FROM tags");
        tagsById = {};
        tagsByCategory = {};
        tagsByKey = {};
        if (rowsResult.length) {
            const columns = rowsResult[0].columns;
            const values = rowsResult[0].values;
            for (const row of values) {
                const rowObj = {};
                columns.forEach((col, i) => { rowObj[col] = row[i]; });
                const tag = {
                    tag_id: rowObj.tag_id,
                    tag_key: rowObj.tag_key,
                    name: rowObj.name,
                    category: rowObj.category,
                    sort_order: rowObj.sort_order,
                    art_value: rowObj.art_value,
                    commercial_value: rowObj.commercial_value
                };
                tagsById[tag.tag_id] = tag;
                tagsByKey[tag.tag_key] = tag;
                if (!tagsByCategory[tag.category]) tagsByCategory[tag.category] = [];
                tagsByCategory[tag.category].push(tag);
            }
        }
        for (const category of CATEGORIES) {
            if (tagsByCategory[category]) {
                tagsByCategory[category].sort((a, b) => a.sort_order - b.sort_order);
            }
        }
        isReady = true;
        HideLoadError();
        PopulateAllDropdowns();
        RestoreState();
    } catch (error) {
        isReady = false;
        ShowLoadError("Could not load data. " + error.message, LoadDatabase);
    }
}

function PopulateAllDropdowns() {
    for (const category of CATEGORIES) {
        const options = [];
        const tags = tagsByCategory[category] || [];
        for (const tag of tags) {
            options.push({ value: tag.tag_key, label: tag.name });
        }
        FillDropdownsForCategory(category, options);
    }
}