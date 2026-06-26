// netlify/functions/getDatabase.js
const fs = require('fs');
const path = require('path');

/**
 * Netlify Function: getDatabase
 * Returns the XML database only for authenticated Netlify Identity users.
 */
exports.handler = async function(event, context) {
  // Netlify Identity injects a `user` object in `context.clientContext` when a valid JWT is present.
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthenticated' })
    };
  }

  const xmlPath = path.join(__dirname, '..', '..', 'database.xml');
  try {
    const xml = fs.readFileSync(xmlPath, 'utf8');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml'
      },
      body: xml
    };
  } catch (err) {
    console.error('Failed to read XML:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to read database' })
    };
  }
};
