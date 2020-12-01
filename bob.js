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
        this.entrants = new Map(); // Maps from user id to their current race state ()
        this.doneEntrants = [];
        this.ffEntrants = [];
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
            team = this.entrants.get(id).team;
            if (team !== "") {
                disbandTeam(team);
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

    // Returns the current IL score of a user
    getILScore(id) {
        if (this.ilScores.has(id)) {
            return this.ilScores.get(id);
        }
        return 0;
    }

    // Resets the team name of all entrants using teamName
    disbandTeam(teamName) {
        for(var entry in this.entrants) {
            if (entry[1].team === teamName) {
                entry[1].team = "";
            }
        }
    }
}

// Represents a race entrant
class Entrant {
    constructor(message) {
        this.message = message;
        this.ready = false;
        this.doneTime = 0;
        this.disqualified = false;
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
        sql.prepare("CREATE TABLE results (race_id INTEGER, user_id TEXT, user_name TEXT, game TEXT, category TEXT, time INTEGER, ff INTEGER, dq INTEGER, level TEXT, team_name TEXT);").run();
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
    client.addResult = sql.prepare("INSERT OR REPLACE INTO results (race_id, user_id, user_name, game, category, time, ff, dq, level, team_name) VALUES (@race_id, @user_id, @user_name, @game, @category, @time, @ff, @dq, @level, @team_name);");

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

    // Don't let kicked people use any commands until there's a new race
    if (raceState.entrants.has(message.author.id) && raceState.entrants.get(message.author.id).disqualified) {
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
\`!game <game name>\` - Sets the game (e.g. \`!game LBP2\`). Default is "LittleBigPlanet".
\`!category <category name>\` - Sets the category. Default is "Any% No Overlord".
\`!team <discord id> [<discord id> ... <team name>]\` - Creates a team of you + the specified users for co-op races (with an optional team name).
\`!leave\` - Leave the race.
\`!ready\` - Indicate that you're ready to start.
\`!unready\` - Indicate that you're not actually ready.

**Mid-race commands**
\`!d\` / \`!done\` - Indicate that you finished.
\`!ud\` / \`!undone\` - Get back in the race if you finished by accident.
\`!f\` / \`!forfeit\` - Drop out of the race.
\`!uf\` / \`!unforfeit\` - Rejoin the race if you forfeited by accident.

**IL race commands**
\`!ilrace\` - Starts a new series of IL races.
\`!level <level name>\` - Sets the next level to race. Also accepts lbp.me links. Default is "Introduction".
\`!luckydip\` - Sets the next level to race to a random lucky dip level.
\`!ilresults\` - Shows the ILs that have been played so far in a series, and the winner of each one.

**Stat commands**
\`!status\` - Shows current race status/entrants.
\`!results raceNum\` - Shows results of the specified race number (e.g. \`!results 2\`).
\`!me <game name>\` - Shows your race statistics for the specified game (e.g. \`!me LBP\` shows your LBP1 stats).
\`!runner <username or id> <game name>\` - Shows someone else's race statistics (e.g. \`!runner RbdJellyfish LBP\` shows RbdJellyfish's LBP1 stats).
\`!elo <game name>/<category name>\` - Shows the ELO leaderboard for the given game/category (e.g. \`!elo lbp/die%\` shows the LBP1 Die% leaderboard).
\`!help\` - Shows this message.

**Other commands**
\`!roles <speedrun.com name>\` - Updates your roles to match races finished + speedrun.com PBs (if you linked your discord account on speedrun.com).
\`!removeroles\` - Removes your runner roles.
\`!nr\` / \`!newrunner\` - Mixes two halves of the names of random LBP runners (that have a full-game run on sr.c) together.
`);
}

modHelpCmd = (message) => {
    message.channel.send(`
**Admin/moderator only (mid-race)**
\`!modhelp\` - Shows this message.
\`!clearrace\` - Resets the bot; forces ending the race without recording any results.
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

    categoryName = "Individual Levels";
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
    }
}

// !game
gameCmd = (message) => {
    if (raceState.state === State.JOINING) {
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

        if (normalized === "Individual Levels") {
            if (!isILRace()) {
                categoryName = normalized;
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
    });
}

// !team
teamCmd = (message) => {
    // Can only run command if you've joined the race and it hasn't started
    if (raceState.state !== State.JOINING || !raceState.entrants.includes(message.author.id)) {
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
            if (params[i].startsWith("<@")) {
                // Skip over team members
                continue;
            }
            teamName = params[i];
            customTeamName = true;
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
        if (!params[i].startsWith("<@")) {
            break;
        }
        discordId = params[i].replace("<@", "").replace(">", "").trim();
        if (!raceState.entrants.includes(discordId)) {
            message.channel.send(helpers.mention(message.author) + ": Cannot create team; all team members must join the race first.");
            return;
        }
        userTeam = raceState.entrants.get(discordId).team;
        if (userTeam !== "" && userTeam !== teamName && userTeam !== prevTeamName) {
            message.channel.send(helpers.mention(message.author) + ": Cannot create team; <@" + discordId + "> is already on another team (" + userTeam + ").");
            return;
        }
        selectedUsers.push(discordId);
    }
    if (selectedUsers.length <= 1) {
        message.channel.send(helpers.mention(message.author) + ": Cannot create team; you must choose teammates.");
        return;
    }

    // Form new team
    if (prevTeamName !== "") {
        raceState.disbandTeam(prevTeamName);
    }
    for (var i = 0; i < selectedUsers.length; i++) {
        raceState.entrants.get(selectedUsers[i]).team = teamName;
    }

    // Send confirmation message
    messageString = helpers.mention(selectedUsers[0]) + " has teamed with ";
    for (var i = 1; i < selectedUsers.length; i++) {
        messageString += (i > 1 ? ", " : "") + helpers.mention(selectedUsers[i])
    }
    messageString += " under the name **" + teamName + "**";
    message.channel.send(messageString);
}

// !ff/!forfeit/!leave/!exit/!unrace
forfeitCmd = (message) => {
    if (!raceState.entrants.has(message.author.id)){
        // Can't leave if you're not in the race, dummy
        return;
    }

    if (raceState.state === State.JOINING) {
        // Leave race completely if the race hasn't started yet
        if (raceState.removeEntrant(message.author.id)) {
            if (raceState.entrants.size === 0) {
                // Close down race if this is the last person leaving
                message.channel.send(helpers.username(message) + " has left the race. Closing race.");
                raceState = new RaceState();
                if (isILRace()) {
                    categoryName = helpers.normalizeCategory(gameName, null);
                }
            } else {
                message.channel.send(helpers.username(message) + " has left the race.");
                if (raceState.entrants.size === 1) {
                    // If only one person is left now, make sure they are marked as unready
                    raceState.entrants.forEach((entrant) => { entrant.ready = false; });
                }
            }
        }

    } else if (raceState.state === State.ACTIVE || raceState.state === State.COUNTDOWN) {
        if (raceState.ffEntrants.includes(message.author.id) || raceState.doneEntrants.includes(message.author.id)) {
            // If this person has already finished the current race, mark them to leave once the race is over
            if (isILRace()) {
                raceState.leavingWhenDone.add(message.author.id);
                message.channel.send(helpers.username(message) + " has left the race.");
            }

        } else {
            // Otherwise mark them as forfeited
            team = raceState.entrants.get(message.author.id).team;
            if (team !== "") {
                raceState.entrants.forEach((entrant) => {
                    if (entrant.team === team) {
                        raceState.ffEntrants.push(entrant.message.author.id);
                    }
                });
                message.channel.send("**" + team + "** has forfeited (use `!unforfeit` to rejoin if this was an accident).");
            } else {
                raceState.ffEntrants.push(message.author.id);
                message.channel.send(helpers.username(message) + " has forfeited (use `!unforfeit` to rejoin if this was an accident).");
            }

            // Check if everyone forfeited
            if (raceState.ffEntrants.length + raceState.doneEntrants.length === raceState.entrants.size) {
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
    if (raceState.state === State.ACTIVE || raceState.state === State.COUNTDOWN || raceState.state === State.DONE) {
        ufPlayer = [];
        team = raceState.entrants.get(message.author.id).team;
        if (team !== "") {
            raceState.entrants.forEach((entrant) => {
                if (entrant.team === team) {
                    ufPlayer.push(entrant.message.author.id);
                }
            });
        } else {
            if (raceState.entrants.has(id) && raceState.ffEntrants.includes(id)) {
                ufPlayer.push(message.author.id);
            }
        }

        if (ufPlayer.length > 0) {
            for(var id in ufPlayer) {
                if (raceState.leavingWhenDone.has(id)) {
                    raceState.leavingWhenDone.delete(id);
                }
                raceState.ffEntrants = helpers.arrayRemove(raceState.ffEntrants, id);
            }
            raceState.state = State.ACTIVE;
            clearTimeout(raceDoneTimeout);
            clearTimeout(raceDoneWarningTimeout);
            message.react(emotes.acknowledge);
        }
    }
}

// !ready
readyCmd = (message) => {
    if (raceState.state === State.JOINING) {
        // Don't allow readying up if only one person has joined.
        if (raceState.entrants.size === 1) {
            if (raceState.entrants.has(message.author.id)) {
                message.channel.send("Need more than one entrant before starting!");
                return;
            }
        }
        if (!raceState.entrantIsReady(message.author.id)) {
            // Mark as ready
            raceState.addEntrant(message);
            raceState.entrants.get(message.author.id).ready = true;
            message.react(emotes.acknowledge);

            // Start countdown if everyone is ready
            everyoneReady = true;
            raceState.entrants.forEach((entrant) => {
                if (!entrant.ready) {
                    everyoneReady = false;
                }
            });
            if (everyoneReady) {
                doCountDown(message);
            }
        }
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
    if (raceState.state === State.ACTIVE) {
        if (raceState.entrants.has(message.author.id) && !raceState.doneEntrants.includes(message.author.id) && !raceState.ffEntrants.includes(message.author.id)) {
            time = message.createdTimestamp / 1000 - raceState.startTime;
            raceState.entrants.get(message.author.id).doneTime = time;
            raceState.doneEntrants.push(message.author.id);

            // Calculate Elo diff
            inProgress = [];
            raceState.entrants.forEach((entrant) => {
                id = entrant.message.author.id;
                if (!raceState.doneEntrants.includes(id) && !raceState.ffEntrants.includes(id)) {
                    inProgress.push(id);
                }
            });
            sortedRacerList = raceState.doneEntrants.concat(inProgress).concat(raceState.ffEntrants);
            stats = helpers.retrievePlayerStats(sortedRacerList, client.getUserStatsForCategory, gameName, categoryName);
            newElos = helpers.calculateElos(stats, sortedRacerList, raceState.ffEntrants);
            eloDiff = newElos.get(message.author.id) - stats.get(message.author.id).elo;

            ilPoints = raceState.entrants.size - raceState.doneEntrants.length + 1;
            message.channel.send(helpers.mention(message.author)
                        + " has finished in "
                        + helpers.formatPlace(raceState.doneEntrants.length)
                        + " place "
                        + (isILRace() ? "(+" + ilPoints + " " + emotes.ilPoints + ") " : "")
                        + ((eloDiff < 0 ? "(" : "(+") + (Math.round(eloDiff * 100) / 100) + " " + emotes.elo + ") ")
                        + "with a time of " + helpers.formatTime(time)) + "! (Use `!undone` if this was a mistake.)";
            if (raceState.ffEntrants.length + raceState.doneEntrants.length === raceState.entrants.size) {
                doEndRace(message);
            }
        }
    } else if (isILRace() && raceState.State === State.JOINING) {
        // Leave the IL race lobby
        forfeitCmd(message);
    }
}

// !ud/!undone
undoneCmd = (message) => {
    if (raceState.state === State.ACTIVE || raceState.state === State.DONE) {
        if (raceState.entrants.has(message.author.id) && raceState.doneEntrants.includes(message.author.id)) {
            raceState.state = State.ACTIVE;
            raceState.entrants.get(message.author.id).doneTime = 0;
            raceState.doneEntrants = helpers.arrayRemove(raceState.doneEntrants, message.author.id);
            clearTimeout(raceDoneTimeout);
            clearTimeout(raceDoneWarningTimeout);
            message.react(emotes.acknowledge);
        }
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
            entrantString = (e) => "\t" + (e.ready ? emotes.ready : emotes.notReady) + " " + helpers.username(e.message) + " - " + emotes.ilPoints + " " + raceState.getILScore(e.message.author.id) + "\n";
            helpers.forEachWithTeamHandling(sortedEntrants,
                    (individualEntrant) => raceString += entrantString(individualEntrant),
                    (firstOnTeam) => raceString += "\t**" + firstOnTeam.team + "**\n",
                    (entrantWithTeam) => raceString += "\t" + entrantString(entrantWithTeam));

        } else {
            // Show full game race status
            entrantString = (e) => "\t" + (entrant.ready ? emotes.ready : emotes.notReady) + " " + helpers.username(entrant.message) + "\n";
            entrantsWithNoTeam = [];
            helpers.forEachWithTeamHandling(raceState.entrants,
                    (individualEntrant) => entrantsWithNoTeam.push(individualEntrant),
                    (firstOnTeam) => raceString += "\t**" + firstOnTeam.team + "**\n",
                    (entrantWithTeam) => raceString += "\t" + entrantString(entrantWithTeam));
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
                        : "done!" + (raceState.ffEntrants.length === raceState.entrants.size ? "" : " Results will be recorded soon."))
                + "**";
        entrantsDone = [];
        entrantsNotDone = [];
        entrantsFFd = [];
        raceState.entrants.forEach((entrant) => {
            if (raceState.doneEntrants.includes(entrant.message.author.id)) {
                entrantsDone.push(entrant);
            } else if (raceState.ffEntrants.includes(entrant.message.author.id)) {
                entrantsFFd.push(entrant);
            } else {
                entrantsNotDone.push(entrant);
            }
        });
        entrantsDone.sort((entrant1, entrant2) => entrant1.doneTime - entrant2.doneTime);

        // List done entrants
        place = 0;
        points = raceState.entrants.size;
        helpers.forEachWithTeamHandling(entrantsDone,
            (individualEntrant) => raceString += "\n\t" + helpers.placeEmote(place++) + " **" + helpers.username(individualEntrant.message) + "** " + (isILRace() ? "(+" + (points--) + " " + emotes.ilPoints + ") " : "") + "(" + helpers.formatTime(individualEntrant.doneTime) + ")",
            (firstOnTeam) => raceString += "\n\t" + helpers.placeEmote(place++) + " **" + firstOnTeam.team + "** (" + helpers.formatTime(firstOnTeam.doneTime) + ")",
            (entrantWithTeam) => raceString += "\n\t\t" + helpers.username(entrantWithTeam.message) + " " + (isILRace() ? "(+" + (points--) + " " + emotes.ilPoints + ") " : ""));

        // List racers still going
        helpers.forEachWithTeamHandling(entrantsNotDone,
            (individualEntrant) => raceString += "\n\t" + emotes.racing + " " + helpers.username(individualEntrant.message),
            (firstOnTeam) => raceString += "\n\t" + emotes.racing + " **" + firstOnTeam.team + "**",
            (entrantWithTeam) => raceString += "\n\t\t" + helpers.username(entrantWithTeam.message));

        // List forfeited/DQ'd entrants
        helpers.forEachWithTeamHandling(entrantsFFd,
            (individualEntrant) => raceString += "\n\t" + emotes.forfeited + " " + helpers.username(entrant.message),
            (firstOnTeam) => raceString += "\n\t" + emotes.forfeited + " **" + entrant.team + "**",
            (entrantWithTeam) => raceString += "\n\t\t" + helpers.username(entrant.message));

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
            if (line.category === "Individual Levels") {
                ilString = "\n  " + line.category + lineString;
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
        if (cat === "Individual Levels" && rows[0].level !== null) {
            cat = "IL / " + rows[0].level;
        }
        messageString = "Results for race #" + raceNum + " (" + rows[0].game + " / " + cat + "):";

        // First list people who finished, but keep track of the forfeits
        ffd = [];
        placeCount = 0;
        rows.forEach((row) => {
            if (row.time < 0) {
                ffd.push(row);
            } else {
                messageString += "\n\t" + helpers.placeEmote(placeCount) + " " + row.user_name + " (" + helpers.formatTime(row.time) + ")";
                placeCount++;
            }
        });

        // Now we can list forfeits
        ffd.forEach((row) => {
            messageString += "\n\t" + emotes.forfeited + " " + row.user_name;
        });
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
        message.channel.send("Usage: `!leaderboard <game name> / <category name>` (e.g. `!leaderboard lbp1 / any% no overlord`)");
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

// Sets up a callback to record the race results
doEndRace = (message) => {
    if (isILRace()) {
        if (raceState.doneEntrants.length === 0) {
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
        if (raceState.doneEntrants.length === 0) {
            raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Everyone forfeited; race results will not be recorded. Clearing race in 1 minute."); }, 1000);
        } else {
            raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Race complete (id: " + raceId + ")! Recording results/clearing race in 1 minute."); }, 1000);
        }
    }
}

// Records the previous race results and resets the race state
recordResults = () => {
    // Don't record the race if everyone forfeited
    if (raceState.doneEntrants.length === 0) {
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
    raceState.doneEntrants.forEach((id) => {
        entrant = raceState.entrants.get(id);
        result = { race_id: `${raceId}`, user_id: `${id}`, user_name: `${helpers.username(entrant.message)}`, game: `${gameName}`, category: `${categoryName}`, time: `${entrant.doneTime}`, ff: 0, dq: 0, level: `${level}` };
        client.addResult.run(result);
        roles.giveRoleFromRace(id, gameName, categoryName);
    });
    raceState.ffEntrants.forEach((id) => {
        entrant = raceState.entrants.get(id);
        result = { race_id: `${raceId}`, user_id: `${id}`, user_name: `${helpers.username(entrant.message)}`, game: `${gameName}`, category: `${categoryName}`, time: -1, ff: 1, dq: `${entrant.disqualified ? 1 : 0}`, level: `${level}` };
        client.addResult.run(result);
    });

    // Update racers' stats
    raceRankings = raceState.doneEntrants.concat(raceState.ffEntrants);
    raceRankings.forEach((id, i) => {
        // Keep track of results for IL series
        if (!raceState.ffEntrants.includes(id) && isILRace()) {
            if (i === 0) {
                raceState.ilResults.push(new ILResult(raceId, levelName, helpers.username(raceState.entrants.get(id).message)))
            }
            raceState.ilScores.set(id, raceState.getILScore(id) + raceState.doneEntrants.length + raceState.ffEntrants.length - i);
        }
    });
    playerStats = helpers.retrievePlayerStats(raceRankings, client.getUserStatsForCategory, gameName, categoryName, (id, i) => raceState.ffEntrants.includes(id), (id, i) => raceState.entrants.get(id).doneTime);
    newElos = helpers.calculateElos(playerStats, raceRankings, raceState.ffEntrants);

    // Update/save stats with new Elos
    playerStats.forEach((stat, id) => {
        stat.elo = newElos.get(id);
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
    raceState.doneEntrants = [];
    raceState.ffEntrants = [];
    raceState.entrants.forEach((entrant) => {
        entrant.ready = false;
        entrant.disqualified = false;
        entrant.doneTime = 0;
    });
    raceState.state = State.JOINING;
}

isILRace = () => {
    return categoryName === "Individual Levels";
}

stopCountDown = () => {
    clearTimeout(countDownTimeout1);
    clearTimeout(countDownTimeout2);
    clearTimeout(countDownTimeout3);
    clearTimeout(goTimeout);
}

client.login(discordAuth.token);
