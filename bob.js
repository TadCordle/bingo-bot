const discordAuth = require("./discord_auth.json");
const config = require("./config.json");
const emotes = config.emotes;
const fun = require("./fun.js");
const roles = require("./roles.js");
const Discord = require("discord.js");
const SQLite = require("better-sqlite3");
const https = require("https");
const fs = require("fs");
const helpers = require("./helpers.js");

if (!fs.existsSync("./data/")) {
    fs.mkdirSync("./data/");
}

const sql = new SQLite("./data/race.sqlite");
const client = new Discord.Client();
var gameName = Object.keys(config.games)[0];
var categoryName = helpers.normalizeCategory(gameName, null);
var levelName = helpers.normalizeLevel(gameName, null);
var raceId = 0;

// References to timeouts, to cancel them if someone interrupts them
var countDownTimeout1;
var countDownTimeout2;
var countDownTimeout3;
var goTimeout;
var raceDoneTimeout;
var raceDoneWarningTimeout;

// Indicates a race bot state
var State = {
    NO_RACE:   0,
    JOINING:   1,
    COUNTDOWN: 2,
    ACTIVE:    3,
    DONE:      4
}

// Keeps track of the current stage of racing the bot is occupied with
class RaceState {
    constructor() {
        this.entrants = new Map(); // Maps from user id to their current race state
        this.doneIds = [];
        this.ffIds = [];
        this.state = State.NO_RACE;
        this.startTime = 0;
        this.ilScores = new Map();
        this.ilResults = [];
        this.leavingWhenDone = new Set();
    }

    // Adds an entrant. Returns true if successful, returns false if the user has already joined.
    addEntrant(message) {
        if (this.entrants.has(message.author.id)) {
            return false;
        }
        this.entrants.set(message.author.id, new Entrant(message));
        return true;
    }

    // Removes an entrant. Returns true if successful, returns false if the user isn't an entrant.
    removeEntrant(id) {
        if (this.entrants.has(id)) {
            if (this.entrants.get(id).team !== "") {
                this.disbandTeam(this.entrants.get(id).team);
            }
            this.entrants.delete(id);
            return true;
        }
        return false;
    }

    // Returns true if the user is joined and ready, false if not.
    entrantIsReady(id) {
        return this.entrants.has(id) && this.entrants.get(id).ready;
    }

    // Returns true if all entrants are ready, false if not.
    isEveryoneReady() {
        let everyoneReady = true;
        this.entrants.forEach((entrant) => {
            if (!entrant.ready) {
                everyoneReady = false;
            }
        });
        return everyoneReady;
    }

    // Returns the current IL score of a user
    getILScore(id) {
        if (this.ilScores.has(id)) {
            return this.ilScores.get(id);
        }
        return 0;
    }

    // Resets the team name of all entrants using teamName
    disbandTeam(teamName) {
        this.entrants.forEach((entrant) => {
            if (entrant.team === teamName) {
                entrant.team = "";
            }
        });
    }

    // Returns true if any teams are registered, false if not
    hasTeams() {
        let has = false;
        this.entrants.forEach((entrant) => {
            if (entrant.team !== "") {
                has = true;
            }
        });
        return has;
    }
}

// Represents a race entrant
class Entrant {
    constructor(message) {
        this.message = message;
        this.ready = false;
        this.doneTime = 0;
        this.team = "";
    }
}

// Holds the winner of an IL race
class ILResult {
    constructor(id, level, winner) {
        this.id = id;
        this.level = level;
        this.winner = winner;
    }
}

var raceState = new RaceState();

client.on("ready", () => {
    // Setup tables for keeping track of race results
    if (!sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='results'").get()['count(*)']) {
        sql.prepare("CREATE TABLE results (race_id INTEGER, user_id TEXT, user_name TEXT, game TEXT, category TEXT, level TEXT, time INTEGER, ff INTEGER, team_name TEXT);").run();
        sql.prepare("CREATE UNIQUE INDEX idx_results_race ON results (race_id, user_id);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    // Setup tables for keeping track of user stats
    if (!sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users'").get()['count(*)']) {
        sql.prepare("CREATE TABLE users (user_id TEXT, game TEXT, category TEXT, races INTEGER, gold INTEGER, silver INTEGER, bronze INTEGER, ffs INTEGER, elo REAL, pb INTEGER);").run();
        sql.prepare("CREATE UNIQUE INDEX idx_users_id ON users (user_id, game, category);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    // Setup SQL queries for setting/retrieving results
    client.getLastRaceID = sql.prepare("SELECT MAX(race_id) AS id FROM results");
    client.getResults = sql.prepare("SELECT * FROM results WHERE race_id = ? ORDER BY time ASC");
    client.addResult = sql.prepare("INSERT OR REPLACE INTO results (race_id, user_id, user_name, game, category, level, time, ff, team_name) VALUES (@race_id, @user_id, @user_name, @game, @category, @level, @time, @ff, @team_name);");

    // Setup SQL queries for setting/retrieving user stats
    client.getUserStatsForGame = sql.prepare("SELECT * FROM users WHERE user_id = ? AND game = ? ORDER BY category ASC");
    client.getUserStatsForCategory = sql.prepare("SELECT * FROM users WHERE user_id = ? AND game = ? AND category = ?");
    client.addUserStat = sql.prepare("INSERT OR REPLACE INTO users (user_id, game, category, races, gold, silver, bronze, ffs, elo, pb) "
                                   + "VALUES (@user_id, @game, @category, @races, @gold, @silver, @bronze, @ffs, @elo, @pb);");
    client.getUserGamesRan = sql.prepare("SELECT DISTINCT game, category FROM users WHERE user_id = ?");
    client.getIdFromName = sql.prepare("SELECT user_id, user_name FROM results WHERE user_name = ? COLLATE NOCASE");

    // Setup SQL query to show leaderboard
    client.getLeaderboard = sql.prepare("SELECT DISTINCT results.user_id AS user_id, results.user_name AS user_name, users.elo AS elo FROM results INNER JOIN users ON results.user_id = users.user_id "
                                      + "WHERE results.game = ? AND results.category = ? AND users.game = ? AND users.category = ? GROUP BY results.user_id ORDER BY users.elo DESC");

    // Set race ID to highest recorded race ID + 1
    raceId = client.getLastRaceID.get().id;
    if (!raceId) {
        raceId = 0;
    }
    raceId++;

    roles.init(client);

    helpers.log("Ready! Next race ID is " + raceId + ".");
});

client.on("message", (message) => {
    if (!message.content.startsWith("!") || message.author.bot) {
        return;
    }

    // Race commands
    lowerMessage = message.content.toLowerCase();
    if (message.guild) {
        if (lowerMessage.startsWith("!race") || lowerMessage.startsWith("!join"))
            raceCmd(message);

        else if (lowerMessage.startsWith("!ilrace"))
            ilRaceCmd(message);

        else if (lowerMessage.startsWith("!game"))
            gameCmd(message);

        else if (lowerMessage.startsWith("!category"))
            categoryCmd(message);

        else if (lowerMessage.startsWith("!level"))
            levelCmd(message);

        else if (lowerMessage.startsWith("!luckydip"))
            luckyDipCmd(message);

        else if (lowerMessage.startsWith("!team"))
            teamCmd(message);

        else if (lowerMessage.startsWith("!randomteams"))
            randomTeamsCmd(message);

        else if (lowerMessage.startsWith("!unteam"))
            unteamCmd(message);

        else if (lowerMessage.startsWith("!exit") ||
                lowerMessage.startsWith("!unrace") ||
                lowerMessage.startsWith("!leave") ||
                lowerMessage.startsWith("!quit") ||
                lowerMessage.startsWith("!yeet") ||
                lowerMessage.startsWith("!f"))
            forfeitCmd(message);

        else if (lowerMessage.startsWith("!ready"))
            readyCmd(message);

        else if (lowerMessage.startsWith("!unready"))
            unreadyCmd(message);

        else if (lowerMessage.startsWith("!d") || lowerMessage.startsWith("! d"))
            doneCmd(message);

        else if (lowerMessage.startsWith("!ud") || lowerMessage.startsWith("!undone"))
            undoneCmd(message);

        else if (lowerMessage.startsWith("!uf") || lowerMessage.startsWith("!unforfeit"))
            unforfeitCmd(message);

        // Admin/Mod only commands
        else if (message.member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator")) {
            if (lowerMessage.startsWith("!modhelp"))
                modHelpCmd(message);

            else if (lowerMessage.startsWith("!clearrace"))
                clearRaceCmd(message);

            else if (lowerMessage.startsWith("!clearteams"))
                clearTeamsCmd(message);
        }
    }

    // Commands available anywhere
    if (lowerMessage.startsWith("!help") || lowerMessage.startsWith("!commands"))
        helpCmd(message);

    else if (lowerMessage.startsWith("!me"))
        meCmd(message);

    else if (lowerMessage.startsWith("!runner"))
        runnerCmd(message);

    else if (lowerMessage.startsWith("!results"))
        resultsCmd(message);

    else if (lowerMessage.startsWith("!ilresults"))
        ilResultsCmd(message);

    else if (lowerMessage.startsWith("!elo") || lowerMessage.startsWith("!leaderboard"))
        leaderboardCmd(message);

    else if (lowerMessage.startsWith("!s"))
        statusCmd(message);

    else {
        fun.funCmds(lowerMessage, message);
        roles.roleCmds(lowerMessage, message);
    }
});

client.on('error', console.error);

// !help/!commands
helpCmd = (message) => {
    message.channel.send(`
**Pre-race commands**
\`!race\` - Starts a new full-game race, or joins the current open race if someone already started one.
\`!game <game name>\` - Sets the game (e.g. \`!game LBP2\`).
\`!category <category name>\` - Sets the category (e.g. \`!category any%\`).
\`!team <discord id> [<discord id> ... <team name>]\` - Sets up a team for co-op racing.
\`!randomteams [<team size>]\` - Randomly assigns entrants to teams of the given size. Default size is 2.
\`!unteam\` - Disband your current team.
\`!leave\` - Leave the race.
\`!ready\` - Indicate that you're ready to start.
\`!unready\` - Indicate that you're not actually ready.

**Mid-race commands**
\`!d\` - Indicate that you finished.
\`!ud\` - Get back in the race if you finished by accident.
\`!f\` - Drop out of the race.
\`!uf\` - Rejoin the race if you forfeited by accident.

**IL race commands**
\`!ilrace\` - Starts a new series of IL races.
\`!level <level name>\` - Sets the next level to race. Also accepts lbp.me links.
\`!luckydip\` - Sets the next level to race to a random lucky dip level.
\`!ilresults\` - Shows the ILs that have been played so far in a series, and the winner of each one.

**Stat commands**
\`!status\` - Shows current race status/entrants.
\`!results <race #>\` - Shows results of the specified race number (e.g. \`!results 2\`).
\`!me <game name>\` - Shows your race statistics for the specified game (e.g. \`!me lbp\`).
\`!runner <username or id> <game name>\` - Shows someone else's race statistics (e.g. \`!runner RbdJellyfish lbp\`).
\`!elo <game name>/<category name>\` - Shows the ELO leaderboard for the given game/category (e.g. \`!elo lbp/any% no overlord\`).
\`!help\` - Shows this message.

**Other commands**
\`!roles <speedrun.com name>\` - Updates your roles to match races finished + speedrun.com PBs (if you linked your discord account on speedrun.com).
\`!removeroles\` - Removes your runner roles.
`);
}

modHelpCmd = (message) => {
    message.channel.send(`
**Admin/moderator only (mid-race)**
\`!modhelp\` - Shows this message.
\`!clearrace\` - Resets the bot; forces ending the race without recording any results.
\`!clearteams\` - Disbands all current teams.
\`!f <discord id>\` - Kicks another user from the race.
\`!roles <speedrun.com name> <discord id>\` - Updates someone else's roles.
\`!removeroles <discord id>\` - Remove someone else's roles.
\`!reloadroles\` - Refreshes all registered roles.
`);
}

// !race/!join
raceCmd = (message) => {
    if (raceState.state === State.DONE) {
        // Record race results now if results are pending
        clearTimeout(raceDoneTimeout);
        recordResults();
    }

    if (raceState.state === State.NO_RACE) {
        // Start race
        raceState.addEntrant(message);
        message.channel.send(helpers.mention(message.author) + " has started a new race! Use `!race` to join; use `!game` and `!category` to setup the race further (currently " + gameName + " / " + categoryName + ").");
        raceState.state = State.JOINING;

    } else if (raceState.state === State.JOINING) {
        // Join existing race
        if (raceState.addEntrant(message)) {
            message.react(emotes.acknowledge);
        }

    } else if (raceState.state === State.COUNTDOWN || raceState.state === State.ACTIVE) {
        if (raceState.leavingWhenDone.has(message.author.id)) {
            raceState.leavingWhenDone.delete(message.author.id);
            message.react(emotes.acknowledge);
        } else {
            // Can't join race that already started
            if (!raceState.entrants.has(message.author.id)) {
                message.author.send("Can't join because there's a race already in progress!");
            }
        }
    }
}

// !ilrace
ilRaceCmd = (message) => {
    if (raceState.state === State.DONE) {
        // Record race results now if results are pending
        clearTimeout(raceDoneTimeout);
        recordResults();
    }

    if (raceState.state === State.NO_RACE) {
        // Start race
        raceState.addEntrant(message);
        levelName = helpers.normalizeLevel(gameName, null);
        msg = helpers.mention(message.author) + " has started a new IL race! Use `!race` to join; use `!game` and `!level` to setup the race further";
        if (config.games[gameName].levels === undefined) {
            msg += ".\n**Note:** IL races are not configured for " + gameName + ". Use `!game` to choose a game with ILs, or use `!level` to pick the level if this was not a mistake.";
        } else {
            msg += " (currently " + gameName + " / " + levelName + ").";
        }
        message.channel.send(msg);
        raceState.state = State.JOINING;

    } else if (raceState.state === State.JOINING) {
        // Join existing race
        if (raceState.addEntrant(message)) {
            message.react(emotes.acknowledge);
        }

    } else if (raceState.state === State.COUNTDOWN || raceState.state === State.ACTIVE) {
        // Can't join race that already started
        message.author.send("Can't join because there's a race already in progress!");
        return;
    }

    // Update category to IL races
    categoryName = raceState.hasTeams() ? "Individual Levels (Co-op)" : "Individual Levels";
}

// !game
gameCmd = (message) => {
    if (raceState.state !== State.JOINING) {
        return;
    }

    game = message.content.replace(/^!game/i, "").trim();
    word = isILRace() ? "level" : "category";
    name = isILRace() ? levelName : categoryName;

    if (game === null || game === "") {
        message.channel.send("Game / " + word + " is currently set to " + gameName + " / " + name + ". Set the game using: `!game <game name>`");
        return;
    }

    game = helpers.normalizeGameName(game);
    if (game === null) {
        message.channel.send("Specified game name was not valid, try something else.");
        return;
    }

    if (gameName !== game) {
        gameName = game;
        warning = "";
        if (isILRace()) {
            levelName = helpers.normalizeLevel(game, null);
            name = levelName;
            if (config.games[game].levels === undefined) {
                warning = "\n**Note:** IL races are not configured for " + gameName + ". Use `!game` to choose another game, or use `!level` to pick the level if this was not a mistake.";
            }
        } else {
            categoryName = helpers.normalizeCategory(game, null);
            name = categoryName;
        }
        message.channel.send("Game / " + word + " updated to " + gameName + " / " + name + "." + warning);
    } else {
        message.channel.send("Game / " + word + " was already set to " + gameName + " / " + name + ".");
    }
}

// !category
categoryCmd = (message) => {
    if (raceState.state === State.JOINING) {
        category = message.content.replace(/^!category/i, "").trim();
        if (category === null || category === "") {
            if (isILRace()) {
                message.channel.send("IL race is currently in progress. Current game / level is set to " + gameName + " / " + levelName + ".");
            } else {
                message.channel.send("Game / category is currently set to " + gameName + " / " + categoryName + ". Set the category using: `!category <category name>`");
            }
            return;
        }

        normalized = helpers.normalizeCategory(gameName, category);
        if (normalized === null) {
            if (isILRace()) {
                message.channel.send("Switching from IL race to full-game race (" + gameName + " / " + category + "). (This doesn't seem to be an official category, though; did you mean something else?)");
            } else {
                message.channel.send("Category updated to " + category + ". (This doesn't seem to be an official category, though; did you mean something else?)");
            }
            categoryName = category;
            return;
        }

        if (normalized.startsWith("Individual Levels")) {
            if (!isILRace()) {
                categoryName = raceState.hasTeams() ? "Individual Levels (Co-op)" : "Individual Levels";
                endMsg = " (currently " + gameName + " / " + levelName + ").";
                if (config.games[gameName].levels === undefined) {
                    endMsg = ".\n**Note:** ILs are not configured for " + gameName + ". Use `!game` to choose a game with ILs, or use `!level` to pick the level if this was not a mistake.";
                }
                message.channel.send("Switched to IL race. Use `!race` to join; use `!game` and `!level` to setup the race further" + endMsg);
            }
            return;
        }

        if (isILRace()) {
            message.channel.send("Switching from IL race to full-game race (" + gameName + " / " + normalized + ").");
        } else {
            message.channel.send("Category updated to " + normalized + ".");
        }
        categoryName = normalized;
    }
}

// !level
levelCmd = (message) => {
    if (!isILRace() || raceState.state !== State.JOINING) {
        return;
    }

    // Show current level
    level = message.content.replace(/^!level/i, "").trim();
    if (level === null || level === "") {
        message.channel.send("Game / level is currently set to " + gameName + " / " + levelName + ". Set the level using: `!level <level name>`");
        return;
    }

    // Choose community level
    if (level.includes("lbp.me/v/")) {
        chooseLbpMeLevel(getLbpMeUrl(level), message);
        return;
    }

    normalized = helpers.normalizeLevel(gameName, level);
    if (normalized !== null) {
        // Choose story level
        levelName = normalized;
        message.channel.send("Level updated to " + levelName + ".");
        return;
    }

    // Choose other non-story level
    levelName = level;
    message.channel.send("Level updated to " + levelName + ". (Level name not recognized in " + gameName + "; did you make a typo?)");    
}

// !luckydip
luckyDipCmd = (message) => {
    if (!isILRace() || raceState.state !== State.JOINING) {
        return;
    }

    levelRegex = /-/;
    luckyDipUrl = "";
    lastLetter = gameName.charAt(gameName.length - 1);
    switch(lastLetter) {
        case "t":
            levelRegex = /([^\/]+)" class="level-pic md no-frills lbp1/g;
            luckyDipUrl = "https://lbp.me/levels?p=1&t=luckydip&g=lbp1";
            break;
        case "2":
            levelRegex = /([^\/]+)" class="level-pic md no-frills lbp2/g;
            luckyDipUrl = "https://lbp.me/levels?p=1&t=luckydip&g=lbp2";
            break;
        case "3":
            levelRegex = /([^\/]+)" class="level-pic md no-frills lbp3/g;
            luckyDipUrl = "https://lbp.me/levels?p=1&t=luckydip&g=lbp3";
            break;
        case "a":
            levelRegex = /\/v\/([^"]+)/g;
            luckyDipUrl = "https://vita.lbp.me/search?t=luckydip";
            break;
        default:
            message.channel.send("Random community levels are unsupported for " + gameName);
            return;
    }
    chooseLuckyDipLevel(luckyDipUrl, message);
}

chooseLuckyDipLevel = (luckyDipUrl, message) => {
    "use-strict";
    https.get(luckyDipUrl, (result) => {
        var { statusCode } = result;
        if (statusCode === 302) {
            chooseLuckyDipLevel(result.headers.location, message);
            return;
        }
        if (statusCode !== 200) {
            message.channel.send("Couldn't follow " + luckyDipUrl + "; got a " + statusCode + " response.");
            return;
        }
        var dataQueue = "";
        result.on("data", (dataBuffer) => {
            dataQueue += dataBuffer;
        });
        result.on("end", () => {
            matches = [];
            dataQueue.replace(levelRegex, (wholeMatch, parenthesesContent) => {
                matches.push(parenthesesContent);
            });
            level = ((lastLetter === "a") ? "https://vita.lbp.me/v/" : "https://lbp.me/v/")
                    + matches[Math.floor(Math.random() * 12)];
            chooseLbpMeLevel(getLbpMeUrl(level), message);
        });
    }).on('error', (e) => {
        helpers.log(e, true);
        helpers.sendErrorMessage(e, luckyDipUrl, message);
    });
}

getLbpMeUrl = (level) => {
    if (level.startsWith("http:")) {
        level = level.replace("http:", "https:");
    } else if (!level.startsWith("https:")) {
        level = "https://" + level;
    }
    if (level.split("/").length < 6) {
        level += "/topreviews";
    }
    return level;
}

// Sets the current level in an IL race to the level at the given lbp.me link
chooseLbpMeLevel = (level, message) => {
    isVita = level.includes("vita.lbp.me");
    "use-strict";
    https.get(level, (result) => {
        var { statusCode } = result;
        if (statusCode === 302) {
            chooseLbpMeLevel(result.headers.location, message, onEnd);
            return;
        }
        if (statusCode !== 200) {
            message.channel.send("Couldn't follow " + level + "; got a " + statusCode + " response.");
            return;
        }

        var dataQueue = "";
        result.on("data", (dataBuffer) => {
            dataQueue += dataBuffer;
        });
        result.on("end", () => {
            start = dataQueue.search("<title>") + 7;
            end = dataQueue.search(/ - LBP\.me( PS Vita)?<\/title>/);
            titleAuthor = helpers.decodeHTML(dataQueue.substring(start, end).trim());
            split = titleAuthor.split(" ");
            title = titleAuthor.substring(0, titleAuthor.search(split[split.length - (isVita ? 2 : 1)])).trim(); // On vita.lbp.me there is a "By" between level name and author
            levelName = title + (isVita ? " - https://vita.lbp.me/v/" : " - https://lbp.me/v/") + level.split("/")[4];
            message.channel.send("Level updated to " + levelName + ".");
        });
    }).on('error', (e) => {
        helpers.log(e, true);
        helpers.sendErrorMessage(e, level, message);
    });
}

// !team
teamCmd = (message) => {
    // Can only run command if you've joined the race and it hasn't started
    if (raceState.state !== State.JOINING || !raceState.entrants.has(message.author.id)) {
        return;
    }

    params = message.content.replace(/^!team/i, "").trim().split(" ");
    if (params[0] === "") {
        message.channel.send("Usage: `!team @teammate1 [@teammate2 @teammate3 ... team name]`");
        return;
    }

    // Parse custom team name first; need to validate this before we start constructing the team
    teamName = "Team " + helpers.username(message);
    customTeamName = false;
    for(var i = 0; i < params.length; i++) {
        if (customTeamName) {
            teamName += " " + params[i];
        } else {
            if (!params[i].startsWith("<@!")) {
                teamName = params[i];
                customTeamName = true;
            }
        }
    }

    // Validate that team name is unused
    prevTeamName = raceState.entrants.get(message.author.id).team;
    if (teamName !== prevTeamName) {
        for(var entry in raceState.entrants) {
            if (entry[1].team === teamName) {
                message.channel.send(helpers.mention(message.author) + ": Cannot create team; the team name \"" + teamName + "\" is already being used.");
                return;
            }
        }
    }

    // Validate selected team members
    selectedUsers = [raceState.entrants.get(message.author.id)];
    for(var i = 0; i < params.length; i++) {
        if (!params[i].startsWith("<@!")) {
            break;
        }
        discordId = params[i].replace("<@!", "").replace(">", "").trim();
        if (!raceState.entrants.has(discordId)) {
            message.channel.send(helpers.mention(message.author) + ": Cannot create team; all team members must join the race first.");
            return;
        }
        if (discordId === message.author.id) {
            message.channel.send(helpers.mention(message.author) + ": Cannot create team; you can't team with yourself!");
            return;
        }
        entrant = raceState.entrants.get(discordId);
        if (entrant.team !== "" && entrant.team !== teamName && entrant.team !== prevTeamName) {
            message.channel.send(helpers.mention(message.author) + ": Cannot create team; <@" + discordId + "> is already on another team (" + userTeam + "). They must run `!unteam` before you can add them to your team.");
            return;
        }
        selectedUsers.push(entrant);
    }

    // Didn't specify team members
    if (selectedUsers.length <= 1) {
        if (raceState.entrants.get(message.author.id).team !== "" && customTeamName) {
            helpers.doForWholeTeam(raceState, message.author.id, (e) => e.team = teamName);
            message.channel.send(helpers.mention(message.author) + ": Team name has been changed to **" + teamName + "**.");
        } else {
            message.channel.send(helpers.mention(message.author) + ": Cannot create team; you must choose teammates.");
        }
        return;
    }

    // Form new team
    if (isILRace()) {
        categoryName = "Individual Levels (Co-op)";
    }
    if (prevTeamName !== "") {
        raceState.disbandTeam(prevTeamName);
    }
    for (var i = 0; i < selectedUsers.length; i++) {
        selectedUsers[i].team = teamName;
    }

    // Send confirmation message
    messageString = helpers.mention(selectedUsers[0].message.author) + " has teamed with ";
    for (var i = 1; i < selectedUsers.length; i++) {
        messageString += (i > 1 ? ", " : "") + helpers.mention(selectedUsers[i].message.author)
    }
    messageString += " under the name **" + teamName + "**";
    message.channel.send(messageString);
}

// !randomteams
randomTeamsCmd = (message) => {
    // Can only run command if you've joined the race and it hasn't started
    if (raceState.state !== State.JOINING || !raceState.entrants.has(message.author.id)) {
        return;
    }

    params = message.content.replace(/^!randomteams/i, "").trim().split(" ");
    teamSize = 2;
    if (params[0] !== "") {
        teamSize = parseInt(params[0]);
        if (teamSize < 2) {
            teamSize = 2;
        }
    }

    if (isILRace()) {
        categoryName = "Individual Levels (Co-op)";
    }

    entrantArray = [];
    raceState.entrants.forEach((entrant) => {
        if (entrant.team !== "") {
            raceState.disbandTeam(entrant.team);
        }
        entrantArray.push(entrant);
    });
    entrantArray.sort((a, b) => Math.floor(Math.random() * 3) - 1);

    teamCount = 0;
    teamName = "";
    entrantArray.forEach((entrant) => {
        if (teamCount === 0) {
            teamName = "Team " + helpers.username(entrant.message);
        }
        entrant.team = teamName;
        teamCount++;
        if (teamCount >= teamSize) {
            teamCount = 0;
        }
    });

    message.react(emotes.acknowledge);
    statusCmd(message);
}

// !unteam
unteamCmd = (message) => {
    // Can only run command if you've joined the race and it hasn't started
    if (raceState.state !== State.JOINING || !raceState.entrants.has(message.author.id)) {
        return;
    }
    team = raceState.entrants.get(message.author.id).team;
    if (team === "") {
        return;
    }
    raceState.disbandTeam(team);
    if (isILRace() && !raceState.hasTeams()) {
        categoryName = "Individual Levels";
    }
    message.channel.send("**" + team + "** has been disbanded.");
}

// !ff/!forfeit/!leave/!exit/!unrace
forfeitCmd = (message) => {
    // Check if admin is FF'ing for someone else
    ffId = message.author.id;
    username = helpers.username(message);
    if (message.member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator")) {
        params = message.content.trim().split(" ");
        if (params.length > 1) {
            ffId = params[1].replace("<@!", "").replace(">", "").trim();
            username = params[1].trim() + " (via " + helpers.username(message) + ")";
        }
    }

    if (!raceState.entrants.has(ffId)){
        // Can't leave if you're not in the race, dummy
        return;
    }

    if (raceState.state === State.JOINING) {
        // Leave race completely if the race hasn't started yet
        if (raceState.removeEntrant(ffId)) {
            if (raceState.entrants.size === 0) {
                // Close down race if this is the last person leaving
                message.channel.send(username + " has left the race. Closing race.");
                raceState = new RaceState();
                if (isILRace()) {
                    categoryName = helpers.normalizeCategory(gameName, null);
                }
            } else {
                if (helpers.isOneTeamRegistered(raceState)) {
                    // If only one team  is left, make sure at least one of its members is unreadied
                    allReady = true;
                    raceState.entrants.forEach((entrant) => {
                        if (!entrant.ready) {
                            allReady = false;
                        }
                    });
                    if (allReady) {
                        raceState.entrants.values().next().value.ready = false;
                    }
                }

                message.channel.send(username + " has left the race.");
                if (raceState.entrants.size === 1) {
                    // If only one person is left now, make sure they are marked as unready
                    raceState.entrants.forEach((entrant) => { entrant.ready = false; });
                }

                if (isILRace() && !raceState.hasTeams()) {
                    categoryName = "Individual Levels";
                }

                // If everyone left is ready, start the race
                if (raceState.isEveryoneReady()) {
                    doCountDown(message);
                }
            }
        }

    } else if (raceState.state === State.ACTIVE || raceState.state === State.COUNTDOWN) {
        if (raceState.ffIds.includes(ffId) || raceState.doneIds.includes(ffId)) {
            // If this person has already finished the current race, mark them to leave once the race is over
            if (isILRace()) {
                raceState.leavingWhenDone.add(ffId);
                message.channel.send(username + " has left the race.");
            }

        } else {
            // Otherwise mark them as forfeited
            helpers.doForWholeTeam(raceState, ffId, (e) => raceState.ffIds.push(e.message.author.id));
            team = raceState.entrants.get(ffId).team;
            message.channel.send((team === "" ? username : "**" + team + "**") + " has forfeited (use `!unforfeit` to rejoin if this was an accident).");

            // Check if everyone forfeited
            if (raceState.ffIds.length + raceState.doneIds.length === raceState.entrants.size) {
                if (raceState.state === State.COUNTDOWN) {
                    stopCountDown();
                    if (isILRace()) {
                        newIL();
                        raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Everyone forfeited. IL not counted."); }, 1000);
                    } else {
                        raceState = new RaceState();
                        raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Everyone forfeited. Closing race."); }, 1000);
                    }
                } else {
                    doEndRace(message);
                }
            }
        }
    }
}

// !uff/!unforfeit
unforfeitCmd = (message) => {
    if (!raceState.entrants.has(message.author.id)){
        // Can't unforfeit if you're not in the race
        return;
    }

    if (raceState.state === State.ACTIVE || raceState.state === State.COUNTDOWN || raceState.state === State.DONE) {
        ufPlayers = [];
        helpers.doForWholeTeam(raceState, message.author.id, (e) => ufPlayers.push(e.message.author.id));
        if (ufPlayers.length > 0) {
            ufPlayers.forEach((id) => {
                if (raceState.leavingWhenDone.has(id)) {
                    raceState.leavingWhenDone.delete(id);
                }
                raceState.ffIds = helpers.arrayRemove(raceState.ffIds, id);
            });
            if (raceState.state === State.Done) {
                raceState.state = State.ACTIVE;
            }
            clearTimeout(raceDoneTimeout);
            clearTimeout(raceDoneWarningTimeout);
            message.react(emotes.acknowledge);
        }
    }
}

// !ready
readyCmd = (message) => {
    if (raceState.state !== State.JOINING) {
        return;
    }

    // Don't allow readying up if only one person has joined
    if (raceState.entrants.size === 1 && raceState.entrants.has(message.author.id)) {
        message.channel.send("Need more than one entrant before starting!");
        return;
    }

    if (!raceState.entrantIsReady(message.author.id)) {
        // Mark as ready
        raceState.addEntrant(message);
        raceState.entrants.get(message.author.id).ready = true;

        // Start countdown if everyone is ready
        if (raceState.isEveryoneReady()) {
            // Don't start if only one team has joined
            if (helpers.isOneTeamRegistered(raceState)) {
                message.channel.send("Can't ready up/start; everyone is on the same team!");
                raceState.entrants.get(message.author.id).ready = false;
                return;
            }
            doCountDown(message);
        }
        message.react(emotes.acknowledge);
    }
}

// !unready
unreadyCmd = (message) => {
    unforfeitCmd(message);
    if (raceState.state === State.JOINING || raceState.state === State.COUNTDOWN) {
        if (raceState.entrantIsReady(message.author.id)) {
            raceState.entrants.get(message.author.id).ready = false;
            message.react(emotes.acknowledge);

            // If someone unready'd during countdown, stop the countdown
            if (raceState.state === State.COUNTDOWN) {
                raceState.state = State.JOINING;
                stopCountDown();
                message.channel.send(helpers.username(message) + " isn't ready; stopping countdown.");
            }
        }
    }
}

// !d/!done
doneCmd = (message) => {
    // Check if admin is done'ing for someone else
    doneId = message.author.id;
    username = helpers.mention(message.author);
    if (message.member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator")) {
        params = message.content.trim().toLowerCase().replace("! d", "!d").split(" ");
        if (params.length > 1) {
            doneId = params[1].replace("<@!", "").replace(">", "").trim();
            username = params[1].trim() + " (via " + helpers.username(message) + ")";
        }
    }

    if (raceState.state !== State.ACTIVE || !raceState.entrants.has(doneId) || raceState.doneIds.includes(doneId) || raceState.ffIds.includes(doneId)) {
        return;
    }

    time = message.createdTimestamp / 1000 - raceState.startTime;
    helpers.doForWholeTeam(raceState, doneId, (e) => {
        e.doneTime = time;
        raceState.doneIds.push(e.message.author.id);
    });
    raceState.doneIds.sort((id1, id2) => raceState.entrants.get(id1).doneTime - raceState.entrants.get(id2).doneTime);

    // Calculate Elo diff
    inProgress = [];
    teamMap = new Map();
    raceState.entrants.forEach((entrant) => {
        id = entrant.message.author.id;
        teamMap.set(id, entrant.team);
        if (!raceState.doneIds.includes(id) && !raceState.ffIds.includes(id)) {
            inProgress.push(id);
        }
    });

    sortedRacerList = raceState.doneIds.concat(inProgress).concat(raceState.ffIds);
    stats = helpers.retrievePlayerStats(sortedRacerList, client.getUserStatsForCategory, gameName, categoryName, teamMap);
    eloId = doneId;
    if (teamMap.get(doneId) !== "") {
        eloId = "!team " + teamMap.get(doneId);
    }
    eloDiff = helpers.calculateEloDiffs(stats, teamMap, sortedRacerList, raceState.ffIds).get(eloId);

    // Calculate finish position
    place = 0;
    entrantsDone = [];
    raceState.doneIds.forEach((id) => entrantsDone.push(raceState.entrants.get(id)));
    helpers.forEachWithTeamHandling(entrantsDone, (individualEntrante) => place++, (firstOnTeam) => place++, (entrantWithTeame) => {});

    team = raceState.entrants.get(doneId).team;
    message.channel.send((team === "" ? username : "**" + team + "**")
            + " has finished in " + helpers.formatPlace(place) + " place "
            + ((eloDiff < 0 ? "(" : "(+") + (Math.round(eloDiff * 100) / 100) + " " + emotes.elo + ") ")
            + "with a time of " + helpers.formatTime(time)) + "! (Use `!undone` if this was a mistake.)";
    if (raceState.ffIds.length + raceState.doneIds.length === raceState.entrants.size) {
        doEndRace(message);
    }
}

// !ud/!undone
undoneCmd = (message) => {
    if (raceState.state !== State.ACTIVE && raceState.state !== State.DONE) {
        return;
    }
    if (raceState.entrants.has(message.author.id) && raceState.doneIds.includes(message.author.id)) {
        helpers.doForWholeTeam(raceState, message.author.id, (e) => {
            e.doneTime = 0;
            raceState.doneIds = helpers.arrayRemove(raceState.doneIds, e.message.author.id);
        });
        raceState.state = State.ACTIVE;
        clearTimeout(raceDoneTimeout);
        clearTimeout(raceDoneWarningTimeout);
        message.react(emotes.acknowledge);
    }
}

// !s/!status
statusCmd = (message) => {
    if (raceState.state === State.NO_RACE) {
        message.channel.send("No race currently happening.");

    } else if (raceState.state === State.JOINING) {
        raceString = "**" + gameName + " / " + categoryName + " race is currently open with " + raceState.entrants.size + " entrant"
                + (raceState.entrants.size === 1 ? "" : "s") + ". Type `!race` to join!**\n";

        if (isILRace()) {
            // Show IL race status
            raceString += "*Starting " + helpers.formatPlace(raceState.ilResults.length + 1) + " IL (" + levelName + " - id: " + raceId + ")*\n";
            sortedEntrants = [];
            raceState.entrants.forEach((entrant) => {
                sortedEntrants.push(entrant);
            });
            sortedEntrants.sort((entrant1, entrant2) => raceState.getILScore(entrant2.message.author.id) - raceState.getILScore(entrant1.message.author.id));
            entrantString = (e) => "\t" + (e.ready ? emotes.ready : emotes.notReady) + " " + helpers.username(e.message) + " - " + raceState.getILScore(e.message.author.id) + "\n";
            helpers.forEachWithTeamHandling(sortedEntrants,
                    (individualEntrant) => raceString += entrantString(individualEntrant),
                    (firstOnTeam)       => raceString += "\t**" + firstOnTeam.team + "**\n",
                    (entrantWithTeam)   => raceString += "\t" + entrantString(entrantWithTeam));

        } else {
            // Show full game race status
            entrantString = (e) => "\t" + (e.ready ? emotes.ready : emotes.notReady) + " " + helpers.username(e.message) + "\n";
            entrantsWithNoTeam = [];
            helpers.forEachWithTeamHandling(raceState.entrants,
                    (individualEntrant) => entrantsWithNoTeam.push(individualEntrant),
                    (firstOnTeam)       => raceString += "\t**" + firstOnTeam.team + "**\n",
                    (entrantWithTeam)   => raceString += "\t" + entrantString(entrantWithTeam));
            entrantsWithNoTeam.forEach((entrant) => {
                raceString += entrantString(entrant);
            });
        }
        message.channel.send(raceString);

    } else if (raceState.state === State.ACTIVE || raceState.state === State.DONE) {
        // Say race is done if it is, otherwise say it's in progress and show the time
        raceString = "**" + gameName + " / " + categoryName + " race is "
                + (raceState.state === State.ACTIVE
                        ? "in progress. Current time: " + helpers.formatTime(Date.now() / 1000 - raceState.startTime)
                        : "done!" + (raceState.ffIds.length === raceState.entrants.size ? "" : " Results will be recorded soon."))
                + "**";
        entrantsDone = [];
        entrantsNotDone = [];
        idsNotDone = [];
        entrantsFFd = [];
        teamMap = new Map();
        raceState.entrants.forEach((entrant) => {
            id = entrant.message.author.id;
            teamMap.set(id, entrant.team);
            if (raceState.doneIds.includes(id)) {
                entrantsDone.push(entrant);
            } else if (raceState.ffIds.includes(id)) {
                entrantsFFd.push(entrant);
            } else {
                entrantsNotDone.push(entrant);
                idsNotDone.push(id);
            }
        });

        // Calculate Elo diff
        sortedRacerList = raceState.doneIds.concat(idsNotDone).concat(raceState.ffIds);
        stats = helpers.retrievePlayerStats(sortedRacerList, client.getUserStatsForCategory, gameName, categoryName, teamMap);
        eloDiffs = helpers.calculateEloDiffs(stats, teamMap, sortedRacerList, raceState.ffIds);
        eloDiffStr = (e) => {
            if (idsNotDone.length > 0){
                return "";
            } else {
                eloId = e.team === "" ? e.message.author.id : ("!team " + e.team);
                return "(" + emotes.elo + " " + (eloDiffs.get(eloId) >= 0 ? "+" : "") + (Math.round(eloDiffs.get(eloId) * 100) / 100) + ")";
            }
        };

        // List done entrants
        place = 0;
        helpers.forEachWithTeamHandling(entrantsDone,
            (individualEntrant) => raceString += "\n\t" + helpers.placeEmote(place++) + " " + helpers.username(individualEntrant.message) + " " + eloDiffStr(individualEntrant) + " (" + helpers.formatTime(individualEntrant.doneTime) + ")",
            (firstOnTeam)       => raceString += "\n\t" + helpers.placeEmote(place++) + " **" + firstOnTeam.team + "** (" + helpers.formatTime(firstOnTeam.doneTime) + ")",
            (entrantWithTeam)   => raceString += "\n\t\t" + helpers.username(entrantWithTeam.message) + " " + eloDiffStr(entrantWithTeam));

        // List racers still going
        helpers.forEachWithTeamHandling(entrantsNotDone,
            (individualEntrant) => raceString += "\n\t" + emotes.racing + " " + helpers.username(individualEntrant.message),
            (firstOnTeam)       => raceString += "\n\t" + emotes.racing + " **" + firstOnTeam.team + "**",
            (entrantWithTeam)   => raceString += "\n\t\t" + helpers.username(entrantWithTeam.message));

        // List forfeited entrants
        helpers.forEachWithTeamHandling(entrantsFFd,
            (individualEntrant) => raceString += "\n\t" + emotes.forfeited + " " + helpers.username(individualEntrant.message) + " " + eloDiffStr(individualEntrant),
            (firstOnTeam)       => raceString += "\n\t" + emotes.forfeited + " **" + firstOnTeam.team + "**",
            (entrantWithTeam)   => raceString += "\n\t\t" + helpers.username(entrantWithTeam.message) + " " + eloDiffStr(entrantWithTeam));

        message.channel.send(raceString);
    }
}

// !clearrace
clearRaceCmd = (message) => {
    // Force end of race, unless it's already done
    stopCountDown();
    clearTimeout(raceDoneTimeout);
    clearTimeout(raceDoneWarningTimeout);
    raceState = new RaceState();
    gameName = Object.keys(config.games)[0];
    categoryName = helpers.normalizeCategory(gameName, null);
    levelName = helpers.normalizeLevel(gameName, null);
    raceId = client.getLastRaceID.get().id;
    if (!raceId) {
        raceId = 0;
    }
    raceId++;
    message.channel.send("Clearing race.");
}

// !clearteams
clearTeamsCmd = (message) => {
    raceState.entrants.forEach((entrant) => {
        if (entrant.team !== "") {
            raceState.disbandTeam(entrant.team);
        }
    });
    if (isILRace()) {
        categoryName = "Individual Levels";
    }
    message.channel.send("Clearing teams.");
}

// !me
meCmd = (message) => {
    // Parse game name
    game = message.content.replace(/^!me/i, "").trim();
    if (game === null || game === "") {
        message.channel.send("Usage: `!me <game name>` (e.g. `!me LBP1`)");
        return;
    }
    game = helpers.normalizeGameName(game);
    if (game === null) {
        message.channel.send("The game you specified isn't valid.");
        return;
    }

    showUserStats(message, message.author.id, helpers.username(message));
}

// !runner
runnerCmd = (message) => {
    usage = "Usage: `!runner <id or username> <game name>` (e.g. `!runner RbdJellyfish lbp1`)";

    // Parse game name
    params = message.content.replace(/^!runner/i, "").trim();
    separateName = params.split(" ");
    if (separateName.length < 2) {
        message.channel.send(usage);
        return;
    }
    name = separateName[0];

    game = params.replace(name, "").trim();
    if (game === null || game === "") {
        message.channel.send(usage);
        return;
    }
    game = helpers.normalizeGameName(game);
    if (game === null) {
        message.channel.send("The game you specified isn't valid.");
        return;
    }

    id = name.replace("<@", "").replace(">", "");
    results = client.getIdFromName.all(name);
    if (results.length > 0) {
        id = results[0].user_id;
        name = results[0].user_name;
    }

    showUserStats(message, id, name);
}

showUserStats = (message, userId, username) => {
    stats = client.getUserStatsForGame.all(userId, game);
    if (stats.length > 0) {
        title = "**" + game + "** stats for " + username;
        meString = "";
        ilString = "";
        var maxNumberLength = {races: 1, gold: 1, silver: 1, bronze: 1, ffs: 1, elo: 1};
        stats.forEach((line) => {
            maxNumberLength.races = Math.max(maxNumberLength.races, line.races.toString().length);
            maxNumberLength.gold = Math.max(maxNumberLength.gold, line.gold.toString().length);
            maxNumberLength.silver = Math.max(maxNumberLength.silver, line.silver.toString().length);
            maxNumberLength.bronze = Math.max(maxNumberLength.bronze, line.bronze.toString().length);
            maxNumberLength.ffs = Math.max(maxNumberLength.ffs, line.ffs.toString().length);
            maxNumberLength.elo = Math.max(maxNumberLength.elo, Math.floor(line.elo).toString().length);
        });
        stats.forEach((line) => {
            lineString = "\n    " + emotes.finished + "\u00A0`" + helpers.addSpaces(line.races.toString(), maxNumberLength.races)
                    + "`   " + emotes.firstPlace + "\u00A0`" + helpers.addSpaces(line.gold.toString(), maxNumberLength.gold)
                    + "`   " + emotes.secondPlace + "\u00A0`" + helpers.addSpaces(line.silver.toString(), maxNumberLength.silver)
                    + "`   " + emotes.thirdPlace + "\u00A0`" + helpers.addSpaces(line.bronze.toString(), maxNumberLength.bronze)
                    + "`   " + emotes.forfeited + "\u00A0`" + helpers.addSpaces(line.ffs.toString(), maxNumberLength.ffs)
                    + "`   " + emotes.elo + "\u00A0`" + helpers.addSpaces(Math.floor(line.elo).toString(), maxNumberLength.elo)
                    + "`   " + emotes.racing + "\u00A0`" + helpers.formatTime(line.pb) + "`";
            if (line.category.startsWith("Individual Levels")) {
                ilString += "\n  " + line.category + lineString;
            } else {
                meString += "\n  " + line.category + lineString;
            }
        });
        message.channel.send(title + ilString + meString);
    } else {
        message.channel.send("No stats found; user hasn't done any " + game + " races yet.");
    }
}

// !results
resultsCmd = (message) => {
    raceNum = message.content.replace(/^!results/i, "").trim();
    if (raceNum === "") {
        raceNum = raceId - 1;
    }
    rows = client.getResults.all(raceNum);
    if (rows.length > 0) {
        // Header
        cat = rows[0].category;
        if (cat.startsWith("Individual Levels") && rows[0].level !== null) {
            cat = "IL / " + rows[0].level;
        }
        messageString = "Results for race #" + raceNum + " (" + rows[0].game + " / " + cat + "):";

        // Separate finishes and ffs
        ffd = [];
        done = [];
        rows.forEach((row) => {
            e = { user_name: row.user_name, time: row.time, team: row.team_name };
            if (row.ff) {
                ffd.push(e);
            } else {
                done.push(e);
            }
        });

        // List done entrants
        place = 0;
        helpers.forEachWithTeamHandling(done,
            (individualEntrant) => messageString += "\n\t" + helpers.placeEmote(place++) + " " + individualEntrant.user_name + " (" + helpers.formatTime(individualEntrant.time) + ")",
            (firstOnTeam)       => messageString += "\n\t" + helpers.placeEmote(place++) + " **" + firstOnTeam.team + "** (" + helpers.formatTime(firstOnTeam.time) + ")",
            (entrantWithTeam)   => messageString += "\n\t\t" + entrantWithTeam.user_name);

        // List forfeited entrants
        helpers.forEachWithTeamHandling(ffd,
            (individualEntrant) => messageString += "\n\t" + emotes.forfeited + " " + individualEntrant.user_name,
            (firstOnTeam)       => messageString += "\n\t" + emotes.forfeited + " **" + firstOnTeam.team + "**",
            (entrantWithTeam)   => messageString += "\n\t\t" + entrantWithTeam.user_name);

        message.channel.send(messageString);

    } else {
        message.channel.send("Results not found for race #" + raceNum);
    }
}

// !ilresults
ilResultsCmd = (message) => {
    if (isILRace() && (raceState.state === State.JOINING || raceState.state === State.ACTIVE)) {
        if (raceState.ilResults.length === 0) {
            message.channel.send("No ILs have been finished yet in this series.");
            return;
        }

        // If people do too many ILs, it might break the message limit, so try to split it over multiple messages.
        msgs = [];
        messageString = "**Results for current IL series (listed by race ID):**\n";
        raceState.ilResults.forEach((result, num) => {
            toAdd = "\t#" + result.id + " - " + result.level + " (" + emotes.firstPlace + " " + result.winner + ")\n";
            if (messageString.length + toAdd.length > 2000) {
                msgs.push(messageString);
                messageString = "**Results for current IL series (cont):**\n";
            }
            messageString += toAdd;
        });
        msgs.push(messageString);
        msgs.forEach((msg, count) => {
            setTimeout(() => { message.channel.send(msg); }, 100 + count * 100);
        });
    }
}

// !leaderboard/!elo
leaderboardCmd = (message) => {
    params = message.content.replace(/^!leaderboard/i, "").replace(/^!elo/i, "").trim().split('/');
    if (params.length !== 2) {
        message.channel.send("Usage: `!elo <game name> / <category name>` (e.g. `!elo lbp1 / any% no overlord`)");
        return;
    }

    game = helpers.normalizeGameName(params[0].trim());
    if (game === null) {
        message.channel.send("Unrecognized game name: " + game);
        return;
    }
    category = helpers.normalizeCategory(game, params[1].trim());
    if (category === null) {
        category = params[1].trim();
    }

    rows = client.getLeaderboard.all(game, category, game, category);
    if (rows.length > 0) {
        msgs = [];
        messageString = "**ELO Rankings for " + game + " / " + category + ":**\n";
        rows.forEach((row, num) => {
            toAdd = "\t" + (num + 1) + ". (" + emotes.elo + " " + Math.floor(row.elo) + ") " + row.user_name + "\n";
            if (messageString.length + toAdd.length > 2000) {
                msgs.push(messageString);
                messageString = "**ELO Rankings for " + game + " / " + category + " (cont):**\n";
            }
            messageString += toAdd;
        });
        msgs.push(messageString);
        msgs.forEach((msg, count) => {
            setTimeout(() => { message.channel.send(msg); }, 100 + count * 100);
        });

    } else {
        message.channel.send("No rankings found for " + game + " / " + category + ".");
    }
}

// Sets up a bunch of callbacks that send messages for the countdown
doCountDown = (message) => {
    raceState.state = State.COUNTDOWN;
    message.channel.send("Everyone is ready, gl;hf! " + emotes.raceStarting + " Starting race in 10 seconds...");
    countDownTimeout3 = setTimeout(() => { message.channel.send(emotes.countdown + " 3..."); }, 7000);
    countDownTimeout2 = setTimeout(() => { message.channel.send(emotes.countdown + " 2..."); }, 8000);
    countDownTimeout1 = setTimeout(() => { message.channel.send(emotes.countdown + " 1..."); }, 9000);
    goTimeout = setTimeout(() => {
        message.channel.send(emotes.go + " **Go!!!**");
        raceState.state = State.ACTIVE;
        raceState.startTime = Date.now() / 1000;
    }, 10000);
}

stopCountDown = () => {
    clearTimeout(countDownTimeout1);
    clearTimeout(countDownTimeout2);
    clearTimeout(countDownTimeout3);
    clearTimeout(goTimeout);
}

// Sets up a callback to record the race results
doEndRace = (message) => {
    if (isILRace()) {
        if (raceState.doneIds.length === 0) {
            raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Everyone forfeited. IL not counted."); }, 1000);
        } else {
            raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Race complete (id: " + (raceId-1) + ")! Use `!level` to choose another level, or `!leave` to leave the lobby."); }, 1000);
        }
        recordResults();

        // Handle people that left before the IL was done
        for (let id of raceState.leavingWhenDone) {
            raceState.removeEntrant(id);
        }
        raceState.leavingWhenDone = new Set();

    } else {
        raceState.state = State.DONE;

        // Setup callback to record results in 60 seconds. recordResults() will do nothing if everyone forfeited.
        raceDoneTimeout = setTimeout(() => { recordResults(); }, 60000);
        if (raceState.doneIds.length === 0) {
            raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Everyone forfeited; race results will not be recorded. Clearing race in 1 minute."); }, 1000);
        } else {
            raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Race complete (id: " + raceId + ")! Recording results/clearing race in 1 minute."); }, 1000);
        }
    }
}

// Records the previous race results and resets the race state
recordResults = () => {
    // Don't record the race if everyone forfeited
    if (raceState.doneIds.length === 0) {
        if (isILRace()) {
            newIL();
        } else {
            raceState = new RaceState();
        }
        return;
    }

    // Record race
    level = null;
    if (isILRace()) {
        level = levelName;
    }
    raceState.doneIds.forEach((id) => {
        entrant = raceState.entrants.get(id);
        result = { race_id: `${raceId}`, user_id: `${id}`, user_name: `${helpers.username(entrant.message)}`, game: `${gameName}`, category: `${categoryName}`, level: `${level}`, time: `${entrant.doneTime}`, ff: 0, team_name: `${entrant.team}` };
        client.addResult.run(result);
        roles.giveRoleFromRace(id, gameName, categoryName);
    });
    raceState.ffIds.forEach((id) => {
        entrant = raceState.entrants.get(id);
        result = { race_id: `${raceId}`, user_id: `${id}`, user_name: `${helpers.username(entrant.message)}`, game: `${gameName}`, category: `${categoryName}`, level: `${level}`, time: -1, ff: 1, team_name: `${entrant.team}` };
        client.addResult.run(result);
    });

    // Keep track of teams and IL series results
    teamMap = new Map();
    raceRankings = raceState.doneIds.concat(raceState.ffIds);
    winner = raceState.entrants.get(raceRankings[0]);
    raceState.ilResults.push(new ILResult(raceId, levelName, winner.team === "" ? helpers.username(winner.message) : ("**" + winner.team + "**")));

    points = 0;
    helpers.forEachWithTeamHandling(raceState.entrants, (individualEntrant) => points++, (firstOnTeam) => points++, (entrantWithTeam) => {});

    prevTeam = undefined;
    raceRankings.forEach((id, i) => {
        if (!raceState.ffIds.includes(id) && isILRace()) {
            curTeam = raceState.entrants.get(id).team;
            if (prevTeam === undefined) {
                prevTeam = curTeam;
            }
            if (curTeam === "" || curTeam !== prevTeam) {
                points--;
            }
            raceState.ilScores.set(id, raceState.getILScore(id) + points);
            prevTeam = curTeam;
        }
        teamMap.set(id, raceState.entrants.get(id).team);
    });

    // Update/save stats
    playerStats = helpers.retrievePlayerStats(raceRankings, client.getUserStatsForCategory, gameName, categoryName, teamMap, (id, i) => raceState.ffIds.includes(id), (id, i) => raceState.entrants.get(id).doneTime);
    eloDiffs = helpers.calculateEloDiffs(playerStats, teamMap, raceRankings, raceState.ffIds);
    playerStats.forEach((stat, id) => {
        stat.elo += eloDiffs.get(teamMap.get(id) === "" ? id : ("!team " + teamMap.get(id)));
        client.addUserStat.run(stat);
    });

    raceId++;
    if (isILRace()) {
        newIL();
    } else {
        raceState = new RaceState();
    }
}

newIL = () => {
    raceState.doneIds = [];
    raceState.ffIds = [];
    raceState.entrants.forEach((entrant) => {
        entrant.ready = false;
        entrant.doneTime = 0;
    });
    raceState.state = State.JOINING;
}

isILRace = () => {
    return categoryName.startsWith("Individual Levels");
}

client.login(discordAuth.token);
