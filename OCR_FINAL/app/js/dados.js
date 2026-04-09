// ===== LÓGICA DA SEGUNDA PÁGINA (dados lidos) =====

const CAMPOS = [
    { key: 'nome', label: 'Nome Completo', readonly: false, largura: true },
    { key: 'numeroDocumento', label: 'Número do Documento', readonly: false },
    { key: 'dataValidade', label: 'Data de Validade', readonly: false },
    { key: 'dataNascimento', label: 'Data de Nascimento', readonly: false },
    { key: 'nif', label: 'NIF', readonly: true },
];

function badgeConfianca(valor) {
    const cls = valor >= 90 ? 'badge-alta' : valor >= 75 ? 'badge-media' : 'badge-baixa';
    return `<span class="badge-confianca ${cls}">${valor}%</span>`;
}

let _dadosOCRExtras = {};

function mostrarDados(dados) {
    _dadosOCRExtras = {
        genero: dados.genero || null,
        nacionalidade: dados.nacionalidade || null,
    };
    const viewUpload = document.getElementById('view-upload');
    const viewDados = document.getElementById('view-dados');
    const camposDados = document.getElementById('camposDados');
    const checkConfirmar = document.getElementById('checkConfirmar');
    const btnInserir = document.getElementById('btnInserir');

    let html = '';
    CAMPOS.forEach(campo => {
        const valor = dados[campo.key] || '';
        const conf = dados.confianca?.[campo.key];
        const readonlyAttr = campo.readonly ? 'readonly' : '';
        const bgReadonly = campo.readonly ? 'style="background:#f8f9fa;"' : '';
        if (campo.largura) {
            html += `
            <div class="campo-dado">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="campo-label">${campo.label}</span>
                    <span class="campo-valor-original">${valor}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center gap-2">
                    <span class="campo-label-novo" style="white-space:nowrap;">
                        ${campo.label} (novo) ${conf !== undefined ? badgeConfianca(conf) : ''}
                    </span>
                    <input type="text" class="form-control form-control-sm campo-input"
                           id="campo_${campo.key}" value="${valor}"
                           style="width:50%;" ${readonlyAttr} ${bgReadonly}>
                </div>
            </div>`;
        } else {
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
        }
    });

    camposDados.innerHTML = html;


    checkConfirmar.checked = false;
    checkConfirmar.disabled = true;
    btnInserir.disabled = true;
    document.getElementById('avisoNIF').style.display = 'none';
    document.getElementById('headerSubtitle').textContent = 'Analise os dados obtidos pelo sistema';
    viewUpload.style.display = 'none';
    viewDados.style.display = 'block';

    // Verificar se o NIF tem 9 dígitos
    const nifDigitos = dados.nif ? dados.nif.replace(/\D/g, '') : '';
    if (nifDigitos.length !== 9) {
        document.getElementById('avisoNIF').style.display = 'block';
        document.getElementById('avisoNIF').textContent = `⚠️ O NIF obtido (${dados.nif || 'vazio'}) não contém
         9 dígitos. Por favor, reenicie o processo.`;
    }
    // Verificar se o NIF já existe no Zoho CRM e/ou no DMS (em paralelo)
    else {
        Promise.all([
            pesquisarNIFExistente(dados.entity, dados.nif),
            procurar_nif_dms(dados.nif).catch(() => false)
        ]).then(function ([existeZoho, existeDMS]) {
            const avisoNIF = document.getElementById('avisoNIF');
            if (existeZoho && existeDMS) {
                avisoNIF.textContent = `⚠️ O NIF ${dados.nif} já está registado no Zoho CRM para a entidade "${existeZoho}" e também no DMS.`;
            } else if (existeZoho && !existeDMS) {
                avisoNIF.textContent = `⚠️ O NIF ${dados.nif} já está registado no Zoho CRM para a entidade "${existeZoho}".`;
            } else if (existeDMS && !existeZoho) {
                avisoNIF.textContent = `⚠️ O NIF ${dados.nif} já existe associado a uma entidade no DMS.`;
            }

            if (existeZoho || existeDMS) {
                avisoNIF.style.display = 'block';
            } else {
                checkConfirmar.disabled = false;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const checkConfirmar = document.getElementById('checkConfirmar');
    const btnInserir = document.getElementById('btnInserir');
    const btnVoltar = document.getElementById('btnVoltar');

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

        // Validar data de validade com o valor final (editado pelo user)
        const valorData = dadosFinais.dataValidade;
        if (valorData) {
            const dataValidade = new Date(valorData);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            if (!isNaN(dataValidade) && dataValidade < hoje) {
                alert(`⚠️ O Cartão de Cidadão está expirado (validade: ${valorData}). Não é possível inserir os dados.`);
                return;
            }
        }

        btnInserir.disabled = true;
        btnInserir.textContent = 'A inserir...';

        const dadosParaDMS = { ...dadosFinais, ..._dadosOCRExtras };

        try {
            await inserir_entidade_dms(construirPayloadDMS(dadosParaDMS));
        } catch (error) {
            alert('Erro ao criar entidade no DMS. Por favor tente novamente.');
            btnInserir.disabled = false;
            btnInserir.textContent = 'Inserir Dados';
            return;
        }

        try {
            await atualizarEntidadeZoho(dadosFinais);
        } catch (error) {
            alert('Erro ao atualizar registo no Zoho CRM. Por favor tente novamente.');
            btnInserir.disabled = false;
            btnInserir.textContent = 'Inserir Dados';
            return;
        }

        alert('Dados inseridos com sucesso!');
        ZOHO.CRM.UI.Popup.closeReload();
    });
});
