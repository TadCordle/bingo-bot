var exports = module.exports = {};

exports.funCmds = (lowerMessage, message) => {
    // Fun commands (available anywhere)
    if (lowerMessage.startsWith("!nr") || lowerMessage.startsWith("!newrunner"))
        newRunnerCmd(message);
}

// !nr/!newrunner
const runnerPrefixes = ["KaDi", "p-p", "Rbd",       "Liam",  "Wiigo", "Slen", "Krosso", "Gen",  "Loud",   "Steel",    "MJG", "teddy", "Darkened", "bross", "Fire",   "S0ul",  "super", "Orca",  "Ads",  "Sean",    "King", "Panda",   "The",      "Mzze", "Black",    "Creator", "a50_Caliber", "ItsDa", "Retro",     "tip",     "laki", "Fr",  "A2on",  "Obed", "AB", "Shrimpii", "xsHI", "Lombax",  "Plop", "Azure",    "MyPair",  "Sky",     "Inclusion", "MajorLeague", "TheReal", "stoic", "Gel", "Mega_Mario", "Pro", "Dbp",    "dyn",  "Glitch",  "fri", "Ricky", "pringles", "TylerThe", "Ril", "artic",    "Real",     "Zachi"];
const runnerSuffixes = ["Wa",   "-j",  "Jellyfish", "12221", "cadee", "ds",   "TV",     "rist", "Orange", "Colossus", "HD",  "bhur",  "_Duck",    "entia", "Thieff", "moose", "socko", "straw", "FFFF", "Vertigo", "sadd", "Truenoo", "Glitcher", "TK",   "Chaos322", "Creepy",  "_Camel",      "Baest", "gamer1246", "daddy78", "tu97", "ika", "Craft", "G45",  "K",  "Boii",     "MEsx", "_Pieboy", "Plip", "Kirby351", "OfSocks", "Akiyama", "_Star",     "Mudkip",      "Sampai",  "_rose", "ly",  "_Man",       "xy",  "Gaming", "o900", "Mazter7", "tt",  "Pipe",  "_fan",     "Dragon",   "po",  "willow28", "Lalo2795", "nator"];

newRunnerCmd = (message) => {
    message.channel.send(runnerPrefixes[Math.floor(Math.random() * runnerPrefixes.length)] + runnerSuffixes[Math.floor(Math.random() * runnerSuffixes.length)]);
}