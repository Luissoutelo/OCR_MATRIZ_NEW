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

    if (!response.ok) throw new Error('Erro ao obter token DMS: ' + response.statusText);

    return await response.json();
}

// ===== PESQUISAR NIF NO DMS =====
async function procurar_nif_dms(nif) {
    const tokenData = await get_token_dms();
    const [url] = await crmVars();

    const response = await fetch(url + "/api/entidades?nif=" + nif, {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + tokenData.access_token,
            "Accept": "application/json"
        }
    });

    if (!response.ok) throw new Error('Erro ao pesquisar NIF no DMS: ' + response.statusText);

    return await response.json();
}
