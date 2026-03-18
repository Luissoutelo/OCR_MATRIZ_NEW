 

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