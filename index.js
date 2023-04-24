const cmis = require('cmis');
const path = require('path');
const uuid = require('uuid');
const fs = require('fs');

const nodeFetch = require('node-fetch');
globalThis.fetch = nodeFetch;

const demoAlfresco = async () => {
    // création d'une session 
    const session = new cmis.CmisSession('http://localhost/alfresco/api/-default-/public/cmis/versions/1.1/browser');
    session.setCredentials('user', 'password');
    session.setCharset('UTF-8');
    // Charger la liste des répositories
    await session.loadRepositories();
    // Voir les repositories
    const repositories = Object.keys(session.repositories);
    // session.defaultRepository 

    // Lister tous les documents SPO 
    const result = await session.query(`
    select d.cmis:name, d.cmis:objectId, s.spo:refOperation from spo:SpoDocMeta as s inner join cmis:document as d  on d.cmis:objectId = s.cmis:objectId`,
        false, { succinct: true });
    console.log('Documents SPO:');
    console.log(result.results);

    // Création d'un document 
    // Le répertoire ou on va stocker des documents
    const infoFolder = await session.getObjectByPath('/sites/SPO/documentlibrary');
    const folderId = infoFolder.succinctProperties['cmis:objectId'];

    // Création d'un stream avec le fichier que on veut le uploader
    const fileName = path.join(__dirname, 'upload', 'facture.txt');
    contentStream = await fs.promises.readFile(fileName);
    // Creation de document
    const oi = await session.createDocument(folderId, contentStream, {
        'cmis:name': uuid.v4() + ' - facture.txt',
        'cmis:description': '',
        'cmis:secondaryObjectTypeIds': [
            'P:spo:SpoDocMeta'
        ],
        'spo:libelle': 'facture.txt',
        'spo:modele': "false",
        'spo:objet': "Operation",
        'spo:refOperation': 'OP_0001',

    });

    // Rechercher le document
    const queryResuly = await session.query(`
     select d.cmis:name, d.cmis:objectId, s.spo:refOperation from spo:SpoDocMeta as s inner join cmis:document as d 
     on d.cmis:objectId = s.cmis:objectId where s.spo:refOperation = 'OP_0001'`, false, { succinct: true });
    console.log('Documents SPO:');
    console.log(queryResuly.results);
    // download document
    const idDocument = oi.succinctProperties['cmis:objectId'];
    const url = session.getContentStreamURL(idDocument);
    console.log(url);
    const resDownload = await fetch(url, {
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${session.username}:${session.password}`).toString('base64'),
        }
    });
    outputPath = path.join(__dirname, 'download', 'download.txt');
    try {
        await fs.promises.unlink(outputPath);
    } catch {
    }
    await writeResponse(resDownload, outputPath);

    // remove document
    await session.deleteObject(idDocument);
};

const writeResponse = async (resDownload, outputPath) => {
    return new Promise((resolve) => {
        const w = fs.createWriteStream(outputPath);
        w.on('close', () => {
            resolve();
        });
        w.on('error', (err) => {
            reject(err);
        });
        resDownload.body.pipe(w);
    });
};


demoAlfresco().then(() => { }).catch(async (e) => {
    if (e.response) {
        let text = '';
        for await (const chunk of e.response.body) {
            text += new TextDecoder().decode(chunk);;
        }
        console.log(text);
    } else {
        console.log(e.message);
    }
});