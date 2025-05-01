// src/app/page.tsx
'use client'; // Page now needs to be a Client Component for state and effects

import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from "./components/search/SearchBar";
import RecommendationList from './components/recommendations/RecommendationList'; // Import the new component
import type { TmdbSearchResult } from './lib/tmdb'; // Use relative path from page

export default function Home() {
  // --- State Variables --- (Same as before)
  const [selectedItem, setSelectedItem] = useState<TmdbSearchResult | null>(null);
  const [recommendations, setRecommendations] = useState<TmdbSearchResult[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [errorRecommendations, setErrorRecommendations] = useState<string | null>(null);

  // --- Callback function for SearchBar --- (Same as before)
  const handleItemSelected = useCallback((item: TmdbSearchResult) => {
    console.log('Item selected on Page:', item);
    setSelectedItem(item);
    setRecommendations([]);
    setErrorRecommendations(null);
  }, []);

  // --- Effect to fetch recommendations when selectedItem changes --- (Same as before, fixed log typo)
  useEffect(() => {
    if (!selectedItem) return;

    console.log("--- Debug: Fetching Recommendations ---");
    console.log("Selected Item:", selectedItem);
    console.log("Selected Item ID:", selectedItem.id);
    console.log("Type of ID:", typeof selectedItem.id);
    console.log("Selected Item media_type:", selectedItem.media_type);
    console.log("Type of media_type:", typeof selectedItem.media_type);

    const fetchRecommendations = async () => {
      if (!selectedItem.id || typeof selectedItem.id !== 'number' || !selectedItem.media_type || selectedItem.media_type === 'person') {
          console.error("Selected item is missing ID/media_type, ID is not a number, or is a person.", selectedItem);
          setErrorRecommendations("Invalid item selected for recommendations.");
          setSelectedItem(null);
          setIsLoadingRecommendations(false);
          return;
      }
      setIsLoadingRecommendations(true);
      setErrorRecommendations(null);
      // *** FIXED LOG TYPO ***
      console.log(`Workspaceing recommendations for ${selectedItem.media_type} ID: ${selectedItem.id}`);
      try {
        const response = await fetch(`/api/recommendations?id=${selectedItem.id}&mediaType=${selectedItem.media_type}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || `Failed to fetch recommendations: ${response.status}`);
        }
        const results: TmdbSearchResult[] = await response.json();
        setRecommendations(results);
        console.log('Recommendations received:', results);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
        if (error instanceof Error) { setErrorRecommendations(error.message); }
        else { setErrorRecommendations("An unknown error occurred."); }
        setRecommendations([]);
      } finally {
        setIsLoadingRecommendations(false);
      }
    };
    fetchRecommendations();
  }, [selectedItem]);

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12 md:p-12">
      {/* Search Section */}
      <div className="z-10 w-full max-w-xl items-center justify-center text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Find Your Next Watch
          </h1>
          <p className="text-gray-400 mb-6">
              Search for a movie or TV show to get recommendations.
          </p>
          <div className="mt-6">
              <SearchBar onItemSelected={handleItemSelected} />
          </div>
      </div>

      {/* Recommendations Section */}
      <div className="w-full max-w-6xl mt-4 px-4">
        {/* Title for Recommendations */}
        {selectedItem && !isLoadingRecommendations && !errorRecommendations && recommendations.length > 0 && (
            <h2 className="text-2xl font-semibold text-center mb-6">
                {/* *** FIXED QUOTES using &quot; *** */}
                Recommendations based on &quot;{selectedItem.title || selectedItem.name}&quot;
            </h2>
        )}

        {/* Loading State */}
        {isLoadingRecommendations && ( <p className="text-center text-blue-400 text-lg">Loading Recommendations...</p> )}

        {/* Error State */}
        {errorRecommendations && ( <p className="text-center text-red-500">Error: {errorRecommendations}</p> )}

        {/* No Results State */}
        {!isLoadingRecommendations && !errorRecommendations && selectedItem && recommendations.length === 0 && (
            <p className="text-center text-gray-500">
                 {/* *** FIXED QUOTES using &quot; *** */}
                No recommendations found for &quot;{selectedItem.title || selectedItem.name}&quot;.
            </p>
        )}

        {/* Render RecommendationList Component */}
        {!isLoadingRecommendations && !errorRecommendations && recommendations.length > 0 && (
           <RecommendationList recommendations={recommendations} />
        )}
      </div>
    </main>
  );
}