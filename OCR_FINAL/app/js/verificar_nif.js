// ===== VERIFICAR SE A ENTIDADE JÁ TEM NIF (ao abrir o widget) =====
function verificarNIF(data) {
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
}

// ===== PESQUISAR SE UM NIF JÁ EXISTE NO ZOHO CRM =====
function pesquisarNIFExistente(entity, nif) {
    return ZOHO.CRM.API.searchRecord({
        Entity: entity,
        Type: "criteria",
        Query: "(NIF:equals:" + nif + ")"
    }).then(function(response) {
        return response && response.data && response.data.length > 0;
    }).catch(function(error) {
        console.error("Erro ao pesquisar NIF:", error);
        return false;
    });
}
