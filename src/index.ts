export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/submit") {
      const { message } = await request.json();

      if (!message || message.length > 500) {
        return new Response("Mensaje inválido", { status: 400 });
      }

      await env.DB.prepare(
        "INSERT INTO messages (content, created_at) VALUES (?, datetime('now'))"
      )
        .bind(message)
        .run();

      const telegramUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          chat_id: env.CHAT_ID,
          text: `📬 Tienes un nuevo mensaje anónimo:\n\n${message}`,
        }),
      });

      return new Response("Mensaje recibido", { status: 200 });
    }

    const checkAuth = (authHeader, env) => {
      if (!authHeader?.startsWith("Basic ")) return null;
      const decoded = atob(authHeader.replace("Basic ", ""));
      const [user, password] = decoded.split(":");
      return password === env.ADMIN_PASSWORD ? user : null;
    };

    const escapeHtml = (unsafe) => {
      if (typeof unsafe !== "string") {
        return "";
      }
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    if (request.method === "GET" && url.pathname === "/messages") {
      const authHeader = request.headers.get("Authorization");
      const user = checkAuth(authHeader, env);

      if (!user) {
        return new Response("No autorizado", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
        });
      }

      const { results } = await env.DB.prepare(
        "SELECT id, content, created_at FROM messages ORDER BY created_at DESC"
      ).all();
      const mensajesHtml = results
        .map(
          (msg) =>
            `<li><strong>${new Date(
              msg.created_at
            ).toLocaleString()}:</strong><div class="message-content">${escapeHtml(
              msg.content
            )}</div></li>`
        )
        .join("");

      const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mensajes Recibidos</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #121212;
                color: #e0e0e0;
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 100vh;
                box-sizing: border-box;
            }
            .container {
                background-color: #1e1e1e;
                padding: 25px 30px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                width: 100%;
                max-width: 800px;
                text-align: left;
            }
            h1 {
                color: #bb86fc;
                margin-bottom: 25px;
                font-size: 2.2em;
                text-align: center;
            }
            ul {
                list-style-type: none;
                padding: 0;
                margin: 0 0 25px 0;
            }
            li {
                background-color: #2c2c2c;
                margin-bottom: 12px;
                padding: 15px;
                border-radius: 6px;
                border-left: 4px solid #bb86fc;
                line-height: 1.6;
            }
            li strong {
                color: #bb86fc;
                display: block;
                margin-bottom: 5px;
                font-size: 0.9em;
            }
            .message-content {
                white-space: pre-wrap;
                word-break: break-word;
            }
            li em {
                color: #757575;
                font-style: italic;
                display: block;
                text-align: center;
                padding: 20px;
                background-color: transparent;
                border-left: none;
            }
            .controls {
                text-align: center;
                margin-top: 20px;
            }
            button {
                background-color: #cf6679;
                color: white;
                border: none;
                padding: 12px 25px;
                font-size: 1em;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s ease, transform 0.1s ease;
            }
            button:hover {
                background-color: #b00020;
            }
            button:active {
                transform: scale(0.98);
            }
            button:disabled {
                background-color: #555;
                color: #aaa;
                cursor: not-allowed;
            }
            .status-message {
                margin-top: 20px;
                padding: 12px 15px;
                border-radius: 4px;
                text-align: center;
                font-size: 0.95em;
                display: none;
            }
            .status-message.success {
                background-color: #03dac6;
                color: #121212;
            }
            .status-message.error {
                background-color: #b00020;
                color: #e0e0e0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📨 Mensajes Recibidos</h1>
            <ul>${mensajesHtml || "<li><em>No hay mensajes aún.</em></li>"}</ul>
            <div class="controls">
                <button id="vaciarBtn">🗑️ Vaciar todos los mensajes</button>
            </div>
            <div id="statusMessage" class="status-message"></div>
        </div>
        <script>
            const vaciarBtn = document.getElementById('vaciarBtn');
            const statusDiv = document.getElementById('statusMessage');

            async function vaciarMensajes() {
                const confirmacion = confirm("¿Estás realmente seguro de que quieres borrar TODOS los mensajes? Esta acción no se puede deshacer.");
                if (!confirmacion) return;

                vaciarBtn.disabled = true;
                vaciarBtn.textContent = 'Vaciando...';
                statusDiv.style.display = 'none';
                statusDiv.className = 'status-message';

                try {
                    const response = await fetch("/messages", {
                        method: "DELETE"
                    });

                    if (response.ok) {
                        statusDiv.textContent = "Todos los mensajes han sido eliminados.";
                        statusDiv.classList.add('success');
                        document.querySelector('.container ul').innerHTML = "<li><em>No hay mensajes aún.</em></li>";
                    } else {
                        let errorMsg = "Error al borrar mensajes.";
                        try {
                            const errorData = await response.json();
                            errorMsg = \`Error (\${response.status}): \${errorData.error || response.statusText}\`;
                        } catch (e) {
                            errorMsg = \`Error (\${response.status}): \${response.statusText}\`;
                        }
                        if (response.status === 401) {
                            errorMsg = "No autorizado para borrar mensajes. Es posible que tu sesión haya expirado. Intenta recargar la página.";
                        }
                        statusDiv.textContent = errorMsg;
                        statusDiv.classList.add('error');
                    }
                } catch (error) {
                    console.error("Error en fetch al vaciar:", error);
                    statusDiv.textContent = "Error de red al intentar borrar los mensajes. Verifica tu conexión.";
                    statusDiv.classList.add('error');
                } finally {
                    statusDiv.style.display = 'block';
                    if (!response || !response.ok) {
                         vaciarBtn.disabled = false;
                         vaciarBtn.textContent = '🗑️ Vaciar todos los mensajes';
                    }
                }
            }

            if (vaciarBtn) {
                vaciarBtn.addEventListener('click', vaciarMensajes);
            }
        </script>
    </body>
    </html>
  `;

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "DELETE" && url.pathname === "/messages") {
      const authHeader = request.headers.get("Authorization");
      if (!checkAuth(authHeader, env)) {
        return new Response(JSON.stringify({ error: "No autorizado" }), {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Admin"',
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      }

      try {
        const info = await env.DB.prepare("DELETE FROM messages").run();
        if (info.success) {
          return new Response(
            JSON.stringify({ message: "Mensajes eliminados correctamente" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json; charset=utf-8" },
            }
          );
        } else {
          console.error("DB Delete operation reported not successful:", info);
          return new Response(
            JSON.stringify({
              error:
                "La operación de borrado en la base de datos no fue exitosa.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json; charset=utf-8" },
            }
          );
        }
      } catch (dbError) {
        console.error("DB Error deleting messages:", dbError);
        return new Response(
          JSON.stringify({
            error: "Error interno del servidor al intentar eliminar mensajes.",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    return new Response(
      `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Buzón Anónimo</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #121212;
                color: #e0e0e0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            }
    
            .container {
                background-color: #1e1e1e;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                width: 100%;
                max-width: 500px;
                text-align: center;
            }
    
            h1 {
                color: #bb86fc;
                margin-bottom: 25px;
                font-size: 2.5em;
            }
    
            textarea {
                width: calc(100% - 22px);
                padding: 10px;
                margin-bottom: 20px;
                border-radius: 4px;
                border: 1px solid #333; 
                background-color: #2c2c2c; 
                color: #e0e0e0; 
                font-size: 1em;
                resize: vertical; 
                min-height: 100px;
            }
    
            textarea::placeholder {
                color: #757575; 
            }
    
            button {
                background-color: #6200ee; 
                color: white;
                border: none;
                padding: 12px 25px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 1em;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s ease, transform 0.1s ease;
            }
    
            button:hover {
                background-color: #3700b3;
            }
    
            button:active {
                transform: scale(0.98);
            }
    
            .alert-custom {
                padding: 15px;
                margin-top: 20px;
                border-radius: 4px;
                color: #1e1e1e;
                background-color: #bb86fc;
                display: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📬 Buzón Anónimo</h1>
            <form id="anonymousForm" method="POST" action="/submit">
                <textarea id="msg" name="message" rows="5" cols="50" placeholder="Escribe tu mensaje anónimo aquí..."></textarea><br/>
                <button type="submit">Enviar Mensaje</button>
            </form>
            <div id="confirmationMessage" class="alert-custom" role="alert">
                ¡Gracias por tu mensaje! 💌
            </div>
        </div>
    
        <script>
            const form = document.getElementById('anonymousForm');
            const messageTextarea = document.getElementById('msg');
            const confirmationDiv = document.getElementById('confirmationMessage');
            const submitButton = form.querySelector('button[type="submit"]');
    
            async function enviarMensaje(event) {
                event.preventDefault();
                const mensaje = messageTextarea.value.trim();
    
                if (!mensaje) {
                    alert("Por favor, escribe un mensaje antes de enviar.");
                    messageTextarea.focus();
                    return;
                }
    
                submitButton.disabled = true;
                submitButton.textContent = 'Enviando...';
    
                try {
                    const response = await fetch("/submit", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ message: mensaje })
                    });

                    if (response.ok) {
                        confirmationDiv.textContent = "¡Gracias por tu mensaje! 💌";
                        confirmationDiv.style.display = 'block';
                        
                        messageTextarea.value = "";
                        setTimeout(() => {
                            confirmationDiv.style.display = 'none';
                        }, 4000);
    
                    } else {
                        confirmationDiv.textContent = "Error al enviar: " + response.statusText + ". Intenta de nuevo.";
                        confirmationDiv.style.backgroundColor = '#cf6679'; 
                        confirmationDiv.style.display = 'block';
                    }
    
                } catch (error) {
                    console.error("Error en la petición fetch:", error);
                    confirmationDiv.textContent = "Ocurrió un error de red. Por favor, intenta más tarde.";
                    confirmationDiv.style.backgroundColor = '#cf6679';
                    confirmationDiv.style.display = 'block';
                } finally {
                    // Rehabilitar el botón
                    submitButton.disabled = false;
                    submitButton.textContent = 'Enviar Mensaje';
                }
            }
    
            form.addEventListener('submit', enviarMensaje);
        </script>
    </body>
    </html>
    `,
      { headers: { "Content-Type": "text/html" } }
    );
  },
};
