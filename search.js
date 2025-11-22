// Lecture Search Application
let allChapters = [];
let fuse = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsDiv = document.getElementById('results');
const statsDiv = document.getElementById('stats');
const filterAVC185 = document.getElementById('filterAVC185');
const filterAVC200 = document.getElementById('filterAVC200');
const filterAVC240 = document.getElementById('filterAVC240');

// Load chapter data
async function loadChapters() {
    try {
        const response = await fetch('chapters.json');
        allChapters = await response.json();

        // Initialize Fuse.js for fuzzy search
        fuse = new Fuse(allChapters, {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'course', weight: 1 },
                { name: 'formatted_date', weight: 1 },
                { name: 'search_text', weight: 3 }
            ],
            threshold: 0.3,  // Stricter matching (was 0.4)
            includeScore: true,
            includeMatches: true,
            minMatchCharLength: 3,  // Require at least 3 characters (was 2)
            ignoreLocation: true,
            distance: 100  // Limit how far apart matched characters can be
        });

        // Display initial results (all chapters)
        displayResults(allChapters);

        // Update stats
        updateStats(allChapters.length, allChapters.length);

    } catch (error) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                <h3>Error Loading Data</h3>
                <p>Could not load lecture chapters. Please try again later.</p>
                <p style="color: #999; font-size: 0.9rem; margin-top: 1rem;">${error.message}</p>
            </div>
        `;
    }
}

// Search function
function performSearch() {
    const query = searchInput.value.trim();
    const enabledCourses = getEnabledCourses();

    let results;

    if (query === '') {
        // No search query - show all (filtered by course)
        results = allChapters.map(chapter => ({ item: chapter, query: '', matches: [] }));
    } else {
        // Perform fuzzy search
        const searchResults = fuse.search(query);
        results = searchResults.map(result => ({
            item: result.item,
            query: query,
            matches: result.matches || []
        }));
    }

    // Filter by enabled courses
    results = results.filter(result => enabledCourses.includes(result.item.course));

    // Display results
    displayResults(results);

    // Update stats
    updateStats(results.length, allChapters.length);
}

// Get enabled courses from checkboxes
function getEnabledCourses() {
    const courses = [];
    if (filterAVC185.checked) courses.push('AVC185');
    if (filterAVC200.checked) courses.push('AVC200');
    if (filterAVC240.checked) courses.push('AVC240');
    return courses;
}

// Display results
function displayResults(results) {
    if (results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                <h3>No Results Found</h3>
                <p>Try a different search term or adjust your filters.</p>
            </div>
        `;
        return;
    }

    resultsDiv.innerHTML = results.map(result => createResultHTML(result.item, result.query, result.matches)).join('');
}

// Find matching excerpt from transcript
function findMatchingExcerpt(transcriptSegment, query, maxLength = 150) {
    if (!query || !transcriptSegment) return null;

    // Strip quotation marks from the query
    query = query.replace(/["""'']/g, '');

    const lowerTranscript = transcriptSegment.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Try exact match first (whole phrase)
    let matchIndex = lowerTranscript.indexOf(lowerQuery);
    let matchedText = query;
    let matchType = 'exact';

    // If no exact match, try to find individual words
    if (matchIndex === -1) {
        // Split query into words and find the first word that appears
        const words = lowerQuery.split(/\s+/).filter(w => w.length >= 3);

        for (const word of words) {
            // Try exact word match first
            matchIndex = lowerTranscript.indexOf(word);
            if (matchIndex !== -1) {
                matchedText = word;
                matchType = 'word';
                break;
            }

            // If no exact match, try stemming (remove common suffixes)
            // This helps match "samples" to "sample", "rendering" to "render", etc.
            const stem = word.replace(/(ing|ed|s|es|ies)$/, '');
            if (stem.length >= 3 && stem !== word) {
                matchIndex = lowerTranscript.indexOf(stem);
                if (matchIndex !== -1) {
                    matchedText = stem;
                    matchType = 'stem';
                    break;
                }
            }
        }
    }

    // If still no match, return null
    if (matchIndex === -1) return null;

    // Extract context around the match
    const contextBefore = 50;
    const contextAfter = maxLength - matchedText.length - contextBefore;

    const start = Math.max(0, matchIndex - contextBefore);
    const end = Math.min(transcriptSegment.length, matchIndex + matchedText.length + contextAfter);

    let excerpt = transcriptSegment.substring(start, end);

    // Add ellipsis if truncated
    if (start > 0) excerpt = '...' + excerpt;
    if (end < transcriptSegment.length) excerpt = excerpt + '...';

    // Highlight the matching term
    // Escape the excerpt first
    const escapedExcerpt = escapeHtml(excerpt);

    // Build highlighting pattern
    const escapedQuery = escapeRegex(query);
    const words = query.split(/\s+/).filter(w => w.length > 0).map(escapeRegex);

    // Match the query as a phrase or individual words (case insensitive, including within words)
    const pattern = words.length > 1
        ? `(${escapedQuery}|${words.join('|')})`
        : `(${escapedQuery})`;
    const regex = new RegExp(pattern, 'gi');

    const highlightedExcerpt = escapedExcerpt.replace(regex, '<mark>$1</mark>');

    return highlightedExcerpt;
}

// Escape regex special characters
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Create HTML for a single result
function createResultHTML(chapter, query = '', matches = []) {
    const courseLower = chapter.course.toLowerCase();
    const videoLink = chapter.video_id
        ? `https://www.youtube.com/watch?v=${chapter.video_id}&t=${chapter.seconds}s`
        : '#';

    const linkDisabled = !chapter.video_id;

    // Find matching excerpt from transcript
    // Always try to find excerpt if there's a query, regardless of which field matched
    const excerpt = query
        ? findMatchingExcerpt(chapter.transcript_segment, query)
        : null;

    // Thumbnail HTML
    const thumbnailHTML = chapter.thumbnail
        ? `<img src="${chapter.thumbnail}" alt="Chapter thumbnail" class="result-thumbnail" loading="lazy">`
        : '';

    return `
        <div class="result-item">
            ${thumbnailHTML}
            <div class="result-content">
                <div class="result-header">
                    <span class="course-badge ${courseLower}">${chapter.course}</span>
                    <span class="result-date">${chapter.formatted_date}</span>
                </div>
                <div class="result-title">${escapeHtml(chapter.title)}</div>
                ${excerpt ? `<div class="result-excerpt">${excerpt}</div>` : ''}
                ${linkDisabled
                    ? `<span style="color: #999; font-size: 0.9rem;">Video link not available</span>`
                    : `<a href="${videoLink}" class="result-link" target="_blank" rel="noopener">
                        <span class="timestamp">${chapter.timestamp}</span>
                        <span>Watch in YouTube</span>
                    </a>`
                }
            </div>
        </div>
    `;
}

// Update stats display
function updateStats(shown, total) {
    const query = searchInput.value.trim();
    const enabledCourses = getEnabledCourses();

    if (query === '' && enabledCourses.length === 3) {
        statsDiv.innerHTML = `Showing all <strong>${total}</strong> chapters`;
    } else if (query === '') {
        statsDiv.innerHTML = `Showing <strong>${shown}</strong> of <strong>${total}</strong> chapters (filtered by course)`;
    } else {
        statsDiv.innerHTML = `Found <strong>${shown}</strong> results for "${escapeHtml(query)}"`;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners
searchButton.addEventListener('click', performSearch);

searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Real-time search as user types (with debounce)
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300);
});

// Filter changes
filterAVC185.addEventListener('change', performSearch);
filterAVC200.addEventListener('change', performSearch);
filterAVC240.addEventListener('change', performSearch);

// Initialize
loadChapters();
