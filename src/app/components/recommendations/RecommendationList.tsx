// src/app/components/recommendations/RecommendationList.tsx
import React from 'react';
import Image from 'next/image';
import type { TmdbSearchResult } from '../../lib/tmdb'; // Relative path
import { getPosterUrl } from '../../lib/tmdb'; // Relative path

interface RecommendationListProps {
  recommendations: TmdbSearchResult[];
  // We might add isLoading here later for skeleton loading, but for now just needs the list
}

export default function RecommendationList({ recommendations }: RecommendationListProps) {
  if (!recommendations || recommendations.length === 0) {
    // Should generally be handled by the parent page's logic,
    // but good to have a fallback just in case.
    return null;
  }

  return (
    // Responsive grid layout
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
      {recommendations.map((item) => {
        const title = item.title || item.name;
        const posterUrl = getPosterUrl(item.poster_path, 'w342'); // Slightly larger poster
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A'; // Format rating

        return (
          // Individual Recommendation Card
          <div key={item.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform duration-200 ease-in-out hover:scale-105 cursor-pointer">
            {/* Poster */}
            <div className="relative aspect-[2/3]"> {/* Maintain aspect ratio */}
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={title || 'Poster'}
                  fill // Use fill to cover the container
                  className="object-cover" // Cover the area
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16.6vw" // Help browser optimize image loading
                  unoptimized={process.env.NODE_ENV === 'development'}
                />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                  No Image
                </div>
              )}
               {/* Rating Badge (Optional) */}
               <div className="absolute top-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded">
                    ⭐ {rating}
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="text-sm font-semibold text-gray-100 truncate" title={title}>
                {title}
              </h3>
              {/* Optionally add year or other info here if desired */}
              {/* <p className="text-xs text-gray-400">{item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4)}</p> */}
            </div>
          </div>
        );
      })}
    </div>
  );
}