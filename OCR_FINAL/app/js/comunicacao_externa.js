// ===== AMBIENTE: muda para 'prod' quando estiveres pronto =====
const AMBIENTE = 'qa'; // 'qa' ou 'prod'

// ===== LER CREDENCIAIS DAS ORG VARIABLES DO ZOHO CRM =====
const crmVars = async () => {
    return new Promise((resolve, reject) => {
        const prefixo = AMBIENTE === 'prod' ? 'API_PROD' : 'API_QA';

        Promise.all([
            ZOHO.CRM.API.getOrgVariable(`${prefixo}_DMS_URL`).then(d => d.Success.Content),
            ZOHO.CRM.API.getOrgVariable(`${prefixo}_DMS_USERNAME_INTERNO`).then(d => d.Success.Content),
            ZOHO.CRM.API.getOrgVariable(`${prefixo}_DMS_PASSWORD_INTERNO`).then(d => d.Success.Content),
            ZOHO.CRM.API.getOrgVariable(`${prefixo}_DMS_GRANT_TYPE`).then(d => d.Success.Content),
        ]).then(resolve).catch(reject);
    });
};

// ===== OBTER TOKEN DE AUTENTICAÇÃO DO DMS =====1
async function get_token_dms() {
    const [url, username, password, grant_type] = await crmVars();
    const connectionName = AMBIENTE === 'prod' ? 'api_prod_dms_widget' : 'api_qa_dms_recebimentos_widget';

    const result = await ZOHO.CRM.CONNECTION.invoke(connectionName, {
        url: url + "token",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        parameters: { grant_type, Username: username, Password: password },
        param_type: 1
    });

    const tokenData = result.details.statusMessage;
    return { token: tokenData.access_token, url };
}

/* ============================================================
 * VERSÃO ANTIGA — chamadas diretas ao OCR (bloqueadas por CORS)
 * Mantida comentada para referência / rollback rápido.
 * Substituída pelo middleware Catalyst em processar_fotos_cc.
 * ============================================================
 
// ===== LER CREDENCIAIS OCR DAS ORG VARIABLES DO ZOHO CRM =====
const crmVarsOCR = async () => {
    const urlVar = AMBIENTE === 'prod' ? 'url_api_grupo_jap' : 'url_api_grupo_jap_qa';

    const nomes = [urlVar, 'client_secret_api_grupo_jap', 'cliend_id_api_grupo_jap', 'password_api_grupo_jap', 'username_api_gupo_jap'];

    const respostas = await Promise.all(nomes.map(nome =>
        ZOHO.CRM.API.getOrgVariable(nome).then(d => {
            if (!d?.Success?.Content) throw new Error(`Variável não encontrada ou vazia: ${nome}`);
            return d.Success.Content;
        })
    ));

    const [url, clientSecret, clientId, password, username] = respostas;
    return { url, clientSecret, clientId, password, username };
};

// ===== OBTER TOKEN DE AUTENTICAÇÃO OCR =====
async function get_token_ocr() {
    const vars = await crmVarsOCR();
    const { url, clientSecret, clientId, password, username } = vars;

    if (AMBIENTE === 'prod') {
        const result = await ZOHO.CRM.CONNECTION.invoke('api_prod_ocr_widget', {
            url: url + "token",
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
            parameters: { grant_type: "password", client_id: clientId, client_secret: clientSecret, username, password },
            param_type: 1
        });
        const tokenData = result.details.statusMessage;
        if (!tokenData?.access_token) throw new Error('Não foi possível autenticar no serviço OCR.');
        return { token: tokenData.access_token, url, username };
    }

    let fetchUrl;
    try {
        fetchUrl = url;
        const parameters = new URLSearchParams();
        parameters.append("grant_type", "password");
        parameters.append("client_id", clientId);
        parameters.append("client_secret", clientSecret);
        parameters.append("username", username);
        parameters.append("password", password);

        const tokenController = new AbortController();
        const tokenTimeout = setTimeout(() => tokenController.abort(), 20000);

        let response;
        try {
            response = await fetch(url + "token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
                body: parameters,
                signal: tokenController.signal
            });
        } finally {
            clearTimeout(tokenTimeout);
        }

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('[OCR] get_token_ocr: falha ao obter token', { status: response.status, body: errorBody });
            throw new Error('Não foi possível autenticar no serviço OCR.');
        }

        const tokenData = await response.json();
        return { token: tokenData.access_token, url, username };
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('[OCR] get_token_ocr: timeout (10s)');
            throw new Error('Tempo limite excedido ao autenticar. Verifique a sua ligação e tente novamente.');
        }
        if (!err.message.startsWith('Não foi possível autenticar') && !err.message.startsWith('Tempo limite')) {
            console.error('[OCR] get_token_ocr: erro inesperado', { url: fetchUrl, erro: err.message });
            throw new Error('Erro de ligação ao serviço OCR. Verifique a sua ligação e tente novamente.');
        }
        throw err;
    }
}

// ===== OCR: ENVIAR UMA FOTO AO ENDPOINT =====
async function enviar_foto_ocr(ficheiro, token, url, username) {
    const params = new URLSearchParams({ DocumentTypeId: '3', CompanyId: '9', Username: username });
    const formData = new FormData();
    formData.append('File', ficheiro);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
        response = await fetch(`${url}api/ai/document-extraction?${params}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData,
            signal: controller.signal
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('[OCR] enviar_foto_ocr: timeout (30s)', { ficheiro: ficheiro.name, tamanhoKB: (ficheiro.size/1024).toFixed(1) });
            throw new Error('Tempo limite excedido (30s). Verifique a sua ligação e tente novamente.');
        }
        console.error('[OCR] enviar_foto_ocr: falha de rede', { ficheiro: ficheiro.name, tamanhoKB: (ficheiro.size/1024).toFixed(1), erro: err.message });
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('[OCR] enviar_foto_ocr: resposta de erro', { ficheiro: ficheiro.name, status: response.status, statusText: response.statusText, body: errorBody });
        if (response.status === 413) throw new Error('Imagem demasiado grande. Tente com uma foto de menor resolução.');
        if (response.status === 401 || response.status === 403) throw new Error('Sem autorização para processar o documento. Contacte o suporte.');
        if (response.status >= 500) throw new Error('Erro no servidor OCR. Tente novamente mais tarde.');
        throw new Error(`Erro ao processar imagem (${response.status}). Tente novamente.`);
    }

    return response.json();
}

// ===== VERSÃO ANTIGA DE processar_fotos_cc =====
async function processar_fotos_cc_OLD(ficheiros) {
    const { token, url, username } = await get_token_ocr();

    const [resposta1, resposta2] = await Promise.all([
        enviar_foto_ocr(ficheiros[0], token, url, username),
        enviar_foto_ocr(ficheiros[1], token, url, username)
    ]);

    const lado1 = identificar_frente_verso(resposta1);
    const lado2 = identificar_frente_verso(resposta2);
    // ... (resto da lógica antiga)
}

============================================================ */

// ===== PESQUISAR NIF NO DMS =====
async function procurar_nif_dms(nif) {
    const { token, url } = await get_token_dms();
    const connectionName = AMBIENTE === 'prod' ? 'api_prod_dms_widget' : 'api_qa_dms_recebimentos_widget';

    const result = await ZOHO.CRM.CONNECTION.invoke(connectionName, {
        url: url + "api/Entities/GetClientIdByNif",
        method: "GET",
        headers: { "Authorization": "Bearer " + token },
        parameters: { nif },
        param_type: 1
    });

    const msg = result.details.statusMessage;
    return (msg?.clientId != null && msg?.clientId !== undefined) ? msg : null;
}

// Converte DD/MM/YYYY para DD-MM-YYYY (formato DMS)
function converterDataDMS(data) {
    if (!data) return null;
    const partes = data.split('/');
    if (partes.length !== 3) return data;
    return `${partes[0]}-${partes[1]}-${partes[2]}`;
}

// ===== MAPEAMENTO DE NACIONALIDADE (CC → DMS) =====
const MAPA_NACIONALIDADE = {
    'PRT': 'PT',
    'PT': 'PT',
    // TODO: adicionar outros países conforme necessário
};

// ===== CONSTRUIR PAYLOAD PARA O DMS =====
function construirPayloadDMS(dadosFinais) {
    return {
        name: dadosFinais.nome,
        tin: dadosFinais.nif,
        citizenCard: dadosFinais.numeroDocumento,
        validateCitizenCard: converterDataDMS(dadosFinais.dataValidade),
        email: dadosEntidade.email,
        mobileContact: dadosEntidade.telefone,
        birthDate: converterDataDMS(dadosFinais.dataNascimento) || "01-01-2000",
        genderId: dadosFinais.genero || "M",
        nationalityCountryID: MAPA_NACIONALIDADE[dadosFinais.nacionalidade] || "PT",
        // Campos fixos obrigatórios pelo DMS
        gdpr1MatrizCommunication: false,
        gdpr2ProfileCreation: false,
        gdpr3MarketingJAP: false,
        gdpr4ContactEmail: false,
        gdpr5ContactSMS: false,
        gdpr6ContactPhone: false,
        gdpr7ContactMail: false,
        companyID: "2100",
        taxClass_ClientID: "NC",
        vatCashAccountingScheme: false,
        paymentDeadLineID: "C000",
        paymentTypeID: "TRF",
        clientGroupID: "C000",
        salesDestinyID: "05"
    };
}

// ===== INSERIR ENTIDADE NO DMS =====
async function inserir_entidade_dms(payload) {
    const { token, url } = await get_token_dms();
    const connectionName = AMBIENTE === 'prod' ? 'api_prod_dms_widget' : 'api_qa_dms_recebimentos_widget';

    const result = await ZOHO.CRM.CONNECTION.invoke(connectionName, {
        url: url + "api/Entities/InsertEntity",
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json", "Accept": "application/json" },
        parameters: payload,
        param_type: 1
    });

    return result.details.statusMessage;
}


// ===== OCR: CONVERTER DATA COM ESPAÇOS PARA DD/MM/YYYY =====
function formatar_data_ocr(dataStr) {
    if (!dataStr) return null;
    const MESES = { JAN:'01', FEV:'02', MAR:'03', ABR:'04', MAI:'05', JUN:'06', JUL:'07', AGO:'08', SET:'09', OUT:'10', NOV:'11', DEZ:'12', FEB:'02', APR:'04', MAY:'05', AUG:'08', SEP:'09', OCT:'10', DEC:'12' };
    const partes = dataStr.trim().split(/\s+/);
    if (partes.length !== 3) return dataStr;
    const [dia, mes, ano] = partes;
    const mesNum = MESES[mes.toUpperCase()] || mes.padStart(2, '0');
    return `${dia.padStart(2, '0')}/${mesNum}/${ano}`;
}

// ===== OCR: IDENTIFICAR FRENTE OU VERSO DO CC =====
function identificar_frente_verso(resposta) {
    const obj = resposta?.Object;
    if (!obj) return null;
    if (obj.FirstName?.value != null || obj.LastName?.value != null || obj.DocumentNumber?.value != null) return 'frente';
    if (obj.TaxNumber?.value != null || obj.DateOfBirth?.value != null || obj.HealthNumber?.value != null) return 'verso';
    return null;
}


 // ===== OCR: PROCESSAR AS DUAS FOTOS VIA CATALYST (chamada server-side via ZOHO.CRM.HTTP) =====
async function processar_fotos_cc(ficheiros) {
    const URL_MIDDLEWARE = "https://project-rainfall-20114366290.development.catalystserverless.eu/server/jap_f060_middleware_ocr/ocr";
    
    // Converter ficheiros para base64
    const ficheiroParaBase64 = (ficheiro) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(ficheiro);
    });
    
    const [foto1Base64, foto2Base64] = await Promise.all([
        ficheiroParaBase64(ficheiros[0]),
        ficheiroParaBase64(ficheiros[1])
    ]);
    
    // Chamar via ZOHO.CRM.HTTP.post (server-side, não passa pelo browser)
    let response;
    try {
        response = await ZOHO.CRM.HTTP.post({
            url: URL_MIDDLEWARE,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                foto1Base64,
                foto1Mime: ficheiros[0].type,
                foto2Base64,
                foto2Mime: ficheiros[1].type,
                ambiente: AMBIENTE
            })
        });
    } catch (err) {
        console.error('[OCR] Erro ZOHO.CRM.HTTP.post', err);
        throw new Error('Erro de ligação ao serviço OCR. Tente novamente.');
    }
    
    console.log('[OCR] Resposta bruta:', response);
    
    // ZOHO.CRM.HTTP devolve uma string com a resposta
    let dados;
    try {
        dados = typeof response === 'string' ? JSON.parse(response) : response;
    } catch (err) {
        console.error('[OCR] Resposta não é JSON válido:', response);
        throw new Error('Resposta inválida do serviço OCR.');
    }
    
    const { resposta1, resposta2 } = dados;
    
    console.log('[OCR] Resposta 1:', resposta1);
    console.log('[OCR] Resposta 2:', resposta2);
    
    // ===== Identificar frente/verso =====
    const lado1 = identificar_frente_verso(resposta1);
    const lado2 = identificar_frente_verso(resposta2);

    if (!lado1 && !lado2) {
        console.error('[OCR] não foi possível identificar frente/verso', { resposta1, resposta2 });
    }

    let frente, verso;
    if (lado1 === 'frente') {
        frente = resposta1.Object;
        verso = resposta2.Object;
    } else if (lado1 === 'verso') {
        verso = resposta1.Object;
        frente = resposta2.Object;
    } else if (lado2 === 'frente') {
        frente = resposta2.Object;
        verso = resposta1.Object;
    } else {
        frente = resposta1.Object;
        verso = resposta2.Object;
    }

    const confPct = (campo) => campo?.confidence != null ? Math.round(campo.confidence * 100) : undefined;
    const nomeConfs = [frente?.FirstName, frente?.LastName].map(confPct).filter(v => v !== undefined);

    return {
        nome: [frente?.FirstName?.value, frente?.LastName?.value].filter(Boolean).join(' ') || null,
        nif: frente?.TaxNumber?.value || verso?.TaxNumber?.value || null,
        numeroDocumento: frente?.DocumentNumber?.value || null,
        dataValidade: formatar_data_ocr(frente?.DateOfExpiration?.value),
        dataNascimento: formatar_data_ocr(verso?.DateOfBirth?.value || frente?.DateOfBirth?.value),
        genero: frente?.Sex?.value || null,
        nacionalidade: frente?.Nacionality?.value || null,
        confianca: {
            nome: nomeConfs.length ? Math.round(nomeConfs.reduce((a, b) => a + b, 0) / nomeConfs.length) : undefined,
            nif: confPct(frente?.TaxNumber) ?? confPct(verso?.TaxNumber),
            numeroDocumento: confPct(frente?.DocumentNumber),
            dataValidade: confPct(frente?.DateOfExpiration),
            dataNascimento: confPct(verso?.DateOfBirth) ?? confPct(frente?.DateOfBirth),
        },
    };
}