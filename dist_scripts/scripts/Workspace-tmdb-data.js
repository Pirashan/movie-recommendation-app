// scripts/Workspace-tmdb-data.ts (Added De-duplication Logic)
// Consider renaming this file to fetch-tmdb-data.ts for clarity later
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
// --- Configuration ---
// START WITH A SMALL NUMBER (e.g., 1-2) FOR TESTING! Each page is 20 items.
// Increase later once you confirm it works. 500 pages = 10k items per type.
const PAGES_TO_FETCH = 100;
const ITEMS_PER_BATCH = 100; // How many items to upsert to Supabase at once
const API_DELAY_MS = 50; // Delay between TMDb API calls (ms) ~20 req/sec
// --- End Configuration ---
// Load environment variables from .env file in the project root
const envPath = path.resolve(process.cwd(), '.env'); // Ensure .env file exists here
const configResult = dotenv.config({ path: envPath });
if (configResult.error) {
    console.error("Error loading .env file", configResult.error);
    process.exit(1);
}
console.log(".env file loaded successfully.");
// Get credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const tmdbApiKey = process.env.TMDB_API_KEY;
if (!supabaseUrl || !supabaseServiceKey || !tmdbApiKey) {
    console.error("Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY, TMDB_API_KEY)");
    process.exit(1);
}
// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});
const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
// --- Helper Functions ---
// Simple fetch wrapper with error handling and delay for TMDb
async function fetchJson(url) {
    try {
        await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "Could not read error body");
            console.error(`TMDb API Error (${response.status} ${response.statusText}) for ${url}: ${errorBody}`);
            return null;
        }
        return await response.json();
    }
    catch (error) {
        // Fixed typo: Workspace -> Fetch
        console.error(`Workspace error for ${url}:`, error);
        return null;
    }
}
// Fetch genre map (ID -> Name)
async function fetchGenreMap() {
    var _a, _b;
    console.log("Fetching genre maps...");
    const genreMap = new Map();
    const movieGenresUrl = `${TMDB_API_BASE_URL}/genre/movie/list?api_key=${tmdbApiKey}&language=en-US`;
    const tvGenresUrl = `${TMDB_API_BASE_URL}/genre/tv/list?api_key=${tmdbApiKey}&language=en-US`;
    const [movieResult, tvResult] = await Promise.all([
        fetchJson(movieGenresUrl),
        fetchJson(tvGenresUrl)
    ]);
    (_a = movieResult === null || movieResult === void 0 ? void 0 : movieResult.genres) === null || _a === void 0 ? void 0 : _a.forEach(genre => genreMap.set(genre.id, genre.name));
    (_b = tvResult === null || tvResult === void 0 ? void 0 : tvResult.genres) === null || _b === void 0 ? void 0 : _b.forEach(genre => genreMap.set(genre.id, genre.name));
    // Fixed typo: Workspaceed -> Fetched
    console.log(`Workspaceed ${genreMap.size} genres.`);
    return genreMap;
}
// Fetch keywords for a specific item
async function fetchKeywords(id, mediaType) {
    const url = `${TMDB_API_BASE_URL}/${mediaType}/${id}/keywords?api_key=${tmdbApiKey}`;
    const result = await fetchJson(url);
    const keywords = (result === null || result === void 0 ? void 0 : result.keywords) || (result === null || result === void 0 ? void 0 : result.results) || [];
    return keywords.map(kw => kw.name.trim()).filter(Boolean);
}
// Text cleaning function (simple example)
function cleanText(text) {
    if (!text)
        return '';
    return text
        .toLowerCase()
        .replace(/[^\w\s'-]/gi, '') // Keep apostrophes and hyphens
        .replace(/\s+/g, ' ')
        .trim();
}
// --- Main Function ---
async function fetchAndStoreMedia() {
    var _a, _b;
    const genreMap = await fetchGenreMap();
    let itemsToUpsertBatch = []; // Batch array
    let totalItemsFetched = 0; // Count unique items added to batches
    let totalItemsProcessed = 0; // Count items looked at
    // *** Use a Set to track processed keys (mediaType_id) ***
    const processedKeys = new Set();
    // ==============================
    // Fetch and Process Movies
    // ==============================
    console.log("\n--- Fetching Popular Movies ---");
    for (let page = 1; page <= PAGES_TO_FETCH; page++) {
        // Fixed typo: Workspaceing -> Fetching
        console.log(`Workspaceing Movie Page ${page}/${PAGES_TO_FETCH}...`);
        const url = `${TMDB_API_BASE_URL}/movie/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}`;
        const pageResult = await fetchJson(url);
        if (!(pageResult === null || pageResult === void 0 ? void 0 : pageResult.results)) {
            console.warn(`No results for Movie Page ${page}.`);
            continue;
        }
        for (const item of pageResult.results) {
            totalItemsProcessed++;
            if (!item.id || !item.overview || !item.title || item.adult) {
                continue;
            }
            // *** Check if already processed ***
            const uniqueKey = `movie_${item.id}`;
            if (processedKeys.has(uniqueKey)) {
                // console.log(`Skipping duplicate movie ID: ${item.id}`); // Optional: uncomment for verbose logging
                continue; // Skip if already processed in this run
            }
            // Only fetch keywords and process if it's a new item
            const keywords = await fetchKeywords(item.id, 'movie');
            const genreNames = ((_a = item.genre_ids) === null || _a === void 0 ? void 0 : _a.map((id) => genreMap.get(id)).filter(Boolean)) || [];
            const releaseYear = item.release_date ? parseInt(item.release_date.substring(0, 4), 10) : null;
            const combined = [
                cleanText(item.title), cleanText(item.overview),
                ...genreNames.map(g => cleanText(g)).flatMap(g => Array(3).fill(g)),
                ...keywords.map(k => cleanText(k)).flatMap(k => Array(2).fill(k)),
            ].filter(Boolean).join(' ');
            if (!combined) {
                console.warn(`Skipping movie item due to empty combined text: ID ${item.id}`);
                continue;
            }
            itemsToUpsertBatch.push({
                id: item.id, media_type: 'movie', title: item.title,
                overview: item.overview,
                release_year: !isNaN(releaseYear) ? releaseYear : null,
                poster_path: item.poster_path,
                vote_average: typeof item.vote_average === 'number' ? item.vote_average : null,
                genres: genreNames, keywords: keywords, combined_text: combined,
                updated_at: new Date().toISOString(),
            });
            processedKeys.add(uniqueKey); // *** Mark as processed ***
            totalItemsFetched++; // Count successfully processed unique items
            // Upsert if batch is full
            if (itemsToUpsertBatch.length >= ITEMS_PER_BATCH) {
                console.log(`Upserting movie batch of ${itemsToUpsertBatch.length} items...`);
                const { error } = await supabase.from('media_items').upsert(itemsToUpsertBatch, { onConflict: 'id, media_type' });
                if (error)
                    console.error("Supabase movie batch upsert error:", error);
                else
                    console.log("Movie batch upserted successfully.");
                itemsToUpsertBatch = []; // Reset batch
            }
        }
        // Fixed typo: Workspaceed -> Processed
        console.log(`Processed ${totalItemsProcessed} movie items so far (fetched ${totalItemsFetched} unique).`);
    }
    // *** Upsert any remaining MOVIES before processing TV shows ***
    if (itemsToUpsertBatch.length > 0) {
        console.log(`Upserting final movie batch of ${itemsToUpsertBatch.length} items...`);
        const { error } = await supabase.from('media_items').upsert(itemsToUpsertBatch, { onConflict: 'id, media_type' });
        if (error)
            console.error("Supabase final movie batch upsert error:", error);
        else
            console.log("Final movie batch upserted successfully.");
    }
    // *** Clear the batch array before processing TV ***
    itemsToUpsertBatch = [];
    // ==============================
    // Fetch and Process TV Shows
    // ==============================
    console.log("\n--- Fetching Popular TV Shows ---");
    for (let page = 1; page <= PAGES_TO_FETCH; page++) {
        // Fixed typo: Workspaceing -> Fetching
        console.log(`Workspaceing TV Page ${page}/${PAGES_TO_FETCH}...`);
        const url = `${TMDB_API_BASE_URL}/tv/popular?api_key=${tmdbApiKey}&language=en-US&page=${page}`;
        const pageResult = await fetchJson(url);
        if (!(pageResult === null || pageResult === void 0 ? void 0 : pageResult.results)) {
            console.warn(`No results for TV Page ${page}.`);
            continue;
        }
        for (const item of pageResult.results) {
            totalItemsProcessed++;
            if (!item.id || !item.overview || !item.name) {
                continue;
            }
            // *** Check if already processed (using TV key) ***
            const uniqueKey = `tv_${item.id}`;
            if (processedKeys.has(uniqueKey)) {
                // console.log(`Skipping duplicate TV ID: ${item.id}`); // Optional: uncomment for verbose logging
                continue; // Skip if already processed in this run
            }
            // Only fetch keywords and process if it's a new item
            const keywords = await fetchKeywords(item.id, 'tv');
            const genreNames = ((_b = item.genre_ids) === null || _b === void 0 ? void 0 : _b.map((id) => genreMap.get(id)).filter(Boolean)) || [];
            const releaseYear = item.first_air_date ? parseInt(item.first_air_date.substring(0, 4), 10) : null;
            const combined = [
                cleanText(item.name), cleanText(item.overview),
                ...genreNames.map(g => cleanText(g)).flatMap(g => Array(3).fill(g)),
                ...keywords.map(k => cleanText(k)).flatMap(k => Array(2).fill(k)),
            ].filter(Boolean).join(' ');
            if (!combined) {
                console.warn(`Skipping TV item due to empty combined text: ID ${item.id}`);
                continue;
            }
            itemsToUpsertBatch.push({
                id: item.id, media_type: 'tv', title: item.name,
                overview: item.overview,
                release_year: !isNaN(releaseYear) ? releaseYear : null,
                poster_path: item.poster_path,
                vote_average: typeof item.vote_average === 'number' ? item.vote_average : null,
                genres: genreNames, keywords: keywords, combined_text: combined,
                updated_at: new Date().toISOString(),
            });
            processedKeys.add(uniqueKey); // *** Mark as processed ***
            totalItemsFetched++; // Count successfully processed unique items
            // Upsert if batch is full
            if (itemsToUpsertBatch.length >= ITEMS_PER_BATCH) {
                console.log(`Upserting TV batch of ${itemsToUpsertBatch.length} items...`);
                const { error } = await supabase.from('media_items').upsert(itemsToUpsertBatch, { onConflict: 'id, media_type' });
                if (error)
                    console.error("Supabase TV batch upsert error:", error);
                else
                    console.log("TV batch upserted successfully.");
                itemsToUpsertBatch = []; // Reset batch
            }
        }
        // Fixed typo: Workspaceed -> Processed
        console.log(`Processed ${totalItemsProcessed} total items so far (fetched ${totalItemsFetched} unique).`);
    }
    // *** Upsert any remaining TV SHOWS ***
    if (itemsToUpsertBatch.length > 0) {
        console.log(`Upserting final TV batch of ${itemsToUpsertBatch.length} items...`);
        const { error } = await supabase.from('media_items').upsert(itemsToUpsertBatch, { onConflict: 'id, media_type' });
        if (error)
            console.error("Supabase final TV batch upsert error:", error);
        else
            console.log("Final TV batch upserted successfully.");
    }
    // Updated final log message
    console.log(`\n--- Finished fetching and storing data. Total unique items fetched/processed: ${totalItemsFetched} ---`);
}
// Run the main function
fetchAndStoreMedia().catch(error => {
    console.error("Unhandled error running fetchAndStoreMedia:", error);
    process.exit(1);
});
