// ============================================
// NewsHunt — Reader View (Enhanced)
// With text-selection "Explain" and rich formatting
// ============================================

const Reader = {
  currentArticle: null,
  abortController: null,
  explainPopup: null,
  audioElement: null,
  audioUrl: null,
  isTtsPlaying: false,
  autoAdvanceEnabled: true,
  ttsChunks: [],
  currentChunkIndex: 0,
  ttsInstanceId: null,

  // Open and render an article
  async open(guid) {
    this.stopTTS(); // Stop any currently playing audio
    const article = await db.getArticle(guid);
    if (!article) {
      Components.showToast('Article not found', 'error');
      return;
    }

    this.currentArticle = article;
    this.render(article);

    // Mark as read
    await db.markReadAndSync(guid);

    // Check for cached AI content
    const cached = await db.getArticleContent(guid);
    if (cached) {
      this._renderContent(cached);
      this._attachExplainListener();
      return;
    }

    // Fetch and rewrite with AI
    await this._fetchAndRewrite(article);
  },

  // Render the reader layout
  render(article) {
    const readerView = document.getElementById('reader-view');
    const stars = article.stars || 0;

    // Calculate prev/next articles from the current feed list
    let prevGuid = null;
    let nextGuid = null;

    if (App.currentFeedList) {
      const idx = App.currentFeedList.findIndex(a => a.guid === article.guid);
      if (idx > 0) prevGuid = App.currentFeedList[idx - 1].guid;
      if (idx > -1 && idx < App.currentFeedList.length - 1) nextGuid = App.currentFeedList[idx + 1].guid;
    }

    readerView.innerHTML = `
      <div class="reader" id="reader-container">
        <div class="reader__header">
          <div class="reader__category">
            <span class="star-badge star-badge--${stars}">${Utils.starsHtml(stars)}</span>
            ${article.ratingReason ? `<span class="reader__rating-reason">${Utils.escapeHtml(article.ratingReason)}</span>` : ''}
          </div>
          <h1 class="reader__title">${Utils.escapeHtml(article.title)}</h1>
          <div class="reader__meta">
            <span class="reader__source-link">📰 ${Utils.escapeHtml(article.feedTitle || '')}</span>
            <span>${Utils.formatArticleDate(article)}</span>
            ${article.creator ? `<span>by ${Utils.escapeHtml(article.creator)}</span>` : ''}
            <a href="${Utils.escapeHtml(article.link)}" target="_blank" rel="noopener" class="reader__original-link">
              Read Original ↗
            </a>
          </div>
        </div>

        <div class="reader__actions">
          <button class="btn btn--ghost btn--icon" data-tooltip="Chat with Article" onclick="Chat.toggle()">💬</button>
          <button class="btn btn--ghost btn--icon" data-tooltip="Rewrite Article" onclick="Reader.rewrite()">🔄</button>
          <button class="btn btn--ghost btn--icon" data-tooltip="Open Original" onclick="window.open('${Utils.escapeHtml(article.link)}', '_blank')">🔗</button>
          
          <div class="tts-controls" style="display:inline-flex; align-items:center; gap:8px; margin-left:16px; padding-left:16px; border-left:1px solid var(--color-border);">
            <button class="btn btn--primary btn--sm" id="tts-play-btn" onclick="Reader.toggleTTS()">▶️ Listen</button>
            <button class="btn btn--secondary btn--icon btn--sm" id="tts-stop-btn" onclick="Reader.stopTTS()" style="display:none" title="Stop">⏹️</button>
            <button class="btn btn--secondary btn--icon btn--sm" id="tts-restart-btn" onclick="Reader.restartTTS()" style="display:none" title="Start Over">⏮️</button>
            <label style="font-size: 12px; margin-left: 8px; display: flex; align-items: center; gap: 4px; cursor: pointer;" title="Automatically read the next article when finished">
              <input type="checkbox" id="tts-autoadvance" onchange="Reader.autoAdvanceEnabled = this.checked" ${this.autoAdvanceEnabled ? 'checked' : ''}> Auto-advance
            </label>
          </div>

          <span style="flex:1"></span>
          <span class="reader__hint">💡 Select text → Right-click → Explain</span>
        </div>

        <div class="reader__content" id="reader-content">
          <div class="reader__loading">
            <div class="spinner spinner--lg"></div>
            <p class="reader__loading-text">AI is reading and simplifying the article for you...</p>
          </div>
        </div>
      </div>
    `;

    // Inject floating nav bar directly into document.body so position:fixed works
    // (CSS transform on .view--active creates a new containing block, breaking fixed positioning)
    this._removeFloatingNav();
    const nav = document.createElement('div');
    nav.className = 'reader__floating-nav';
    nav.id = 'reader-floating-nav';
    nav.innerHTML = `
      <button class="btn btn--secondary reader__nav-back" onclick="App.navigate('feed')">
        <span>←</span> Back to Feed
      </button>
      <div class="reader__nav-group">
        <button class="btn btn--secondary reader__nav-btn" onclick="App.openReader('${prevGuid}')" ${!prevGuid ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} title="Previous Article">
          <span>↑</span> Prev
        </button>
        <button class="btn btn--secondary reader__nav-btn" onclick="App.openReader('${nextGuid}')" ${!nextGuid ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} title="Next Article">
          <span>↓</span> Next
        </button>
      </div>
    `;
    document.body.appendChild(nav);
    // Trigger the entrance animation on the next frame
    requestAnimationFrame(() => nav.classList.add('reader__floating-nav--visible'));

    // Apply reader preferences
    this._applyReaderPrefs();
  },

  // Remove the floating nav bar (called when leaving reader)
  _removeFloatingNav() {
    document.getElementById('reader-floating-nav')?.remove();
  },

  // Apply reader preferences (font, size, width, etc.)
  async _applyReaderPrefs() {
    const prefs = (await db.getSetting('reader_prefs')) || {};
    const container = document.getElementById('reader-container');
    if (!container) return;

    const fonts = { serif: 'var(--font-serif)', sans: 'var(--font-sans)', mono: 'var(--font-mono)' };
    const widths = { narrow: '600px', normal: '720px', wide: '900px' };

    container.style.maxWidth = widths[prefs.width] || '720px';

    const content = document.getElementById('reader-content');
    if (content) {
      content.style.fontFamily = fonts[prefs.font] || 'var(--font-serif)';
      content.style.fontSize = (prefs.fontSize || 18) + 'px';
      content.style.lineHeight = prefs.lineHeight || 1.85;
    }
  },

  // Build AI rewrite prompt based on reader preferences
  async _buildRewritePrompt() {
    const prefs = (await db.getSetting('reader_prefs')) || {};
    const depth = prefs.depth || 'standard';
    const language = prefs.language || 'standard';
    const showCharts = prefs.showCharts !== false;
    const keyFacts = prefs.keyFacts !== false;
    const autoExplain = prefs.autoExplain !== false;

    const depthGuide = {
      brief: 'Keep it concise. 3-4 paragraphs max. Quick summary format.',
      standard: 'Provide a balanced rewrite with good coverage of key points.',
      detailed: 'Provide an in-depth analysis with comprehensive coverage, context, and implications.'
    };

    const languageGuide = {
      simple: 'Write as if explaining to a curious teenager. No jargon.',
      standard: 'Write for a general adult audience. Explain technical terms when used.',
      expert: 'Use appropriate technical language. Assume the reader has domain knowledge.'
    };

    let prompt = `You are a world - class news editor and educator.Rewrite news articles to maximize reader understanding and value.

## STYLE GUIDELINES
  - Depth: ${depthGuide[depth]}
- Language: ${languageGuide[language]}

## OUTPUT FORMAT(use Markdown)

## Summary
2 - 3 sentence overview.

  ${keyFacts ? `## Key Facts
Use blockquotes with 🔑 emoji:
> 🔑 **Key Fact**: [important fact here]` : ''
      }

## The Full Story
Rewrite the article clearly.Use subheadings to break sections.

** FORMATTING TOOLS you MUST use when appropriate:**
- Use ** bold ** for important names, numbers, dates, and key phrases
  - Use * italic * for emphasis or foreign terms
    - Use < mark > highlighted text</mark > for the most critical pieces of information(numbers, percentages, dates that matter)
      - Use < span class="text-highlight-blue" > blue highlighted text</span > for names of organizations, companies, or people
        - Use < span class="text-highlight-green" > green highlighted text</span > for positive news, gains, or growth
          - Use < span class="text-highlight-red" > red highlighted text</span > for warnings, losses, or negative impacts
            - Use < span class="text-underline" > underlined text</span > for definitions or important conclusions
              - Use < span class="hover-explain" data - explanation="Put your explanation here" > difficult term or concept</span > for terms that might need explanation(the reader can hover over these to see an explanation)
                - Use blockquotes for notable quotes:
  > "Quote here" — Source
  - Use tables for comparing data, statistics, timelines
    - Use horizontal rules(---) between major sections

${autoExplain ? `## Terms Explained
Use blockquotes with 📖 emoji for jargon/technical terms:
> 📖 **[Term]**: [Simple explanation]` : ''
      }

## Remember These
Use blockquotes with 📌 emoji:
> 📌 ** Remember **: [key takeaway]

## Context & Analysis
Brief analysis of why this matters and what it means for the reader.`;

    // Append user's custom prompt if set
    const customPrompt = prefs.customPrompt || '';
    if (customPrompt) {
      prompt += `\n\n## CUSTOM INSTRUCTIONS FROM USER\n${customPrompt}`;
    }

    if (showCharts) {
      prompt += `

OPTIONAL: If there is numerical / statistical data that benefits from visualization, include a JSON code block with a valid Chart.js config:
\`\`\`json
{"type": "bar", "data": {"labels": [...], "datasets": [...]}, "options": {...}}
\`\`\``;
    }

    return prompt;
  },

  // Fetch article content and rewrite with AI
  async _fetchAndRewrite(article) {
    const contentEl = document.getElementById('reader-content');
    if (!contentEl) return;

    const configured = await AI.isConfigured();
    if (!configured) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🔑</div>
          <h3 class="empty-state__title">AI Not Configured</h3>
          <p class="empty-state__desc">Please add your API key in Settings to enable AI-powered article rewriting.</p>
          <button class="btn btn--primary" onclick="App.navigate('settings')">Go to Settings</button>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = `
      <div class="reader__loading">
        <div class="spinner spinner--lg"></div>
        <p class="reader__loading-text">Fetching article content...</p>
      </div>
    `;

    let originalContent = await RSS.fetchArticleContent(article.link);
    if (!originalContent || originalContent.length < 100) {
      originalContent = article.description || article.title;
    }

    const loadingText = contentEl.querySelector('.reader__loading-text');
    if (loadingText) loadingText.textContent = 'AI is rewriting the article for you...';

    const systemPrompt = await this._buildRewritePrompt();
    const userPrompt = `Rewrite this news article:\n\nTitle: ${article.title}\nSource: ${article.feedTitle || 'Unknown'}\n\nOriginal Article:\n${originalContent}`;

    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();

    try {
      contentEl.innerHTML = '';
      let fullContent = '';

      await AI.callStreaming(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        (chunk, accumulated) => {
          fullContent = accumulated;
          contentEl.innerHTML = Utils.renderMarkdown(accumulated) + '<span class="reader__streaming-cursor"></span>';
        },
        { temperature: 0.5, max_tokens: 8192, task: 'reader' }
      );

      this._renderContent(fullContent);
      this._attachExplainListener();
      await db.saveArticleContent(article.guid, fullContent);

    } catch (error) {
      if (error.name !== 'AbortError') {
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">⚠️</div>
            <h3 class="empty-state__title">Error</h3>
            <p class="empty-state__desc">${Utils.escapeHtml(error.message)}</p>
            <button class="btn btn--primary" onclick="Reader.rewrite()">Try Again</button>
          </div>
        `;
      }
    }
  },

  // Render final content with post-processing
  _renderContent(markdown) {
    const contentEl = document.getElementById('reader-content');
    if (!contentEl) return;

    contentEl.innerHTML = Utils.renderMarkdown(markdown);
    Utils.postProcessContent(contentEl);
    this._applyReaderPrefs();
  },

  // Attach the text-selection "Explain" listener
  _attachExplainListener() {
    const contentEl = document.getElementById('reader-content');
    if (!contentEl) return;

    // Context menu (right click) handler
    contentEl.addEventListener('contextmenu', (e) => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText.length > 2 && selectedText.length < 500) {
        e.preventDefault();
        this._showContextMenu(e.clientX, e.clientY, selectedText);
      }
    });

    // Add hover handlers for hover-explain elements
    contentEl.querySelectorAll('.hover-explain').forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const explanation = el.dataset.explanation;
        if (explanation) {
          this._showHoverExplain(e.target, explanation);
        }
      });
      el.addEventListener('mouseleave', () => {
        this._hideHoverExplain();
      });
    });
  },

  // Show custom context menu with "Explain" option
  _showContextMenu(x, y, text) {
    this._removeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'reader-context-menu animate-scale-in';
    menu.id = 'reader-context-menu';
    menu.innerHTML = `
      <button class="reader-context-menu__item" onclick="Reader.explainSelection('${Utils.escapeHtml(text.replace(/'/g, "\\'"))}')">
        <span>🧠</span> Explain this
      </button>
      <button class="reader-context-menu__item" onclick="Reader.defineSelection('${Utils.escapeHtml(text.replace(/'/g, "\\'"))}')">
        <span>📖</span> Define
      </button>
      <button class="reader-context-menu__item" onclick="Reader.askAboutSelection('${Utils.escapeHtml(text.replace(/'/g, "\\'"))}')">
        <span>💬</span> Ask about this
      </button>
    `;

    // Position the menu
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);

    // Adjust if off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

    // Close on click outside
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        this._removeContextMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  },

  _removeContextMenu() {
    document.getElementById('reader-context-menu')?.remove();
  },

  // Show hover explanation popup
  _showHoverExplain(target, explanation) {
    this._hideHoverExplain();

    const popup = document.createElement('div');
    popup.className = 'hover-explain-popup animate-fade-in';
    popup.id = 'hover-explain-popup';
    popup.innerHTML = `<p>${Utils.escapeHtml(explanation)}</p>`;

    document.body.appendChild(popup);

    const targetRect = target.getBoundingClientRect();
    popup.style.left = targetRect.left + 'px';
    popup.style.top = (targetRect.bottom + 8) + 'px';

    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth - 16) {
      popup.style.left = (window.innerWidth - popupRect.width - 16) + 'px';
    }
  },

  _hideHoverExplain() {
    document.getElementById('hover-explain-popup')?.remove();
  },

  // Explain selected text using AI
  async explainSelection(text) {
    this._removeContextMenu();
    this._showExplainPopup(text, 'Explaining...');

    try {
      const response = await AI.call([
        { role: 'system', content: 'You are a helpful explainer. Explain the selected text from a news article in 2-4 sentences. Use simple language. Be concise and informative. Format in markdown if helpful.' },
        { role: 'user', content: `Explain this in the context of the article "${this.currentArticle?.title || 'current article'}":\n\n"${text}"` }
      ], { max_tokens: 300, temperature: 0.4, task: 'reader' });

      this._showExplainPopup(text, response);
    } catch (error) {
      this._showExplainPopup(text, `Error: ${error.message}`);
    }
  },

  // Define selected text
  async defineSelection(text) {
    this._removeContextMenu();
    this._showExplainPopup(text, 'Looking up definition...');

    try {
      const response = await AI.call([
        { role: 'system', content: 'You are a dictionary/encyclopedia. Define the given word or phrase in 1-3 sentences. If it is a name, explain who/what it is. Be concise.' },
        { role: 'user', content: `Define: "${text}"` }
      ], { max_tokens: 200, temperature: 0.2, task: 'reader' });

      this._showExplainPopup(text, response);
    } catch (error) {
      this._showExplainPopup(text, `Error: ${error.message}`);
    }
  },

  // Ask about selection (opens chat)
  askAboutSelection(text) {
    this._removeContextMenu();
    if (!Chat.isOpen) Chat.toggle();

    const input = document.getElementById('chat-input');
    if (input) {
      input.value = `Can you explain this part of the article: "${text}"`;
      input.focus();
    }
  },

  // Show/update the explain popup
  _showExplainPopup(title, content) {
    let popup = document.getElementById('explain-popup');

    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'explain-popup animate-scale-in';
      popup.id = 'explain-popup';
      document.body.appendChild(popup);
    }

    popup.innerHTML = `
      <div class="explain-popup__header">
        <span class="explain-popup__title">🧠 "${Utils.truncate(title, 40)}"</span>
        <button class="btn btn--ghost btn--icon btn--sm" onclick="Reader.closeExplainPopup()" style="font-size:16px">✕</button>
      </div>
      <div class="explain-popup__content">${Utils.renderMarkdown(content)}</div>
    `;

    // Position in the center-bottom of viewport
    popup.style.bottom = '24px';
    popup.style.left = '50%';
    popup.style.transform = 'translateX(-50%)';
  },

  closeExplainPopup() {
    document.getElementById('explain-popup')?.remove();
  },

  // Re-trigger the AI rewrite
  async rewrite() {
    if (!this.currentArticle) return;
    this.stopTTS(); // Stop reading if they rewrite
    await db.saveArticleContent(this.currentArticle.guid, null);
    await this._fetchAndRewrite(this.currentArticle);
  },

  // ============================================
  // TEXT-TO-SPEECH
  // ============================================

  _chunkText(text, maxLen = 800) {
      const chunks = [];
      let current = "";
      const paragraphs = text.split(/\n+/);
      
      for (let p of paragraphs) {
          p = p.trim();
          if (!p) continue;
          
          if (current.length + p.length > maxLen && current.length > 0) {
              chunks.push(current.trim());
              current = "";
          }
          
          // If a single paragraph is larger than maxLen, we should split it by sentences
          if (p.length > maxLen) {
               const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
               for (const s of sentences) {
                   if (current.length + s.length > maxLen && current.length > 0) {
                       chunks.push(current.trim());
                       current = s;
                   } else {
                       current += " " + s;
                   }
               }
          } else {
              current += (current ? "\n" : "") + p;
          }
      }
      if (current.trim().length > 0) chunks.push(current.trim());
      return chunks;
  },

  async toggleTTS() {
    const playBtn = document.getElementById('tts-play-btn');
    if (!playBtn) return;

    if (this.isTtsPlaying) {
      if (this.audioElement) this.audioElement.pause();
      this.isTtsPlaying = false;
      playBtn.innerHTML = '▶️ Resume';
      return;
    }

    // Resume if already loaded
    if (this.audioElement && this.ttsChunks.length > 0 && this.currentChunkIndex < this.ttsChunks.length) {
      this.audioElement.play();
      this.isTtsPlaying = true;
      playBtn.innerHTML = '⏸️ Pause';
      return;
    }

    // Initialize chunks if not already
    if (!this.ttsChunks || this.ttsChunks.length === 0) {
      const contentEl = document.getElementById('reader-content');
      if (!contentEl) return;
      this.ttsChunks = this._chunkText(contentEl.innerText, 800);
      this.currentChunkIndex = 0;
    }

    if (this.currentChunkIndex >= this.ttsChunks.length) {
       this.restartTTS();
       return;
    }
    
    // Safety check - if absolutely no valid chunks extracted, just fail nicely
    if (this.ttsChunks.length === 0) {
       Components.showToast('No text found to read aloud', 'warning');
       return;
    }
    
    await this._playCurrentChunk();
  },

  async _playCurrentChunk() {
     const playBtn = document.getElementById('tts-play-btn');
     const stopBtn = document.getElementById('tts-stop-btn');
     const restartBtn = document.getElementById('tts-restart-btn');

     playBtn.disabled = true;
     playBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:transparent;"></span> Loading...';
     
     const instanceId = Date.now();
     this.ttsInstanceId = instanceId;

     try {
       const text = this.ttsChunks[this.currentChunkIndex];
       if (this.audioUrl) {
           URL.revokeObjectURL(this.audioUrl);
       }
       
       const generatedUrl = await AI.generateSpeech(text, 'hannah');
       if (this.ttsInstanceId !== instanceId) {
           URL.revokeObjectURL(generatedUrl); // Clean up if aborted
           return;
       }
       
       this.audioUrl = generatedUrl;
       this.audioElement = new Audio(this.audioUrl);
       
       this.audioElement.onended = async () => {
          this.currentChunkIndex++;
          if (this.currentChunkIndex < this.ttsChunks.length) {
              // Automatically fetch and play next chunk if we were playing
              if (this.isTtsPlaying && this.ttsInstanceId === instanceId) {
                  await this._playCurrentChunk();
              }
          } else {
              // Finished all chunks matching this article
              this.isTtsPlaying = false;
              if (playBtn) playBtn.innerHTML = '▶️ Listen';
              if (stopBtn) stopBtn.style.display = 'none';
              if (restartBtn) restartBtn.style.display = 'none';
              
              if (this.autoAdvanceEnabled && App.currentFeedList) {
                  const idx = App.currentFeedList.findIndex(a => a.guid === this.currentArticle.guid);
                  if (idx > -1 && idx < App.currentFeedList.length - 1) {
                      const nextGuid = App.currentFeedList[idx + 1].guid;
                      App.openReader(nextGuid).then(() => {
                          setTimeout(() => Reader.toggleTTS(), 1000); 
                      });
                  }
              }
          }
       };

       this.audioElement.play();
       this.isTtsPlaying = true;
       
       if (playBtn) {
           playBtn.disabled = false;
           playBtn.innerHTML = '⏸️ Pause';
       }
       if (stopBtn) stopBtn.style.display = 'inline-flex';
       if (restartBtn) restartBtn.style.display = 'inline-flex';
     } catch (error) {
       console.error(error);
       if (this.ttsInstanceId !== instanceId) return; // user probably clicked Stop while getting an error
       
       const isConfigError = String(error.message).includes('key');
       Components.showToast('TTS Error: ' + error.message, 'error');
       if (playBtn) {
           playBtn.disabled = false;
           playBtn.innerHTML = isConfigError ? '⚠️ API Key Needed' : '▶️ Retry';
       }
       if (isConfigError) setTimeout(() => App.navigate('settings'), 2000);
     }
  },

  stopTTS() {
    this.ttsInstanceId = null; // Aborts any pending chunk loads
    if (this.audioElement) {
       this.audioElement.pause();
    }
    if (this.audioUrl) {
       URL.revokeObjectURL(this.audioUrl);
       this.audioUrl = null;
    }
    this.isTtsPlaying = false;
    this.ttsChunks = [];
    this.currentChunkIndex = 0;
    
    const playBtn = document.getElementById('tts-play-btn');
    const stopBtn = document.getElementById('tts-stop-btn');
    const restartBtn = document.getElementById('tts-restart-btn');
    
    if (playBtn) {
        playBtn.disabled = false;
        playBtn.innerHTML = '▶️ Listen';
    }
    if (stopBtn) stopBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'none';
  },

  restartTTS() {
    this.stopTTS();
    setTimeout(() => this.toggleTTS(), 100);
  }
};
