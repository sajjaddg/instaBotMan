const { createClient } = require('@supabase/supabase-js');
const { IgApiClient } = require('instagram-private-api');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const https = require('https');
const fs = require("fs");
const NodeCache = require('node-cache');
const fetch = require('node-fetch');
const CronJob = require('cron').CronJob;
require('dotenv').config();



const ig = new IgApiClient();
const loggedInUser= null

const job = new CronJob('0 12 * * *',async function() {
  try{
    
    if (!loggedInUser)
      await loginInstagram()
    const myPost = await findImage()
    if(myPost)
      postImage(myPost.image.file_supbase_url,myPost.image.caption)
      addToPostedImage(myPost.image.id)
  } 
  catch{
    console.log('post nashod');
  }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPBASE_KEY)
const cache = new NodeCache();

const commands = [
  { command: 'tags', description: 'list of tags' },
  { command: 'newtag', description: 'type name of new tag after this commend' },
  { command: 'images', description: 'list of images' }

];

const password = process.env.BOT_PASSWORD;
const apiToken = process.env.BOT_API;

const bot = new TelegramBot(apiToken);
bot.setMyCommands(commands).then(() => {
  console.log('Commands have been set');
}).catch((err) => {
  console.log(err);
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
    if(msg.text?.includes('/newtag')){
      newTagProcess(chatId,msg)
    }
    if (msg.text === '/images') {
      imagesProcess(chatId)
    }
}
async function imagesProcess(chatid){
  findImage()
  let data = await getImages()
  data?.map((val)=>{
    const image = val.image
    bot.sendPhoto(chatid,image.file_supbase_url,{caption:image.caption})
  })

}
async function newTagProcess(chatId,msg){
  const regex = /\/newtag\s*(.*)/;
  const matches = msg.text.match(regex);
  const res = matches[1]
  const result = await createTag(res)
  bot.sendMessage(chatId,result?'تگ ساختیم':'ریدیم ک :_(')

}
async function tagProcess(chatId){

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
  })
  
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
      file_telegram_url: fileUrl,
      
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
            let fullCaption =createCaption(msg.text,tag.name) 
            photoData.caption =fullCaption
          }
          else{
            photoData.caption =createCaption('',tag.name)
          }
            try{
              let url = await addImageStorage(photoData.file_telegram_url,photoData.file_id)
              photoData.file_supbase_url=url;
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

async function loginInstagram(user){
  try{
    ig.state.generateDevice(process.env.INSTAGRAM_USER);
    loggedInUser = await ig.account.login(process.env.INSTAGRAM_USER,process.env.INSTAGRAM_PASSWORD);
    
  }
  catch(e){
    console.log(e);
  }
}

async function findImage(){
  const { data, error } = await supabase
    .from('Image')
    .select(
       `
        id , image , postedImage (imageId)
      `
      )
        
  const images = data.filter((image)=>{return image.postedImage.length ===0})
  images.sort((a,b)=>a.id>b.id)
  return images.length>0 ? images[0]:null
}
async function postImage(imagePath, caption) {
  const imageBuffer = await downloadImage(imagePath);
  const { upload_id } = await ig.publish.photo({
    file: imageBuffer,
    caption: caption,
  });
  return true
}
function createCaption(caption, tagName) {
  let fullCaption= `✨ \n${caption}\n`+`موضوع: ${tagName}.`
  return fullCaption
  
}
async function sortImageList(params) {
  
}

async function createTag(tagName){
  const { data, error } = await supabase
    .from('tags')
    .insert([
      { name: tagName},
    ])

  return error? false : true
}

async function getImages(){
  let { data, error } = await supabase
  .from('Image')
  .select('image')
  return data
}

async function addImageStorage(url, name){
  const baseUrl = 'https://gxthrwpinbsehjsctzkm.supabase.co/storage/v1/object/public/images/'
  const response = await fetch(url);
  const buffer = await response.buffer();
  const filename = `${name}.jpg`; // Set filename with extension
  const { data, error } = await supabase.storage.from('images').upload(filename, buffer, {
    cacheControl: '3600', // Optional cache control metadata
    upsert: true, // Optional upsert flag
    contentType: 'image/jpeg', // Optional content type
    contentEncoding: 'base64', // Optional content encoding
    duplex: true, // Required duplex flag
  });
  if (error) {
    console.log('Error uploading image:', error.message);
    return;
  }
  console.log(baseUrl,data.path);
  return `${baseUrl}${data.path}`
}
async function downloadImage(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer'
  });
  const buffer = Buffer.from(response.data, 'binary');
  return buffer;
}
async function addToPostedImage(imageId){
  const { data, error } = await supabase
  .from('postedImage')
  .insert([{ imageId: imageId}])


}

job.start()
bot.startPolling();

