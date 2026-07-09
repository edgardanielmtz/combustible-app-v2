# INSTRUCCIONES DE INSTALACION (10 minutos)

## 1. Crear credenciales de Google

1. Ve a: https://console.cloud.google.com
2. Crea un proyecto nuevo (o usa uno existente).
3. Activa la API: "APIs y servicios" > "Habilitar APIs" > busca "Google Sheets API" > Habilitar.
4. Ve a "APIs y servicios" > "Credenciales" > "Crear credenciales" > "Cuenta de servicio".
5. Ponle cualquier nombre, clic en "Crear y continuar", saltate los pasos opcionales, "Listo".
6. Clic en la cuenta de servicio recien creada > pestaña "Claves" > "Agregar clave" > "Crear clave nueva" > JSON > "Crear".
7. Descarga el archivo JSON que se genera automaticamente — ese es tu "credentials.json".
8. Renombra ese archivo exactamente como: credentials.json
9. Ponlo en esta misma carpeta (junto a server.js).

## 2. Dar acceso al Sheets

1. Abre el credentials.json y copia el valor de "client_email" (algo como tu-cuenta@tu-proyecto.iam.gserviceaccount.com).
2. Abre tu Google Sheets.
3. Clic en "Compartir" (arriba a la derecha).
4. Pega ese correo y dale acceso de "Editor".
5. Clic en "Enviar".

## 3. Instalar y arrancar local (para probar)

Necesitas Node.js instalado (https://nodejs.org).

```
npm install
node server.js
```

Abre http://localhost:8080 en tu navegador — deberias ver el menu.

## 4. Publicar en Railway (gratis, funciona en iPhone)

Railway es el servicio mas facil para publicar esto:

1. Ve a https://railway.app y crea una cuenta (puedes entrar con GitHub).
2. Clic en "New Project" > "Deploy from GitHub repo" (o "Empty project").
3. Arrastra esta carpeta completa, o conecta tu GitHub.
4. En la seccion de "Variables" de Railway, agrega una variable:
   - Nombre: GOOGLE_CREDENTIALS
   - Valor: (el contenido COMPLETO de tu credentials.json, todo en una linea)
5. Railway te da un link publico automaticamente (algo como tu-app.railway.app).
6. Ese link lo abres en Safari en tu iPhone > Compartir > "Agregar a pantalla de inicio".

## ALTERNATIVA: publicar en Render (tambien gratis)

1. Ve a https://render.com
2. "New Web Service" > conecta tu repo de GitHub.
3. En "Environment Variables" agrega GOOGLE_CREDENTIALS igual que arriba.
4. Deploy — te da un link .onrender.com.

