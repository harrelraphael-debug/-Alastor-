import fs from 'fs'

const quizGames = new Map()
const USED_PATH = './database/used_quizz.json'

// BANQUE QCM ILLIMITÉE - ajoute autant que tu veux
const DB = [
  {
    q: "Qui est le rival de Naruto?",
    options: ["Sasuke", "Sakura", "Kakashi", "Jiraya"],
    correct: 0, // 0=A, 1=B, 2=C, 3=D
    a: ["sasuke"]
  },
  {
    q: "Qui est le capitaine des Mugiwaras?",
    options: ["Zoro", "Luffy", "Sanji", "Nami"],
    correct: 1,
    a: ["luffy"]
  },
  {
    q: "Qui est le héros de SNK?",
    options: ["Levi", "Eren", "Armin", "Mikasa"],
    correct: 1,
    a: ["eren"]
  },
  {
    q: "Qui porte Nezuko dans sa boite?",
    options: ["Zenitsu", "Inosuke", "Tanjiro", "Giyu"],
    correct: 2,
    a: ["tanjiro"]
  },
  {
    q: "Qui est le plus fort exorciste aux yeux bandés?",
    options: ["Yuji", "Gojo", "Megumi", "Sukuna"],
    correct: 1,
    a: ["gojo","satoru"]
  },
  {
    q: "Qui tue en un coup?",
    options: ["Genos", "Saitama", "【entity-Garou¦canonical_name=Garou】", "King"],
    correct: 1,
    a: ["saitama"]
  },
  {
    q: "Quel est le fruit de Luffy?",
    options: ["Mera Mera", "Gomu Gomu", "Ope Ope", "Gura Gura"],
    correct: 1,
    a: ["gomu","gum"]
  },
  {
    q: "Qui est Kira dans Death Note?",
    options: ["L", "Light", "Near", "Mello"],
    correct: 1,
    a: ["light","kira"]
  },
]

function loadUsed(){ try{ if(fs.existsSync(USED_PATH)) return JSON.parse(fs.readFileSync(USED_PATH,'utf-8')) }catch{} return [] }
function saveUsed(l){ fs.writeFileSync(USED_PATH, JSON.stringify(l.slice(-500))) }

function getQuestions(n){
  let used = loadUsed()
  let dispo = DB.filter(x=>!used.includes(x.q))
  if(dispo.length < n){ dispo = DB; saveUsed([]) }
  return dispo.sort(()=>Math.random()-0.5).slice(0,n)
}

async function ask(client, remoteId, game){
  if(game.current >= game.total){
    let classer = [...game.scores.entries()].sort((a,b)=>b[1]-a[1])
    let txt = `*🏁 FIN QUIZZ QR [${game.total}]*\n\n`
    if(classer.length==0) txt+=`Personne n'a marqué`
    else {
      txt+=`*📊 CLASSEMENT:*\n\n`
      classer.forEach(([jid,pts],i)=>{
        let med = i==0?"🥇":i==1?"🥈":i==2?"🥉":`${i+1}.`
        txt+=`${med} @${jid.split('@')[0]} ➔ ${pts} pts\n`
      })
      txt+=`\n*🎉 Félicitations @${classer[0][0].split('@')[0]} tu as ${classer[0][1]} points!*`
    }
    saveUsed([...loadUsed(),...game.questions.map(q=>q.q)])
    await client.sendMessage(remoteId, { text: txt, mentions: classer.map(c=>c[0]) })
    quizGames.delete(remoteId)
    return
  }

  let q = game.questions[game.current]
  game.current++
  game.answered=false

  let lettres = ["A","B","C","D"]
  let optionsText = q.options.map((opt,i)=>`${lettres[i]}) ${opt}`).join('\n')
  let bonneLettre = lettres[q.correct]

  await client.sendMessage(remoteId, {
    text: `*🎌 QUIZZ QR [${game.current}/${game.total}]*\n\n❓ ${q.q}\n\n${optionsText}\n\n💡 Tape ${bonneLettre} ou le nom\n💰 10 pts | ⏳ 2 min`
  })

  game.currentCorrectLetter = bonneLettre.toLowerCase()
  game.currentCorrectText = q.a

  game.timeout = setTimeout(()=>{
    if(!game.answered){
      client.sendMessage(remoteId, { text: `⏰ 2 min écoulées!\n*Réponse:* ${bonneLettre}) ${q.options[q.correct]}` })
      setTimeout(()=>ask(client, remoteId, game), 2000)
    }
  }, 120000)
}

export async function quizz_qr(client, message){
  const remoteId = message.key.remoteJid
  const raw = message.message?.extendedTextMessage?.text || message.message?.conversation || ""
  const txt = raw.toLowerCase().trim()

  if(txt.startsWith('stop quizz qr') || txt.startsWith('.stop quizz qr')){
    if(quizGames.has(remoteId)){ clearTimeout(quizGames.get(remoteId).timeout); quizGames.delete(remoteId) }
    return client.sendMessage(remoteId, { text: "*🛑 Quizz arrêté.*" })
  }

  let m = txt.match(/^(?:\.|!)?quizz\s*qr\s*(\d+)?/)
  if(m){
    if(quizGames.has(remoteId)) return client.sendMessage(remoteId, { text: "*Quizz déjà en cours*" })
    let total = parseInt(m[1]) || 10
    let questions = getQuestions(total)
    quizGames.set(remoteId, { questions, current:0, total, scores:new Map(), answered:false, timeout:null })
    await client.sendMessage(remoteId, { text: `*QUIZZ QR LANCÉ!* ${total} QCM - 10 pts/question - Départ 3s...` })
    setTimeout(()=>ask(client, remoteId, quizGames.get(remoteId)), 3000)
    return true
  }

  if(quizGames.has(remoteId)){
    let game = quizGames.get(remoteId)
    if(game.answered) return false
    if(raw.length>30) return false // évite de compter les longues phrases

    let lettre = txt[0] // prend juste A, B, C, D
    let isLettreCorrect = lettre === game.currentCorrectLetter
    let isTexteCorrect = game.currentCorrectText.some(a=>txt.includes(a))

    if(isLettreCorrect || isTexteCorrect){
      game.answered=true
      clearTimeout(game.timeout)
      let sender = message.key.participant || message.key.remoteJid
      let sc = (game.scores.get(sender)||0)+10
      game.scores.set(sender, sc)
      let cur = game.questions[game.current-1]
      await client.sendMessage(remoteId, {
        text: `✅ @${sender.split('@')[0]} +10 pts! Réponse: ${game.currentCorrectLetter.toUpperCase()}) ${cur.options[cur.correct]} (Total: ${sc} pts)`,
        mentions:[sender]
      })
      setTimeout(()=>ask(client, remoteId, game), 2000)
      return true
    }
  }
}