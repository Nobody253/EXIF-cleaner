if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultsContainer = document.getElementById('results-container');
const batchActions = document.getElementById('batch-actions');
const downloadZipBtn = document.getElementById('download-zip-btn');
let processedFilesList = [];

dropZone.onclick = () => fileInput.click();
dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.toggle('drag-over', true);
};
dropZone.ondragleave = () => dropZone.classList.toggle('drag-over', false);
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
};
fileInput.onchange = (e) => handleFiles(e.target.files);

async function handleFiles(files) {
    resultsContainer.innerHTML = ''; 
    processedFilesList = [];
    updateBatchActions();
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            createErrorItem(file.name, 'Неверный формат файла. Выберите изображение.');
            continue;
        }
        await processImage(file);
    }
}

async function processImage(file) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `<div class="card-info">Обработка ${file.name}...</div>`;
    resultsContainer.appendChild(card);

    let exifText = 'Основные EXIF данные не найдены.';
    try {
        const tags = await ExifReader.load(file);
        const info = [];
        if (tags['Make']) info.push(`Производитель: ${tags['Make'].description}`);
        if (tags['Model']) info.push(`Модель: ${tags['Model'].description}`);
        if (tags['DateTimeOriginal']) info.push(`Дата съемки: ${tags['DateTimeOriginal'].description}`);
        if (tags['GPSLatitude'] && tags['GPSLongitude']) info.push(`GPS: ${tags['GPSLatitude'].description}, ${tags['GPSLongitude'].description}`);
        if (info.length > 0) exifText = info.join('<br>');
    } catch (e) {
        console.warn('Ошибка чтения EXIF', e);
    }

try {
        const cleanedBlob = await cleanImageMetadata(file);
        const previewUrl = URL.createObjectURL(cleanedBlob);
        const cleanedFileName = file.name.replace(/(\.[^.]+)$/, '_cleaned$1');
        processedFilesList.push({ name: cleanedFileName, blob: cleanedBlob });
        updateBatchActions();
        
        card.innerHTML = `
            <img src="${previewUrl}" class="preview-img" alt="Превью ${file.name}">
            <div class="card-info">
                <h3>${file.name}</h3>
                <div class="exif-data">${exifText}</div>
                <button id="btn-${file.name.replace(/\s+/g, '')}">Скачать без метаданных</button>
            </div>
        `;
        
        card.querySelector('button').onclick = () => {
            const a = document.createElement('a');
            a.href = previewUrl;
            a.download = cleanedFileName;
            a.click();
        };
    } catch (error) {
        card.remove();
        createErrorItem(file.name, error.message);
    }
}

async function cleanImageMetadata(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Ошибка при создании очищенного файла.'));
            }, file.type, 1.0);
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Файл поврежден или не может быть прочитан как изображение.'));
        };
        
        img.src = url;
    });
}

function createErrorItem(name, msg) {
    const div = document.createElement('div');
    div.className = 'image-card error';
    div.innerHTML = `<div class="card-info"><strong>${name}</strong>: ${msg}</div>`;
    resultsContainer.appendChild(div);
}

function updateBatchActions() {
    if (processedFilesList.length > 1) {
        batchActions.classList.remove('hidden');
    } else {
        batchActions.classList.add('hidden');
    }
}

downloadZipBtn.onclick = async () => {
    const zip = new JSZip();
    downloadZipBtn.textContent = 'Архив формируется... Пожалуйста, подождите.';
    downloadZipBtn.disabled = true;
    processedFilesList.forEach(item => {
        zip.file(item.name, item.blob);
    });

    try {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = 'cleaned_images.zip';
        a.click();
        URL.revokeObjectURL(a.href);
    } catch (error) {
        alert('Ошибка при создании архива.');
        console.error(error);
    } finally {
        downloadZipBtn.textContent = 'Скачать все архивом (ZIP)';
        downloadZipBtn.disabled = false;
    }
};