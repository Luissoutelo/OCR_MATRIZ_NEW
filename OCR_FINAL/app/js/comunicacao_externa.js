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

// ===== INSERIR ENTIDADE NO DMS =====
async function inserir_entidade_dms(dadosEntidade) {
    const { token, url } = await get_token_dms();

    const response = await fetch(url + "api/Entities/InsertEntity", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(dadosEntidade)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Resposta erro DMS:', errorBody);
        throw new Error('Erro ao inserir entidade no DMS: ' + response.statusText);
    }

    return await response.json();
}

// ===== PESQUISAR NIF NO DMS =====
async function procurar_nif_dms(nif) {
    const { token, url } = await get_token_dms();

    const response = await fetch(url + "api/Entities/GetClientIdByNif", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ nif })
    });

    if (!response.ok) throw new Error('Erro ao pesquisar NIF no DMS: ' + response.statusText);

    return await response.json();
}
