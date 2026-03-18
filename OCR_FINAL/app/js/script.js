// upload_page.js
// Inicializar SDK do Zoho
ZOHO.embeddedApp.on("PageLoad", function(data) {
    console.log("Widget carregado no Zoho CRM", data);

    // Verificar se o campo NIF está preenchido
    ZOHO.CRM.API.getRecord({
        Entity: data.Entity,
        RecordID: data.EntityId
    }).then(function(response) {
        const record = response.data[0];
        const nif = record.NIF;

        if (nif && nif.trim() !== "") {
            
            alert("O campo NIF está preenchido. Apenas em entidades sem NIF preenchido é possível usar este widget.");
            ZOHO.CRM.UI.Popup.closeReload();
        }
    }).catch(function(error) {
        console.error("Erro ao obter dados do registo:", error);
    });
});
ZOHO.embeddedApp.init();

document.addEventListener('DOMContentLoaded', function () {
    // Elementos DOM
    const fileInput = document.getElementById('fileInput');
    const cameraInput = document.getElementById('cameraInput');
    const uploadArea = document.getElementById('uploadArea');
    const fileList = document.getElementById('fileList');
    const btnProcess = document.getElementById('btnProcess');
    const statusMessage = document.getElementById('statusMessage');
    const uploadHint = document.getElementById('uploadHint');
    const btnModoCarregar = document.getElementById('btnModoCarregar');
    const btnModoCamera = document.getElementById('btnModoCamera');
    const tipoDocumento = document.getElementById('tipoDocumento');

    // Estado da aplicação
    let selectedFiles = [];
    let modoAtual = 'carregar';
    let cameraStream = null;

    // Configurações
    const CONFIG = {
        MAX_FILES: 2,
        MIN_FILES: 2,
        TAM_MAX: 25 * 1024 * 1024, // 25 MB
        FORMATOS_PERMITIDOS: ['.jpg', '.jpeg', '.png', 'image/jpeg', 'image/png']
    };

    // URL do endpoint
    const ENDPOINT_URL = 'https://eoxx8kxixtk90if.m.pipedream.net';

    // Detetar se é dispositivo móvel
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // ===== MOSTRAR MENSAGENS =====
    function showMessage(msg, tipo = 'info') {
        if (!statusMessage) return;
        
        const alertClass = {
            'info': 'alert alert-info',
            'success': 'alert alert-success',
            'error': 'alert alert-danger',
            'warning': 'alert alert-warning'
        }[tipo] || 'alert alert-info';
        
        statusMessage.innerHTML = `
            <div class="${alertClass} fade show py-2 px-3" role="alert" style="display: flex; align-items: center; justify-content: space-between;">
                <span>${msg}</span>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar" style="position: static; padding: 0; margin-left: 10px;"></button>
            </div>
        `;
        
        setTimeout(() => {
            statusMessage.innerHTML = '';
        }, 5000);
    }

    // ===== ALTERNAR ENTRE MODOS (só PC) =====
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

    // ===== FECHAR CÂMARA =====
    function fecharCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        
        const modal = document.getElementById('cameraModal');
        if (modal) {
            document.body.removeChild(modal);
        }
    }

    // ===== ABRIR CÂMARA NO PC =====
    async function abrirCameraPC() {
        // Fechar câmara anterior se existir
        fecharCamera();

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Browser não suporta câmara');
            }

            showMessage('A pedir permissão para aceder à câmara...', 'info');

            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment' // Tenta usar câmara traseira
                }
            });

            // Criar modal
            const modal = document.createElement('div');
            modal.className = 'camera-modal';
            modal.id = 'cameraModal';

            // Vídeo
            const video = document.createElement('video');
            video.srcObject = cameraStream;
            video.autoplay = true;
            video.playsInline = true;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '70vh';

            // Canvas para captura
            const canvas = document.createElement('canvas');
            canvas.style.display = 'none';

            // Controlos
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

            // Evento de capturar
            captureBtn.onclick = () => {
                const track = cameraStream.getVideoTracks()[0];
                const settings = track.getSettings();
                
                canvas.width = settings.width || video.videoWidth || 1280;
                canvas.height = settings.height || video.videoHeight || 720;
                
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(blob => {
                    if (blob) {
                        const file = new File([blob], `foto_${Date.now()}.png`, { 
                            type: 'image/png' 
                        });
                        
                        // Processar o ficheiro
                        processFiles([file]);
                        
                        // Fechar modal
                        fecharCamera();
                        document.body.removeChild(modal);
                        
                        showMessage('Foto capturada com sucesso!', 'success');
                    }
                }, 'image/png', 0.95);
            };

            // Evento de fechar
            closeBtn.onclick = () => {
                fecharCamera();
                document.body.removeChild(modal);
            };

        } catch (error) {
            showMessage('Erro ao aceder à câmara: ' + error.message, 'error');
            fecharCamera();
        }
    }

    // ===== CLIQUE NA ÁREA DE UPLOAD =====
    uploadArea.addEventListener('click', function () {
        if (isMobile) {
            fileInput.click(); // picker nativo: câmara / galeria / ficheiros
        } else if (modoAtual === 'carregar') {
            fileInput.click();
        } else {
            abrirCameraPC();
        }
    });

    // ===== EVENTO DO FILE INPUT (carregar ficheiros) =====
    fileInput.addEventListener('change', function (event) {
        if (event.target.files.length > 0) {
            processFiles(event.target.files);
        }
        fileInput.value = ''; // Limpar para permitir selecionar o mesmo ficheiro
    });

    // ===== EVENTO DA CÂMARA (telemóvel) =====
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

    // ===== VALIDAR FICHEIRO =====
    function validarFicheiro(file) {
        // Validar formato
        const formatoValido = CONFIG.FORMATOS_PERMITIDOS.some(formato =>
            file.type === formato || file.name.toLowerCase().endsWith(formato)
        );

        if (!formatoValido) {
            return 'Formato inválido. Use apenas JPG ou PNG';
        }

        // Validar tamanho
        if (file.size > CONFIG.TAM_MAX) {
            const mb = (file.size / (1024 * 1024)).toFixed(2);
            return `Ficheiro muito grande: ${mb}MB. Máximo: 25MB`;
        }

        return null;
    }

    // ===== PROCESSAR FICHEIROS =====
    function processFiles(files) {
        // Converter FileList para Array se necessário
        const filesArray = files instanceof FileList ? Array.from(files) : files;
        
        let adicionados = 0;
        
        filesArray.forEach(file => {
            // Validar
            const erro = validarFicheiro(file);
            if (erro) {
                showMessage(erro, 'error');
                return;
            }
            
            // Verificar limite
            if (selectedFiles.length >= CONFIG.MAX_FILES) {
                showMessage(`Máximo de ${CONFIG.MAX_FILES} ficheiros (frente e verso)`, 'warning');
                return;
            }
            
            // Verificar duplicados
            const existe = selectedFiles.some(f => 
                f.name === file.name && f.size === file.size
            );
            
            if (existe) {
                showMessage(`"${file.name}" já foi adicionado`, 'warning');
                return;
            }
            
            // Adicionar à lista
            selectedFiles.push(file);
            adicionados++;
        });
        
        
        
        updateFileList();
        updateProcessButton();
    }

    // ===== ATUALIZAR LISTA DE FICHEIROS =====
    function updateFileList() {
        if (selectedFiles.length === 0) {
            fileList.innerHTML = '';
            return;
        }
        
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
                    <button class="btn btn-sm btn-outline-danger" onclick="removerFicheiro(${index})">
                        ✕
                    </button>
                </div>
            `;
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

    // ===== REMOVER FICHEIRO =====
    window.removerFicheiro = function(index) {
        selectedFiles.splice(index, 1);
        updateFileList();
        updateProcessButton();
    };

    // ===== ATUALIZAR BOTÃO PROCESSAR =====
    function updateProcessButton() {
        const podeProcessar = selectedFiles.length === CONFIG.MAX_FILES;
        btnProcess.disabled = !podeProcessar;
    }

    // ===== PROCESSAR UPLOAD =====
    btnProcess.addEventListener('click', async function () {
        if (selectedFiles.length !== CONFIG.MAX_FILES) {
            showMessage(`Selecione exatamente ${CONFIG.MAX_FILES} ficheiros (frente e verso)`, 'error');
            return;
        }

        // Guardar texto original
        const originalText = btnProcess.innerHTML;
        btnProcess.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>A processar...';
        btnProcess.disabled = true;

        

        try {
            // Preparar FormData
            const formData = new FormData();
            formData.append('tipoDocumento', tipoDocumento?.value || 'cc');
            
            selectedFiles.forEach((file, index) => {
                formData.append(`documento_${index + 1}`, file);
            });

            // Simular upload (para teste)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Para testes, vamos simular uma resposta
            const dadosSimulados = {
                nome: "Maria Silva",
                nif: "123456789",
                numeroDocumento: "CC-987654321",
                dataNascimento: "1985-06-15",
                dataValidade: "2030-06-14"
            };

            
            console.log('📋 Dados extraídos:', dadosSimulados);
            
            // Limpar ficheiros após sucesso
            selectedFiles = [];
            updateFileList();
            
        } catch (error) {
            showMessage('Erro: ' + error.message, 'error');
            console.error('❌ Erro:', error);
        } finally {
            btnProcess.innerHTML = originalText;
            updateProcessButton();
        }
    });

    // ===== PREVENIR COMPORTAMENTO PADRÃO DE DRAG & DROP =====
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

    // ===== LIMPEZA AO SAIR =====
    window.addEventListener('beforeunload', function() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
    });

    // ===== INICIALIZAÇÃO =====
    updateProcessButton();

    // No mobile esconder os botões de modo — o picker nativo já oferece câmara/galeria/ficheiros
    if (isMobile) {
        document.getElementById('modosBotoes').style.display = 'none';
    }

    console.log('✅ Widget inicializado');
});