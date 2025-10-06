/**
 * @name deltaText
 * @version 3.2.0
 * @author SPAMTON
 * @description HEY HEY HE Y *PRESS C* TO **SKIP TEXT**!!! Typewriter now reliably works for all new messages, while keeping bold jitter, screaming A, and soul-trait colors.
 */

module.exports = class deltaText {
  constructor() {
    this.pendingSpans = [];
    this.processed = new WeakSet();
    this.skip = false;

    this.traits = {
      Determination: "soul-determination",
      Integrity:     "soul-integrity",
      Patience:      "soul-patience",
      Perseverance:  "soul-perseverance",
      Bravery:       "soul-bravery",
      Justice:       "soul-justice",
      Kindness:      "soul-kindness"
    };

    const wordsEsc = Object.keys(this.traits).map(s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
    this.traitsRegex = new RegExp(`\\b(${wordsEsc.join("|")})\\b`, "i");
    this.screamRegex = /A{3,}/g;
  }

  start() {
    this.injectStyle();
    this.keyHandler = (e) => {
      if (e.key && e.key.toLowerCase() === "c") {
        this.skip = true;
        this.pendingSpans.forEach(s => { s.style.opacity = "1"; s.style.visibility = "visible"; });
        this.pendingSpans = [];
      }
    };
    document.addEventListener("keydown", this.keyHandler);

    this.observeRootContainer();
  }

  stop() {
    document.removeEventListener("keydown", this.keyHandler);
    this.rootObserver?.disconnect();
    this.observer?.disconnect();
    const s = document.getElementById("deltaText-style");
    if (s) s.remove();
    this.processed = new WeakSet();
    this.pendingSpans = [];
    this.skip = false;
  }

  injectStyle() {
    if (document.getElementById("deltaText-style")) return;
    const css = `
      @keyframes delta-jitter {
        0% { transform: translate(0,0); }
        25% { transform: translate(-0.6px,0.6px); }
        50% { transform: translate(0.6px,-0.6px); }
        75% { transform: translate(-0.4px,-0.6px); }
        100% { transform: translate(0,0); }
      }
      .delta-letter { display: inline-block; opacity: 1; visibility: visible; }
      .delta-hidden { opacity: 0; visibility: hidden; transition: none; }
      .delta-jitter { animation-name: delta-jitter; animation-iteration-count: infinite; animation-timing-function: linear; animation-duration: 0.18s; }

      .soul-determination { color: #FF0000 !important; }
      .soul-integrity     { color: #0000FF !important; }
      .soul-patience      { color: #14A9FF !important; }
      .soul-perseverance  { color: #FF00FF !important; }
      .soul-bravery       { color: #FFA040 !important; }
      .soul-justice       { color: #FFFF00 !important; }
      .soul-kindness      { color: #00FF00 !important; }
    `;
    const style = document.createElement("style");
    style.id = "deltaText-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  observeRootContainer() {
    this.rootObserver = new MutationObserver(() => {
      const newChatRoot = document.querySelector('[class*="messagesWrapper"]');
      if (newChatRoot && newChatRoot !== this.chatRoot) {
        if (this.observer) this.observer.disconnect();
        this.chatRoot = newChatRoot;
        this.processExistingMessages();
        this.observeNewMessages();
      }
    });
    this.rootObserver.observe(document.body, { childList: true, subtree: true });
  }

  observeNewMessages() {
    if (!this.chatRoot) return;
    this.observer = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const content = n.matches && n.matches('[class*="messageContent"]') ? n : n.querySelector && n.querySelector('[class*="messageContent"]');
          if (content) this.processNewMessage(content);
        }
      }
    });
    this.observer.observe(this.chatRoot, { childList: true, subtree: true });
  }

  processExistingMessages() {
    const nodes = Array.from(document.querySelectorAll('[class*="messageContent"]')).filter(n => n instanceof Node);
    nodes.forEach(n => {
      if (!this.processed.has(n)) {
        this.processed.add(n);
        const frag = this._buildFragment(n, { typewriter: false });
        n.textContent = "";
        n.appendChild(frag.fragment);
        this._startJitterForNode(n);
      }
    });
  }

  processNewMessage(contentNode) {
    if (this.processed.has(contentNode)) return;
    this.processed.add(contentNode);

    // Wait a tiny moment to ensure Discord fully rendered the message
    setTimeout(() => {
      const { fragment, letterSpans } = this._buildFragment(contentNode, { typewriter: true });
      contentNode.textContent = "";
      contentNode.appendChild(fragment);

      if (this.skip) {
        letterSpans.forEach(s => { s.style.opacity = "1"; s.style.visibility = "visible"; });
      } else {
        // TYPEWRITER: reveal letters sequentially every 35ms (approx 60 FPS)
        let idx = 0;
        const revealNext = () => {
          if (this.skip || idx >= letterSpans.length) return;
          letterSpans[idx].style.opacity = "1";
          letterSpans[idx].style.visibility = "visible";
          idx++;
          setTimeout(revealNext, 35);
        };
        revealNext();
      }

      this._startJitterForNode(contentNode);
    }, 50); // small delay to ensure rendering
  }

  _buildFragment(origNode, opts = { typewriter: true }) {
    const fragment = document.createDocumentFragment();
    const letterSpans = [];

    const processElement = (node, parentOut) => {
      if (!(node instanceof Node)) return;
      if (node.nodeType === 3) {
        this._processTextNode(node, parentOut, opts, letterSpans);
      } else if (node.nodeType === 1) {
        const tag = node.tagName.toUpperCase();
        if (tag === "BR") { parentOut.appendChild(document.createElement("br")); return; }
        if (tag === "IMG") { parentOut.appendChild(node.cloneNode(true)); return; }

        const clone = node.cloneNode(false);
        parentOut.appendChild(clone);
        for (const child of Array.from(node.childNodes)) processElement(child, clone);
      }
    };

    for (const child of Array.from(origNode.childNodes)) processElement(child, fragment);
    return { fragment, letterSpans };
  }

  _processTextNode(textNode, parentOut, opts, letterSpans) {
    const text = textNode.textContent || "";
    if (!text) return;

    let i = 0;
    while (i < text.length) {
      const screamMatch = text.slice(i).match(/^A{3,}/);
      if (screamMatch) {
        for (let j = 0; j < screamMatch[0].length; j++) {
          const span = document.createElement("span");
          span.textContent = text[i + j];
          span.className = "delta-letter delta-jitter";
          if (opts.typewriter) { span.classList.add("delta-hidden"); letterSpans.push(span);}
          parentOut.appendChild(span);
        }
        i += screamMatch[0].length;
        continue;
      }

      const traitMatch = text.slice(i).match(this.traitsRegex);
      if (traitMatch && traitMatch.index === 0) {
        const word = traitMatch[0];
        let className = "";
        for (const trait in this.traits) {
          if (trait.toLowerCase() === word.toLowerCase()) {
            className = this.traits[trait];
            break;
          }
        }
        for (let j = 0; j < word.length; j++) {
          const span = document.createElement("span");
          span.textContent = word[j];
          span.className = "delta-letter";
          if (className) span.classList.add(className);
          if (opts.typewriter) { span.classList.add("delta-hidden"); letterSpans.push(span);}
          parentOut.appendChild(span);
        }
        i += word.length;
        continue;
      }

      const span = document.createElement("span");
      span.textContent = text[i];
      span.className = "delta-letter";
      if (textNode.parentElement && textNode.parentElement.closest("b,strong")) span.classList.add("delta-jitter");
      if (opts.typewriter) { span.classList.add("delta-hidden"); letterSpans.push(span);}
      parentOut.appendChild(span);
      i++;
    }
  }

  _startJitterForNode(root) {
    if (!root) return;
    const nodes = root.querySelectorAll(".delta-jitter");
    nodes.forEach(n => {
      const delay = (Math.random()*0.25).toFixed(3)+"s";
      const dur = (0.14+Math.random()*0.14).toFixed(3)+"s";
      n.style.animationDelay = delay;
      n.style.animationDuration = dur;
    });
  }
};

