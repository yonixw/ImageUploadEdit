/**
 * Image Editor - Internationalization (i18n)
 * Loaded synchronously in <head> (before the body is parsed) so that language & text
 * direction are known before first paint. Non-English pages are kept hidden via the
 * `i18n-pending` class until static markup has been translated, preventing any flash
 * of English text or LTR->RTL layout flip.
 *
 * Usage:
 *   HTML: <span data-i18n="key">English fallback</span>
 *         <button data-i18n-title="key"> / data-i18n-placeholder / data-i18n-aria-label
 *   JS:   t("key"), t("key", { count: 3 })  -> "{count}" placeholders are substituted
 *
 * Language resolution: ?lang= / #lang= -> navigator.languages -> "en".
 * Host may also switch at runtime via postMessage INIT config.lang (see editor_host.js).
 */

window.EditorI18n = (function () {
  const FALLBACK_LANG = "en";
  const SUPPORTED = {
    en: { dir: "ltr", name: "English" },
    he: { dir: "rtl", name: "עברית" },
    ja: { dir: "ltr", name: "日本語" },
    de: { dir: "ltr", name: "Deutsch" },
  };

  const dictionaries = {};
  let currentLang = FALLBACK_LANG;
  let pluralRules = null;

  function normalize(code) {
    if (!code) return null;
    const base = String(code).toLowerCase().trim().split(/[-_]/)[0];
    if (base === "iw") return "he"; // legacy Hebrew code
    return SUPPORTED[base] ? base : null;
  }

  function detectLanguage() {
    const getParam = window.EditorGetParam;
    const fromParam = normalize(typeof getParam === "function" ? getParam("lang") : null);
    if (fromParam) return fromParam;

    const browserLangs = navigator.languages || [navigator.language];
    for (let i = 0; i < browserLangs.length; i++) {
      const match = normalize(browserLangs[i]);
      if (match) return match;
    }
    return FALLBACK_LANG;
  }

  function register(lang, dict) {
    dictionaries[lang] = Object.assign(dictionaries[lang] || {}, dict);
  }

  function lookup(lang, key) {
    const dict = dictionaries[lang];
    return dict && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
  }

  /**
   * Translate a key. If params.count is a number, a plural variant `key_<category>`
   * (one / two / few / many / other, per Intl.PluralRules) is preferred when present.
   */
  function t(key, params) {
    let str;
    if (params && typeof params.count === "number") {
      const category = pluralRules ? pluralRules.select(params.count) : "other";
      str =
        lookup(currentLang, `${key}_${category}`) ??
        lookup(currentLang, `${key}_other`) ??
        lookup(FALLBACK_LANG, `${key}_${params.count === 1 ? "one" : "other"}`) ??
        lookup(FALLBACK_LANG, `${key}_other`);
    }
    if (str === undefined) str = lookup(currentLang, key);
    if (str === undefined) str = lookup(FALLBACK_LANG, key);
    if (str === undefined) {
      console.warn("[i18n] Missing key:", key);
      return key;
    }
    if (params) {
      str = str.replace(/\{(\w+)\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m,
      );
    }
    return str;
  }

  /** Plain lookup in a specific language (no params / plurals). */
  function tFor(lang, key) {
    return lookup(lang, key) ?? lookup(FALLBACK_LANG, key) ?? key;
  }

  const ATTRS = [
    ["data-i18n-title", "title"],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-aria-label", "aria-label"],
  ];

  /** Translate all annotated elements under root (defaults to whole document). */
  function apply(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const text = t(el.getAttribute("data-i18n"));
      if (el.tagName === "TITLE") document.title = text;
      else el.textContent = text;
    });
    ATTRS.forEach(([dataAttr, attr]) => {
      root.querySelectorAll(`[${dataAttr}]`).forEach((el) => {
        el.setAttribute(attr, t(el.getAttribute(dataAttr)));
      });
    });
  }

  function setDocumentLanguage(lang) {
    currentLang = lang;
    try {
      pluralRules = new Intl.PluralRules(lang);
    } catch (e) {
      pluralRules = null;
    }
    const html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", SUPPORTED[lang].dir);
  }

  /** Switch language at runtime (e.g. from host INIT message). */
  function setLanguage(code) {
    const lang = normalize(code);
    if (!lang || lang === currentLang) return;
    const prev = currentLang;
    setDocumentLanguage(lang);
    apply(document);
    window.dispatchEvent(
      new CustomEvent("editor:languagechange", { detail: { lang, prev } }),
    );
  }

  function reveal() {
    document.documentElement.classList.remove("i18n-pending");
  }

  // --- Boot (runs in <head>, before body is parsed) ---
  setDocumentLanguage(detectLanguage());

  if (currentLang !== FALLBACK_LANG) {
    // Hide body until static markup is translated (see theme.css `.i18n-pending`).
    document.documentElement.classList.add("i18n-pending");
    // Safety net: never leave the page hidden if something goes wrong.
    setTimeout(reveal, 2000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Registered in <head>, so this runs before editor_main.js bootstraps.
    if (currentLang !== FALLBACK_LANG) apply(document);
    reveal();
  });

  return {
    SUPPORTED,
    get lang() {
      return currentLang;
    },
    get dir() {
      return SUPPORTED[currentLang].dir;
    },
    register,
    t,
    tFor,
    apply,
    setLanguage,
  };
})();

// Short global alias used throughout the editor modules
window.t = window.EditorI18n.t;
