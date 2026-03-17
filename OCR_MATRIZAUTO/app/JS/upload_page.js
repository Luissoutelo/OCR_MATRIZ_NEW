document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const fileList = document.getElementById('fileList');
    const btnProcess = document.getElementById('btnProcess');
    const statusMessage = document.getElementById('statusMessage');

    let selectedFiles = [];

    const CONFIG = {
        MAX_FILES: 2,
        MIN_FILES: 2,
        TAM_MAX: 25 * 1024 * 1024, // 25 MB
        FORMATOS_PERMITIDOS: ['.jpg', '.jpeg', '.png', 'image/jpeg', 'image/png']
    };

    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#0d6efd';
        uploadArea.style.backgroundColor = '#e7f1ff';
    });

    uploadArea.addEventListener('dragleave', function () {
        resetUploadAreaStyle();
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        resetUploadAreaStyle();
        processFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', function (event) {
        processFiles(event.target.files);
        fileInput.value = '';
    });

    function resetUploadAreaStyle() {
        uploadArea.style.borderColor = '';
        uploadArea.style.backgroundColor = '';
    }

    function processFiles(files) {
        const newFiles = Array.from(files);

        newFiles.forEach(file => {
            const erro = validFile(file);

            if (erro) {
                showError(`${file.name}: ${erro}`);
                return;
            }

            if (selectedFiles.length >= CONFIG.MAX_FILES) {
                showError(`Máximo de ${CONFIG.MAX_FILES} ficheiros(Frente e Verso)`);
                return;
            }

            const jaExiste = selectedFiles.some(
                f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
            );

            if (jaExiste) {
                showError(`${file.name}: ficheiro já selecionado`);
                return;
            }

            selectedFiles.push(file);
        });

        updateFileList();
        verifyBTN();
    }

    function validFile(file) {
        const formatValid = CONFIG.FORMATOS_PERMITIDOS.some(formato =>
            file.type === formato || file.name.toLowerCase().endsWith(formato)
        );

        if (!formatValid) {
            return 'Formato inválido. Use apenas JPG ou PNG';
        }

        if (file.size > CONFIG.TAM_MAX) {
            return `Ficheiro muito grande. Máximo ${CONFIG.TAM_MAX / (1024 * 1024)}MB`;
        }

        return null;
    }

    function updateFileList() {
        if (selectedFiles.length === 0) {
            fileList.innerHTML = '';
            return;
        }

        let html = '<h6 class="mt-3">Ficheiros selecionados:</h6><ul class="list-group">';

        selectedFiles.forEach((ficheiro, index) => {
            const tamanhoKB = (ficheiro.size / 1024).toFixed(2);

            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${index + 1}. ${ficheiro.name} (${tamanhoKB} KB)</span>
                    <button type="button" class="btn btn-sm btn-danger" data-index="${index}">
                        Remover
                    </button>
                </li>
            `;
        });

        html += `</ul>
            <div class="text-muted small mt-2">
                ${selectedFiles.length} de ${CONFIG.MAX_FILES}
            </div>`;

        fileList.innerHTML = html;

        fileList.querySelectorAll('button[data-index]').forEach(button => {
            button.addEventListener('click', function () {
                const index = Number(this.dataset.index);
                selectedFiles.splice(index, 1);
                updateFileList();
                verifyBTN();
            });
        });
    }

    function verifyBTN() {
        const temFicheirosCorretos =
            selectedFiles.length >= CONFIG.MIN_FILES &&
            selectedFiles.length <= CONFIG.MAX_FILES;

        btnProcess.disabled = !temFicheirosCorretos;
    }

    function showError(mensagem) {
        showStatus(mensagem, 'danger');
    }

    function showStatus(mensagem, tipo = 'info') {
        if (!statusMessage) return;

        statusMessage.innerHTML = `<div class="alert alert-${tipo}" role="alert">${mensagem}</div>`;

        setTimeout(() => {
            statusMessage.innerHTML = '';
        }, 3000);
    }

    verifyBTN();
});