//index.js
//kkhjmldn

const qrcode = require('qrcode-terminal')

const dateformat = require('dateformat')

const {Client, MessageMedia} = require('whatsapp-web.js')

const SESSION_FILE_PATH = './session.json';

const client = new Client();

var mysql = require('mysql')



client.on('qr', (qr) => {
	qrcode.generate(qr, {small : true})
})

client.on('ready', () => {
	console.log('client is ready')
})



var chats = new Object();

const global = (0,eval)("this");

global.media = []

client.on('message', async  message => {

	client.sendMessage(message.from, `Mohon maaf saat ini *SiBoCil* sedang dalam perbaikan.
	Anda tetap dapat memanfaatkan Media Sosial BNNK Cilacap untuk berinteraksi dengan kami.
	Instagram : @infobnn_kab_cilacap
	Facebook  : Humas BNNK Cilacap
	Twitter   : @infobnnkcilacap` )
	
})

client.initialize()