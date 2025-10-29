import express from "express";
import { con } from "./db.js";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// GET raíz: devuelve un mensaje simple
app.get("/", (req, res) => {
  res.json({ message: "Hola mundo desde GET /" });
});

app.get("/words/:language", (req, res) => {
  const { language } = req.params;
  con.query(
    "SELECT * FROM WORDS WHERE LANGUAGE_CODE = ?",
    [language],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtenir les dades" });
      }
      if (!results || results.length === 0) {
        return res
          .status(404)
          .json({ error: "No s'han trobat paraules per aquest idioma" });
      }
      const randomIndex = Math.floor(Math.random() * results.length);
      res.json(results[randomIndex]);
    }
  );
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
