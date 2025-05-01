// src/lib/tmdb.ts (Updated TmdbSearchResult Interface)
// No need to import dotenv/path here if not used directly in this file
const apiBaseUrl = 'https://api.themoviedb.org/3';
// --- End Interfaces ---
// --- Functions ---
export async function searchMedia(query) {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        console.error("TMDB_API_KEY is missing inside searchMedia!");
        throw new Error('TMDB_API_KEY is not defined in environment variables');
    }
    if (!query)
        return [];
    const url = `${apiBaseUrl}/search/multi?query=${encodeURIComponent(query)}&api_key=${apiKey}&include_adult=false&language=en-US&page=1`;
    try {
        // Use stricter type for response based on expected structure
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`TMDb Search Error: ${response.status}`);
            return [];
        }
        const data = await response.json();
        // Filter results and cast to TmdbSearchResult
        return data.results.filter(item => item && (item.media_type === 'movie' || item.media_type === 'tv'));
    }
    catch (error) {
        console.error('Failed to fetch search from TMDb:', error);
        return [];
    }
}
export async function getMediaDetails(id, type) {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        console.error(`TMDB_API_KEY missing in getMediaDetails`);
        throw new Error('TMDB_API_KEY is not defined');
    }
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
        const keywordsData = await keywordsResponse.json();
        // Add keywords to details object (handling different structures)
        if (type === 'movie') {
            details.keywords = keywordsData;
        }
        else {
            details.keywords = keywordsData;
        }
        return details;
    }
    catch (error) {
        console.error(`Failed to fetch details/keywords for ${type} ${id}:`, error);
        return null;
    }
}
export async function getTmdbRecommendations(id, mediaType) {
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
        const data = await response.json();
        // Add media_type and cast results
        const resultsWithType = data.results.map(item => (Object.assign(Object.assign({}, item), { media_type: mediaType })));
        return resultsWithType; // Cast final array
    }
    catch (error) {
        console.error('Failed to fetch recommendations from TMDb:', error);
        return [];
    }
}
export function getPosterUrl(posterPath, size = 'w500') {
    if (!posterPath) {
        return null;
    }
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}
// Added Genre Map Fetcher (needed by data fetching script)
export async function fetchGenreMapInternal() {
    var _a, _b;
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        console.error(`TMDB_API_KEY missing in fetchGenreMapInternal`);
        throw new Error('TMDB_API_KEY is not defined');
    }
    const genreMap = new Map();
    const movieGenresUrl = `${apiBaseUrl}/genre/movie/list?api_key=${apiKey}&language=en-US`;
    const tvGenresUrl = `${apiBaseUrl}/genre/tv/list?api_key=${apiKey}&language=en-US`;
    try {
        const [movieResult, tvResult] = await Promise.all([
            fetch(movieGenresUrl).then(res => res.ok ? res.json() : Promise.resolve(null)),
            fetch(tvGenresUrl).then(res => res.ok ? res.json() : Promise.resolve(null))
        ]);
        (_a = movieResult === null || movieResult === void 0 ? void 0 : movieResult.genres) === null || _a === void 0 ? void 0 : _a.forEach(genre => genreMap.set(genre.id, genre.name));
        (_b = tvResult === null || tvResult === void 0 ? void 0 : tvResult.genres) === null || _b === void 0 ? void 0 : _b.forEach(genre => genreMap.set(genre.id, genre.name));
    }
    catch (error) {
        console.error("Failed to fetch genre maps:", error);
        // Return empty map on error, script might handle this
    }
    console.log(`Workspaceed ${genreMap.size} genres (internal helper).`);
    return genreMap;
}
