let dadosEntidade = null;

// ===== VERIFICAR SE A ENTIDADE JÁ TEM NIF|EMAIL|TELEFONE (ao abrir o widget) =====
function verificarNIF(data) {
    ZOHO.CRM.API.getRecord({
        Entity: data.Entity,
        RecordID: data.EntityId
    }).then(function(response) {
        const record = response.data[0];
        const nif = record.NIF;
        const email = record.Email;
        const telefone = record.Mobile_Phone;

        dadosEntidade = {
            id: record.id,
            entity: data.Entity,
            email: email,
            telefone: telefone
        };

        if (nif && nif.trim() !== "") {
            alert("O campo NIF está preenchido. Apenas em entidades sem NIF preenchido é possível usar este widget.");
            ZOHO.CRM.UI.Popup.closeReload();
        } else if (!email || email.trim() === "") {
            alert("O campo Email não está preenchido. Apenas em entidades com Email preenchido é possível usar este widget.");
            ZOHO.CRM.UI.Popup.closeReload();
        } else if (!telefone || telefone.trim() === "") {
            alert("O campo Telemóvel não está preenchido. Apenas em entidades com Telemóvel preenchido é possível usar este widget.");
            ZOHO.CRM.UI.Popup.closeReload();
        }

    }).catch(function(error) {
        console.error("Erro ao obter dados do registo:", error);
    });
}

// Converte DD/MM/YYYY para YYYY-MM-DD (formato Zoho)
function converterData(data) {
    if (!data) return null;
    const partes = data.split('/');
    if (partes.length !== 3) return data;
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

// ===== PESQUISAR SE UM NIF JÁ EXISTE NO ZOHO CRM =====
function pesquisarNIFExistente(entity, nif) {
    return ZOHO.CRM.API.searchRecord({
        Entity: entity,
        Type: "criteria",
        Query: "(NIF:equals:" + nif + ")"
    }).then(function(response) {
        if (!response || !response.data || response.data.length === 0) return false;
        const name = response.data[0]?.Account_Name || "sem nome";
        console.log("Resposta da pesquisa de NIF:", response);
        return name;
    }).catch(function(error) {
        console.error("Erro ao pesquisar NIF:", error);
        return false;
    });
}

// ===== ATUALIZAR ENTIDADE NO ZOHO CRM =====
function atualizarEntidadeZoho(dadosOCR) {
    console.log('dadosEntidade:', JSON.stringify(dadosEntidade));
    return ZOHO.CRM.API.updateRecord({
        Entity: dadosEntidade.entity,
        Trigger: ["workflow"],
        APIData: {
            id: dadosEntidade.id,
            NIF: dadosOCR.nif,
            Nr_de_identifica_o: dadosOCR.numeroDocumento,
            Data_de_validade_Identifica_o: converterData(dadosOCR.dataValidade),
            Tipo_de_Identifica_o: document.getElementById('tipoDocumento').value,
            Account_Name:dadosOCR.nome,
            Carregamento_OCR:true
        }
    }).then(function(response) {
        console.log('Resposta Zoho update:', JSON.stringify(response));
        if (response && response.data && response.data[0] && response.data[0].status === 'error') {
            throw response;
        }
        return response;
    }).catch(function(error) {
        console.error('Erro ao atualizar registo:', error);
        if (error && error.data && error.data[0]) {
            console.error('Detalhe do erro Zoho:', JSON.stringify(error.data[0]));
        }
        throw error;
    });
}
