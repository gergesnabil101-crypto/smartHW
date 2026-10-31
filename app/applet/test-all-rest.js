import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

async function run() {
  let url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users?pageSize=300`;
  let pageToken = '';
  
  while(true) {
    let reqUrl = url + (pageToken ? `&pageToken=${pageToken}` : '');
    const response = await fetch(reqUrl);
    const data = await response.json();
    
    if (data.documents) {
      const user = data.documents.find(d => {
          const emailField = d.fields?.email?.stringValue;
          return emailField === 'janaaahmedhassan9927@gmail.com';
      });
      if (user) {
        console.log("FOUND!");
        console.log(JSON.stringify(user, null, 2));
        return;
      }
    }
    
    if (data.nextPageToken) {
        pageToken = data.nextPageToken;
    } else {
        break;
    }
  }
  
  console.log("NOT FOUND");
}

run().catch(console.error);
