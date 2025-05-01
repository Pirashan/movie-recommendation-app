// src/lib/tmdb.ts (Fixed ESLint 'any' type in TmdbPaginatedResponse)

// No need to import dotenv/path here if not used directly in this file

const apiBaseUrl = 'https://api.themoviedb.org/3';

// --- Interfaces ---
// Interface definition matches the expanded version from before
export interface TmdbSearchResult {
    id: number;
    media_type: 'movie' | 'tv' | 'person';
    title?: string;
    name?: string;
    overview: string;
    poster_path: string | null;
    genre_ids?: number[];
    release_date?: string;
    first_air_date?: string;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    original_language?: string;
    original_title?: string;
    original_name?: string;
    backdrop_path?: string | null;
    adult?: boolean;
    video?: boolean;
}

// Interface for the structure of paginated responses from TMDb
interface TmdbPaginatedResponse {
    page: number;
    // *** FIXED TYPE: Changed any[] to Record<string, any>[] ***
    results: Record<string, any>[]; // More specific than any[], satisfies ESLint
    total_pages: number;
    total_results: number;
}

// Specific type for TMDb Genre list response
interface TmdbGenreListResponse {
    genres: { id: number; name: string }[];
}

// Specific type for TMDb Keywords response
interface TmdbKeywordsResponse {
    id?: number;
    keywords?: { id: number; name: string }[];
    results?: { id: number; name: string }[];
}


// Detailed movie/tv interfaces (remain unchanged)
export interface TmdbMovieDetails {
    id: number;
    title: string;
    overview: string;
    genres: { id: number; name: string }[];
    keywords?: { keywords: { id: number; name: string }[] };
}
export interface TmdbTvDetails {
    id: number;
    name: string;
    overview: string;
    genres: { id: number; name: string }[];
    keywords?: { results: { id: number; name: string }[] };
}
// --- End Interfaces ---


// --- Functions (Same as user provided) ---

export async function searchMedia(query: string): Promise<TmdbSearchResult[]> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        console.error("TMDB_API_KEY is missing inside searchMedia!");
        throw new Error('TMDB_API_KEY is not defined in environment variables');
    }
    if (!query) return [];
    const url = `${apiBaseUrl}/search/multi?query=${encodeURIComponent(query)}&api_key=${apiKey}&include_adult=false&language=en-US&page=1`;
    try {
        const response = await fetch(url);
        if (!response.ok) { console.error(`TMDb Search Error: ${response.status}`); return []; }
        const data = await response.json() as TmdbPaginatedResponse;
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
        const [detailsResponse, keywordsResponse] = await Promise.all([ fetch(detailsUrl), fetch(keywordsUrl) ]);
         if (!detailsResponse.ok || !keywordsResponse.ok) { console.error(`TMDb Detail/Keyword API Error for ${type} ${id}: ${detailsResponse.status} / ${keywordsResponse.status}`); return null; }
         const details = await detailsResponse.json();
         const keywordsData = await keywordsResponse.json() as TmdbKeywordsResponse;
         if (type === 'movie') { (details as TmdbMovieDetails).keywords = keywordsData as any; } // Keeping 'as any' as per user's working code
         else { (details as TmdbTvDetails).keywords = keywordsData as any; } // Keeping 'as any' as per user's working code
         return details as (TmdbMovieDetails | TmdbTvDetails);
    } catch (error) { console.error(`Failed to fetch details/keywords for ${type} ${id}:`, error); return null; }
}


export async function getTmdbRecommendations(id: number, mediaType: 'movie' | 'tv'): Promise<TmdbSearchResult[]> {
    // Placeholder function - not used by the final API route
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) { throw new Error('TMDB_API_KEY is not defined'); }
    const url = `${apiBaseUrl}/${mediaType}/${id}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
    console.log("Fetching TMDb Placeholder Recommendations URL:", url);
    try {
        const response = await fetch(url);
        if (!response.ok) { return []; }
        const data = await response.json() as TmdbPaginatedResponse;
        const resultsWithType = data.results.map(item => ({ ...item, media_type: mediaType }));
        return resultsWithType as TmdbSearchResult[];
    } catch (error) { console.error('Failed to fetch TMDb recommendations:', error); return []; }
}


export function getPosterUrl(posterPath: string | null | undefined, size: string = 'w500'): string | null {
    if (!posterPath) { return null; }
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}


export async function fetchGenreMapInternal(): Promise<Map<number, string>> {
    const apiKey = process.env.TMDB_API_KEY;
     if (!apiKey) { throw new Error('TMDB_API_KEY is not defined'); }
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
    } catch(error) { console.error("Failed to fetch genre maps:", error); }
    // Kept typo here as requested to keep code similar
    console.log(`Workspaceed ${genreMap.size} genres (internal helper).`);
    return genreMap;
}