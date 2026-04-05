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
    if (!nav) return;
    nav.innerHTML = "";

    const categories = {};
    writings.forEach(item => {
        if (!categories[item.category]) {
            categories[item.category] = [];
        }
        categories[item.category].push(item);
    });

    Object.keys(categories).forEach(category => {
        const section = document.createElement("section");
        section.classList.add("nav-section");

        const header = document.createElement("h2");
        header.classList.add("nav-category");
        header.textContent = category;

        const list = document.createElement("ul");

        // Toggle collapse on category click
        header.addEventListener("click", () => {
            list.classList.toggle("collapsed");
        });

        categories[category].forEach(item => {
            const li = document.createElement("li");
            const link = document.createElement("a");

            // Absolute path so links work from ANY page
            link.href = "/hamiltondesigns/gospeltopics/" + item.url;

            link.textContent = item.title;
            li.appendChild(link);
            list.appendChild(li);
        });

        section.appendChild(header);
        section.appendChild(list);
        nav.appendChild(section);
    });
}

/* ============================================================
   COLLAPSE / EXPAND ALL BUTTON
============================================================ */
const collapseBtn = document.getElementById("collapseAllBtn");

if (collapseBtn) {
    collapseBtn.addEventListener("click", () => {
        const lists = document.querySelectorAll(".sidebar-nav ul");
        const allCollapsed = [...lists].every(list => list.classList.contains("collapsed"));

        lists.forEach(list => {
            if (allCollapsed) {
                list.classList.remove("collapsed"); // expand all
            } else {
                list.classList.add("collapsed"); // collapse all
            }
        });

        collapseBtn.textContent = allCollapsed ? "Collapse All" : "Expand All";
    });
}



/* ============================================================
   ACTIVE LINK HIGHLIGHTING
============================================================ */
function highlightActiveLink() {
    const links = document.querySelectorAll(".sidebar a");
    const current = window.location.pathname;

    links.forEach(link => {
        if (current.endsWith(link.getAttribute("href"))) {
            link.classList.add("active");
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

    filteredWritings.forEach(item => {
        const card = document.createElement("article");
        card.classList.add("card");

        // Entire card is now a clickable link
        card.innerHTML = `
            <a href="/hamiltondesigns/gospeltopics/${item.url}" class="card-link">
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

    const current = window.location.pathname;
    const match = writings.find(w => current.endsWith(w.url));
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

// Very simple markdown converter (headings + paragraphs)
function markdownToHtml(md) {
    const lines = md.split("\n");
    return lines
        .map(line => {
            if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
            if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
            if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
            if (line.trim() === "") return "";
            return `<p>${line}</p>`;
        })
        .join("\n");
}

/* ============================================================
   MARKDOWN LOADER (for individual writing pages) - replaced below
============================================================ */
// async function loadMarkdownIfNeeded() {
//     const container = document.getElementById("markdownContent");
//     if (!container) return;

//     const current = window.location.pathname;
//     const match = writings.find(w => current.endsWith(w.url));
//     if (!match || !match.mdUrl) return;

//     try {
//         const res = await fetch("/hamiltondesigns/gospeltopics/" + match.mdUrl);
//         if (!res.ok) {
//             throw new Error("Markdown file not found: " + match.mdUrl);
//         }

//         const text = await res.text();
//         container.innerHTML = markdownToHtml(text);
//     } catch (err) {
//         console.error("Error loading markdown:", err);
//     }
// }

/* ============================================================
   SIMPLE MARKDOWN CONVERTER (headings, paragraphs, links)
============================================================ */
function markdownToHtml(md) {
    const lines = md.split("\n");

    return lines
        .map(line => {
            // Headings
            if (line.startsWith("### ")) return "<h3>" + line.slice(4) + "</h3>";
            if (line.startsWith("## ")) return "<h2>" + line.slice(3) + "</h2>";
            if (line.startsWith("# ")) return "<h1>" + line.slice(2) + "</h1>";

            // Markdown links: [text](url)
            if (line.includes("](")) {
                const startText = line.indexOf("[") + 1;
                const endText = line.indexOf("]");
                const startUrl = line.indexOf("(", endText) + 1;
                const endUrl = line.indexOf(")", startUrl);

                if (startText > 0 && endText > startText && startUrl > 0 && endUrl > startUrl) {
                    const textPart = line.substring(startText, endText);
                    const urlPart = line.substring(startUrl, endUrl);
                    const htmlLink = '<a href="' + urlPart + '" target="_blank" rel="noopener noreferrer">' + textPart + '</a>';
                    line = line.replace(line.substring(line.indexOf("["), endUrl + 1), htmlLink);
                }
            }

            // Auto-link bare URLs
            if (line.includes("http://") || line.includes("https://")) {
                const parts = line.split(" ");
                line = parts
                    .map(word => {
                        if (word.startsWith("http://") || word.startsWith("https://")) {
                            return '<a href="' + word + '" target="_blank" rel="noopener noreferrer">' + word + '</a>';
                        }
                        return word;
                    })
                    .join(" ");
            }

            // Empty line → no paragraph
            if (line.trim() === "") return "";

            // Default paragraph
            return "<p>" + line + "</p>";
        })
        .join("\n");
}

/* ============================================================
   RELATED WRITINGS (based on shared keywords)
============================================================ */
function renderRelatedWritings() {
    const container = document.getElementById("relatedWritings");
    if (!container) return;

    const current = window.location.pathname;
    const currentItem = writings.find(w => current.endsWith(w.url));
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
        link.href = w.url;
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
});