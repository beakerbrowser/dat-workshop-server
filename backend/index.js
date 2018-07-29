const assert = require('assert')
const express = require('express')
const Dat = require('@beaker/dat-node')
const toilet = require('toiletdb')
const mkdirp = require('mkdirp')
const {join} = require('path')
const fs = require('fs')
const parseDatUrl = require('parse-dat-url')
const {promisify} = require('util')
const app = express()

exports.setup = async function setup (dataPath) {
  // setup the data folder
  var thumbsPath = join(dataPath, 'thumbs')
  mkdirp.sync(dataPath)
  mkdirp.sync(thumbsPath)
  const dat = Dat.createNode({path: dataPath}) // initiate dat
  const db = toilet(join(dataPath, 'workshop-data.json'))
  db.open = promisify(db.open.bind(db))
  db.read = promisify(db.read.bind(db))
  db.write = promisify(db.write.bind(db))
  await db.open()

  const WORKSHOP_HOST = process.env.WORKSHOP_HOST || 'localhost:3000'
  const USE_HTTPS = (process.env.USE_HTTPS == 1)

  var server = {
    url: (USE_HTTPS ? 'https://' : 'http://') + WORKSHOP_HOST,
    dat,
    db,
    activeDats: null
  }

  // swarm the frontend
  var frontendArchive = await dat.createArchive()
  writeFrontend(server, frontendArchive)
  fs.watch(join(__dirname, '..', 'frontend'), {recursive: true}, () => writeFrontend(server, frontendArchive))
  console.log('frontend dat:', frontendArchive.url)

  // swarm all dats
  server.activeDats = (await db.read('dats')) || {}
  console.log('Swarming', Object.keys(server.activeDats).length, 'dats')
  for (let key in server.activeDats) {
    await indexDat(server, server.activeDats[key])
  }

  // configure app
  app.use(express.json())
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    next()
  })

  // GET frontend
  app.get('/', (req, res) => res.send(`Use the <a href="dat://${WORKSHOP_HOST}">dat frontend</a>`))
  app.get('/.well-known/dat', (req, res) => res.send(frontendArchive.url))

  // GET /dats
  app.get('/dats', (req, res) => {
    res.json({dats: extractDatInfos(server.activeDats)})
  })

  // POST /dats
  app.post('/dats', async (req, res) => {
    try {
      // validate
      assert(req.body && typeof req.body === 'object', 'Must send a JSON object')
      var {url, thumbnail} = req.body
      assert(url && typeof url === 'string', 'URL is required')
      assert(thumbnail && typeof thumbnail === 'string', 'Thumbnail is required')

      // parse url
      var urlp
      try {
        urlp = parseDatUrl(url)
      } catch (e) {
        throw new Error('Must provide a dat url')
      }
      var key = urlp.hostname

      // write the screenshot
      fs.writeFileSync(join(thumbsPath, key + '.png'), thumbnail, 'base64')

      // add/replace the dat
      server.activeDats[key] = {
        url,
        title: '',
        description: '',
        archive: null
      }
      await indexDat(server, server.activeDats[key])

      res.json({success: true})
    } catch (e) {
      res.status(400).json({error: e.message})
    }
  })

  // static assets
  app.use('/thumbs', express.static(thumbsPath))

  // listen
  app.listen(3000, () => console.log('listening on port 3000'))

  return server
}

function extractDatInfos (activeDats) {
  var dats = {}
  for (var key in activeDats) {
    let datInfo = activeDats[key]
    dats[key] = {
      url: datInfo.url,
      title: datInfo.title,
      description: datInfo.description
    }
  }
  return dats
}

async function indexDat (server, datInfo) {
  var {dat} = server
  datInfo.archive = await dat.getArchive(datInfo.url)
  // index title/desc meta
  await indexMeta(server, datInfo)
  // watch for subsequent updates
  datInfo.archive.watch('/dat.json', e => indexMeta(server, datInfo))
}

async function indexMeta (server, datInfo) {
  try {
    // read info
    var meta = JSON.parse(await datInfo.archive.readFile('/dat.json'))
    datInfo.title = meta.title
    datInfo.description = meta.description
    // save to db
    await server.db.write('dats', extractDatInfos(server.activeDats))
  } catch (e) {
    console.error('Failed to index meta', datInfo.url, e)
  }
}

async function writeFrontend (server, archive) {
  function copy (path) {
    archive.writeFile(path, fs.readFileSync(join(__dirname, '..', 'frontend', path)))
  }
  archive.writeFile('/backend.json', server.url)
  copy('dat.json')
  copy('index.html')
  copy('index.css')
  copy('index.js')
}