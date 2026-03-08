// ============================================
// NewsHunt — Chat With Article (Enhanced)
// Natural expand/minimize, full markdown support
// ============================================

const Chat = {
  isOpen: false,
  isMinimized: false,
  currentGuid: null,

  // Toggle chat panel visibility
  toggle() {
    if (!document.getElementById('chat-panel')) this._createPanel();

    if (this.isMinimized) {
      this.isMinimized = false;
      this.isOpen = true;
      this._updatePanelState();
      return;
    }

    this.isOpen = !this.isOpen;
    this._updatePanelState();

    if (this.isOpen && Reader.currentArticle) {
      this.currentGuid = Reader.currentArticle.guid;
      this._loadHistory();
    }
  },

  // Minimize to a floating bubble
  minimize() {
    this.isMinimized = true;
    this.isOpen = false;
    this._updatePanelState();
  },

  // Close completely
  close() {
    this.isOpen = false;
    this.isMinimized = false;
    this._updatePanelState();
  },

  _updatePanelState() {
    const panel = document.getElementById('chat-panel');
    const bubble = document.getElementById('chat-bubble');

    if (panel) {
      panel.classList.toggle('chat-panel--open', this.isOpen);
    }

    if (this.isMinimized) {
      if (!bubble) this._createBubble();
      document.getElementById('chat-bubble')?.classList.add('chat-bubble--visible');
    } else {
      bubble?.classList.remove('chat-bubble--visible');
    }
  },

  // Create the minimized chat bubble
  _createBubble() {
    const bubble = document.createElement('button');
    bubble.id = 'chat-bubble';
    bubble.className = 'chat-bubble';
    bubble.innerHTML = '💬';
    bubble.onclick = () => this.toggle();
    bubble.title = 'Open Chat';
    document.body.appendChild(bubble);
  },

  // Create the chat panel DOM
  _createPanel() {
    const panel = document.createElement('div');
    panel.id = 'chat-panel';
    panel.className = 'chat-panel';
    panel.innerHTML = `
      <div class="chat-panel__header">
        <span class="chat-panel__title">
          <span class="chat-panel__title-icon">💬</span>
          Chat with Article
        </span>
        <div class="chat-panel__header-actions">
          <button class="btn btn--ghost btn--icon btn--sm" onclick="Chat.minimize()" title="Minimize">─</button>
          <button class="btn btn--ghost btn--icon btn--sm" onclick="Chat.close()" title="Close">✕</button>
        </div>
      </div>
      <div class="chat-panel__messages" id="chat-messages">
        <div class="chat-message chat-message--ai">
          <div class="chat-message__avatar">🤖</div>
          <div class="chat-message__body">
            <span class="chat-message__role">AI Assistant</span>
            <div class="chat-message__bubble">
              <p>Hey! I've read this article. Feel free to ask me anything — I can explain concepts, summarize sections, provide analysis, or answer questions about what you're reading.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="chat-panel__input">
        <input type="text" class="input" id="chat-input" placeholder="Ask a question about the article..." onkeydown="if(event.key==='Enter'&&!event.shiftKey)Chat.send()">
        <button class="btn btn--primary btn--icon" onclick="Chat.send()" title="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    // Make panel resizable via drag on left edge
    this._makeResizable(panel);
  },

  _makeResizable(panel) {
    const handle = document.createElement('div');
    handle.className = 'chat-panel__resize-handle';
    panel.prepend(handle);

    let startX, startWidth;
    handle.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });

    function onMouseMove(e) {
      const diff = startX - e.clientX;
      panel.style.width = Math.max(320, Math.min(600, startWidth + diff)) + 'px';
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  },

  // Load chat history for current article
  async _loadHistory() {
    if (!this.currentGuid) return;

    const messages = await db.getChatHistory(this.currentGuid);
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = `
      <div class="chat-message chat-message--ai">
        <div class="chat-message__avatar">🤖</div>
        <div class="chat-message__body">
          <span class="chat-message__role">AI Assistant</span>
          <div class="chat-message__bubble">
            <p>Hey! I've read this article. Feel free to ask me anything about it.</p>
          </div>
        </div>
      </div>
    `;

    messages.forEach(msg => {
      this._appendMessage(msg.role, msg.content, false);
    });

    container.scrollTop = container.scrollHeight;
  },

  // Send a message
  async send() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    input.disabled = true;

    this._appendMessage('user', question);
    await db.addChatMessage(this.currentGuid, 'user', question);

    const article = Reader.currentArticle;
    const cachedContent = await db.getArticleContent(this.currentGuid);
    const history = await db.getChatHistory(this.currentGuid);

    const messages = [
      {
        role: 'system',
        content: `You are a helpful, friendly news assistant. The user is reading: "${article.title}" from ${article.feedTitle || 'unknown source'}.

Article content:
${cachedContent || article.description || 'No content available.'}

**Rules:**
- Be concise but thorough
- Format your response in Markdown 
- Use **bold** for key terms, numbers
- Use bullet points for lists
- If the user asks to explain something, use simple language
- Be conversational and helpful`
      }
    ];

    const recentHistory = history.slice(-10);
    recentHistory.forEach(msg => {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : msg.role, content: msg.content });
    });
    messages.push({ role: 'user', content: question });

    const loadingEl = this._appendMessage('ai', '...', false, true);

    try {
      let aiResponse = '';
      await AI.callStreaming(
        messages,
        (chunk, accumulated) => {
          aiResponse = accumulated;
          const bubble = loadingEl.querySelector('.chat-message__bubble');
          if (bubble) bubble.innerHTML = Utils.renderMarkdown(accumulated);
          const container = document.getElementById('chat-messages');
          if (container) container.scrollTop = container.scrollHeight;
        },
        { temperature: 0.6, max_tokens: 2048 }
      );

      await db.addChatMessage(this.currentGuid, 'assistant', aiResponse);
    } catch (error) {
      const bubble = loadingEl.querySelector('.chat-message__bubble');
      if (bubble) bubble.innerHTML = `<p style="color: var(--color-error)">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }

    input.disabled = false;
    input.focus();
  },

  // Append a message to the chat
  _appendMessage(role, content, scroll = true, isLoading = false) {
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    const isUser = role === 'user';
    const el = document.createElement('div');
    el.className = `chat-message chat-message--${isUser ? 'user' : 'ai'}`;

    const renderedContent = isLoading
      ? '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:4px 0;"></div>'
      : (isUser ? `<p>${Utils.escapeHtml(content)}</p>` : Utils.renderMarkdown(content));

    const avatar = isUser ? '👤' : '🤖';

    el.innerHTML = `
      <div class="chat-message__avatar">${avatar}</div>
      <div class="chat-message__body">
        <span class="chat-message__role">${isUser ? 'You' : 'AI Assistant'}</span>
        <div class="chat-message__bubble">${renderedContent}</div>
      </div>
    `;

    container.appendChild(el);
    if (scroll) container.scrollTop = container.scrollHeight;

    return el;
  }
};
