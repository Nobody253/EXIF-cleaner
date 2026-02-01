if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultsContainer = document.getElementById('results-container');

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
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            createErrorItem(file.name, 'Неверный формат файла.');
            continue;
        }
        await processImage(file);
    }
}

async function processImage(file) {
    const card = document.createElement('div');
    card.className = 'image-card';
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
    } catch (e) {}

    const cleanedBlob = await cleanImageMetadata(file);
    card.innerHTML = `<h3>${file.name}</h3><div class="exif-data">${exifText}</div><button>Скачать без метаданных</button>`;
    card.querySelector('button').onclick = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(cleanedBlob);
        a.download = file.name.replace(/(\.[^.]+)$/, '_cleaned$1');
        a.click();
    };
}

async function cleanImageMetadata(file) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await new Promise(r => img.onload = r);
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return new Promise(r => canvas.toBlob(r, file.type, 1.0));
}

function createErrorItem(name, msg) {
    const div = document.createElement('div');
    div.className = 'image-card error';
    div.innerHTML = `<strong>${name}</strong>: ${msg}`;
    resultsContainer.appendChild(div);
}