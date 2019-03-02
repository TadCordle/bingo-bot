var exports = module.exports = {};

// Given a string (game), returns the name of the closest matching LBP game.
exports.normalizeGameName = (game) => {
    game = game.toLowerCase()
            .replace(new RegExp(" ", 'g'), "")
            .replace(new RegExp("'", 'g'), "")
            .replace("littlebigplanet", "lbp");
    
    if (game === "lbp" || game === "lbp1" || game === "1") {
        return "LittleBigPlanet";

    } else if (game === "psp" || game === "lbppsp") {
        return "LittleBigPlanet PSP";

    } else if (game === "memes"
            || game === "spm"
            || game === "sackboysprehistoricmoves"
            || game === "prehistoricmemes"
            || game === "sackboysprehistoricmemes"
            || game === "lbpspm"
            || game === "lbpsackboysprehistoricmoves"
            || game === "lbpprehistoricmemes"
            || game === "lbpsackboysprehistoricmemes") {
        return "Sackboy's Prehistoric Moves";
    
    } else if (game === "lbp2" || game === "2") {
        return "LittleBigPlanet 2";

    } else if (game === "lbpv" || game === "lbpvita" || game === "v" || game === "vita") {
        return "LittleBigPlanet Vita";
    
    } else if (game === "lbpk" || game === "lbpkarting" || game === "k" || game === "karting") {
        return "LittleBigPlanet Karting";

    } else if (game === "lbp3" || game === "3") {
        return "LittleBigPlanet 3"

    } else {
        return null;
    }
}

// Given a game name (normalizedGame) and a category string, returns the closest matching category name.
exports.normalizeCategory = (normalizedGame, category) => {
    normalizedCategory = category.toLowerCase()
            .replace(new RegExp(" ", 'g'), "")
            .replace(new RegExp("-", 'g'), "")
            .replace("%", "")
            .replace("new game", "ng")
            .replace("plus", "+");

    // Categories common between all games
    if (normalizedCategory === "any") {
        return "Any%";
    } else if (normalizedCategory === "100") {
        return "100%";
    } else if (normalizedCategory === "coop" || normalizedCategory === "coopng+" || normalizedCategory === "2pcoop" || normalizedCategory === "2pcoopng+") {
        return "2p Co-op NG+";
    } else if (normalizedCategory === "3pcoop" || normalizedCategory === "3pcoopng+") {
        return "3p Co-op NG+";
    } else if (normalizedCategory === "4pcoop" || normalizedCategory === "4pcoopng+") {
        return "4p Co-op NG+";
    } else if (normalizedCategory === "an3") {
        return "An3%";
    } else if (normalizedCategory === "an7") {
        return "An7%";
    }

    if (normalizedGame === "LittleBigPlanet") {
        // LBP1-specific categories
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno") {
            return "Any% No-Overlord";
        } else if (normalizedCategory === "100nooverlord" || normalizedCategory === "100no") {
            return "100% No-Overlord";
        } else if (normalizedCategory === "alllevels" || normalizedCategory === "al") {
            return "All Levels"
        } else if (normalizedCategory === "styrofoam") {
            return "Styrofoam%";
        } else if (normalizedCategory === "die") {
            return "Die%";
        } else {
            return null;
        }

    } else if (normalizedGame === "LittleBigPlanet 2") {
        // LBP2-specific categories
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno" || normalizedCategory === "ng+" || normalizedCategory === "solong+") {
            return "Any% No-Overlord";
        } else {
            return null;
        }

    } else if (normalizedGame === "LittleBigPlanet 3") {
        // LBP3-specific categories
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno" || normalizedCategory === "anynocreate" || normalizedCategory === "anync") {
            return "Any% No-Create";
        } else if (normalizedCategory === "profilecorruption" || normalizedCategory === "corruption") {
            return "Profile Corruption%"
        } else {
            return null;
        }

    } else {
        return null;
    }
}

exports.normalizeLevels = (normalizedGame, level) => {
    // TODO: this
    return null;
}