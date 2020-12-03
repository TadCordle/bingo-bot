const config = require("./config.json");
const emotes = config.emotes;

var exports = module.exports = {};

// Writes something to stdout
exports.log = (text, err=false) => {
    if (err) {
        console.error("[" + (new Date()).toISOString() + "] " + text);
    } else {
        console.log("[" + (new Date()).toISOString() + "] " + text);
    }
}

// Given a string (game), returns the name of the closest matching game in config.json.
exports.normalizeGameName = (game) => {
    process = (g) => g.toLowerCase().replace(/\W/g, "").replace("littlebigplanet", "lbp").replace("psv", "v");
    game = process(game);
    for (var name in config.games) {
        if (config.games[name].aliases.includes(game) || process(name) === game) {
            return name;
        }
    }
    return null;
}

// Given a game name and a category string, returns the closest matching category name in config.json.
exports.normalizeCategory = (normalizedGame, category) => {
    g = config.games[normalizedGame];
    if (g === undefined || g.categories === undefined) {
        return "Any%";
    }
    if (category === null) {
        return Object.keys(g.categories)[0];
    }
    process = (c) => c.toLowerCase().replace(/\W|plus/g, "").replace("newgame", "ng");
    normalizedCategory = process(category);
    for (var name in g.categories) {
        if (g.categories[name].includes(normalizedCategory) || process(name) === normalizedCategory) {
            return name;
        }
    }
    return null;
}

// Given a game name and level string, return the closest matching level name in config.json.
exports.normalizeLevel = (normalizedGame, level) => {
    g = config.games[normalizedGame];
    if (level == null) {
        if (g === undefined || g.levels === undefined) {
            return "<select level>";
        }
        return Object.keys(g.levels)[0];
    }
    process = (l) => l.toLowerCase().replace(/&/g, "and").replace(/\W|the/g, "");
    normalizedLevel = process(level);
    for (var name in g.levels) {
        if (g.levels[name].includes(normalizedLevel) || process(name) === normalizedLevel) {
            return name;
        }
    }
    return null;
}

// Gets a user's username string (unless it's FireThieff, then it returns "bean")
exports.username = (message) => {
    if (message.author.id === "159245797328814081") {
        return "bean";
    }
    if (message.member !== null) {
        return message.member.displayName;
    }
    return message.author.username;
}

// Gets a formatted string for @ing a user
exports.mention = (user) => {
    return "<@" + user.id + ">";
}

// Formats a time in seconds in H:mm:ss.xx
exports.formatTime = (time) => {
    if (time === -1) {
        return "--:--:--.--";
    }

    var hrs = Math.floor(time / 3600);
    var min = Math.floor((time - (hrs * 3600)) / 60);
    var sec = Math.round((time - (hrs * 3600) - (min * 60)) * 100) / 100;

    var result = (hrs < 10 ? "0" : "") + hrs;
    result += ":" + (min < 10 ? "0" + min : min);
    result += ":" + (sec < 10 ? "0" + sec : sec);
    if (sec % 1 === 0) {
        result += ".0";
    }
    if ((sec * 10) % 1 === 0) {
        result += "0";
    }

    return result;
}

// Converts a number to its place, e.g. 1 -> 1st, 2 -> 2nd, etc.
exports.formatPlace = (place) => {
    placeDigit = place % 10;
    if (placeDigit > 3 || (3 < place % 100 && place % 100 < 21)) {
        return place + "th";
    } else if (placeDigit === 1) {
        return place + "st";
    } else if (placeDigit === 2) {
        return place + "nd";
    }
    return place + "rd";
}

// Helper for removing an object (value) from an array (arr)
exports.arrayRemove = (arr, value) => {
    return arr.filter((element) => {
        return element != value;
    });
}

// e.g. 1 --> "  1"
exports.addSpaces = (input, outputLength) => {
    var spacesString = "";
    for (let i = 0; i < outputLength - input.length; i++) {
        spacesString += " ";
    }
    return spacesString + input;
}

// Returns either ":..._place:" or ":checkered_flag:"
exports.placeEmote = (place) => {
    switch (place) {
        case 0:
            return emotes.firstPlace;
        case 1:
            return emotes.secondPlace;
        case 2:
            return emotes.thirdPlace;
        default:
            return emotes.finished;
    }
}

exports.defaultStatObj = (id, g, c) => {
    return { user_id: `${id}`, game: `${g}`, category: `${c}`, races: 0, gold: 0, silver: 0, bronze: 0, ffs: 0, elo: 1500, pb: -1 };
}

// Update a user's stats in statObj based on their race results
exports.calculatePlayerStats = (statObj, ffd, racePlace, doneTime) => {
    statObj.races++;
    if (ffd) {
        statObj.ffs++;
    } else {
        if (racePlace === 0) {
            statObj.gold++;
        } else if (racePlace === 1) {
            statObj.silver++;
        } else if (racePlace === 2) {
            statObj.bronze++;
        }

        if (statObj.category !== "Individual Levels" && (statObj.pb === -1 || doneTime < statObj.pb)) {
            statObj.pb = doneTime;
        }
    }
}

// Calculate Elo diffs by treating each pair of racers in the race as a 1v1 matchup.
// See https://en.wikipedia.org/wiki/Elo_rating_system
exports.calculateEloDiffs = (stats, teamMap, raceRankings, ffs) => {
    oldElos = new Map();
    prevTeam = teamMap.get(stats[0].user_id);
    maxElo = Number.MIN_VALUE;
    eloAccum = 0;
    teamCount = 0;
    stats.forEach((stat) => {
        curTeam = teamMap.get(stats[0].user_id);
        if (prevTeam !== "" && prevTeam !== curTeam) {
            // Done counting prevTeam; Calculate and store weighted average of team's elo            
            elo = (maxElo * (teamCount - 1) + eloAccum) / (2 * teamCount - 1);
            oldElos.set("!team " + prevTeam, elo);
            maxElo = Number.MIN_VALUE;
            eloAccum = 0;
            teamCount = 0;
        }
        if (curTeam === "") {
            // Individual; store Elo
            oldElos.set(stat.user_id, stat.elo);
        } else if (curTeam === prevTeam) {
            // Team member; accumulate Elo to average with whole team
            teamCount++;
            eloAccum += stat.elo;
            if (stat.elo > maxElo) {
                maxElo = stat.elo;
            }
        }
        prevTeam = curTeam;
    });

    eloDiffs = new Map();
    raceRankings.forEach((id1, p1Place) => {
        actualScore = 0;
        expectedScore = 0;
        raceRankings.forEach((id2, p2Place) => {
            // Don't compare the player against themselves
            if (id1 === id2) {
                return;
            }

            expectedDiff = 1.0 / (1 + Math.pow(10, (oldElos.get(id2) - oldElos.get(id1)) / 400));
            expectedScore += expectedDiff;

            if (ffs.includes(id1)) {
                if (ffs.includes(id2)) {
                    // If both players forfeited, those two players won't affect each other's scores
                    actualScore += expectedDiff;
                } else {
                    // Loss gives 0 points
                }
            } else if (p1Place < p2Place) {
                // Ahead of opponent, count as win
                actualScore++;
            } else {
                // Loss gives 0 points
            }
        });

        eloDiffs.set(id1, 32 * (actualScore - expectedScore));
    });
    return eloDiffs;
}

// Builds and returns a map of discord id -> stat object for a given game/category. If functions for determining
// a user's forfeit status and finish time are provided, the stat objects will be updated to reflect the results.
exports.retrievePlayerStats = (raceRankings, retrieveStatsSql, game, category, teamMap, ffFunc=null, dtimeFunc=null) => {
    stats = new Map();
    place = -1;
    prevTeam = "";
    raceRankings.forEach((id, i) => {
        statObj = retrieveStatsSql.get(id, game, category);
        if (!statObj) {
            statObj = exports.defaultStatObj(id, game, category);
        }
        curTeam = teamMap.get(id);
        if (curTeam === "" || curTeam !== prevTeam) {
            place++;
        }
        if (ffFunc !== null && dtimeFunc !== null) {
            exports.calculatePlayerStats(statObj, ffFunc(id, i), place, dtimeFunc(id, i));
        }
        stats.set(id, statObj);
        prevTeam = curTeam;
    });
    return stats;
}

// Runs a function for everyone on a given entrant's team.
exports.doForWholeTeam = (raceState, id, proc) => {
    entrant = raceState.entrants.get(id);
    if (entrant.team !== "") {
        raceState.entrants.forEach((e) => {
            if (e.team === entrant.team) {
                proc(e);
            }
        });
    } else {
        proc(entrant);
    }
}

// Iterates over a collection of Entrants and calls individualEntrantFunc on all entrants with no team,
// teamNameFunc for the first player found on a team, and teamEntrantFunc for every player on a team 
exports.forEachWithTeamHandling = (collection, individualEntrantFunc, teamNameFunc, teamEntrantFunc) => {
    entrantsAlreadyOnTeam = [];
    collection.forEach((entrant) => {
        if (entrantsAlreadyOnTeam.includes(entrant)) {
            return;
        }
        if (entrant.team === "") {
            individualEntrantFunc(entrant);
        } else {
            teamNameFunc(entrant);
            teamEntrantFunc(entrant);
            entrantsAlreadyOnTeam.push(entrant);
            collection.forEach((entrantTeamSearch) => {
                if (entrantTeamSearch.team === entrant.team && !entrantsAlreadyOnTeam.includes(entrantTeamSearch)) {
                    teamEntrantFunc(entrantTeamSearch);
                    entrantsAlreadyOnTeam.push(entrantTeamSearch);
                }
            });
        }
    });
}

// Returns true if there is exactly one team registered (and no individuals)
exports.isOneTeamRegistered = (raceState) => {
    foundTeam = "";
    for (var entry in raceState.entrants) {
        if (entry[1].team === "" || (foundTeam !== "" && entry[1].team !== foundTeam)) {
            return false;
        }
        foundTeam = entry[1].team;
    }
    return true;
}

// The following code is based on https://github.com/intesso/decode-html to avoid additional dependencies ---------
// (license: https://github.com/intesso/decode-html/blob/master/LICENSE)
exports.decodeHTML = (text) => {
    entityPattern = /&([a-z]+);/ig;
    entities = { 'amp': '&', 'apos': '\'', 'lt': '<', 'gt': '>', 'quot': '"', 'nbsp': ' ' };
    return text.replace(entityPattern, (match, entity) => {
        entity = entity.toLowerCase();
        if (entities.hasOwnProperty(entity)) {
            return entities[entity];
        }
        // return original string if there is no matching entity (no replace)
        return match;
    });
};
// ----------------------------------------------------------------------------------------------------------------

// Send an error message to discord (with some special handling depending on what the error is)
exports.sendErrorMessage = (e, path, message) => {
    errMsg = "Error reaching " + path + ": ";
    if (e.message.startsWith("connect ETIMEDOUT")) {
        errMsg += "Connection timed out.";
    } else {
        errMsg += e.message;
    }
    message.channel.send(errMsg);
}
