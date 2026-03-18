// Inicializar SDK do Zoho
let zohoEntity = null;

ZOHO.embeddedApp.on("PageLoad", function(data) {
    console.log("Widget carregado no Zoho CRM", data);
    zohoEntity = data.Entity;
    verificarNIF(data);
});
ZOHO.embeddedApp.init();

document.addEventListener('DOMContentLoaded', function () {
    // Elementos DOM
    const fileInput      = document.getElementById('fileInput');
    const cameraInput    = document.getElementById('cameraInput');
    const uploadArea     = document.getElementById('uploadArea');
    const fileList       = document.getElementById('fileList');
    const btnProcess     = document.getElementById('btnProcess');
    const statusMessage  = document.getElementById('statusMessage');
    const uploadHint     = document.getElementById('uploadHint');
    const btnModoCarregar = document.getElementById('btnModoCarregar');
    const btnModoCamera  = document.getElementById('btnModoCamera');
    const tipoDocumento  = document.getElementById('tipoDocumento');

    // Estado
    let selectedFiles = [];
    let modoAtual = 'carregar';
    let cameraStream = null;

    const CONFIG = {
        MAX_FILES: 2,
        TAM_MAX: 25 * 1024 * 1024,
        FORMATOS_PERMITIDOS: ['.jpg', '.jpeg', '.png', 'image/jpeg', 'image/png']
    };

    const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // ===== MENSAGENS =====
    function showMessage(msg, tipo = 'info') {
        if (!statusMessage) return;
        const alertClass = {
            'info': 'alert alert-info',
            'success': 'alert alert-success',
            'error': 'alert alert-danger',
            'warning': 'alert alert-warning'
        }[tipo] || 'alert alert-info';

        statusMessage.innerHTML = `
            <div class="${alertClass} fade show py-2 px-3" role="alert" style="display:flex;align-items:center;justify-content:space-between;">
                <span>${msg}</span>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar" style="position:static;padding:0;margin-left:10px;"></button>
            </div>`;

        setTimeout(() => { statusMessage.innerHTML = ''; }, 5000);
    }

    // ===== MODOS (só PC) =====
    btnModoCarregar.addEventListener('click', function () {
        modoAtual = 'carregar';
        btnModoCarregar.classList.add('active');
        btnModoCamera.classList.remove('active');
        uploadHint.textContent = 'Clique para selecionar ficheiros';
        fecharCamera();
    });

    btnModoCamera.addEventListener('click', function () {
        modoAtual = 'camera';
        btnModoCamera.classList.add('active');
        btnModoCarregar.classList.remove('active');
        uploadHint.textContent = 'Clique para tirar foto';
        abrirCameraPC();
    });

    // ===== CÂMARA =====
    function fecharCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        const modal = document.getElementById('cameraModal');
        if (modal) document.body.removeChild(modal);
    }

    async function abrirCameraPC() {
        fecharCamera();
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser não suporta câmara');

            showMessage('A pedir permissão para aceder à câmara...', 'info');

            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
            });

            const modal = document.createElement('div');
            modal.className = 'camera-modal';
            modal.id = 'cameraModal';

            const video = document.createElement('video');
            video.srcObject = cameraStream;
            video.autoplay = true;
            video.playsInline = true;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '70vh';

            const canvas = document.createElement('canvas');
            canvas.style.display = 'none';

            const controls = document.createElement('div');
            controls.className = 'camera-controls';

            const captureBtn = document.createElement('button');
            captureBtn.className = 'btn btn-primary';
            captureBtn.textContent = '📸 Tirar Foto';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn btn-secondary';
            closeBtn.textContent = '✕ Cancelar';

            controls.appendChild(captureBtn);
            controls.appendChild(closeBtn);
            modal.appendChild(video);
            modal.appendChild(canvas);
            modal.appendChild(controls);
            document.body.appendChild(modal);

            captureBtn.onclick = () => {
                const track = cameraStream.getVideoTracks()[0];
                const settings = track.getSettings();
                canvas.width = settings.width || video.videoWidth || 1280;
                canvas.height = settings.height || video.videoHeight || 720;
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    if (blob) {
                        processFiles([new File([blob], `foto_${Date.now()}.png`, { type: 'image/png' })]);
                        fecharCamera();
                        document.body.removeChild(modal);
                        showMessage('Foto capturada com sucesso!', 'success');
                    }
                }, 'image/png', 0.95);
            };

            closeBtn.onclick = () => {
                fecharCamera();
                document.body.removeChild(modal);
            };

        } catch (error) {
            showMessage('Erro ao aceder à câmara: ' + error.message, 'error');
            fecharCamera();
        }
    }

    // ===== UPLOAD =====
    uploadArea.addEventListener('click', function () {
        if (isMobile) {
            fileInput.click();
        } else if (modoAtual === 'carregar') {
            fileInput.click();
        } else {
            abrirCameraPC();
        }
    });

    fileInput.addEventListener('change', function (event) {
        if (event.target.files.length > 0) processFiles(event.target.files);
        fileInput.value = '';
    });

    cameraInput.addEventListener('change', function (event) {
        if (event.target.files.length > 0) {
            processFiles(event.target.files);
            showMessage('Foto tirada com sucesso!', 'success');
        }
        cameraInput.value = '';
    });

    // ===== DRAG & DROP =====
    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (modoAtual === 'carregar') {
            uploadArea.style.borderColor = '#0d6efd';
            uploadArea.style.backgroundColor = '#e7f1ff';
        }
    });

    uploadArea.addEventListener('dragleave', function () {
        uploadArea.style.borderColor = '#dee2e6';
        uploadArea.style.backgroundColor = '#f8f9fa';
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#dee2e6';
        uploadArea.style.backgroundColor = '#f8f9fa';
        if (modoAtual === 'carregar' && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        } else if (modoAtual !== 'carregar') {
            showMessage('Arrastar ficheiros só funciona no modo "Carregar Ficheiros"', 'warning');
        }
    });

    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

    // ===== VALIDAÇÃO =====
    function validarFicheiro(file) {
        const formatoValido = CONFIG.FORMATOS_PERMITIDOS.some(f =>
            file.type === f || file.name.toLowerCase().endsWith(f)
        );
        if (!formatoValido) return 'Formato inválido. Use apenas JPG ou PNG';
        if (file.size > CONFIG.TAM_MAX) {
            return `Ficheiro muito grande: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Máximo: 25MB`;
        }
        return null;
    }

    function processFiles(files) {
        const filesArray = files instanceof FileList ? Array.from(files) : files;
        filesArray.forEach(file => {
            const erro = validarFicheiro(file);
            if (erro) { showMessage(erro, 'error'); return; }
            if (selectedFiles.length >= CONFIG.MAX_FILES) {
                showMessage(`Máximo de ${CONFIG.MAX_FILES} ficheiros (frente e verso)`, 'warning');
                return;
            }
            if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
                showMessage(`"${file.name}" já foi adicionado`, 'warning');
                return;
            }
            selectedFiles.push(file);
        });
        updateFileList();
        updateProcessButton();
    }

    function updateFileList() {
        if (selectedFiles.length === 0) { fileList.innerHTML = ''; return; }
        let html = '<div class="list-group">';
        selectedFiles.forEach((file, index) => {
            const tamanhoKB = (file.size / 1024).toFixed(1);
            const isFoto = file.name.startsWith('foto_');
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="me-2">${isFoto ? '📸' : '📄'}</span>
                        ${file.name.length > 30 ? file.name.substring(0, 27) + '...' : file.name}
                        <small class="text-muted ms-2">${tamanhoKB} KB</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removerFicheiro(${index})">✕</button>
                </div>`;
        });
        html += `</div>
            <div class="d-flex justify-content-between align-items-center mt-2">
                <span class="text-muted small">${selectedFiles.length} de ${CONFIG.MAX_FILES}</span>
                <span class="badge ${selectedFiles.length === CONFIG.MAX_FILES ? 'bg-success' : 'bg-warning'}">
                    ${selectedFiles.length === CONFIG.MAX_FILES ? 'Completo' : 'Faltam ' + (CONFIG.MAX_FILES - selectedFiles.length)}
                </span>
            </div>`;
        fileList.innerHTML = html;
    }

    window.removerFicheiro = function(index) {
        selectedFiles.splice(index, 1);
        updateFileList();
        updateProcessButton();
    };

    function updateProcessButton() {
        btnProcess.disabled = selectedFiles.length !== CONFIG.MAX_FILES;
    }

    // ===== LER DADOS =====
    btnProcess.addEventListener('click', async function () {
        if (selectedFiles.length !== CONFIG.MAX_FILES) {
            showMessage(`Selecione exatamente ${CONFIG.MAX_FILES} ficheiros (frente e verso)`, 'error');
            return;
        }

        const originalText = btnProcess.innerHTML;
        btnProcess.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>A processar...';
        btnProcess.disabled = true;

        try {
            const formData = new FormData();
            formData.append('tipoDocumento', tipoDocumento?.value || 'cc');
            selectedFiles.forEach((file, index) => formData.append(`documento_${index + 1}`, file));

            // TODO: substituir pela chamada real ao endpoint e usar response em vez de dadosOCR
            await new Promise(resolve => setTimeout(resolve, 2000));

            const dadosOCR = {
                nome: "Maria Silva",
                nif: "248759248",
                numeroDocumento: "123456789",
                dataValidade: "15/03/2029",
                confianca: { nome: 95, numeroDocumento: 88, dataValidade: 92, nif: 87 },
                entity: zohoEntity
            };

            selectedFiles = [];
            updateFileList();
            mostrarDados(dadosOCR);

        } catch (error) {
            showMessage('Erro: ' + error.message, 'error');
        } finally {
            btnProcess.innerHTML = originalText;
            updateProcessButton();
        }
    });

    // ===== LIMPEZA =====
    window.addEventListener('beforeunload', function() {
        if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    });

    // ===== INICIALIZAÇÃO =====
    updateProcessButton();
    if (isMobile) document.getElementById('modosBotoes').style.display = 'none';
    console.log('✅ Widget inicializado');
});
