const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');

// --- Events ---
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
    // 1. Vérif Taille (100 Mo)
    if (file.size > 100 * 1024 * 1024) {
        alert("⚠️ Fichier trop volumineux (Max 100 Mo)");
        return;
    }

    // 2. Détection fichiers sensibles (Code ou sans extension)
    // Ce sont eux qui provoquent l'erreur 502 s'ils ne sont pas zippés
    const hasNoExtension = !file.name.includes('.');
    const riskyExtensions = ['.py', '.md', '.js', '.html', '.php', '.sh', '.bat', '.css', '.json', '.xml', '.ts', '.c', '.cpp', '.java', '.rb', '.go', '.pl', '.sql'];
    
    let fileExt = "";
    if (!hasNoExtension) {
        fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    }
    
    const needsZip = hasNoExtension || riskyExtensions.includes(fileExt);

    if (needsZip) {
        createZipAndUpload(file);
    } else {
        // Envoi direct pour les fichiers "sûrs" (images, pdf, zip, vidéos...)
        displayAndUpload(file, file.name, false);
    }
}

function createZipAndUpload(file) {
    const item = document.createElement('div');
    item.classList.add('file-item');
    item.innerHTML = `<span>📦 Compression (fichier sensible)... </span><div class="loader"></div>`;
    fileList.prepend(item);

    // Lecture du fichier en mémoire pour fflate
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const fileContent = new Uint8Array(e.target.result);
        
        // Structure du ZIP
        const zipData = {};
        zipData[file.name] = fileContent;

        // Création du ZIP (Niveau 1 = Rapide)
        fflate.zip(zipData, { level: 1 }, (err, data) => {
            if (err) {
                console.error(err);
                item.innerHTML = `<span style="color: #ff6b6b;">❌ Erreur ZIP: ${err.message}</span>`;
                return;
            }

            // On crée l'objet fichier ZIP
            const zipName = file.name + ".zip";
            const zipFile = new File([data], zipName, { type: "application/zip" });
            
            item.remove(); // On enlève le message de compression
            
            // On lance l'envoi du ZIP, en précisant 'true' pour dire qu'on l'a zippé nous-même
            displayAndUpload(zipFile, file.name, true);
        });
    };

    reader.onerror = function() {
        item.innerHTML = `<span style="color: #ff6b6b;">❌ Erreur de lecture fichier</span>`;
    };

    reader.readAsArrayBuffer(file);
}

function displayAndUpload(fileToSend, originalName, wasZippedByUs) {
    const item = document.createElement('div');
    item.classList.add('file-item');
    item.innerHTML = `<span>🚀 Envoi de <strong>${originalName}</strong>... </span><div class="loader"></div>`;
    fileList.prepend(item);

    const formData = new FormData();
    formData.append('file', fileToSend);

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

            // Si on a zippé le fichier nous-mêmes, on l'indique dans le nom final
            let finalName = wasZippedByUs ? originalName + " (.zip)" : originalName;

            item.innerHTML = `
                <div style="margin-bottom:5px;">✅ <strong>${finalName}</strong> est prêt !</div>
                
                <div class="url-box">${longUrl}</div>

                <div style="text-align:center; margin-top:10px;">
                    <button class="action-btn" onclick="navigator.clipboard.writeText('${longUrl}'); showToast();">Copier</button>
                    <a href="${longUrl}" target="_blank" class="action-btn">Télécharger</a>
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

function showToast() {
    const toast = document.getElementById("toast");
    if(toast) {
        toast.className = "show";
        setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 3000);
    }
}