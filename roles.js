const categories = require('./categories.js');
const emotes = require('./emotes.json');
const fs = require('fs');
const https = require('https');

var exports = module.exports = {};
var apiCallTimestamp = Date.now();
var leaderboards = {};
var users = {};

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

reloadCategoriesCmd = (message) => {
    getCategories(() => {
        message.channel.send("Updated category data.");
        saveData();
    });
}

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

reloadDiscordAccountCmd = (message) => {
    username = message.content.replace(/^!roles reload discordaccount/i, "").trim();
    if (/[ !#\$%&'()*+,:;=?@\[\]`�"�{}.�]/.test(username)) {
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

reloadAllCmd = (message) => {
    getCategories(message, () => {
        getUsers(message, () => {
            message.channel.send("Updated everything.");
            saveData();
        });
    });
}

connectCmd = (message) => {
    ifUserIsAdmin(message, () => {
        params = message.content.replace(/^!roles connect/i, "").trim().split('/');
        username = params[0].trim();
        id = params[1].replace("<@", "").replace(">", "").trim();
        if (parameters.length !== 2 || /[ !#\$%&'\(\)\*\+,:;=\?@\[\]`�"�]/.test(username) || !(/^(\d+|auto)$/.test(id))) {
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

getUsers = (message, whenDone) => {
    let i = 1;
    for (gameName in gameIDs) {
        getUsersFromGame(message, leaderboards[gameIDs[gameName]],
            (i === gameIDs.length ? whenDone : () => { }));
        i++;
    }
}

getUsersFromGame = (message, gameID, whenDone) => {
    let i = 1;
    numberOfCategories = Object.keys(leaderboards[gameID].leaderboards).length + Object.keys(leaderboards[gameID].ilCategories).length;
    for (categoryID in leaderboards[gameID].leaderboards) {
        getUsersFromLeaderboard(message, gameID, categoryID,
            (i === numberOfCategories ? whenDone : () => { }));
        i++;
    }

    for (categoryID in leaderboards[gameID].ilCategories) {
        getUsersFromILCategory(message, categoryID,
            (i === numberOfCategories ? whenDone : () => { }));
        i++;
    }
}

ifUserIsAdmin = (message, ifTrue) => {
    if (message.member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator"))
        ifTrue();
    else
        message.channel.send("You are not a mod/admin.");
}

updateRoles = (message, username, newDiscordName, newDiscordDiscriminator, auto) => {
    discordData = users[username].discord;
    if (newDiscordName) {
        member = guild.members.cache.find(user => user.username === discordData.username && user.discriminator === discordData.username);
        if (member) {
            for (gameID in Objects.assign({ wr: 0 }, users[username].games)) {
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
    member = guild.members.cache.find(user => user.username === discordData.username && user.discriminator === discordData.username);
    if (!member)
        return false;
    hasWR = false;
    for (gameID in users[username].games) {
        member.roles.add(roles[gameID]);
        if (Object.values(users[username].games[gameID]).includes("wr"))
            hasWR = true;
    }
    if (hasWR) {
        member.roles.add(roles.wr);
    }
    return true;
}

sendError = (message, error) => {
    if (typeof message === 'undefined')
        botDev.dmChannel.send("Error while trying to update roles using the sr.c API:\n" + error);
    else
        message.channel.send(error);
}

callSrcApi = (path, onEnd, message) => {
    if (message)
        message.react(emotes.bingo);
    afterPause = () => {
        https.get({
            hostname: "www.speedrun.com",
            path: path,
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
                // This is set to zero because its value really doesn't matter as long as it has any value
                updatedCategories[type][category.id] = 0;
                if (leaderboards[game.id][type][category.id])
                    expectedNumberOfRemainingCategories--;
                else {
                    leaderboards[game.id][type][category.id] = new Set();
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

deleteCategory = (gameID, type, categoryID) => {
    leaderboards[gameID][type][categoryID].toArray().forEach((username) => {
        deleteUserRun(username, gameID, type, categoryID);
    });
    delete leaderboards[gameID][type][categoryID];
}

getUsersFromLeaderboard = (message, gameID, categoryID, whenDone = () => { }) => {
    callSrcApi("/api/v1/leaderboards/" + gameID + "/category/" + categoryID + "?embed=players", (dataQueue) => {
        updatedUsers = new Set();
        expectedNumberOfRemainingUsers = leaderboards[gameID].leaderboards[categoryID].size;
        JSON.parse(dataQueue).data.players.data.forEach((player, place) => {
            // If the player is a guest, skip them
            if (player.rel !== "user")
                return;
            let username = [player.weblink.substring(30)];
            updatedUsers.add(username);
            if (leaderboards[gameID].leaderboards[categoryID].has(username)) {
                expectedNumberOfRemainingUsers--;
            } else {
                leaderboards[gameID].leaderboards[categoryID].add(username);
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
                    (place === 1 && !fullGameCategoriesThatAreActuallyILs.includes(categoryID) ? "wr" : "run");
            }
        });
        if (expectedNumberOfRemainingUsers > 0)
            leaderboards[gameID].leaderboards[categoryID].toArray().forEach((username) => {
                if (!updatedUsers.has(username))
                    deleteUserFromCategory(gameID, "leaderboards", categoryID, username);
            });
        whenDone();
    }, message);
}

getUsersFromILCategory = (message, endOfUri, whenDone = () => { }) => {
    callSrcApi("/api/v1/runs?status=verified&max=200&embed=players&category=" + endOfUri, (dataQueue) => {
        apiResponse = JSON.parse(dataQueue);
        nextLink = apiResponse.pagination.links.find(link => link.rel === "next");
        if (!endOfUri.includes("offset=")) {
            updatedUsers = new Set();
            expectedNumberOfRemainingUsers = leaderboards[gameID].ilCategories[categoryID].size;
        }
        apiResponse.data.forEach((run) => {
            run.players.data.forEach((player) => {
                // If the player is a guest, skip them
                if (player.rel !== "user")
                    return;
                let username = [player.weblink.substring(30)];
                updatedUsers.add(username);
                if (leaderboards[run.game].ilCategories[run.category].has(username)) {
                    expectedNumberOfRemainingUsers--;
                } else {
                    leaderboards[run.game].ilCategories[run.category].add(username);
                    if (!users.hasOwnProperty(username)) {
                        users[username] = {
                            games: {}
                        };
                        if (recursiveUpdating)
                            getDiscordDataFromUserPage(message, username);
                    }
                    if (!users[username].games.hasOwnProperty(run.game))
                        users[username].games[run.game] = {
                            leaderboards: {},
                            ilCategories: {}
                        };
                    users[username].games[run.game].ilCategories[run.category] = "run";
                }
            });
        });
        if (nextLink)
            getUsersFromILCategory(message, nextLink.uri.substring(84), whenDone);
        else {
            if (expectedNumberOfRemainingUsers > 0)
                leaderboards[gameID].ilCategories[categoryID].toArray().forEach((username) => {
                    if (!updatedUsers.has(username))
                        deleteUserFromCategory(gameID, "ilCategories", categoryID, username);
                });
            whenDone(returnValue);
        }
    }, message);
}

deleteUserFromCategory = (gameID, type, categoryID, username) => {
    deleteUserRun(username, gameID, type, categoryID);
    leaderboards[gameID][type][categoryID].delete(username);
}

deleteUserRun = (username, gameID, type, categoryID) => {
    delete users[username].games[gameID][type][categoryID];
    if (Object.keys(users[username].games[gameID].leaderboards).length === 0 && Object.keys(users[username].games[gameID].ilCategories).length === 0)
        delete users[username].games[gameID];
    if (Object.keys(users[username].games).length === 0)
        delete users[username];
}

getDiscordDataFromUserPage = (message, username, whenDone = () => { }) => {
    if (users[username].discord && !users[username].discord.auto)
        return;
    callSrcApi("/user/" + username, (dataQueue) => {
        apiCallTimestamp = Date.now() + 10000;
        foundName = false;
        name = decodeHTML(parenthesesContent).substring(0, newName.search("#"));
        discriminator = decodeHTML(parenthesesContent).substring(newName.search("#") + 1);
        // To-do: Fix "Oops! The site's under a lot of pressure right now. Please check back later."
        dataQueue.replace(/data-original-title="Discord: ([^#]+#\d{4})"/, (wholeMatch, parenthesesContent) => {
            success = updateRoles(message, username, name, discriminator, true);
            foundName = true;
        });
        if (!foundName && users[username].discord && dataQueue.match(/class=['"]username/))
            delete users[username].discord;
        whenDone(success, name, discriminator);
    }, message);
}

saveData = () => {
    fs.writeFile('./src_data.json', JSON.stringify({
        leaderboards: leaderboards,
        users: users
    }));
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