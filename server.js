'use strict';

const env = require('node-env-file')
const express = require('express')
const firebase = require('firebase')
const swaggerJSDoc = require('swagger-jsdoc')

const options = {
  swaggerDefinition: {
    info: {
      title: 'nlp-server',
      version: '1.0.0'
    },
    basePath: '/nlp-server'
  },
  apis: ['./server.js']
}

const swaggerSpec = swaggerJSDoc(options)

env(__dirname + '/.env')
const PORT = 8080
const FIREBASE_API_KEY = process.env.REACT_APP_FIREBASE_API_KEY
const FIREBASE_AUTH_DOMAIN = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN
const FIREBASE_URL = process.env.REACT_APP_FIREBASE_URL
const FIREBASE_STORAGE_BUCKET = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET
const FIREBASE_MESSAGING_SENDER_ID = process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID

const config = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  databaseURL: FIREBASE_URL,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID
}
firebase.initializeApp(config)

let examples = []

const app = express()
app.disable('etag')
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})
app.get('/', function (req, res) {
  res.send('NLP Server v1.0')
})
app.get('/api-docs.json', function (req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

/**
 * @swagger
 * /intents:
 *   get:
 *     description: Get the list of intents for a workspace.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: companyId
 *         description: id of company that owns the workspace
 *         in: query
 *         required: true
 *         type: string
 *       - name: workspaceId
 *         description: id of workspace that packages the intents
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Successful request
 *       500:
 *         description: Error fetching intents from Firebase
 */
app.get('/intents', function (req, res) {
  const companyId = req.query.companyId
  const workspaceId = req.query.workspaceId
  console.log('intents called using companyId [%s] and workspaceId [%s]', companyId, workspaceId)
  if (companyId && workspaceId) {
    const ref = firebase.database().ref(`data/companies/${companyId}/intents`)
    ref.limitToLast(900).once('value', (snapshot) => {
      const intentsObj = snapshot.val()
      const intents = Object.keys(intentsObj)
        .map((key) => intentsObj[key])
        .filter((int) => int.workspaces.hasOwnProperty(workspaceId))
        .map((int) => [int.id, int.name])
      res.json(intents)
    }, (err) => {
      console.error('Error fetching intents;', err)
      res.status(500).send({
        status: 500,
        message: 'Error fetching intents'
      })
    })
  } else {
    console.error('invalid params - use /intents?companyId=<>&workspaceId=<>')
    res.status(500).json({
      status: 500,
      message: 'invalid params - use /intents?companyId=<>&workspaceId=<>'
    })
  }
})

/**
 * @swagger
 * /intents/{intentId}/examples:
 *   get:
 *     description: Get the list of example utterances for an intent.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: companyId
 *         description: id of company that owns the workspace
 *         in: query
 *         required: true
 *         type: string
 *       - name: intentId
 *         description: id of intent that contains the examples
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Successful request
 *       500:
 *         description: Error fetching examples from Firebase
 */
app.get('/intents/:intentId/examples', function (req, res) {
  const companyId = req.query.companyId
  const intentId = req.params.intentId
  console.log('examples called using companyId [%s] and intentId [%s]', companyId, intentId)
  if (companyId && intentId) {
    const ref = firebase.database().ref(`data/companies/${companyId}/intents/${intentId}`)
    ref.on('value', (snapshot) => {
      const intent = snapshot.val()
      res.json(intent.utterances)
    }, (err) => {
      console.error('Error fetching examples;', err)
      res.status(500).send({
        status: 500,
        message: 'Error fetching examples'
      })
    })
  } else {
    console.error('invalid params - use /intents/<intentId>/examples?companyId=<>')
    res.status(500).json({
      status: 500,
      message: 'invalid params - use /intents/<intentId>/examples?companyId=<>'
    })
  }
})

/**
 * @swagger
 * /examples/search/{q}:
 *   get:
 *     description: Get the list of suggested examples for the search term.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: companyId
 *         description: id of company that owns the workspace
 *         in: query
 *         required: true
 *         type: string
 *       - name: q
 *         description: the search term to find examples that start with the term
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Successful request
 *       500:
 *         description: Error fetching suggested examples from Firebase
 */
app.get('/examples/search/:q', function (req, res) {
  const companyId = req.query.companyId
  const q = req.params.q
  if (companyId && q) {
    if (q.length < 3) {
      res.json([])
    } else if (!examples.length) {
      const ref = firebase.database().ref(`data/companies/${companyId}/intents`)
      ref.on('value', (snapshot) => {
        const intents = snapshot.val()
        examples = [].concat.apply([],
          Object.keys(intents)
            .map((intentId) => intents[intentId])
            .map((intent) => intent.utterances)
        )
        res.json(searchExamples(q))
      }, (err) => {
        console.error('Error fetching examples;', err)
        res.status(500).json({
          status: 500,
          message: 'Error fetching examples'
        })
      })
    } else {
      res.json(searchExamples(q))
    }
  } else {
    console.error('invalid params - use /examples/search/<q>/?companyId=<>')
    res.status(500).json({
      status: 500,
      message: 'invalid params - use /examples/search/<q>/?companyId=<>'
    })
  }
})

function searchExamples(query) {
  const q = query.trim().toLowerCase()
  return examples
    .filter((ex) => ex && ex.trim().toLowerCase().startsWith(q))
    .slice(0, 5)
}

app.listen(PORT)
console.log('NLP server running on port:' + PORT)
