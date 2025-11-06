# Guia de Desplegament i Contribució

## Sobre el Projecte

Aquest projecte està pensat per oferir una estructura moderna i eficient de desplegament utilitzant **Docker Compose**, amb dos entorns clarament diferenciats:  
- **Desenvolupament (Dev)** → per a proves i canvis actius.  
- **Producció (Prod)** → per a execució estable i segura.  

L’objectiu és facilitar el procés de desplegament, mantenir la coherència entre entorns i promoure bones pràctiques de desenvolupament col·laboratiu.

---

## Requisits Previs

Abans de començar, assegura’t de tenir instal·lats els següents programes:

- [Node.js] i npm  
- [Git] 
- [Docker] i Docker Compose  

---

## Passos Inicials

### 1. Clonar el Repositori

Clona el projecte i entra al directori:

```bash
git clone [URL_DEL_TEU_REPOSITORI]
cd [NOM_DEL_DIRECTORI_CLONAT]
```

### 2. Instal·lació de Dependències

Instal·la les dependències base del projecte (com ara express):

```bash
npm install
```

### 3. Configuració de l'Entorn

IMPORTANT: Els següents fitxers d'entorn han de ser a l'arrel del projecte i contenir les variables necessàries per a cada ambient:

.env.PROD
.env.DEV

Cada fitxer ha de contenir les variables adequades segons l'entorn.
Per exemple:
```bash
# Exemple de .env.PROD
NODE_ENV=production
PORT=80
DB_URL=mongodb://mongo:27017/nom_basedades_prod
```

```bash
# Exemple de .env.DEV
NODE_ENV=development
PORT=3000
DB_URL=mongodb://localhost:27017/nom_basedades_dev
```
## Desplegament en Entorn de PRODUCCIÓ (PROD)

S'utilitza el fitxer de configuració docker-compose.prod.yml.

A. Aixecar l'Aplicació (Prod)

Construeix i aixeca els contenidors en segon pla (-d):

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```
