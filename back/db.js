import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

export const con = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: "QUESTIONS"
});

con.connect((err) => {
  if (err) {
    console.error("❌ Error connectant a MySQL:", err);
    return;
  }
  console.log("✅ Connectat correctament a la base de dades MySQL!");
});