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

    console.log(`Recebendo: ${m.from} -> ${m.content}`);


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

      if(m.type == "application/vnd.lime.location+json"){
        console.log("LOCALIZACAO OBTIDA");

        bd[m.from].userInfo.lat = m.content.latitude;
        bd[m.from].userInfo.lng = m.content.longitude;

        geocoder.reverse({lat:bd[m.from].userInfo.lat, lon:bd[m.from].userInfo.lng}).then(function(res) {
          bd[m.from].userInfo.city = res.city;
          bd[m.from].userInfo.address = res.formattedAddress;
          
        })
        .catch(function(err) {
          console.log(err);
        });
      }else{
        replyMessage(m.from);
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
  console.log('replyMessage');

  let state = bd[user];

  console.log("STATE: "+state.action);

  if(state.actor == ACTOR_USER){
    console.log("User");
    switch (state.action) {
      case 'init':
        sendTextMessage(WELCOME.replace("#NOME#",state.userInfo.resource.fullName),user,"getLocation");
        break;
      case 'getLocation':
        console.log('getLocation');

        client.sendMessage({
              "id": Lime.Guid(),
              "to": user,
              "type": "application/vnd.lime.document-select+json",
              "content": {
                  "scope": "immediate",
                  "header": {
                      "type": "text/plain",
                      "value": "Para uma melhor experiência, compartilhe sua localização atual para que lhe informe os alertas de sua região"
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
        
        break;
      case 'tksLocation':
        console.log("tks location");
        sendTextMessage(LOCATIONQUESTION.replace("#CIDADE#",state.userInfo.city),user,"blah")
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


function setStatus(user,action){
  bd[user].actor = ACTOR_USER;
  bd[user].action = action;
  // console.log(bd[user]);
}

