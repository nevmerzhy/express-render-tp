const express = require("express");
const { Pool } = require("pg");
const app = express();
const port = process.env.PORT || 3001;

let localViews = 0;
let isUsingDb = false;

let pool;
if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    isUsingDb = true;
}

const initDb = async () => {
    if (!isUsingDb) return;
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS counters (
        id SERIAL PRIMARY KEY,
        view_count INTEGER DEFAULT 0
      );
    `);
        const res = await pool.query("SELECT * FROM counters");
        if (res.rowCount === 0) {
            await pool.query("INSERT INTO counters (view_count) VALUES (0)");
        }
    } catch (err) {
        console.error("⚠️ DB configurée mais impossible d'initialiser la table:", err.message);
        isUsingDb = false;
    }
};
initDb();

app.get("/", async (req, res) => {
    let views;
    let mode = "Mode éphémère (Sans DB)";

    if (isUsingDb) {
        try {
            const result = await pool.query(
                "UPDATE counters SET view_count = view_count + 1 RETURNING view_count"
            );
            views = result.rows[0].view_count;
            mode = "Mode Persistant (PostgreSQL)";
        } catch (err) {
            console.error("Erreur lors de l'accès DB, bascule en mode local.");
            localViews++;
            views = localViews;
        }
    } else {
        localViews++;
        views = localViews;
    }

    res.type('html').send(getHtml(views, mode));
});

const server = app.listen(port, () => console.log(`App listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const getHtml = (views, mode) => `
<!DOCTYPE html>
<html>
  <head>
    <title>Render IaaS/PaaS Demo</title>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    <style>
      body { 
        font-family: sans-serif; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        height: 100vh; 
        margin: 0; 
        background: ${isUsingDb ? '#e8f5e9' : '#fce4ec'}; 
      }
      section { 
        text-align: center; 
        padding: 2em; 
        background: white; 
        border-radius: 15px; 
        box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
      }
      .count { font-size: 3em; color: #2d3436; display: block; }
      .mode { 
        display: inline-block; 
        margin-top: 10px; 
        padding: 5px 10px; 
        border-radius: 5px; 
        font-size: 0.8em; 
        background: ${isUsingDb ? '#4caf50' : '#e91e63'}; 
        color: white; 
      }
    </style>
  </head>
  <body>
    <section>
      <h1>Bienvenue sur le Cloud de!</h1>
      <span class="count">${views}</span>
      <div class="mode">${mode}</div>
      <p style="color: gray; font-size: 0.8em; margin-top: 20px;">
        ${isUsingDb ? "Vos données survivront au prochain déploiement." : "Attention : Les données seront perdues si le serveur redémarre."}
      </p>
    </section>
    <script>
      setTimeout(() => { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }, 500);
    </script>
  </body>
</html>
`;