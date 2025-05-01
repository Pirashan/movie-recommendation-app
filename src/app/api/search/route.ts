// src/app/api/search/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import dotenv from 'dotenv'; // Import dotenv
// Configure dotenv IMMEDIATELY - adjust path if your file is .env.local
// This tells dotenv to load variables from the specified file into process.env
dotenv.config({ path: './.env' }); // Use './.env.local' if you renamed it back
import { searchMedia, TmdbSearchResult } from '../../lib/tmdb'; // Use relative path to lib

export async function GET(request: NextRequest) {
  // Get the search query from the URL parameters (e.g., /api/search?query=...)
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter is required' },
      { status: 400 } // Bad Request
    );
  }

  try {
    // Call the server-side function that uses the API key
    const results: TmdbSearchResult[] = await searchMedia(query);
    // Return the results obtained from TMDb
    return NextResponse.json(results);

  } catch (error) {
    console.error('[API Search Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch search results' },
      { status: 500 } // Internal Server Error
    );
  }
}