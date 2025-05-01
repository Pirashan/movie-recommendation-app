// src/lib/tmdb.ts (Updated TmdbSearchResult Interface)

// No need to import dotenv/path here if not used directly in this file

const apiBaseUrl = 'https://api.themoviedb.org/3';

// --- Interfaces ---
// *** UPDATED INTERFACE to include more optional fields from TMDb ***
export interface TmdbSearchResult {
    // Core Fields often needed
    id: number;
    media_type: 'movie' | 'tv' | 'person'; // Keep 'person' for multi-search typing
    title?: string; // Movie title
    name?: string; // TV name
    overview: string;
    poster_path: string | null;
    genre_ids?: number[]; // We fetch names separately usually

    // Optional common fields (added/made optional)
    release_date?: string; // Movie
    first_air_date?: string; // TV
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    original_language?: string;
    original_title?: string; // Movie original title
    original_name?: string; // TV original name
    backdrop_path?: string | null;
    adult?: boolean;
    video?: boolean; // Usually for movies
}
// *** END UPDATED INTERFACE ***

// Interface for the structure of paginated responses from TMDb (like search, popular, recommendations)
interface TmdbPaginatedResponse {
    page: number;
    results: any[]; // Results can be movies, tv shows, etc. Use any initially.
    total_pages: number;
    total_results: number;
}

// Specific type for TMDb Genre list response
interface TmdbGenreListResponse {
    genres: { id: number; name: string }[];
}

// Specific type for TMDb Keywords response
interface TmdbKeywordsResponse {
    id?: number; // Movie endpoint puts keywords under 'keywords'
    keywords?: { id: number; name: string }[];
    results?: { id: number; name: string }[]; // TV endpoint puts keywords under 'results'
}


// Interfaces for detailed movie/tv responses (if needed, unchanged for now)
export interface TmdbMovieDetails {
    id: number;
    title: string;
    overview: string;
    genres: { id: number; name: string }[];
    keywords?: { keywords: { id: number; name: string }[] }; // From separate keywords call
    // Add other detail fields as needed
}
export interface TmdbTvDetails {
    id: number;
    name: string;
    overview: string;
    genres: { id: number; name: string }[];
    keywords?: { results: { id: number; name: string }[] }; // From separate keywords call
     // Add other detail fields as needed
}
// --- End Interfaces ---


// --- Functions ---

export async function searchMedia(query: string): Promise<TmdbSearchResult[]> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        console.error("TMDB_API_KEY is missing inside searchMedia!");
        throw new Error('TMDB_API_KEY is not defined in environment variables');
    }
    if (!query) return [];
    const url = `${apiBaseUrl}/search/multi?query=${encodeURIComponent(query)}&api_key=${apiKey}&include_adult=false&language=en-US&page=1`;
    try {
        // Use stricter type for response based on expected structure
        const response = await fetch(url);
        if (!response.ok) { console.error(`TMDb Search Error: ${response.status}`); return []; }
        const data = await response.json() as TmdbPaginatedResponse;
        // Filter results and cast to TmdbSearchResult
        return data.results.filter(
            item => item && (item.media_type === 'movie' || item.media_type === 'tv')
        ) as TmdbSearchResult[];
    } catch (error) { console.error('Failed to fetch search from TMDb:', error); return []; }
}


export async function getMediaDetails(id: number, type: 'movie' | 'tv'): Promise<TmdbMovieDetails | TmdbTvDetails | null> {
     const apiKey = process.env.TMDB_API_KEY;
     if (!apiKey) { console.error(`TMDB_API_KEY missing in getMediaDetails`); throw new Error('TMDB_API_KEY is not defined'); }

    const detailsUrl = `${apiBaseUrl}/${type}/${id}?api_key=${apiKey}&language=en-US`;
    const keywordsUrl = `${apiBaseUrl}/${type}/${id}/keywords?api_key=${apiKey}`;

    try {
        const [detailsResponse, keywordsResponse] = await Promise.all([
            fetch(detailsUrl),
            fetch(keywordsUrl)
        ]);

         if (!detailsResponse.ok || !keywordsResponse.ok) {
            console.error(`TMDb Detail/Keyword API Error for ${type} ${id}: ${detailsResponse.status} / ${keywordsResponse.status}`);
             return null;
         }
         const details = await detailsResponse.json(); // Type can be TmdbMovieDetails or TmdbTvDetails based on 'type'
         const keywordsData = await keywordsResponse.json() as TmdbKeywordsResponse;

         // Add keywords to details object (handling different structures)
         if (type === 'movie') {
             (details as TmdbMovieDetails).keywords = keywordsData as { keywords: { id: number; name: string }[] };
         } else {
             (details as TmdbTvDetails).keywords = keywordsData as { results: { id: number; name: string }[] };
         }
         return details as (TmdbMovieDetails | TmdbTvDetails);

    } catch (error) { console.error(`Failed to fetch details/keywords for ${type} ${id}:`, error); return null; }
}


export async function getTmdbRecommendations(id: number, mediaType: 'movie' | 'tv'): Promise<TmdbSearchResult[]> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        console.error(`TMDB_API_KEY is missing inside getTmdbRecommendations!`);
        throw new Error('TMDB_API_KEY is not defined in environment variables');
    }
    const url = `${apiBaseUrl}/${mediaType}/${id}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
    console.log("Fetching Recommendations URL:", url);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`TMDb Recommendations API Error: ${response.status} ${response.statusText}`);
            return [];
        }
        const data = await response.json() as TmdbPaginatedResponse;
        // Add media_type and cast results
        const resultsWithType = data.results.map(item => ({
            ...item,
            media_type: mediaType
        }));
        return resultsWithType as TmdbSearchResult[]; // Cast final array
    } catch (error) {
        console.error('Failed to fetch recommendations from TMDb:', error);
        return [];
    }
}


export function getPosterUrl(posterPath: string | null | undefined, size: string = 'w500'): string | null {
    if (!posterPath) { return null; }
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

// Added Genre Map Fetcher (needed by data fetching script)
export async function fetchGenreMapInternal(): Promise<Map<number, string>> {
    const apiKey = process.env.TMDB_API_KEY;
     if (!apiKey) { console.error(`TMDB_API_KEY missing in fetchGenreMapInternal`); throw new Error('TMDB_API_KEY is not defined'); }

    const genreMap = new Map<number, string>();
    const movieGenresUrl = `${apiBaseUrl}/genre/movie/list?api_key=${apiKey}&language=en-US`;
    const tvGenresUrl = `${apiBaseUrl}/genre/tv/list?api_key=${apiKey}&language=en-US`;

    try {
        const [movieResult, tvResult] = await Promise.all([
            fetch(movieGenresUrl).then(res => res.ok ? res.json() as Promise<TmdbGenreListResponse> : Promise.resolve(null)),
            fetch(tvGenresUrl).then(res => res.ok ? res.json() as Promise<TmdbGenreListResponse> : Promise.resolve(null))
        ]);

        movieResult?.genres?.forEach(genre => genreMap.set(genre.id, genre.name));
        tvResult?.genres?.forEach(genre => genreMap.set(genre.id, genre.name));
    } catch(error) {
        console.error("Failed to fetch genre maps:", error);
        // Return empty map on error, script might handle this
    }
    console.log(`Workspaceed ${genreMap.size} genres (internal helper).`);
    return genreMap;
}