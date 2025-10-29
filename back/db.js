import mysql from "mysql2";

export const con = mysql.createPool({
  host: "tr1g1-mysql",  // ⚠️ No "localhost" dins Docker
  user: "root",
  password: "root",
  database: "QUESTIONS",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
