// scripts/calculate-vectors.ts (Using Pagination and one-by-one Updates)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import natural from 'natural';
// --- Configuration ---
const ITEMS_PER_UPDATE_BATCH = 50; // How many updates to run concurrently
const DB_FETCH_PAGE_SIZE = 1000; // Fetch rows from Supabase in chunks of this size
// --- End Configuration ---
// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
console.log(".env file loaded.");
// Get Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}
// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
// --- Main Calculation Function ---
async function calculateAndStoreTfidf() {
    console.log("Fetching ALL media items from database (using pagination)...");
    let allItems = [];
    let currentPage = 0;
    let fetchMore = true;
    // *** PAGINATION LOOP ***
    while (fetchMore) {
        const rangeFrom = currentPage * DB_FETCH_PAGE_SIZE;
        const rangeTo = rangeFrom + DB_FETCH_PAGE_SIZE - 1;
        console.log(`Workspaceing rows ${rangeFrom} to ${rangeTo}...`);
        const { data: pageData, error: pageError } = await supabase
            .from('media_items')
            .select('id, media_type, combined_text')
            .range(rangeFrom, rangeTo); // Fetch one page
        if (pageError) {
            console.error(`Error fetching page ${currentPage}:`, pageError);
            fetchMore = false; // Stop fetching on error
            break;
        }
        if (pageData && pageData.length > 0) {
            allItems = allItems.concat(pageData); // Add fetched items to the main list
            // If we fetched less than a full page, we've reached the end
            if (pageData.length < DB_FETCH_PAGE_SIZE) {
                fetchMore = false;
            }
            else {
                currentPage++; // Go to the next page
            }
        }
        else {
            fetchMore = false; // No more data found
        }
    }
    // *** END PAGINATION LOOP ***
    if (allItems.length === 0) {
        console.log("No items found in database to process.");
        return;
    }
    console.log(`Workspaceed a total of ${allItems.length} items. Initializing TF-IDF...`);
    const TfIdf = natural.TfIdf;
    const tfidf = new TfIdf();
    const indexToItemKeyMap = {};
    allItems.forEach((item, index) => {
        const text = String(item.combined_text || '');
        tfidf.addDocument(text);
        indexToItemKeyMap[index] = { id: item.id, media_type: item.media_type };
    });
    console.log(`TF-IDF documents added (${allItems.length}). Calculating scores and updating database (one by one)...`);
    let processedCount = 0;
    let errorCount = 0;
    const totalDocs = allItems.length;
    // Update logic remains the same (one-by-one updates)
    for (let i = 0; i < totalDocs; i++) {
        const itemKey = indexToItemKeyMap[i];
        if (!itemKey) {
            console.warn(`Could not find item key for index ${i}`);
            continue;
        }
        const termScores = {};
        const terms = tfidf.listTerms(i);
        const MAX_TERMS_PER_ITEM = 100;
        terms.slice(0, MAX_TERMS_PER_ITEM).forEach(termInfo => {
            termScores[termInfo.term] = parseFloat(termInfo.tfidf.toFixed(4));
        });
        try {
            const { error: updateError } = await supabase
                .from('media_items')
                .update({
                tfidf_scores: termScores,
                updated_at: new Date().toISOString()
            })
                .match({ id: itemKey.id, media_type: itemKey.media_type });
            if (updateError) {
                console.error(`Supabase update error for ${itemKey.media_type}_${itemKey.id}:`, updateError);
                errorCount++;
            }
            processedCount++;
            if (processedCount % 100 === 0 || processedCount === totalDocs) {
                console.log(`Processed ${processedCount}/${totalDocs} items...`);
            }
        }
        catch (e) {
            console.error(`Unexpected error during update for ${itemKey.media_type}_${itemKey.id}:`, e);
            errorCount++;
        }
    }
    console.log(`\n--- Finished calculating and attempting to store TF-IDF scores ---`);
    console.log(`Total items processed: ${processedCount}`);
    console.log(`Total update errors: ${errorCount}`);
}
// Run the main function
calculateAndStoreTfidf().catch(error => {
    console.error("Unhandled error running calculateAndStoreTfidf:", error);
    process.exit(1);
});
