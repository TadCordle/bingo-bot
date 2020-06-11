const categories = require('./categories.js');
const emotes = require('./emotes.json');
const https = require('https');

var exports = module.exports = {};
var apiCallTimestamp = Date.now();
var autoRefreshTimeout;

var recursiveUpdating = true;

const gameIDs = {
    "LittleBigPlanet": "369pp31l",
    "LittleBigPlanet PSP": "pd0n821e",
    "Sackboy's Prehistoric Moves": "4d704r17",
    "LittleBigPlanet 2": "pdvzzk6w",
    "LittleBigPlanet PS Vita": "369vz81l",
    "LittleBigPlanet Karting": "pd0n531e",
    "LittleBigPlanet 3": "k6qw8z6g"
};

const fullGameCategoriesThatAreActuallyILs = [
    "824xr8md",
    "9d8pgl6k"
];

exports.init = (c, s, l) => {
    client = c;
    sql = s;
    log = l;
    guild = client.guilds.cache.get('129652811754504192');
    roles = {
        "369pp31l": guild.roles.cache.get("716015233256390696"),
        "pd0n821e": guild.roles.cache.get("716015332040507503"),
        "4d704r17": guild.roles.cache.get("716015421878435891"),
        "pdvzzk6w": guild.roles.cache.get("716015284183367701"),
        "369vz81l": guild.roles.cache.get("716015465024979085"),
        "pd0n531e": guild.roles.cache.get("716015510797680741"),
        "k6qw8z6g": guild.roles.cache.get("716015547984117872"),
        "wr": guild.roles.cache.get("716014433121337504")
    };
    if (Object.values(roles).includes(undefined)) {
        sendError(message, "Couldn't find all roles.");
        process.exit(1);
    }

    // Setup tables for keeping track of people's runs on sr.c
    if (!sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='runs';").get()['count(*)']) {
        sql.prepare("CREATE TABLE runs (game_id TEXT, category_id TEXT, username TEXT, il BOOL, wr BOOL, placeholder BOOL);").run();
        sql.prepare("CREATE UNIQUE INDEX idx_runs_run ON runs (category_id, username);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    // Setup tables for keeping track of discord names
    if (!sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='discord';").get()['count(*)']) {
        sql.prepare("CREATE TABLE discord (username TEXT PRIMARY KEY, id TEXT, auto BOOL);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    // Setup SQL queries for setting/retrieving runs
    client.getRunCount = sql.prepare("SELECT count(*) FROM runs;");
    client.getGameRuns = sql.prepare("SELECT * FROM runs WHERE game_id = ?;");
    client.getCategoryRuns = sql.prepare("SELECT * FROM runs WHERE category_id = ?;");
    client.getUserRunCount = sql.prepare("SELECT count(*) FROM runs WHERE username = ?;");
    client.getGameCategories = sql.prepare("SELECT DISTINCT category_id, il FROM runs WHERE game_id = ?;");
    client.getCategories = sql.prepare("SELECT DISTINCT category_id, game_id, il FROM runs;");
    client.getUserGames = sql.prepare("SELECT DISTINCT game_id FROM runs WHERE username = ?;");
    client.getUserWRCount = sql.prepare("SELECT count(*) FROM runs WHERE wr = 1 AND username = ?;");
    client.addRun = sql.prepare("INSERT INTO runs (game_id, category_id, username, il, wr, placeholder) VALUES (@game_id, @category_id, @username, @il, @wr, @placeholder);");
    client.deleteRun = sql.prepare("DELETE FROM runs WHERE category_id = ? AND username = ?;");
    client.deletePlaceholder = sql.prepare("DELETE FROM runs WHERE category_id = ? AND placeholder = 1;");

    // Setup SQL queries for setting/retrieving user discord data
    client.getUser = sql.prepare("SELECT * FROM discord WHERE username = ?;");
    client.getAutoConnectedUsers = sql.prepare("SELECT * FROM discord WHERE auto = 1;");
    client.addUser = sql.prepare("INSERT OR REPLACE INTO discord (username, id, auto) VALUES (@username, @id, @auto);");
    client.deleteUser = sql.prepare("DELETE FROM discord WHERE username = ?;");

    autoRefreshTimeout = setTimeout(getUsers, 86400000 * Math.ceil(Date.now() / 86400000) - Date.now() + 1);
}

exports.roleCmds = (lowerMessage, message) => {
    // Role commands (available anywhere)
    if (lowerMessage.startsWith("!roles reload categories"))
        reloadCategoriesCmd(message);
    else if (lowerMessage.startsWith("!roles reload leaderboards"))
        reloadLeaderboardCmd(message);
    else if (lowerMessage.startsWith("!roles autoconnect"))
        autoConnectCmd(message);
    else if (lowerMessage.startsWith("!roles reload all"))
        reloadAllCmd(message);
    else if (lowerMessage.startsWith("!roles connect"))
        connectCmd(message);
    else if (lowerMessage.startsWith("!roles disconnect"))
        disconnectCmd(message);
}

// !roles reload categories
reloadCategoriesCmd = (message) => {
    getCategories(message, recursiveUpdating, () => {
        message.channel.send("Updated category data.");
    });
}

// !roles reload leaderboards
reloadLeaderboardsCmd = (message) => {
    if (client.getRunCount['count(*)'] === 0) {
        message.channel.send("No category data found, try running `!roles reload categories` first.");
        return;
    }

    game = message.content.replace(/^!roles reload leaderboards/i, "").trim();

    if (/^all$/i.test(game)) {
        if (!userIsAdmin(message)) {
            message.channel.send("You are not a mod/admin.");
            return;
        }
        getUsers(message, () => {
            message.channel.send("Updated leaderboard data.");
        });
    } else {
        game = categories.normalizeGameName(game);
        if (game === null) {
            message.channel.send("Specified game name was not a valid LBP game, try something else.");
            return;
        }
        getUsersFromGame(message, gameIDs[game], () => {
            message.channel.send("Updated leaderboard data for " + game + ".");
        });
    }
}

// !roles autoconnect
autoConnectCmd = (message) => {
    username = message.content.replace(/^!roles autoconnect/i, "").trim();

    // Make sure argument is a valid discord username
    if (/[ !#$%&'()*+,:;=?@[\]`"{}]|^$/.test(username)) {
        message.channel.send("Usage: `!roles autoconnect <sr.c name>` / `all`");
        return;
    }
    if (!client.getUserRunCount.get(username)["count(*)"]) {
        message.channel.send("`" + username + "` is not on any LBP leaderboards. Use `!roles reload leaderboard <game name>` to reload a leaderboard.");
        return;
    }

    if (/^all$/i.test(username)) {
        if (!userIsAdmin(message)) {
            message.channel.send("You are not a mod/admin.");
            return;
        }
        autoConnectAll(message);
        return;
    }

    getDiscordDataFromUserPage(message, username, (success, tag) => {
        if (success) {
            message.channel.send("Updated `" + username + "`'s discord account to `" + tag + "`.");
            return;
        }
        user = client.getUser.get(username);
        if (user && user.auto === 0) {
            client.addUser.run({ username: username, id: user.id, auto: 1 });
            message.channel.send("Activated auto connect mode but failed to connect discord account.");
        } else {
            message.channel.send("Failed to connect discord account.");
        }
    });
}

// !roles reload all
reloadAllCmd = (message) => {
    if (!userIsAdmin(message)) {
        message.channel.send("You are not a mod/admin.");
        return;
    }

    getCategories(message, false, () => {
        getUsers(message, () => {
            autoConnectAll(message);
        });
    });
}

// !roles connect
connectCmd = (message) => {
    username = message.content.replace(/^!roles connect/i, "").trim();
    if (/[ !#$%&'()*+,:;=?@[\]`"{}]|^(auto)?$/i.test(username)) {
        message.channel.send("Usage: `!roles connect <sr.c name>`");
        return;
    }
    if (!client.getUserRunCount.get(username)["count(*)"]) {
        message.channel.send("`" + username + "` is not on any LBP leaderboards. Use `!roles reload leaderboard <game name>` to reload a leaderboard.");
        return;
    }

    previousUser = guild.members.cache.get(client.getUser.get(username).id);
    if (updateRoles(message, username, message.author.username, message.author.discriminator, false)) {
        message.channel.send("Updated `" + username + "`'s discord account to <@" + message.author.id + ">.");
        if (!message.guild && (!previousUser || message.author.id !== previousUser.id)) {
            log("Updated " + username + "'s discord account to " + message.author.tag + ".");
            previousUser.createDM();
            previousUser.dmChannel.send("Updated `" + username + "`'s discord account to `" + message.author.tag + "`.");
        }
    } else {
        message.channel.send("Failed to connect discord account.");
    }
}

// !roles disconnect
disconnectCmd = (message) => {
    username = message.content.replace(/^!roles disconnect/i, "").trim();
    if (/[ !#$%&'()*+,:;=?@[\]`"{}]|^$/i.test(username)) {
        message.channel.send("Usage: `!roles disconnect <sr.c name>`");
        return;
    }
    previousUser = client.getUser.get(username);
    if (!previousUser) {
        message.channel.send("`" + username + "` is not connected to a discord account.");
        return;
    }

    client.deleteUser.run(username);
    message.channel.send("Disconnected `" + username + "` from discord.");
    previousUser = guild.members.cache.get(previousUser.id);
    if (!message.guild && (!previousUser || message.author.id !== previousUser.id)) {
        log(message.author.tag + " disconnected " + username + " from discord.");
        previousUser.createDM();
        previousUser.dmChannel.send("`" + message.author.tag + "` disconnected `" + username + "` from discord.");
    }
}

// Reloads all auto connected discord accounts entered on sr.c
autoConnectAll = (message) => {
    client.getAutoConnectedUsers.all().forEach((user, i, array) => {
        getDiscordDataFromUserPage(message, user.username, (success) => {
            if (!success) {
                log("Failed to connect " + user.username + "'s discord account.");
            }
            if (i + 1 === array.length) {
                message.channel.send("Updated all auto connected accounts.");
            }
        });
    });
}

// Updates all usernames on all leaderboards
getUsers = (message, whenDone = () => { }) => {
    let i = 1;
    categoriesToUpdate = client.getCategories.all();
    numberOfCategories = categoriesToUpdate.length;
    categoriesToUpdate.forEach((run) => {
        if (run.il) {
            getUsersFromILCategory(message, run.game_id, run.category_id, run.category_id, (i === numberOfCategories ? whenDone : () => { }));
        } else {
            getUsersFromLeaderboard(message, run.game_id, run.category_id, (i === numberOfCategories ? whenDone : () => { }));
        }
        i++;
    });
    if (autoRefreshTimeout && !autoRefreshTimeout._destroyed) {
        clearTimeout(autoRefreshTimeout);
    }
    // Timeouts are inaccurate so having a delay of 86400000 would slowly make the 24h cycle shift
    autoRefreshTimeout = setTimeout(getUsers, 86400000 * Math.ceil(Date.now() / 86400000) - Date.now() + 1);
}

// Updates all usernames on all leaderboards of the specified game
getUsersFromGame = (message, gameID, whenDone = () => { }) => {
    let i = 1;
    categoriesToUpdate = client.getGameCategories.all(gameID);
    numberOfCategories = categoriesToUpdate.length;
    categoriesToUpdate.forEach((run) => {
        if (run.il) {
            getUsersFromILCategory(message, gameID, run.category_id, run.category_id, (i === numberOfCategories ? whenDone : () => { }));
        } else {
            getUsersFromLeaderboard(message, gameID, run.category_id, (i === numberOfCategories ? whenDone : () => { }));
        }
        i++;
    });
}

// Execute the specified function if the user is an admin/mod
userIsAdmin = (message) => {
    member = guild.members.cache.get(message.author.id);
    return member && member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator");
}

// Updates discord roles of the specified user and optionally changes the user's discord data
updateRoles = (message, username, newDiscordName, newDiscordDiscriminator, auto) => {
    discordData = client.getUser.get(username);
    member = discordData
        ? guild.members.cache.get(discordData.id)
        : undefined;

    if (newDiscordName) {
        newMember = guild.members.cache.find(member => member.user.tag === newDiscordName + "#" + newDiscordDiscriminator);
        if (newMember) {
            if (member) {
                member.roles.cache.forEach((role) => {
                    if (Object.values(roles).some(r => r.id === role.id)) {
                        member.roles.remove(role);
                    }
                });
            }
            discordData = {
                username: username,
                id: newMember.id,
                auto: + auto
            };
            client.addUser.run(discordData);
            member = newMember;
        }
    }
    if (!member) {
        log("User " + newDiscordName + "#" + newDiscordDiscriminator + " not found.");
        return false;
    }
    gameRoles = client.getUserGames.all(username);
    Object.values(gameIDs).forEach((gameID) => {
        hasRole = member.roles.cache.has(roles[gameID]);
        if (hasRole !== gameRoles.some(run => run.game_id === gameID)) {
            (hasRole ? member.roles.remove : member.roles.add)(roles[gameID]);
        }
    });
    hasRole = member.roles.cache.has(roles.wr);
    if (hasRole === (client.getUserWRCount.get(username)["count(*)"] === 0)) {
        (hasRole ? member.roles.remove : member.roles.add)(roles.wr);
    }
    return true;
}

// Sends error to the channel where the command was send or DMs it to the bot dev if the error wasn't caused by a command
sendError = (message, error) => {
    if (message) {
        message.channel.send(error);
    } else {
        log("Error while trying to update roles using the sr.c API:\n" + error);
    }
}

// Gets data from speedrun.com
// - delay after API call: 1 sec
// - delay after downloading any other sr.c page: 10 sec
// API: https://github.com/speedruncomorg/api/tree/master/version1
callSrcApi = (message, path, onEnd) => {
    if (message) {
        message.react(emotes.bingo);
    }
    afterPause = () => {
        log("API call: " + path);
        https.get({
            hostname: "www.speedrun.com",
            path: path,
            port: 443,
            headers: { 'User-Agent': 'bingo-bot/1.0' }
        }, (result) => {
            var { statusCode } = result;
            if (statusCode !== 200) {
                sendError(message, "Couldn't follow https://www.speedrun.com" + path + "; got a " + statusCode + " response.");
                return;
            }
            var dataQueue = "";
            result.on("data", (dataBuffer) => {
                dataQueue += dataBuffer;
            });
            result.on("end", () => {
                onEnd(dataQueue);
            });
        });
    }
    let apiPauseLength = (path.startsWith('/api') ? 1000 : 10000);
    if (apiCallTimestamp < Date.now()) {
        apiCallTimestamp = Date.now() + apiPauseLength;
        afterPause();
    } else {
        setTimeout(afterPause, apiCallTimestamp - Date.now());
        apiCallTimestamp += apiPauseLength;
    }
}

// Updates all category and game IDs
getCategories = (message, recursiveUpdating, whenDone = () => { }) => {
    callSrcApi(message, "/api/v1/series/v7emqr49/games?embed=categories", (dataQueue) => {
        JSON.parse(dataQueue).data.forEach((game) => {
            updatedCategories = {
                false: new Set(),
                true: new Set()
            };
            expectedNumberOfRemainingCategories = client.getGameCategories.all(game.id).length;
            game.categories.data.forEach((category) => {
                il = category.type === "per-level";
                updatedCategories[il].add(category.id);
                if (client.getCategoryRuns.get(category.id)) {
                    expectedNumberOfRemainingCategories--;
                } else {
                    client.addRun.run({ game_id: game.id, category_id: category.id, username: null, il: + il, wr: null, placeholder: 1 });
                    if (recursiveUpdating) {
                        getUsersFromLeaderboard(message, game.id, category.id);
                    }
                }
            });
            if (expectedNumberOfRemainingCategories > 0 && client.getGameRuns.all(game.id).find(run => !updatedCategories[run.il].has(run.category_id))) {
                client.deleteCategory.run(categoryID);
            }
        });
        whenDone();
    });
}

// Updates all usernames on the specified leaderboard
getUsersFromLeaderboard = (message, gameID, categoryID, whenDone = () => { }) => {
    client.deletePlaceholder.run(categoryID);
    callSrcApi(message, "/api/v1/leaderboards/" + gameID + "/category/" + categoryID + "?embed=players", (dataQueue) => {
        updatedUsers = new Set();
        category = client.getCategoryRuns.all(categoryID);
        let expectedNumberOfRemainingUsers = category.length;
        JSON.parse(dataQueue).data.players.data.forEach((player, place) => {
            // If the player is a guest, skip them
            if (player.rel !== "user") {
                return;
            }
            let username = player.weblink.substring(30);
            updatedUsers.add(username);
            if (category.find(run => run.category_id === categoryID && run.username === username)) {
                expectedNumberOfRemainingUsers--;
            } else {
                run = {
                    game_id: gameID, category_id: categoryID, username: username, il: 0,
                    wr: + (place === 0 && !fullGameCategoriesThatAreActuallyILs.includes(categoryID)), placeholder: 0
                };
                category.push(run);
                client.addRun.run(run);
                user = client.getUser.get(username);
                if (recursiveUpdating && client.getUserRunCount.get(username)["count(*)"] === 1 && !user) {
                    getDiscordDataFromUserPage(message, username);
                } else if (user) {
                    updateRoles(message, username);
                }
            }
        });
        if (expectedNumberOfRemainingUsers > 0) {
            category.forEach((run) => {
                if (updatedUsers.has(run.username)) {
                    return;
                }
                client.deleteRun.run(categoryID, run.username);
                updateRoles(message, run.username);
            });
        }
        whenDone();
    });
}

// Updates all usernames in the specified IL category
getUsersFromILCategory = (message, gameID, categoryID, endOfUri, whenDone = () => { }) => {
    client.deletePlaceholder.run(categoryID);
    callSrcApi(message, "/api/v1/runs?status=verified&max=200&embed=players&category=" + endOfUri, (dataQueue) => {
        apiResponse = JSON.parse(dataQueue);
        nextLink = apiResponse.pagination.links.find(link => link.rel === "next");
        if (!endOfUri.includes("offset=")) {
            updatedUsers = new Set();
            category = client.getCategoryRuns.all(categoryID);
            expectedNumberOfRemainingUsers = category.length;
        }
        apiResponse.data.forEach((run) => {
            run.players.data.forEach((player) => {
                // If the player is a guest, skip them
                if (player.rel !== "user") {
                    return;
                }
                let username = player.weblink.substring(30);
                updatedUsers.add(username);
                if (category.find(run => run.category_id === categoryID && run.username === username)) {
                    expectedNumberOfRemainingUsers--;
                } else {
                    run = { game_id: gameID, category_id: categoryID, username: username, il: 1, wr: null, placeholder: 0 };
                    category.push(run);
                    client.addRun.run(run);
                    user = client.getUser.get(username);
                    if (recursiveUpdating && client.getUserRunCount.get(username)["count(*)"] === 1 && !user) {
                        getDiscordDataFromUserPage(message, username);
                    } else if (user) {
                        updateRoles(message, username);
                    }
                }
            });
        });
        if (nextLink) {
            // setImmediate is used to avoid stack overflow
            setImmediate(() => {
                getUsersFromILCategory(message, gameID, categoryID, nextLink.uri.substring(84), whenDone);
            });
        } else {
            if (expectedNumberOfRemainingUsers > 0) {
                category.forEach((run) => {
                    if (updatedUsers.has(run.username)) {
                        return;
                    }
                    client.deleteRun.run(categoryID, run.username);
                    updateRoles(message, run.username);
                });
            }
            whenDone();
        }
    });
}

// Updates a specified person's discord data
getDiscordDataFromUserPage = (message, username, whenDone = () => { }) => {
    callSrcApi(message, "/user/" + username, (dataQueue) => {
        foundName = false;
        name = "";
        discriminator = "";
        success = false;
        // To-do: Fix "Oops! The site's under a lot of pressure right now. Please check back later."
        dataQueue.replace(/data-original-title="Discord: ([^#]+#\d{4})"/, (wholeMatch, parenthesesContent) => {
            parenthesesContent = decodeHTML(parenthesesContent)
            name = parenthesesContent.split("#")[0];
            discriminator = parenthesesContent.split("#")[1];
            success = updateRoles(message, username, name, discriminator, true);
            foundName = true;
        });
        if (!foundName && dataQueue.match(/class=['"]username/) && client.getUser.get(username)) {
            client.deleteUser.run(username);
        }
        whenDone(success, name + "#" + discriminator);
    });
}

// The following code is based on https://github.com/intesso/decode-html to avoid additional dependencies ---------
// (license: https://github.com/intesso/decode-html/blob/master/LICENSE)
// Store markers outside of the function scope, not to recreate them on every call
const entities = {
    'amp': '&',
    'apos': '\'',
    'lt': '<',
    'gt': '>',
    'quot': '"',
    'nbsp': ' '
};
const entityPattern = /&([a-z]+);/ig;

decodeHTML = (text) => {
    // A single replace pass with a static RegExp is faster than a loop
    return text.replace(entityPattern, (match, entity) => {
        entity = entity.toLowerCase();
        if (entities.hasOwnProperty(entity)) {
            return entities[entity];
        }
        // Return original string if there is no matching entity (no replace)
        return match;
    });
};