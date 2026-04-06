/* ============================================================
   GLOBAL STATE
============================================================ */
let writings = [];
let currentPage = 1;
const pageSize = 9; // cards per page


/* ============================================================
   LOAD JSON DATA
============================================================ */
async function loadWritings() {
    try {
        const response = await fetch("/hamiltondesigns/gospeltopics/data/writings.json");

        if (!response.ok) {
            throw new Error("Failed to load writings.json");
        }

        writings = await response.json();

        buildSidebar();

        // Homepage only
        if (document.body.classList.contains("homepage")) {

            // 🔤 Sort BEFORE the first render
            writings.sort((a, b) => a.title.localeCompare(b.title));

            buildCards(paginate(writings, currentPage, pageSize));
            setupPaginationControls();
        }


        highlightActiveLink();

        // Writing page only
        loadMarkdownIfNeeded();
        renderRelatedWritings();

    } catch (err) {
        console.error("Error loading writings.json:", err);
    }
}


/* ============================================================
   BUILD SIDEBAR (with collapsible categories)
============================================================ */
function buildSidebar() {
    const nav = document.getElementById("sidebarNav");
    if (!nav) return;  // <-- This now protects the entire function

    nav.innerHTML = "";

    const categories = {};

    // Group writings by category
    writings.forEach(item => {
        if (!categories[item.category]) {
            categories[item.category] = [];
        }
        categories[item.category].push(item);
    });

    // Alphabetize category names
    const sortedCategories = Object.keys(categories).sort((a, b) =>
        a.localeCompare(b)
    );

    sortedCategories.forEach(category => {
        const section = document.createElement("section");
        section.classList.add("nav-section");

        // Category header
        const header = document.createElement("h2");
        header.classList.add("nav-category");
        header.textContent = category;

        // List of items
        const list = document.createElement("ul");

        // Toggle collapse on category click
        header.addEventListener("click", () => {
            list.classList.toggle("collapsed");
        });

        // Alphabetize items inside each category
        categories[category].sort((a, b) =>
            a.title.localeCompare(b.title)
        );

        // Build list items
        categories[category].forEach(item => {
            const li = document.createElement("li");
            const link = document.createElement("a");

            // link.href = "/hamiltondesigns/gospeltopics/" + item.url;
            link.href = "/hamiltondesigns/gospeltopics/writing.html?slug=" + item.slug;
            link.textContent = item.title;

            li.appendChild(link);
            list.appendChild(li);
        });

        section.appendChild(header);
        section.appendChild(list);
        nav.appendChild(section);
    });

    // ============================================================
    // DEFAULT COLLAPSED STATE
    // ============================================================
    const lists = nav.querySelectorAll("ul");
    lists.forEach(list => list.classList.add("collapsed"));
}

/* ============================================================
   COLLAPSE / EXPAND ALL BUTTON
============================================================ */
function enableSidebarCollapsing() {
    const collapseBtn = document.getElementById("collapseAllBtn");
    if (!collapseBtn) return;

    collapseBtn.addEventListener("click", () => {
        const lists = document.querySelectorAll("#sidebarNav ul");
        const allCollapsed = [...lists].every(list =>
            list.classList.contains("collapsed")
        );

        lists.forEach(list => {
            if (allCollapsed) {
                list.classList.remove("collapsed"); // expand all
            } else {
                list.classList.add("collapsed"); // collapse all
            }
        });

        collapseBtn.textContent = allCollapsed
            ? "Collapse All"
            : "Expand All";
    });
}


/* ============================================================
   ACTIVE LINK HIGHLIGHTING
============================================================ */
// function highlightActiveLink() {
//     const links = document.querySelectorAll(".sidebar a");
//     const current = window.location.pathname;

//     links.forEach(link => {
//         if (link.getAttribute("href") === current) {
//             link.classList.add("active");

//             // Auto-expand the category containing the active link
//             const parentList = link.closest("ul");
//             if (parentList) {
//                 parentList.classList.remove("collapsed");
//             }
//         }
//     });
// }

function highlightActiveLink() {
    const links = document.querySelectorAll(".sidebar a");
    const params = new URLSearchParams(window.location.search);
    const currentSlug = params.get("slug");

    links.forEach(link => {
        const url = new URL(link.href);
        const linkSlug = url.searchParams.get("slug");

        if (currentSlug && linkSlug === currentSlug) {
            link.classList.add("active");

            const parentList = link.closest("ul");
            if (parentList) {
                parentList.classList.remove("collapsed");
            }
        }
    });
}


/* ============================================================
   SIDEBAR SEARCH (with fuzzy matching)
============================================================ */
function setupSidebarSearch() {
    const input = document.getElementById("searchInput");
    const nav = document.getElementById("sidebarNav");
    if (!input || !nav) return;

    input.addEventListener("input", () => {
        const query = input.value.toLowerCase();
        const links = nav.querySelectorAll("a");

        links.forEach(link => {
            const text = link.textContent.toLowerCase();
            const score = fuzzyScore(text, query);
            link.parentElement.style.display = score > 0 ? "block" : "none";
        });
    });
}


/* ============================================================
   FUZZY MATCHING (simple scoring)
============================================================ */
function fuzzyScore(text, query) {
    if (!query) return 1;
    let ti = 0;
    let qi = 0;
    let score = 0;

    while (ti < text.length && qi < query.length) {
        if (text[ti] === query[qi]) {
            score += 1;
            qi++;
        }
        ti++;
    }

    return qi === query.length ? score : 0;
}


/* ============================================================
   BUILD HOMEPAGE CARDS
============================================================ */
function buildCards(filteredWritings) {
    const cardGrid = document.getElementById("cardGrid");
    if (!cardGrid) return;

    cardGrid.innerHTML = "";

    // 🔤 Sort alphabetically by title
    filteredWritings.sort((a, b) => a.title.localeCompare(b.title));

    filteredWritings.forEach(item => {
        const card = document.createElement("article");
        card.classList.add("card");

        card.innerHTML = `
        <a href="/hamiltondesigns/gospeltopics/writing.html?slug=${item.slug}" class="card-link">
                <h3>${item.title}</h3>
                <p class="category">${item.category}</p>
                <p class="keywords">${item.keywords.join(", ")}</p>
                <span class="read-link">Read →</span>
            </a>
        `;

        cardGrid.appendChild(card);
    });
}



/* ============================================================
   PAGINATION
============================================================ */
function paginate(list, page, size) {
    const start = (page - 1) * size;
    return list.slice(start, start + size);
}

function setupPaginationControls() {
    const container = document.getElementById("pagination");
    if (!container) return;

    container.innerHTML = "";

    const totalPages = Math.ceil(writings.length / pageSize);
    if (totalPages <= 1) return;

    for (let p = 1; p <= totalPages; p++) {
        const btn = document.createElement("button");
        btn.textContent = p;
        if (p === currentPage) btn.classList.add("active");
        btn.addEventListener("click", () => {
            currentPage = p;
            const query = document.getElementById("cardSearch")?.value || "";
            const filtered = filterList(query);

            // 🔤 Sort EVERYTHING alphabetically BEFORE pagination
            filtered.sort((a, b) => a.title.localeCompare(b.title));

            buildCards(paginate(filtered, currentPage, pageSize));
            setupPaginationControls();
        });
        container.appendChild(btn);
    }
}


/* ============================================================
   CARD SEARCH + FILTERING (with fuzzy)
============================================================ */
function setupCardSearch() {
    const input = document.getElementById("cardSearch");
    if (!input) return;

    input.addEventListener("input", () => {
        currentPage = 1;
        const filtered = filterList(input.value);
        buildCards(paginate(filtered, currentPage, pageSize));
        setupPaginationControls();
    });
}

function filterList(query = "", category = "all") {
    query = query.toLowerCase();

    return writings.filter(item => {
        const haystack = [
            item.title.toLowerCase(),
            item.category.toLowerCase(),
            item.keywords.join(" ").toLowerCase()
        ].join(" ");

        const matchesText = fuzzyScore(haystack, query) > 0 || !query;
        const matchesCategory = category === "all" || item.category === category;

        return matchesText && matchesCategory;
    });
}


/* ============================================================
   CATEGORY FILTER BUTTONS (optional)
============================================================ */
function setupCategoryButtons() {
    const buttons = document.querySelectorAll(".filter-buttons button");
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const category = btn.dataset.cat;
            const query = document.getElementById("cardSearch")?.value || "";
            currentPage = 1;
            const filtered = filterList(query, category);
            buildCards(paginate(filtered, currentPage, pageSize));
            setupPaginationControls();
        });
    });
}


/* ============================================================
   DARK MODE TOGGLE
============================================================ */
function setupDarkMode() {
    const toggle = document.getElementById("darkModeToggle");
    if (!toggle) return;

    const saved = localStorage.getItem("darkMode") === "true";
    if (saved) {
        document.body.classList.add("dark");
        toggle.checked = true;
    }

    toggle.addEventListener("change", () => {
        const enabled = toggle.checked;
        document.body.classList.toggle("dark", enabled);
        localStorage.setItem("darkMode", String(enabled));
    });
}


/* ============================================================
   MARKDOWN LOADER (for individual writing pages)
============================================================ */
async function loadMarkdownIfNeeded() {
    const container = document.getElementById("markdownContent");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    if (!slug) return;

    const match = writings.find(w => w.slug === slug);
    if (!match || !match.mdUrl) return;

    try {
        const res = await fetch("/hamiltondesigns/gospeltopics/" + match.mdUrl);
        if (!res.ok) {
            throw new Error("Markdown file not found: " + match.mdUrl);
        }

        const text = await res.text();
        container.innerHTML = markdownToHtml(text);
    } catch (err) {
        console.error("Error loading markdown:", err);
    }
}



/* ============================================================
   RICH MARKDOWN CONVERTER
   - Headings (#, ##, ###)
   - Paragraphs
   - Bold (**text**)
   - Italics (*text*)
   - Blockquotes (> text)
   - Unordered lists (- item, * item)
   - Ordered lists (1. item)
   - Markdown links [text](url)
   - Auto-linked bare URLs
   - Scripture auto-linking (Book 1:2–3)
============================================================ */
function markdownToHtml(md) {
    const lines = md.split("\n");
    const html = [];
    let inList = false;
    let listType = null; // "ul" or "ol"

    function closeListIfOpen() {
        if (inList && listType) {
            html.push(`</${listType}>`);
            inList = false;
            listType = null;
        }
    }

    function applyInlineFormatting(text) {

        /* ============================================================
           SCRIPTURE AUTO-LINKING (ALL STANDARD WORKS, CHAPTER-LEVEL)
        ============================================================ */
        text = text.replace(
            /\b((?:1|2|3|4)\s+Nephi|Jacob|Enos|Jarom|Omni|Words\s+of\s+Mormon|Mosiah|Alma|Helaman|3\s+Nephi|4\s+Nephi|Mormon|Ether|Moroni|Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1\s+Samuel|2\s+Samuel|1\s+Kings|2\s+Kings|1\s+Chronicles|2\s+Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song\s+of\s+Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1\s+Corinthians|2\s+Corinthians|Galatians|Ephesians|Philippians|Colossians|1\s+Thessalonians|2\s+Thessalonians|1\s+Timothy|2\s+Timothy|Titus|Philemon|Hebrews|James|1\s+Peter|2\s+Peter|1\s+John|2\s+John|3\s+John|Jude|Revelation|Doctrine\s+and\s+Covenants|D&C|Moses|Abraham|Joseph\s+Smith–Matthew|Joseph\s+Smith–History|Articles\s+of\s+Faith)\s+(\d+):(\d+(?:[-–]\d+)?)\b/gi,
            (match, book, chapter, verses) => {

                const map = {
                    // Book of Mormon
                    "1 nephi": "bofm/1-ne",
                    "2 nephi": "bofm/2-ne",
                    "3 nephi": "bofm/3-ne",
                    "4 nephi": "bofm/4-ne",
                    "jacob": "bofm/jacob",
                    "enos": "bofm/enos",
                    "jarom": "bofm/jarom",
                    "omni": "bofm/omni",
                    "words of mormon": "bofm/w-of-m",
                    "mosiah": "bofm/mosiah",
                    "alma": "bofm/alma",
                    "helaman": "bofm/hel",
                    "mormon": "bofm/morm",
                    "ether": "bofm/ether",
                    "moroni": "bofm/moro",

                    // Old Testament
                    "genesis": "ot/gen",
                    "exodus": "ot/ex",
                    "leviticus": "ot/lev",
                    "numbers": "ot/num",
                    "deuteronomy": "ot/deut",
                    "joshua": "ot/josh",
                    "judges": "ot/judg",
                    "ruth": "ot/ruth",
                    "1 samuel": "ot/1-sam",
                    "2 samuel": "ot/2-sam",
                    "1 kings": "ot/1-kgs",
                    "2 kings": "ot/2-kgs",
                    "1 chronicles": "ot/1-chr",
                    "2 chronicles": "ot/2-chr",
                    "ezra": "ot/ezra",
                    "nehemiah": "ot/neh",
                    "esther": "ot/esth",
                    "job": "ot/job",
                    "psalms": "ot/ps",
                    "proverbs": "ot/prov",
                    "ecclesiastes": "ot/eccl",
                    "song of solomon": "ot/song",
                    "isaiah": "ot/isa",
                    "jeremiah": "ot/jer",
                    "lamentations": "ot/lam",
                    "ezekiel": "ot/ezek",
                    "daniel": "ot/dan",
                    "hosea": "ot/hosea",
                    "joel": "ot/joel",
                    "amos": "ot/amos",
                    "obadiah": "ot/obad",
                    "jonah": "ot/jonah",
                    "micah": "ot/micah",
                    "nahum": "ot/nahum",
                    "habakkuk": "ot/hab",
                    "zephaniah": "ot/zeph",
                    "haggai": "ot/hag",
                    "zechariah": "ot/zech",
                    "malachi": "ot/mal",

                    // New Testament
                    "matthew": "nt/matt",
                    "mark": "nt/mark",
                    "luke": "nt/luke",
                    "john": "nt/john",
                    "acts": "nt/acts",
                    "romans": "nt/rom",
                    "1 corinthians": "nt/1-cor",
                    "2 corinthians": "nt/2-cor",
                    "galatians": "nt/gal",
                    "ephesians": "nt/eph",
                    "philippians": "nt/philip",
                    "colossians": "nt/col",
                    "1 thessalonians": "nt/1-thes",
                    "2 thessalonians": "nt/2-thes",
                    "1 timothy": "nt/1-tim",
                    "2 timothy": "nt/2-tim",
                    "titus": "nt/titus",
                    "philemon": "nt/philem",
                    "hebrews": "nt/heb",
                    "james": "nt/james",
                    "1 peter": "nt/1-pet",
                    "2 peter": "nt/2-pet",
                    "1 john": "nt/1-jn",
                    "2 john": "nt/2-jn",
                    "3 john": "nt/3-jn",
                    "jude": "nt/jude",
                    "revelation": "nt/rev",

                    // Doctrine & Covenants
                    "doctrine and covenants": "dc",
                    "d&c": "dc",

                    // Pearl of Great Price
                    "moses": "pgp/moses",
                    "abraham": "pgp/abr",
                    "joseph smith–matthew": "pgp/js-m",
                    "joseph smith–history": "pgp/js-h",
                    "articles of faith": "pgp/a-of-f"
                };

                const key = book.toLowerCase();
                const segment = map[key];
                if (!segment) return match;

                const url = `https://www.churchofjesuschrist.org/study/scriptures/${segment}/${chapter}?lang=eng`;

                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${match}</a>`;
            }
        );


        /* ============================================================
           BOLD (**text**)
        ============================================================ */
        while (text.includes("**")) {
            let start = text.indexOf("**");
            let end = text.indexOf("**", start + 2);
            if (end === -1) break;
            let inner = text.substring(start + 2, end);
            text = text.substring(0, start)
                + "<strong>" + inner + "</strong>"
                + text.substring(end + 2);
        }


        /* ============================================================
           ITALICS (*text*)
        ============================================================ */
        while (text.includes("*")) {
            let start = text.indexOf("*");
            let end = text.indexOf("*", start + 1);
            if (end === -1) break;
            let inner = text.substring(start + 1, end);
            text = text.substring(0, start)
                + "<em>" + inner + "</em>"
                + text.substring(end + 1);
        }

        return text;
    }
    


    // ---------------------------------------------------------
    // Now the big loop is correctly INSIDE markdownToHtml
    // ---------------------------------------------------------
    for (let rawLine of lines) {
        let line = rawLine.replace(/\r$/, "");

        // Blank line → close lists and skip
        if (line.trim() === "") {
            closeListIfOpen();
            continue;
        }

        // Headings
        const h3 = line.match(/^###\s+(.*)/);
        const h2 = line.match(/^##\s+(.*)/);
        const h1 = line.match(/^#\s+(.*)/);

        if (h3) {
            closeListIfOpen();
            html.push(`<h3>${applyInlineFormatting(h3[1])}</h3>`);
            continue;
        }
        if (h2) {
            closeListIfOpen();
            html.push(`<h2>${applyInlineFormatting(h2[1])}</h2>`);
            continue;
        }
        if (h1) {
            closeListIfOpen();
            html.push(`<h1>${applyInlineFormatting(h1[1])}</h1>`);
            continue;
        }

        // Blockquotes
        const bq = line.match(/^>\s?(.*)/);
        if (bq) {
            closeListIfOpen();
            html.push(`<blockquote>${applyInlineFormatting(bq[1])}</blockquote>`);
            continue;
        }

        // Ordered list: "1. item"
        const ol = line.match(/^\d+\.\s+(.*)/);
        if (ol) {
            if (!inList || listType !== "ol") {
                closeListIfOpen();
                html.push("<ol>");
                inList = true;
                listType = "ol";
            }
            html.push(`<li>${applyInlineFormatting(ol[1])}</li>`);
            continue;
        }

        // Unordered list: "- item" or "* item"
        const ul = line.match(/^[-*]\s+(.*)/);
        if (ul) {
            if (!inList || listType !== "ul") {
                closeListIfOpen();
                html.push("<ul>");
                inList = true;
                listType = "ul";
            }
            html.push(`<li>${applyInlineFormatting(ul[1])}</li>`);
            continue;
        }

        // Default paragraph
        closeListIfOpen();
        html.push(`<p>${applyInlineFormatting(line)}</p>`);
    }

    // Close any open list at the end
    if (inList && listType) {
        html.push(`</${listType}>`);
    }

    return html.join("\n");
}

/* ============================================================
   RELATED WRITINGS (based on shared keywords)
============================================================ */

// function renderRelatedWritings() {
//     const container = document.getElementById("relatedWritings");
//     if (!container) return;

//     const current = window.location.pathname;
//     const currentItem = writings.find(w => current.endsWith(w.url));
//     if (!currentItem) return;

//     const related = writings
//         .filter(w => w !== currentItem)
//         .map(w => {
//             const overlap = w.keywords.filter(k => currentItem.keywords.includes(k));
//             return { item: w, score: overlap.length };
//         })
//         .filter(x => x.score > 0)
//         .sort((a, b) => b.score - a.score)
//         .slice(0, 5)
//         .map(x => x.item);

//     if (!related.length) {
//         container.innerHTML = "<p>No related writings found.</p>";
//         return;
//     }

//     const list = document.createElement("ul");
//     related.forEach(w => {
//         const li = document.createElement("li");
//         const link = document.createElement("a");
//         link.href = w.url;
//         link.textContent = w.title;
//         li.appendChild(link);
//         list.appendChild(li);
//     });

//     container.innerHTML = "";
//     container.appendChild(list);
// }

function renderRelatedWritings() {
    const container = document.getElementById("relatedWritings");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    if (!slug) return;

    const currentItem = writings.find(w => w.slug === slug);
    if (!currentItem) return;

    const related = writings
        .filter(w => w !== currentItem)
        .map(w => {
            const overlap = w.keywords.filter(k => currentItem.keywords.includes(k));
            return { item: w, score: overlap.length };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(x => x.item);

    if (!related.length) {
        container.innerHTML = "<p>No related writings found.</p>";
        return;
    }

    const list = document.createElement("ul");
    related.forEach(w => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = "/hamiltondesigns/gospeltopics/writing.html?slug=" + w.slug;
        link.textContent = w.title;
        li.appendChild(link);
        list.appendChild(li);
    });

    container.innerHTML = "";
    container.appendChild(list);
}

/* ============================================================
   INITIALIZE EVERYTHING
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    loadWritings();
    setupSidebarSearch();
    setupCardSearch();
    setupCategoryButtons();
    setupDarkMode();
    enableSidebarCollapsing();
});
