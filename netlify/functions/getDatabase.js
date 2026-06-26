// netlify/functions/getDatabase.js
const fs = require('fs');
const path = require('path');

/**
 * Netlify Function: getDatabase
 * Returns the XML database. For unauthenticated users, the sensitive security block is redacted.
 */
exports.handler = async function(event, context) {
  // Netlify Identity injects a `user` object in `context.clientContext` when a valid JWT is present.
  const user = context.clientContext && context.clientContext.user;

  const xmlPath = path.join(__dirname, '..', '..', 'database.xml');
  try {
    let xml = fs.readFileSync(xmlPath, 'utf8');

    // If the user is not authenticated, redact the <security> block to protect sensitive credentials
    if (!user) {
      const securityRegex = /<security>[\s\S]*?<\/security>/g;
      xml = xml.replace(securityRegex, '');
    }

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
