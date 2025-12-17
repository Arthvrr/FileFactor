const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input'); // NOUVEAU
const fileList = document.getElementById('file-list');

// --- Events ---
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.backgroundColor = 'transparent'; });

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = 'transparent';
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
        handleDroppedItems(items);
    } else if (e.dataTransfer.files.length > 0) {
        processFiles(Array.from(e.dataTransfer.files));
    }
});

// Le clic sur la zone globale ne déclenche plus rien (car on a mis des boutons)
// dropZone.addEventListener('click', ...) -> SUPPRIMÉ

// Écouteur pour les FICHIERS
fileInput.addEventListener('change', () => {
    if(fileInput.files.length) processFiles(Array.from(fileInput.files));
});

// Écouteur pour les DOSSIERS
folderInput.addEventListener('change', () => {
    if(folderInput.files.length) processFiles(Array.from(folderInput.files));
});


// --- SCANNER DRAG & DROP (Inchangé) ---
async function handleDroppedItems(items) {
    const files = [];
    const entries = Array.from(items).map(item => item.webkitGetAsEntry ? item.webkitGetAsEntry() : null).filter(e => e);

    async function traverseFileTree(entry, path = "") {
        if (entry.isFile) {
            const file = await new Promise(resolve => entry.file(resolve));
            file.fullPath = path + file.name; // Chemin reconstruit manuellement pour le drag&drop
            files.push(file);
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const entries = await new Promise(resolve => dirReader.readEntries(resolve));
            for (const child of entries) {
                await traverseFileTree(child, path + entry.name + "/");
            }
        }
    }

    const scanItem = document.createElement('div');
    scanItem.classList.add('file-item');
    scanItem.innerHTML = `<span>🔎 Analyse...</span><div class="loader"></div>`;
    fileList.prepend(scanItem);

    await Promise.all(entries.map(entry => traverseFileTree(entry)));
    
    scanItem.remove();
    processFiles(files);
}

// --- LOGIQUE DE DÉCISION ---
function processFiles(files) {
    if (files.length === 0) return;

    // 1. CALCUL DE LA TAILLE TOTALE (NOUVEAU)
    // On additionne la taille de chaque fichier trouvé
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    const MAX_SIZE = 100 * 1024 * 1024; // 100 Mo en octets

    // 2. VÉRIFICATION GLOBALE
    if (totalSize > MAX_SIZE) {
        // On convertit en Mo pour afficher un message clair (ex: "150.50 Mo")
        const sizeInMo = (totalSize / (1024 * 1024)).toFixed(2);
        alert(`⚠️ Trop lourd ! Le total fait ${sizeInMo} Mo (La limite est de 100 Mo).`);
        return; // ON ARRÊTE TOUT ICI
    }

    // --- Si la taille est OK, on continue comme avant ---

    // CAS 1 : Plusieurs fichiers -> ZIP GLOBAL
    if (files.length > 1) {
        createMultiZipAndUpload(files);
        return;
    }

    // CAS 2 : Un seul fichier
    const file = files[0];
    
    // (L'ancienne vérification de taille ici n'est plus nécessaire car faite au dessus, 
    // mais on peut la laisser ou l'enlever, ça ne gêne pas).

    const hasNoExtension = !file.name.includes('.');
    const riskyExtensions = ['.py', '.md', '.js', '.html', '.php', '.sh', '.bat', '.css', '.json', '.ts'];
    let fileExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : "";
    
    // Si fichier sensible ou sans extension -> ZIP individuel
    if (hasNoExtension || riskyExtensions.includes(fileExt)) {
        createSingleZipAndUpload(file);
    } else {
        // Sinon -> Envoi direct
        displayAndUpload(file, file.name, false);
    }
}

// --- FONCTIONS ZIP & UPLOAD ---

async function createMultiZipAndUpload(filesArray) {
    const item = document.createElement('div');
    item.classList.add('file-item');
    item.innerHTML = `<span>📦 Compression de <strong>${filesArray.length} fichiers</strong>... </span><div class="loader"></div>`;
    fileList.prepend(item);

    try {
        const zipData = {};

        const filePromises = filesArray.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // C'EST ICI QUE ÇA SE JOUE :
                    // 1. Soit c'est du Drag&Drop -> on a créé 'file.fullPath'
                    // 2. Soit c'est l'input Dossier -> le navigateur donne 'file.webkitRelativePath'
                    // 3. Soit c'est l'input Fichier -> juste 'file.name'
                    const fileName = file.fullPath || file.webkitRelativePath || file.name;
                    resolve({ name: fileName, content: new Uint8Array(e.target.result) });
                };
                reader.onerror = () => reject(file.name);
                reader.readAsArrayBuffer(file);
            });
        });

        const results = await Promise.all(filePromises);

        results.forEach(res => {
            zipData[res.name] = res.content;
        });

        fflate.zip(zipData, { level: 1 }, (err, data) => {
            if (err) throw err;

            // Nommage intelligent de l'archive
            let rootName = "Archive";
            
            // On essaie de trouver le nom du dossier racine
            if(filesArray[0].webkitRelativePath) {
                 rootName = filesArray[0].webkitRelativePath.split('/')[0];
            } else if (filesArray[0].fullPath) {
                 rootName = filesArray[0].fullPath.split('/')[0];
            }
            
            const zipName = `${rootName}.zip`;
            const zipFile = new File([data], zipName, { type: "application/zip" });
            
            item.remove();
            displayAndUpload(zipFile, zipName, true);
        });

    } catch (error) {
        console.error(error);
        item.innerHTML = `<span style="color: #ff6b6b;">❌ Erreur lecture fichiers.</span>`;
    }
}

function createSingleZipAndUpload(file) {
    const item = document.createElement('div');
    item.classList.add('file-item');
    item.innerHTML = `<span>📦 Compression... </span><div class="loader"></div>`;
    fileList.prepend(item);

    const reader = new FileReader();
    reader.onload = function(e) {
        const fileContent = new Uint8Array(e.target.result);
        const zipData = {};
        zipData[file.name] = fileContent;

        fflate.zip(zipData, { level: 1 }, (err, data) => {
            if (err) { item.innerHTML = `<span style="color: #ff6b6b;">❌ Erreur ZIP</span>`; return; }
            const zipName = file.name + ".zip";
            const zipFile = new File([data], zipName, { type: "application/zip" });
            item.remove();
            displayAndUpload(zipFile, file.name, true);
        });
    };
    reader.readAsArrayBuffer(file);
}

function displayAndUpload(fileToSend, originalName, wasZippedByUs) {
    const item = document.createElement('div');
    item.classList.add('file-item');
    item.innerHTML = `<span>🚀 Envoi de <strong>${fileToSend.name}</strong>... </span><div class="loader"></div>`;
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
        if (!res.ok) throw new Error("Erreur: " + res.status);
        return res.json();
    })
    .then(data => {
        if (data.status === 'success') {
            let longUrl = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(longUrl)}`;

            let finalLabel = wasZippedByUs ? originalName + (originalName.endsWith('.zip') ? "" : " (.zip)") : originalName;

            item.innerHTML = `
                <div style="margin-bottom:5px;">✅ <strong>${finalLabel}</strong> est prêt !</div>
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