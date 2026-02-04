import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('match_detail_live.html', 'utf8');
const $ = cheerio.load(html);

// Find "Partnership" text
const partnership = $('*:contains("Partnership")');
console.log(`Found ${partnership.length} "Partnership" elements`);

partnership.each((i: number, el: any) => {
    const element = $(el);
    if (element.children().length === 0) {
        console.log(`\nPartnership Occurrence ${i + 1}:`);
        console.log('Tag:', element.prop('tagName'));
        console.log('Class:', element.attr('class'));
        console.log('Text:', element.text().trim());
        const parents = element.parents().map((i: number, el: any) => `${el.tagName}.${$(el).attr('class') || ''}`).get().reverse().join(' > ');
        console.log('Path:', parents);
    }
});

// Also search for "P'ship"
const pship = $('*:contains("P\'ship")');
console.log(`\nFound ${pship.length} "P'ship" elements`);
pship.each((i: number, el: any) => {
    const element = $(el);
    if (element.children().length === 0) {
        console.log(`\nP'ship Occurrence ${i + 1}:`);
        console.log('Tag:', element.prop('tagName'));
        console.log('Class:', element.attr('class'));
        console.log('Text:', element.text().trim());
        
        const parent = element.parent();
        console.log('Parent Tag:', parent.prop('tagName'));
        console.log('Parent Class:', parent.attr('class'));
        console.log('Parent Text:', parent.text().trim());
        
        const grandParent = parent.parent();
        console.log('GrandParent Tag:', grandParent.prop('tagName'));
        console.log('GrandParent Class:', grandParent.attr('class'));
        console.log('GrandParent Text:', grandParent.text().trim());
    }
});

// Also check for "Batsman" table header
const header = $('*:contains("Batter")').last();
if (header.length) {
    console.log('Found header:', header.prop('tagName'));
    console.log('Header Path:', header.parents().map((i, el) => `${el.tagName}.${$(el).attr('class') || ''}`).get().reverse().join(' > '));
}
