// src/app/components/search/SearchSuggestions.tsx
import React from 'react';
import Image from 'next/image'; // Use Next.js Image for optimization
import type { TmdbSearchResult } from '../../lib/tmdb'; // Use relative path
import { getPosterUrl } from '../../lib/tmdb'; // Use relative path

interface SearchSuggestionsProps {
  suggestions: TmdbSearchResult[];
  loading: boolean;
  onSuggestionClick: (suggestion: TmdbSearchResult) => void; // Callback when an item is clicked
}

export default function SearchSuggestions({
  suggestions,
  loading,
  onSuggestionClick,
}: SearchSuggestionsProps) {

  // Don't render anything if loading OR if not loading but no suggestions found
  if (loading || (!loading && suggestions.length === 0)) {
     // You could optionally show a "No results found" message here if !loading && suggestions.length === 0 && query was entered
     // Or keep it clean and show nothing
    return null;
  }

  return (
    <ul
      id="search-suggestions-listbox"
      className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto"
      role="listbox" // Accessibility: identifies this as a list box
    >
      {suggestions.map((item) => {
        const title = item.title || item.name; // Use title for movie, name for TV
        const releaseYear = item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4);
        const posterUrl = getPosterUrl(item.poster_path, 'w92'); // Get smaller poster size

        return (
          <li
            key={item.id}
            onClick={() => onSuggestionClick(item)} // Call handler on click
            className="flex items-center p-3 hover:bg-gray-700 cursor-pointer transition duration-150 ease-in-out"
            role="option" // Accessibility
            aria-selected="false" // Manage aria-selected if implementing keyboard nav
          >
            {/* Poster Image */}
            <div className="flex-shrink-0 mr-3">
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={title || 'Poster'}
                  width={40} // Smaller image size
                  height={60} // Adjust height based on aspect ratio (approx 1:1.5)
                  className="rounded object-cover"
                  unoptimized={process.env.NODE_ENV === 'development'} // Prevent errors with external URLs in dev
                />
              ) : (
                // Placeholder if no poster
                <div className="w-[40px] h-[60px] bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
                  No Image
                </div>
              )}
            </div>

            {/* Title and Year */}
            <div className='text-left'>
              <span className="font-medium text-sm text-gray-100">{title}</span>
              {releaseYear && (
                <span className="block text-xs text-gray-400">{releaseYear}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}