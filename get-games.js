import { buildAuthorization, getConsoleIds, getGameList } from "@retroachievements/api";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import JSZip from 'jszip';
import cluster from 'cluster';

const userName = ''; // Replace with your RetroAchievements username
const webApiKey = ''; // Replace with your RetroAchievements API key
const authorization = buildAuthorization({ userName, webApiKey });

const LOCAL_ROM_DIR = fs.readFileSync('./directory.txt', 'utf-8').trim();
const RA_DIR = `${LOCAL_ROM_DIR}RA\\`;

console.log(LOCAL_ROM_DIR);
console.log(RA_DIR);

var consolesPresent = [];

// Moves RA games to new directory
async function moveGames(games) {
    //console.log(games);

    if (!fs.existsSync(RA_DIR)) {
        fs.mkdirSync(RA_DIR);
    }

    for (const game of games) {
        //console.log(game["Path"]);
        //console.log(RA_DIR + game["Path"].split(LOCAL_ROM_DIR).pop());
        fs.rename(game["Path"], RA_DIR + game["Path"].split(LOCAL_ROM_DIR).pop(), function (err) {
            if (err) throw err
        })
    }
}



// Find the matching game for a local ROM file
async function findMatchingGame(allGames, localROMS) {
    let results = [];
    let success = false;

    //Iterate through local ROMS
    for (var i = 0, len1 = localROMS.length; i < len1; i++) {
        success = false;
        //console.log(localROMS[i]);
        //Iterate through allGames, one game at a time
        for (var j = 0, len2 = allGames.length; j < len2; j++) {
            //console.log(allGames[j]["consoleId"]);
            //Skip checking this game if it doesn't have the same consoleId
            if (allGames[j]["consoleId"] != localROMS[i]["consoleId"]) {
                continue;
            }
            //Iterate through all hashes for each game (an array of hashes)
            //for (var k = 0; k < allGames[j]["hashes"].length; k++) {
            for (var k = 0, len3 = allGames[j]["hashes"].length; k < len3; k++) {
                if (allGames[j]["hashes"][k].toLowerCase() == localROMS[i]["Hash"]) {
                    localROMS[i]["Title"] = allGames[j]["title"];
                    localROMS[i]["id"] = allGames[j]["id"];
                    results.push(localROMS[i]);
                    success = true;
                    break;
                }
                if (success == true) break;
            }
            if (success == true) break;
            //console.log(allGames[j]["hashes"]);
            //console.log(localROMS[i]["Hash"]);
        }
    }
    //fs.writeFileSync('./data2.json', JSON.stringify(results, null, 2), 'utf-8');
    return results;
}

// Calculate hash of a local ROM file
function calculateHash(localRomPath) {
    const romData = fs.readFileSync(localRomPath);
    //console.log(crypto.createHash('md5').update(romData).digest('hex'));
    return crypto.createHash('md5').update(romData).digest('hex');
}

//NES Hash (-16 bytes if it starts with NES\1a)
function calculateHashNES(filePath) {
    const readStream = fs.createReadStream(filePath);
    const hash = crypto.createHash('md5');
    let headerDone = false;
    let header;

    return new Promise((resolve, reject) => {
        //console.log("check1");
        readStream.on('data', (chunk) => {
            if (headerDone == true) {
                if (chunk.length > 0) (hash.update(chunk));
            } else {
                header = chunk.slice(0, 4);
                if (header && header.toString('hex') === '4e45531a') {
                    chunk = chunk.slice(16);
                    //console.log("yes");
                } else {
                    //console.log("no");
                }
                headerDone = true;
                if (chunk.length > 0) (hash.update(chunk));
            }

        });
        readStream.on('end', () => {
            //console.log("check4");
            resolve(hash.digest('hex'));
            readStream.close;
        });
        readStream.on('error', (err) => {
            reject(err);
        });
    });
}

function calculateHashSNES(filePath) {
    const fileSize = fs.statSync(filePath).size;
    let skipBytes = 0;
    /*
    const shouldSkipBytes = (fileSize - 8192) % 512 === 0;
    const start = shouldSkipBytes ? 512 : 0;
    */
    if (fileSize % 8192 === 512) {
        skipBytes = 512;
    }

    const readStream = fs.createReadStream(filePath, { skipBytes });
    const hash = crypto.createHash('md5');

    return new Promise((resolve, reject) => {
        readStream.on('data', (chunk) => {
            hash.update(chunk);
        });
        readStream.on('end', () => {
            resolve(hash.digest('hex'));
        });
        readStream.on('error', (err) => {
            reject(err);
        });
    });
}

// Get all games for consoles we know we have ROMS (based on extensions found in checkLocalRoms)
async function getAllGames() {
    const consoles = await getConsoleIds(authorization);
    //console.log(consoles);

    const allGames = [];

    for (const consoleIds of consoles) {
        const consoleName = consoleIds.name;
        if (consolesPresent.indexOf(consoleIds.id) != -1) {
            console.log(`Getting games for console: ${consoleIds.id}  -  ${consoleName} `);

            const games = await getGameList(authorization, {
                consoleId: consoleIds.id,
                shouldOnlyRetrieveGamesWithAchievements: true,
                shouldRetrieveGameHashes: true
            });
            allGames.push(...games.map((g) => ({ ...g, consoleIds })));
        }
    }
    //fs.writeFileSync('./consoleIDs.json', JSON.stringify(consoles, null, 2), 'utf-8');
    fs.writeFileSync('./data.json', JSON.stringify(allGames, null, 2), 'utf-8');

    return allGames;
}

// Helper function to find local ROM files in a directory, used by checkLocalRoms
async function findLocalRoms(path) {

    let localRomFiles = fs.readdirSync(path);
    //localRomFiles = localRomFiles.map(i => path + i);

    /*
    console.log("\nCurrent directory files:");
    localRomFiles.forEach(file => {
        console.log(file);
    });
    */

    return localRomFiles;
}

// Check all ROMs in a directory and store dictionary of those games with their hashes
async function checkLocalRoms(path) {
    const roms = await findLocalRoms(path);
    const gameDict = [];
    //let count = 0;

    const promises = roms.map(async (file, index) => {
        const originalPath = LOCAL_ROM_DIR + file;
        let wasZipped = false;
        let hash;

        //console.log(file);

        //Temporarily unzip any Zip files into their base ROM (later deleted after checks)
        if (file.endsWith('.zip')) {
            wasZipped = true;
            await new Promise((resolve, reject) => {
                //console.log("StartingZip file: " + index);
                fs.readFile(originalPath, function (err, data) {
                    if (err) reject(err);
                    // Unzip the file contents
                    JSZip.loadAsync(data).then(function (zip) {
                        // Loop through each file in the zip archive
                        const unzipPromises = Object.keys(zip.files).map(async function (filename) {
                            // Extract the file
                            const content = await zip.files[filename].async('nodebuffer');
                            // Write the file to disk
                            fs.writeFileSync(path + filename, content);
                            // Rename the extracted file to the original file name
                            file = filename;
                            //console.log(file);
                        });
                        Promise.all(unzipPromises).then(resolve).catch(reject);
                    });
                });
                //console.log("EndingZip file: " + index);
            });
        }

        //console.log("PrePreHash file: " + index + " and " + file);

        const fullPath = LOCAL_ROM_DIR + file;

        //ADD MORE CONSOLES HERE?
        //ALSO HANDLE DIFFERENT HASHING NEEDED?
        //CLEAR BROWSER TABS
        //LAST, DO SOMETHING (OTHER THAN PRINTED LOG) WITH FOUND FILES?

        //Most systems (full hash)

        const fileEnding = file.split('.').pop();
        let consoleID;
        let doPush = true;

        //console.log("PreHash file: " + index + " and " + file);

        switch (fileEnding) {
            case "gb":
                hash = await calculateHash(fullPath);
                consoleID = 4;
                if (consolesPresent.indexOf(4) === -1) {
                    consolesPresent.push(4);
                }
                break;
            case "gbc":
                hash = await calculateHash(fullPath);
                consoleID = 6;
                if (consolesPresent.indexOf(6) === -1) {
                    consolesPresent.push(6);
                }
                break;
            case "gba":
                hash = await calculateHash(fullPath);
                consoleID = 5;
                if (consolesPresent.indexOf(5) === -1) {
                    consolesPresent.push(5);
                }
                break;
            case "gg":
                hash = await calculateHash(fullPath);
                consoleID = 15;
                if (consolesPresent.indexOf(15) === -1) {
                    consolesPresent.push(15);
                }
                break;
            case "md":
                hash = await calculateHash(fullPath);
                consoleID = 1;
                if (consolesPresent.indexOf(1) === -1) {
                    consolesPresent.push(1);
                }
                break;
            case "32x":
                hash = await calculateHash(fullPath);
                consoleID = 10;
                if (consolesPresent.indexOf(10) === -1) {
                    consolesPresent.push(10);
                }
                break;
            case "vb":
                hash = await calculateHash(fullPath);
                consoleID = 28;
                if (consolesPresent.indexOf(28) === -1) {
                    consolesPresent.push(28);
                }
                break;
            case "z64":
            case "n64":
            case "v64":
                hash = await calculateHash(fullPath);
                consoleID = 2;
                if (consolesPresent.indexOf(2) === -1) {
                    consolesPresent.push(2);
                }
                break;
            case "nes":
                hash = await calculateHashNES(fullPath);
                consoleID = 7;
                if (consolesPresent.indexOf(7) === -1) {
                    consolesPresent.push(7);
                }
                break;
            case "sfc":
                hash = await calculateHashSNES(fullPath);
                consoleID = 3;
                if (consolesPresent.indexOf(3) === -1) {
                    consolesPresent.push(3);
                }
                break;
            default:
                console.log(`Unknown file type: ${file}`);
                doPush = false;
                break;
        }

        //console.log("PrePush file: " + index + " and " + file);

        if (doPush) {
            gameDict.push({
                "Name": file,
                "Hash": hash,
                "consoleId": consoleID,
                "Path": originalPath
            });
        }

        //console.log("PostPush file: " + index + " and " + file);

        //Delete unzipped file when done if initially it was zipped (keep just the Zip file basically, the unzipping was temporary)
        if (wasZipped) {
            //console.log("delete: " + fullPath);
            fs.unlink(fullPath, (err) => {
                if (err) {
                    throw err;
                }
                //console.log("Delete File successfully.");
            });
        }

        //console.log("Zip Cleanup: " + index + " and " + file);
    });

    //console.log("PrePromise");
    await Promise.all(promises);
    console.log("Consoles present: " + consolesPresent)
    //console.log(gameDict);
    return gameDict;
}


// Call checkLocalRoms function
const localROMS = await checkLocalRoms(LOCAL_ROM_DIR);
console.log("Check 1");

//Check with proper MD5 technique based on filetype: https://docs.retroachievements.org/Game-Identification/
// Check all roms and store the promises in an array
const allGames = await getAllGames();
console.log("Check 2");

const games = await findMatchingGame(allGames, localROMS);
console.log("Check 3");

await moveGames(games);
