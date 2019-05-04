var exports = module.exports = {};

// Given a string (game), returns the name of the closest matching LBP game.
exports.normalizeGameName = (game) => {
    game = game.toLowerCase()
            .replace(new RegExp(" ", 'g'), "")
            .replace(new RegExp("'", 'g'), "")
            .replace("littlebigplanet", "lbp");
    
    if (game === "lbp" || game === "lbp1" || game === "1") {
        return "LittleBigPlanet";

    } else if (game === "psp" || game === "lbppsp" || game === "p") {
        return "LittleBigPlanet PSP";

    } else if (game === "memes"
            || game === "moves"
            || game === "spm"
            || game === "sackboysprehistoricmoves"
            || game === "prehistoricmemes"
            || game === "sackboysprehistoricmemes"
            || game === "lbpspm"
            || game === "lbpsackboysprehistoricmoves"
            || game === "lbpprehistoricmemes"
            || game === "lbpsackboysprehistoricmemes"
            || game === "m") {
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
    } else if (normalizedCategory === "il" || normalizedCategory === "ils" || normalizedCategory === "individuallevel" || normalizedCategory === "individuallevels") {
        return "Individual Levels";
    }

    if (normalizedGame === "LittleBigPlanet") {
        // LBP1-specific categories
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno" || normalizedCategory === "no") {
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
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno" || normalizedCategory === "no" || normalizedCategory === "ng+" || normalizedCategory === "solong+") {
            return "Any% No-Overlord";
        } else {
            return null;
        }

    } else if (normalizedGame === "LittleBigPlanet 3") {
        // LBP3-specific categories
        if (normalizedCategory === "anynooverlord" || normalizedCategory === "anyno" || normalizedCategory === "no" || normalizedCategory === "anynocreate" || normalizedCategory === "anync" || normalizedCategory === "nc") {
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

// this function is so dumb
exports.normalizeLevel = (normalizedGame, level) => {
    level = level.toLowerCase()
            .replace(new RegExp("'", 'g'), "")
            .replace(new RegExp("-", 'g'), "")
            .replace(new RegExp(":", 'g'), "")
            .replace(new RegExp("\\?", 'g'), "")
            .replace(new RegExp("&", 'g'), "and")
            .replace(new RegExp("!", 'g'), "")
            .replace(new RegExp(",", 'g'), "")
            .replace(new RegExp("\\.", 'g'), "")
            .replace(new RegExp("\\(", 'g'), "")
            .replace(new RegExp("\\)", 'g'), "")
            .replace(new RegExp(" ", 'g'), "")
            .replace(new RegExp("the", 'g'), "");
    
    if (normalizedGame === "LittleBigPlanet") {
        // LBP1 levels
        if (level === "intro" || level === "introduction") {
            return "Introduction";
        } else if (level === "firststeps") {
            return "First Steps";
        } else if (level === "getagrip") {
            return "Get a Grip";
        } else if (level === "skatetovictory") {
            return "Skate to Victory";
        } else if (level === "tieskipping") {
            return "Tie Skipping";
        } else if (level === "castleclimbchallenge") {
            return "Castle Climb Challenge";
        } else if (level === "skateboardfreefall") {
            return "Skateboard Freefall";
        } else if (level === "die" || level === "die%") {
            return "Die%";
        }

        else if (level === "swingingsafari") {
            return "Swinging Safari";
        } else if (level === "burningforest") {
            return "Burning Forest";
        } else if (level === "meerkatkingdom") {
            return "The Meerkat Kingdom";
        } else if (level === "flamingseesawseasy") {
            return "Flaming Seesaws - Easy";
        } else if (level === "flamingseesawsmedium") {
            return "Flaming Seesaws - Medium";
        } else if (level === "flamingseesawshard") {
            return "Flaming Seesaws - Hard";
        } else if (level === "tunnelplunge") {
            return "Tunnel Plunge";
        } else if (level === "meerkatbounce") {
            return "Meerkat Bounce";
        } else if (level === "styrofoam" || level === "styrofoam%") {
            return "Styrofoam%";
        }

        else if (level === "weddingreception") {
            return "The Wedding Reception";
        } else if (level === "darkness") {
            return "The Darkness";
        } else if (level === "skulldozer") {
            return "Skulldozer";
        } else if (level === "dangerousdescent") {
            return "The Dangerous Descent";
        } else if (level === "wobblepoles") {
            return "Wobble Poles";
        } else if (level === "bubblelabyrinth") {
            return "Bubble Labyrinth";
        }

        else if (level === "boomtown") {
            return "Boom Town";
        } else if (level === "mines") {
            return "The Mines";
        } else if (level === "serpentshrine") {
            return "Serpent Shrine";
        } else if (level === "wrestlersdrag") {
            return "Wrestler's Drag";
        } else if (level === "cowabunga") {
            return "Cowabunga";
        } else if (level === "rollerruneasy") {
            return "Roller Run - Easy";
        } else if (level === "rollerrunmedium") {
            return "Roller Run - Medium";
        } else if (level === "rollerrunhard") {
            return "Roller Run - Hard";
        } else if (level === "puzzlewheel") {
            return "Puzzle Wheel";
        }

        else if (level === "lowrider") {
            return "Lowrider";
        } else if (level === "subway") {
            return "The Subway";
        } else if (level === "constructionsite") {
            return "The Construction Site";
        } else if (level === "dragrace") {
            return "The Drag Race";
        } else if (level === "elevation") {
            return "Elevation";
        } else if (level === "discombobulator") {
            return "The Discombobulator";
        }
        
        else if (level === "endurancedojo") {
            return "Endurance Dojo";
        } else if (level === "senseislostcastle") {
            return "Sensei's Lost Castle";
        } else if (level === "terribleonisvolcano") {
            return "The Terrible Oni's Volcano";
        } else if (level === "darumasan") {
            return "Daruma San";
        } else if (level === "wheelofmisfortune") {
            return "Wheel of Misfortune";
        } else if (level === "rollercastle") {
            return "Roller Castle";
        }

        else if (level === "dancerscourt") {
            return "The Dancer's Court";
        } else if (level === "elephanttemple") {
            return "Elephant Temple";
        } else if (level === "greatmagicianspalace") {
            return "Great Magician's Palace";
        } else if (level === "shiftingtemple") {
            return "The Shifting Temple";
        } else if (level === "pillarjumping") {
            return "Pillar Jumping";
        } else if (level === "firepits") {
            return "Fire Pits";
        }

        else if (level === "frozentundra") {
            return "The Frozen Tundra";
        } else if (level === "bunker") {
            return "The Bunker";
        } else if (level === "collectorslair") {
            return "The Collector's Lair";
        } else if (level === "collector") {
            return "The Collector";
        } else if (level === "splinerider") {
            return "Spline Rider";
        } else if (level === "rotortubes") {
            return "Rotor Tubes";
        } else if (level === "jetpacktunnel") {
            return "Jetpack Tunnel";
        }

    } else if (normalizedGame === "LittleBigPlanet PSP") {
        // PSP levels
        if (level === "intro" || level === "introduction") {
            return "Introduction";
        } else if (level === "walkabout") {
            return "Walkabout";
        } else if (level === "giftofgrab") {
            return "Gift of the Grab";
        } else if (level === "didgeridoodidgeridont") {
            return "Didgeridoo Didgeridon't";
        } else if (level === "dreamtime") {
            return "Dreamtime";
        }

        else if (level === "mortardo") {
            return "Mortar Do";
        } else if (level === "dragononabite") {
            return "Dragon on a Bite";
        } else if (level === "eggstraction") {
            return "Eggstraction";
        }

        else if (level === "cheekymonkey") {
            return "Cheeky Monkey";
        } else if (level === "thievesden") {
            return "Thieves' Den";
        } else if (level === "rugsnkisses" || level === "highonrugs") {
            return "Rugs n Kisses";
        }

        else if (level === "gethump") {
            return "Get the Hump";
        } else if (level === "sandahoy") {
            return "Sand Ahoy";
        } else if (level === "funpharaoh") {
            return "Fun Pharaoh";
        }

        else if (level === "mountinexcitement") {
            return "Mountin' Excitement";
        } else if (level === "peakperformance") {
            return "Peak Performance";
        } else if (level === "doggeddetermination") {
            return "Dogged Determination";
        }

        else if (level === "stitchgordon") {
            return "Stitch Gordon";
        } else if (level === "fryingsaucers") {
            return "Frying Saucers";
        } else if (level === "sewnidentity") {
            return "The Sewn Identity";
        }

        else if (level === "openingfright") {
            return "Opening Fright";
        } else if (level === "crashingparty") {
            return "Crashing the Party";
        } else if (level === "roadtojoy") {
            return "Road to Joy";
        } else if (level === "carnival") {
            return "The Carnival";
        }

    } else if (normalizedGame === "Sackboy's Prehistoric Moves") {
        // Memes levels
        if (level === "learningtomove") {
            return "Learning to Move";
        } else if (level === "prehistoricparadise") {
            return "Prehistoric Paradise";
        } else if (level === "insidebigrex") {
            return "Inside Big Rex";
        } else if (level === "cromagnoncity") {
            return "Cro-Magnon City";
        } else if (level === "hotstepping") {
            return "Hot Stepping";
        } else if (level === "fossilfight") {
            return "Fossil Fight";
        }
        
    } else if (normalizedGame === "LittleBigPlanet 2") {
        // LBP2 levels
        if (level === "intro" || level === "introduction") {
            return "Introduction";
        } else if (level === "rookietest") {
            return "Rookie Test";
        } else if (level === "grabandswing") {
            return "Grab and Swing";
        } else if (level === "gripplegrapple") {
            return "Gripple Grapple";
        } else if (level === "braverytest") {
            return "Bravery Test";
        } else if (level === "finaltest") {
            return "Final Test";
        } else if (level === "hedgehopping") {
            return "Hedge Hopping";
        } else if (level === "towerofwhoop") {
            return "Tower of Whoop";
        } else if (level === "blockdrop") {
            return "Block Drop";
        } else if (level === "superblockdrop") {
            return "Super Block Drop";
        }

        else if (level === "runawaytrain") {
            return "Runaway Train";
        } else if (level === "brainycakes") {
            return "Brainy Cakes";
        } else if (level === "cakeinator") {
            return "Cakeinator";
        } else if (level === "currantaffairs") {
            return "Currant Affairs";
        } else if (level === "klingklong") {
            return "Kling Klong";
        } else if (level === "rodentderby") {
            return "Rodent Derby";
        } else if (level === "deathbyshockolate") {
            return "Death by Shockolate";
        } else if (level === "attackofmutantmarshmallows") {
            return "Attack of the Mutant Marshmallows";
        }

        else if (level === "maximumsecurity") {
            return "Maximum Security";
        } else if (level === "pipedreams") {
            return "Pipe Dreams";
        } else if (level === "bangforbuck") {
            return "Bang for Buck";
        } else if (level === "wastedisposal") {
            return "Waste Disposal";
        } else if (level === "fowlplay") {
            return "Fowl Play";
        } else if (level === "basketball") {
            return "Basketball";
        } else if (level === "splitpaths") {
            return "Split Paths";
        } else if (level === "sackbotbounce") {
            return "Sackbot Bounce";
        }

        else if (level === "aaaa" || level === "avalonsadvancedarmamentsacademy") {
            return "Avalon's Advanced Armaments Academy";
        } else if (level === "gothump") {
            return "Got the Hump";
        } else if (level === "sackbotredemption") {
            return "The Sackbot Redemption";
        } else if (level === "fitfod" || level === "flyinginfaceofdanger") {
            return "Flying in the Face of Danger";
        } else if (level === "hpfhs" || level === "hugeperilforhugespaceship") {
            return "Huge Peril for Huge Spaceship";
        } else if (level === "onburrowedtime") {
            return "On Burrowed Time";
        } else if (level === "gobotron") {
            return "Gobotron";
        } else if (level === "clickflick") {
            return "Click Flick";
        }

        else if (level === "upandatem") {
            return "Up and At 'Em";
        } else if (level === "patientsareavirtue") {
            return "Patients Are a Virtue";
        } else if (level === "fwyhf" || level === "ffwyhf" || level === "fireflieswhenyourehavingfun") {
            return "Fireflies When You're Having Fun";
        } else if (level === "casadelhigginbotham") {
            return "Casa del Higginbotham";
        } else if (level === "iotbi" || level === "invasionofthebodyinvaders") {
            return "Invasion of the Body Invaders";
        } else if (level === "hungrycaterpillars") {
            return "Hungry Caterpillars";
        } else if (level === "mindcontrol") {
            return "Mind Control";
        } else if (level === "rootcanal") {
            return "Root Canal";
        }

        else if (level === "stcfthotn" || level === "setcontrolsforheartofnegativatron") {
            return "Set the Controls for the Heart of the Negativatron";
        } else if (level === "fullmetalrabbit") {
            return "Full Metal Rabbit";
        } else if (level === "witwiac" || level === "whereinworldisavaloncentrifuge") {
            return "Where in the World is Avalon Centrifuge?";
        } else if (level === "fightofthebumblebee") {
            return "Fight of the Bumblebee";
        } else if (level === "intoheartofnegativitron") {
            return "Into the Heart of the Negativitron";
        } else if (level === "rocketfunland") {
            return "Rocket Funland";
        } else if (level === "pingpangpong") {
            return "Ping Pang Pong";
        } else if (level === "spacepool") {
            return "Space Pool";
        }

    } else if (normalizedGame === "LittleBigPlanet Vita") {
        // LBPV levels
        if (level === "intro" || level === "introduction") {
            return "Introduction";
        } else if (level === "firstlessonsinlocomotion") {
            return "First Lessons In Loco-Motion";
        } else if (level === "swingbopacrobatics") {
            return "Swing-Bop Acrobatics";
        } else if (level === "floundersjumpandjive") {
            return "Flounder's Jump & Jive";
        } else if (level === "palaceofpeculiar") {
            return "Palace Of The Peculiar";
        } else if (level === "pianoofperil") {
            return "Piano of Peril";
        } else if (level === "boncetappin") {
            return "Bonce Tappin'";
        } else if (level === "towerbuilder") {
            return "Tower Builder";
        } else if (level === "wallornothing") {
            return "Wall Or Nothing";
        }

        else if (level === "awanderintoyonder") {
            return "A Wander Into Yonder";
        } else if (level === "cogwheelcreek") {
            return "Cogwheel Creek";
        } else if (level === "oddrocket") {
            return "The Odd Rocket";
        } else if (level === "mineothreat") {
            return "Mine O'Threat";
        } else if (level === "drillerthriller") {
            return "Driller Thriller";
        } else if (level === "flowerpop") {
            return "Flower Pop";
        } else if (level === "streamrace") {
            return "Stream Race";
        }

        else if (level === "hooksandbeats") {
            return "Hooks & Beats";
        } else if (level === "discardfactory") {
            return "The Discard Factory";
        } else if (level === "hightechtunneling") {
            return "High Tech Tunneling";
        } else if (level === "mainframeheist") {
            return "The Mainframe Heist";
        } else if (level === "acapacitorforevil") {
            return "A Capacitor For Evil";
        } else if (level === "airhockey") {
            return "Air Hockey";
        } else if (level === "superboxing") {
            return "Super Boxing";
        } else if (level === "bouncebophop") {
            return "Bounce Bop Hop";
        } else if (level === "collisioncourse") {
            return "Collision Course";
        }

        else if (level === "sparepartpursuit") {
            return "Spare Part Pursuit";
        } else if (level === "threewheeltracks") {
            return "Three Wheel Tracks";
        } else if (level === "makeshifttransportation") {
            return "Makeshift Transportation";
        } else if (level === "anappetiteformetal") {
            return "An Appetite For Metal";
        } else if (level === "flickabullseye") {
            return "Flick-A-Bullseye";
        } else if (level === "toytanks") {
            return "Toy Tanks";
        } else if (level === "chopperthrow") {
            return "Chopper Throw";
        }

        else if (level === "sunshineandshadows") {
            return "Sunshine & Shadows";
        } else if (level === "arecipeforunpleasantness") {
            return "A Recipe For Unpleasantness";
        } else if (level === "highpressurecellar") {
            return "High Pressure Cellar";
        } else if (level === "reanimationstation") {
            return "Re-Animation Station";
        } else if (level === "inclutchesofevil") {
            return "In The Clutches Of Evil";
        } else if (level === "zombiespringtime") {
            return "Zombie Springtime";
        } else if (level === "eyeballmaze") {
            return "Eye Ball Maze";
        } else if (level === "sortingpanic") {
            return "Sorting Panic";
        }

    } else if (normalizedGame === "LittleBigPlanet Karting") {
        // LBPK levels
        if (level === "intro" || level === "introduction" || level === "kartinglessons") {
            return "Karting Lessons";
        } else if (level === "gardengrip") {
            return "Garden Grip";
        } else if (level === "afterwedding") {
            return "After The Wedding";
        } else if (level === "serpentsshrine") {
            return "Serpent's Shrine";
        } else if (level === "minegap") {
            return "Mine The Gap";
        } else if (level === "kingscastle") {
            return "King's Castle";
        } else if (level === "trainingwheels") {
            return "Training Wheels";
        } else if (level === "targetpractice") {
            return "Target Practice";
        } else if (level === "selfdefence") {
            return "Self Defence";
        } else if (level === "savannahrally") {
            return "Savannah Rally";
        } else if (level === "craftworldgp") {
            return "Craftworld GP";
        } else if (level === "sackboyrc") {
            return "Sackboy RC";
        }

        else if (level === "turtleisland") {
            return "Turtle Island";
        } else if (level === "emperorhasnoclues") {
            return "The Emperor Has No Clues";
        } else if (level === "hugemonsterrally") {
            return "Huge Monster Rally";
        } else if (level === "nightrider") {
            return "Night Rider";
        } else if (level === "eggkartin") {
            return "Egg Kartin";
        } else if (level === "egghunt") {
            return "Egg Hunt";
        } else if (level === "starfishin") {
            return "Star Fishin'";
        }

        else if (level === "sugarrush") {
            return "Sugar Rush";
        } else if (level === "currentevents") {
            return "Current Events";
        } else if (level === "cakesonatrain") {
            return "Cakes on a Train";
        } else if (level === "dontgobakingmykart") {
            return "Don't Go Baking My Kart";
        }

        else if (level === "futureperfect") {
            return "Future Perfect";
        } else if (level === "zeppelinsrule") {
            return "Zeppelins Rule!";
        } else if (level === "infalliblebreakfastmachine") {
            return "The Infallible Breakfast Machine";
        } else if (level === "worldsfairinloveandwar") {
            return "World's Fair in Love and War";
        } else if (level === "bestbeforedate") {
            return "Best Before Date";
        } else if (level === "monstertrucks") {
            return "Monster Trucks";
        } else if (level === "tankcombat") {
            return "Tank Combat";
        } else if (level === "stuckinjam") {
            return "Stuck In Jam";
        }

        else if (level === "rootsofallevil") {
            return "Roots Of All Evil";
        } else if (level === "firebugcircuit") {
            return "Firebug Circuit";
        } else if (level === "onwormpath") {
            return "On the Wormpath";
        } else if (level === "venusspeedtraprc") {
            return "Venus Speedtrap RC";
        }

        else if (level === "20beeornot20bee" || level === "2beeornot2bee") {
            return "2.0 Bee Or Not 2.0 Bee";
        } else if (level === "robobuntestchamber") {
            return "RoboBun Test Chamber";
        } else if (level === "hugespaceship") {
            return "Huge Spaceship";
        } else if (level === "lostinbass") {
            return "Lost In Bass";
        } else if (level === "drumsmash") {
            return "Drum Smash";
        } else if (level === "funkholeandbeyond") {
            return "The Funkhole (and Beyond?)";
        } else if (level === "assaultonbatteries") {
            return "Assault on Batteries";
        } else if (level === "ridescroller") {
            return "Ride Scroller";
        } else if (level === "fulltilt") {
            return "Full Tilt";
        }

        else if (level === "garageatendofcraftverse") {
            return "The Garage at the End of the Craftverse";
        }

    } else if (normalizedGame === "LittleBigPlanet 3") {
        // LBP3 levels
        if (level === "intro" || level === "introduction") {
            return "Introduction";
        } else if (level === "needlepointpeaks") {
            return "Needlepoint Peaks";
        } else if (level === "newtonsairship") {
            return "Newton's Airship";
        } else if (level === "stitchemmanor") {
            return "Stitchem Manor";
        } else if (level === "tinpottowers") {
            return "Tinpot Towers";
        }

        else if (level === "highstakesheist") {
            return "High Stakes Heist";
        } else if (level === "deepspacedrivein") {
            return "Deep Space Drive-In";
        } else if (level === "shakerattleandroll") {
            return "Shake, Rattle & Roll";
        } else if (level === "crumblingcrypts") {
            return "Crumbling Crypts";
        } else if (level === "lightscameratraction") {
            return "Lights, Camera, Traction!";
        } else if (level === "guesswhoscomingtodinner") {
            return "Guess Who's Coming To Dinner?";
        } else if (level === "backinsaddle") {
            return "Back In The Saddle";
        } else if (level === "twocompany") {
            return "Two Company";
        } else if (level === "wheeldeal") {
            return "The Wheel Deal";
        } else if (level === "racetostars") {
            return "Race to the Stars";
        }

        else if (level === "goloco") {
            return "Go Loco";
        } else if (level === "furrysoleshotcoals") {
            return "Furry Soles, Hot Coals";
        } else if (level === "flipfloppedfolios") {
            return "Flip-Flopped Folios";
        } else if (level === "tututango") {
            return "Tutu Tango";
        } else if (level === "onlinkofdisaster") {
            return "On The Link Of Disaster";
        } else if (level === "bearwithus") {
            return "Bear With Us";
        } else if (level === "nodrainnogain") {
            return "No Drain No Gain";
        } else if (level === "herethereandeverywhere") {
            return "Here, There and Everywhere";
        }

        else if (level === "masquemakerstower") {
            return "Masque Maker's Tower";
        } else if (level === "bellyofbeast") {
            return "Belly Of The Beast";
        } else if (level === "cloudcaravan") {
            return "Cloud Caravan";
        } else if (level === "greatescape") {
            return "The Great Escape";
        } else if (level === "evenbosseswearhatssometimes") {
            return "Even Bosses Wear Hats Sometimes";
        } else if (level === "battleofairwaves") {
            return "Battle Of The Airwaves";
        } else if (level === "joustintime") {
            return "Joust In Time";
        }
    }

    return null;
}