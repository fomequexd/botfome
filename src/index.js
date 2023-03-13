/* eslint no-undef: ["error", { "typeof": true }] */
// Require necesario para leer las variables de entorno del archivo .env
require('dotenv').config()
	// Instanciación de los objetos necesarios para crear un servidor local con Node.JS
const express = require('express')
const path = require('path')
const port = 25786
const app = express()
const chatDialogs = require('./json/chats')
const chistes = require('./json/chistes')
const suertes = require('./json/suertes')
	// Paquete para poder crear el bot de twitch que puede recibir los mensajes del chat
const tmi = require('tmi.js')

// Instanciación de los objetos necesarios para la comunicación por Sockets
const server = require('http').createServer(app)
const io = require('socket.io')(server)

// Vamos a utilizar Axios para acceder a la API de Twitch y poder obtener los link de los Emotes
const axios = require('axios').default

// Datos de la cuenta de Twitch que utilizaran como bot que se leen el .env
// Documentación https://dev.twitch.tv/docs/irc
const options = {
	options: {
		debug: true
	},
	connection: {

	},
	identity: {
		username: "usuario", // Nombre de usuario de la cuenta que se utilizara como bot
		password: "oauth:" // Se utiliza el oauth como contraseña
			// Para generar el oauth: https://twitchapps.com/tmi/
	},
	channels: [
    "usuario1",
    "usuario2",
		"usuario3" // Nombre de usuario de la cuenta en la que el bot leera el chat
	]
}

// Importa el archivo JSON con los chats para el bot

// Inicio server Node.JS
const iniciarServer = () => {
		server.listen(port, () => {
				console.log('El programa se esta ejecutando en el puerto: ' + port)
			})
			// Obtiene la ruta del directorio publico donde se encuentran los elementos estaticos (css, js).
		const publicPath = path.resolve(__dirname, '../public')
			// Para que los archivos estaticos queden disponibles.
		app.use(express.static(publicPath))

		app.get('/', function(req, res) {
			res.sendFile(__dirname + '../public/index.html')
		})
	}
	// Instanciamos el cliente de tmi (bot)
	/* eslint new-cap: ["error", { "newIsCap": false }] */
const client = new tmi.client(options)

// SOCKETS
// Funcion que envia por sockets los datos del ultimo mensaje del chat
const refreshFront = (username, msg) => {
		io.emit('username', username)
		io.emit('text', msg)
	}
	// Función que envia por sockets el mensaje a leer
const hablar = (username, msg) => {
		let mensaje
		if (msg === '') {
			mensaje = `Escribe algo,${username}`
		} else {
			mensaje = `${username} dice ${msg}`
		}
		io.emit('speak', `${mensaje}`)
	}
	// Función que envia por sockets el mensaje a leer
const leer = (msg) => {
		if (msg !== '') {
			io.emit('speak', `${msg}`)
		}
	}
	// Edita el mensaje del chat, para insertar los html necesario para agregar las imagenes de los emotes en los mensajes
const msgEdit = async(ctx, msg) => {
		if (ctx.emotes != null) {
			let msgEditado = msg
			for (const emote in ctx.emotes) {
				const linkEmote = (await getEmote(emote)).config.url
				const etiquetaEmote = `<img src="${linkEmote}" alt="emote">`

				for (const pos in ctx.emotes[emote]) {
					let inicio = 0
					let final = 0
					const posicion = ctx.emotes[emote][pos]
					inicio = posicion.split('-')[0]
					final = posicion.split('-')[1]
					const nameEmote = msg.substring(inicio, parseInt(final) + 1)
					msgEditado = msgEditado.replace(`${nameEmote}`, etiquetaEmote)
				}
			}
			return msgEditado
		} else {
			return msg
		}
	}
	// Función que accede a la API de Twitch
const getEmote = async(id) => {
	const apiURL = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/light/1.0`
	const res = await axios.get(apiURL)
	return res
}

// Función que simula la tirada de una dato
function rollDice() {
	const sides = 6
	return Math.floor(Math.random() * sides) + 1
}

function memide() {
	const sides = 21
	return Math.floor(Math.random() * sides) + 1
}
// Evento que se ejecuta cuando el bot se conecta al chat de Twitch
client.on('connected', () => {
		// Agregue el código que quiera que se ejecute en esta situación
	})
	// Evento que se ejecuta cuando se envia un mensaje en el chat
client.on('chat', async(target, ctx, message, seft) => {
	if (seft) return
	const mensaje = message.split(' ')
	const commandName = message.trim()
	if (commandName.substring(0, 1) === '!') {
		let msgRespuesta = chatDialogs[commandName]
		if (msgRespuesta !== undefined) {
			if (msgRespuesta.includes('&USER&')) {
				const msgOriginal = msgRespuesta.split('&')
				msgRespuesta = msgOriginal[0] + ctx.username + msgOriginal[2]
			}
			client.say(target, msgRespuesta)
		}
		if (commandName === '!dado') {
			const num = rollDice()
			client.say(target, '@' + ctx.username + ` Sacaste un ${num}`)
		}
		//if (commandName === '!memide') {
			//const num = memide()
			//client.say(target, '@' + ctx.username + ` Te mide ${num} cm`)
		//}
		if (mensaje[0] === 'Comando !speak no funcional') {
			const textoMensaje = message.replace(mensaje[0], '')
			hablar(ctx.username, textoMensaje)
		}
		if (mensaje[0] === '!chiste') {
			const longitud = Object.keys(chistes).length
			const numChiste = Math.floor(Math.random() * longitud)
			const chiste = chistes[numChiste]
			console.log(chiste)
			leer(chiste)
			client.say(target, chiste)
		}
		if (mensaje[0] === '!comoseramidia') {
			const longitud = Object.keys(suertes).length
			const numSuerte = Math.floor(Math.random() * longitud)
			const suerte = suertes[numSuerte]
			console.log(suerte)
			leer(suerte)
			client.say(target, "@" + ctx.username + " " + suerte)
		}
		if (ctx.username !== 'streamelements') {
			const mensajeTratado = await msgEdit(ctx, message)
			refreshFront(ctx.username, mensajeTratado)
		}
	}

	if (commandName === '!help' || commandName === '!command') {
		let comandos = ''

		Object.keys(chatDialogs).forEach(comando => {
			comandos += comando + ' - '
		})
		const ultimo = comandos.lastIndexOf(' - ')
		const comandosFijos = [' - !dado - !chiste - !comoseramidia - !help']
		comandos = comandos.substring(0, ultimo)
		client.say(
			target,
			'Los comandos disponibles son: ' + comandos + comandosFijos
		)
		console.log(target)
	}
})

client.on("ban", (channel, username, reason, userstate) => {
  client.say(channel, `${username} ha recibido un ban`)
});

client.on("timeout", (channel, username, reason, duration, userstate) => {
  client.say(channel, `${username} ha recibido un timeout de ${duration} segundos`)
});

client.on("raided", (channel, username, viewers) => {
    client.say(channel, `@${username} muchas gracias por tu raid`)
});

//client.on("join", (channel, username, self) => {
  //if (username !== "botfome" && username !== "lurxx" && username !== "nightbot" && username !== "streamelements" && username !== "streamlabs" && username !== "business_daddy" && username !== "creatisbot" && username !== "aliceydra" && username !== "commanderroot" && username !== "drapsnatt" && username !== "kattah" && username !== "gamers_and_streamers" && username !== "0niva" && username !== "discordstreamercommunity" && username !== "moobot") {
  //client.say(channel, `@${username} hola como estas`)
  //}
//});

// Inicia el server Node.JS
iniciarServer()
	// Conecta el cliente tmi (bot)
client.connect()