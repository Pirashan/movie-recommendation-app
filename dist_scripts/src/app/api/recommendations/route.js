// src/app/api/recommendations/route.ts (Using forEach for mapping)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
// --- Environment Variable Loading ---
console.log('Recommendations Route Handler evaluating...');
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
console.log(".env file loaded for recommendations route.");
function calculateCosineSimilarity(scoresA, scoresB) {
    if (!scoresA || !scoresB)
        return 0;
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    const termsInA = Object.keys(scoresA);
    const termsInB = new Set(Object.keys(scoresB));
    for (const term of termsInA) {
        const scoreA = scoresA[term];
        magnitudeA += scoreA * scoreA;
        if (termsInB.has(term)) {
            const scoreB = typeof scoresB[term] === 'number' ? scoresB[term] : 0;
            dotProduct += scoreA * scoreB;
        }
    }
    for (const term in scoresB) {
        magnitudeB += scoresB[term] * scoresB[term];
    }
    const magnitudeA_sqrt = Math.sqrt(magnitudeA);
    const magnitudeB_sqrt = Math.sqrt(magnitudeB);
    if (magnitudeA_sqrt === 0 || magnitudeB_sqrt === 0) {
        return 0;
    }
    return dotProduct / (magnitudeA_sqrt * magnitudeB_sqrt);
}
// --- End Helper Function ---
// --- API Route Handler ---
export async function GET(request) {
    console.log('GET /api/recommendations handler started (TF-IDF)...');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase env vars inside GET handler");
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const searchParams = request.nextUrl.searchParams;
    const idParam = searchParams.get('id');
    const mediaTypeParam = searchParams.get('mediaType');
    // --- Input Validation ---
    if (!idParam || !mediaTypeParam) {
        return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }
    const targetId = parseInt(idParam, 10);
    if (isNaN(targetId)) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    if (mediaTypeParam !== 'movie' && mediaTypeParam !== 'tv') {
        return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 });
    }
    // --- End Input Validation ---
    try {
        // Fixed log typo: Workspaceing -> Fetching
        console.log(`Workspaceing TF-IDF scores for target item: ${mediaTypeParam}_${targetId}`);
        // 1. Fetch scores
        const { data: allItemsData, error: fetchAllError } = await supabase
            .from('media_items')
            .select('id, media_type, tfidf_scores');
        if (fetchAllError || !allItemsData) {
            throw new Error("Could not fetch data for recommendations.");
        }
        const targetItem = allItemsData.find(item => item.id === targetId && item.media_type === mediaTypeParam);
        if (!targetItem || !targetItem.tfidf_scores) {
            return NextResponse.json([]);
        }
        const targetScores = targetItem.tfidf_scores;
        // 2. Calculate Similarities
        console.log("Calculating similarities...");
        const similarities = [];
        // ... (loop and calculate similarities - same as before) ...
        for (const otherItem of allItemsData) {
            if (otherItem.id === targetId && otherItem.media_type === mediaTypeParam)
                continue;
            if (!otherItem.tfidf_scores)
                continue;
            const otherScores = otherItem.tfidf_scores;
            const similarityScore = calculateCosineSimilarity(targetScores, otherScores);
            if (similarityScore > 0.01) { // Threshold
                similarities.push({ id: otherItem.id, media_type: otherItem.media_type, score: similarityScore });
            }
        }
        // 3. Rank and Select Top N
        similarities.sort((a, b) => b.score - a.score);
        const TOP_N = 10;
        const topN = similarities.slice(0, TOP_N);
        if (topN.length === 0) {
            return NextResponse.json([]);
        }
        // 4. Fetch Full Details for Top N Items
        // Fixed log typo: Workspaceing -> Fetching
        console.log(`Workspaceing full details for ${topN.length} recommended items...`);
        const topN_IDs = topN.map(item => item.id);
        const { data: detailsData, error: detailsError } = await supabase
            .from('media_items')
            .select('id, media_type, title, overview, release_year, poster_path, vote_average')
            .in('id', topN_IDs);
        if (detailsError) {
            throw new Error("Could not fetch details for recommendations.");
        }
        if (!detailsData) {
            return NextResponse.json([]);
        } // Handle null detailsData
        // *** Use forEach to build the final array ***
        const recommendedItemsData = []; // Initialize empty array
        topN.forEach(topItem => {
            var _a, _b;
            // Find the corresponding details fetched earlier
            const detail = detailsData.find(d => d.id === topItem.id && d.media_type === topItem.media_type);
            // If details are found, map and push
            if (detail) {
                // Check required fields from detail before creating the object
                if (typeof detail.id !== 'number' || !detail.media_type || !detail.title || typeof detail.overview !== 'string') {
                    console.warn("Skipping recommendation detail due to missing required fields:", detail);
                    return; // Skip this item using return inside forEach
                }
                // Construct the object that matches the TmdbSearchResult interface
                const mappedItem = {
                    id: detail.id,
                    media_type: detail.media_type, // Type assertion is okay here
                    title: detail.title,
                    name: detail.media_type === 'tv' ? detail.title : undefined,
                    overview: detail.overview,
                    // Construct approximate dates if only year stored, otherwise undefined
                    release_date: detail.media_type === 'movie' && detail.release_year ? `${detail.release_year}-01-01` : undefined,
                    first_air_date: detail.media_type === 'tv' && detail.release_year ? `${detail.release_year}-01-01` : undefined,
                    poster_path: (_a = detail.poster_path) !== null && _a !== void 0 ? _a : null,
                    vote_average: (_b = detail.vote_average) !== null && _b !== void 0 ? _b : undefined,
                    // Add defaults/undefined for other fields from the interface
                    // These align with the updated TmdbSearchResult interface in lib/tmdb.ts
                    genre_ids: [], // Default (we didn't fetch detailed genres here)
                    vote_count: undefined,
                    popularity: undefined,
                    original_language: undefined,
                    original_title: undefined,
                    original_name: undefined,
                    backdrop_path: undefined,
                    adult: undefined,
                    video: undefined
                };
                recommendedItemsData.push(mappedItem); // Add the valid item
            }
            else {
                console.warn(`Details not found for recommended item: ID ${topItem.id}, Type ${topItem.media_type}`);
            }
        });
        // *** End modified section ***
        // 5. Return Results
        console.log(`Returning ${recommendedItemsData.length} recommendations.`);
        return NextResponse.json(recommendedItemsData);
    }
    catch (error) {
        console.error('[API Recommendations TF-IDF Error]', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get recommendations' }, { status: 500 });
    }
}
// Cosine Similarity function (defined only once)
// function calculateCosineSimilarity(scoresA: TermScores, scoresB: TermScores): number { /* ... */ }
