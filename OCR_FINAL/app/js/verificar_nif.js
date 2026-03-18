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

// ===== PESQUISAR SE UM NIF JÁ EXISTE NO ZOHO CRM =====
function pesquisarNIFExistente(entity, nif) {
    return ZOHO.CRM.API.searchRecord({
        Entity: entity,
        Type: "criteria",
        Query: "(NIF:equals:" + nif + ")"
    }).then(function(response) {
        console.log("Resposta da pesquisa de NIF:", response);
        return response && response.data && response.data.length > 0;
        
    }).catch(function(error) {
        console.error("Erro ao pesquisar NIF:", error);
        return false;
    });
}
