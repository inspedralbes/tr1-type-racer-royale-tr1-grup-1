# Guia de Desplegament i Contribució

## Sobre el Projecte

Aquest projecte està pensat per oferir una estructura moderna i eficient de desplegament utilitzant **Docker Compose**, amb dos entorns clarament diferenciats:  
- **Desenvolupament (Dev)** → per a proves i canvis actius.  
- **Producció (Prod)** → per a execució estable i segura.  

L’objectiu és facilitar el procés de desplegament, mantenir la coherència entre entorns i promoure bones pràctiques de desenvolupament col·laboratiu.

---

## Requisits Previs

Abans de començar, assegura’t de tenir instal·lats els següents programes:

- [Git] 
- [Docker] i Docker Compose  

---

## Passos Inicials

### 1. Clonar el Repositori

Clona el projecte i entra al directori:

```bash
git clone (https://github.com/inspedralbes/tr1-type-racer-royale-tr1-grup-1.git)
cd tr1-type-racer-royale-tr1-grup-1
```

### 2. Configuració de l'Entorn

IMPORTANT: Els següents fitxers d'entorn han de ser a l’arrel del projecte o dins dels directoris frontend/ i backend/, segons correspongui.
Cada entorn (DEV i PROD) té dos fitxers: un per al frontend i un per al backend.

```bash
Backend:
  - backend/.env.DEV
  - backend/.env.PROD

Frontend:
  - frontend/.env.DEV
  - frontend/.env.PROD
```
Cada fitxer ha de contenir les variables adequades segons l’entorn i el servei.

---

## Backend

backend/.env.DEV
```bash
PORT=3000
HOST=tr1g1-mysql
USER=root
PASSWORD=root
```

backend/.env.PROD
```bash
# Exemple de configuració per a producció
PORT=3000
HOST=tr1g1-mysql
USER=root
PASSWORD=root

# Variables opcionals
# DB_NAME=nom_basedades_prod
# JWT_SECRET=clau_secreta_segura
# NODE_ENV=production
```
El fitxer .env.PROD pot estar buit si el contenidor ja obté aquestes variables
des del fitxer docker-compose.prod.yml.

## Frontend

frontend/.env.DEV
```bash
VITE_URL_BACK=http://localhost:3000
```

frontend/.env.PROD

```bash
VITE_URL_BACK=http://IP:3000
```
---
## Desplegament en Entorn de PRODUCCIÓ (PROD)

S'utilitza el fitxer de configuració docker-compose.prod.yml.

### A. Aixecar l'Aplicació (Prod)

Construeix i aixeca els contenidors en segon pla (-d):

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### B. Logs de Producció

Per veure els logs en temps real:

```bash
docker compose -f docker-compose.prod.yml logs -f

```
---

## Desplegament en Entorn de DESENVOLUPAMENT (DEV)

S'utilitza el fitxer de configuració docker-compose.dev.yml.

### A. Aixecar l'Aplicació (Dev)

Aixeca l'entorn de desenvolupament:

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

### B. Logs de Desenvolupament

Per veure els logs en temps real:

```bash
docker compose -f docker-compose.dev.yml logs -f
```
---

## Accés a l'Aplicació

Un cop els contenidors estiguin aixecats (docker ps), pots accedir a l'aplicació:

Entorn	URL d'Accés

Desenvolupament	http://IP:5173

Producció	http://IP:80

---

## Aturar l'Aplicació

Per aturar i eliminar els contenidors i xarxes de l'entorn en ús:

## Entorn	Comanda per Aturar
Producció	
```bash
docker compose -f docker-compose.prod.yml down
```
Desenvolupament	
```bash
docker compose -f docker-compose.dev.yml down
```