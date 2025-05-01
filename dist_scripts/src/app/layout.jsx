import { Geist, Geist_Mono } from "next/font/google"; // Keep your fonts
import "./globals.css"; // Removed '/styles' part // Make sure globals.css is imported
const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});
const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});
// Updated metadata
export const metadata = {
    title: "Movie Recommender", // Changed title
    description: "Get movie and TV show recommendations", // Changed description
};
export default function RootLayout({ children, }) {
    return (<html lang="en">
      {/* Keep existing font variables, add antialiased */}
      {/* ADDED: dark class, bg-gray-900, text-gray-100 */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased dark bg-gray-900 text-gray-100`}>
        {children}
      </body>
    </html>);
}
