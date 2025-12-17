const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');

// --- Events ---
dropZone.addEventListener('dragover', (e) => { 
    e.preventDefault(); 
    dropZone.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; 
});

dropZone.addEventListener('dragleave', () => { 
    dropZone.style.backgroundColor = 'transparent'; 
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = 'transparent';
    if(e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
});

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if(fileInput.files.length) uploadFile(fileInput.files[0]);
});

// --- Logic ---
function uploadFile(file) {
    // Création de l'élément visuel dans la liste
    const item = document.createElement('div');
    item.classList.add('file-item');
    // On met un petit emoji fusée pour le style
    item.innerHTML = `<span>🚀 Envoi de <strong>${file.name}</strong>... </span><div class="loader"></div>`;
    
    // "prepend" ajoute le fichier en haut de la liste (plus pratique que appendChild)
    fileList.prepend(item);

    const formData = new FormData();
    formData.append('file', file);

    // On utilise le proxy pour contourner les erreurs CORS
    const proxyUrl = 'https://corsproxy.io/?';
    const uploadUrl = 'https://tmpfiles.org/api/v1/upload';

    // 1. UPLOAD VERS TMPFILES
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
            // 2. SUCCÈS : On récupère l'URL et on ajoute /dl/ pour le téléchargement direct
            let longUrl = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            
            // Génération du QR Code basé sur l'URL longue
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(longUrl)}`;

            // 3. AFFICHAGE FINAL (Sans raccourcisseur)
            // On utilise les classes CSS responsive (url-box, action-btn)
            item.innerHTML = `
                <div style="margin-bottom:5px;">✅ <strong>${file.name}</strong> est prêt !</div>
                
                <div class="url-box">${longUrl}</div>

                <div style="text-align:center; margin-top:10px;">
                    <button class="action-btn" onclick="navigator.clipboard.writeText('${longUrl}'); showToast();">Copier le lien</button>
                    <a href="${longUrl}" target="_blank" class="action-btn">Ouvrir</a>
                </div>

                <img src="${qrCodeUrl}" class="qr-code" alt="QR Code" title="Scan pour mobile">
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

function showToast() {
    const toast = document.getElementById("toast");
    toast.className = "show";
    setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 3000);
}