import express from "express";
import { con } from "./db.js";
import dotenv from "dotenv";

dotenv.config();

/*
    Ejemplo mínimo de proyecto con un GET usando Express.
    Guarda este código en: /c:/Users/Climent/Desktop/Git/tr1-type-racer-royale-tr1-grup-1/back/index.js

    Para ejecutar:
        1) npm init -y
        2) npm install express
        3) node index.js
*/

const app = express();
const PORT = process.env.PORT || 3000;

// GET raíz: devuelve un mensaje simple
app.get("/", (req, res) => {
  res.json({ message: "Hola mundo desde GET /" });
});

app.get("/words", (req, res) => {
  con.query("SELECT * FROM WORDS", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtenir les dades" });
    }
    res.json(results);
  });
});

app.get("/texts", (req, res) => {
  con.query("SELECT * FROM TEXTS", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtenir les dades" });
    }
    res.json(results);
  });
});

app.get("/texts/:id", (req, res) => {
  con.query(
    "SELECT * FROM TEXTS WHERE ID = ?",
    [req.params.id],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtenir les dades" });
      }
      res.json(results);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
