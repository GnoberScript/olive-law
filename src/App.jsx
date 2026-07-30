import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  FileText,
  ExternalLink,
  Link,
  Menu,
  Minus,
  Moon,
  Plus,
  Printer,
  Quote,
  Search,
  Scale,
  StickyNote,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import corpus from "./data/constitution.json";

const STORAGE = {
  bookmarks: "counsel-desk-bookmarks",
  theme: "counsel-desk-theme",
  fontSize: "counsel-desk-font-size",
  research: "olives-law-research",
  freeNotes: "olives-law-free-notes",
  lastArticle: "olives-law-last-article",
};

const documents = [
  {
    roman: "PREAMBLE",
    number: 0,
    title: "Preamble",
    sections: [{ number: null, ordinal: 1, label: "PREAMBLE", ...corpus.preamble }],
  },
  ...corpus.articles,
];

const loadStored = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
};

const sectionKey = (article, section) =>
  `article-${article.roman.toLowerCase()}-${section.number ? `section-${section.number}` : "text"}-${section.ordinal}`;

const citationFor = (article, section) =>
  article.roman === "PREAMBLE"
    ? "CONST. (1987), pmbl. (Phil.)."
    : section.number
    ? `CONST. (1987), art. ${article.roman}, sec. ${section.number} (Phil.).`
    : `CONST. (1987), art. ${article.roman} (Phil.).`;

const articleResearchKey = (article) => `article-${article.roman.toLowerCase()}-research`;

const highlight = (text, query) => {
  if (!query.trim()) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safe})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? <mark key={index}>{part}</mark> : part,
  );
};

function App() {
  const [activeRoman, setActiveRoman] = useState(() => {
    const directArticle = location.hash.match(/^#article-(preamble|[ivx]+)$/i)?.[1]?.toUpperCase();
    const savedArticle = loadStored(STORAGE.lastArticle, "I");
    return directArticle || (documents.some((article) => article.roman === savedArticle) ? savedArticle : "I");
  });
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [articleFilter, setArticleFilter] = useState("ALL");
  const [bookmarks, setBookmarks] = useState(() => loadStored(STORAGE.bookmarks, []));
  const [theme, setTheme] = useState(() =>
    loadStored(STORAGE.theme, window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [fontSize, setFontSize] = useState(() => loadStored(STORAGE.fontSize, 18));
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(() => location.hash === "#notes");
  const [copied, setCopied] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [research, setResearch] = useState(() => loadStored(STORAGE.research, {}));
  const [researchTarget, setResearchTarget] = useState(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const [freeNotes, setFreeNotes] = useState(() => loadStored(STORAGE.freeNotes, []));
  const [workspaceTab, setWorkspaceTab] = useState("notes");
  const [activeFreeNoteId, setActiveFreeNoteId] = useState(null);
  const searchRef = useRef(null);

  const activeArticle = documents.find((article) => article.roman === activeRoman) || corpus.articles[0];

  const results = useMemo(() => {
    const needle = submittedQuery.trim().toLowerCase();
    if (!needle) return [];
    return documents
      .filter((article) => articleFilter === "ALL" || article.roman === articleFilter)
      .flatMap((article) =>
        article.sections
          .filter((section) => section.text.toLowerCase().includes(needle))
          .map((section) => ({ article, section })),
      );
  }, [submittedQuery, articleFilter]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE.theme, JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--reader-size", `${fontSize}px`);
    localStorage.setItem(STORAGE.fontSize, JSON.stringify(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(STORAGE.bookmarks, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem(STORAGE.research, JSON.stringify(research));
  }, [research]);

  useEffect(() => {
    localStorage.setItem(STORAGE.freeNotes, JSON.stringify(freeNotes));
  }, [freeNotes]);

  useEffect(() => {
    localStorage.setItem(STORAGE.lastArticle, JSON.stringify(activeRoman));
  }, [activeRoman]);

  useEffect(() => {
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(available > 0 ? Math.min(100, (window.scrollY / available) * 100) : 0);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [activeRoman, submittedQuery]);

  useEffect(() => {
    setResearchTarget({ article: activeArticle, section: null });
  }, [activeArticle.roman]);

  const goToArticle = (roman) => {
    setActiveRoman(roman);
    setSubmittedQuery("");
    setQuery("");
    setOutlineOpen(false);
    history.replaceState(null, "", `#article-${roman.toLowerCase()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToSection = (article, section) => {
    setActiveRoman(article.roman);
    setSubmittedQuery("");
    setQuery("");
    setBookmarkOpen(false);
    const key = sectionKey(article, section);
    requestAnimationFrame(() => document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const submitSearch = (event) => {
    event?.preventDefault();
    setSubmittedQuery(query.trim());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleBookmark = (article, section) => {
    const key = sectionKey(article, section);
    setBookmarks((current) =>
      current.some((item) => item.key === key)
        ? current.filter((item) => item.key !== key)
        : [
            ...current,
            {
              key,
              roman: article.roman,
              articleTitle: article.title,
              sectionNumber: section.number,
              ordinal: section.ordinal,
              excerpt: section.text.slice(0, 120),
            },
          ],
    );
  };

  const copy = async (value, key) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  };

  const openResearch = (article, section = null) => {
    setResearchTarget({ article, section });
    if (window.innerWidth <= 1180) setResearchOpen(true);
  };

  const currentResearchKey = researchTarget
    ? researchTarget.section
      ? sectionKey(researchTarget.article, researchTarget.section)
      : articleResearchKey(researchTarget.article)
    : articleResearchKey(activeArticle);

  const updateNote = (key, note) => {
    setResearch((current) => ({
      ...current,
      [key]: { note, cases: current[key]?.cases || [] },
    }));
  };

  const addCase = (key, caseItem) => {
    setResearch((current) => ({
      ...current,
      [key]: {
        note: current[key]?.note || "",
        cases: [...(current[key]?.cases || []), { ...caseItem, id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}` }],
      },
    }));
  };

  const removeCase = (key, caseId) => {
    setResearch((current) => ({
      ...current,
      [key]: {
        note: current[key]?.note || "",
        cases: (current[key]?.cases || []).filter((item) => item.id !== caseId),
      },
    }));
  };

  const createFreeNote = () => {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const note = { id, title: "", body: "", updatedAt: Date.now() };
    setFreeNotes((current) => [note, ...current]);
    setActiveFreeNoteId(id);
  };

  const updateFreeNote = (id, changes) => {
    setFreeNotes((current) =>
      current.map((note) => note.id === id ? { ...note, ...changes, updatedAt: Date.now() } : note),
    );
  };

  const deleteFreeNote = (id) => {
    setFreeNotes((current) => current.filter((note) => note.id !== id));
    setActiveFreeNoteId((current) => current === id ? null : current);
  };

  const bookmarkedSections = bookmarks
    .map((bookmark) => {
    const article = documents.find((item) => item.roman === bookmark.roman);
      const section = article?.sections.find((item) => item.ordinal === bookmark.ordinal);
      return article && section ? { article, section, key: bookmark.key } : null;
    })
    .filter(Boolean);

  const articleIndex = documents.findIndex((article) => article.roman === activeArticle.roman);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="reading-progress" style={{ width: `${scrollProgress}%` }} />
        <button className="icon-button mobile-only" onClick={() => setOutlineOpen(true)} aria-label="Open contents">
          <Menu size={20} />
        </button>
        <button className="brand" onClick={() => goToArticle("I")} aria-label="Olive's Law Firm home">
          <span className="brand-seal">OL</span>
          <span>
            <strong>Olive’s</strong>
            <small>Law Firm · Research</small>
          </span>
        </button>
        <form className="global-search" onSubmit={submitSearch}>
          <Search size={18} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search doctrine, right, power, or exact phrase…"
            aria-label="Search the Constitution"
          />
          {query && (
            <button type="button" className="clear-search" onClick={() => { setQuery(""); setSubmittedQuery(""); }}>
              <X size={16} />
            </button>
          )}
          <kbd>Ctrl K</kbd>
        </form>
        <div className="top-actions">
          <button className="text-button notes-trigger" onClick={() => { setWorkspaceTab("notes"); setBookmarkOpen(true); }}>
            <StickyNote size={18} />
            <span>Notes</span>
            {(freeNotes.length + bookmarks.length) > 0 && <em>{freeNotes.length + bookmarks.length}</em>}
          </button>
          <button className="theme-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark mode">
            {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            <span>{theme === "light" ? "Dark" : "Light"}</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`outline ${outlineOpen ? "open" : ""}`}>
          <div className="aside-heading">
            <div>
              <small>DOCUMENT</small>
              <h2>Table of Contents</h2>
            </div>
            <button className="icon-button mobile-only" onClick={() => setOutlineOpen(false)}><X size={18} /></button>
          </div>
          <button className={`preamble-link ${activeArticle.roman === "PREAMBLE" ? "active" : ""}`} onClick={() => goToArticle("PREAMBLE")}>
            <Quote size={16} /> Preamble
          </button>
          <nav aria-label="Constitution articles">
            {corpus.articles.map((article) => (
              <button
                key={article.roman}
                className={article.roman === activeArticle.roman && !submittedQuery ? "active" : ""}
                onClick={() => goToArticle(article.roman)}
              >
                <span>{article.roman}</span>
                <span>
                  <strong>Article {article.roman}</strong>
                  <small>{article.title}</small>
                </span>
              </button>
            ))}
          </nav>
          <div className="source-note">
            <FileText size={17} />
            <p><strong>Primary text</strong><br />Lawphil Project · Arellano Law Foundation</p>
          </div>
        </aside>

        <main className="reader">
          {submittedQuery ? (
            <SearchResults
              query={submittedQuery}
              results={results}
              articleFilter={articleFilter}
              setArticleFilter={setArticleFilter}
              onClear={() => { setSubmittedQuery(""); setQuery(""); }}
              onGoTo={goToSection}
            />
          ) : (
            <>
              <div className="document-kicker">
                <span>1987 Constitution</span>
                <i />
                <span>Official text</span>
              </div>
              <div className="article-heading">
                <p>{activeArticle.roman === "PREAMBLE" ? "OPENING DECLARATION" : `ARTICLE ${activeArticle.roman}`}</p>
                <h1>{activeArticle.title}</h1>
                <div className="article-meta">
                  <span><BookOpen size={16} /> {activeArticle.sections.filter((section) => section.number).length || 1} {activeArticle.sections.length === 1 ? "provision" : "sections"}</span>
                  <button onClick={() => window.print()}><Printer size={16} /> Print article</button>
                  <button onClick={() => openResearch(activeArticle)}>
                    <StickyNote size={16} /> Article research
                    {(research[articleResearchKey(activeArticle)]?.note || research[articleResearchKey(activeArticle)]?.cases?.length) && <i className="activity-dot" />}
                  </button>
                </div>
              </div>

              <div className="reader-tools" aria-label="Reading controls">
                <span>TEXT SIZE</span>
                <button onClick={() => setFontSize(Math.max(15, fontSize - 1))} aria-label="Decrease text size"><Minus size={16} /></button>
                <strong>{fontSize}</strong>
                <button onClick={() => setFontSize(Math.min(23, fontSize + 1))} aria-label="Increase text size"><Plus size={16} /></button>
              </div>

              {activeArticle.sections.length > 1 && (
                <nav className="section-jump" aria-label="Jump to section">
                  <span>JUMP TO</span>
                  <div>
                    {activeArticle.sections.map((section) => (
                      <button
                        key={sectionKey(activeArticle, section)}
                        onClick={() => document.getElementById(sectionKey(activeArticle, section))?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      >
                        {section.number ?? "Intro"}
                      </button>
                    ))}
                  </div>
                </nav>
              )}

              <div className="provisions">
                {activeArticle.sections.map((section) => (
                  <Provision
                    key={sectionKey(activeArticle, section)}
                    article={activeArticle}
                    section={section}
                    bookmarked={bookmarks.some((item) => item.key === sectionKey(activeArticle, section))}
                    onBookmark={() => toggleBookmark(activeArticle, section)}
                    onCopy={copy}
                    copied={copied}
                    researchEntry={research[sectionKey(activeArticle, section)]}
                    onResearch={() => openResearch(activeArticle, section)}
                  />
                ))}
              </div>

              <div className="article-pager">
                <button disabled={articleIndex === 0} onClick={() => goToArticle(documents[articleIndex - 1]?.roman)}>
                  <ArrowLeft size={17} />
                  <span><small>PREVIOUS</small>{documents[articleIndex - 1]?.title}</span>
                </button>
                <button disabled={articleIndex === documents.length - 1} onClick={() => goToArticle(documents[articleIndex + 1]?.roman)}>
                  <span><small>NEXT</small>{documents[articleIndex + 1]?.title}</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          <footer>
            <p>This research edition is provided for convenient reference. Verify quotations against the official text and controlling jurisprudence.</p>
            <a href={corpus.sourceUrl} target="_blank" rel="noreferrer">View source text ↗</a>
          </footer>
        </main>

        <aside className="desk-panel">
          <ResearchEditor
            target={researchTarget || { article: activeArticle, section: null }}
            entry={research[currentResearchKey] || { note: "", cases: [] }}
            researchKey={currentResearchKey}
            onNoteChange={updateNote}
            onAddCase={addCase}
            onRemoveCase={removeCase}
            compact
          />
          <div className="desk-card">
            <div className="desk-card-heading">
              <span><Bookmark size={16} /> RESEARCH LIST</span>
              <strong>{bookmarks.length}</strong>
            </div>
            {bookmarkedSections.length ? (
              <div className="saved-mini-list">
                {bookmarkedSections.slice(0, 4).map(({ article, section, key }) => (
                  <button key={key} onClick={() => goToSection(article, section)}>
                    <strong>Art. {article.roman}{section.number ? `, Sec. ${section.number}` : ""}</strong>
                    <span>{section.text}</span>
                  </button>
                ))}
                {bookmarks.length > 4 && <button className="view-all" onClick={() => { setWorkspaceTab("bookmarks"); setBookmarkOpen(true); }}>View all {bookmarks.length} saved provisions</button>}
              </div>
            ) : (
              <div className="empty-desk">
                <Bookmark size={22} />
                <p>Save provisions as you read. They’ll remain here for your next research session.</p>
              </div>
            )}
          </div>
          <div className="desk-card tip">
            <span>RESEARCH TIP</span>
            <p>Use quotation marks in your mental model—not the search box. Search already matches exact consecutive phrases.</p>
            <kbd>Ctrl K</kbd>
          </div>
          <div className="desk-card source">
            <span>ABOUT THIS EDITION</span>
            <p>Full constitutional text arranged into {corpus.articles.length} articles and citation-ready sections.</p>
            <a href={corpus.sourceUrl} target="_blank" rel="noreferrer">Lawphil source ↗</a>
          </div>
        </aside>
      </div>

      {(outlineOpen || bookmarkOpen || researchOpen) && <button className="backdrop" onClick={() => { setOutlineOpen(false); setBookmarkOpen(false); setResearchOpen(false); }} aria-label="Close overlay" />}
      <NotesWorkspace
        open={bookmarkOpen}
        tab={workspaceTab}
        setTab={setWorkspaceTab}
        notes={freeNotes}
        activeNoteId={activeFreeNoteId}
        setActiveNoteId={setActiveFreeNoteId}
        onCreateNote={createFreeNote}
        onUpdateNote={updateFreeNote}
        onDeleteNote={deleteFreeNote}
        bookmarks={bookmarkedSections}
        research={research}
        documents={documents}
        onClose={() => setBookmarkOpen(false)}
        onGoTo={goToSection}
        onRemoveBookmark={toggleBookmark}
        onOpenResearch={(article, section) => {
          setResearchTarget({ article, section });
          setBookmarkOpen(false);
          setResearchOpen(true);
        }}
      />
      <aside className={`research-drawer ${researchOpen ? "open" : ""}`} aria-hidden={!researchOpen}>
        <div className="drawer-heading">
          <div>
            <small>OLIVE’S RESEARCH DESK</small>
            <h2>Notes & cited cases</h2>
          </div>
          <button className="icon-button" onClick={() => setResearchOpen(false)}><X size={20} /></button>
        </div>
        <ResearchEditor
          target={researchTarget || { article: activeArticle, section: null }}
          entry={research[currentResearchKey] || { note: "", cases: [] }}
          researchKey={currentResearchKey}
          onNoteChange={updateNote}
          onAddCase={addCase}
          onRemoveCase={removeCase}
        />
      </aside>
      <div className={`copy-toast ${copied ? "show" : ""}`} role="status">
        <Check size={16} /> Copied to clipboard
      </div>
    </div>
  );
}

function Provision({ article, section, bookmarked, onBookmark, onCopy, copied, researchEntry, onResearch }) {
  const key = sectionKey(article, section);
  const citation = citationFor(article, section);
  return (
    <article className="provision" id={key}>
      <div className="section-label">
        <span>{section.number ? `SECTION ${section.number}` : section.label || "ARTICLE TEXT"}</span>
        <div>
          <button className={researchEntry?.note || researchEntry?.cases?.length ? "has-research" : ""} onClick={onResearch} title="Notes and cited cases">
            <StickyNote size={17} />
            {researchEntry?.cases?.length > 0 && <em>{researchEntry.cases.length}</em>}
          </button>
          <button onClick={() => onCopy(`${section.number ? `Section ${section.number}. ` : ""}${section.text}`, `${key}-text`)} title="Copy provision">
            {copied === `${key}-text` ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button className={bookmarked ? "saved" : ""} onClick={onBookmark} title={bookmarked ? "Remove bookmark" : "Save provision"}>
            {bookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
        </div>
      </div>
      <div className="provision-text">
        {section.number && <b className="drop-section">Section {section.number}.</b>}
        <div dangerouslySetInnerHTML={{ __html: section.html }} />
      </div>
      <button className="citation" onClick={() => onCopy(citation, `${key}-cite`)}>
        <Quote size={14} />
        <span>{citation}</span>
        {copied === `${key}-cite` ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </article>
  );
}

function ResearchEditor({ target, entry, researchKey, onNoteChange, onAddCase, onRemoveCase, compact = false }) {
  const [caseName, setCaseName] = useState("");
  const [caseCitation, setCaseCitation] = useState("");
  const [caseUrl, setCaseUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  const submitCase = (event) => {
    event.preventDefault();
    let normalizedUrl = caseUrl.trim();
    if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;
    try {
      const parsed = new URL(normalizedUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      setUrlError("Enter a valid http(s) hyperlink.");
      return;
    }
    if (!caseName.trim()) return;
    onAddCase(researchKey, {
      name: caseName.trim(),
      citation: caseCitation.trim(),
      url: normalizedUrl,
    });
    setCaseName("");
    setCaseCitation("");
    setCaseUrl("");
    setUrlError("");
  };

  const targetLabel = target.section
    ? `Article ${target.article.roman} · Section ${target.section.number ?? "Text"}`
    : target.article.roman === "PREAMBLE"
      ? "Preamble"
      : `Article ${target.article.roman}`;

  return (
    <section className={`research-editor ${compact ? "compact" : ""}`}>
      <div className="research-context">
        <span><StickyNote size={15} /> RESEARCH NOTES</span>
        <strong>{targetLabel}</strong>
        <small>{target.article.title}</small>
      </div>
      <label className="note-field">
        <span>PRIVATE NOTE</span>
        <textarea
          value={entry.note || ""}
          onChange={(event) => onNoteChange(researchKey, event.target.value)}
          placeholder="Add an argument, issue, cross-reference, or reminder…"
          rows={compact ? 4 : 6}
        />
        <small>Saved automatically in this browser</small>
      </label>

      <div className="case-heading">
        <span><Scale size={15} /> ASSOCIATED CASES</span>
        <strong>{entry.cases?.length || 0}</strong>
      </div>
      {entry.cases?.length > 0 && (
        <div className="case-list">
          {entry.cases.map((item) => (
            <div className="case-item" key={item.id}>
              <a href={item.url} target="_blank" rel="noreferrer">
                <strong>{item.name}</strong>
                {item.citation && <span>{item.citation}</span>}
                <small>{item.url} <ExternalLink size={11} /></small>
              </a>
              <button onClick={() => onRemoveCase(researchKey, item.id)} title="Remove case"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <form className="case-form" onSubmit={submitCase}>
        <label>
          <span>CASE NAME</span>
          <input value={caseName} onChange={(event) => setCaseName(event.target.value)} placeholder="e.g. Oposa v. Factoran" required />
        </label>
        <label>
          <span>CITATION <i>optional</i></span>
          <input value={caseCitation} onChange={(event) => setCaseCitation(event.target.value)} placeholder="G.R. No. 101083" />
        </label>
        <label>
          <span>HYPERLINK</span>
          <div className="url-input"><Link size={14} /><input value={caseUrl} onChange={(event) => { setCaseUrl(event.target.value); setUrlError(""); }} placeholder="lawphil.net/…" required /></div>
        </label>
        {urlError && <p className="field-error">{urlError}</p>}
        <button type="submit"><Plus size={15} /> Add cited case</button>
      </form>
    </section>
  );
}

function SearchResults({ query, results, articleFilter, setArticleFilter, onClear, onGoTo }) {
  return (
    <section className="search-results">
      <button className="back-link" onClick={onClear}><ArrowLeft size={16} /> Back to reading</button>
      <div className="results-heading">
        <div>
          <p>CONSTITUTIONAL SEARCH</p>
          <h1>Results for “{query}”</h1>
          <span>{results.length} matching {results.length === 1 ? "provision" : "provisions"}</span>
        </div>
        <label>
          <span>FILTER BY ARTICLE</span>
          <select value={articleFilter} onChange={(event) => setArticleFilter(event.target.value)}>
            <option value="ALL">All articles</option>
            {documents.map((article) => <option key={article.roman} value={article.roman}>{article.roman === "PREAMBLE" ? "Preamble" : `Article ${article.roman}`}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      {results.length ? (
        <div className="result-list">
          {results.map(({ article, section }) => (
            <button key={sectionKey(article, section)} onClick={() => onGoTo(article, section)}>
              <div className="result-path">
                <span>ARTICLE {article.roman}</span>
                <i>·</i>
                <span>{section.number ? `SECTION ${section.number}` : "ARTICLE TEXT"}</span>
              </div>
              <h2>{article.title}</h2>
              <p>{highlight(section.text, query)}</p>
              <em>Open provision <ArrowRight size={15} /></em>
            </button>
          ))}
        </div>
      ) : (
        <div className="no-results">
          <Search size={28} />
          <h2>No provisions found</h2>
          <p>Try a shorter phrase, a constitutional concept, or search across all articles.</p>
        </div>
      )}
    </section>
  );
}

function NotesWorkspace({
  open,
  tab,
  setTab,
  notes,
  activeNoteId,
  setActiveNoteId,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  bookmarks,
  research,
  documents,
  onClose,
  onGoTo,
  onRemoveBookmark,
  onOpenResearch,
}) {
  const activeNote = notes.find((note) => note.id === activeNoteId);
  const researchItems = documents.flatMap((article) => {
    const articleEntry = research[articleResearchKey(article)];
    const articleItem = articleEntry?.note || articleEntry?.cases?.length
      ? [{ article, section: null, entry: articleEntry, key: articleResearchKey(article) }]
      : [];
    const sectionItems = article.sections
      .map((section) => ({
        article,
        section,
        entry: research[sectionKey(article, section)],
        key: sectionKey(article, section),
      }))
      .filter((item) => item.entry?.note || item.entry?.cases?.length);
    return [...articleItem, ...sectionItems];
  });

  const formatDate = (timestamp) =>
    new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(timestamp);

  return (
    <aside className={`notes-workspace ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="notes-workspace-heading">
        <div>
          <small>OLIVE’S KNOWLEDGE DESK</small>
          <h2>Notes</h2>
        </div>
        <button className="icon-button" onClick={onClose}><X size={20} /></button>
      </div>
      <nav className="workspace-tabs">
        <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>
          <StickyNote size={16} /> Notes <em>{notes.length}</em>
        </button>
        <button className={tab === "bookmarks" ? "active" : ""} onClick={() => setTab("bookmarks")}>
          <Bookmark size={16} /> Bookmarks <em>{bookmarks.length}</em>
        </button>
        <button className={tab === "research" ? "active" : ""} onClick={() => setTab("research")}>
          <Scale size={16} /> Research <em>{researchItems.length}</em>
        </button>
      </nav>

      {tab === "notes" && (
        <div className="free-notes">
          {activeNote ? (
            <div className="note-editor">
              <div className="note-editor-toolbar">
                <button onClick={() => setActiveNoteId(null)}><ArrowLeft size={16} /> All notes</button>
                <span>Saved automatically</span>
                <button
                  className="delete-note"
                  onClick={() => {
                    if (window.confirm("Delete this note? This cannot be undone.")) onDeleteNote(activeNote.id);
                  }}
                  title="Delete note"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <input
                className="note-title-input"
                value={activeNote.title}
                onChange={(event) => onUpdateNote(activeNote.id, { title: event.target.value })}
                placeholder="Note title"
                autoFocus
              />
              <textarea
                className="note-body-input"
                value={activeNote.body}
                onChange={(event) => onUpdateNote(activeNote.id, { body: event.target.value })}
                placeholder="Start writing…"
              />
            </div>
          ) : (
            <>
              <div className="notes-toolbar">
                <div>
                  <strong>All notes</strong>
                  <span>{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
                </div>
                <button onClick={onCreateNote}><Plus size={17} /> New note</button>
              </div>
              {notes.length ? (
                <div className="note-grid">
                  {[...notes].sort((a, b) => b.updatedAt - a.updatedAt).map((note, index) => (
                    <button key={note.id} className={`note-card tone-${index % 4}`} onClick={() => setActiveNoteId(note.id)}>
                      <strong>{note.title.trim() || "Untitled note"}</strong>
                      <p>{note.body.trim() || "Empty note"}</p>
                      <span>{formatDate(note.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="drawer-empty notes-empty">
                  <StickyNote size={30} />
                  <h3>Capture anything</h3>
                  <p>Draft arguments, meeting notes, checklists, or thoughts that aren’t tied to a provision.</p>
                  <button onClick={onCreateNote}><Plus size={16} /> Create your first note</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "bookmarks" && (
        bookmarks.length ? (
          <div className="drawer-list workspace-list">
            {bookmarks.map(({ article, section, key }) => (
              <div className="drawer-item" key={key}>
                <button onClick={() => { onGoTo(article, section); onClose(); }}>
                  <span>ARTICLE {article.roman}{section.number ? ` · SECTION ${section.number}` : ""}</span>
                  <strong>{article.title}</strong>
                  <p>{section.text}</p>
                </button>
                <button className="remove-save" onClick={() => onRemoveBookmark(article, section)}>Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="drawer-empty">
            <Bookmark size={28} />
            <h3>No bookmarks yet</h3>
            <p>Bookmark a constitutional provision to keep it here.</p>
          </div>
        )
      )}

      {tab === "research" && (
        researchItems.length ? (
          <div className="research-index workspace-list">
            {researchItems.map(({ article, section, entry, key }) => (
              <button key={key} onClick={() => onOpenResearch(article, section)}>
                <div>
                  <span>{article.roman === "PREAMBLE" ? "PREAMBLE" : `ARTICLE ${article.roman}`}{section?.number ? ` · SECTION ${section.number}` : ""}</span>
                  <strong>{article.title}</strong>
                </div>
                <p>{entry.note || `${entry.cases.length} associated ${entry.cases.length === 1 ? "case" : "cases"}`}</p>
                <em><StickyNote size={13} /> {entry.note ? "Note" : "No note"} <Scale size={13} /> {entry.cases?.length || 0}</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="drawer-empty">
            <Scale size={28} />
            <h3>No provision research yet</h3>
            <p>Add a note or associated case from any article or section.</p>
          </div>
        )
      )}
    </aside>
  );
}

export default App;
