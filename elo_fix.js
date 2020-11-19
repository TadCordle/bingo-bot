const helpers = require("./helpers.js");

const SQLite = require("better-sqlite3");

// Setup tables for fixing user stats
const sql = new SQLite('./data/race.sqlite');
const usersFixedTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users_new'").get();
if (!usersFixedTable['count(*)']) {
    sql.prepare("CREATE TABLE users_new (user_id TEXT, game TEXT, category TEXT, races INTEGER, gold INTEGER, silver INTEGER, bronze INTEGER, ffs INTEGER, elo REAL, pb INTEGER);").run();
    sql.prepare("CREATE UNIQUE INDEX idx_users_fixed_id ON users_new (user_id, game, category);").run();
    sql.pragma("synchronous = 1");
    sql.pragma("journal_mode = wal");
}

getResultsByCategory = sql.prepare("SELECT * FROM results WHERE game = ? AND category = ? ORDER BY race_id, time ASC");
getAllCategories_fix = sql.prepare("SELECT game, category FROM results GROUP BY game, category");
getUserStatsForCategory_fix = sql.prepare("SELECT * FROM users_new WHERE user_id = ? AND game = ? AND category = ?");
addUserStat_fix = sql.prepare("INSERT OR REPLACE INTO users_new (user_id, game, category, races, gold, silver, bronze, ffs, elo, pb) "
                                    + "VALUES (@user_id, @game, @category, @races, @gold, @silver, @bronze, @ffs, @elo, @pb);");

categoriesFix = getAllCategories_fix.all();
for (categoryIndex = 0; categoryIndex < categoriesFix.length; categoryIndex++) {
    game = categoriesFix[categoryIndex].game;
    category = categoriesFix[categoryIndex].category;
    console.log(game + ", " + category);
    
    rows = getResultsByCategory.all(game, category);
    if (rows.length === 0) {
        console.log("No results found for " + game + ", " + category);
        return;
    }

    for (i = 0; i < rows.length;) {
        ds = [];
        dtimes = [];
        ffs = [];

        prevId = rows[i].race_id;
        while (i < rows.length && rows[i].race_id === prevId) {
            if (rows[i].ff) {
                ffs.push(rows[i].user_id);
            } else {
                ds.push(rows[i].user_id);
                dtimes.push(rows[i].time);
            }
            prevId = rows[i].race_id;
            i++;
        }

        console.log("=== race " + prevId + "===");
        console.log(ds.length + ffs.length + " players");

        // Update racers' stats
        playerStats = new Map();
        raceRankings = ds.concat(ffs);
        raceRankings.forEach((id, j) => {
            statObj = getUserStatsForCategory_fix.get(id, game, category);
            if (!statObj) {
                statObj = helpers.defaultStatObj(id, game, category);
            }
            helpers.calculatePlayerStats(statObj, ffs, j, dtimes[j]);
            playerStats.set(id, statObj);
        });

        newElos = helpers.calculateElos(playerStats, raceRankings, ffs);

        // Update/save stats with new ELOs
        playerStats.forEach((stat, id) => {
            stat.elo = newElos.get(id);
            addUserStat_fix.run(stat);
        });
    }
}

console.log("Fixed Elos, I hope.");
