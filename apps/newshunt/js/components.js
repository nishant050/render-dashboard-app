// ============================================
// NewsHunt — Reusable UI Components
// ============================================

const Components = {
    // Create an article card
    createArticleCard(article) {
        const card = document.createElement('div');
        card.className = 'card card--interactive article-card animate-fade-in';
        card.dataset.guid = article.guid;
        card.onclick = () => App.openReader(article.guid);

        const stars = article.stars || 0;
        const starBadge = stars > 0 ? `<span class="star-badge star-badge--${stars}">${Utils.starsHtml(stars)}</span>` : '<span class="star-badge star-badge--1" style="opacity:0.5">Uncategorized</span>';

        card.innerHTML = `
      <div class="article-card__header">
        <h3 class="article-card__title">${Utils.escapeHtml(article.title)}</h3>
        ${starBadge}
      </div>
  <p class="article-card__description">${Utils.escapeHtml(article.description || '')}</p>
  <div class="article-card__meta">
    <span class="article-card__source">
      <span>📰</span>
      <span>${Utils.escapeHtml(article.feedTitle || Utils.extractDomain(article.feedUrl || ''))}</span>
    </span>
    <span class="article-card__date">${Utils.formatDate(article.pubDate)}</span>
    ${article.ratingReason ? `<span title="${Utils.escapeHtml(article.ratingReason)}" style="cursor:help">💡</span>` : ''}
    <button class="btn btn--ghost btn--sm article-card__flag" title="Flag as irrelevant (downgrade to 1-star)" onclick="(function(e){ e.stopPropagation(); App.flagArticle('${article.guid}'); })(event)">🚩</button>
  </div>
`;

        return card;
    },

    // Create star filter tabs
    createStarTabs(activeFilter, onFilterChange) {
        const tabs = document.createElement('div');
        tabs.className = 'tabs';

        const filters = [
            { value: 'all', label: 'All' },
            { value: '5', label: '★★★★★' },
            { value: '4', label: '★★★★☆' },
            { value: '3', label: '★★★☆☆' },
            { value: '2', label: '★★☆☆☆' },
            { value: '1', label: '★☆☆☆☆' },
            { value: 'uncategorized', label: '❓ Unrated' }
        ];

        filters.forEach(f => {
            const tab = document.createElement('button');
            tab.className = `tab ${activeFilter === f.value ? 'tab--active' : ''}`;
            tab.textContent = f.label;
            tab.onclick = () => onFilterChange(f.value);
            tabs.appendChild(tab);
        });

        return tabs;
    },

    // Create a tag input component
    createTagInput(id, existingTags = [], placeholder = 'Type and press Enter...') {
        const container = document.createElement('div');
        container.className = 'tags-container';
        container.id = id;

        const chipsWrapper = document.createElement('div');
        chipsWrapper.style.display = 'contents';

        existingTags.forEach(tag => {
            chipsWrapper.appendChild(this._createTagChip(tag, chipsWrapper, id));
        });

        const input = document.createElement('input');
        input.className = 'tags-input';
        input.placeholder = placeholder;
        input.type = 'text';

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                const value = input.value.trim();
                chipsWrapper.appendChild(this._createTagChip(value, chipsWrapper, id));
                input.value = '';
                this._emitTagChange(id, chipsWrapper);
            } else if (e.key === 'Backspace' && !input.value) {
                const chips = chipsWrapper.querySelectorAll('.tag-chip');
                if (chips.length > 0) {
                    chips[chips.length - 1].remove();
                    this._emitTagChange(id, chipsWrapper);
                }
            }
        });

        container.appendChild(chipsWrapper);
        container.appendChild(input);
        container.addEventListener('click', () => input.focus());

        return container;
    },

    _createTagChip(text, wrapper, containerId) {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `
      ${Utils.escapeHtml(text)}
      <span class="tag-chip__remove">×</span>
    `;
        chip.querySelector('.tag-chip__remove').onclick = (e) => {
            e.stopPropagation();
            chip.remove();
            this._emitTagChange(containerId, wrapper);
        };
        return chip;
    },

    _emitTagChange(containerId, wrapper) {
        const tags = [...wrapper.querySelectorAll('.tag-chip')].map(c => c.textContent.replace('×', '').trim());
        document.getElementById(containerId)?.dispatchEvent(
            new CustomEvent('tags-changed', { detail: { tags } })
        );
    },

    // Get tags from a tag input
    getTagValues(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];

        let tags = [...container.querySelectorAll('.tag-chip')].map(c => c.textContent.replace('×', '').trim());

        // Also capture any pending text in the input field
        const input = container.querySelector('.tags-input');
        if (input && input.value.trim()) {
            const pending = input.value.split(',').map(s => s.trim()).filter(Boolean);
            tags = tags.concat(pending);
            input.value = ''; // clear it
        }

        return [...new Set(tags)]; // return unique tags
    },

    // Create a toast notification
    showToast(message, type = 'info', duration = 4000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
      <span class="toast__icon">${icons[type] || icons.info}</span>
      <span class="toast__message">${Utils.escapeHtml(message)}</span>
      <button class="toast__close" onclick="this.closest('.toast').remove()">✕</button>
    `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight var(--transition-slow) ease-in forwards';
            setTimeout(() => toast.remove(), 350);
        }, duration);

        return toast;
    },

    // Create empty state
    createEmptyState(icon, title, description, actionBtn = null) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
      <div class="empty-state__icon">${icon}</div>
      <h3 class="empty-state__title">${Utils.escapeHtml(title)}</h3>
      <p class="empty-state__desc">${Utils.escapeHtml(description)}</p>
    `;
        if (actionBtn) {
            empty.appendChild(actionBtn);
        }
        return empty;
    },

    // Create a modal
    showModal(title, bodyHtml, buttons = []) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
      <div class="modal__header">
        <h3 class="modal__title">${Utils.escapeHtml(title)}</h3>
        <button class="btn btn--ghost btn--icon" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal__body">${bodyHtml}</div>
      ${buttons.length ? `<div class="modal__footer"></div>` : ''}
    `;

        if (buttons.length) {
            const footer = modal.querySelector('.modal__footer');
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = `btn ${btn.class || 'btn--secondary'}`;
                button.textContent = btn.label;
                button.onclick = () => {
                    if (btn.action) btn.action(overlay);
                    if (btn.close !== false) overlay.remove();
                };
                footer.appendChild(button);
            });
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        return overlay;
    },

    // Article count badge update
    updateNavBadge(viewName, count) {
        const badge = document.querySelector(`[data-view="${viewName}"] .sidebar__nav-badge`);
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
    }
};
