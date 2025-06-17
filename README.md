# Buzón Anónimo

![image](https://github.com/user-attachments/assets/157b9403-0c46-4805-afcf-288e0c0ddc5c)
![Screenshot_20250617_150308](https://github.com/user-attachments/assets/aa59e6c5-3219-4591-96ac-2cdd87522758)


Este proyecto es un buzón anónimo para enviar mensajes. Los usuarios pueden enviar mensajes de forma anónima, y el administrador puede leerlos y eliminarlos usando una contraseña. Además, cada mensaje recibido se reenvía automáticamente a un chat de Telegram usando un bot.

## Características

- Envío de mensajes anónimos.
- Panel de administración protegido por contraseña para leer y borrar mensajes.
- Reenvío automático de los mensajes a Telegram mediante un bot.

## Variables de entorno

Para que el sistema funcione correctamente, es necesario configurar las siguientes variables de entorno (se recomienda almacenarlas como secretos):

- `ADMIN_PASSWORD`: Contraseña de administrador para acceder y gestionar los mensajes.
- `BOT_TOKEN`: Token del bot de Telegram que enviará los mensajes.
- `CHAT_ID`: ID del chat de Telegram donde se enviarán los mensajes.

## Uso

1. Clona el repositorio.
2. Configura las variables de entorno mencionadas anteriormente.
3. Ejecuta la aplicación siguiendo las instrucciones específicas para tu entorno.
