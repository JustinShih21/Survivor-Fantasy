#!/usr/bin/env node
/**
 * Fetches Survivor 50 contestant photos from Survivor Wiki (Fandom).
 * Outputs contestants_with_photos.json for use in seed/migration.
 *
 * Run: node scripts/fetch_survivor50_photos.js
 */

const fs = require("fs");
const path = require("path");

// Survivor 50 cast: id, name, tribe (Tribe A/B/C), wiki slug for URL
// Tribes from Wikipedia: Cila->A, Kalo->B, Vatu->C
const SURVIVOR_50_CAST = [
  // Tribe A (Cila): c01-c08
  { id: "c01", name: "Rick Devens", tribe: "Tribe A", wikiSlug: "Rick_Devens" },
  { id: "c02", name: "Cirie Fields", tribe: "Tribe A", wikiSlug: "Cirie_Fields" },
  { id: "c03", name: "Emily Flippen", tribe: "Tribe A", wikiSlug: "Emily_Flippen" },
  { id: "c04", name: "Christian Hubicki", tribe: "Tribe A", wikiSlug: "Christian_Hubicki" },
  { id: "c05", name: "Joe Hunter", tribe: "Tribe A", wikiSlug: "Joe_Hunter_(Survivor_48)" },
  { id: "c06", name: "Jenna Lewis-Dougherty", tribe: "Tribe A", wikiSlug: "Jenna_Lewis" },
  { id: "c07", name: "Savannah Louie", tribe: "Tribe A", wikiSlug: "Savannah_Louie" },
  { id: "c08", name: "Ozzy Lusth", tribe: "Tribe A", wikiSlug: "Ozzy_Lusth" },
  // Tribe B (Kalo): c09-c16
  { id: "c09", name: "Charlie Davis", tribe: "Tribe B", wikiSlug: "Charlie_Davis_(Survivor_46)" },
  { id: "c10", name: "Tiffany Ervin", tribe: "Tribe B", wikiSlug: "Tiffany_Ervin" },
  { id: "c11", name: "Chrissy Hofbeck", tribe: "Tribe B", wikiSlug: "Chrissy_Hofbeck" },
  { id: "c12", name: "Kamilla Karthigesu", tribe: "Tribe B", wikiSlug: "Kamilla_Karthigesu" },
  { id: "c13", name: "Dee Valladares", tribe: "Tribe B", wikiSlug: "Dee_Valladares" },
  { id: "c14", name: "Coach Wade", tribe: "Tribe B", wikiSlug: "Benjamin_%22Coach%22_Wade" },
  { id: "c15", name: "Mike White", tribe: "Tribe B", wikiSlug: "Mike_White_(filmmaker)" },
  { id: "c16", name: "Jonathan Young", tribe: "Tribe B", wikiSlug: "Jonathan_Young_(Survivor_42)" },
  // Tribe C (Vatu): c17-c24
  { id: "c17", name: "Aubry Bracco", tribe: "Tribe C", wikiSlug: "Aubry_Bracco" },
  { id: "c18", name: "Q Burdette", tribe: "Tribe C", wikiSlug: "Q_Burdette" },
  { id: "c19", name: "Colby Donaldson", tribe: "Tribe C", wikiSlug: "Colby_Donaldson" },
  { id: "c20", name: "Kyle Fraser", tribe: "Tribe C", wikiSlug: "Kyle_Fraser_(Survivor_48)" },
  { id: "c21", name: "Angelina Keeley", tribe: "Tribe C", wikiSlug: "Angelina_Keeley" },
  { id: "c22", name: "Stephenie LaGrossa Kendrick", tribe: "Tribe C", wikiSlug: "Stephenie_LaGrossa" },
  { id: "c23", name: "Genevieve Mushaluk", tribe: "Tribe C", wikiSlug: "Genevieve_Mushaluk" },
  { id: "c24", name: "Rizo Velovic", tribe: "Tribe C", wikiSlug: "Rizo_Velovic" },
];

// Pre_merge_price: preserve distribution from original seed (reuse by position)
const PRICES = [
  150000, 120000, 107500, 107500, 222500, 100000, 130000, 100000, // c01-c08
  122500, 140000, 152500, 100000, 152500, 100000, 147500, 110000, // c09-c16
  125000, 100000, 107500, 100000, 220000, 100000, 160000, 100000, // c17-c24
];

const API_BASE = "https://survivor.fandom.com/api.php";

function toFileName(name) {
  return "S50_" + name.replace(/"/g, "").replace(/\s+/g, "_") + ".jpg";
}

async function fetchImageUrl(filename) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    titles: "File:" + filename,
    iiprop: "url",
  });
  const res = await fetch(`${API_BASE}?${params}`, {
    headers: { "User-Agent": "SurvivorFantasy/1.0 (fetch script)" },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  const pages = data?.query?.pages || [];
  const page = pages[0];
  const url = page?.imageinfo?.[0]?.url;
  return url ? url.split("/revision/")[0] + "/revision/latest" : null;
}

async function main() {
  const output = [];
  const fallbackPhoto = "https://api.dicebear.com/7.x/avataaars/png?seed=survivor&size=80";

  for (let i = 0; i < SURVIVOR_50_CAST.length; i++) {
    const c = SURVIVOR_50_CAST[i];
    const price = PRICES[i] ?? 125000;
    let photoUrl = fallbackPhoto;

    const filename = toFileName(c.name);
    try {
      console.log(`Fetching ${c.name} (${filename})...`);
      const url = await fetchImageUrl(filename);
      if (url) {
        photoUrl = url;
        console.log(`  -> ${photoUrl}`);
      } else {
        const altNames = [
          c.name.replace(" LaGrossa Kendrick", ""),
          c.name.replace(" Lewis-Dougherty", " Lewis"),
          c.name.replace(" Valladares", " Valladares").replace("Dee ", "Dee_"),
        ];
        for (const alt of altNames) {
          if (alt !== c.name) {
            const altUrl = await fetchImageUrl(toFileName(alt));
            if (altUrl) {
              photoUrl = altUrl;
              console.log(`  -> ${photoUrl} (alt)`);
              break;
            }
          }
        }
        if (photoUrl === fallbackPhoto) console.log(`  -> No photo found, using fallback`);
      }
    } catch (err) {
      console.error(`  -> Error: ${err.message}`);
    }

    output.push({
      id: c.id,
      name: c.name,
      starting_tribe: c.tribe,
      pre_merge_price: price,
      photo_url: photoUrl,
    });

    await new Promise((r) => setTimeout(r, 400));
  }

  const outPath = path.join(__dirname, "..", "contestants_with_photos.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${output.length} contestants to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
