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
    if (g === null || g.categories === null) {
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
    if (g === null || g.levels === null) {
        return "<select level>";
    }
    if (level == null) {
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
    return message.member.displayName;
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

exports.defaultStatObj = (id, gameName, categoryName) => {
    return { user_id: `${id}`, game: `${gameName}`, category: `${categoryName}`, races: 0, gold: 0, silver: 0, bronze: 0, ffs: 0, elo: 1500, pb: -1 };
}

// Update a user's stats in statObj based on their race results
exports.calculatePlayerStats = (statObj, ffs, racePlace, doneTime) => {
    statObj.races++;
    if (ffs.includes(statObj.user_id)) {
        statObj.ffs++;
    } else {
        if (racePlace === 0) {
            statObj.gold++;
        } else if (racePlace === 1) {
            statObj.silver++;
        } else if (racePlace === 2) {
            statObj.bronze++;
        }

        if (statObj.category !== "Individual Levels") {
            if (statObj.pb === -1 || doneTime < statObj.pb) {
                statObj.pb = doneTime;
            }
        }
    }
}

// Calculate new Elos by treating each pair of racers in the race as a 1v1 matchup.
// See https://en.wikipedia.org/wiki/Elo_rating_system
exports.calculateElos = (newElos, stats, raceRankings, ffs) => {
    raceRankings.forEach((id1, p1Place) => {
        actualScore = 0;
        expectedScore = 0;
        raceRankings.forEach((id2, p2Place) => {
            // Don't compare the player against themselves
            if (id1 === id2) {
                return;
            }

            expectedDiff = 1.0 / (1 + Math.pow(10, (stats.get(id2).elo - stats.get(id1).elo) / 400));
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

        newElos.set(id1, stats.get(id1).elo + 32 * (actualScore - expectedScore));
    });
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