🚀 Guia de Desplegament i Contribució
Aquest projecte utilitza Docker Compose per gestionar dos entorns separats: Desenvolupament (Dev) i Producció (Prod), cadascun amb el seu arxiu de configuració i variables d'entorn específiques.
⚙️ Requisits Previs
Assegura't de tenir instal·lats els següents programes:
Node.js i npm
Git
Docker i Docker Compose
📋 Passos Inicials
1. Clonar el Repositori
Clona el projecte i entra al directori:
git clone [URL_DEL_TEU_REPOSITORI]
cd [NOM_DEL_DIRECTORI_CLONAT]


2. Instal·lació de Dependències
Instal·la les dependències base del projecte (com ara express):
npm install


3. Configuració de l'Entorn
IMPORTANT: Els següents fitxers d'entorn han de ser a l'arrel del projecte i contenir les variables necessàries per a cada ambient:
.env.PROD
.env.DEV
🛠️ Desplegament en Entorn de PRODUCCIÓ (PROD)
S'utilitza el fitxer de configuració docker-compose.prod.yml.
A. Aixecar l'Aplicació (Prod)
Utilitza la comanda per construir i aixecar els contenidors en segon pla (-d):
docker-compose -f docker-compose.prod.yml up --build -d


B. Logs de Producció
Per veure els logs en temps real:
docker-compose -f docker-compose.prod.yml logs -f


🖥️ Desplegament en Entorn de DESENVOLUPAMENT (DEV)
S'utilitza el fitxer de configuració docker-compose.dev.yml.
A. Aixecar l'Aplicació (Dev)
Utilitza la comanda per aixecar l'entorn de desenvolupament:
docker-compose -f docker-compose.dev.yml up --build -d


B. Logs de Desenvolupament
Per veure els logs en temps real:
docker-compose -f docker-compose.dev.yml logs -f


🌐 Accés a l'Aplicació
Un cop els contenidors estiguin aixecats (docker ps), pots accedir a l'aplicació:
Entorn
URL d'Accés (Exemple)
Desenvolupament
http://localhost:3000
Producció
http://localhost:80

🛑 Aturar l'Aplicació
Per aturar i eliminar els contenidors i xarxes de l'entorn en ús:
Entorn
Comanda per Aturar
Producció
docker-compose -f docker-compose.prod.yml down
Desenvolupament
docker-compose -f docker-compose.dev.yml down

✨ Contribució
Agraïm el teu interès a contribuir!
Fes un fork del repositori.
Crea una nova branca per a la teva feature o correcció de bug: git checkout -b feature/la-meva-nova-caracteristica.
Fes els teus canvis i assegura't de provar l'aplicació en l'entorn DEV.
Fes commit dels teus canvis: git commit -m 'feat: Afegir nova característica X'.
Puja els teus canvis: git push origin feature/la-meva-nova-caracteristica.
Obre un Pull Request detallant els canvis.
