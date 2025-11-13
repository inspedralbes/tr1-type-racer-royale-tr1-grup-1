import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

export const con = mysql.createPool({
  host: "tr1g1-mysql",  // ⚠️ No "localhost" dins Docker
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: "QUESTIONS",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});