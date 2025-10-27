import express from "express";

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

// GET que devuelve lista ejemplo
app.get("/users", (req, res) => {
  const users = [
    { id: 1, name: "Ana" },
    { id: 2, name: "Luis" },
    { id: 3, name: "María" },
  ];
  res.json(users);
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
