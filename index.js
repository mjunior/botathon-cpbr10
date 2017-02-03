/* eslint-disable no-console */
'use strict';

let Lime = require('lime-js');
let WebSocketTransport = require('lime-transport-websocket');
let MessagingHub = require('messaginghub-client');
let request = require('request-promise');
let NodeGeocoder = require('node-geocoder');
 
let options = {
  provider: 'google',
  // Optional depending on the providers 
  httpAdapter: 'https', // Default 
  apiKey: 'AIzaSyCORWu-uTguiEdLaTvsFu74TPvmYE2fNrA', // for Mapquest, OpenCage, Google Premier 
  formatter: null         // 'gpx', 'string', ... 
};
 
var geocoder = NodeGeocoder(options);

// These are the MessagingHub credentials for this bot.
// If you want to create your own bot, see http://blip.ai
const IDENTIFIER = 'maddie2cpbr10';
const ACCESS_KEY = 'RHVFUGpxREJtVU9uTnR6a2s4TE8=';
const API_ENDPOINT = 'http://randomword.setgetgo.com/get.php';
const ACTOR_USER = "User";

//MESSAGES BOT
const WELCOME = "Obrigado #NOME#, milhares de pessoas ficam contentes com você aqui."
const LOCATIONQUESTION = "Vejo que você é de #CIDADE#, deseja receber alertas sobre desaparecimentos nesta região ?";
// instantiate and setup client
let client = new MessagingHub.ClientBuilder()
    .withIdentifier(IDENTIFIER)
    .withAccessKey(ACCESS_KEY)
    .withTransportFactory(() => new WebSocketTransport())
    .build();

let bd = {};

client.addMessageReceiver(() => true, (m) => {
    console.log(m);
    //Chegou mensagem
    console.log(`Recebendo: ${m.from} -> ${m.content}`);
    //É a primeira do usuario ???
    if (bd[m.from] == undefined || m.content == "Iniciar"){
      let fqdn = m.from.split('@')[1];
      let iduser = m.from.split('@')[0];

      let getNomeJson = {  
        id: Lime.Guid(),
        to: "postmaster@"+fqdn,
        method: "get",
        uri: "lime://"+fqdn+"/accounts/"+iduser
      }

      client.sendCommand(getNomeJson).then(function(userInfo){
        bd[m.from] = {userInfo:userInfo }
        setStatus(m.from,"init");
        replyMessage(m.from);
      })

    }else{
      //Não é a primeira ....
      // é uma localizaçaõ ?


      switch(m.type){
        case 'application/vnd.lime.location+json':
            console.log("Message Type Location");
            bd[m.from].userInfo.lat =  m.content.latitude
            bd[m.from].userInfo.lng = m.content.longitude
            console.log("***");

            geocoder.reverse({lat:bd[m.from].userInfo.lat, lon:bd[m.from].userInfo.lng}).then(function(res) {
           
              bd[m.from].userInfo.city = res[0].city;
              bd[m.from].userInfo.address = res[0].formattedAddress;

              //apenas depois de obter a cidade
              replyMessage(m.from);
              
            }).catch(function(err) {
              console.log(err);
            });
          break;

        case 'text/plain':
          console.log("PLAIN: "+bd[m.from].action);
          switch(bd[m.from].action){
            case 'tksLocation':
              checkTksLocation(m);
              break;
            case 'waitingFrequency':
              console.log('&&&&&&&&');
              checkWaitingFrequency(m);
              break;
            default:
              replyMessage(m.from);
          }

          break;

        default:
          replyMessage(m.from);
          break;
      }
    }
});

// connect to the MessagingHub server
client.connect()
    .then(() => console.log('Listening...'))
    .catch((err) => console.error(err));

// analytics helper functions
function registerAction(resource) {
    return client.sendCommand({
        id: Lime.Guid(),
        method: Lime.CommandMethod.SET,
        type: 'application/vnd.iris.eventTrack+json',
        uri: '/event-track',
        resource: resource
    })
    .catch(e => console.log(e));
}


function replyMessage(user){
  let state = bd[user];
  console.log("STATE: "+state.action);

  if(state.actor == ACTOR_USER){
    switch (state.action) {
      case 'init':
        sendTextMessage(WELCOME.replace("#NOME#",state.userInfo.resource.fullName),user,"getLocation");
        setTimeout(function(){
          sendGetLocationMessage("Para uma melhor experiência, compartilhe comigo sua localização ?",user,"tksLocation")
        }, 1000);
        break;
      case 'getLocation':
        console.log('nothing');
        break;
      case 'tksLocation':
        let menu = [{
                "order":1,
                "text":"Sim"
              },
              {
                "order":2,
                "text":"Quais alertas?"
              }]
        sendQuickReply(LOCATIONQUESTION.replace("#CIDADE#",state.userInfo.city),menu,user,"blah")
        break;
      default:
        sendTextMessage("tchau!",user,"tche");  
        break;
    }
  }else{
    //bot 
  }

}

function sendTextMessage(msg,user,next_action){
  let message = {
    id: Lime.Guid(),
    type: 'text/plain',
    content: msg,
    to: user
  };
  // console.log(`Enviando TXT: ${message.to}: ${message.content}`);
  client.sendMessage(message);
  client.addNotificationReceiver("consumed", function(notification) {
    setStatus(user,next_action);
  });
}

function sendGetLocationMessage(msg,user,next_action){
  client.sendMessage({
    "id": Lime.Guid(),
    "to": user,
    "type": "application/vnd.lime.document-select+json",
    "content": {
        "scope": "immediate",
        "header": {
            "type": "text/plain",
            "value": msg
        },
        "options": [
            {
              "label": {
                  "type": "application/vnd.lime.input+json",
                  "value": {                      
                      "validation": {
                        "rule": "type",
                        "type": "application/vnd.lime.location+json"
                      } 
                  }
              }
            }
        ]
    }
  });

  client.addNotificationReceiver("consumed", function(notification) {
    setStatus(user,next_action);
  });
}




function sendQuickReply(msg,options,user,next_action){
  client.sendMessage({
    "id":"311F87C0-F938-4FF3-991A-7C5AEF7771A5",
    "to": user,
    "type":"application/vnd.lime.select+json",
    "content":{
        "text": msg,
        "options":options
      }
    });




  // client.addNotificationReceiver("consumed", function(notification) {
  //   setStatus(user,next_action);
  // });
}

function checkTksLocation(m){
  if(m.content = '1'){
    console.log("--> Receber Logs <--");
    let menu = [{
        "text":"Diariamente"
      },
      {
        "text":"Semanalmente"
      }]
    sendQuickReply("Qual seria a frequência ideal para receber os alertas?",menu,m.from,"blah");
    setStatus(m.from,"waitingFrequency")
  }else{
    console.log('--------------------> Explicar alertas');
  }
}

function checkWaitingFrequency(m){
  if(m.content = 'Diariamente'){
    console.log("Alerta ---> Todos os dias");
  }else{
    console.log("Alerta ---> Uma vez por semana");
  }
}


function setStatus(user,action){
  bd[user].actor = ACTOR_USER;
  bd[user].action = action;
  console.log("STATE ALTERADO: "+action);
}

