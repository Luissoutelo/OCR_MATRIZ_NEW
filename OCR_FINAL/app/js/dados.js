// ===== LÓGICA DA SEGUNDA PÁGINA (dados lidos) =====

const CAMPOS = [
    { key: 'nome',            label: 'Nome Completo',       readonly: false },
    { key: 'numeroDocumento', label: 'Número do Documento', readonly: false },
    { key: 'dataValidade',    label: 'Data de Validade',    readonly: false },
    { key: 'nif',             label: 'NIF',                 readonly: true  },
];

function badgeConfianca(valor) {
    const cls = valor >= 90 ? 'badge-alta' : valor >= 75 ? 'badge-media' : 'badge-baixa';
    return `<span class="badge-confianca ${cls}">${valor}%</span>`;
}

function mostrarDados(dados) {
    const viewUpload     = document.getElementById('view-upload');
    const viewDados      = document.getElementById('view-dados');
    const camposDados    = document.getElementById('camposDados');
    const checkConfirmar = document.getElementById('checkConfirmar');
    const btnInserir     = document.getElementById('btnInserir');

    let html = '';
    CAMPOS.forEach(campo => {
        const valor = dados[campo.key] || '';
        const conf  = dados.confianca?.[campo.key];
        const readonlyAttr = campo.readonly ? 'readonly' : '';
        const bgReadonly   = campo.readonly ? 'style="background:#f8f9fa;"' : '';
        html += `
            <div class="campo-dado">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="campo-label">${campo.label}</span>
                    <span class="campo-valor-original">${valor}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center gap-2">
                    <span class="campo-label-novo">
                        ${campo.label} (novo) ${conf !== undefined ? badgeConfianca(conf) : ''}
                    </span>
                    <input type="text" class="form-control form-control-sm campo-input"
                           id="campo_${campo.key}" value="${valor}"
                           ${readonlyAttr} ${bgReadonly}>
                </div>
            </div>`;
    });

    camposDados.innerHTML = html;
    checkConfirmar.checked = false;
    checkConfirmar.disabled = false;
    btnInserir.disabled = true;
    document.getElementById('avisoNIF').style.display = 'none';
    document.getElementById('headerSubtitle').textContent = 'Analise os dados obtidos pelo sistema';
    viewUpload.style.display = 'none';
    viewDados.style.display = 'block';

    // Verificar se o NIF já existe no Zoho CRM
    if (dados.nif && dados.entity) {
        pesquisarNIFExistente(dados.entity, dados.nif).then(function(existe) {
            if (existe) {
                checkConfirmar.disabled = true;
                btnInserir.disabled = true;
                document.getElementById('avisoNIF').style.display = 'block';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const checkConfirmar = document.getElementById('checkConfirmar');
    const btnInserir     = document.getElementById('btnInserir');
    const btnVoltar      = document.getElementById('btnVoltar');

    checkConfirmar.addEventListener('change', function () {
        // Só ativa o botão se o checkbox estiver marcado E não houver aviso de NIF duplicado
        const avisoVisivel = document.getElementById('avisoNIF').style.display !== 'none';
        btnInserir.disabled = !this.checked || avisoVisivel;
    });

    btnVoltar.addEventListener('click', function () {
        document.getElementById('headerSubtitle').textContent = 'Preencha os campos abaixo para processar o seu documento';
        document.getElementById('view-dados').style.display = 'none';
        document.getElementById('view-upload').style.display = 'block';
    });

    btnInserir.addEventListener('click', async function () {
        const dadosFinais = {};
        CAMPOS.forEach(campo => {
            dadosFinais[campo.key] = document.getElementById(`campo_${campo.key}`).value;
        });
        // TODO: enviar dadosFinais para o Zoho CRM quando o endpoint estiver pronto
        console.log('📤 Dados a inserir no Zoho:', dadosFinais);
    });
});
