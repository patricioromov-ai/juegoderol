# Neón y Ceniza, versión GitHub

Una campaña de rol por turnos que se juega desde el navegador. Claude dirige la historia. GitHub aloja la página y guarda el estado. Cada jugador juega desde su casa, con su propio teléfono.

## Cómo funciona

1. La página (GitHub Pages) muestra la campaña y tu personaje.
2. Cuando eliges una jugada, la página abre una incidencia (Issue) de GitHub ya rellenada. Tú solo pulsas **Submit new issue**.
3. Un flujo automático (GitHub Actions) registra tu jugada. Cuando todos actuaron, o cuando el anfitrión cierra el día, llama a Claude por API. Claude narra lo ocurrido, decide las consecuencias para cada jugador y abre el día siguiente.
4. La página se actualiza sola, uno o dos minutos después.

## Qué necesitas

- Una cuenta gratuita de GitHub (el anfitrión y cada jugador).
- Una **clave de API de Anthropic** con facturación propia (console.anthropic.com). Es distinta de tu suscripción a Claude. Se usa una llamada al comenzar y una por cada día resuelto.
- Un computador para la instalación inicial. Después, todos juegan desde el teléfono.

## Instalación (unos 15 minutos)

**1. Crea el repositorio.** En GitHub, crea un repositorio **público** (por ejemplo `neon-y-ceniza`).

**2. Sube los archivos.** Sube todo el contenido de esta carpeta, incluida la carpeta oculta `.github`.
- Con git:
  ```
  git init
  git add .
  git commit -m "Neón y Ceniza"
  git branch -M main
  git remote add origin https://github.com/TU_USUARIO/neon-y-ceniza.git
  git push -u origin main
  ```
- O desde la web: Add file, Upload files, y arrastra la carpeta descomprimida. Comprueba que exista `.github/workflows/juego.yml`.

**3. Activa Pages.** Settings, Pages, Source: *Deploy from a branch*, Branch: `main` y carpeta `/ (root)`, Save. En un par de minutos el juego queda en `https://TU_USUARIO.github.io/neon-y-ceniza/`.

**4. Permisos de Actions.** Settings, Actions, General, Workflow permissions: **Read and write permissions**, Save.

**5. Genera las llaves del director.** Abre `https://TU_USUARIO.github.io/neon-y-ceniza/claves.html` y pulsa *Generar llaves*.

**6. Guarda la llave privada.** Settings, Secrets and variables, Actions, New repository secret. Nombre: `CLAVE_PRIVADA`. Valor: la llave privada que mostró la página. No la compartas.

**7. Guarda tu clave de API.** Otro secreto, con el nombre `ANTHROPIC_API_KEY`.

**8. Edita `config.json`** (en GitHub, con el lápiz):
- `repo`: `"TU_USUARIO/neon-y-ceniza"`
- `nombre` y `dur` (duración en días: 7, 15 o 30)
- `permitidos`: los usuarios de GitHub que pueden jugar, por ejemplo `["tu_usuario","amigo1","amigo2"]`. Incluye el tuyo. Si lo dejas vacío, cualquiera con cuenta de GitHub puede unirse.
- `clavePublica`: pega la llave pública, en lugar de `null`.

**9. (Opcional) Modelo.** Settings, Secrets and variables, Actions, pestaña Variables, crea `MODELO` con el nombre del modelo de Claude que quieras usar. Por defecto usa `claude-sonnet-5`.

## Cómo se juega

1. Cada jugador abre el enlace, escribe su usuario de GitHub y crea su personaje. Al final pulsa *Enviar mi personaje*, y en GitHub, *Submit new issue*.
2. El anfitrión (el dueño del repositorio) pulsa *Comenzar la campaña*. Claude inventa el misterio y abre el día 1.
3. Cada día, cada jugador elige una acción: una opción propuesta, hablar con el personaje del día, enfrentar la amenaza o algo libre. Puede sumar un poder y apuntar a otro jugador (aliarse, seducir, espiar, traicionar...).
4. Cuando todos actuaron, el día se cierra solo. El anfitrión puede cerrarlo antes con *Cerrar el día ahora*.

## Privacidad

El repositorio es público, así que todo lo sensible viaja **cifrado**:

- Público: nombre, Casa, cargo, origen y atributos de cada personaje, quién ya actuó, la crónica de cada día y la Influencia de cada jugador.
- Cifrado: objetivo secreto, sociedad secreta, recursos, jugadas, resultados privados y lo que Claude sabe de la trama. Solo el jugador (o el director) puede abrirlo.
- Tu llave secreta se guarda en tu navegador. Si cambias de dispositivo, cópiala desde la pestaña Ficha.
- El anfitrión tiene la llave del director, así que técnicamente podría leer todo. Es un juego entre amigos, no un sistema a prueba de trampas.
- Los prompts pasan por la API de Anthropic.

## Límites

- Máximo 6 jugadores.
- El juego es asíncrono: entre que envías y ves el resultado pasan uno o dos minutos.
- No hay conversación en vivo con los personajes. Hablar con ellos es una jugada: escribes qué les dices y Claude evalúa tu negociación al cerrar el día.

## Problemas frecuentes

- **La incidencia queda sin respuesta.** Abre la pestaña *Actions* del repositorio y mira la última ejecución. Suele faltar un secreto o la `clavePublica` en `config.json`.
- **"No pude abrir secreto.json".** Cambiaste las llaves. Restaura `estado.json` y `secreto.json` a su contenido inicial (`{}` en secreto.json) y reinicia.
- **La página no se actualiza.** Pulsa *Actualizar*. La página lee el estado directamente desde la API de GitHub.
- **Quiero empezar de cero.** En la pestaña Mesa, el anfitrión pulsa *Reiniciar campaña*.
