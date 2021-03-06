const config = require("./config.json");
const emotes = config.emotes;
const https = require('https');
const SQLite = require('better-sqlite3');
const helpers = require("./helpers.js");

var exports = module.exports = {};
var apiCallTimestamp = Date.now();
var autoRefreshTimeout;
var client;
var guild;

// Maps from speedrun.com game ID (or the string "wr") to server role
var gameRoles;
var wrRoles;
var ilWrRoles;

// Maps from game name to speedrun.com game ID
const gameIds = {
    "LittleBigPlanet"                : "369pp31l",
    "LittleBigPlanet Series DLC"     : "j1llxz71",
    "Multiple LittleBigPlanet Games" : "4d79me31",
    "LittleBigPlanet PSP"            : "pd0n821e",
    "Sackboy's Prehistoric Moves"    : "4d704r17",
    "LittleBigPlanet 2"              : "pdvzzk6w",
    "LittleBigPlanet PS Vita"        : "369vz81l",
    "LittleBigPlanet Karting"        : "pd0n531e",
    "LittleBigPlanet 3"              : "k6qw8z6g",
    "Sackboy: A Big Adventure"       : "j1nevzx1",
};

const fullGameCatsThatAreILs = [
    "824xr8md", // LBP1 Styrofoam%
    "9d8pgl6k", // LBP1 Die%
    "7dg8qml2", // LBP3 Corruption%
];

exports.init = async (c) => {
    let sql = new SQLite("./data/roles.sqlite");
    client = c;
    guild = client.guilds.cache.get('129652811754504192');
    await guild.roles.fetch();
    gameRoles = {
        "369pp31l": guild.roles.cache.get("716015233256390696"),
        "j1llxz71": guild.roles.cache.get("729768987365474355"),
        // No multi-game role; individual game roles are assigned instead
        "pd0n821e": guild.roles.cache.get("716015332040507503"),
        "4d704r17": guild.roles.cache.get("716015421878435891"),
        "pdvzzk6w": guild.roles.cache.get("716015284183367701"),
        "369vz81l": guild.roles.cache.get("716015465024979085"),
        "pd0n531e": guild.roles.cache.get("716015510797680741"),
        "k6qw8z6g": guild.roles.cache.get("716015547984117872"),
        "j1nevzx1": guild.roles.cache.get("760606311679000626"),
    };
    wrRoles = [
        guild.roles.cache.get("716014433121337504"), // 1
        guild.roles.cache.get("725437638974373978"), // 2
        guild.roles.cache.get("725437745262231602"), // 3
        guild.roles.cache.get("725437781073199265"), // 4
        guild.roles.cache.get("725437800874377317"), // 5
        guild.roles.cache.get("725437819224588300"), // 6
        guild.roles.cache.get("725437839403384962"), // 7
        guild.roles.cache.get("725437863381958696"), // 8
        guild.roles.cache.get("725437884420587703"), // 9
        guild.roles.cache.get("725437901680279637"), // 10+
    ];
    ilWrRoles = [
        guild.roles.cache.get("784118229143781397"), // 1
        guild.roles.cache.get("784627988703739976"), // 2
        guild.roles.cache.get("784628034317058058"), // 3
        guild.roles.cache.get("784628058149617684"), // 4
        guild.roles.cache.get("784118331388854288"), // 5+
        guild.roles.cache.get("784118436585799721"), // 10+
        guild.roles.cache.get("784118484342800384"), // 20+
        guild.roles.cache.get("784118537933291541"), // 30+
        guild.roles.cache.get("784118624197672960"), // 40+
        guild.roles.cache.get("784118766145503232"), // 50+
        guild.roles.cache.get("800566048586727454"), // 60+
        guild.roles.cache.get("800566126827536385"), // 70+
        guild.roles.cache.get("800566196738981888"), // 80+
        guild.roles.cache.get("800566238891343873"), // 90+
        guild.roles.cache.get("800566271573229659"), // 100+
    ];
    if (Object.values(gameRoles).includes(undefined)) {
        helpers.log("Couldn't find all roles; Discord roles may have changed.", true);
    }

    // Setup tables for keeping track of src/discord connections
    if (!sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='src_runners';").get()['count(*)']) {
        sql.prepare("CREATE TABLE src_runners (discord_id TEXT PRIMARY KEY, src_name TEXT);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    // Setup SQL queries for setting/retrieving src/discord connections
    client.getSrcUsers = sql.prepare("SELECT * FROM src_runners;");
    client.addSrcUser = sql.prepare("INSERT OR REPLACE INTO src_runners (discord_id, src_name) VALUES (@discord_id, @src_name);");
    client.deleteSrcUser = sql.prepare("DELETE FROM src_runners WHERE discord_id = ?;");

    // This will run reloadRolesCmd once Date.now() is divisible by 86400000 (every day)
    // Timeouts are inaccurate so having a delay of 86400000 would slowly make the 24h cycle shift
    autoRefreshTimeout = setTimeout(reloadRolesCmd, 86400000 * Math.ceil(Date.now() / 86400000) - Date.now() + 1);
}

// Adds the role for gameName to the user with the given discord ID
exports.giveRoleFromRace = async (discordId, gameName, categoryName) => {
    member = await guild.members.fetch(discordId);
    if (!member) {
        return;
    }
    if (gameName === "Multiple LittleBigPlanet Games") {
        rolesShouldHave = [];
        if (categoryName === "An3%") {
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet"]]);
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet 2"]]);
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet 3"]]);
        } else if (categoryName === "7ny%") {
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet"]]);
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet PSP"]]);
            rolesShouldHave.push(gameRoles[gameIds["Sackboy's Prehistoric Moves"]]);
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet 2"]]);
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet PS Vita"]]);
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet Karting"]]);
            rolesShouldHave.push(gameRoles[gameIds["LittleBigPlanet 3"]]);
        }
        member.roles.add(rolesShouldHave);
    } else {
        member.roles.add(gameRoles[gameIds[gameName]]);
    }
}

// Commands
exports.roleCmds = (lowerMessage, message) => {
    if (lowerMessage.startsWith("!roles"))
        rolesCmd(message);
    
    else if (lowerMessage.startsWith("!removeroles"))
        removeRolesCmd(message);

    else if (isAdmin(message.author.id)) {
        if (lowerMessage.startsWith("!reloadroles"))
            reloadRolesCmd(message);
    }
}

// !roles <src name> [<discord id>]
rolesCmd = (message) => {
    params = message.content.replace(/^!roles/i, "").trim().split(" ");
    if (params.length > 2 || params[0] === "") {
        message.channel.send("Usage: `!roles [<speedrun.com name>]` (e.g. `!roles RbdJellyfish`)");
        return;
    }

    // Moderators can update peoples' roles for them
    if (params.length === 2) {
        if (!isAdmin(message.author.id)) {
            message.channel.send("Usage: `!roles [<speedrun.com name>]` (e.g. `!roles RbdJellyfish`)");
            return;
        }
        id = params[1].replace("<@!", "").replace(">", "").trim();
        doSrcRoleUpdates(id, params[0], message);
        message.react(emotes.acknowledge);
        return;
    }

    message.react(emotes.acknowledge);

    // Check if profile matches caller
    callSrc("/user/" + params[0], message, (dataQueue) => {
        if (!dataQueue.match(/class=['"]username/)) {
            message.channel.send("Speedrun.com is having a moment, try again later.");
            return;
        }

        // Discord
        discordMatch = dataQueue.match(/data-original-title="Discord: (.*?)"/);
        discordName = message.author.username + "#" + message.author.discriminator;
        if (discordMatch && discordMatch[1] === discordName) {
            doSrcRoleUpdates(message.author.id, params[0], message);
            return;
        }

        message.channel.send("Unable to determine if " + params[0] + "'s speedrun.com profile is yours; make sure you've linked your discord account at https://www.speedrun.com/editprofile.");
    });
}

// !removeroles [<discord id>]
removeRolesCmd = async (message) => {
    param = message.content.replace(/^!removeroles/i, "").trim();
    discordId = message.author.id;
    if (param !== "" && isAdmin(discordId)) {
        discordId = param.replace("<@!", "").replace(">", "").trim();
    }

    client.deleteSrcUser.run(discordId);
    member = await guild.members.fetch(discordId);
    if (member) {
        member.roles.remove(Object.values(gameRoles).concat(wrRoles).concat(ilWrRoles));
    }
    message.react(emotes.acknowledge);
}

// !reloadroles
reloadRolesCmd = async () => {
    helpers.log("==== Updating all registered users ====");
    for(let user of client.getSrcUsers.all()) {
        await doSrcRoleUpdates(user.discord_id.toString(), user.src_name.toString());
    }
    clearTimeout(autoRefreshTimeout);
    autoRefreshTimeout = setTimeout(reloadRolesCmd, 86400000 * Math.ceil(Date.now() / 86400000) - Date.now() + 1);
}

// Update user roles from speedrun.com profile
doSrcRoleUpdates = (discordId, srcName, message = null) => {
    return new Promise((resolve, reject) => callSrc("/api/v1/users/" + srcName + "/personal-bests", message, (dataQueue) => {
        guild.members.fetch(discordId).then((member) => {
            // Figure out which roles we need to remove
            allRoles = Object.values(gameRoles).concat(wrRoles).concat(ilWrRoles);
            removeRoles = [];
            for (let role of allRoles) {
                removeRoles.push(role.id);
            }

            member.roles.remove(removeRoles).then((member) => {
                // Save discord/src name link
                srcUser = { discord_id: `${discordId}`, src_name: `${srcName}` };
                client.addSrcUser.run(srcUser);

                // Figure out what roles user should have from races + src
                rolesShouldHave = getRaceRoles(discordId);
                numWrs = 0;
                numIlWrs = 0;
                JSON.parse(dataQueue).data.forEach((d) => {
                    if (!Object.values(gameIds).includes(d.run.game)) {
                        // Not an LBP game
                        return;
                    }
                    if (gameRoles[d.run.game]) {
                        rolesShouldHave.add(gameRoles[d.run.game]);
                    }
                    if (d.place === 1) {
                        if (d.run.level !== null || fullGameCatsThatAreILs.includes(d.run.category)) {
                            numIlWrs++;
                        } else {
                            numWrs++;
                        }
                    }
                });
                helpers.log(member.displayName + ":\t" + numIlWrs + " IL Wrs / " + numWrs + " Wrs");
                if (numWrs > 0) {
                    if (numWrs > wrRoles.length) {
                        numWrs = wrRoles.length;
                    }
                    rolesShouldHave.add(wrRoles[numWrs - 1]);
                }
                if (numIlWrs >= 100) {
                    rolesShouldHave.add(ilWrRoles[14]);
                } else if (numIlWrs >= 90) {
                    rolesShouldHave.add(ilWrRoles[13]);
                } else if (numIlWrs >= 80) {
                    rolesShouldHave.add(ilWrRoles[12]);
                } else if (numIlWrs >= 70) {
                    rolesShouldHave.add(ilWrRoles[11]);
                } else if (numIlWrs >= 60) {
                    rolesShouldHave.add(ilWrRoles[10]);
                } else if (numIlWrs >= 50) {
                    rolesShouldHave.add(ilWrRoles[9]);
                } else if (numIlWrs >= 40) {
                    rolesShouldHave.add(ilWrRoles[8]);
                } else if (numIlWrs >= 30) {
                    rolesShouldHave.add(ilWrRoles[7]);
                } else if (numIlWrs >= 20) {
                    rolesShouldHave.add(ilWrRoles[6]);
                } else if (numIlWrs >= 10) {
                    rolesShouldHave.add(ilWrRoles[5]);
                } else if (numIlWrs >= 5) {
                    rolesShouldHave.add(ilWrRoles[4]);
                } else if (numIlWrs > 0) {
                    rolesShouldHave.add(ilWrRoles[numIlWrs - 1]);
                }
                member.roles.add(Array.from(rolesShouldHave)).then((value) => resolve());
            });

        }).catch((e) => {
            helpers.log(e);
            //helpers.log("SRC role update: '" + discordId + "' is not a member of the LBP speedrunning server. Removing...", true);
            //client.deleteSrcUser.run(discordId);
            resolve();
        });
    }, resolve));
}

// Returns a set of roles from race history
getRaceRoles = (discordId) => {
    rolesShouldHave = new Set();
    client.getUserGamesRan.all(discordId).forEach((race) => {
        role = gameRoles[gameIds[race.game]];
        if (role !== undefined) {
            rolesShouldHave.add(role);
        }

        if (race.game === "Multiple LittleBigPlanet Games") {
            if (race.category === "An3%") {
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet"]]);
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet 2"]]);
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet 3"]]);
            } else if (race.category === "7ny%") {
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet"]]);
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet PSP"]]);
                rolesShouldHave.add(gameRoles[gameIds["Sackboy's Prehistoric Moves"]]);
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet 2"]]);
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet PS Vita"]]);
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet Karting"]]);
                rolesShouldHave.add(gameRoles[gameIds["LittleBigPlanet 3"]]);
            }
        }
    });
    return rolesShouldHave;
}

// Gets data from speedrun.com
// - delay after API call: 1 sec
// - delay after downloading any other sr.c page: 10 sec
// API: https://github.com/speedruncomorg/api/tree/master/version1
callSrc = (path, message, onEnd, onError = () => {}) => {
    afterPause = () => {
        helpers.log("API call: " + path);
        https.get({
            hostname: "www.speedrun.com",
            path: path,
            port: 443,
            headers: { 'User-Agent': 'bingo-bot/1.0' }
        }, (result) => {
            var { statusCode } = result;
            if (statusCode === 302) {
                callSrc(result.headers.location, message, onEnd);
                return;
            }
            if (statusCode !== 200) {
                errorMsg = "Couldn't follow https://www.speedrun.com" + path + "; got a " + statusCode + " response.";
                if (message != null) {
                    message.channel.send(errorMsg);
                }
                helpers.log(errorMsg, true);
                return;
            }
            var dataQueue = "";
            result.on("data", (dataBuffer) => {
                dataQueue += dataBuffer;
            });
            result.on("end", () => {
                onEnd(dataQueue);
            });
        }).on('error', (e) => {
            helpers.log(e, true);
            helpers.sendErrorMessage(e, path, message);
            onError();
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

// Returns true if the given discord ID is a mod or admin in the server
isAdmin = async (discordId) => {
    member = await guild.members.fetch(discordId);
    return member && member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator");
}
