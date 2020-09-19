/*
  Dependencies
*/

const express = require('express')
const admin = require('firebase-admin')
const inspect = require('util').inspect
const Busboy = require('busboy')
const path = require('path')
const os = require('os')
const fs = require('fs')
const UUID = require('uuid-v4')

/*
  config - express
*/
const app = express()
const port = 3000

/*
  config -firebase
*/
let serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'quasagrams.appspot.com'
})

const db = admin.firestore()
const bucket = admin.storage().bucket()

/*
  endpoint - posts
*/

app.get('/posts', (request, response) => {
  response.set('Access-Control-Allow-Origin', '*')
  let posts = []

  // Lee datos - https://firebase.google.com/docs/firestore/quickstart#node.js_4
  db.collection('posts').orderBy('date', 'desc').get()
  .then((snapshot) => {
    snapshot.forEach((doc) => {
      console.log(doc.id, '=>', doc.data())
      posts.push(doc.data())
    })
    response.send(posts)
  })
  .catch((err) => {
    console.log('Error getting documents', err)
  })
})
/*
  endpoint - createPost
*/

app.post('/createPost', (request, response) => {
  response.set('Access-Control-Allow-Origin', '*')
  
  let uuid = UUID()
  var busboy = new Busboy({ headers: request.headers })
  let fields = {}
  let fileData = {}

  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype)
    // /tmp/12312312-12313.png
    let filepath = path.join(os.tmpdir(), filename)
    file.pipe(fs.createWriteStream(filepath))
    fileData = { filepath, mimetype }
  })

  busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
    fields[fieldname] = val
  })
  
  busboy.on('finish', function() {
    bucket.upload(
      fileData.filepath,
      {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: fileData.mimetype,
            firebaseStorageDownloadTokens: uuid
          }
        }
      },
      (err, uploadedFile) => {
        if(!err) {
          createDocument(uploadedFile)
        }
      }
    )

    function createDocument(uploadedFile) {
      db.collection('posts').doc(fields.id).set({
        id: fields.id,
        caption: fields.caption,
        location: fields.location,
        date: parseInt(fields.date),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${ bucket.name }/o/${ uploadedFile.name }?alt=media&token=${ uuid }`
      })
      .then(() => {
        response.send('Post added: ' + fields.id)
      })
    }
  })

  // en cloud functions
  // busboy.end(request.rawBody)
  request.pipe(busboy)
  
})


/*
  listen
*/
app.listen(process.env.PORT || 3000)