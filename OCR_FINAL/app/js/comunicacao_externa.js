// ===== AMBIENTE: muda para 'prod' quando estiveres pronto =====
const AMBIENTE = 'qa';

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

// ===== OBTER TOKEN DE AUTENTICAÇÃO DO DMS =====

async function get_token_dms() {
    const [url, username, password, grant_type] = await crmVars();

    const parameters = new URLSearchParams();
    parameters.append("grant_type", grant_type);
    parameters.append("Username", username);
    parameters.append("Password", password);

    const response = await fetch(url + "token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        },
        body: parameters
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Resposta erro DMS:', errorBody);
        throw new Error('Erro ao obter token DMS: ' + response.statusText);
    }

    const tokenData = await response.json();
    return { token: tokenData.access_token, url };
}

// ===== PESQUISAR NIF NO DMS =====
async function procurar_nif_dms(nif) {
    const { token, url } = await get_token_dms();

    const response = await fetch(url + "api/Entities/GetClientIdByNif?nif=" + nif, {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + token,
        },
    });

    if (!response.ok) throw new Error('Erro ao pesquisar NIF no DMS: ' + response.statusText);

    return await response.json();
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
        birthDate: converterDataDMS(dadosFinais.dataNascimento) || "01-01-2000",      // TODO: virá do OCR
        genderId: dadosFinais.genero || "M",                       // TODO: virá do OCR
        nationalityCountryID: MAPA_NACIONALIDADE[dadosFinais.nacionalidade] || "PT", // TODO: virá do OCR
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
    const response = await fetch(url + "api/Entities/InsertEntity", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Resposta erro DMS:', errorBody);
        throw new Error('Erro ao inserir entidade no DMS: ' + response.statusText);
    }

    return await response.json();
}


