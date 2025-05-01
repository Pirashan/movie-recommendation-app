// src/app/api/recommendations/route.ts (Final TF-IDF Version)

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import type { TmdbSearchResult } from '../../lib/tmdb'; // Ensure path is correct

// --- Environment Variable Loading ---
console.log('Recommendations Route Handler evaluating...');
const envPath = path.resolve(process.cwd(), '.env'); // Uses .env in project root
dotenv.config({ path: envPath });
console.log(".env file loaded for recommendations route.");
// --- End Env Var Loading ---


// --- Cosine Similarity Helper Function (Defined ONCE) ---
interface TermScores {
    // Index signature allowing any string key with a number value
    [key: string]: number;
}

function calculateCosineSimilarity(scoresA: TermScores | null | undefined, scoresB: TermScores | null | undefined): number {
    // Add checks for null/undefined scores objects
    if (!scoresA || !scoresB || typeof scoresA !== 'object' || typeof scoresB !== 'object') {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    const termsInA = Object.keys(scoresA);
    const termsInB = new Set(Object.keys(scoresB)); // Use Set for efficient lookup

    // Calculate dot product and magnitude A
    for (const term of termsInA) {
        // Ensure scoreA is a number
        const scoreA = typeof scoresA[term] === 'number' ? scoresA[term] : 0;
        magnitudeA += scoreA * scoreA;

        // Check if term exists in B and calculate product
        if (termsInB.has(term)) {
            const scoreB = typeof scoresB[term] === 'number' ? scoresB[term] : 0;
            dotProduct += scoreA * scoreB;
        }
    }

    // Calculate magnitude B
    for (const term in scoresB) {
         // Ensure scoreB is a number
        const scoreB = typeof scoresB[term] === 'number' ? scoresB[term] : 0;
        magnitudeB += scoreB * scoreB;
    }

    // Calculate magnitudes
    const magnitudeA_sqrt = Math.sqrt(magnitudeA);
    const magnitudeB_sqrt = Math.sqrt(magnitudeB);

    // Check for zero magnitudes to avoid division by zero
    if (magnitudeA_sqrt === 0 || magnitudeB_sqrt === 0) {
        return 0;
    }

    // Calculate and return cosine similarity
    return dotProduct / (magnitudeA_sqrt * magnitudeB_sqrt);
}
// --- End Helper Function ---


// --- API Route Handler ---
export async function GET(request: NextRequest) {
  console.log('GET /api/recommendations handler started (TF-IDF)...');

  // Initialize Supabase client and check env vars inside handler
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
  if (!idParam || !mediaTypeParam) { return NextResponse.json({ error: 'Missing params' }, { status: 400 }); }
  const targetId = parseInt(idParam, 10);
  if (isNaN(targetId)) { return NextResponse.json({ error: 'Invalid id' }, { status: 400 }); }
  if (mediaTypeParam !== 'movie' && mediaTypeParam !== 'tv') { return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 }); }
  // --- End Input Validation ---

  try {
    console.log(`Workspaceing TF-IDF scores for target item: ${mediaTypeParam}_${targetId}`);

    // 1. Fetch target scores
    const { data: targetItemData, error: targetFetchError } = await supabase
      .from('media_items')
      .select('tfidf_scores, title')
      .match({ id: targetId, media_type: mediaTypeParam })
      .limit(1).single();

    if (targetFetchError) { throw new Error(`Could not fetch target item: ${targetFetchError.message}`); }
    // Check explicitly for null scores field
    if (!targetItemData || typeof targetItemData.tfidf_scores !== 'object' || targetItemData.tfidf_scores === null) {
      console.warn(`Target item ${mediaTypeParam}_${targetId} found, but its scores are missing or invalid.`);
      return NextResponse.json([]);
    }
    console.log(`Scores found for target item "${targetItemData.title}".`);
    const targetScores = targetItemData.tfidf_scores as TermScores; // Assert type after check

    // 2. Identify Top Terms
    const NUMBER_OF_TERMS_TO_MATCH = 15;
    const sortedTerms = Object.entries(targetScores)
        .filter(([, score]) => typeof score === 'number') // Ensure score is number before sorting
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
        .slice(0, NUMBER_OF_TERMS_TO_MATCH)
        .map(([term]) => term);

    if (sortedTerms.length === 0) { console.log("Target has no significant terms."); return NextResponse.json([]); }
    console.log(`Top ${sortedTerms.length} terms for matching:`, sortedTerms);

    // 3. Find Candidate Items using .or() filter
    console.log("Finding candidate items sharing top terms using .or()...");
    const orFilterConditions = sortedTerms.map(term =>
        `tfidf_scores->${term.replace(/'/g, "''")}.not.is.null` // Check key exists
    ).join(',');

    const { data: candidateItemsData, error: candidateFetchError } = await supabase
        .from('media_items')
        .select('id, media_type, title, tfidf_scores')
        .or(orFilterConditions);

    if (candidateFetchError) { console.error("Supabase candidate fetch error:", candidateFetchError); throw new Error(`Error fetching candidates: ${candidateFetchError.message}`); }
    if (!candidateItemsData || candidateItemsData.length === 0) { console.log("No candidates found via '.or()'."); return NextResponse.json([]); }

    // Filter out the exact target item post-fetch
    const filteredCandidates = candidateItemsData.filter(item =>
        !(item.id === targetId && item.media_type === mediaTypeParam)
    );
    console.log(`Found ${filteredCandidates.length} candidate items after filtering target.`);
    if (filteredCandidates.length === 0) { return NextResponse.json([]); }


    // 4. Calculate Similarities for Candidates Only
    console.log("Calculating similarities for candidates...");
    const similarities: { id: number; media_type: string; score: number }[] = [];
    for (const candidateItem of filteredCandidates) {
      // Check if candidate has scores before calculating
      if (candidateItem.tfidf_scores && typeof candidateItem.tfidf_scores === 'object') {
        const candidateScores = candidateItem.tfidf_scores as TermScores;
        const similarityScore = calculateCosineSimilarity(targetScores, candidateScores);
        // Keep low threshold for testing, ensure score is valid number
        if (typeof similarityScore === 'number' && similarityScore > 0.0001) {
            similarities.push({ id: candidateItem.id, media_type: candidateItem.media_type, score: similarityScore });
        }
      }
    }
    console.log(`Found ${similarities.length} items with similarity > 0.0001.`);


    // 5. Rank and Select Top N
    similarities.sort((a, b) => b.score - a.score);
    const TOP_N = 10;
    const topN = similarities.slice(0, TOP_N);
    console.log(`Top ${topN.length} similar items (ID, Type, Score):`, topN.map(item => ({ id: item.id, mt: item.media_type, score: item.score.toFixed(4) })));
    if (topN.length === 0) { console.log("No items passed similarity threshold/ranking."); return NextResponse.json([]); }

    // 6. Fetch Full Details for Top N Items
    console.log(`Workspaceing full details for ${topN.length} recommended items...`);
    const fetchPromises = topN.map(item =>
        supabase
            .from('media_items')
            .select('id, media_type, title, overview, release_year, poster_path, vote_average')
            .match({ id: item.id, media_type: item.media_type })
            .limit(1).single()
    );
    const results = await Promise.all(fetchPromises);

    // 7. Map results
    const recommendedItemsData: TmdbSearchResult[] = [];
    results.forEach(result => { // Iterate through promise results
        if (result && !result.error && result.data) {
            const detail = result.data;
             if (typeof detail.id === 'number' && detail.media_type && detail.title && typeof detail.overview === 'string') {
                const mappedItem: TmdbSearchResult = {
                    id: detail.id, media_type: detail.media_type as 'movie' | 'tv',
                    title: detail.title, name: detail.media_type === 'tv' ? detail.title : undefined,
                    overview: detail.overview,
                    release_date: detail.media_type === 'movie' && detail.release_year ? `${detail.release_year}-01-01` : undefined,
                    first_air_date: detail.media_type === 'tv' && detail.release_year ? `${detail.release_year}-01-01` : undefined,
                    poster_path: detail.poster_path ?? null, vote_average: detail.vote_average ?? undefined,
                    // Default remaining fields from TmdbSearchResult
                    genre_ids: [], vote_count: undefined, popularity: undefined, original_language: undefined,
                    original_title: undefined, original_name: undefined, backdrop_path: undefined,
                    adult: undefined, video: undefined
                };
                recommendedItemsData.push(mappedItem);
             } else { console.warn("Skipping recommendation detail due to missing required fields:", detail); }
        } else { console.error(`Details not found or error fetching for a recommended item`, result?.error); }
    });

    // 8. Return Results
    console.log(`Returning ${recommendedItemsData.length} recommendations.`);
    return NextResponse.json(recommendedItemsData);

  } catch (error) {
    console.error('[API Recommendations TF-IDF Error]', error);
    return NextResponse.json( { error: error instanceof Error ? error.message : 'Failed to get recommendations' }, { status: 500 } );
  }
}

// NOTE: NO duplicate function definition here!