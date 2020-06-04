const categories = require('./categories.js');
const emotes = require('./emotes.json');
const fs = require('fs');
const https = require('https');

var exports = module.exports = {};
var apiCallTimestamp = Date.now();
var leaderboards = {};
var users = {};
var autoRefreshTimeout;

/*
leaderboards: {
    <game ID>: {
        leaderboards: {
            <category ID>: {
                <sr.c username>: null,
                <sr.c username 2>: null,
                ...
            },
            <category ID 2>: { ... },
            ...
        },
        ilCategories: {
            <IL category ID>: {
                <sr.c username>: null,
                <sr.c username 2>: null,
                ...
            },
            <IL category ID 2>: { ... },
            ...
        }
    },
    <game ID 2>: { ... },
    ...
}

users: {
    <sr.c username>: {
        games: {
            <game ID>: {
                leaderboards: {
                    <category ID>: null / "wr",
                    <category ID 2>: ...,
                    ...
                },
                ilCategories: {
                    <IL category ID>: null,
                    <IL category ID 2>: null,
                    ...
                }
            },
            <game ID 2>: { ... },
            ...
        },
        discord: {
            username: <discord username>,
            discriminator: <discord tag>,
            auto: <false if username was manually entered, otherwise true>
        }
    },
    <sr.c username 2>: { ... },
    ...
}
*/

var recursiveUpdating = true;

var client;
var guild;
var roles;

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

exports.init = (c) => {
    client = c;
    guild = client.guilds.cache.get('129652811754504192');
    roles = {
        "369pp31l": guild.roles.cache.get("716015233256390696"),
        "pd0n821e": guild.roles.cache.get("716015332040507503"),
        "4d704r17": guild.roles.cache.get("716015421878435891"),
        "pdvzzk6w": guild.roles.cache.get("716015284183367701"),
        "369vz81l": guild.roles.cache.get("716015510797680741"),
        "pd0n531e": guild.roles.cache.get("716015465024979085"),
        "k6qw8z6g": guild.roles.cache.get("716015547984117872"),
        "wr": guild.roles.cache.get("716014433121337504")
    };
    botDev = guild.members.cache.get("81612266826379264").user;
    if (Object.values(roles).includes(undefined)) {
        sendError(message, "Couldn't find all roles.");
        process.exit(1);
    }
    botDev.createDM();
    try {
        data = JSON.parse(fs.readFileSync("./src_data.json"));
        leaderboards = data.leaderboards;
        users = data.users;
    } catch { }

    now = new Date();
    setTimeout(getUsers, Date.now() +
        1000 * (86400 - ((now.getUTCHours() * 60) + now.getUTCMinutes()) * 60 + now.getUTCSeconds()));
}

exports.roleCmds = (lowerMessage, message) => {
    if (lowerMessage.startsWith("!roles reload categories"))
        reloadCategoriesCmd(message);
    else if (lowerMessage.startsWith("!roles reload leaderboards"))
        reloadLeaderboardCmd(message);
    else if (lowerMessage.startsWith("!roles reload discordaccount"))
        reloadDiscordAccountCmd(message);
    else if (lowerMessage.startsWith("!roles reload all"))
        reloadAllCmd(message);
    else if (lowerMessage.startsWith("!roles connect"))
        connectCmd(message);
}

// !roles reload categories
reloadCategoriesCmd = (message) => {
    getCategories(() => {
        message.channel.send("Updated category data.");
        saveData();
    });
}

// !roles reload leaderboards
reloadLeaderboardsCmd = (message) => {
    if (Object.keys(leaderboards).length === 0) {
        message.channel.send("No category data found, try running `!reload categories` first.");
        return;
    }

    game = message.content.replace(/^!roles reload leaderboards/i, "").trim();

    if (game.toLowerCase() === "all")
        ifUserIsAdmin(message, () => {
            getUsers(message, () => {
                message.channel.send("Updated leaderboard data.");
                saveData();
            });
        });
    else {
        game = categories.normalizeGameName(game);
        if (game === null) {
            message.channel.send("Specified game name was not a valid LBP game, try something else.");
            return;
        }
        getUsersFromGame(gameIDs[game], () => {
            message.channel.send("Updated leaderboard data for " + game + ".");
            saveData();
        });
    }
}

// !roles reload discordaccount
reloadDiscordAccountCmd = (message) => {
    username = message.content.replace(/^!roles reload discordaccount/i, "").trim();
    if (/[ !#\$%&'()*+,:;=?@\[\]`´"§{}.°]/.test(username)) {
        message.channel.send("Usage: `!roles reload discordaccount <sr.c name>`");
        return;
    }
    if (!users[username]) {
        message.channel.send("`" + username + "` is not on any LBP leaderboards. Use `!roles reload leaderboard <game name>` to reload a leaderboard.");
    }
    getDiscordDataFromUserPage(message, username, (success, name, discriminator) => {
        if (success) {
            message.channel.send("Updated " + username + "'s discord account to " + name + "#" + discriminator + ".");
            saveData();
        } else if (users[username].discord && !users[username].discord.auto) {
            users[username].discord.auto = true;
            message.channel.send("Activated auto connect mode but failed to connect discord account.");
            saveData();
        } else
            message.channel.send("Failed to connect discord account.");
    });
}

// !roles reload all
reloadAllCmd = (message) => {
    getCategories(message, () => {
        getUsers(message, () => {
            message.channel.send("Updated everything.");
            saveData();
        });
    });
}

// !roles connect
connectCmd = (message) => {
    ifUserIsAdmin(message, () => {
        params = message.content.replace(/^!roles connect/i, "").trim().split('/');
        username = params[0].trim();
        id = params[1].replace("<@", "").replace(">", "").trim();
        if (parameters.length !== 2 || /[ !#\$%&'\(\)\*\+,:;=\?@\[\]`´"§]/.test(username) || !(/^(\d+|auto)$/.test(id))) {
            message.channel.send("Usage: `!roles connect <sr.c name>/@user` or `<sr.c name>/auto`");
            return;
        }
        if (!users[username]) {
            message.channel.send("`" + username + "` is not on any LBP leaderboards. Use `!roles reload leaderboard <game name>` to reload a leaderboard.");
        }
        if (/^auto$/i.test(id)) {
            if (users[username].discord)
                users[username].discord.auto = true;
            getDiscordDataFromUserPage(message, username, (success, name, discriminator) => {
                if (success)
                    message.channel.send("Updated " + username + "'s discord account to " + name + "#" + discriminator + ".");
                else
                    message.channel.send("Activated auto connect mode but failed to connect discord account.");
                saveData();
            });
            return;
        }
        member = guild.members.cache.get(id);
        if (updateRoles(message, username, member.username, member.discriminator, false)) {
            message.channel.send("Updated " + username + "'s discord account to " + member.username + "#" + member.id + ".");
            saveData();
        } else
            message.channel.send("Failed to connect discord account.");
    });
}

// Updates all usernames on all leaderboards
getUsers = (message, whenDone) => {
    let i = 1;
    for (gameName in gameIDs) {
        getUsersFromGame(message, gameIDs[gameName],
            (i === Object.keys(gameIDs).length ? whenDone : () => { }));
        i++;
    }
    if (autoRefreshTimeout && !autoRefreshTimeout._destroyed)
        clearTimeout(autoRefreshTimeout);
    now = new Date();
    setTimeout(getUsers, Date.now() +
        1000 * (86400 - ((now.getUTCHours() * 60) + now.getUTCMinutes()) * 60 + now.getUTCSeconds()));
}

// Updates all usernames on all leaderboards of the specified game
getUsersFromGame = (message, gameID, whenDone) => {
    let i = 1;
    numberOfCategories = Object.keys(leaderboards[gameID].leaderboards).length + Object.keys(leaderboards[gameID].ilCategories).length;
    for (categoryID in leaderboards[gameID].leaderboards) {
        getUsersFromLeaderboard(message, gameID, categoryID,
            (i === numberOfCategories ? whenDone : () => { }));
        i++;
    }

    for (categoryID in leaderboards[gameID].ilCategories) {
        getUsersFromILCategory(message, gameID, categoryID, categoryID,
            (i === numberOfCategories ? whenDone : () => { }));
        i++;
    }
}

// Execute the specified function if the user is an admin/mod
ifUserIsAdmin = (message, ifTrue) => {
    if (message.member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator"))
        ifTrue();
    else
        message.channel.send("You are not a mod/admin.");
}

// Updates discord roles of the specified user and optionally changes the user's discord data
updateRoles = (message, username, newDiscordName, newDiscordDiscriminator, auto) => {
    discordData = users[username].discord;
    if (newDiscordName) {
        member = guild.members.cache.find(user => user.user.username === newDiscordName && user.user.discriminator === newDiscordDiscriminator);
        if (member) {
            for (gameID in Object.assign({ wr: 0 }, users[username].games)) {
                if (member.roles.cache.has(roles[gameID]))
                    member.roles.remove(roles[gameID]);
            }
        }
        discordData = users[username].discord = {
            username: newDiscordName,
            discriminator: newDiscordDiscriminator,
            auto: auto
        };
    }
    member = guild.members.cache.find(user => user.user.username === newDiscordName && user.user.discriminator === newDiscordDiscriminator);
    if (!member)
        return false;
    hasWR = false;
    for (gameID in users[username].games) {
        member.roles.add(roles[gameID]);
        if (Object.values(users[username].games[gameID]).includes("wr")) {
            hasWR = true;
            break;
        }
    }
    if (hasWR) {
        member.roles.add(roles.wr);
    }
    return true;
}

// Sends error to the channel where the command was send or DMs it to the bot dev if the error wasn't caused by a command
sendError = (message, error) => {
    if (typeof message === 'undefined')
        botDev.dmChannel.send("Error while trying to update roles using the sr.c API:\n" + error);
    else
        message.channel.send(error);
}

// Gets data from speedrun.com
// - delay after API call: 1 sec
// - delay after downloading any other sr.c page: 10 sec
// API: https://github.com/speedruncomorg/api/tree/master/version1
callSrcApi = (path, onEnd, message) => {
    if (message)
        message.react(emotes.bingo);
    afterPause = () => {
        console.log("API call: " + path);
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
getCategories = (message, whenDone = () => { }) => {
    callSrcApi("/api/v1/series/v7emqr49/games?embed=categories", (dataQueue) => {
        JSON.parse(dataQueue).data.forEach((game) => {
            updatedCategories = {
                leaderboards: {},
                ilCategories: {}
            };
            if (!leaderboards[game.id])
                leaderboards[game.id] = updatedCategories;
            expectedNumberOfRemainingCategories = Object.keys(leaderboards[game.id].leaderboards).length;
                + Object.keys(leaderboards[game.id].ilCategories).length;
            game.categories.data.forEach((category) => {
                type = (category.type === "per-level" ? "ilCategories" : "leaderboards");
                updatedCategories[type][category.id] = null;
                if (leaderboards[game.id][type][category.id])
                    expectedNumberOfRemainingCategories--;
                else {
                    leaderboards[game.id][type][category.id] = {};
                    if (recursiveUpdating)
                        getUsersFromLeaderboard(message, game.id, category.id);
                }
            });
            if (expectedNumberOfRemainingCategories > 0) {
                for (categoryID in leaderboards[game.id].leaderboards)
                    if (!updatedCategories.leaderboards.hasOwnProperty(categoryID))
                        deleteCategory(game.id, "leaderboards", categoryID);
                for (categoryID in leaderboards[game.id].ilCategories)
                    if (!updatedCategories.ilCategories.hasOwnProperty(categoryID))
                        deleteCategory(game.id, "ilCategories", categoryID);
            }
        });
        whenDone();
    }, message);
}

// Deletes a category from both leaderboard and user data
deleteCategory = (gameID, type, categoryID) => {
    leaderboards[gameID][type][categoryID].forEach((username) => {
        deleteUserRun(username, gameID, type, categoryID);
    });
    delete leaderboards[gameID][type][categoryID];
}

// Updates all usernames on the specified leaderboard
getUsersFromLeaderboard = (message, gameID, categoryID, whenDone = () => { }) => {
    callSrcApi("/api/v1/leaderboards/" + gameID + "/category/" + categoryID + "?embed=players", (dataQueue) => {
        updatedUsers = {};
        expectedNumberOfRemainingUsers = leaderboards[gameID].leaderboards[categoryID].size;
        JSON.parse(dataQueue).data.players.data.forEach((player, place) => {
            // If the player is a guest, skip them
            if (player.rel !== "user")
                return;
            let username = player.weblink.substring(30);
            updatedUsers[username] = null;
            if (leaderboards[gameID].leaderboards[categoryID][username]) {
                expectedNumberOfRemainingUsers--;
            } else {
                leaderboards[gameID].leaderboards[categoryID][username] = null;
                if (!users.hasOwnProperty(username)) {
                    users[username] = {
                        games: {}
                    };
                    if (recursiveUpdating)
                        getDiscordDataFromUserPage(message, username);
                }

                if (!users[username].games.hasOwnProperty(gameID))
                    users[username].games[gameID] = {
                        leaderboards: {},
                        ilCategories: {}
                    };
                users[username].games[gameID].leaderboards[categoryID] =
                    (place === 0 && !fullGameCategoriesThatAreActuallyILs.includes(categoryID) ? "wr" : null);
            }
        });
        if (expectedNumberOfRemainingUsers > 0)
            leaderboards[gameID].leaderboards[categoryID].forEach((username) => {
                if (!updatedUsers[username])
                    deleteUserFromCategory(gameID, "leaderboards", categoryID, username);
            });
        whenDone();
    }, message);
}

// Updates all usernames in the specified IL category
getUsersFromILCategory = (message, gameID, categoryID, endOfUri, whenDone = () => { }) => {
    callSrcApi("/api/v1/runs?status=verified&max=200&embed=players&category=" + endOfUri, (dataQueue) => {
        apiResponse = JSON.parse(dataQueue);
        nextLink = apiResponse.pagination.links.find(link => link.rel === "next");
        if (!endOfUri.includes("offset=")) {
            updatedUsers = {};
            expectedNumberOfRemainingUsers = leaderboards[gameID].ilCategories[categoryID].size;
        }
        apiResponse.data.forEach((run) => {
            run.players.data.forEach((player) => {
                // If the player is a guest, skip them
                if (player.rel !== "user")
                    return;
                let username = player.weblink.substring(30);
                updatedUsers[username] = null;
                if (leaderboards[gameID].ilCategories[categoryID][username]) {
                    expectedNumberOfRemainingUsers--;
                } else {
                    leaderboards[gameID].ilCategories[categoryID][username] = null;
                    if (!users.hasOwnProperty(username)) {
                        users[username] = {
                            games: {}
                        };
                        if (recursiveUpdating)
                            getDiscordDataFromUserPage(message, username);
                    }
                    if (!users[username].games.hasOwnProperty(gameID))
                        users[username].games[gameID] = {
                            leaderboards: {},
                            ilCategories: {}
                        };
                    users[username].games[gameID].ilCategories[categoryID] = null;
                }
            });
        });
        if (nextLink)
            getUsersFromILCategory(message, gameID, categoryID, nextLink.uri.substring(84), whenDone);
        else {
            if (expectedNumberOfRemainingUsers > 0)
                leaderboards[gameID].ilCategories[categoryID].forEach((username) => {
                    if (!updatedUsers[username])
                        deleteUserFromCategory(gameID, "ilCategories", categoryID, username);
                });
            whenDone();
        }
    }, message);
}

// Deletes a specified run from both user and category data
deleteUserFromCategory = (gameID, type, categoryID, username) => {
    deleteUserRun(username, gameID, type, categoryID);
    leaderboards[gameID][type][categoryID].delete(username);
}

// Deletes a specified run from user data
deleteUserRun = (username, gameID, type, categoryID) => {
    delete users[username].games[gameID][type][categoryID];
    if (Object.keys(users[username].games[gameID].leaderboards).length === 0 && Object.keys(users[username].games[gameID].ilCategories).length === 0)
        delete users[username].games[gameID];
    if (Object.keys(users[username].games).length === 0)
        delete users[username];
}

// Updates a specified person's discord data
getDiscordDataFromUserPage = (message, username, whenDone = () => { }) => {
    if (users[username].discord && !users[username].discord.auto)
        return;
    callSrcApi("/user/" + username, (dataQueue) => {
        apiCallTimestamp = Date.now() + 10000;
        foundName = false;
        // To-do: Fix "Oops! The site's under a lot of pressure right now. Please check back later."
        dataQueue.replace(/data-original-title="Discord: ([^#]+#\d{4})"/, (wholeMatch, parenthesesContent) => {
            parenthesesContent = decodeHTML(parenthesesContent)
            name = parenthesesContent.substring(0, parenthesesContent.search("#"));
            discriminator = parenthesesContent.substring(parenthesesContent.search("#") + 1);
            success = updateRoles(message, username, name, discriminator, true);
            foundName = true;
        });
        if (!foundName && users[username].discord && dataQueue.match(/class=['"]username/))
            delete users[username].discord;
        whenDone(success, name, discriminator);
    }, message);
}

// Saves data to a file
saveData = () => {
    fs.writeFile('./src_data.json', JSON.stringify({
        leaderboards: leaderboards,
        users: users
    }), () => { });
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