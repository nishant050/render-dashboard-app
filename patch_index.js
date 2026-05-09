const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

function addShareBtn(html, text, appName, displayName) {
    const regex = new RegExp('(<div class="app-info">[\\\\s\\\\S]*?<h2>' + text + '</h2>[\\\\s\\\\S]*?</div>)', 'g');
    return html.replace(regex, `$1\n                <button class="share-btn" onclick="event.preventDefault(); openShareModal('${appName}', '${displayName}')">🔗 Share</button>`);
}

html = addShareBtn(html, 'Fretboard Trainer', 'Fretboard-Trainer', 'Fretboard Trainer');
html = addShareBtn(html, 'Quick Notes', 'quicknotes', 'Quick Notes');
html = addShareBtn(html, 'Learn Investing', 'learn-investing', 'Learn Investing');
html = addShareBtn(html, 'Chemistry Notes', 'chemistry-schedule', 'Chemistry Notes');
html = addShareBtn(html, 'NewsHunt', 'newshunt', 'NewsHunt');

// Add Modal and Script at the end of body
const modalHtml = `
    <div id="shareModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeShareModal()">&times;</span>
            <h2 id="shareModalTitle">Share App</h2>
            <div id="shareModalBody">
                <button id="createShareBtn" class="btn">Generate Share Link</button>
                <div id="shareLinkContainer" style="display:none; margin-top: 15px; align-items: center; gap: 10px;">
                    <input type="text" id="shareLinkInput" readonly style="flex:1; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
                    <button id="copyShareBtn" class="btn" style="padding: 8px 12px;">Copy</button>
                </div>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <h3>Active Shares</h3>
                <ul id="activeSharesList" style="list-style: none; padding: 0;"></ul>
            </div>
        </div>
    </div>
    <script>
        let currentShareApp = '';
        function openShareModal(appName, displayName) {
            currentShareApp = appName;
            document.getElementById('shareModalTitle').innerText = 'Share ' + displayName;
            document.getElementById('shareModal').style.display = 'block';
            document.getElementById('shareLinkContainer').style.display = 'none';
            loadActiveShares(appName);
        }
        function closeShareModal() {
            document.getElementById('shareModal').style.display = 'none';
        }
        window.onclick = function(event) {
            if (event.target == document.getElementById('shareModal')) {
                closeShareModal();
            }
        }
        document.getElementById('createShareBtn').onclick = async () => {
            const res = await fetch('/api/share', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ appName: currentShareApp })
            });
            const data = await res.json();
            if(data.success) {
                const link = window.location.origin + data.link;
                document.getElementById('shareLinkInput').value = link;
                document.getElementById('shareLinkContainer').style.display = 'flex';
                loadActiveShares(currentShareApp);
            }
        };
        document.getElementById('copyShareBtn').onclick = () => {
            const input = document.getElementById('shareLinkInput');
            input.select();
            document.execCommand('copy');
            alert('Copied to clipboard');
        };
        async function loadActiveShares(appName) {
            const res = await fetch('/api/share');
            const data = await res.json();
            const list = document.getElementById('activeSharesList');
            list.innerHTML = '';
            data.filter(s => s.appName === appName && s.isActive).forEach(s => {
                const li = document.createElement('li');
                li.style.marginBottom = '10px';
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.innerHTML = \`<span>Link: ...\${s.sessionId.substr(-6)} (Created: \${new Date(s.createdAt).toLocaleDateString()})</span> <button onclick="revokeShare('\${s.sessionId}')" class="revoke-btn">Revoke</button>\`;
                list.appendChild(li);
            });
        }
        async function revokeShare(sessionId) {
            if(!confirm('Are you sure you want to revoke this link? The guest will lose access.')) return;
            const res = await fetch('/api/share/' + sessionId, { method: 'DELETE' });
            if(res.ok) loadActiveShares(currentShareApp);
        }
    </script>
`;

if (!html.includes('shareModal')) {
    html = html.replace('</body>', modalHtml + '\n</body>');
}

fs.writeFileSync('index.html', html);
console.log('Patched index.html');
