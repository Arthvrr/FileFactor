const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');

// --- Events (Inchangés) ---
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.backgroundColor = 'transparent'; });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = 'transparent';
    if(e.dataTransfer.files.length) prepareAndUpload(e.dataTransfer.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    if(fileInput.files.length) prepareAndUpload(fileInput.files[0]);
});

// --- Logic ---

function prepareAndUpload(file) {
    // Liste des extensions qui provoquent souvent des erreurs 502 (Code)
    const riskyExtensions = ['.py', '.md', '.js', '.html', '.php', '.sh', '.bat', '.css', '.json', '.xml', '.ts', '.c', '.cpp', '.java',' '];
    
    // On vérifie si le fichier a une extension risquée
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    let fileToSend = file;
    let renamed = false;

    if (riskyExtensions.includes(fileExt)) {
        renamed = true;
        // ON DÉGUISE LE FICHIER :
        // 1. On garde le même contenu
        // 2. On ajoute ".txt" à la fin du nom (ex: script.py.txt)
        // 3. On force le type MIME en 'text/plain' pour calmer le Proxy
        fileToSend = new File([file], file.name + ".txt", { type: 'text/plain' });
    }

    uploadFile(fileToSend, file.name, renamed);
}

function uploadFile(file, originalName, isRenamed) {
    const item = document.createElement('div');
    item.classList.add('file-item');
    item.innerHTML = `<span>🚀 Envoi de <strong>${originalName}</strong>... </span><div class="loader"></div>`;
    fileList.prepend(item);

    const formData = new FormData();
    formData.append('file', file);

    const proxyUrl = 'https://corsproxy.io/?';
    const uploadUrl = 'https://tmpfiles.org/api/v1/upload';

    fetch(proxyUrl + encodeURIComponent(uploadUrl), {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if (!res.ok) throw new Error("Erreur Upload: " + res.status);
        return res.json();
    })
    .then(data => {
        if (data.status === 'success') {
            let longUrl = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(longUrl)}`;

            // Message d'avertissement si on a renommé le fichier
            let warningMsg = "";
            if (isRenamed) {
                warningMsg = `<div style="color: #ffd700; font-size: 0.9em; margin-top: 5px;">
                    ⚠️ Fichier converti en <strong>.txt</strong> pour l'envoi.<br>
                    Pense à retirer le ".txt" après téléchargement !
                </div>`;
            }

            item.innerHTML = `
                <div style="margin-bottom:5px;">✅ <strong>${file.name}</strong> est prêt !</div>
                ${warningMsg}
                
                <div class="url-box">${longUrl}</div>

                <div style="text-align:center; margin-top:10px;">
                    <button class="action-btn" onclick="navigator.clipboard.writeText('${longUrl}')">Copier le lien</button>
                    <a href="${longUrl}" target="_blank" class="action-btn">Ouvrir</a>
                </div>

                <div style="text-align: center; margin-top: 15px;">
                    <img src="${qrCodeUrl}" class="qr-code" alt="QR Code" title="Scan pour mobile">
                </div>
            `;
        } else {
            throw new Error("L'API a refusé le fichier.");
        }
    })
    .catch(err => {
        console.error(err);
        item.innerHTML = `<span style="color: #ff6b6b;">❌ Erreur: ${err.message}</span>`;
    });
}