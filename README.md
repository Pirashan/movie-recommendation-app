# Content-Based Movie/TV Recommender (Built with Next.js & Supabase)

This project is a single-page web application that allows users to search for movies or TV shows and receive content-based recommendations for similar items, powered by a custom-built recommendation engine using TF-IDF and Cosine Similarity.

The application features a dynamic search bar with suggestions and displays recommendations based on textual content similarity (overview, genres, keywords) processed from TMDb data stored in a PostgreSQL database hosted on Supabase.

## Features

* **Dynamic Search:** Search for movies and TV shows with suggestions appearing as you type.
* **Custom Recommendations:** Select an item from the search suggestions to receive a list of content-based recommendations calculated "from scratch".
* **Responsive Design:** Simple, dark-mode UI built with Tailwind CSS.

## Live Demo

*(Optional: Add link to your deployed Vercel app here)*
[your-project-name.vercel.app](https://your-project-name.vercel.app)

## Tech Stack

* **Frontend:**
    * [Next.js](https://nextjs.org/) (v14+ with App Router)
    * [React](https://reactjs.org/) (v18+)
    * [TypeScript](https://www.typescriptlang.org/)
    * [Tailwind CSS](https://tailwindcss.com/) (v4)
* **Backend:**
    * Next.js API Routes (Route Handlers)
    * Node.js Runtime
* **Database:**
    * [PostgreSQL](https://www.postgresql.org/) (hosted on [Supabase](https://supabase.com/))
* **Recommendation Engine:**
    * [Natural](https://github.com/NaturalNode/natural) (Node.js NLP library for TF-IDF)
    * Custom Cosine Similarity implementation
* **External APIs:**
    * [TMDb API](https://developer.themoviedb.org/docs) (The Movie Database - for sourcing movie/TV data)
* **Deployment:**
    * [Vercel](https://vercel.com/)
* **Development Tools:**
    * [ts-node](https://github.com/TypeStrong/ts-node) (for running TS scripts)
    * [dotenv](https://github.com/motdotla/dotenv) (for environment variable management in scripts)
    * ESLint / Prettier (Code linting/formatting)

## Custom Recommendation Engine Explained

A core goal of this project was to build the recommendation logic from scratch rather than relying solely on external API recommendations. The system uses a content-based filtering approach based on TF-IDF and Cosine Similarity.

**1. Data Pipeline (Offline Scripts):**

* **Data Source:** Movie and TV show metadata (titles, overviews, genres, keywords) is sourced from the TMDb API.
* **Fetching (`scripts/fetch-tmdb-data.ts`):** A standalone TypeScript script fetches data for a configured number of popular movies and TV shows using TMDb's `/discover` or `/popular` endpoints. It also fetches associated genres and keywords for each item.
    * *Note:* This script needs to be run manually to populate or update the database. It includes delays to respect TMDb API rate limits.
* **Storage (Supabase):** The fetched data is stored in a PostgreSQL table named `media_items` hosted on Supabase. The table uses a composite primary key `(id, media_type)` to uniquely identify each item, as TMDb IDs can overlap between movies and TV shows.
* **Text Preprocessing & Feature Engineering:** For each item, the script performs basic text cleaning (lowercase, remove punctuation) on the `overview`, `genres` (names), and `keywords` (names). It then concatenates these cleaned text fields into a single `combined_text` field, potentially repeating genres and keywords multiple times to give them higher weight in the subsequent analysis. This `combined_text` serves as the "document" representing the item's content.
* **TF-IDF Calculation (`scripts/calculate-vectors.ts`):** Another offline script reads all `media_items` (using pagination to handle potentially large datasets) from the database.
    * It uses the `natural` library's `TfIdf` module.
    * Each item's `combined_text` is added as a document to the TF-IDF processor.
    * The script calculates the TF-IDF score for significant terms within each document.
    * The resulting term-score mapping (e.g., `{"space": 0.8, "future": 0.6, "alien": 0.5, ...}`) is stored as a JSONB object in the `tfidf_scores` column of the `media_items` table. A GIN index is recommended on this column for query performance.

**2. Recommendation Generation (API Route - `/api/recommendations`):**

This API route runs on the server when a user selects an item in the frontend.

* **Input:** Receives the `id` and `media_type` of the user-selected item.
* **Target Scores Fetch:** Retrieves the pre-calculated `tfidf_scores` JSON object for the target item from the Supabase database.
* **Identify Key Terms:** Selects the top N (e.g., 15) terms with the highest TF-IDF scores from the target item's scores.
* **Candidate Selection (Optimized):** Queries the database to efficiently find a subset of *candidate* items. It uses PostgreSQL's JSONB operators (via Supabase client's `.or()` filter mapping to `tfidf_scores->term.not.is.null` checks) along with the GIN index on the `tfidf_scores` column to find items that contain *any* of the target item's key terms. This avoids comparing the target item against the entire database.
* **Fetch Candidate Scores:** Retrieves the `tfidf_scores` for only the candidate items found in the previous step.
* **Similarity Calculation:** Calculates the Cosine Similarity between the target item's `tfidf_scores` object and each candidate item's `tfidf_scores` object using a custom helper function.
* **Ranking & Selection:** Ranks the candidate items based on their cosine similarity score (higher is better) and selects the top N (e.g., 10) results, excluding the target item itself.
* **Result Fetching:** Fetches the full display details (title, poster path, year, etc.) for these top N recommended items from the `media_items` table in Supabase.
* **Output:** Returns a JSON array containing the details of the recommended items to the frontend.

## Project Structure
```
├── /public                 # Static assets
├── /scripts                # Standalone Node.js/TS scripts (data fetching, vector calculation)
│   ├── fetch-tmdb-data.ts  # (Or Workspace-tmdb-data.ts) Fetches data -> Supabase
│   └── calculate-vectors.ts# Calculates TF-IDF -> Supabase
├── /src
│   ├── /app                # Next.js App Router
│   │   ├── /api            # API Route Handlers (search, recommendations)
│   │   │   ├── /search/route.ts
│   │   │   └── /recommendations/route.ts
│   │   ├── /components     # React components
│   │   │   ├── /recommendations
│   │   │   │   └── RecommendationList.tsx
│   │   │   └── /search
│   │   │       ├── SearchBar.tsx
│   │   │       └── SearchSuggestions.tsx
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Main page component
│   ├── /lib                # Shared utilities/helpers
│   │   └── tmdb.ts         # TMDb API helpers & types
│   └── /data               # (Optional) If storing pre-processed data locally initially
├── .env                    # Environment variables (TMDB Key, Supabase Keys - !! ADD TO .gitignore !!)
├── .gitignore
├── next.config.ts          # Next.js configuration (incl. image domains)
├── package.json
├── postcss.config.js       # PostCSS config (for Tailwind)
├── tailwind.config.ts      # Tailwind CSS config
└── tsconfig.json           # TypeScript config
```

## Getting Started (Local Development)

**1. Clone the repository:**
git clone <https://github.com/Pirashan/movie-recommendation-app.git>

cd movie-recommendation-app

**2. Install Dependencies :**
npm install
or
yarn install
or
pnpm install

**3. Set up Environment Variables**
Create a file named .env in the project root
Add the following environment variables with your actual keys:
# Get from TMDb ([https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))
TMDB_API_KEY=your_tmdb_api_key_here

# Get from Supabase Project Settings > API
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here

