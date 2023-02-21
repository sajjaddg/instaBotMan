const { createClient } = require('@supabase/supabase-js');
const Instagram = require('instagram-web-api')
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const fs = require("fs");
const NodeCache = require('node-cache');
const { log } = require('console');

const supabase = createClient('https://gxthrwpinbsehjsctzkm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dGhyd3BpbmJzZWhqc2N0emttIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzY0NDAzMjcsImV4cCI6MTk5MjAxNjMyN30.SavcbPmUNQRiTQ3x3xSBE6KQ2chmwEiV5i82Hm_XBtc')
const cache = new NodeCache();

const commands = [
  // { command: 'start', description: 'Start the bot' },
  // { command: 'help', description: 'Get help with the bot' },
  { command: 'tags', description: 'list of tags' }

];

const password = 'sajjaddg'
const apiToken = "6116925633:AAHhsrPsfrA-o1kF0zJkzBc5AZTdraev-7Q"
// const client = new Instagram({ username, password })
const bot = new TelegramBot(apiToken);
bot.setMyCommands(commands).then(() => {
  console.log('Commands have been set');
}).catch((err) => {
  console.error(err);
});

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    if (!password) {
      // If no password is set, allow all users to access the bot
      // You may want to add some additional validation here to ensure that the password is not null or empty
      processMessage(chatId,msg);
    } else if (cache.get(chatId) === password) {
      // If the user is already authenticated, allow them to access the bot
      processMessage(chatId,msg);
    } else if (msg.text === password) {
      // If the user entered the correct password, store their ID in the cache and allow them to access the bot
      bot.sendMessage(chatId, 'vard shodi :)');
      cache.set(chatId, password);
      processMessage(chatId,msg);
    } else {
      // If the user entered an incorrect password, send them a message informing them that access is denied
      bot.sendMessage(chatId, 'Access denied.');
    }
});

function processMessage(chatId,msg) {
    console.log(msg);
    if(msg.text ==='/tags'){
      tagProcess(chatId,msg)
    }
    if(msg.photo){
      imageProcess(chatId,msg)
    }
}

async function tagProcess(chatId,msg){

  const data = await getTags()
  data?.forEach(element => {
    const opts = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'تغیر اسم', callback_data: `${"1"+","+element.id}` }],
          [{ text: 'حذف', callback_data: `${"2"+","+element.id}` }],
        ]
      }
    };
    bot.sendMessage(chatId,element.name,opts)
  });
}


async function removeTag(chatId,tagId){
  const { error } = await supabase
  .from('tags')
  .delete()
  .eq('id', tagId)
  if(!error){
    bot.sendMessage(chatId,`tag with id: ${tagId} deleted :)`)
  }
}


bot.on('callback_query', (query) => {
  console.log(query);
  const chatId = query.message.chat.id;
  const option = query.data.split(',');
  console.log(option);
  if(option[0]==='2'){
    removeTag(chatId,option[1])
  }
});


async function imageProcess(chatId,msg){
  const tags = await getTags()
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  let photoData = await bot.getFileLink(fileId).then((fileUrl) => {
     return {
      file_id: fileId,
      file_url: fileUrl,
      
    };
  })
  let keyboard = [];
  keyboard=tags.map((tag)=> [...keyboard,{text:tag.name}])
  bot.sendMessage(chatId, 'مربوط به کدوم تگه؟', {
    reply_markup: {
      force_reply: true,
      keyboard:keyboard,
      resize_keyboard: true,
      one_time_keyboard: true
    }
  }).then(()=>{
    bot.once('message', async (msg) => {
      const tag = tags.find((tag)=>tag.name=== msg.text)
      if(tag){
       bot.sendMessage(chatId,'caption dari?').then(async ()=>{
        bot.once('message',async (msg)=>{
          if(msg.text !=='no'){
            photoData.caption = msg.text 
          }
            try{
              await addImage(tag.id,photoData)
              bot.sendMessage(chatId,'raft tosh :)')
            }
            catch{
              bot.sendMessage(chatId,'nraft tosh k :(')
            }
        })
       })
       
      }
      else(
        bot.sendMessage(chatId,'tag pida nashod')
      )
    })
    
  });
  

}


async function getTags(){
  let { data, error } = await supabase
  .from('tags')
  .select()
  if(!error)
    return data
}

async function addImage(tagId,image){
  console.log(image);
  try{
    const { data, error } = await supabase
    .from('Image')
    .insert([
      { tagId:tagId,image:image },
    ])
  
  }
  catch(e){
    console.log('error: ',e);
  }
  
 
}

bot.startPolling();

