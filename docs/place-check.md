# The place check

Map Studio 0.4.0 (epic 4 entry 27, R13; EXPERIENCE.md Place a point, Properties panel; DESIGN.md Properties panel). In Edit mode a point's Location in Details carries a **place line**: where the latitude and longitude land, in words, from data the module serves and the browser loads the first time Details shows a point. The check is offline. No position is sent to any service, and nothing is downloaded when the module is built.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway by `e2e/tests/details.spec.mjs`; **[unit]** held by the Jest tests `web/typescript/__tests__/placeCheck.test.ts` and `placeData.test.ts` on a small fixture.

## What Details says

The place line sits under Location's hint for a point item (never for a line or an area), in the secondary text colour (`--neutral-70`), with the tooltip "Places: Natural Earth, GeoNames (CC BY 4.0)". It follows the saved point, and a typed pair once both fields read as numbers, before the pair is finished **[live 8.3.10]**.

| Where the point is | The place line | Example |
| --- | --- | --- |
| In a US county (the states, DC, Puerto Rico and the US Virgin Islands) | The county in the data's own words, the state (not said twice when the county has its name), the country's ISO code | "Lea County, New Mexico, US", "Lafourche Parish, Louisiana, US", "Mayagüez Municipio, Puerto Rico, PR", "District of Columbia, US", "Saint Croix, VI" |
| Elsewhere on land | "Near" the nearest town within 50 km, the state or province, the country | "Near Grande Prairie, Alberta, CA" |
| Elsewhere on land, no town within 50 km | The state or province and the country | "Alberta, CA" |
| Within 1 km of a county or state line | The neighbour across it, after the county (US) or the state or province | "Lea County (near the Texas line), New Mexico, US", "Lea County (near the Eddy County line), New Mexico, US" |
| Offshore, a state or province within 200 km | The sea, then "off" the nearest state or province | "Gulf of Mexico, off Louisiana, US" |
| Offshore, none within 200 km | The sea alone | "North Atlantic Ocean" |
| In an unnamed channel (the Inside Passage, the Danish straits) | "Off" the nearest state or province | "Off British Columbia, CA" |
| In no area and no sea | "No place found here" | |

The rules in order (`placeCheck.ts`, `lookUp`) **[unit]**: a county holding the point; else a state or province holding it; else the smallest sea holding it (a bay before the sea it is in, a named sea before an unnamed channel); else, where the land's and the sea's outlines leave the point in neither, the nearer of the land and the sea within 2 km (a delta, an inland bay or a fjord: Natural Earth draws the two at 1:10 million, a kilometre or two apart, so a point at the shore can fall between them); else "No place found here". A US point takes its state from its county, so the county and the state never disagree at a border. A state line wins over a county line when both are within 1 km; a country's border is a state line. The coast has no neighbour.

**The swap rules.** A latitude past 90 or below -90 whose swap is in range reads "Latitude and longitude look swapped" (for -103.1, 32.7); it needs no data, so it shows while the data loads or after it failed. A pair in no area, on no land and in no sea (where it would read "No place found here", after the 2 km seam), whose swap lands in an area, a sea included, reads "Latitude and longitude may be swapped". A point in a sea reads its sea whatever its swap: an offshore point in the Persian Gulf reads "Persian Gulf, off Bushehr, IR", though its swap is in Ukraine. Any other pair out of range is flagged by the hint as before ("Latitude is -90 to 90 and longitude -180 to 180."), with no place line. A pair out of range is never saved **[live 8.3.10]**; a pair that may be swapped is in range, so it saves as typed: the words only ask the editor to look.

**Loading and failure.** "Looking up the place..." while the data loads; "The place check is not available" when the file cannot be fetched or read (one console warning, `[MapStudio] The place check is not available: ...`). Neither stops a save: every field saves as before **[live 8.3.10]**.

**Zoom to location**, beside Move (before it, so Move keeps its place), moves the map to the saved point at zoom 15 or more (the search's chosen point zoom), centred in the map less the top row; the selection and Details stay, and nothing is saved. It stays on while the fields are paused or the kind is unknown, since it only moves the map **[live 8.3.10]**.

For tests: the Location row's `data-place` and the place line `.mapstudio-field-place` with `data-place` (`found`, `none`, `swapped`, `maybe-swapped`, `loading`, `unavailable`; `out-of-range` on the row only, where no line shows), Latitude and Longitude described by it (`aria-describedby`); Zoom to location `.mapstudio-field-zoom` in `.mapstudio-field-actions` with Move.

## Where the data comes from

| Source | Version | Licence | What is taken |
| --- | --- | --- | --- |
| [Natural Earth 1:10m Admin 1 - States, Provinces](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/) | 5.1.1 | Public domain | 4,596 areas: the English name (`name_en`; a US state its own `name`, since DC's English name reads "Washington"), the ISO country code (`iso_a2`; the country's name where Natural Earth gives none, as for Somaliland) |
| [Natural Earth 1:10m Admin 2 - Counties](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/) | 5.1.1 | Public domain | 3,224 US counties: the name in the data's own words (`NAME_ALT`: "Lafourche Parish", "Juneau City and Borough", "Carson City"), its name spelt as `NAME_EN` where `NAME` lost its accented letters (Puerto Rico's "Mayagez Municipio" in 5.1.1 reads "Mayagüez Municipio", New Hampshire's "Coos County" "Coös County"), and without a type in brackets (the US Virgin Islands' "Saint Croix (County Equivalent)" reads "Saint Croix"), the state by `REGION` matched to the admin-1 code `US-<REGION>` (all but the US Virgin Islands match; those read their state from the area holding the point) |
| [Natural Earth 1:10m Marine Areas](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-geography-marine-polys/) | 5.1.0 | Public domain | 306 seas, bays, gulfs and channels (`name`; `name_en` where the name is in capitals, so "INDIAN OCEAN" reads "Indian Ocean") |
| [GeoNames cities5000](https://download.geonames.org/export/dump/) | the export of 2026-11-07 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 57,461 towns of 5,000 people or more outside the US, Puerto Rico and the US Virgin Islands (their points read their county), leaving out the feature codes PPLX (a section of a town), PPLH, PPLQ, PPLW, PPLCH and PPLR: the name and the position rounded to 0.001 degree |

Each source's URL, version, SHA-256, size and the date it was fetched are in `web/assets/place/sources.json` and in the data file itself. NOTICE credits both, as their licences ask.

## How it is made

`cd web && npm run place-data` (`web/scripts/place-data.mjs`), by hand, never in a build:

1. Downloads the four zip files into `web/build/place-data/` (about 23 MB; a file already there is reused, `--refresh` fetches it again; `--cache <dir>` puts it elsewhere).
2. Simplifies each Natural Earth layer with mapshaper 0.6.121 (MPL-2.0, a dev dependency only, nothing of it ships): Douglas-Peucker at 100 m on the layer's own topology (`-simplify dp interval=100 keep-shapes`), so two neighbours share one simplified line and no gap or overlap opens between them, and no small island is dropped. Then every point is rounded to 0.0001 degree (about 11 m). Borders are within about 100 m of Natural Earth's (border precision A, the owner, 2026-11-07); Natural Earth's own lines at 1:10 million are the larger error, up to a kilometre or two at a coast.
3. Writes `web/assets/place/places.json` (one line of JSON) and its manifest `sources.json`, and fails when the file is over 5,000,000 bytes. Run twice on the same sources it writes the same bytes.

Then `npm test` and commit both files, and update NOTICE when a source's version changed. `npm test` runs `node scripts/place-data.mjs --check` first, offline: the file against the manifest's size and SHA-256, the 5 MB limit, its format, credit and sources (so CI fails on a file changed by hand).

The made file: 4,664,310 bytes, of which the borders' points 3.6 MB (719,000 points of admin-1, 89,000 of counties, 58,000 of seas), the towns 0.8 MB, the names 0.16 MB and the features' arc references 0.1 MB.

## How it is served

The web build copies `web/assets/place/places.json` beside the bundle (`webpack.config.js`, the `CopyPlugin` that copies MapLibre's worker), into the module's `mounted/` resources, and the Gateway serves it at `/res/mapstudio/places.json` as `application/json`. It is never in `MapStudio.js`.

The browser fetches it once per page, when Details first shows a point's location (`PLACES` in `placeCheck.ts`, a kept promise, a failure kept too); opening the editor, a line's or an area's Details, or View mode fetch nothing. Reading it took about 150 ms in Node (JSON parse and decode); a lookup takes well under 5 ms, and the last 64 pairs looked up are kept (the oldest goes first).

What the Gateway sends **[live 8.3.10]**: 4,664,310 bytes, the file as it is. The Gateway compresses nothing under `/res/`, even when the browser accepts gzip (gzip would make it 3.1 MB), and sends no cache headers (no `Cache-Control`, `ETag` or `Last-Modified`), so a new page fetches it again when Details first shows a point. A reverse proxy in front of the Gateway may compress and cache it.

## The file

`places.json`, format `mapstudio-places` version 1, one JSON object:

- `format`, `version`, `credit` (the tooltip's words), `sources` (as in the manifest), `settings` (`intervalMeters` 100, `quantum` 0.0001 degree for borders, `townQuantum` 0.001 degree for towns, `townKm` 50, `offKm` 200, `lineKm` 1, the town codes and countries left out, the simplifier).
- `admin1`, `counties`, `marine`: each a layer `{arcs, rings, names}`; `admin1` adds `countries` (one per area), `counties` adds `states` (each county's admin-1 index, or -1).
- `towns`: `{names, points}`.

Numbers are written as text: base64url characters (`A-Z a-z 0-9 - _`), 5 bits each, low bits first, the 32 bit set on every character but a number's last; a signed number is zigzagged first (0, -1, 1, -2 ... as 0, 1, 2, 3 ...).

- `arcs`: for each arc its point count, then each point's x and y (longitude and latitude over `quantum`) as signed differences from the point before, running on across arcs from 0, 0.
- `rings`: for each feature (in `names` order) its ring count, for each ring its arc count, and for each arc reference the signed difference of its arc index from the reference before (running on across features), times two, plus one when the arc is walked backwards. A feature's parts are flattened into one list of rings and read even-odd; an arc two features share is their border.
- `towns.names`: the names joined by `|` (a `|` in a name is written `/`); `towns.points`: each town's x and y (`(longitude + 180) / townQuantum`, `(latitude + 90) / townQuantum`) as signed differences from the town before, in Z-order so near towns sit together.

## Limits

- Natural Earth at 1:10 million: a point within a kilometre or two of a coast or a line may read the neighbour's side; the 2 km seam rule above covers the shore. A point within 1 km of a line says so, which tells the editor to look.
- A county or state line across the 180th meridian (Chukotka, Fiji, the Aleutians) is not measured across it: such a point reads its own side with no neighbour, and offshore there "off" is measured on one side only.
- In the US the line reads the county, never a town (no US towns are in the file).
- The file is fetched again by every new page that shows a point's Details (no cache headers, above).
