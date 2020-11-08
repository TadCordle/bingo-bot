const config = require("./config.json");
const emotes = config.emotes;

var exports = module.exports = {};

// Writes something to stdout
log = (text, err=false) => {
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
