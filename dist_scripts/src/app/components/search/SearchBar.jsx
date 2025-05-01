// src/app/components/search/SearchBar.tsx
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import SearchSuggestions from './SearchSuggestions';
export default function SearchBar({ onItemSelected }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debounceTimeoutRef = useRef(null);
    const searchContainerRef = useRef(null);
    const handleInputChange = (event) => {
        const newQuery = event.target.value;
        setQuery(newQuery);
        setShowSuggestions(newQuery.length > 0);
    };
    // fetchSuggestions function remains the same
    const fetchSuggestions = useCallback(async (searchQuery) => {
        if (searchQuery.length < 2) {
            setSuggestions([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            console.log(`Workspaceing from API for: ${searchQuery}`);
            const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch');
            }
            const results = await response.json();
            setSuggestions(results);
            console.log('Suggestions received via API:', results);
        }
        catch (error) {
            console.error("Error fetching suggestions via API:", error);
            setSuggestions([]);
        }
        finally {
            setLoading(false);
        }
    }, []);
    // useEffect for debouncing remains the same
    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        if (query.trim().length < 2) {
            setSuggestions([]);
            setLoading(false);
        }
        else {
            debounceTimeoutRef.current = setTimeout(() => { fetchSuggestions(query); }, 500);
        }
        return () => { if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        } };
    }, [query, fetchSuggestions]);
    // *** UPDATED: handleSuggestionClick now calls the onItemSelected prop ***
    const handleSuggestionClick = (suggestion) => {
        console.log('Suggestion Selected in SearchBar:', suggestion);
        const title = suggestion.title || suggestion.name || '';
        setQuery(title); // Keep setting query for visual feedback
        setSuggestions([]); // Clear suggestions
        setShowSuggestions(false); // Hide suggestions dropdown
        onItemSelected(suggestion); // *** CALL THE PROP FUNCTION ***
    };
    // useEffect for handling clicks outside remains the same
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [searchContainerRef]);
    return (<div className="w-full max-w-md mx-auto relative" ref={searchContainerRef}>
      <input type="text" value={query} onChange={handleInputChange} onFocus={() => query.length > 0 && suggestions.length > 0 && setShowSuggestions(true)} // Also check suggestions exist before showing on focus
     placeholder="Search for a movie or TV show..." className="w-full px-4 py-3 border border-gray-700 rounded-lg shadow-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out" role="combobox" aria-haspopup="listbox" aria-expanded={showSuggestions && suggestions.length > 0} aria-controls="search-suggestions-listbox"/>

      {showSuggestions && (<SearchSuggestions suggestions={suggestions} loading={loading} onSuggestionClick={handleSuggestionClick} // Pass the updated handler
        />)}
    </div>);
}
