const config = require("./config.json");
const emotes = require("./emotes.json");
const categories = require("./categories.js");
const Discord = require("discord.js");
const SQLite = require("better-sqlite3");

const client = new Discord.Client();
const sql = new SQLite('./race.sqlite');
var gameName = "LittleBigPlanet";
var categoryName = "Any% No-Overlord";
var prevCategoryName = "Any% No-Overlord"; // Used to save full game category when people do IL races
var levelName = "Introduction";
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
    NO_RACE: 0,
    JOINING: 1,
    COUNTDOWN: 2,
    ACTIVE: 3,
    DONE: 4
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
    }

    // Adds an entrant. Returns true if succesful, returns false if the user has already joined.
    addEntrant(message) {
        if (this.entrants.has(message.author.id)) {
            return false;
        }
        this.entrants.set(message.author.id, new Entrant(message));
        return true;
    }

    // Removes an entrant. Returns true if succesful, returns false if the user isn't an entrant.
    removeEntrant(id) {
        if (this.entrants.has(id)) {
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
}

// Represents a race entrant
class Entrant {
    constructor(message) {
        this.message = message;
        this.ready = false;
        this.doneTime = 0;
        this.disqualified = false;
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
    const resultsTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='results'").get();
    if (!resultsTable['count(*)']) {
        sql.prepare("CREATE TABLE results (race_id INTEGER, user_id TEXT, user_name TEXT, game TEXT, category TEXT, time INTEGER, ff INTEGER, dq INTEGER);").run();
        sql.prepare("CREATE UNIQUE INDEX idx_results_race ON results (race_id, user_id);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    // Setup tables for keeping track of user stats
    const usersTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!usersTable['count(*)']) {
        sql.prepare("CREATE TABLE users (user_id TEXT, game TEXT, category TEXT, races INTEGER, gold INTEGER, silver INTEGER, bronze INTEGER, ffs INTEGER, elo REAL, pb INTEGER);").run();
        sql.prepare("CREATE UNIQUE INDEX idx_users_id ON users (user_id, game, category);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    // Setup SQL queries for setting/retrieving results
    client.getLastRaceID = sql.prepare("SELECT MAX(race_id) AS id FROM results");
    client.getResults = sql.prepare("SELECT * FROM results WHERE race_id = ? ORDER BY time ASC");
    client.addResult = sql.prepare("INSERT OR REPLACE INTO results (race_id, user_id, user_name, game, category, time, ff, dq) VALUES (@race_id, @user_id, @user_name, @game, @category, @time, @ff, @dq);");

    // Setup SQL queries for setting/retrieving user stats
    client.getUserStatsForGame = sql.prepare("SELECT * FROM users WHERE user_id = ? AND game = ? ORDER BY category ASC");
    client.getUserStatsForCategory = sql.prepare("SELECT * FROM users WHERE user_id = ? AND game = ? AND category = ?");
    client.addUserStat = sql.prepare("INSERT OR REPLACE INTO users (user_id, game, category, races, gold, silver, bronze, ffs, elo, pb) "
                                   + "VALUES (@user_id, @game, @category, @races, @gold, @silver, @bronze, @ffs, @elo, @pb);");

    // Set race ID to highest recorded race ID + 1
    raceId = client.getLastRaceID.get().id;
    if (!raceId) {
        raceId = 0;
    }
    raceId += 1;

    console.log("Ready! " + raceId);
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
    if (message.guild) {
        if (message.content.startsWith("!race") ||
                message.content.startsWith("!join"))
            raceCmd(message);
        
        else if (message.content.startsWith("!ilrace"))
            ilRaceCmd(message);

        else if (message.content.startsWith("!game"))
            gameCmd(message);

        else if (message.content.startsWith("!category"))
            categoryCmd(message);

        else if (message.content.startsWith("!level"))
            levelCmd(message);

        else if (message.content.startsWith("!exit") ||
                message.content.startsWith("!unrace") ||
                message.content.startsWith("!leave") ||
                message.content.startsWith("!quit") ||
                message.content.startsWith("!f"))
            forfeitCmd(message);
        
        else if (message.content.startsWith("!ready"))
            readyCmd(message);
        
        else if (message.content.startsWith("!unready"))
            unreadyCmd(message);

        else if (message.content.startsWith("!d"))
            doneCmd(message);

        else if (message.content.startsWith("!ud") ||
                message.content.startsWith("!undone"))
            undoneCmd(message);

        else if (message.content.startsWith("!uf") ||
                message.content.startsWith("!unforfeit"))
            unforfeitCmd(message);
        
        // Admin/Mod only commands
        else if (message.member.roles.find("name", "Admin") || message.member.roles.find("name", "Moderator")) {
            if (message.content.startsWith("!kick"))
                kickCmd(message);

            else if (message.content.startsWith("!clearrace"))
                clearRaceCmd(message);
        }
    }
    
    // Commands available anywhere
    if (message.content.startsWith("!help") ||
            message.content.startsWith("!commands"))
        helpCmd(message);

    else if (message.content.startsWith("!me")) 
        meCmd(message);

    else if (message.content.startsWith("!results"))
        resultsCmd(message);

    else if (message.content.startsWith("!ilresults"))
        ilResultsCmd(message);

    else if (message.content.startsWith("!s")) 
        statusCmd(message);
});

client.on('error', console.error);

// !help/!commands
helpCmd = (message) => {
    message.channel.send(`
**Pre-race commands**
\`!race\` - Starts a new full-game race, or joins the current open race if someone already started one.
\`!game <game name>\` - Sets the game (e.g. \`!game LBP2\`). Default is "LittleBigPlanet".
\`!category <category name>\` - Sets the category. Default is "Any% No-Overlord".
\`!exit\` - Leave the race.
\`!ready\` - Indicate that you're ready to start.
\`!unready\` - Indicate that you're not actually ready.
        
**Mid-race commands**
\`!d\` / \`!done\` - Indicate that you finished.
\`!ud\` / \`!undone\` - Get back in the race if you finished by accident.
\`!f\` / \`!forfeit\` - Drop out of the race.
\`!uf\` / \`!unforfeit\` - Rejoin the race if you forfeited by accident.

**IL race commands**
\`!ilrace\` - Starts a new series of IL races.
\`!level <level name>\` - Sets the next level to race. Default is "Introduction".
\`!ilresults\` - Shows the ILs that have been played so far in a series, and the winner of each one.

**Stat commands**
\`!status\` - Shows current race status/entrants.
\`!me <game name>\` - Shows your race statistics for the specified game (e.g. \`!me LBP\` shows your LBP1 stats).
\`!results raceNum\` - Shows results of the specified race number (e.g. \`!results 2\`).
\`!help\` - Shows this message.

**Admin/moderator only**
\`!kick @user\` - Kicks someone from the race (in case they're afk or something).
\`!clearrace\` - Resets the bot; forces ending the race without recording any results.
`);}

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
        message.channel.send(
                mention(message.author) + 
                " has started a new race! Use `!race` to join; use `!game` and `!category` to setup the race further (currently " 
                + gameName 
                + " / "
                + categoryName
                + ").");
        raceState.state = State.JOINING;

    } else if (raceState.state === State.JOINING) {
        // Join existing race
        if (raceState.addEntrant(message)) {
            message.react(emotes.bingo);
        }

    } else if (raceState.state === State.COUNTDOWN || raceState.state === State.ACTIVE) {
        // Can't join race that already started
        message.author.send("Can't join because there's a race already in progress!");
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
        message.channel.send(mention(message.author) + " has started a new IL race! Use `!race` to join; use `!game` and `!level` to setup the race further (currently " + gameName + " / " + levelName + ").");
        raceState.state = State.JOINING;

    } else if (raceState.state === State.JOINING) {
        // Join existing race
        if (raceState.addEntrant(message)) {
            message.react(emotes.bingo);
        }

    } else if (raceState.state === State.COUNTDOWN || raceState.state === State.ACTIVE) {
        // Can't join race that already started
        message.author.send("Can't join because there's a race already in progress!");
    }
}

// !game
gameCmd = (message) => {
    if (raceState.state === State.JOINING) {
        game = message.content.replace("!game", "").trim();
        word = isILRace() ? "level" : "category";
        name = isILRace() ? levelName : categoryName;

        if (game === null || game !== "") {
            message.channel.send("Game / " + word + " is currently set to " + gameName + " / " + name + ". Set the game using: `!game <game name>`");
            return;
        }

        game = categories.normalizeGameName(game);
        if (game === null) {
            message.channel.send("Specified game name was not a valid LBP game, try something else.");
            return;
        }

        if (gameName !== game) {
            gameName = game;
            if (isILRace()) {
                levelName = (gameName === "LittleBigPlanet Karting" ? "Karting Lessons" : "Introduction");
            }
            message.channel.send("Game / " + word + " updated to " + gameName + " / " + name + ".");
        }
    }
}

// !category
categoryCmd = (message) => {
    if (raceState.state === State.JOINING) {
        category = message.content.replace("!category", "").trim();
        if (category === null || category === "") {
            if (isILRace()) {
                message.channel.send("IL race is currently in progress. Current game / level is set to " + gameName + " / " + categoryName + ".");
            } else {
                message.channel.send("Game / category is currently set to "  + gameName + " / " + categoryName + ". Set the category using: `!category <category name>`");
            }
            return;
        }

        normalized = categories.normalizeCategory(gameName, category);
        if (normalized === null) {
            if (isILRace()) {
                message.channel.send("Switching from IL race to full-game race (" + gameName + " / " + category + "). (This doesn't seem to be an official category, though; did you mean something else?)");
            } else {
                message.channel.send("Category updated to " + category + ". (This doesn't seem to be an official category, though; did you mean something else?)");
            }
            categoryName = category;
            prevCategoryName = category;
            return;
        }

        if (normalized === "Individual Levels") {
            if (!isILRace()) {
                categoryName = normalized;
                message.channel.send("Switched to IL race. Use `!race` to join; use `!game` and `!level` to setup the race further (currently " + gameName + " / " + levelName + ").");
            }
            return;
        }

        if (normalized === "An3%" || normalized === "An7%") {
            gameName = "LittleBigPlanet";
        }

        if (isILRace()) {
            message.channel.send("Switching from IL race to full-game race (" + gameName + " / " + normalized + ").");
        } else {
            message.channel.send("Category updated to " + normalized + ".");
        }
        categoryName = normalized;
        prevCategoryName = normalized;
    }
}

// !level
levelCmd = (message) => {
    if (isILRace() && raceState.state === State.JOINING) {
        level = message.content.replace("!level", "").trim();
        if (level === null || level === "") {
            message.channel.send("Game / level is currently set to "
                    + gameName
                    + " / "
                    + levelName
                    + ". Set the level using: `!level <level name>`");
            return;
        }

        normalized = categories.normalizeLevel(gameName, level);
        if (normalized === null) {
            message.channel.send("\"" + level + "\" is not a level in " + gameName + ".");
            return;
        }

        levelName = normalized;
        message.channel.send("Level updated to " + levelName + ".");
    }
}

// !ff/!forfeit/!leave/!exit/!unrace
forfeitCmd = (message) => {
    if (raceState.state === State.JOINING) {
        // Leave race completely if the race hasn't started yet
        if (raceState.removeEntrant(message.author.id)) {
            if (raceState.entrants.size === 0) {
                // Close down race if this is the last person leaving
                message.channel.send(username(message) + " has left the race. Closing race.");
                raceState = new RaceState();
                categoryName = prevCategoryName;
            } else {
                message.channel.send(username(message) + " has left the race.");
                if (raceState.entrants.size === 1) {
                    // If only one person is left now, make sure they are marked as unready
                    raceState.entrants.forEach((entrant) => { entrant.ready = false; });
                }
            }
        }

    } else if (raceState.state === State.ACTIVE || raceState.state === State.COUNTDOWN) {
        // Only mark as forfeited if the race is in progress
        if (raceState.entrants.has(message.author.id) && !raceState.ffEntrants.includes(message.author.id) && !raceState.doneEntrants.includes(message.author.id)) {
            raceState.ffEntrants.push(message.author.id);
            message.channel.send(username(message) + " has forfeited (use `!unforfeit` to rejoin if this was an accident).");
            if (raceState.ffEntrants.length + raceState.doneEntrants.length === raceState.entrants.size) {
                if (raceState.state === State.COUNTDOWN) {
                    // Everyone forfeited during the countdown
                    clearTimeout(countDownTimeout1);
                    clearTimeout(countDownTimeout2);
                    clearTimeout(countDownTimeout3);
                    clearTimeout(goTimeout);
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
        if (raceState.entrants.has(message.author.id) && raceState.ffEntrants.includes(message.author.id)) {
            raceState.state = State.ACTIVE;
            raceState.ffEntrants = arrayRemove(raceState.ffEntrants, message.author.id);
            clearTimeout(raceDoneTimeout);
            clearTimeout(raceDoneWarningTimeout);
            message.react(emotes.bingo);
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
            message.react(emotes.bingo);

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
            message.react(emotes.bingo);

            // If someone unready'd during countdown, stop the countdown
            if (raceState.state === State.COUNTDOWN) {
                raceState.state = State.JOINING;
                clearTimeout(countDownTimeout1);
                clearTimeout(countDownTimeout2);
                clearTimeout(countDownTimeout3);
                clearTimeout(goTimeout);
                message.channel.send(username(message) + " isn't ready; stopping countdown.");
            }
        }
    }
}

// !d/!done
doneCmd = (message) => {
    if (raceState.state === State.ACTIVE) {
        if (raceState.entrants.has(message.author.id) && !raceState.doneEntrants.includes(message.author.id) && !raceState.ffEntrants.includes(message.author.id)) {
            time = Date.now() / 1000 - raceState.startTime;
            raceState.entrants.get(message.author.id).doneTime = time;
            raceState.doneEntrants.push(message.author.id);
            points = raceState.entrants.size - raceState.doneEntrants.length + 1;
            message.channel.send(
                    mention(message.author)
                        + " has finished in "
                        + formatPlace(raceState.doneEntrants.length)
                        + " place "
                        + (isILRace() ? "(+" + points + " point" + (points === 1 ? "" : "s") + ") " : "")
                        + "with a time of " + formatTime(time)) + "! (Use `!undone` if this was a mistake.)";
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
            raceState.doneEntrants = arrayRemove(raceState.doneEntrants, message.author.id);
            clearTimeout(raceDoneTimeout);
            clearTimeout(raceDoneWarningTimeout);
            message.react(emotes.bingo);
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
            raceString += "*Starting " + formatPlace(raceState.ilResults.length + 1) + " IL (" + levelName + " - id: " + raceId + ")*\n";
        }
        raceState.entrants.forEach((entrant) => {
            if (entrant.ready) {
                raceString += "\t:white_check_mark: ";
            } else {
                raceString += "\t:small_orange_diamond: ";
            }
            raceString += username(entrant.message) + (isILRace() ? " - " + raceState.getILScore(entrant.message.author.id) : "") + "\n";
        });
        message.channel.send(raceString);

    } else if (raceState.state === State.ACTIVE || raceState.state === State.DONE) {
        // Say race is done if it is, otherwise say it's in progress and show the time
        raceString = "**" + gameName + " / " + categoryName + " race is "
                + (raceState.state === State.ACTIVE 
                        ? "in progress. Current time: " + formatTime(Date.now() / 1000 - raceState.startTime)
                        : "done!" + (raceState.ffEntrants.length === raceState.entrants.size ? "" : "Results will be recorded soon."))
                + "**\n";

        // List done entrants
        raceState.doneEntrants.forEach((id, i) => {
            entrant = raceState.entrants.get(id);
            if (i === 0) {
                raceString += "\t:first_place: ";
            } else if (i === 1) {
                raceString += "\t:second_place: ";
            } else if (i === 2) {
                raceString += "\t:third_place: ";
            } else {
                raceString += "\t:checkered_flag: ";
            }
            points = raceState.entrants.size - i;
            raceString += "**" + username(entrant.message) + "** "
                    + (isILRace() ? "(+" + points + " point" + (points === 1 ? "s" : "") + ")" : "")
                    + " (" + formatTime(entrant.doneTime) + ")\n";
        });

        //  List racers still going
        raceState.entrants.forEach((entrant) => {
            if (!raceState.doneEntrants.includes(entrant.message.author.id) && !raceState.ffEntrants.includes(entrant.message.author.id)) {
                raceString += "\t:stopwatch: " + username(entrant.message) + "\n";
            }
        });

        //  List forfeited/DQ'd entrants
        raceState.ffEntrants.forEach((id) => {
            entrant = raceState.entrants.get(id);
            raceString += "\t:x: " + username(entrant.message) + "\n";
        });

        message.channel.send(raceString);
    }
}

// !kick
kickCmd = (message) => {
    id = message.content.replace("!kick <@", "").replace(">", "").trim();

    if (raceState.state === State.JOINING) {
        // Just remove user from race
        raceState.entrants.delete(id);
        if (raceState.entrants.size === 0) {
            // Close down race if this was the last person
            raceState = new RaceState();
        } else if (raceState.entrants.size === 1) {
            // If only one person is left now, make sure they are marked as unready
            raceState.entrants.forEach((entrant) => { entrant.ready = false; });
        }
        message.react(emotes.bingo);

    } else if (raceState.state === State.ACTIVE || raceState.state === State.COUNTDOWN) {
        // If race is in progress, auto-forfeit them
        if (raceState.entrants.has(id)) {
            if (raceState.doneEntrants.includes(id)) {
                raceState.entrants.get(id).doneTime = 0;
                arrayRemove(raceState.doneEntrants, id);
            }
            if (!raceState.ffEntrants.includes(id)) {
                raceState.ffEntrants.push(id);
            }
            raceState.entrants.get(id).disqualified = true;
            if (raceState.ffEntrants.length + raceState.doneEntrants.length === raceState.entrants.size) {
                doEndRace(message);
            }
            message.react(emotes.bingo);
        }
    }
}

// !clearrace
clearRaceCmd = (message) => {
    // Force end of race, unless it's already done
    clearTimeout(countDownTimeout1);
    clearTimeout(countDownTimeout2);
    clearTimeout(countDownTimeout3);
    clearTimeout(goTimeout);
    clearTimeout(raceDoneTimeout);
    clearTimeout(raceDoneWarningTimeout);
    raceState = new RaceState();
    gameName = "LittleBigPlanet";
    categoryName = "Any% No-Overlord";
    prevCategoryName = "Any% No-Overlord";
    levelName = "Introduction";
    raceId = client.getLastRaceID.get().id;
    if (!raceId) {
        raceId = 0;
    }
    raceId += 1;
    message.channel.send("Clearing race.");
}

// !me
meCmd = (message) => {
    // Parse game name
    game = message.content.replace("!me", "").trim();
    if (game === null || game === "") {
        message.channel.send("Usage: `!me <game name>` (e.g. `!me LBP1`)");
        return;
    }
    game = categories.normalizeGameName(game);
    if (game === null) {
        message.channel.send("The game you specified isn't an LBP game.");
        return;
    }

    // Show stats
    stats = client.getUserStatsForGame.all(message.author.id, game);
    if (stats.length > 0) {
        meString = "**" + game + "**\n";
        stats.forEach((line) => {
            meString += "  " + line.category + "\n "
                    + "   :checkered_flag: " + line.races
                    + "   :first_place: " + line.gold
                    + "   :second_place: " + line.silver
                    + "   :third_place: " + line.bronze
                    + "   :x: " + line.ffs
                    + "   " + emotes.ppjSmug + " " + Math.floor(line.elo)
                    + "   :stopwatch: " + (line.pb > 0 ? formatTime(line.pb) : "--:--:--")
                    + "\n";
        });
        message.channel.send(meString);
    } else {
        message.channel.send("No stats found; you haven't done any races in " + game + " yet.");
    }
}

// !results
resultsCmd = (message) => {
    raceNum = message.content.replace("!results ", "").trim();
    rows = client.getResults.all(raceNum);
    if (rows.length > 0) {
        // Header
        messageString = "Results for race #" + raceNum + " (" + rows[0].game + " / " + rows[0].category + "): \n";
        
        // First list people who finished, but keep track of the forfeits
        ffd = [];
        placeCount = 0;
        rows.forEach((row) => {
            if (row.time < 0) {
                ffd.push(row);
            } else {
                if (placeCount === 0) {
                    messageString += "\t:first_place: ";
                } else if (placeCount === 1) {
                    messageString += "\t:second_place: ";
                } else if (placeCount === 2) {
                    messageString += "\t:third_place: ";
                } else {
                    messageString += "\t:checkered_flag: ";
                }
                messageString += row.user_name + " (" + formatTime(row.time) + ")\n";
                placeCount += 1;
            }
        });

        // Now we can list forfeits
        ffd.forEach((row) => {
            messageString += "\t:x: " + row.user_name + "\n";
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
            toAdd = "\t#" + result.id + " - " + result.level + " (:first_place: " + result.winner + ")\n";
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

// Sets up a bunch of callbacks that send messages for the countdown
doCountDown = (message) => {
    raceState.state = State.COUNTDOWN;
    message.channel.send("Everyone is ready, gl;hf! " + emotes.ppjWink + " Starting race in 10 seconds...");
    countDownTimeout3 = setTimeout(() => { message.channel.send(emotes.ppjE + " 3..."); }, 7000);
    countDownTimeout2 = setTimeout(() => { message.channel.send(emotes.ppjE + " 2..."); }, 8000);
    countDownTimeout1 = setTimeout(() => { message.channel.send(emotes.ppjE + " 1..."); }, 9000);
    goTimeout = setTimeout(() => {
        message.channel.send(emotes.ppjSmug + " **Go!!!**");
        raceState.state = State.ACTIVE;
        raceState.startTime = Date.now() / 1000;
    }, 10000);
}

// Sets up a callback to record the race results
doEndRace = (message) => {
    if (isILRace()) {
        recordResults();
        raceDoneWarningTimeout = setTimeout(() => { message.channel.send("Race complete (id: " + (raceId-1) + ")! Use `!level` to choose another level, or `!leave` to leave the lobby."); }, 1000);
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
    raceState.doneEntrants.forEach((id) => {
        entrant = raceState.entrants.get(id);
        result = { race_id: `${raceId}`, user_id: `${id}`, user_name: `${username(entrant.message)}`, game: `${gameName}`, category: `${categoryName}`, time: `${entrant.doneTime}`, ff: 0, dq: 0 };
        client.addResult.run(result);
    });
    raceState.ffEntrants.forEach((id) => {
        entrant = raceState.entrants.get(id);
        result = { race_id: `${raceId}`, user_id: `${id}`, user_name: `${username(entrant.message)}`, game: `${gameName}`, category: `${categoryName}`, time: -1, ff: 1, dq: `${entrant.disqualified ? 1 : 0}` };
        client.addResult.run(result);
    });

    // Update racers' stats
    playerStats = new Map();
    newElos = new Map();
    raceRankings = raceState.doneEntrants.concat(raceState.ffEntrants);
    raceRankings.forEach((id, i) => {
        statObj = client.getUserStatsForCategory.get(id, gameName, categoryName);
        if (!statObj) {
            statObj = { user_id: `${id}`, game: `${gameName}`, category: `${categoryName}`, races: 0, gold: 0, silver: 0, bronze: 0, ffs: 0, elo: 500, pb: -1 };
        }
        newElos.set(id, statObj.elo);

        // Update simple stats while we're iterating through these; need all ELOs to calculate new ones though, so we'll do that in a bit
        statObj.races++;
        if (raceState.ffEntrants.includes(id)) {
            statObj.ffs++;
        } else {
            if (i === 0) {
                statObj.gold++;
                if (isILRace()) {
                    raceState.ilResults.push(new ILResult(raceId, levelName, username(raceState.entrants.get(id).message)))
                }
            } else if (i === 1) {
                statObj.silver++;
            } else if (i === 2) {
                statObj.bronze++;
            }

            if (isILRace()) {
                raceState.ilScores.set(id, raceState.getILScore(id) + raceState.doneEntrants.length + raceState.ffEntrants.length - i);
            } else {
                if (statObj.pb === -1 || raceState.entrants.get(id).doneTime < statObj.pb) {
                    statObj.pb = raceState.entrants.get(id).doneTime;
                }
            }
        }
        playerStats.set(id, statObj);
    });

    // Calculate new ELOs by treating each pair of racers in the race as a 1v1 matchup.
    // See https://en.wikipedia.org/wiki/Elo_rating_system
    raceRankings.forEach((id1, p1Place) => {
        actualScore = 0;
        expectedScore = 0;
        raceRankings.forEach((id2, p2Place) => {
            // Don't compare the player against themselves
            if (id1 === id2) {
                return;
            }
            
            if (raceState.ffEntrants.includes(id1)) {
                if (raceState.ffEntrants.includes(id2)) {
                    // If both players forfeited, count them as tied
                    actualScore += 0.5;
                } else {
                    actualScore += 0.05;
                }
            } else if (p1Place < p2Place) {
                // Ahead of opponent, count as win
                actualScore += 1;
            } else {
                // Weigh losses a bit less than wins
                actualScore += 0.15;
            }
            expectedScore += 1.0 / (1 + Math.pow(10, (playerStats.get(id2).elo - playerStats.get(id1).elo) / 400));
        });

        newElos.set(id1, playerStats.get(id1).elo + 32 * (actualScore - expectedScore));
    });

    // Update/save stats with new ELOs
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

// Gets a user's username string (unless it's FireThieff, then it returns "bean")
username = (message) => {
    if (message.author.id === "159245797328814081") {
        return "bean";
    }
    return message.member.displayName;
}

// Gets a formatted string for @ing a user
mention  = (user) => {
    return "<@" + user.id + ">"; 
}

// Formats a time in seconds in H:mm:ss
formatTime = (time) => {
    var hrs = Math.floor(time / 3600);
    var min = Math.floor((time - (hrs * 3600)) / 60);
    var sec = time - (hrs * 3600) - (min * 60);
    sec = Math.round(sec * 100) / 100;

    var result = (hrs < 10 ? "0" + hrs : hrs);
    result += ":" + (min < 10 ? "0" + min : min);
    result += ":" + (sec < 10 ? "0" + sec : sec);
    return result;
}

// Converts a number to its place, e.g. 1 -> 1st, 2 -> 2nd, etc.
formatPlace = (place) => {
    placeDigit = place % 10;
    if (placeDigit === 1) {
        return place + "st";
    } else if (placeDigit === 2) {
        return place + "nd";
    } else if (placeDigit === 3) {
        return place + "rd";
    } else {
        return place + "th";
    }
}

// Helper for removing an object (value) from an array (arr)
arrayRemove = (arr, value) => {
    return arr.filter(function(element){
        return element != value;
    });
}

// Returns true if there is an IL race series in progress
isILRace = () => {
    return categoryName === "Individual Levels";
}

client.login(config.token);