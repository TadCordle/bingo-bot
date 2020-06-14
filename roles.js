const categories = require('./categories.js');
const emotes = require('./emotes.json');
const https = require('https');
const SQLite = require('better-sqlite3');

var exports = module.exports = {};
var apiCallTimestamp = Date.now();
var autoRefreshTimeout;
var client;
var log;
var guild;
var roles;

const gameIds = {
    "LittleBigPlanet": "369pp31l",
    "LittleBigPlanet PSP": "pd0n821e",
    "Sackboy's Prehistoric Moves": "4d704r17",
    "LittleBigPlanet 2": "pdvzzk6w",
    "LittleBigPlanet PS Vita": "369vz81l",
    "LittleBigPlanet Karting": "pd0n531e",
    "LittleBigPlanet 3": "k6qw8z6g"
    // TODO: Add Sackboy: A Big Adventure
};

const fullGameCategoriesThatAreActuallyILs = [
    "824xr8md",
    "9d8pgl6k"
];

exports.init = (c, l) => {
    let sql = new SQLite("./data/roles.sqlite");
    client = c;
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
        log("Couldn't find all roles; Discord roles may have changed.", true);
    }

    // Setup tables for keeping track of src/discord connections
    if (!sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='src_runners';").get()['count(*)']) {
        sql.prepare("CREATE TABLE src_runners (discord_name TEXT PRIMARY KEY, src_name TEXT);").run();
        sql.pragma("synchronous = 1");
        sql.pragma("journal_mode = wal");
    }

    // Setup SQL queries for setting/retrieving src/discord connections
    client.getUser = sql.prepare("SELECT * FROM src_runners;");
    client.addUser = sql.prepare("INSERT OR REPLACE INTO src_runners (discord_name, src_name) VALUES (@discord_name, @src_name);");
    client.deleteUser = sql.prepare("DELETE FROM src_runners WHERE discord_name = ?;");

    // This will run getUsers once Date.now() is divisible by 86400000 (every day)
    // Timeouts are inaccurate so having a delay of 86400000 would slowly make the 24h cycle shift
    autoRefreshTimeout = setTimeout(refreshAllRoles, 86400000 * Math.ceil(Date.now() / 86400000) - Date.now() + 1);
}

exports.giveRoleFromRace = (discordId, gameName) => {
    member = guild.members.cache.get(discordId);
    if (!member) {
        return;
    }
    member.roles.add(roles[gameIds[gameName]]);
}

exports.roleCmds = (lowerMessage, message) => {
    // Role commands (available anywhere)
    if (lowerMessage.startsWith("!roles"))
        rolesCmd(message);
    
    // TODO: Add disconnect command?

    else if (message.member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator")) {
        if (lowerMessage.startsWith("!reloadroles"))
            reloadRolesCmd(message);
    }
}

// !roles <src name>
rolesCmd = (message) => {
    params = message.content.replace(/^!roles/i, "").trim().split(" ");
    if (params.length !== 1 && params.length !== 2) {
        message.channel.send("Usage: `!roles <speedrun.com name>` (e.g. `!roles RbdJellyfish`)");
        return;
    }
    srcName = params[0];

    // Moderators can update peoples' roles for them
    if (params.length === 2) {
        if (!message.member.roles.cache.some(role => role.name === "Admin" || role.name === "Moderator")) {
            message.channel.send("Usage: `!roles <speedrun.com name>` (e.g. `!roles RbdJellyfish`)");
            return;
        }
        discordId = params[1];
        doRoleUpdates(discordId, srcName);
        return;
    }

    // Check if profile matches caller
    callSrc("/user/" + srcName, (dataQueue) => {
        socialsMatch = dataQueue.match(/<p class='socialicons'>(.*?)<\/p>/);
        if (!dataQueue.match(/class=['"]username/) || !socialsMatch) {
            message.channel.send("Speedrun.com is having a moment, try again later.");
            return;
        }
        socials = socialsMatch[1];

        // Discord
        discordMatch = socials.match(/data-original-title="Discord: (.*?)"/);
        discordName = message.author.username + "#" + message.author.discriminator;
        if (discordMatch && discordMatch[1] === discordName) {
            message.react(emotes.bingo);
            doRoleUpdates(message.author.id, srcName);
            return;
        }

        // TODO: check if SRC linked accounts match any discord linked accounts.
        //       Not currently possible with discord.js :(
        // Twitch
        // Youtube
        // Steam
        // Battle.net
        // Twitter
        // Facebook
    });
}

doRoleUpdates = (discordId, srcName) => {
    callSrc("/api/v1/users/" + srcName + "/personal-bests", (dataQueue) => {
        member = guild.members.cache.get(discordId);
        if (!member) {
            return;
        }
        
        // Save discord/src name link
        srcUser = { discord_name: `${discordId}`, src_name: `${srcName}` };
        client.addUser.run(srcUser);
        
        // Figure out what roles user should have
        rolesShouldHave = new Set();
        data = JSON.parse(dataQueue).data;
        data.forEach((d) => {
            role = roles[d.run.game];
            if (role) {
                rolesShouldHave.add(role);
                if (d.place === 1 && d.run.level === null && !fullGameCategoriesThatAreActuallyILs.includes(d.run.category)) {
                    rolesShouldHave.add(roles["wr"]);
                }
            }
        });

        // Update roles
        Object.values(roles).forEach((role) => {
            if (rolesShouldHave.has(role)) {
                member.roles.add(role);
            } else {
                member.roles.remove(role);
            } 
        });
    });
}

// !reloadroles
reloadRolesCmd = (message) => {
    // TODO
}

refreshAllRoles = () => {
    // TODO
}

// Gets data from speedrun.com
// - delay after API call: 1 sec
// - delay after downloading any other sr.c page: 10 sec
// API: https://github.com/speedruncomorg/api/tree/master/version1
callSrc = (path, onEnd) => {
    afterPause = () => {
        log("API call: " + path);
        https.get({
            hostname: "www.speedrun.com",
            path: path,
            port: 443,
            headers: { 'User-Agent': 'bingo-bot/1.0' }
        }, (result) => {
            var { statusCode } = result;
            if (statusCode === 302) {
                callSrc(result.headers.location, onEnd);
                return;
            }
            if (statusCode !== 200 && statusCode !== 302) {
                log("Couldn't follow https://www.speedrun.com" + path + "; got a " + statusCode + " response.", true);
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
