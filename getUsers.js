const { Client } = require("pg");

exports.handler = async () => {

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  const result = await client.query("SELECT * FROM users");

  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows)
  };
};
