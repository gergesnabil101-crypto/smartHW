const { auth } = require('google-auth-library');
async function run() {
  const client = await auth.getClient({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  console.log('Client type:', client.constructor.name);
  if (client.email) console.log('Email:', client.email);
}
run();
