/*
 * SafeHTML - allow-list sanitizer for HTML that comes from AI models, RSS feeds or crawled pages
 * (typically the output of marked.parse). That content is attacker-influenced: a news article or
 * web page can contain instructions that make a model emit <img onerror=...> or <script>.
 *
 * The HTML is parsed into an inert <template> (nothing runs, nothing loads), every element that is
 * not plain formatting is removed, every attribute outside a small allow-list is dropped and only
 * http(s)/mailto/tel links and http(s)/data-image sources survive.
 *
 *   SafeHTML.sanitize(html)  -> safe HTML string
 *   SafeHTML.escape(text)    -> text with HTML special characters escaped
 */
(function (global) {
    'use strict';

    const HTML_NS = 'http://www.w3.org/1999/xhtml';

    const ALLOWED_TAGS = new Set([
        'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'dd', 'del',
        'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'hr', 'i', 'img', 'input', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp',
        'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
        'thead', 'tr', 'u', 'ul'
    ]);

    // Removed together with everything inside them.
    const DROP_WITH_CONTENT = new Set([
        'script', 'style', 'template', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
        'noscript', 'noembed', 'noframes', 'xmp', 'plaintext', 'svg', 'math', 'textarea', 'select',
        'option', 'button', 'form', 'title', 'head', 'base', 'link', 'meta'
    ]);

    // No id/name (DOM clobbering) and no style (page-covering overlays).
    const GLOBAL_ATTRS = new Set(['title', 'class', 'lang', 'dir']);
    const TAG_ATTRS = {
        a: ['href'],
        img: ['src', 'alt', 'width', 'height'],
        td: ['colspan', 'rowspan', 'align'],
        th: ['colspan', 'rowspan', 'align', 'scope'],
        ol: ['start', 'type', 'reversed'],
        input: ['type', 'checked', 'disabled'],
        details: ['open'],
        col: ['span'],
        colgroup: ['span']
    };

    function isSafeUrl(value, forImage) {
        const raw = String(value || '').trim();
        if (!raw) return false;
        let url;
        try {
            url = new URL(raw, document.baseURI);
        } catch (e) {
            return false;
        }
        if (url.protocol === 'http:' || url.protocol === 'https:') return true;
        if (!forImage && (url.protocol === 'mailto:' || url.protocol === 'tel:')) return true;
        return forImage && url.protocol === 'data:' && /^data:image\/(png|gif|jpe?g|webp|avif);/i.test(raw);
    }

    function cleanChildren(parent) {
        Array.from(parent.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) return;
            if (node.nodeType !== Node.ELEMENT_NODE) {
                node.remove(); // comments, processing instructions, ...
                return;
            }

            const tag = node.localName;
            if (node.namespaceURI !== HTML_NS || DROP_WITH_CONTENT.has(tag)) {
                node.remove();
                return;
            }
            if (!ALLOWED_TAGS.has(tag)) {
                cleanChildren(node);
                node.replaceWith(...Array.from(node.childNodes)); // keep the text, drop the tag
                return;
            }
            if (tag === 'input' && String(node.getAttribute('type') || '').toLowerCase() !== 'checkbox') {
                node.remove();
                return;
            }

            const allowed = TAG_ATTRS[tag] || [];
            Array.from(node.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                if (!GLOBAL_ATTRS.has(name) && !allowed.includes(name)) {
                    node.removeAttribute(attr.name);
                } else if (name === 'href' && !isSafeUrl(attr.value, false)) {
                    node.removeAttribute(attr.name);
                } else if (name === 'src' && !isSafeUrl(attr.value, true)) {
                    node.removeAttribute(attr.name);
                }
            });

            if (tag === 'a' && node.hasAttribute('href') && !node.getAttribute('href').trim().startsWith('#')) {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }
            if (tag === 'input') node.setAttribute('disabled', '');

            cleanChildren(node);
        });
    }

    function sanitize(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html == null ? '' : html);
        cleanChildren(template.content);
        return template.innerHTML;
    }

    function escape(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    global.SafeHTML = Object.freeze({ sanitize, escape });
})(window);
