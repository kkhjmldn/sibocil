const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');
const socketIO = require('socket.io');
const http = require('http');
const dateformat = require('dateformat')

// file config
const SESSION_FILE_PATH = ('./session.json');
console.log(SESSION_FILE_PATH)
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}

//database 
var mysql = require('mysql')

var con = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: '',
	database : 'wa_bot_bnnk'
})

con.connect(function(err) {
	if (err) throw err;
	console.log("DATABASE Connected!");
})

// initial instance
const PORT = process.env.PORT || 8000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const client = new Client({
  restartOnAuthFail: true,
  authStrategy : new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
  },
  session: sessionCfg
});

// index routing and middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.get('/', (req, res) => {
  res.sendFile('index.html', {root: __dirname});
});



//Global Vars
var requestLength = 0

var mainMenu = ''

var question = ''

var requireMedia = 0

var defindedReply = ''

var prevQuestId = 0

var nextQuestId = 1

var questionId = 0

var lastQuestionId = 0

var chats = new Object();

const global = (0,eval)("this");

global.media = []


// socket connection
var today  = new Date();
var now = today.toLocaleString();
io.on('connection', (socket) => {
  socket.emit('message', `${now} Connected`);

  client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit("qr", url);
     // socket.emit('message', `${now} QR Code received`);
    });
  });

  client.on('ready', () => {
    console.log('clien ready')
    socket.emit('message', `${now} WhatsApp is ready!`);
  });

  client.on('authenticated', (session) => {
    console.log(session)
    socket.emit('message', `${now} Whatsapp is authenticated!`);
    sessionCfg = session;
    // fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err) {
    //   if (err) {
    //     console.error(err);
    //   }
    // });
  });

  client.on('auth_failure', function(session) {
    socket.emit('message', `${now} Auth failure, restarting...`);
  });

  //the Bot's App
  client.on('message', async  message => {

    if (message.body.toLowerCase().includes('cetak#')) {
      var bulan = 0
      var mess = message.body.split('#')
  
      bulan = mess[1]
  
      makeExcel(bulan)
    }
    
    else if (message.body.toLowerCase().includes('status#')) {
  
      var mess = message.body.split('#')
  
      var id = mess[1]
  
      con.query(`SELECT a.id,a.from_wa_no,b.status FROM  requests a LEFT JOIN report_status b ON a.status_id = b.id WHERE a.id = '${id}'  `, (err1,rows1) => {
  
        if (err1) {
  
          client.sendMessage(message.from, `Terjadi kesalahan. silakan ulangi lagi dalam 30 menit` )
          console.log(err1)
        }	
  
        else {
  
          if (rows1.length > 0) {
  
            if (rows1[0].from_wa_no === message.from.replace('@c.us','')) {
  
              client.sendMessage(message.from, `Status Laporan Anda adalah *${rows1[0].status}* ` )
  
            }else {
  
              client.sendMessage(message.from, `Maaf, laporan tersebut bukan milik Anda. Silakan masukkan kode laporan Anda dengan benar.`)
  
            }
  
          }else {
  
            client.sendMessage(message.from, `Laporan tidak ditemukan.`)
  
          }
  
        }
  
  
      }) 
  
    } else if (message.body.toLowerCase().includes('update#')) {
  
      var mess = message.body.split('#')
  
      var id = mess[1]
  
      var status_id = mess[2]
  
  
      var data = {
        status_id : status_id,
        created_at: dateformat('yyyy-mm-dd H:MM:ss')
      }
  
      updateRequestStatus(data,id, client,message)
  
    } else if (message.body.toLowerCase() === ('menu')) {
  
      questionId = 0
  
      global.startMessage = ''
  
      global.endMessage = ''
  
      global.media = []
  
      newQuestion(con, client, message)
      
      global.startMessage = dateformat('yyyy-mm-dd H:MM:ss');	
  
    }
  
    else if (message.body.toLowerCase() === ('selesai')) {
      console.log('id ques ='+questionId)
      global.endMessage = dateformat('yyyy-mm-dd H:MM:ss')
  
      const startMessage = global.startMessage
  
      const endMessage = global.endMessage
  
      var jml = 0
  
      con.query(`SELECT count(id) as jml FROM  requests WHERE MONTH(created_at) = '${dateformat('mm')}' AND YEAR(created_at) = '${dateformat('yyyy')}' `, (err, rows) => {
  
        
        if(rows.length > 0) {
  
          jml = rows[0].jml
  
        }
  
        var section_id = ''
  
        var month = dateformat('mm')
  
        var kode = ''
  
        con.query(`SELECT id, section_id, next_quest_id,question FROM  questions WHERE id = ${questionId} `, (err1,rows1) => {
  
          if(rows1.length > 0) {
            section_id = rows1[0].section_id
          }
          console.log(`start message ${global.startMessage}`)
          console.log(`end message ${global.endMessage}`)
          con.query(`SELECT a.id, 
            b.section_id, b.question,b.label,
            a.chat, a.attachment FROM  chats a 
            LEFT JOIN questions b ON a.question_id = b.id
            WHERE a.from_wa_no = '${message.from.replace('@c.us','')}' 
            AND a.created_at BETWEEN '${global.startMessage}' AND '${global.endMessage}' `, (e,rowsChats) => {
  
              if (e) {
  
                console.log(e)
  
              }else{
                var msg= ''
                var i = 0
                rowsChats.map( (data,j) => {
                  if (data.label !== null) {
                    msg += `${data.label} : ${data.chat}\n`
                    i = j
                  }								
  
                })								
                //console.log(rowsChats)
                var data = {
                  id : rowsChats[i].section_id+(dateformat('yy'))+padLeadingZeros(month, 3)+padLeadingZeros((jml+1), 4),
                  from_wa_no : message.from.replace('@c.us',''),
                  main_menu_id : rowsChats[0].chat,
                  status_id : 1,
                  chat : msg,
                  created_at: dateformat('yyyy-mm-dd H:MM:ss')
                }
                          
                saveRequest(data,client, message, rowsChats[i].section_id) 
                
                global.startMessage = ''
                global.endMessage = ''
              }
  
            })		
  
        })
      })
    
  
    }
    else {
  
      con.query(`SELECT a.id, 
        a.question_id, 
        a.created_at,b.require_media,b.defined_reply FROM chats a
        LEFT JOIN questions b ON a.question_id = b.id
        WHERE a.from_wa_no = '${message.from.replace('@c.us','')}' ORDER BY a.created_at DESC LIMIT 1` , (err,rows) => {
          
          if (rows.length < 1 ) { 
            global.startMessage = dateformat('yyyy-mm-dd H:MM:ss');
            newQuestion(con, client, message);										
  
          } else  {	
            lastQuestionId = rows[0].question_id	
  
            requireMedia = rows[0].require_media
  
            defindedReply = rows[0].definded_reply
            
            if (requireMedia) {
              if (!message.hasMedia) {
                client.sendMessage(message.from, `Pesan yang Anda masukkan salah, silakan ulangi` )
              }
            }
            if (requireMedia) {console.log('ini pesan media pada id no = '+lastQuestionId)}
  
            if ((Math.round((new Date().getTime() - new Date(dateformat(rows[0].created_at,'yyyy-mm-dd H:MM:ss')).getTime() )/ (1000 * 60) ) > 30 ) ) {
            
              newQuestion(con, client, message);				
            
            } else {	
  
              
              if(lastQuestionId === 0 || questionId === 1 ){
                global.startMessage = dateformat('yyyy-mm-dd H:MM:ss');
                nextQuestId = 1
                
                if (message.body === '1' || message.body === '2'  || message.body === '3'  || message.body === '4'  || message.body === '5') { 
  
                  (function () { con.query(`SELECT id,next_quest_id, question FROM  questions WHERE id = '${parseInt(message.body) + 1}' `, (err0,rows0) => {
  
                    if (rows0.length > 0 ) {
  
                      question = rows0[0].question	
  
                      questionId = rows0[0].id  
  
                      nextQuestId = rows0[0].next_quest_id	
  
                      client.sendMessage(message.from, `${question}` )	
  
                    }		
  
                  } ) 
  
                })(); 
  
              }else {
  
                questionId = 0
  
                client.sendMessage(message.from, `Pesan yang Anda masukkan salah, silakan ulangi` )
  
                newQuestion(con, client, message)
  
              }		
            }		
  
            else{
              
  
              (function() { con.query(`SELECT id, 
                next_quest_id, require_media, defined_reply, question FROM  questions WHERE id = ${nextQuestId} `, (err1,rows1) => {
  
                  if (err1) {
  
                    client.sendMessage(message.from, `Terjadi kesalahan. silakan ulangi lagi dalam 30 menit` )
                    console.log(err1) 
                  }								
   
                  if (rows1.length > 0) { 
  
                    question = rows1[0].question										
                  
                    nextQuestId = rows1[0].next_quest_id 
                  
                    client.sendMessage(message.from, `${question}` )
  
                    questionId = rows1[0].id
                     
  
                  }else {				
  
                    client.sendMessage(message.from, `Kirim *SELESAI* untuk menyimpan laporan Anda.Jika tidak maka kami tidak bisa menindak lanjuti.
                      \nAtau kirim *MENU* untuk kembali ke menu utama.` )
                  }
  
                })
  
            })();
          }
  
        }
  
      }
  
    }) 
  
    }
  
    var attachment = ''
  
    if  (message.hasMedia) {
      const att = await message.downloadMedia()
      global.media.push(att)
    }
  
    var data = {
      from_wa_no : message.from.replace('@c.us',''),
      chat : message.body,
      attachment : '',//attachment,
      question_id : questionId,
      created_at: dateformat('yyyy-mm-dd H:MM:ss')
    }
  
    saveChat(data)
    
  },function(){
    console.log('error')
  });

  client.initialize().catch(ex => {});

  client.on('disconnected', function() {
    // socket.emit('message', `${now} Disconnected`);
    // if (fs.existsSync(SESSION_FILE_PATH)) {
    //   fs.unlinkSync(SESSION_FILE_PATH, function(err) {
    //     if(err) return console.log(err);
    //     console.log('Session file deleted!');
    //   });
    //   client.destroy();
    //   client.initialize();
    // }
  });
});


const newQuestion = (con, client, message) => {
	getMainMenu();

	(function(){		

		con.query(`SELECT id,question FROM  questions WHERE id = ${1} `,   (err0,rows0) => {

			question = rows0[0].question
			
			questionId = rows0[0].id
			try{
				client.sendMessage(message.from, `${question}\n${mainMenu}` )		
			} catch(e) {
				console.log('error')
			}	

		}) 

	})();
}

function saveChat(data) {

	con.query(`INSERT INTO chats SET ? `, data , (err0,rows0) => {

		if(err0) console.log(err0);

	})
	

}

function updateRequestStatus(data,id, client,message) {

	con.query(`UPDATE requests SET ? WHERE id = ? `, [data,id] , (err0,rows0) => {

		if(err0){

			client.sendMessage(message.from, `Gagal update!` )

		}else {

			client.sendMessage(message.from, `Sukses update ${id}!` )

		}
	})
	

}

function saveRequest(data,client, message, section_id) {
	
	con.query(`INSERT INTO requests SET ? `, data , (err0,rows0) => {

		if(err0){

			console.log( `Gagal menyimpan!` )
			console.log(err0)

		}else {

			client.sendMessage(message.from, `Terima kasih. Laporan Anda telah kami daftarkan dengan kode ${data.id}.\nAnda dapat memeriksa status laporan Anda dengan mengirimkan *STATUS#${data.id}*.` )
			
			con.query(`SELECT id, pic_wa_no FROM  sections WHERE id = ${section_id} `,  (err,rows) => {

				if (rows.length > 0 ) {		

					client.sendMessage(rows[0].pic_wa_no+'@c.us',`=== LAPORAN #${data.id} === \n${data.chat}\nAnda dapat mengubah STATUS laporan dengan mengirim *UPDATE#${data.id}#DIIKUTI NOMOR PERINTAH STATUS*\n\n2 : Untuk status *DIPROSES*\n3 : untuk status *SEDANG DITINDAKLANJUTI*\n4 : untuk status *DITOLAK*\n5 : untuk status *SELESAI DITINDAKLANJUTI*\n====== END ======`)
					
					global.media.map(media => {
								
						client.sendMessage(rows[0].pic_wa_no+'@c.us', media)

					}) 

					global.media = []
				}		

			} ) 

		}	

	})	

}

function getMainMenu() {

	mainMenu = '';

	(function(){			

		con.query(`SELECT id,caption FROM  main_menu`, (err1,rows1) => {

			rows1.map( (data) => {

				mainMenu += `${data.id}. ${data.caption}\n`

			})	
		})

	})();
	//console.log(mainMenu)
}

function padLeadingZeros(num, size) {
	var s = num+"";
	while (s.length < size) s = "0" + s;
	return s;
}

// send message routing
app.post('/send', (req, res) => {
  const phone = req.body.phone;
  const message = req.body.message;

  client.sendMessage(phone, message)
    .then(response => {
      res.status(200).json({
        error: false,
        data: {
          message: 'Pesan terkirim',
          meta: response,
        },
      });
    })
    .catch(error => {
      res.status(200).json({
        error: true,
        data: {
          message: 'Error send message',
          meta: error,
        },
      });
    });
});

server.listen(PORT, () => {
  console.log('App listen on port ', PORT);
});