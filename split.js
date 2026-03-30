const fs = require('fs');

const content = fs.readFileSync('content.js', 'utf8');

const s1 = 'function normalizeAuthorName';
const s2 = 'function isAutoHuntEnabled';
const s3 = 'async function analyzePokemon';

const i1 = content.indexOf(s1);
const i2 = content.indexOf(s2);
const i3 = content.indexOf(s3);

let part1 = content.slice(0, i1);
let part2 = content.slice(i1, i2);
let part3 = content.slice(i2, i3);
let part4 = content.slice(i3);

// Replace let with var in constants.js
part1 = part1.replace(/^let /gm, 'var ');

fs.writeFileSync('constants.js', part1);
fs.writeFileSync('discord.js', part2);
fs.writeFileSync('automation.js', part3);
fs.writeFileSync('content.js', part4);

// Update manifest.json
const manifestPath = 'manifest.json';
const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);

for (const scriptRule of manifest.content_scripts) {
    if (scriptRule.js && scriptRule.js.includes('content.js')) {
        scriptRule.js = [
            'constants.js',
            'discord.js',
            'automation.js',
            'content.js'
        ];
    }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));

console.log('Successfully split code into 4 files and updated manifest.json');
